import { z } from 'zod'
import {
  ClaimRecordSchema,
  claimStabilityKey,
  claimStabilityKeyToken,
  type ClaimRecord,
  type ClaimStabilityKey,
} from '../../shared/claims.js'

/**
 * DL-EVQ-03 is deliberately an analysis-only seam. Callers supply an ordinal rather than a
 * collection timestamp, and this module never returns claim IDs, scope IDs, aliases, collection
 * IDs, or the exact timestamps carried by canonical claim rows.
 */
const IsoWeekSchema = z.string().regex(/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/)

export const ClaimStabilityObservationSchema = z
  .object({
    /** Caller-assigned replay order; it is not a job ID or timestamp. */
    collectionOrdinal: z.number().int().positive().safe(),
    /** The only collection-time grain this analysis is allowed to render. */
    isoWeek: IsoWeekSchema,
    claim: ClaimRecordSchema,
    /** A finite measured result. The result exposes only its range and change classification. */
    measuredValue: z.number().finite(),
    /** Opaque revision of the coverage evidence used for this result. Never rendered. */
    coverageFingerprint: z.string().min(1).max(256).regex(/^[A-Za-z0-9._-]+$/),
  })
  .strict()
export type ClaimStabilityObservation = z.infer<typeof ClaimStabilityObservationSchema>

export class ClaimStabilityError extends Error {
  readonly code: ClaimStabilityErrorCode

  constructor(code: ClaimStabilityErrorCode) {
    super(code)
    this.name = 'ClaimStabilityError'
    this.code = code
  }
}

export type ClaimStabilityErrorCode =
  | 'INVALID_INPUT'
  | 'CONFLICTING_CLAIM_RECORD'
  | 'DUPLICATE_FAMILY_COLLECTION'
  | 'BROKEN_SUPERSESSION_CHAIN'

export type ClaimStabilityChange =
  | 'initial'
  | 'unchanged'
  | 'coverage_only'
  | 'value_only'
  | 'coverage_and_value'
  | 'evidence_only'

export interface ClaimStabilitySnapshot {
  /** Claim-version position within this method-version stratum, never a claim ID. */
  readonly versionOrdinal: number
  readonly isoWeek: string
  readonly change: ClaimStabilityChange
}

export interface ClaimStabilityCounts {
  readonly collectionCount: number
  readonly transitionCount: number
  /** Any visible change in evidence coverage, measured value, or claim version. */
  readonly churnCount: number
  readonly versionChurnCount: number
  readonly coverageChurnCount: number
  readonly valueChurnCount: number
  readonly evidenceOnlyChurnCount: number
  readonly oscillationCount: number
}

export interface ClaimStabilityAttribution {
  /** Null when no transition changed, rather than a fabricated 0% attribution. */
  readonly coverageShare: number | null
  /** May overlap coverageShare when both coverage and value changed together. */
  readonly valueShare: number | null
  /** The overlap is explicit so the two shares are not misread as a partition. */
  readonly bothShare: number | null
}

export interface ClaimStabilitySeries {
  /** Stable only within this returned report; hides the stability key's scope component. */
  readonly seriesOrdinal: number
  readonly layer: ClaimRecord['layer']
  /** Method version is intentionally disclosed as a stratum, never blended into a value change. */
  readonly methodVersion: string
  readonly snapshots: readonly ClaimStabilitySnapshot[]
  readonly counts: ClaimStabilityCounts
  readonly valueRange: { readonly min: number; readonly max: number }
  readonly attribution: ClaimStabilityAttribution
}

export interface ClaimStabilityMethodVersionChurn {
  readonly transitionCount: number
  readonly changedCount: number
  /** Null for a one-collection family; version drift is not silently rendered as 0%. */
  readonly share: number | null
}

export interface ClaimStabilityFamilyProfile {
  /** Stable only within this returned report; no scope key, alias, or window is exposed. */
  readonly familyOrdinal: number
  readonly statementCode: string
  readonly methodId: string
  /** Method-version changes are separate from numerical or coverage churn. */
  readonly methodVersionChurn: ClaimStabilityMethodVersionChurn
  readonly series: readonly ClaimStabilitySeries[]
}

export interface ClaimStabilityReport {
  readonly profiles: readonly ClaimStabilityFamilyProfile[]
}

interface ParsedObservation extends ClaimStabilityObservation {
  readonly stabilityKey: ClaimStabilityKey
  readonly stabilityToken: string
  readonly seriesToken: string
  readonly familyToken: string
}

function parseObservations(value: unknown): ParsedObservation[] {
  if (!Array.isArray(value)) throw new ClaimStabilityError('INVALID_INPUT')
  const parsed: ParsedObservation[] = []
  for (const entry of value) {
    const result = ClaimStabilityObservationSchema.safeParse(entry)
    if (!result.success) throw new ClaimStabilityError('INVALID_INPUT')
    const stabilityKey = claimStabilityKey(result.data.claim)
    const stabilityToken = claimStabilityKeyToken(stabilityKey)
    // Storage allows one supersession chain only within one layer, even though ADR-01's index
    // intentionally excludes it. It therefore remains an explicit analysis stratum.
    const seriesToken = `${stabilityToken}|${result.data.claim.layer}`
    const familyToken = [
      stabilityKey.statementCode,
      stabilityKey.methodId,
      stabilityKey.windowStart,
      stabilityKey.windowEnd,
      stabilityKey.scopeId,
      stabilityKey.schemaVersion,
      result.data.claim.layer,
    ].join('|')
    parsed.push({ ...result.data, stabilityKey, stabilityToken, seriesToken, familyToken })
  }
  return parsed
}

function sameClaimRecord(left: ClaimRecord, right: ClaimRecord): boolean {
  return left.claimId === right.claimId
    && left.layer === right.layer
    && left.statementCode === right.statementCode
    && left.methodId === right.methodId
    && left.methodVersion === right.methodVersion
    && left.windowStart === right.windowStart
    && left.windowEnd === right.windowEnd
    && left.scopeId === right.scopeId
    && left.schemaVersion === right.schemaVersion
    && left.claimIdMaterialVersion === right.claimIdMaterialVersion
    && left.createdAt === right.createdAt
    && left.supersededBy === right.supersededBy
}

function validateReplay(observations: readonly ParsedObservation[]): Map<string, ClaimRecord> {
  const claims = new Map<string, ClaimRecord>()
  const familyCollections = new Set<string>()
  for (const observation of observations) {
    const existing = claims.get(observation.claim.claimId)
    if (existing && !sameClaimRecord(existing, observation.claim)) {
      throw new ClaimStabilityError('CONFLICTING_CLAIM_RECORD')
    }
    claims.set(observation.claim.claimId, observation.claim)

    const collectionKey = `${observation.familyToken}|${observation.collectionOrdinal}`
    if (familyCollections.has(collectionKey)) {
      // A job cannot choose two method versions for the same family; accepting both would turn
      // a version migration into an arbitrary ordering decision.
      throw new ClaimStabilityError('DUPLICATE_FAMILY_COLLECTION')
    }
    familyCollections.add(collectionKey)
  }
  return claims
}

function isSuccessor(previous: ClaimRecord, current: ClaimRecord, claims: ReadonlyMap<string, ClaimRecord>): boolean {
  const visited = new Set<string>([previous.claimId])
  let cursor = previous.supersededBy
  while (cursor !== null) {
    if (visited.has(cursor)) return false
    if (cursor === current.claimId) return true
    visited.add(cursor)
    cursor = claims.get(cursor)?.supersededBy ?? null
  }
  return false
}

function changeFor(previous: ParsedObservation | null, current: ParsedObservation): ClaimStabilityChange {
  if (!previous) return 'initial'
  const coverageChanged = previous.coverageFingerprint !== current.coverageFingerprint
  const valueChanged = previous.measuredValue !== current.measuredValue
  if (coverageChanged && valueChanged) return 'coverage_and_value'
  if (coverageChanged) return 'coverage_only'
  if (valueChanged) return 'value_only'
  return previous.claim.claimId === current.claim.claimId ? 'unchanged' : 'evidence_only'
}

function buildSeries(
  seriesOrdinal: number,
  entries: readonly ParsedObservation[],
  claims: ReadonlyMap<string, ClaimRecord>,
): ClaimStabilitySeries {
  const ordered = [...entries].sort((left, right) => left.collectionOrdinal - right.collectionOrdinal)
  const snapshots: ClaimStabilitySnapshot[] = []
  let versionOrdinal = 1
  let previous: ParsedObservation | null = null
  let versionChurnCount = 0
  let coverageChurnCount = 0
  let valueChurnCount = 0
  let evidenceOnlyChurnCount = 0
  let oscillationCount = 0

  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index]
    if (previous && previous.claim.claimId !== current.claim.claimId) {
      if (!isSuccessor(previous.claim, current.claim, claims)) {
        throw new ClaimStabilityError('BROKEN_SUPERSESSION_CHAIN')
      }
      versionOrdinal += 1
      versionChurnCount += 1
    }
    const change = changeFor(previous, current)
    if (change === 'coverage_only' || change === 'coverage_and_value') coverageChurnCount += 1
    if (change === 'value_only' || change === 'coverage_and_value') valueChurnCount += 1
    if (change === 'evidence_only') evidenceOnlyChurnCount += 1
    if (
      index >= 2
      && ordered[index - 2].measuredValue === current.measuredValue
      && ordered[index - 1].measuredValue !== current.measuredValue
    ) {
      oscillationCount += 1
    }
    snapshots.push({ versionOrdinal, isoWeek: current.isoWeek, change })
    previous = current
  }

  const transitionCount = Math.max(ordered.length - 1, 0)
  // Coverage and value may change on the same transition. Count the transition once, then make
  // the overlap visible through `bothShare` rather than inflating the churn denominator.
  const churnCount = snapshots.filter(({ change }) => change !== 'initial' && change !== 'unchanged').length
  const denominator = churnCount === 0 ? null : churnCount
  const bothCount = snapshots.filter(({ change }) => change === 'coverage_and_value').length
  const values = ordered.map(({ measuredValue }) => measuredValue)
  return {
    seriesOrdinal,
    layer: ordered[0].claim.layer,
    methodVersion: ordered[0].claim.methodVersion,
    snapshots,
    counts: {
      collectionCount: ordered.length,
      transitionCount,
      churnCount,
      versionChurnCount,
      coverageChurnCount,
      valueChurnCount,
      evidenceOnlyChurnCount,
      oscillationCount,
    },
    valueRange: { min: Math.min(...values), max: Math.max(...values) },
    attribution: {
      coverageShare: denominator === null ? null : coverageChurnCount / denominator,
      valueShare: denominator === null ? null : valueChurnCount / denominator,
      bothShare: denominator === null ? null : bothCount / denominator,
    },
  }
}

/**
 * Replays caller-supplied, invented claim observations into privacy-safe stability profiles.
 * This is not a `drift_stability` coverage producer: it returns research analysis only and has
 * no persistence, caller integration, or coverage-vector dependency.
 */
export function analyseClaimStability(value: unknown): ClaimStabilityReport {
  const observations = parseObservations(value)
  const claims = validateReplay(observations)
  const familyEntries = new Map<string, ParsedObservation[]>()
  for (const observation of observations) {
    const entries = familyEntries.get(observation.familyToken) ?? []
    entries.push(observation)
    familyEntries.set(observation.familyToken, entries)
  }

  return {
    profiles: [...familyEntries.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, entries], familyIndex) => {
        const seriesEntries = new Map<string, ParsedObservation[]>()
        for (const entry of entries) {
          const stratum = seriesEntries.get(entry.seriesToken) ?? []
          stratum.push(entry)
          seriesEntries.set(entry.seriesToken, stratum)
        }
        const series = [...seriesEntries.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([, stratum], index) => buildSeries(index + 1, stratum, claims))
        const orderedFamily = [...entries].sort((left, right) => left.collectionOrdinal - right.collectionOrdinal)
        let changedCount = 0
        for (let index = 1; index < orderedFamily.length; index += 1) {
          if (orderedFamily[index - 1].claim.methodVersion !== orderedFamily[index].claim.methodVersion) {
            changedCount += 1
          }
        }
        const transitionCount = Math.max(orderedFamily.length - 1, 0)
        const first = entries[0].stabilityKey
        return {
          familyOrdinal: familyIndex + 1,
          statementCode: first.statementCode,
          methodId: first.methodId,
          methodVersionChurn: {
            transitionCount,
            changedCount,
            share: transitionCount === 0 ? null : changedCount / transitionCount,
          },
          series,
        }
      }),
  }
}
