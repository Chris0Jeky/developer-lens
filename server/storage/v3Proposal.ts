import { z } from 'zod'

/**
 * B1a is deliberately a proposal-only module.  Nothing in the runtime storage, claim, or
 * capability graph imports this file; B1b owns the eventual versioned switch.
 */
export const V3_PROPOSAL_STATUS = 'proposal-only' as const
export const STORAGE_V3_PROPOSAL_VERSION = 'storage-v3' as const
export const CLAIM_MATERIAL_V3_PROPOSAL_VERSION = 'claim-id.v3' as const
export const LINEAGE_V3_PROPOSAL_VERSION = 'lineage.v3' as const

/** Closed retained-C1 key registry. Generation strategy is explicit below. */
export const C1_KEY_PREFIXES = {
  scope: 'scope-',
  claim: 'cl_',
  job: 'job-',
  snapshot: 'snap-',
  checkpoint: 'ckpt-',
  coverage: 'cov-',
  evidence: 'ev-',
  artifact: 'art-',
  deletion: 'del-',
} as const

export type C1KeyKind = keyof typeof C1_KEY_PREFIXES

export const C1_KEY_GENERATION = {
  scope: 'fresh-random',
  claim: 'versioned-claim-material',
  job: 'fresh-random',
  snapshot: 'fresh-random',
  checkpoint: 'fresh-random',
  coverage: 'fresh-random',
  evidence: 'fresh-random',
  artifact: 'fresh-random',
  deletion: 'fresh-random',
} as const satisfies Readonly<Record<C1KeyKind, 'fresh-random' | 'versioned-claim-material'>>

const C1_HEX = '[0-9a-f]{64}'
const c1KeySchema = (prefix: string) => z.string().regex(new RegExp(`^${prefix}${C1_HEX}$`))

export const ScopeIdV3Schema = c1KeySchema(C1_KEY_PREFIXES.scope)
export const ClaimIdV3Schema = c1KeySchema(C1_KEY_PREFIXES.claim)
export const JobIdV3Schema = c1KeySchema(C1_KEY_PREFIXES.job)
export const SnapshotIdV3Schema = c1KeySchema(C1_KEY_PREFIXES.snapshot)
export const CheckpointIdV3Schema = c1KeySchema(C1_KEY_PREFIXES.checkpoint)
export const CoverageIdV3Schema = c1KeySchema(C1_KEY_PREFIXES.coverage)
export const EvidenceIdV3Schema = c1KeySchema(C1_KEY_PREFIXES.evidence)
export const ArtifactIdV3Schema = c1KeySchema(C1_KEY_PREFIXES.artifact)
export const DeletionOperationIdV3Schema = c1KeySchema(C1_KEY_PREFIXES.deletion)

// Short aliases keep callers readable while retaining the explicit v3 suffix above.
export const C1KeyKindSchema = z.enum([
  'scope',
  'claim',
  'job',
  'snapshot',
  'checkpoint',
  'coverage',
  'evidence',
  'artifact',
  'deletion',
] as const)

export const C1KeySchema = z.union([
  ScopeIdV3Schema,
  ClaimIdV3Schema,
  JobIdV3Schema,
  SnapshotIdV3Schema,
  CheckpointIdV3Schema,
  CoverageIdV3Schema,
  EvidenceIdV3Schema,
  ArtifactIdV3Schema,
  DeletionOperationIdV3Schema,
])
export type C1Key = z.infer<typeof C1KeySchema>

export const C1_KEY_SCHEMAS: Readonly<Record<C1KeyKind, z.ZodString>> = {
  scope: ScopeIdV3Schema,
  claim: ClaimIdV3Schema,
  job: JobIdV3Schema,
  snapshot: SnapshotIdV3Schema,
  checkpoint: CheckpointIdV3Schema,
  coverage: CoverageIdV3Schema,
  evidence: EvidenceIdV3Schema,
  artifact: ArtifactIdV3Schema,
  deletion: DeletionOperationIdV3Schema,
}

export function parseC1Key(kind: C1KeyKind, value: unknown): C1Key {
  return C1KeySchema.parse(C1_KEY_SCHEMAS[kind].parse(value))
}

export const CLAIM_MATERIAL_V3_FIELDS = [
  'layer',
  'statement_code',
  'method_id',
  'method_version',
  'window_start',
  'window_end',
  'scope_id',
  'schema_version',
  'basis_edges',
] as const

export const CLAIM_MATERIAL_V3_PROPOSAL = {
  status: V3_PROPOSAL_STATUS,
  version: CLAIM_MATERIAL_V3_PROPOSAL_VERSION,
  fields: CLAIM_MATERIAL_V3_FIELDS,
  idPrefix: C1_KEY_PREFIXES.claim,
  remintOnMaterialRewrite: true,
} as const

/** Proposal lineage extends the shipped six kinds with the three LIFE-02 lifecycle events. */
export const LINEAGE_V3_EVENT_KINDS = [
  'correction',
  'tombstone_cascade',
  'export_included',
  'reconsent',
  'index_built',
  'index_deleted',
  'scope_alias_expired',
  'scope_series_restarted',
  'legacy_deletion_operation',
] as const
export const LineageV3EventKindSchema = z.enum(LINEAGE_V3_EVENT_KINDS)
export type LineageV3EventKind = z.infer<typeof LineageV3EventKindSchema>

export const LINEAGE_V3_SUBJECT_KINDS = [
  'scope',
  'claim',
  'job',
  'snapshot',
  'checkpoint',
  'coverage',
  'evidence',
  'artifact',
  'deletion',
] as const
export const LineageV3SubjectKindSchema = z.enum(LINEAGE_V3_SUBJECT_KINDS)
export type LineageV3SubjectKind = z.infer<typeof LineageV3SubjectKindSchema>

export const LINEAGE_V3_EVENT_SUBJECT_KINDS = {
  correction: LINEAGE_V3_SUBJECT_KINDS,
  tombstone_cascade: LINEAGE_V3_SUBJECT_KINDS,
  export_included: LINEAGE_V3_SUBJECT_KINDS,
  reconsent: LINEAGE_V3_SUBJECT_KINDS,
  index_built: LINEAGE_V3_SUBJECT_KINDS,
  index_deleted: LINEAGE_V3_SUBJECT_KINDS,
  scope_alias_expired: ['scope'],
  scope_series_restarted: ['scope'],
  legacy_deletion_operation: ['deletion'],
} as const satisfies Readonly<Record<LineageV3EventKind, readonly LineageV3SubjectKind[]>>

const ISO_WEEK = /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/

export const IsoWeekV3Schema = z.string().regex(ISO_WEEK).refine((value) => {
  const match = ISO_WEEK.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const week = Number(match[2])
  const januaryFirst = new Date(Date.UTC(year, 0, 1)).getUTCDay()
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const weeksInYear = januaryFirst === 4 || (januaryFirst === 3 && leapYear) ? 53 : 52
  return week <= weeksInYear
}, 'Week must exist in the ISO week-year')

export const LineageV3EventSchema = z.object({
  schemaVersion: z.literal(LINEAGE_V3_PROPOSAL_VERSION),
  subjectKind: LineageV3SubjectKindSchema,
  subjectId: C1KeySchema,
  eventKind: LineageV3EventKindSchema,
  operationId: DeletionOperationIdV3Schema,
  capabilityId: z.literal('github.core'),
  eventWeek: IsoWeekV3Schema,
  causedBy: C1KeySchema.nullable().optional(),
}).strict().superRefine((value, context) => {
  const expectedPrefix = C1_KEY_PREFIXES[value.subjectKind]
  if (!value.subjectId.startsWith(expectedPrefix)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['subjectId'], message: 'Subject kind/key prefix mismatch' })
  }
  const allowedSubjectKinds: readonly LineageV3SubjectKind[] =
    LINEAGE_V3_EVENT_SUBJECT_KINDS[value.eventKind]
  if (!allowedSubjectKinds.includes(value.subjectKind)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['eventKind'], message: 'Event kind/subject kind mismatch' })
  }
  if (value.eventKind === 'legacy_deletion_operation' && value.operationId !== value.subjectId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['operationId'], message: 'Legacy deletion operation identity mismatch' })
  }
  if (value.eventKind === 'scope_series_restarted' && value.causedBy != null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['causedBy'], message: 'Restarted scope must not link an old series' })
  }
})
export type LineageV3Event = z.infer<typeof LineageV3EventSchema>

export const LEGACY_DELETION_OPERATION_COMPATIBILITY = {
  sourceEventKind: 'tombstone_cascade',
  sourceSubjectPrefix: 'scope_tombstone_',
  sourceSubjectHexLength: 64,
  sourceCausedBy: 'cap_github_core',
  targetEventKind: 'legacy_deletion_operation',
  targetSubjectKind: 'deletion',
  targetSubjectPrefix: C1_KEY_PREFIXES.deletion,
  targetOperationId: 'same-as-target-subject',
  occurredAtDisposition: 'floor-to-iso-week',
  capabilityId: 'github.core',
  conflictDisposition: 'abort-target',
} as const

export const LINEAGE_V3_PROPOSAL = {
  status: V3_PROPOSAL_STATUS,
  version: LINEAGE_V3_PROPOSAL_VERSION,
  eventKinds: LINEAGE_V3_EVENT_KINDS,
  subjectKinds: LINEAGE_V3_SUBJECT_KINDS,
  capabilityIds: ['github.core'] as const,
  eventGrain: 'iso-week',
  operationPrefix: C1_KEY_PREFIXES.deletion,
  legacyDeletionCompatibility: LEGACY_DELETION_OPERATION_COMPATIBILITY,
} as const

export const STORAGE_V3_BASE_TABLES = [
  'import_run',
  'repository_identity',
  'commit_observation',
  'pull_request_fact',
  'coverage_observation',
  'dated_event_observation',
] as const
export const STORAGE_V3_INCREMENTAL_TABLES = [
  'collection_job',
  'collection_checkpoint',
  'source_snapshot',
  'coverage_ledger',
] as const
export const STORAGE_V3_BRIDGE_TABLES = [
  'v2_store_provenance',
  'v2_coverage_record',
] as const
export const STORAGE_V3_CLAIM_TABLES = [
  'evidence',
  'claim_scope',
  'claim',
  'claim_evidence_edge',
  'limitation_instance',
  'lineage_event',
] as const
export const STORAGE_V3_TABLES = [
  ...STORAGE_V3_BASE_TABLES,
  ...STORAGE_V3_BRIDGE_TABLES,
  ...STORAGE_V3_INCREMENTAL_TABLES,
  ...STORAGE_V3_CLAIM_TABLES,
] as const
export type StorageV3Table = typeof STORAGE_V3_TABLES[number]
export const StorageV3TableSchema = z.enum(STORAGE_V3_TABLES)

export type StorageV3TableFamily = 'base' | 'bridge' | 'incremental' | 'claim'
export type StorageV3DispositionAction = 'preserve' | 'rewrite' | 'delete'

export interface StorageV3Disposition {
  readonly tableName: StorageV3Table
  readonly family: StorageV3TableFamily
  readonly action: StorageV3DispositionAction
  /** Existing facts retained unchanged in the shadow target. */
  readonly preserve: readonly string[]
  /** Existing facts rewritten into C1-only or scope-bound rows. */
  readonly rewrite: readonly string[]
  /** Existing facts intentionally omitted from the target. */
  readonly delete: readonly string[]
  /** Input states that abort target selection rather than being copied or silently discarded. */
  readonly refuse?: readonly string[]
}

const disposition = <T extends StorageV3Disposition>(value: T): T => value

export const STORAGE_V3_DISPOSITIONS = [
  disposition({ tableName: 'import_run', family: 'base', action: 'delete', preserve: [], rewrite: [], delete: ['all legacy rows lacking scope and import-time ownership'] }),
  disposition({ tableName: 'repository_identity', family: 'base', action: 'rewrite', preserve: ['is_private', 'is_archived', 'is_fork'], rewrite: ['provider identity -> scope- C1 anchor', 'analytical alias remains transient C2 link'], delete: ['provider_id', 'analytical_key after C2 expiry'] }),
  disposition({ tableName: 'commit_observation', family: 'base', action: 'rewrite', preserve: ['sha', 'source', 'aggregate counters', 'feature classification'], rewrite: ['repository_provider_id -> canonical scope_id'], delete: ['rows whose repository binding is unverifiable'] }),
  disposition({ tableName: 'pull_request_fact', family: 'base', action: 'rewrite', preserve: ['number', 'lifecycle state', 'aggregate counters'], rewrite: ['repository_provider_id -> canonical scope_id'], delete: ['rows whose repository binding is unverifiable'] }),
  disposition({ tableName: 'coverage_observation', family: 'base', action: 'delete', preserve: [], rewrite: [], delete: ['all legacy aggregate rows without complete member-scope ownership'] }),
  disposition({ tableName: 'dated_event_observation', family: 'base', action: 'rewrite', preserve: ['event_kind', 'occurred_at'], rewrite: ['repository_provider_id -> canonical scope_id'], delete: ['rows whose repository binding is unverifiable'] }),
  disposition({ tableName: 'v2_store_provenance', family: 'bridge', action: 'preserve', preserve: ['validated C0 synthetic-only provenance'], rewrite: [], delete: [], refuse: ['activation_card or unverifiable provenance'] }),
  disposition({ tableName: 'v2_coverage_record', family: 'bridge', action: 'preserve', preserve: ['rows covered by validated C0 synthetic-only provenance'], rewrite: [], delete: [], refuse: ['orphan rows or rows under activation_card/unverifiable provenance'] }),
  disposition({ tableName: 'collection_job', family: 'incremental', action: 'rewrite', preserve: ['capability_id', 'status', 'content-free payload hash'], rewrite: ['job- anchor and scope_id'], delete: ['caller job ID and exact operational timestamps at C2 expiry'] }),
  disposition({ tableName: 'collection_checkpoint', family: 'incremental', action: 'rewrite', preserve: ['query/source version', 'checkpoint coverage state'], rewrite: ['ckpt- anchor, scope_id, retention/deletion order, lineage coverage'], delete: ['cursor, exact watermark, and operational row at C2 expiry'] }),
  disposition({ tableName: 'source_snapshot', family: 'incremental', action: 'rewrite', preserve: ['snapshot hash', 'coverage range facts'], rewrite: ['snap- anchor bound to canonical scope/job'], delete: ['caller snapshot ID, exact provenance and times at C2 expiry'] }),
  disposition({ tableName: 'coverage_ledger', family: 'incremental', action: 'rewrite', preserve: ['status and content-free coverage facts'], rewrite: ['cov- anchor bound to canonical scope/job/snapshot'], delete: ['coverage_id alias, exact range, and job observation at C2 expiry'] }),
  disposition({ tableName: 'evidence', family: 'claim', action: 'rewrite', preserve: ['C1 evidence anchor and closed layer/schema'], rewrite: ['ev- anchor and C1 coverage reference'], delete: ['alias-bearing or exact operational references'] }),
  disposition({ tableName: 'claim_scope', family: 'claim', action: 'rewrite', preserve: ['scope- series identity'], rewrite: ['scope alias as expiring C2 link'], delete: ['scope_alias and linked_at on C2 expiry'] }),
  disposition({ tableName: 'claim', family: 'claim', action: 'rewrite', preserve: ['claim layer, statement and stability facts'], rewrite: ['cl_ ID under claim-id.v3 and canonical scope'], delete: ['old material-version rows that cannot be reminted'] }),
  disposition({ tableName: 'claim_evidence_edge', family: 'claim', action: 'rewrite', preserve: ['typed edge role'], rewrite: ['all affected target references and reminted claim IDs'], delete: ['dangling, cross-scope, or retired C2 target edges'] }),
  disposition({ tableName: 'limitation_instance', family: 'claim', action: 'rewrite', preserve: ['closed limitation code, dimension and copy key'], rewrite: ['claim_id after claim-material remint'], delete: ['instances attached to deleted claims'] }),
  disposition({ tableName: 'lineage_event', family: 'claim', action: 'rewrite', preserve: ['recognized C1 event time at ISO-week grain'], rewrite: ['subject_kind, C1 subject_id, operation_id and capability_id', 'slice-A scope_tombstone_<64hex> + cap_github_core -> legacy_deletion_operation on del-<same hex> with the same operation ID, github.core capability and ISO-week-floored time'], delete: ['alias-bearing subjects/causes and unclassified legacy rows'], refuse: ['conflicting slice-A compatibility event or recognized subject-class mismatch'] }),
] as const satisfies readonly StorageV3Disposition[]

export const STORAGE_V3_PROPOSAL = {
  status: V3_PROPOSAL_STATUS,
  version: STORAGE_V3_PROPOSAL_VERSION,
  tables: STORAGE_V3_TABLES,
  dispositions: STORAGE_V3_DISPOSITIONS,
  c1KeyPrefixes: C1_KEY_PREFIXES,
} as const

/** Fail closed if a future edit introduces a duplicate, unknown, or incomplete disposition. */
export function validateStorageV3Dispositions(
  values: readonly StorageV3Disposition[] = STORAGE_V3_DISPOSITIONS,
): void {
  const expected = new Set<string>(STORAGE_V3_TABLES)
  const seen = new Set<string>()
  for (const value of values) {
    if (!expected.has(value.tableName) || seen.has(value.tableName)) {
      throw new Error('STORAGE_V3_DISPOSITION_NOT_EXHAUSTIVE')
    }
    if (value.preserve.length + value.rewrite.length + value.delete.length === 0) {
      throw new Error('STORAGE_V3_DISPOSITION_METADATA_MISSING')
    }
    if (value[value.action].length === 0) {
      throw new Error('STORAGE_V3_DISPOSITION_METADATA_MISSING')
    }
    seen.add(value.tableName)
  }
  if (seen.size !== expected.size) throw new Error('STORAGE_V3_DISPOSITION_NOT_EXHAUSTIVE')
}

validateStorageV3Dispositions()
