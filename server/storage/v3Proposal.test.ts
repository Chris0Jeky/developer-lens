import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import * as ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import {
  C1_KEY_PREFIXES,
  C1_KEY_GENERATION,
  C1_KEY_SCHEMAS,
  ClaimIdV3Schema,
  LEGACY_DELETION_OPERATION_COMPATIBILITY,
  LineageOperationIdV3Schema,
  LineageV3EventSchema,
  LINEAGE_V3_DELETION_EVENT_KINDS,
  LINEAGE_V3_EVENT_SUBJECT_KINDS,
  LINEAGE_V3_EVENT_KINDS,
  STORAGE_V3_BASE_TABLES,
  STORAGE_V3_BRIDGE_TABLES,
  STORAGE_V3_CLAIM_TABLES,
  STORAGE_V3_DISPOSITIONS,
  type StorageV3Disposition,
  STORAGE_V3_INCREMENTAL_TABLES,
  STORAGE_V3_PROPOSAL,
  STORAGE_V3_TABLES,
  validateStorageV3Dispositions,
} from './v3Proposal.js'

const hex = 'a'.repeat(64)
const EXPECTED_PRESENT_TABLES = [
  'import_run', 'repository_identity', 'commit_observation', 'pull_request_fact',
  'coverage_observation', 'dated_event_observation', 'v2_store_provenance',
  'v2_coverage_record', 'collection_job',
  'collection_checkpoint', 'source_snapshot', 'coverage_ledger', 'evidence',
  'claim_scope', 'claim', 'claim_evidence_edge', 'limitation_instance', 'lineage_event',
] as const
const EXPECTED_DISPOSITION_SHAPE = {
  import_run: ['base', 'delete'],
  repository_identity: ['base', 'rewrite'],
  commit_observation: ['base', 'rewrite'],
  pull_request_fact: ['base', 'rewrite'],
  coverage_observation: ['base', 'delete'],
  dated_event_observation: ['base', 'rewrite'],
  v2_store_provenance: ['bridge', 'preserve'],
  v2_coverage_record: ['bridge', 'preserve'],
  collection_job: ['incremental', 'rewrite'],
  collection_checkpoint: ['incremental', 'rewrite'],
  source_snapshot: ['incremental', 'rewrite'],
  coverage_ledger: ['incremental', 'rewrite'],
  evidence: ['claim', 'rewrite'],
  claim_scope: ['claim', 'rewrite'],
  claim: ['claim', 'rewrite'],
  claim_evidence_edge: ['claim', 'rewrite'],
  limitation_instance: ['claim', 'rewrite'],
  lineage_event: ['claim', 'rewrite'],
} as const

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')

describe('storage-v3 B1a proposal', () => {
  it('keeps every retained key in the closed prefix + 64 lowercase hex registry', () => {
    for (const [kind, prefix] of Object.entries(C1_KEY_PREFIXES)) {
      const schema = C1_KEY_SCHEMAS[kind as keyof typeof C1_KEY_SCHEMAS]
      expect(schema.safeParse(`${prefix}${hex}`).success).toBe(true)
      expect(schema.safeParse(`${prefix}${hex.toUpperCase()}`).success).toBe(false)
      expect(schema.safeParse(`${prefix}${hex.slice(1)}`).success).toBe(false)
      expect(schema.safeParse(`${prefix}${hex}x`).success).toBe(false)
    }
    expect(ClaimIdV3Schema.safeParse(`scope-${hex}`).success).toBe(false)
    expect(C1_KEY_GENERATION).toEqual({
      scope: 'fresh-random',
      claim: 'versioned-claim-material',
      job: 'fresh-random',
      snapshot: 'fresh-random',
      checkpoint: 'fresh-random',
      coverage: 'fresh-random',
      evidence: 'fresh-random',
      artifact: 'fresh-random',
      operation: 'fresh-random',
      deletion: 'fresh-random',
    })
  })

  it('is inert, versioned, closed, and validates a typed lineage event', () => {
    expect(STORAGE_V3_PROPOSAL.status).toBe('proposal-only')
    expect(STORAGE_V3_PROPOSAL.version).toBe('storage-v3')
    expect(new Set(LINEAGE_V3_EVENT_KINDS).size).toBe(LINEAGE_V3_EVENT_KINDS.length)
    const event = LineageV3EventSchema.parse({
      schemaVersion: 'lineage.v3',
      subjectKind: 'scope',
      subjectId: `scope-${hex}`,
      eventKind: 'scope_alias_expired',
      operationId: `op-${hex}`,
      capabilityId: 'github.core',
      eventWeek: '2026-W32',
      causedBy: null,
    })
    expect(event.subjectId).toBe(`scope-${hex}`)
    expect(LineageV3EventSchema.safeParse({ ...event, subjectKind: 'job' }).success).toBe(false)
    expect(LineageV3EventSchema.safeParse({
      ...event,
      subjectKind: 'claim',
      subjectId: `cl_${hex}`,
    }).success).toBe(false)
    expect(LineageV3EventSchema.safeParse({
      ...event,
      subjectKind: 'evidence',
      subjectId: `ev-${hex}`,
      eventKind: 'correction',
    }).success).toBe(true)
    expect(LineageOperationIdV3Schema.safeParse(`op-${hex}`).success).toBe(true)
    expect(LineageOperationIdV3Schema.safeParse(`del-${hex}`).success).toBe(true)
    expect(LineageOperationIdV3Schema.safeParse(`scope-${hex}`).success).toBe(false)
    expect(LineageV3EventSchema.safeParse({ ...event, eventKind: 'tombstone_cascade', operationId: `del-${hex}` }).success).toBe(true)
    expect(LineageV3EventSchema.safeParse({ ...event, eventKind: 'tombstone_cascade', operationId: `op-${hex}` }).success).toBe(false)
    expect(LineageV3EventSchema.safeParse({ ...event, eventKind: 'index_deleted', operationId: `del-${hex}` }).success).toBe(true)
    expect(LineageV3EventSchema.safeParse({ ...event, eventKind: 'index_deleted', operationId: `op-${hex}` }).success).toBe(false)
    expect(LineageV3EventSchema.safeParse({ ...event, eventKind: 'correction', operationId: `del-${hex}` }).success).toBe(false)
    expect(LineageV3EventSchema.safeParse({
      ...event,
      subjectKind: 'deletion',
      subjectId: `del-${hex}`,
      eventKind: 'legacy_deletion_operation',
      operationId: `del-${hex}`,
    }).success).toBe(true)
    expect(LineageV3EventSchema.safeParse({
      ...event,
      subjectKind: 'deletion',
      subjectId: `del-${hex}`,
      operationId: `del-${'b'.repeat(64)}`,
      eventKind: 'legacy_deletion_operation',
    }).success).toBe(false)
    expect(LineageV3EventSchema.safeParse({
      ...event,
      eventKind: 'scope_series_restarted',
      causedBy: `scope-${'b'.repeat(64)}`,
    }).success).toBe(false)
    expect(LINEAGE_V3_EVENT_SUBJECT_KINDS.scope_alias_expired).toEqual(['scope'])
    expect(LINEAGE_V3_EVENT_SUBJECT_KINDS.c2_retention_expired).toEqual([
      'job', 'snapshot', 'checkpoint', 'coverage',
    ])
    expect(LINEAGE_V3_EVENT_SUBJECT_KINDS.legacy_deletion_operation).toEqual(['deletion'])
    expect(LineageV3EventSchema.safeParse({
      ...event,
      subjectKind: 'coverage',
      subjectId: `cov-${hex}`,
      eventKind: 'c2_retention_expired',
    }).success).toBe(true)
    expect(LineageV3EventSchema.safeParse({
      ...event,
      subjectKind: 'coverage',
      subjectId: `cov-${hex}`,
      eventKind: 'c2_retention_expired',
      operationId: `del-${hex}`,
    }).success).toBe(false)
    expect(LineageV3EventSchema.safeParse({
      ...event,
      eventKind: 'c2_retention_expired',
    }).success).toBe(false)
    expect(LINEAGE_V3_DELETION_EVENT_KINDS).toEqual([
      'tombstone_cascade', 'index_deleted', 'legacy_deletion_operation',
    ])
    expect(LEGACY_DELETION_OPERATION_COMPATIBILITY).toEqual({
      sourceEventKind: 'tombstone_cascade',
      sourceSubjectPrefix: 'scope_tombstone_',
      sourceSubjectHexLength: 64,
      sourceCausedBy: 'cap_github_core',
      targetEventKind: 'legacy_deletion_operation',
      targetSubjectKind: 'deletion',
      targetSubjectPrefix: 'del-',
      targetOperationId: 'same-as-target-subject',
      occurredAtDisposition: 'floor-to-iso-week',
      capabilityId: 'github.core',
      conflictDisposition: 'abort-target',
    })
    expect(LineageV3EventSchema.safeParse({ ...event, eventWeek: '2026-32' }).success).toBe(false)
    expect(LineageV3EventSchema.safeParse({ ...event, eventWeek: '2021-W53' }).success).toBe(false)
    expect(LineageV3EventSchema.safeParse({ ...event, eventWeek: '2020-W53' }).success).toBe(true)
  })

  it('covers the independent literal current 18-table set exactly once', () => {
    expect(STORAGE_V3_TABLES).toEqual(EXPECTED_PRESENT_TABLES)
    expect([
      ...STORAGE_V3_BASE_TABLES,
      ...STORAGE_V3_BRIDGE_TABLES,
      ...STORAGE_V3_INCREMENTAL_TABLES,
      ...STORAGE_V3_CLAIM_TABLES,
    ])
      .toEqual(EXPECTED_PRESENT_TABLES)
    expect(STORAGE_V3_DISPOSITIONS.map((entry) => entry.tableName).sort())
      .toEqual([...EXPECTED_PRESENT_TABLES].sort())
    expect(new Set(STORAGE_V3_DISPOSITIONS.map((entry) => entry.tableName)).size).toBe(18)
    for (const entry of STORAGE_V3_DISPOSITIONS) {
      expect(entry.preserve.length + entry.rewrite.length + entry.delete.length).toBeGreaterThan(0)
      expect(['preserve', 'rewrite', 'delete']).toContain(entry.action)
      expect([entry.family, entry.action]).toEqual(EXPECTED_DISPOSITION_SHAPE[entry.tableName])
    }
    expect(() => validateStorageV3Dispositions()).not.toThrow()
    expect(() => validateStorageV3Dispositions([
      ...STORAGE_V3_DISPOSITIONS.slice(0, -1),
      STORAGE_V3_DISPOSITIONS[0],
    ])).toThrow('STORAGE_V3_DISPOSITION_NOT_EXHAUSTIVE')
    const lineage = STORAGE_V3_DISPOSITIONS.find(({ tableName }) => tableName === 'lineage_event')
    const identity = STORAGE_V3_DISPOSITIONS.find(({ tableName }) => tableName === 'repository_identity')
    expect(lineage?.rewrite).toContain(
      'slice-A scope_tombstone_<64hex> + cap_github_core -> legacy_deletion_operation on del-<same hex> with the same operation ID, github.core capability and ISO-week-floored time',
    )
    expect(lineage && 'refuse' in lineage ? lineage.refuse : undefined).toContain(
      'conflicting slice-A compatibility event or recognized subject-class mismatch',
    )
    expect(identity?.rewrite).toEqual(expect.arrayContaining([
      expect.stringMatching(/ephemeral raw provider ID independently recomputes provider_id .* analytical_key .* byte equality/i),
      expect.stringMatching(/scope_alias continuity uses an exact match against the recomputed provider_id only, never analytical_key/i),
    ]))
    expect(identity?.delete).toEqual(expect.arrayContaining([
      expect.stringMatching(/provider_id and analytical_key at C2 expiry/i),
      expect.stringMatching(/raw provider ID and installation key are never retained in target, proof, error, or log/i),
    ]))
  })

  it('keeps C2 observations out of every preserve disposition and aborts unsafe claim graphs', () => {
    const c2Terms = /(?:\bsha\b|pull-request number|provider(?:_id| provenance| identity)|occurred_at|created_at|payload hash|snapshot hash|exact range|\brange\b|caller (?:job|snapshot) ID|provenance)/i
    for (const entry of STORAGE_V3_DISPOSITIONS) {
      expect(entry.preserve.some((field) => c2Terms.test(field) && !/C0 synthetic-only provenance/i.test(field)), `${entry.tableName} preserve`).toBe(false)
    }
    const byTable = Object.fromEntries(STORAGE_V3_DISPOSITIONS.map((entry) => [entry.tableName, entry])) as Record<string, StorageV3Disposition>
    expect(byTable.commit_observation.preserve).toEqual(['aggregate counters', 'feature classification'])
    expect(byTable.pull_request_fact.preserve).toEqual(['lifecycle state', 'aggregate counters'])
    expect(byTable.dated_event_observation.preserve).toEqual(['event_kind'])
    expect(byTable.commit_observation.delete).toEqual(expect.arrayContaining([
      expect.stringMatching(/complete nullable C2 observation field group.*never the C1 anchor\/counters/i),
    ]))
    expect(byTable.pull_request_fact.delete).toEqual(expect.arrayContaining([
      expect.stringMatching(/complete nullable C2 observation field group.*never the C1 anchor\/state\/counters/i),
    ]))
    expect(byTable.dated_event_observation.delete).toEqual(expect.arrayContaining([
      expect.stringMatching(/complete nullable C2 observation field group.*never the C1 anchor\/event kind/i),
    ]))
    expect(byTable.collection_checkpoint.delete).toEqual(expect.arrayContaining([
      expect.stringMatching(/complete nullable C2 field group.*never the C1 checkpoint anchor/i),
    ]))
    expect(byTable.collection_job.preserve).toEqual(['capability_id', 'status'])
    expect(byTable.source_snapshot.preserve).toEqual(['validated C1 snapshot anchor and closed status'])
    expect(byTable.claim.preserve).toEqual(expect.arrayContaining([
      expect.stringMatching(/analytical window.*C1/i),
    ]))
    expect(byTable.claim.rewrite).toEqual(expect.arrayContaining([
      expect.stringMatching(/created_at.*C2 operational provenance.*inclusive 13-month boundary.*C1 claim row remains/i),
    ]))
    expect(byTable.claim.delete).toEqual(expect.arrayContaining([
      expect.stringMatching(/exact created_at value at C2 expiry, never the C1 claim row/i),
    ]))
    expect(byTable.claim.refuse).toEqual(expect.arrayContaining([
      expect.stringMatching(/unremintable/i),
      expect.stringMatching(/mixed/i),
      expect.stringMatching(/colliding/i),
    ]))
    expect(byTable.claim_evidence_edge.refuse).toEqual(expect.arrayContaining([
      expect.stringMatching(/dangling/i),
      expect.stringMatching(/cross-scope/i),
      expect.stringMatching(/unanchored/i),
    ]))
    expect(byTable.evidence.refuse).toEqual(expect.arrayContaining([
      expect.stringMatching(/dangling/i),
      expect.stringMatching(/cross-scope/i),
      expect.stringMatching(/unanchored/i),
    ]))
    for (const table of ['claim', 'claim_evidence_edge', 'evidence'] as const) {
      expect(byTable[table].delete.some((entry) => /dangling|cross-scope|unanchored|unremintable|mixed-version|colliding/i.test(entry))).toBe(false)
    }
  })

  it('does not alter live v2 versions, kinds, DDL, or inventory across proposal import', async () => {
    const snapshotLive = async () => {
      const liveClaims = await import('../../shared/claims.js')
      const liveCapabilities = await import('../../shared/capabilities.js')
      const liveCapabilityContract = await import('../api/v2/contract.js')
      const liveBridgeStore = await import('../api/v2/store.js')
      const liveClaimStorage = await import('./claims.js')
      const liveSchema = await import('./schema.js')
      const liveIncremental = await import('./incremental.js')
      return {
        claimVersions: [...liveClaims.CLAIM_ID_MATERIAL_VERSIONS],
        lineageKinds: [...liveClaims.LINEAGE_EVENT_KINDS],
        claimGraphTables: [...liveClaimStorage.CLAIM_GRAPH_TABLES],
        claimGraphSql: liveClaimStorage.CLAIM_GRAPH_STORAGE_SQL,
        applicationId: liveSchema.SQLITE_APPLICATION_ID,
        userVersion: liveSchema.SQLITE_USER_VERSION,
        storageVersion: liveSchema.STORAGE_SCHEMA_VERSION,
        storageSql: liveSchema.STORAGE_SCHEMA_SQL,
        incrementalVersion: liveIncremental.INCREMENTAL_GITHUB_CORE_STORAGE_VERSION,
        incrementalTables: [...liveIncremental.INCREMENTAL_GITHUB_CORE_TABLES],
        incrementalSchemaFingerprint:
          liveIncremental.INCREMENTAL_GITHUB_CORE_STORAGE_SCHEMA_FINGERPRINT,
        capabilityIds: [...liveCapabilities.CAPABILITY_IDS],
        capabilityRegistry: liveCapabilities.CAPABILITY_REGISTRY,
        capabilityViews: liveCapabilityContract.buildCapabilityViews(),
        bridgeTables: [...liveBridgeStore.V2_BRIDGE_STORE_TABLES],
        bridgeSql: liveBridgeStore.V2_BRIDGE_STORE_SQL,
      }
    }
    vi.resetModules()
    const before = await snapshotLive()
    await import('./v3Proposal.js')
    const warm = await snapshotLive()
    expect(warm).toEqual(before)
    vi.resetModules()
    await import('./v3Proposal.js')
    const fresh = await snapshotLive()
    expect(fresh).toEqual(before)
    expect(before.claimVersions).toEqual(['claim-id.v2'])
    expect(before.lineageKinds).toEqual([
      'correction', 'tombstone_cascade', 'export_included', 'reconsent', 'index_built', 'index_deleted',
    ])
    expect(before.claimGraphTables).toEqual([
      'evidence', 'claim_scope', 'claim', 'claim_evidence_edge', 'limitation_instance', 'lineage_event',
    ])
    expect(before.incrementalTables).toEqual([
      'collection_job', 'collection_checkpoint', 'source_snapshot', 'coverage_ledger',
    ])
    expect(before.bridgeTables).toEqual(['v2_store_provenance', 'v2_coverage_record'])
    expect(before.applicationId).toBe(0x444c5632)
    expect(before.userVersion).toBe(2)
    expect(before.storageVersion).toBe('2.0.0')
    expect(before.incrementalVersion).toBe('2.2.0')
    expect(sha256(before.storageSql)).toBe('0c905b7fa6d46a8c43a1ed50ee9d0d3837ca33d8464fba52671ec70670e7917a')
    expect(sha256(before.claimGraphSql)).toBe('2cc02122e85d84227ff47f01f5fee999c431f1936a73f8850cc66632c8d077b9')
    expect(before.incrementalSchemaFingerprint).toBe('444bfb0e59ce00933d874b02176dcef448f5e050c81a7c0e5928b0e267055bf1')
    expect(sha256(before.bridgeSql)).toBe('0df6fe9ec33f4f5ffd32a7e0d03ae36a7692e52de4e78f6afeeaf8e377bf1340')
    expect(sha256(JSON.stringify(before.capabilityIds))).toBe('c53eabd0bad1ad693c376883e447d46e0879bfac2597b0cfea67390ceeed559d')
    expect(sha256(JSON.stringify(before.capabilityRegistry))).toBe('1fc440f74d96b613ba2f50f92817df27471d621bef195872db803169efa980bd')
    expect(sha256(JSON.stringify(before.capabilityViews))).toBe('ae1e20e89f0974e0fe4ba509535d7ebd8c456c8d32f58c4d17ad4e74b4fc4887')
    expect(before.capabilityRegistry.every(({ authorization }) => authorization === 'never_authorized'))
      .toBe(true)
    expect(before.capabilityViews.every(({ authorization, lifecycleState }) =>
      authorization === 'never_authorized' && lifecycleState === 'never_authorized')).toBe(true)
  })

  it('leaves a freshly installed v2 SQLite schema byte-for-byte equivalent under either import order', async () => {
    const snapshotInstalledSchema = async () => {
      const { openStorageDatabase } = await import('./database.js')
      const { installIncrementalGithubCoreStorage } = await import('./incremental.js')
      const { installClaimGraphStorage } = await import('./claims.js')
      const { installV2BridgeStore } = await import('../api/v2/store.js')
      const db = openStorageDatabase(':memory:')
      try {
        installIncrementalGithubCoreStorage(db)
        installClaimGraphStorage(db)
        installV2BridgeStore(db)
        return {
          applicationId: Number(db.prepare('PRAGMA application_id').pluck().get()),
          userVersion: Number(db.prepare('PRAGMA user_version').pluck().get()),
          schema: db.prepare(
            "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' ORDER BY type, name",
          ).all(),
        }
      } finally {
        db.close()
      }
    }
    vi.resetModules()
    const before = await snapshotInstalledSchema()
    await import('./v3Proposal.js')
    expect(await snapshotInstalledSchema()).toEqual(before)
    vi.resetModules()
    await import('./v3Proposal.js')
    const fresh = await snapshotInstalledSchema()
    expect(fresh).toEqual(before)
    expect(fresh.applicationId).toBe(0x444c5632)
    expect(fresh.userVersion).toBe(2)
    expect((fresh.schema as Array<{ type: string; name: string }>).filter(({ type }) => type === 'table')
      .map(({ name }) => name).sort()).toEqual([...EXPECTED_PRESENT_TABLES].sort())
  })

  it('keeps proposal versions and lifecycle kinds rejected by live v2 schemas', async () => {
    const liveClaims = await import('../../shared/claims.js')
    expect(liveClaims.ClaimIdMaterialVersionSchema.safeParse('claim-id.v3').success).toBe(false)
    expect(liveClaims.LineageEventKindSchema.safeParse('scope_alias_expired').success).toBe(false)
    expect(liveClaims.LineageEventKindSchema.safeParse('c2_retention_expired').success).toBe(false)
    expect(liveClaims.LineageEventKindSchema.safeParse('scope_series_restarted').success).toBe(false)
    expect(liveClaims.LineageEventKindSchema.safeParse('legacy_deletion_operation').success).toBe(false)
  })

  it('allows only the inert migration/rewrite/sweep/schema/proposal chain and no production caller', () => {
    const root = resolve(__dirname, '../..')
    const roots = ['server', 'shared', 'src', 'scripts'].map((name) => join(root, name))
    const files: string[] = []
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry)
        if (statSync(path).isDirectory()) visit(path)
        else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry) && !/(?:\.test|\.spec)\./.test(entry)) files.push(path)
      }
    }
    for (const directory of roots) visit(directory)
    const offenders: string[] = []
    for (const path of files) {
      const source = readFileSync(path, 'utf8')
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
      const check = (node: ts.Node): void => {
        const moduleSpecifier =
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined
        const requireLiteral = ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === 'require' && node.arguments.length >= 1 &&
          ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text : undefined
        const dynamicLiteral = ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments.length >= 1 && ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text : undefined
        const target = moduleSpecifier ?? requireLiteral ?? dynamicLiteral
        if (target && /(?:^|[\\/])v3Proposal(?:\.[cm]?js|\.ts)?$/.test(target)) {
          const sourcePath = relative(root, path).replaceAll('\\', '/')
          const edge = `${sourcePath} -> ${target.split('/').at(-1)?.replace(/\.(?:[cm]?js|ts)$/, '') ?? target}`
          if (sourcePath !== 'server/storage/v3ShadowSchema.ts') offenders.push(edge)
        }
        if (target && /(?:^|[\\/])v3ShadowSchema(?:\.[cm]?js|\.ts)?$/.test(target)) {
          const sourcePath = relative(root, path).replaceAll('\\', '/')
          if (!['server/storage/v3ShadowRewrite.ts', 'server/storage/v3ShadowSweep.ts'].includes(sourcePath)) {
            offenders.push(`${sourcePath} -> ${target}`)
          }
        }
        if (target && /(?:^|[\\/])v3ShadowRewrite(?:\.[cm]?js|\.ts)?$/.test(target)) {
          const sourcePath = relative(root, path).replaceAll('\\', '/')
          if (!['server/storage/v3ShadowMigration.ts', 'server/storage/v3ShadowSweep.ts'].includes(sourcePath)) {
            offenders.push(`${sourcePath} -> ${target}`)
          }
        }
        if (target && /(?:^|[\\/])v3ShadowSweep(?:\.[cm]?js|\.ts)?$/.test(target)) {
          const sourcePath = relative(root, path).replaceAll('\\', '/')
          offenders.push(`${sourcePath} -> ${target}`)
        }
        if (target && /(?:^|[\\/])v3ContinuityAuthorization(?:\.[cm]?js|\.ts)?$/.test(target)) {
          const sourcePath = relative(root, path).replaceAll('\\', '/')
          offenders.push(`${sourcePath} -> ${target}`)
        }
        if (target && /(?:^|[\\/])v3ContinuityReviewAnchor(?:\.[cm]?js|\.ts)?$/.test(target)) {
          const sourcePath = relative(root, path).replaceAll('\\', '/')
          offenders.push(`${sourcePath} -> ${target}`)
        }
        if (target && /(?:^|[\\/])activationResult(?:\.[cm]?js|\.ts)?$/.test(target)) {
          const sourcePath = relative(root, path).replaceAll('\\', '/')
          if (sourcePath !== 'server/connectors/github/activationReport.ts') {
            offenders.push(`${sourcePath} -> ${target}`)
          }
        }
        if (target && /(?:^|[\\/])activationReport(?:\.[cm]?js|\.ts)?$/.test(target)) {
          const sourcePath = relative(root, path).replaceAll('\\', '/')
          if (sourcePath !== 'server/connectors/github/activationReportLoader.ts') {
            offenders.push(`${sourcePath} -> ${target}`)
          }
        }
        if (target && /(?:^|[\\/])activationReportLoader(?:\.[cm]?js|\.ts)?$/.test(target)) {
          const sourcePath = relative(root, path).replaceAll('\\', '/')
          offenders.push(`${sourcePath} -> ${target}`)
        }
        ts.forEachChild(node, check)
      }
      check(file)
    }
    expect(offenders).toEqual([])

    const proposalPath = join(root, 'server', 'storage', 'v3Proposal.ts')
    const proposalFile = ts.createSourceFile(
      proposalPath,
      readFileSync(proposalPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const proposalImports = proposalFile.statements.flatMap((statement) =>
      ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [])
    expect(proposalImports).toEqual(['zod'])
    const sweepPath = join(root, 'server', 'storage', 'v3ShadowSweep.ts')
    const sweepFile = ts.createSourceFile(
      sweepPath,
      readFileSync(sweepPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const sweepImports = sweepFile.statements.flatMap((statement) =>
      ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [])
    expect(sweepImports).toEqual([
      'node:crypto',
      'better-sqlite3',
      '../../shared/claims.js',
      './v3ShadowSchema.js',
      './v3ShadowRewrite.js',
    ])
    const continuityPath = join(root, 'server', 'storage', 'v3ContinuityAuthorization.ts')
    const continuityFile = ts.createSourceFile(
      continuityPath,
      readFileSync(continuityPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const continuityImports = continuityFile.statements.flatMap((statement) =>
      ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [])
    expect(continuityImports).toEqual([
      'node:crypto',
      '../../shared/claims.js',
      '../../shared/capabilities.js',
      '../lifecycle.js',
    ])
    const reviewAnchorPath = join(root, 'server', 'storage', 'v3ContinuityReviewAnchor.ts')
    const reviewAnchorFile = ts.createSourceFile(
      reviewAnchorPath,
      readFileSync(reviewAnchorPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const reviewAnchorImports = reviewAnchorFile.statements.flatMap((statement) =>
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [])
    expect(reviewAnchorImports).toEqual([])
    const activationResultPath = join(root, 'server', 'connectors', 'github', 'activationResult.ts')
    const activationResultFile = ts.createSourceFile(
      activationResultPath,
      readFileSync(activationResultPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const activationResultImports = activationResultFile.statements.flatMap((statement) =>
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [])
    expect(activationResultImports).toEqual([])
    const activationReportPath = join(root, 'server', 'connectors', 'github', 'activationReport.ts')
    const activationReportFile = ts.createSourceFile(
      activationReportPath,
      readFileSync(activationReportPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const activationReportImports = activationReportFile.statements.flatMap((statement) =>
      ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [])
    expect(activationReportImports).toEqual(['./activationResult.js'])
    const activationReportLoaderPath = join(root, 'server', 'connectors', 'github', 'activationReportLoader.ts')
    const activationReportLoaderFile = ts.createSourceFile(
      activationReportLoaderPath,
      readFileSync(activationReportLoaderPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const activationReportLoaderImports = activationReportLoaderFile.statements.flatMap((statement) =>
      ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [])
    expect(activationReportLoaderImports).toEqual([
      '../../activationArtifactLoader.js',
      './activationReport.js',
    ])
    expect(readFileSync(join(root, 'server', 'storage', 'v3ShadowMigration.ts'), 'utf8'))
      .toMatch(/from ['"]\.\/v3ShadowRewrite\.js['"]/)
  })
})
