import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CLAIM_ID_MATERIAL_VERSION,
  CLAIM_SCHEMA_VERSION,
  CLAIM_SCOPE_ID_ENTROPY_BYTES,
  CLAIM_SCOPE_ID_PREFIX,
  claimIdMaterial,
  claimStabilityKey,
  claimStabilityKeyToken,
  computeClaimId,
} from '../../shared/claims.js'
import { reconcileGithubCoreReceipts } from '../connectors/github/core.js'
import { openStorageDatabase } from './database.js'
import {
  installIncrementalGithubCoreStorage,
  persistIncrementalGithubCoreTransition,
} from './incremental.js'
import {
  ClaimStorageError,
  claimScopeTestSeams,
  clearClaimScopeAlias,
  installClaimGraphStorage,
  readClaim,
  registerClaim,
  registerClaimScope,
  registerEvidenceAnchor,
  supersedeClaim,
} from './claims.js'

/**
 * DL-SPINE-02 — replay proof for the versioned claim-ID canonicalisation (ADR-01).
 *
 * Every value in this file is invented. No real, private, or generated data is read, no
 * person metric is computed, no network call is made, and no new sink is written.
 */

const databases: Database.Database[] = []

const windowStart = '2026-01-05T00:00:00.000Z'
const windowEnd = '2026-04-06T00:00:00.000Z'
const createdAt = '2026-04-06T12:00:00.000Z'
const laterCreatedAt = '2026-09-30T23:59:59.999Z'
const linkedAt = '2026-01-05T00:00:00.000Z'

const ALPHA_ENTROPY = Buffer.from('a1'.repeat(CLAIM_SCOPE_ID_ENTROPY_BYTES), 'hex')
const BETA_ENTROPY = Buffer.from('b2'.repeat(CLAIM_SCOPE_ID_ENTROPY_BYTES), 'hex')
const ALPHA_SCOPE = `${CLAIM_SCOPE_ID_PREFIX}${'a1'.repeat(CLAIM_SCOPE_ID_ENTROPY_BYTES)}`
const BETA_SCOPE = `${CLAIM_SCOPE_ID_PREFIX}${'b2'.repeat(CLAIM_SCOPE_ID_ENTROPY_BYTES)}`

const EVIDENCE_ANCHORS = [
  { evidenceId: 'ev-obs-1', layer: 'observed' },
  { evidenceId: 'ev-det-4', layer: 'deterministic' },
  { evidenceId: 'ev-det-5', layer: 'deterministic' },
  { evidenceId: 'ev-det-6', layer: 'deterministic' },
  { evidenceId: 'ev-mod-1', layer: 'modelled' },
  { evidenceId: 'ev-hyp-1', layer: 'hypothesis' },
] as const

afterEach(() => {
  for (const db of databases.splice(0)) {
    if (db.open) db.close()
  }
})

interface CoverageTargetRow {
  coverage_id: string
  range_start: string
  job_id: string
}

interface ReplayStore {
  db: Database.Database
  coverage: CoverageTargetRow
}

/** A P2 store with the coverage tables populated, the claim graph installed, anchors seeded. */
function replayStore(): ReplayStore {
  const db = openStorageDatabase(':memory:')
  databases.push(db)
  installIncrementalGithubCoreStorage(db)
  persistIncrementalGithubCoreTransition(db, {
    jobId: 'job-a1',
    scopeAlias: 'scope-a',
    consentRevision: 'consent-a',
    sourceSnapshotId: 'snapshot-job-a1',
    startedAt: '2026-04-06T00:00:01.000Z',
    completedAt: '2026-04-06T00:00:02.000Z',
    transition: reconcileGithubCoreReceipts({
      checkpoint: null,
      scopeAlias: 'scope-a',
      rangeStart: '2026-01-05T00:00:00.000Z',
      rangeEnd: '2026-01-06T00:00:00.000Z',
      observedAt: '2026-01-06T00:00:00.000Z',
      jobId: 'job-a1',
      consentRevision: 'consent-a',
      pageCap: 2,
      snapshotHash: 'a'.repeat(64),
      receipts: [{ receiptId: 'receipt-job-a1', pageNumber: 1, unitIds: [], nextCursor: null }],
    }),
  })
  installClaimGraphStorage(db)
  const coverage = db.prepare(
    'SELECT coverage_id, range_start, job_id FROM coverage_ledger',
  ).get() as CoverageTargetRow
  claimScopeTestSeams.registerWithEntropy(db, { scopeAlias: 'repo-a7', linkedAt }, () => ALPHA_ENTROPY)
  claimScopeTestSeams.registerWithEntropy(db, { scopeAlias: 'repo-b3', linkedAt }, () => BETA_ENTROPY)
  for (const anchor of EVIDENCE_ANCHORS) {
    registerEvidenceAnchor(db, {
      evidenceId: anchor.evidenceId,
      layer: anchor.layer,
      coverage: {
        coverageId: coverage.coverage_id,
        rangeStart: coverage.range_start,
        jobId: coverage.job_id,
      },
    })
  }
  return { db, coverage }
}

function claimInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    layer: 'deterministic',
    statementCode: 'CI_RERUN_PATTERN',
    methodId: 'det.rerun_ratio',
    methodVersion: '1.0.0',
    windowStart,
    windowEnd,
    scopeId: ALPHA_SCOPE,
    createdAt,
    edges: [
      { role: 'supports', targetEvidenceId: 'ev-det-4' },
      { role: 'contradicts', targetEvidenceId: 'ev-det-5' },
    ],
    limitations: [
      { limitationCode: 'RERUN_NOT_FLAKE', dimension: 'completeness', copyKey: 'det.rerun.truncated' },
    ],
    ...overrides,
  }
}

const BASE_IDENTITY = {
  layer: 'deterministic',
  statementCode: 'CI_RERUN_PATTERN',
  methodId: 'det.rerun_ratio',
  methodVersion: '1.0.0',
  basis: [
    { role: 'supports', targetEvidenceId: 'ev-det-4' },
    { role: 'contradicts', targetEvidenceId: 'ev-det-5' },
  ],
  windowStart,
  windowEnd,
  scopeId: ALPHA_SCOPE,
  schemaVersion: CLAIM_SCHEMA_VERSION,
} as const

/**
 * The golden material and ID. A change to the canonicalisation that does not bump
 * `CLAIM_ID_MATERIAL_VERSION` breaks these two assertions, which is the point: the format is
 * a contract, not an implementation detail.
 */
const GOLDEN_MATERIAL = [
  'claim-id.v2',
  'deterministic',
  'CI_RERUN_PATTERN',
  'det.rerun_ratio@1.0.0',
  'evidence|contradicts|ev-det-5,evidence|supports|ev-det-4',
  `${windowStart}/${windowEnd}`,
  ALPHA_SCOPE,
  CLAIM_SCHEMA_VERSION,
].join('\n')

function errorCode(operation: () => unknown): string {
  try {
    operation()
  } catch (error) {
    if (error instanceof ClaimStorageError) return error.code
    return `UNEXPECTED:${String(error)}`
  }
  return 'NO_ERROR'
}

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) return [[...values]]
  const result: T[][] = []
  for (let index = 0; index < values.length; index += 1) {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)]
    for (const tail of permutations(rest)) result.push([values[index], ...tail])
  }
  return result
}

describe('claim ID canonicalisation is byte-stable', () => {
  it('pins the canonical material and the derived ID for one fixture', () => {
    expect(claimIdMaterial(BASE_IDENTITY)).toBe(GOLDEN_MATERIAL)
    // Digest verified out of band against the material bytes: `printf … | sha256sum`.
    expect(computeClaimId(BASE_IDENTITY))
      .toBe('cl_815cb145a8da863d6f72e9cd5ef4dbb94223b885e76a1faf5b5d6278bea68218')
    expect(CLAIM_ID_MATERIAL_VERSION).toBe('claim-id.v2')
  })

  it('is invariant under every ordering of the basis edges, and under duplicates', () => {
    const { coverage } = replayStore()
    const basis = [
      { role: 'supports', targetEvidenceId: 'ev-det-4' },
      { role: 'contradicts', targetEvidenceId: 'ev-det-5' },
      {
        role: 'coverage_basis',
        targetCoverage: {
          coverageId: coverage.coverage_id,
          rangeStart: coverage.range_start,
          jobId: coverage.job_id,
        },
      },
    ] as const
    const expected = computeClaimId({ ...BASE_IDENTITY, basis })
    const seen = new Set<string>()
    for (const ordering of permutations(basis)) {
      seen.add(computeClaimId({ ...BASE_IDENTITY, basis: ordering }))
      seen.add(computeClaimId({ ...BASE_IDENTITY, basis: [...ordering, ordering[0]] }))
    }
    expect([...seen]).toEqual([expected])
  })

  it('reproduces the same ID on repeated runs and after a fresh module import', async () => {
    const first = computeClaimId(BASE_IDENTITY)
    for (let run = 0; run < 32; run += 1) expect(computeClaimId(BASE_IDENTITY)).toBe(first)

    vi.resetModules()
    const fresh = await import('../../shared/claims.js')
    expect(fresh.CLAIM_ID_MATERIAL_VERSION).toBe(CLAIM_ID_MATERIAL_VERSION)
    expect(fresh.claimIdMaterial(BASE_IDENTITY)).toBe(GOLDEN_MATERIAL)
    expect(fresh.computeClaimId(BASE_IDENTITY)).toBe(first)
  })

  it('changes the ID for every changed component of the material', () => {
    const base = computeClaimId(BASE_IDENTITY)
    const variants = [
      { layer: 'modelled' },
      { statementCode: 'COVERAGE_GAP' },
      { methodId: 'det.rerun_ratios' },
      { methodVersion: '1.0.1' },
      { basis: [{ role: 'supports', targetEvidenceId: 'ev-det-4' }] },
      { basis: [{ role: 'contradicts', targetEvidenceId: 'ev-det-4' }, ...BASE_IDENTITY.basis] },
      { windowStart: '2026-01-05T00:00:00.001Z' },
      { windowEnd: '2026-04-06T00:00:00.001Z' },
      { scopeId: BETA_SCOPE },
    ] as const
    const ids = variants.map((variant) => computeClaimId({ ...BASE_IDENTITY, ...variant }))
    expect(new Set(ids).size).toBe(variants.length)
    expect(ids).not.toContain(base)
  })

  it('separates the typed target kinds so no two basis edges can alias each other', () => {
    const { coverage } = replayStore()
    const claimTarget = computeClaimId({
      ...BASE_IDENTITY,
      layer: 'hypothesis',
      basis: [{ role: 'derives_from', targetClaimId: `cl_${'7'.repeat(64)}` }],
    })
    const evidenceTarget = computeClaimId({
      ...BASE_IDENTITY,
      layer: 'hypothesis',
      basis: [{ role: 'supports', targetEvidenceId: 'ev-det-4' }],
    })
    const coverageTarget = computeClaimId({
      ...BASE_IDENTITY,
      layer: 'hypothesis',
      basis: [{
        role: 'coverage_basis',
        targetCoverage: {
          coverageId: coverage.coverage_id,
          rangeStart: coverage.range_start,
          jobId: coverage.job_id,
        },
      }],
    })
    expect(new Set([claimTarget, evidenceTarget, coverageTarget]).size).toBe(3)
  })
})

describe('canonicalisation is locale-, float-, and timezone-free', () => {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url))
  const sources = {
    contract: join(moduleDirectory, '..', '..', 'shared', 'claims.ts'),
    writer: join(moduleDirectory, 'claims.ts'),
  }

  /** Prose in this file names the forbidden APIs on purpose, so comments are stripped first. */
  function executableSource(path: string): string {
    return readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
  }

  it('never reaches for a locale-sensitive or local-time API on the write path', () => {
    const forbidden = [
      'localeCompare',
      'toLocaleString',
      'toLocaleDateString',
      'toLocaleTimeString',
      'toLocaleUpperCase',
      'toLocaleLowerCase',
      'Intl',
      'getFullYear',
      'getMonth',
      'getDate',
      'getHours',
      'getMinutes',
      'getSeconds',
      'getTimezoneOffset',
      'Date.now',
      'toDateString',
      'toTimeString',
      'toUTCString',
    ]
    for (const [name, path] of Object.entries(sources)) {
      const source = executableSource(path)
      for (const api of forbidden) {
        expect(`${name}:${source.includes(api)}`).toBe(`${name}:false`)
      }
    }
    // The canonicalisation module itself is additionally free of any entropy source.
    const contract = executableSource(sources.contract)
    expect(contract).not.toContain('Math.random')
    expect(contract).not.toContain('randomBytes')
    // Ordering is the default sort (UTF-16 code units), never a comparator.
    expect(contract).toContain('.sort()')
  })

  it('admits no number into the material: floats fail the contract instead of formatting', () => {
    const { db } = replayStore()
    const floatEdges = [0.1 + 0.2, 1e21, -0, 1 / 3, Number.MIN_VALUE, Number.MAX_SAFE_INTEGER]
    for (const value of floatEdges) {
      expect(() => computeClaimId({ ...BASE_IDENTITY, methodId: value as unknown as string }))
        .toThrow()
      expect(errorCode(() => registerClaim(db, claimInput({ methodId: value }))))
        .toBe('CLAIM_CONTRACT_INVALID')
      expect(errorCode(() => registerClaim(db, claimInput({ windowStart: value }))))
        .toBe('CLAIM_CONTRACT_INVALID')
      expect(errorCode(() => registerClaim(db, claimInput({
        edges: [{ role: 'supports', targetEvidenceId: value }],
      })))).toBe('CLAIM_CONTRACT_INVALID')
    }
    expect(db.prepare('SELECT COUNT(*) FROM claim').pluck().get()).toBe(0)
  })

  it('treats a caller-stringified float as exact bytes, never as a number to re-format', () => {
    // These are the only float-derived strings the contract can accept, and they enter the
    // digest byte-for-byte: `0.1 + 0.2` keeps all seventeen digits and one changed digit is a
    // different claim. `1e+21` and `-0` cannot enter at all — `+` and a leading `-` are
    // outside the opaque-token alphabet — so exponent form and signed zero never reach the hash.
    expect(String(0.1 + 0.2)).toBe('0.30000000000000004')
    const exact = computeClaimId({ ...BASE_IDENTITY, methodId: '0.30000000000000004' })
    expect(claimIdMaterial({ ...BASE_IDENTITY, methodId: '0.30000000000000004' }))
      .toContain('0.30000000000000004@1.0.0')
    expect(computeClaimId({ ...BASE_IDENTITY, methodId: '0.30000000000000005' })).not.toBe(exact)

    expect(String(1e21)).toBe('1e+21')
    expect(() => computeClaimId({ ...BASE_IDENTITY, methodId: String(1e21) })).toThrow()
    expect(() => computeClaimId({ ...BASE_IDENTITY, methodId: '-0' })).toThrow()
    // JavaScript erases the sign of negative zero on stringification; the rule inherits that
    // and does not attempt to distinguish them.
    expect(String(-0)).toBe(String(0))
  })

  it('canonicalises identically under any ambient timezone', () => {
    const originalTz = process.env.TZ
    const expected = computeClaimId(BASE_IDENTITY)
    try {
      for (const zone of ['UTC', 'Pacific/Kiritimati', 'Pacific/Niue', 'America/New_York', 'Asia/Kolkata']) {
        process.env.TZ = zone
        expect(computeClaimId(BASE_IDENTITY)).toBe(expected)
        expect(claimIdMaterial(BASE_IDENTITY)).toBe(GOLDEN_MATERIAL)
        expect(new Date(windowStart).toISOString()).toBe(windowStart)
      }
    } finally {
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    }
  })

  it('accepts only canonical UTC windows, so an offset form cannot reach the digest', () => {
    const { db } = replayStore()
    const sameInstantWithOffset = '2026-01-04T19:00:00.000-05:00'
    expect(new Date(sameInstantWithOffset).toISOString()).toBe(windowStart)
    expect(errorCode(() => registerClaim(db, claimInput({ windowStart: sameInstantWithOffset }))))
      .toBe('CLAIM_CONTRACT_INVALID')
    expect(errorCode(() => registerClaim(db, claimInput({ windowStart: '2026-01-05T00:00:00Z' }))))
      .toBe('CLAIM_CONTRACT_INVALID')

    // A caller that canonicalises the same instant at its own boundary lands on the same ID.
    const canonicalised = new Date(sameInstantWithOffset).toISOString()
    expect(computeClaimId({ ...BASE_IDENTITY, windowStart: canonicalised }))
      .toBe(computeClaimId(BASE_IDENTITY))
  })
})

describe('replay against the store', () => {
  it('replays identical inputs at a later wall clock as a no-op, not a collision', () => {
    const { db } = replayStore()
    const first = registerClaim(db, claimInput())
    expect(first.applied).toBe(true)

    const replayed = registerClaim(db, claimInput({ createdAt: laterCreatedAt }))
    expect(replayed).toEqual({ claimId: first.claimId, applied: false })
    // First write wins: the recorded creation time is never rewritten by a replay.
    expect(readClaim(db, first.claimId)?.createdAt).toBe(createdAt)
    expect(readClaim(db, first.claimId)?.claimIdMaterialVersion).toBe(CLAIM_ID_MATERIAL_VERSION)
  })

  it('reproduces byte-identical IDs across insert orders and duplicate-bearing input', () => {
    const { db, coverage } = replayStore()
    const edges = [
      { role: 'supports', targetEvidenceId: 'ev-det-4' },
      { role: 'contradicts', targetEvidenceId: 'ev-det-5' },
      {
        role: 'coverage_basis',
        targetCoverage: {
          coverageId: coverage.coverage_id,
          rangeStart: coverage.range_start,
          jobId: coverage.job_id,
        },
      },
    ] as const

    const ids = new Set<string>()
    let applications = 0
    for (const ordering of permutations(edges)) {
      const withDuplicate = [...ordering, ordering[ordering.length - 1]]
      for (const candidate of [ordering, withDuplicate]) {
        const result = registerClaim(db, claimInput({ edges: candidate }))
        ids.add(result.claimId)
        if (result.applied) applications += 1
      }
    }
    expect(ids.size).toBe(1)
    expect(applications).toBe(1)
    expect(db.prepare('SELECT COUNT(*) FROM claim').pluck().get()).toBe(1)
    // The duplicate edge was deduplicated before insert rather than hard-failing.
    expect(db.prepare('SELECT COUNT(*) FROM claim_evidence_edge').pluck().get()).toBe(3)
  })

  it('deduplicates a duplicate-bearing limitation set instead of failing the insert', () => {
    const { db } = replayStore()
    const limitation = {
      limitationCode: 'RERUN_NOT_FLAKE', dimension: 'completeness', copyKey: 'det.rerun.truncated',
    }
    const result = registerClaim(db, claimInput({ limitations: [limitation, { ...limitation }] }))
    expect(result.applied).toBe(true)
    expect(db.prepare('SELECT COUNT(*) FROM limitation_instance').pluck().get()).toBe(1)
    expect(registerClaim(db, claimInput({ limitations: [limitation] })).applied).toBe(false)
  })

  it('surfaces content drift under one canonicalisation version as a data-quality error', () => {
    const { db } = replayStore()
    const first = registerClaim(db, claimInput())
    expect(errorCode(() => registerClaim(db, claimInput({
      limitations: [
        { limitationCode: 'SAMPLE_TOO_SMALL', dimension: 'sample', copyKey: 'det.rerun.small' },
      ],
    })))).toBe('CLAIM_ID_COLLISION')
    // Nothing was overwritten: the stored claim is exactly what the first write recorded.
    expect(readClaim(db, first.claimId)?.createdAt).toBe(createdAt)
    expect(db.prepare('SELECT COUNT(*) FROM limitation_instance').pluck().get()).toBe(1)
    expect(db.prepare('SELECT limitation_code FROM limitation_instance').pluck().get())
      .toBe('RERUN_NOT_FLAKE')
  })

  it('registers an evidence anchor idempotently and reports content drift distinctly', () => {
    const { db, coverage } = replayStore()
    const anchor = {
      evidenceId: 'ev-det-4',
      layer: 'deterministic',
      coverage: {
        coverageId: coverage.coverage_id,
        rangeStart: coverage.range_start,
        jobId: coverage.job_id,
      },
    }
    expect(registerEvidenceAnchor(db, anchor)).toEqual({ applied: false })
    expect(registerEvidenceAnchor(db, { ...anchor, evidenceId: 'ev-det-9' }))
      .toEqual({ applied: true })
    expect(errorCode(() => registerEvidenceAnchor(db, { ...anchor, layer: 'modelled' })))
      .toBe('CLAIM_EVIDENCE_ANCHOR_CONFLICT')
    expect(db.prepare('SELECT layer FROM evidence WHERE evidence_id = ?').pluck().get('ev-det-4'))
      .toBe('deterministic')
  })
})

describe('changed inputs mint a new claim and a lineage link', () => {
  it('supersedes the predecessor when the evidence set changes', () => {
    const { db } = replayStore()
    const first = registerClaim(db, claimInput())
    const second = registerClaim(db, claimInput({
      edges: [
        { role: 'supports', targetEvidenceId: 'ev-det-4' },
        { role: 'contradicts', targetEvidenceId: 'ev-det-5' },
        { role: 'supports', targetEvidenceId: 'ev-det-6' },
      ],
    }))
    expect(second.claimId).not.toBe(first.claimId)
    expect(second.applied).toBe(true)

    supersedeClaim(db, { claimId: first.claimId, supersededBy: second.claimId })
    expect(readClaim(db, first.claimId)?.supersededBy).toBe(second.claimId)
    expect(readClaim(db, second.claimId)?.supersededBy).toBeNull()
  })

  it('gives a re-derived claim a new ID so its supersession link is representable', () => {
    // The v1 material hashed only evidence IDs, so a claim whose only edge was `derives_from`
    // computed the SAME ID after its base was re-derived: the successor collided with its own
    // predecessor and D1 -> D2 could not be recorded at all.
    const { db } = replayStore()
    const baseOne = registerClaim(db, claimInput())
    const baseTwo = registerClaim(db, claimInput({
      edges: [
        { role: 'supports', targetEvidenceId: 'ev-det-4' },
        { role: 'contradicts', targetEvidenceId: 'ev-det-5' },
        { role: 'supports', targetEvidenceId: 'ev-det-6' },
      ],
    }))
    const derivedInput = (targetClaimId: string): Record<string, unknown> => claimInput({
      layer: 'modelled',
      methodId: 'mod.rerun_shift',
      edges: [{ role: 'derives_from', targetClaimId }],
    })

    const derivedOne = registerClaim(db, derivedInput(baseOne.claimId))
    const derivedTwo = registerClaim(db, derivedInput(baseTwo.claimId))
    expect(derivedOne.applied).toBe(true)
    expect(derivedTwo.applied).toBe(true)
    expect(derivedTwo.claimId).not.toBe(derivedOne.claimId)

    supersedeClaim(db, { claimId: baseOne.claimId, supersededBy: baseTwo.claimId })
    supersedeClaim(db, { claimId: derivedOne.claimId, supersededBy: derivedTwo.claimId })
    expect(readClaim(db, derivedOne.claimId)?.supersededBy).toBe(derivedTwo.claimId)
  })

  it('groups a supersession chain by stability key and keeps other scopes out of the series', () => {
    const { db } = replayStore()
    const chain = [
      registerClaim(db, claimInput()),
      registerClaim(db, claimInput({
        edges: [
          { role: 'supports', targetEvidenceId: 'ev-det-4' },
          { role: 'contradicts', targetEvidenceId: 'ev-det-5' },
          { role: 'supports', targetEvidenceId: 'ev-det-6' },
        ],
      })),
      registerClaim(db, claimInput({
        edges: [{ role: 'supports', targetEvidenceId: 'ev-det-6' }],
      })),
    ]
    supersedeClaim(db, { claimId: chain[0].claimId, supersededBy: chain[1].claimId })
    supersedeClaim(db, { claimId: chain[1].claimId, supersededBy: chain[2].claimId })

    const records = chain.map((entry) => readClaim(db, entry.claimId)!)
    const series = new Set(records.map((record) => claimStabilityKeyToken(claimStabilityKey(record))))
    expect(series.size).toBe(1)
    expect(records.map((record) => record.supersededBy))
      .toEqual([chain[1].claimId, chain[2].claimId, null])

    const otherScope = registerClaim(db, claimInput({ scopeId: BETA_SCOPE }))
    expect(claimStabilityKeyToken(claimStabilityKey(readClaim(db, otherScope.claimId)!)))
      .not.toBe([...series][0])
    expect(errorCode(() => supersedeClaim(db, {
      claimId: otherScope.claimId, supersededBy: chain[2].claimId,
    }))).toBe('CLAIM_SUPERSESSION_SERIES_MISMATCH')
  })

  it('refuses cycles of every length and refuses to re-point a superseded claim', () => {
    const { db } = replayStore()
    const a = registerClaim(db, claimInput())
    const b = registerClaim(db, claimInput({
      edges: [{ role: 'supports', targetEvidenceId: 'ev-det-6' }],
    }))
    const c = registerClaim(db, claimInput({
      edges: [{ role: 'contradicts', targetEvidenceId: 'ev-det-6' }],
    }))

    expect(errorCode(() => supersedeClaim(db, { claimId: a.claimId, supersededBy: a.claimId })))
      .toBe('CLAIM_CONTRACT_INVALID')

    supersedeClaim(db, { claimId: a.claimId, supersededBy: b.claimId })
    // Two-cycle.
    expect(errorCode(() => supersedeClaim(db, { claimId: b.claimId, supersededBy: a.claimId })))
      .toBe('CLAIM_SUPERSESSION_CYCLE')
    supersedeClaim(db, { claimId: b.claimId, supersededBy: c.claimId })
    // Three-cycle.
    expect(errorCode(() => supersedeClaim(db, { claimId: c.claimId, supersededBy: a.claimId })))
      .toBe('CLAIM_SUPERSESSION_CYCLE')

    // Re-pointing to a different successor is refused; re-pointing to the same one is a no-op.
    expect(errorCode(() => supersedeClaim(db, { claimId: a.claimId, supersededBy: c.claimId })))
      .toBe('CLAIM_SUPERSESSION_CONFLICT')
    expect(() => supersedeClaim(db, { claimId: a.claimId, supersededBy: b.claimId })).not.toThrow()
    expect(readClaim(db, a.claimId)?.supersededBy).toBe(b.claimId)
    expect(readClaim(db, c.claimId)?.supersededBy).toBeNull()
  })

  it('refuses to supersede across layers, which would relabel a claim', () => {
    const { db } = replayStore()
    const modelled = registerClaim(db, claimInput({ layer: 'modelled' }))
    const hypothesis = registerClaim(db, claimInput({ layer: 'hypothesis' }))
    expect(hypothesis.claimId).not.toBe(modelled.claimId)
    expect(errorCode(() => supersedeClaim(db, {
      claimId: modelled.claimId, supersededBy: hypothesis.claimId,
    }))).toBe('CLAIM_SUPERSESSION_SERIES_MISMATCH')
  })
})

describe('layer dependency order', () => {
  it('refuses a claim that rests on a weaker layer than its own', () => {
    const { db } = replayStore()
    expect(errorCode(() => registerClaim(db, claimInput({
      edges: [{ role: 'supports', targetEvidenceId: 'ev-mod-1' }],
    })))).toBe('CLAIM_LAYER_ORDER_VIOLATION')
    expect(errorCode(() => registerClaim(db, claimInput({
      edges: [{ role: 'supports', targetEvidenceId: 'ev-hyp-1' }],
    })))).toBe('CLAIM_LAYER_ORDER_VIOLATION')
    expect(errorCode(() => registerClaim(db, claimInput({
      layer: 'modelled',
      edges: [{ role: 'supports', targetEvidenceId: 'ev-hyp-1' }],
    })))).toBe('CLAIM_LAYER_ORDER_VIOLATION')
    expect(db.prepare('SELECT COUNT(*) FROM claim').pluck().get()).toBe(0)
  })

  it('permits a claim to rest on its own layer or a stronger one', () => {
    const { db } = replayStore()
    expect(registerClaim(db, claimInput({
      edges: [{ role: 'supports', targetEvidenceId: 'ev-obs-1' }],
    })).applied).toBe(true)
    expect(registerClaim(db, claimInput({
      layer: 'hypothesis',
      methodId: 'hyp.composer',
      edges: [
        { role: 'supports', targetEvidenceId: 'ev-det-4' },
        { role: 'contextualizes', targetEvidenceId: 'ev-mod-1' },
        { role: 'contradicts', targetEvidenceId: 'ev-hyp-1' },
      ],
    })).applied).toBe(true)
  })

  it('refuses a deterministic claim deriving from a modelled or hypothesis claim', () => {
    const { db } = replayStore()
    const hypothesis = registerClaim(db, claimInput({
      layer: 'hypothesis',
      methodId: 'hyp.composer',
      edges: [{ role: 'supports', targetEvidenceId: 'ev-hyp-1' }],
    }))
    expect(errorCode(() => registerClaim(db, claimInput({
      methodId: 'det.derived',
      edges: [{ role: 'derives_from', targetClaimId: hypothesis.claimId }],
    })))).toBe('CLAIM_LAYER_ORDER_VIOLATION')
  })

  it('lets an abstention cite any layer but lets nothing else derive from one', () => {
    const { db } = replayStore()
    const abstention = registerClaim(db, claimInput({
      layer: 'abstention',
      statementCode: 'ABSTAIN_LOW_COVERAGE',
      methodId: 'abs.low_coverage',
      edges: [
        { role: 'supports', targetEvidenceId: 'ev-obs-1' },
        { role: 'contextualizes', targetEvidenceId: 'ev-hyp-1' },
      ],
    }))
    expect(abstention.applied).toBe(true)
    expect(errorCode(() => registerClaim(db, claimInput({
      layer: 'hypothesis',
      methodId: 'hyp.composer',
      edges: [{ role: 'derives_from', targetClaimId: abstention.claimId }],
    })))).toBe('CLAIM_LAYER_ORDER_VIOLATION')
  })
})

describe('the C1 scope surrogate is minted, never supplied', () => {
  it('mints a content-free surrogate that the alias cannot become', () => {
    const { db } = replayStore()
    const aliasShapedLikeASurrogate = `${CLAIM_SCOPE_ID_PREFIX}${'c3'.repeat(CLAIM_SCOPE_ID_ENTROPY_BYTES)}`
    const minted = registerClaimScope(db, { scopeAlias: aliasShapedLikeASurrogate, linkedAt })
    expect(minted.minted).toBe(true)
    expect(minted.scopeId).toMatch(/^scope-[0-9a-f]{64}$/)
    expect(minted.scopeId).not.toBe(aliasShapedLikeASurrogate)

    const claim = registerClaim(db, claimInput({ scopeId: minted.scopeId }))
    const record = readClaim(db, claim.claimId)
    expect(JSON.stringify(record)).not.toContain(aliasShapedLikeASurrogate)
    expect(claimIdMaterial({ ...BASE_IDENTITY, scopeId: minted.scopeId }))
      .not.toContain(aliasShapedLikeASurrogate)
  })

  it('returns the same surrogate for the same alias so replay reproduces the same claim IDs', () => {
    const { db } = replayStore()
    const first = registerClaimScope(db, { scopeAlias: 'repo-c1', linkedAt })
    const again = registerClaimScope(db, { scopeAlias: 'repo-c1', linkedAt: laterCreatedAt })
    expect(again).toEqual({ scopeId: first.scopeId, linkedAt, minted: false })
    expect(registerClaim(db, claimInput({ scopeId: first.scopeId })).claimId)
      .toBe(registerClaim(db, claimInput({ scopeId: again.scopeId })).claimId)
  })

  it('is store-local, so the same alias is not a cross-installation linkage key', () => {
    const one = replayStore()
    const other = replayStore()
    const here = registerClaimScope(one.db, { scopeAlias: 'repo-shared', linkedAt })
    const there = registerClaimScope(other.db, { scopeAlias: 'repo-shared', linkedAt })
    expect(here.scopeId).not.toBe(there.scopeId)
  })

  it('does not re-establish an erased alias link: a new registration mints a new series', () => {
    const { db } = replayStore()
    const claim = registerClaim(db, claimInput())
    const before = claimStabilityKeyToken(claimStabilityKey(readClaim(db, claim.claimId)!))

    expect(clearClaimScopeAlias(db, ALPHA_SCOPE)).toBe(1)
    const reRegistered = registerClaimScope(db, { scopeAlias: 'repo-a7', linkedAt })
    expect(reRegistered.minted).toBe(true)
    expect(reRegistered.scopeId).not.toBe(ALPHA_SCOPE)

    // The C1 series that already existed is untouched by the erasure.
    expect(claimStabilityKeyToken(claimStabilityKey(readClaim(db, claim.claimId)!))).toBe(before)
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
})
