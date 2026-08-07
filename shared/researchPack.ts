import { z } from 'zod'
import { FORBIDDEN_CONSTRUCT_TERMS, FORBIDDEN_PERSON_SUBJECT_TERMS } from './metrics.js'

export const RESEARCH_PACK_SCHEMA_VERSION = 'DeveloperLensResearchPack.v1' as const
export const RESEARCH_PACK_PRODUCER_CODE = 'developer-lens.research-pack.v1' as const
export const REQUIRED_NO_PERSON_INTERPRETATION = 'NOT_PERSON_MEASURE' as const
export const RESEARCH_PACK_INTERPRETATION_CODES = [
  REQUIRED_NO_PERSON_INTERPRETATION,
  'NOT_PRODUCTIVITY',
  'NOT_EFFORT',
] as const

export const RELATION_NAMES = [
  'coverage',
  'repository_week',
  'pr_episode',
  'ci_attempt',
  'release_episode',
  'collection_probe',
  'system_event',
] as const
export type RelationName = (typeof RELATION_NAMES)[number]

export const RELATION_SCHEMA_IDS: Record<RelationName, string> = {
  coverage: 'developer-lens.coverage.v1',
  repository_week: 'developer-lens.repository-week.v1',
  pr_episode: 'developer-lens.pr-episode.v1',
  ci_attempt: 'developer-lens.ci-attempt.v1',
  release_episode: 'developer-lens.release-episode.v1',
  collection_probe: 'developer-lens.collection-probe.v1',
  system_event: 'developer-lens.system-event.v1',
}

const canonicalUtcPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?Z$/

function canonicalUtcMicros(value: string): bigint | undefined {
  const match = canonicalUtcPattern.exec(value)
  if (!match) return undefined
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const fractionMicros = Number((fractionText ?? '').padEnd(6, '0') || 0)
  const millis = Math.floor(fractionMicros / 1000)
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return undefined
  }
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, second, millis)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== millis
  ) {
    return undefined
  }
  return BigInt(date.getTime()) * 1000n + BigInt(fractionMicros % 1000)
}

export const CanonicalUtcSchema = z.string().regex(canonicalUtcPattern).superRefine((value, ctx) => {
  if (canonicalUtcMicros(value) === undefined) {
    ctx.addIssue({ code: 'custom', message: 'timestamp must be a valid RFC 3339 UTC instant ending in Z' })
  }
})

const isoWeekFloorTimePattern = /^\d{4}-\d{2}-\d{2}T00:00:00Z$/

function isIsoWeekFloor(value: string): boolean {
  const micros = canonicalUtcMicros(value)
  return (
    micros !== undefined &&
    isoWeekFloorTimePattern.test(value) &&
    new Date(Number(micros / 1000n)).getUTCDay() === 1
  )
}

function utcCalendarMonthsBefore(value: string, months: number): bigint | undefined {
  const match = canonicalUtcPattern.exec(value)
  if (!match) return undefined
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const fractionMicros = Number((fractionText ?? '').padEnd(6, '0') || 0)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, second, Math.floor(fractionMicros / 1000))
  date.setUTCMonth(date.getUTCMonth() - months)
  return BigInt(date.getTime()) * 1000n + BigInt(fractionMicros % 1000)
}

export const CodeSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,95}$/)
export const OpaqueIdSchema = z.string().regex(/^[a-z][a-z0-9_]{2,63}$/)
export const Sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
export const CommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/)
export const AvailabilityStateSchema = z.enum([
  'present',
  'absent',
  'unsupported',
  'intentionally_omitted',
])

export const TimeWindowSchema = z
  .strictObject({ start: CanonicalUtcSchema, end: CanonicalUtcSchema })
  .superRefine((value, ctx) => {
    const start = canonicalUtcMicros(value.start)
    const end = canonicalUtcMicros(value.end)
    if (start === undefined || end === undefined || start >= end) {
      ctx.addIssue({ code: 'custom', message: 'window start must be before end' })
    }
  })

export const AvailableWindowSchema = z
  .strictObject({
    state: AvailabilityStateSchema,
    window: TimeWindowSchema.nullable(),
    reason_code: CodeSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.state === 'present' && (value.window === null || value.reason_code !== null)) {
      ctx.addIssue({ code: 'custom', message: 'present availability requires a window and no reason_code' })
    }
    if (value.state !== 'present' && (value.window !== null || value.reason_code === null)) {
      ctx.addIssue({ code: 'custom', message: 'non-present availability requires reason_code and no window' })
    }
  })

export const TemporalAvailabilitySchema = z.strictObject({
  event: AvailableWindowSchema,
  collection: AvailableWindowSchema,
  feature: AvailableWindowSchema,
})

export const ArtifactRefSchema = z.strictObject({
  sha256: Sha256Schema,
  size_bytes: z.number().int().min(0).max(10_000_000_000),
  media_type: z.enum(['application/json', 'application/x-parquet', 'text/markdown']),
})

export const RelationDescriptorSchema = z
  .strictObject({
    state: AvailabilityStateSchema,
    schema_id: CodeSchema.nullable(),
    row_count: z.number().int().min(0).max(100_000_000).nullable(),
    artifact: ArtifactRefSchema.nullable(),
    reason_code: CodeSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    const values = [value.schema_id, value.row_count, value.artifact]
    if (value.state === 'present') {
      if (values.some((item) => item === null) || value.reason_code !== null) {
        ctx.addIssue({ code: 'custom', message: 'present relation requires schema_id, row_count, artifact, and no reason_code' })
      }
      if (value.artifact !== null && value.artifact.media_type !== 'application/x-parquet') {
        ctx.addIssue({ code: 'custom', path: ['artifact', 'media_type'], message: 'present relation artifact must use Parquet' })
      }
    } else if (values.some((item) => item !== null) || value.reason_code === null) {
      ctx.addIssue({ code: 'custom', message: 'non-present relation requires reason_code and no schema, count, or artifact' })
    }
  })

export const ResearchRelationsSchema = z.strictObject({
  coverage: RelationDescriptorSchema,
  repository_week: RelationDescriptorSchema,
  pr_episode: RelationDescriptorSchema,
  ci_attempt: RelationDescriptorSchema,
  release_episode: RelationDescriptorSchema,
  collection_probe: RelationDescriptorSchema,
  system_event: RelationDescriptorSchema,
})

function caseFoldPattern(value: string): string {
  return [...value].map((character) => `[${character.toLowerCase()}${character.toUpperCase()}]`).join('')
}

function caseFoldTokenPattern(value: string, prefix = false, pluralSuffix = false): string {
  const core = value.split('_').map(caseFoldPattern).join('[._-]+')
  return `(?:^|[._-])${core}${pluralSuffix ? '[sS]?' : ''}${prefix ? '[A-Za-z0-9]*' : ''}(?:$|[._-])`
}

function caseFoldStemPattern(value: string): string {
  const parts = value.split('_').map(caseFoldPattern)
  const core = parts.length === 1 ? parts[0] : `(?:${parts.join('')}|${parts.join('[._-]+')})`
  // `authorization` is a safe system-state word, not an author/person feature.
  const safeAuthorSuffix = value === 'author' ? '(?![iI][zZ][aA][tT][iI][oO][nN])' : ''
  return `(?:^|[._-])${core}${safeAuthorSuffix}[A-Za-z0-9]*`
}

const additionalForbiddenFeatureTerms = [
  'effort',
  'attendance',
  'hours_worked',
  'availability',
  'diligence',
  'quality',
  'worth',
  'personality',
  'sentiment',
  'burnout',
  'surveillance',
  'bus_factor',
  'individual_output',
] as const

const forbiddenFeatureTokenPattern = [
  ...FORBIDDEN_PERSON_SUBJECT_TERMS.flatMap((term) => [caseFoldTokenPattern(term, false, true), caseFoldStemPattern(term)]),
  ...FORBIDDEN_CONSTRUCT_TERMS.map((term) => caseFoldTokenPattern(term)),
  caseFoldTokenPattern('productiv', true),
  ...additionalForbiddenFeatureTerms.map((term) => caseFoldTokenPattern(term)),
].join('|')
const featureIdPattern = new RegExp(
  `^(?!.*(?:${forbiddenFeatureTokenPattern}))[A-Za-z][A-Za-z0-9_.-]{0,95}$`,
)
const forbiddenFeaturePattern = new RegExp(forbiddenFeatureTokenPattern)
const FeatureCodeSchema = z.string().regex(featureIdPattern)

export const FeatureDefinitionSchema = z
  .strictObject({
    feature_id: FeatureCodeSchema,
    relation: z.enum(RELATION_NAMES),
    value_kind: z.enum(['count', 'duration_hours', 'ratio', 'category', 'boolean']),
    unit_code: FeatureCodeSchema,
    evidence_layer: z.enum(['observed', 'deterministic']),
    prohibited_interpretation_codes: z.array(z.enum(RESEARCH_PACK_INTERPRETATION_CODES)).min(1).max(12),
  })
  .superRefine((value, ctx) => {
    // Feature identifiers are system features, never person/productivity measures.
    if (forbiddenFeaturePattern.test(value.feature_id)) {
      ctx.addIssue({ code: 'custom', path: ['feature_id'], message: 'person-scoring and productivity features are prohibited' })
    }
    if (!value.prohibited_interpretation_codes.includes(REQUIRED_NO_PERSON_INTERPRETATION)) {
      ctx.addIssue({
        code: 'custom',
        path: ['prohibited_interpretation_codes'],
        message: `${REQUIRED_NO_PERSON_INTERPRETATION} is required`,
      })
    }
  })

export const ResearchPackProvenanceSchema = z.strictObject({
  product_commit: CommitShaSchema,
  contract_sha256: Sha256Schema,
  producer_code: z.literal(RESEARCH_PACK_PRODUCER_CODE),
  fixture_revision: CodeSchema.nullable(),
})

export const ResearchPackSchema = z
  .strictObject({
    schema_version: z.literal(RESEARCH_PACK_SCHEMA_VERSION),
    pack_id: OpaqueIdSchema,
    generated_at: CanonicalUtcSchema,
    classification: z.enum(['C0', 'C1']),
    provenance: ResearchPackProvenanceSchema,
    temporal_availability: TemporalAvailabilitySchema,
    relations: ResearchRelationsSchema,
    feature_registry: z.array(FeatureDefinitionSchema).max(128),
  })
  .superRefine((value, ctx) => {
    if (value.classification === 'C1' && !isIsoWeekFloor(value.generated_at)) {
      ctx.addIssue({
        code: 'custom',
        path: ['generated_at'],
        message: 'C1 generated_at must be the UTC Monday start of an ISO week',
      })
    }
    if (value.classification === 'C1') {
      const cutoff = utcCalendarMonthsBefore(value.generated_at, 36)
      for (const availabilityName of ['event', 'collection', 'feature'] as const) {
        const availability = value.temporal_availability[availabilityName]
        if (availability.state !== 'present' || availability.window === null) continue
        for (const boundary of ['start', 'end'] as const) {
          if (!isIsoWeekFloor(availability.window[boundary])) {
            ctx.addIssue({
              code: 'custom',
              path: ['temporal_availability', availabilityName, 'window', boundary],
              message: `C1 ${availabilityName} window ${boundary} must be the UTC Monday start of an ISO week`,
            })
          }
        }
        if (cutoff !== undefined && canonicalUtcMicros(availability.window.start)! < cutoff) {
          ctx.addIssue({
            code: 'custom',
            path: ['temporal_availability', availabilityName, 'window', 'start'],
            message: 'C1 availability windows may not begin more than 36 UTC calendar months before generated_at',
          })
        }
      }
    }
    const hasNonemptyAnalyticalRelation = RELATION_NAMES.some(
      (relationName) => relationName !== 'coverage' && value.relations[relationName].state === 'present' && value.relations[relationName].row_count! > 0,
    )
    if (hasNonemptyAnalyticalRelation) {
      const coverage = value.relations.coverage
      if (coverage.state !== 'present' || coverage.row_count === null || coverage.row_count <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['relations', 'coverage'],
          message: 'nonempty analytical relations require a nonempty present coverage relation',
        })
      }
    }
    const featureIds = value.feature_registry.map((feature) => feature.feature_id)
    if (new Set(featureIds).size !== featureIds.length) {
      ctx.addIssue({ code: 'custom', path: ['feature_registry'], message: 'feature_registry contains duplicate feature_id values' })
    }
    const presentDigests: string[] = []
    for (const relationName of RELATION_NAMES) {
      const descriptor = value.relations[relationName]
      if (descriptor.state !== 'present') continue
      if (descriptor.schema_id !== RELATION_SCHEMA_IDS[relationName]) {
        ctx.addIssue({ code: 'custom', path: ['relations', relationName, 'schema_id'], message: `${relationName} has the wrong schema_id` })
      }
      if (descriptor.artifact !== null) presentDigests.push(descriptor.artifact.sha256)
    }
    if (new Set(presentDigests).size !== presentDigests.length) {
      ctx.addIssue({ code: 'custom', path: ['relations'], message: 'present relations must not share one artifact digest' })
    }
  })

export type ResearchPack = z.infer<typeof ResearchPackSchema>
