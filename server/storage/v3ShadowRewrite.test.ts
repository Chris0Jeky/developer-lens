import { createHash } from 'node:crypto'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { CLAIM_SCHEMA_VERSION, computeClaimId } from '../../shared/claims.js'
import { installV2BridgeStore } from '../api/v2/store.js'
import { installClaimGraphStorage } from './claims.js'
import { openStorageDatabase } from './database.js'
import { installIncrementalGithubCoreStorage } from './incremental.js'
import { createInstallationAliases } from './installationAliases.js'
import { addUtcMonthsClamped, rewriteStorageV3Shadow, StorageV3ShadowRewriteError } from './v3ShadowRewrite.js'

function sourceDb(): Database.Database {
  const db = openStorageDatabase(':memory:')
  installIncrementalGithubCoreStorage(db); installClaimGraphStorage(db); installV2BridgeStore(db)
  db.prepare('INSERT INTO v2_store_provenance (singleton, mode, synthetic_marker, importer_version, created_at) VALUES (1, ?, ?, ?, ?)').run('synthetic', 'developer-lens.synthetic-importer.v1', '1.0.0', '2026-01-01T00:00:00.000Z')
  return db
}

const scopeId = (letter: string): string => `scope-${letter.repeat(64)}`

function seedIdentity(
  db: Database.Database,
  raw: string,
  key: Buffer,
  linkedAt = '2026-01-01T00:00:00.000Z',
  occurredAt = linkedAt,
  id = 'a',
): { provider: string; analytical: string; scope: string } {
  const aliases = createInstallationAliases(key)
  const provider = aliases.repositoryProviderId(raw)
  const analytical = aliases.repositoryAnalyticalKey(raw)
  const scope = scopeId(id)
  db.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at) VALUES (?, ?, ?)').run(scope, provider, linkedAt)
  db.prepare('INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 0, 0, 0)').run(provider, analytical)
  db.prepare('INSERT INTO commit_observation (repository_provider_id, sha, occurred_at, source, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, ?, ?, 0, 0, 1)').run(provider, `sha-${id}`, occurredAt, 'github', 'feat')
  return { provider, analytical, scope }
}

function rewriteError(
  source: Database.Database,
  target: Database.Database,
  key = Buffer.alloc(32, 3),
  bindings: readonly { rawProviderId: string }[] = [],
  asOf = '2026-02-01T00:00:00.000Z',
): StorageV3ShadowRewriteError {
  try {
    let entropy = 4
    rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: bindings, installationKey: key, asOf, randomBytes: () => Buffer.alloc(32, entropy++) })
  } catch (error) {
    expect(error).toBeInstanceOf(StorageV3ShadowRewriteError)
    return error as StorageV3ShadowRewriteError
  }
  throw new Error('expected rewrite to fail')
}

function seedIncremental(db: Database.Database, scopeAlias: string, dates = {
  rangeStart: '2026-01-01T00:00:00.000Z',
  rangeEnd: '2026-02-01T00:00:00.000Z',
  observedAt: '2026-02-01T00:00:00.000Z',
  completedAt: '2026-02-01T00:00:00.000Z',
}): void {
  db.prepare('INSERT INTO collection_job (job_id, storage_contract_version, payload_hash, capability_id, scope_alias, query_version, source_api_version, consent_revision, range_start, range_end, observed_at, started_at, completed_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('job-seeded', '2.2.0', 'a'.repeat(64), 'github.core', scopeAlias, 'github.core.v1', '2026-03-10', 'consent-v3', dates.rangeStart, dates.rangeEnd, dates.observedAt, dates.observedAt, dates.completedAt, 'complete')
  db.prepare('INSERT INTO source_snapshot (snapshot_id, job_id, capability_id, scope_alias, snapshot_hash, range_start, range_end, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('snapshot-seeded', 'job-seeded', 'github.core', scopeAlias, 'b'.repeat(64), dates.rangeStart, dates.rangeEnd, dates.observedAt)
  db.prepare('INSERT INTO coverage_ledger (coverage_id, range_start, job_id, snapshot_id, capability_id, scope_alias, range_end, status, expected_units, observed_units, omitted_units, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('coverage-seeded', dates.rangeStart, 'job-seeded', 'snapshot-seeded', 'github.core', scopeAlias, dates.rangeEnd, 'complete', 1, 1, 0, 0, dates.observedAt, 'NONE')
  db.prepare('INSERT INTO collection_checkpoint (capability_id, scope_alias, query_version, source_api_version, high_watermark, cursor_hint, bounded_overlap_start, last_complete_snapshot_hash, consent_revision, committed_job_id, source_snapshot_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('github.core', scopeAlias, 'github.core.v1', '2026-03-10', dates.rangeEnd, 'cursor', dates.rangeStart, 'b'.repeat(64), 'consent-v3', 'job-seeded', 'snapshot-seeded')
}

function seedClaimGraph(
  db: Database.Database,
  raw: string,
  key: Buffer,
  createdAt: string,
): { sourceClaimId: string; scope: string } {
  const seeded = seedIdentity(db, raw, key, undefined, undefined, 'e')
  seedIncremental(db, seeded.provider)
  db.prepare('INSERT INTO evidence (evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run('evidence-seeded', 'observed', '2.0.0', 'coverage-seeded', '2026-01-01T00:00:00.000Z', 'job-seeded')
  const sourceClaimId = computeClaimId({
    layer: 'modelled',
    statementCode: 'DELIVERY_FLOW',
    methodId: 'method',
    methodVersion: '1.0.0',
    basis: [{ role: 'supports', targetEvidenceId: 'evidence-seeded' }],
    windowStart: '2026-01-01T00:00:00.000Z',
    windowEnd: '2026-02-01T00:00:00.000Z',
    scopeId: seeded.scope,
    schemaVersion: CLAIM_SCHEMA_VERSION,
  })
  db.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(sourceClaimId, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', seeded.scope, CLAIM_SCHEMA_VERSION, 'claim-id.v2', createdAt)
  db.prepare('INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id) VALUES (?, ?, ?)')
    .run(sourceClaimId, 'supports', 'evidence-seeded')
  db.prepare('INSERT INTO limitation_instance (claim_id, limitation_code, dimension, copy_key) VALUES (?, ?, ?, ?)')
    .run(sourceClaimId, 'SAMPLE_TOO_SMALL', 'sample', 'copy')
  return { sourceClaimId, scope: seeded.scope }
}

describe('B1b-ii shadow rewrite', () => {
  it('copies a bound repository and remains incomplete/non-selectable', () => {
    const source = sourceDb(), target = new Database(':memory:'), raw = 'invented-provider-1', key = Buffer.alloc(32, 7), aliases = createInstallationAliases(key), provider = aliases.repositoryProviderId(raw), analytical = aliases.repositoryAnalyticalKey(raw)
    source.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at) VALUES (?, ?, ?)').run(`scope-${'a'.repeat(64)}`, provider, '2026-01-01T00:00:00.000Z')
    source.prepare('INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 0, 0, 0)').run(provider, analytical)
    source.prepare('INSERT INTO commit_observation (repository_provider_id, sha, occurred_at, source, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, ?, ?, 0, 0, 4)').run(provider, 'sha-1', '2026-01-01T00:00:00.000Z', 'github', 'feat')
    try {
      const result = rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [{ rawProviderId: raw }], installationKey: key, asOf: '2026-01-02T00:00:00.000Z', randomBytes: () => Buffer.alloc(32, 8) })
      expect(result.completeB1b).toBe(false); expect(result.selectable).toBe(false); expect(result.copiedScopes).toBe(1)
      expect(target.prepare('SELECT provider_id, analytical_key FROM repository_identity').get()).toEqual({ provider_id: provider, analytical_key: analytical })
    } finally { source.close(); target.close() }
  })

  it('fails closed on missing bindings and leaves target without rows', () => {
    const source = sourceDb(), target = new Database(':memory:')
    try {
      expect(() => rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [], installationKey: Buffer.alloc(32), asOf: '2026-01-01T00:00:00.000Z' })).not.toThrow()
      expect(() => rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [{ rawProviderId: 'extra' }], installationKey: Buffer.alloc(32), asOf: '2026-01-01T00:00:00.000Z' })).toThrowError(StorageV3ShadowRewriteError)
    } finally { source.close(); target.close() }
  })

  it('rejects activation-card provenance without exposing values', () => {
    const source = sourceDb(), target = new Database(':memory:')
    source.prepare('UPDATE v2_store_provenance SET mode = ?, synthetic_marker = NULL, activation_card_id = ?').run('activation_card', 'card-test')
    try { expect(() => rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [], installationKey: Buffer.alloc(32), asOf: '2026-01-01T00:00:00.000Z' })).toThrowError('SOURCE_BRIDGE_REFUSED')
    } finally { source.close(); target.close() }
  })

  it('uses the inclusive clamped thirteen-month expiry boundary', () => {
    const source = sourceDb(), target = new Database(':memory:'), raw = 'jan31-provider', key = Buffer.alloc(32, 9), aliases = createInstallationAliases(key), provider = aliases.repositoryProviderId(raw)
    source.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at) VALUES (?, ?, ?)').run(`scope-${'b'.repeat(64)}`, provider, '2025-01-31T12:00:00.000Z')
    source.prepare('INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 1, 1, 0)').run(provider, aliases.repositoryAnalyticalKey(raw))
    source.prepare('INSERT INTO commit_observation (repository_provider_id, sha, occurred_at, source, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, ?, ?, 0, 0, 1)').run(provider, 'sha-jan', '2025-01-31T12:00:00.000Z', 'github', 'fix')
    try {
      const result = rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [], installationKey: key, asOf: '2026-02-28T12:00:00.000Z' })
      expect(result.omittedExpiredIdentities).toBe(1)
      expect(target.prepare('SELECT provider_id, analytical_key, identity_expires_at, is_private, is_archived, is_fork FROM repository_identity').get()).toEqual({ provider_id: null, analytical_key: null, identity_expires_at: null, is_private: 1, is_archived: 1, is_fork: 0 })
    } finally { source.close(); target.close() }
  })

  it('rejects non-canonical as-of timestamps without echoing them', () => {
    const source = sourceDb(), target = new Database(':memory:')
    try { expect(() => rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [], installationKey: Buffer.alloc(32), asOf: '2026-01-01' })).toThrowError('INVALID_TIMESTAMP')
    } finally { source.close(); target.close() }
  })

  it('refuses a non-empty target atomically and preserves source bytes', () => {
    const source = sourceDb(), target = new Database(':memory:')
    try {
      const before = source.prepare('SELECT COUNT(*) AS count FROM v2_store_provenance').get()
      expect(() => rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [], installationKey: Buffer.alloc(32), asOf: '2026-01-01T00:00:00.000Z' })).not.toThrow()
      target.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(`scope-${'c'.repeat(64)}`)
      expect(() => rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [], installationKey: Buffer.alloc(32), asOf: '2026-01-01T00:00:00.000Z' })).toThrowError('TARGET_REFUSED')
      expect(source.prepare('SELECT COUNT(*) AS count FROM v2_store_provenance').get()).toEqual(before)
      expect(target.prepare('SELECT COUNT(*) FROM claim_scope').pluck().get()).toBe(1)
    } finally { source.close(); target.close() }
  })

  it('converts the slice-A legacy deletion compatibility row without scope binding', () => {
    const source = sourceDb(), target = new Database(':memory:'), suffix = 'd'.repeat(64)
    source.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)').run(`scope_tombstone_${suffix}`, 'tombstone_cascade', 'cap_github_core', '2026-01-03T00:00:00.000Z')
    try {
      const result = rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [], installationKey: Buffer.alloc(32), asOf: '2026-01-01T00:00:00.000Z' })
      expect(result.copiedLineageEvents).toBe(1)
      expect(target.prepare('SELECT subject_kind, subject_id, operation_id, event_kind, scope_id FROM lineage_event').get()).toMatchObject({ subject_kind: 'deletion', subject_id: `del-${suffix}`, operation_id: `del-${suffix}`, event_kind: 'legacy_deletion_operation', scope_id: null })
    } finally { source.close(); target.close() }
  })

  it('copies a complete incremental and claim graph with closed references', () => {
    const source = sourceDb(), target = new Database(':memory:'), raw = 'graph-provider', key = Buffer.alloc(32, 11), aliases = createInstallationAliases(key), provider = aliases.repositoryProviderId(raw), analytical = aliases.repositoryAnalyticalKey(raw), oldScope = `scope-${'e'.repeat(64)}`
    source.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at) VALUES (?, ?, ?)').run(oldScope, provider, '2026-01-01T00:00:00.000Z')
    source.prepare('INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 0, 0, 0)').run(provider, analytical)
    source.prepare('INSERT INTO commit_observation (repository_provider_id, sha, occurred_at, source, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, ?, ?, 0, 0, 1)').run(provider, 'sha-graph', '2026-01-01T00:00:00.000Z', 'github', 'feat')
    source.prepare('INSERT INTO collection_job (job_id, storage_contract_version, payload_hash, capability_id, scope_alias, query_version, source_api_version, consent_revision, range_start, range_end, observed_at, started_at, completed_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('job-source', '2.2.0', 'a'.repeat(64), 'github.core', provider, 'github.core.v1', '2026-03-10', 'consent-v3', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 'complete')
    source.prepare('INSERT INTO source_snapshot (snapshot_id, job_id, capability_id, scope_alias, snapshot_hash, range_start, range_end, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('snapshot-source', 'job-source', 'github.core', provider, 'b'.repeat(64), '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z')
    source.prepare('INSERT INTO coverage_ledger (coverage_id, range_start, job_id, snapshot_id, capability_id, scope_alias, range_end, status, expected_units, observed_units, omitted_units, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('coverage-source', '2026-01-01T00:00:00.000Z', 'job-source', 'snapshot-source', 'github.core', provider, '2026-02-01T00:00:00.000Z', 'complete', 1, 1, 0, 0, '2026-02-01T00:00:00.000Z', 'NONE')
    source.prepare('INSERT INTO collection_checkpoint (capability_id, scope_alias, query_version, source_api_version, high_watermark, cursor_hint, bounded_overlap_start, last_complete_snapshot_hash, consent_revision, committed_job_id, source_snapshot_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('github.core', provider, 'github.core.v1', '2026-03-10', '2026-02-01T00:00:00.000Z', 'cursor', '2026-01-31T00:00:00.000Z', 'b'.repeat(64), 'consent-v3', 'job-source', 'snapshot-source')
    source.prepare('INSERT INTO evidence (evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id) VALUES (?, ?, ?, ?, ?, ?)').run('evidence-source', 'observed', '2.0.0', 'coverage-source', '2026-01-01T00:00:00.000Z', 'job-source')
    const claim = computeClaimId({
      layer: 'modelled',
      statementCode: 'DELIVERY_FLOW',
      methodId: 'method',
      methodVersion: '1.0.0',
      basis: [{ role: 'supports', targetEvidenceId: 'evidence-source' }],
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-02-01T00:00:00.000Z',
      scopeId: oldScope,
      schemaVersion: CLAIM_SCHEMA_VERSION,
    })
    source.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(claim, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', oldScope, CLAIM_SCHEMA_VERSION, 'claim-id.v2', '2026-02-01T00:00:00.000Z')
    source.prepare('INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id) VALUES (?, ?, ?)').run(claim, 'supports', 'evidence-source')
    source.prepare('INSERT INTO limitation_instance (claim_id, limitation_code, dimension, copy_key) VALUES (?, ?, ?, ?)').run(claim, 'SAMPLE_TOO_SMALL', 'sample', 'copy')
    try {
      const result = rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [{ rawProviderId: raw }], installationKey: key, asOf: '2026-03-01T00:00:00.000Z', randomBytes: () => Buffer.alloc(32, 12) })
      expect(result.copiedClaims).toBe(1)
      expect(target.prepare('SELECT COUNT(*) FROM collection_job').pluck().get()).toBe(1)
      expect(target.prepare('SELECT COUNT(*) FROM evidence').pluck().get()).toBe(1)
      expect(target.prepare('SELECT COUNT(*) FROM claim_evidence_edge').pluck().get()).toBe(1)
    } finally { source.close(); target.close() }
  })

  it('clears only expired claim provenance at the inclusive clamped boundary', () => {
    const liveSource = sourceDb(), expiredSource = sourceDb()
    const liveTarget = new Database(':memory:'), expiredTarget = new Database(':memory:')
    const raw = 'claim-provenance-provider', key = Buffer.alloc(32, 113)
    const createdAt = '2025-01-31T12:00:00.000Z'
    const liveSeed = seedClaimGraph(liveSource, raw, key, createdAt)
    const expiredSeed = seedClaimGraph(expiredSource, raw, key, createdAt)
    try {
      const options = {
        identityBindings: [{ rawProviderId: raw }],
        installationKey: key,
        randomBytes: () => Buffer.alloc(32, 114),
      }
      rewriteStorageV3Shadow({
        ...options,
        sourceDb: liveSource,
        targetDb: liveTarget,
        asOf: '2026-02-28T11:59:59.999Z',
      })
      rewriteStorageV3Shadow({
        ...options,
        sourceDb: expiredSource,
        targetDb: expiredTarget,
        asOf: '2026-02-28T12:00:00.000Z',
      })
      const c1Columns = 'claim_id, scope_id, layer, statement_code, method_id, method_version, window_start, window_end, schema_version, claim_id_material_version, superseded_by'
      expect(liveTarget.prepare(`SELECT ${c1Columns} FROM claim`).get())
        .toEqual(expiredTarget.prepare(`SELECT ${c1Columns} FROM claim`).get())
      expect(liveTarget.prepare('SELECT created_at FROM claim').pluck().get()).toBe(createdAt)
      expect(expiredTarget.prepare('SELECT created_at FROM claim').pluck().get()).toBeNull()
      expect(liveTarget.prepare('SELECT COUNT(*) FROM claim_evidence_edge').pluck().get()).toBe(1)
      expect(expiredTarget.prepare('SELECT COUNT(*) FROM claim_evidence_edge').pluck().get()).toBe(1)
      expect(liveTarget.prepare('SELECT COUNT(*) FROM limitation_instance').pluck().get()).toBe(1)
      expect(expiredTarget.prepare('SELECT COUNT(*) FROM limitation_instance').pluck().get()).toBe(1)
      expect(liveSource.prepare('SELECT created_at FROM claim WHERE claim_id = ?').pluck().get(liveSeed.sourceClaimId)).toBe(createdAt)
      expect(expiredSource.prepare('SELECT created_at FROM claim WHERE claim_id = ?').pluck().get(expiredSeed.sourceClaimId)).toBe(createdAt)
    } finally {
      liveSource.close()
      expiredSource.close()
      liveTarget.close()
      expiredTarget.close()
    }
  })

  it('refuses a collection job without its required snapshot and coverage graph', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 121)
    const seeded = seedIdentity(source, 'incomplete-job', key)
    source.prepare('INSERT INTO collection_job (job_id, storage_contract_version, payload_hash, capability_id, scope_alias, query_version, source_api_version, consent_revision, range_start, range_end, observed_at, started_at, completed_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('job-incomplete', '2.2.0', 'a'.repeat(64), 'github.core', seeded.provider, 'github.core.v1', '2026-03-10', 'consent-v3', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 'complete')
    try {
      expect(rewriteError(source, target, key, [{ rawProviderId: 'incomplete-job' }]).code).toBe('GRAPH_REFUSED')
      expect(target.prepare('SELECT COUNT(*) FROM collection_job').pluck().get()).toBe(0)
    } finally { source.close(); target.close() }
  })

  it.each([
    ['missing', [], 'IDENTITY_BINDING_UNVERIFIABLE'],
    ['mismatch', [{ rawProviderId: 'wrong-provider' }], 'IDENTITY_BINDING_AMBIGUOUS'],
    ['extra', [{ rawProviderId: 'bound-provider' }, { rawProviderId: 'extra-provider' }], 'IDENTITY_BINDING_AMBIGUOUS'],
    ['duplicate', [{ rawProviderId: 'bound-provider' }, { rawProviderId: 'bound-provider' }], 'IDENTITY_BINDING_AMBIGUOUS'],
  ] as const)('fails closed for %s identity bindings', (_name, bindings, code) => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 13)
    seedIdentity(source, 'bound-provider', key)
    try {
      const error = rewriteError(source, target, key, bindings)
      expect(error.code).toBe(code)
      expect(error.message).toBe(code)
      expect(error.message).not.toContain('bound-provider')
    } finally { source.close(); target.close() }
  })

  it('rejects a provider alias whose analytical alias does not match', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 14)
    const bound = seedIdentity(source, 'bound-provider', key)
    const wrong = createInstallationAliases(key).repositoryAnalyticalKey('other-provider')
    source.prepare('UPDATE repository_identity SET analytical_key = ? WHERE provider_id = ?').run(wrong, bound.provider)
    try {
      expect(rewriteError(source, target, key, [{ rawProviderId: 'bound-provider' }]).code).toBe('IDENTITY_BINDING_MISMATCH')
    } finally { source.close(); target.close() }
  })

  it('rejects an analytical alias supplied as the provider-domain scope alias', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 141)
    const seeded = seedIdentity(source, 'provider-domain', key)
    source.prepare('UPDATE claim_scope SET scope_alias = ? WHERE scope_id = ?').run(seeded.analytical, seeded.scope)
    try {
      expect(rewriteError(source, target, key, [{ rawProviderId: 'provider-domain' }]).code).toBe('IDENTITY_BINDING_MISMATCH')
    } finally { source.close(); target.close() }
  })

  it('creates one generated scope per eligible provider using its own latest anchor', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 15)
    const first = seedIdentity(source, 'first-provider', key, '2026-01-01T00:00:00.000Z', '2026-01-03T00:00:00.000Z', '1')
    const second = seedIdentity(source, 'second-provider', key, '2026-01-01T00:00:00.000Z', '2026-01-09T00:00:00.000Z', '2')
    seedIncremental(source, first.provider)
    source.prepare('DELETE FROM claim_scope WHERE scope_id IN (?, ?)').run(first.scope, second.scope)
    try {
      const result = rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [{ rawProviderId: 'first-provider' }, { rawProviderId: 'second-provider' }], installationKey: key, asOf: '2026-02-01T00:00:00.000Z', randomBytes: (() => { let n = 0; return () => Buffer.alloc(32, ++n) })() })
      expect(result.copiedScopes).toBe(2)
      const rows = target.prepare('SELECT provider_id, scope_id FROM repository_identity ORDER BY provider_id').all() as Array<{ provider_id: string; scope_id: string }>
      expect(rows).toHaveLength(2)
      expect(new Set(rows.map((row) => row.scope_id)).size).toBe(2)
      const linked = new Map((target.prepare('SELECT scope_alias, linked_at FROM claim_scope').all() as Array<{ scope_alias: string; linked_at: string }>).map((row) => [row.scope_alias, row.linked_at]))
      expect(linked.get(first.provider)).toBe('2026-01-03T00:00:00.000Z')
      expect(linked.get(second.provider)).toBe('2026-01-09T00:00:00.000Z')
      const firstScope = rows.find((row) => row.provider_id === first.provider)?.scope_id
      expect(target.prepare('SELECT scope_id FROM collection_job').pluck().get()).toBe(firstScope)
      expect(target.prepare('SELECT scope_id FROM source_snapshot').pluck().get()).toBe(firstScope)
      expect(target.prepare('SELECT scope_id FROM coverage_ledger').pluck().get()).toBe(firstScope)
      expect(target.prepare('SELECT scope_id FROM collection_checkpoint').pluck().get()).toBe(firstScope)
    } finally { source.close(); target.close() }
  })

  it('expires a first-link alias at the inclusive thirteen-month boundary', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 16)
    const seeded = seedIdentity(source, 'first-link', key, '2025-01-31T12:00:00.000Z', '2026-01-15T12:00:00.000Z', 'f')
    try {
      rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [{ rawProviderId: 'first-link' }], installationKey: key, asOf: '2026-02-28T12:00:00.000Z' })
      expect(target.prepare('SELECT COUNT(*) FROM repository_identity').pluck().get()).toBe(1)
      expect(target.prepare('SELECT scope_alias, linked_at, alias_expires_at FROM claim_scope WHERE scope_id = ?').get(seeded.scope)).toEqual({ scope_alias: null, linked_at: null, alias_expires_at: null })
    } finally { source.close(); target.close() }
  })

  it.each(['missing anchor', 'expired anchor'] as const)('omits an unscoped identity and its incremental descendants for a %s', (kind) => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, kind === 'missing anchor' ? 161 : 162)
    const seeded = seedIdentity(source, `omitted-${kind}`, key, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z', kind === 'missing anchor' ? '1' : '2')
    seedIncremental(source, seeded.provider)
    source.prepare('DELETE FROM claim_scope WHERE scope_id = ?').run(seeded.scope)
    if (kind === 'missing anchor') source.prepare('DELETE FROM commit_observation').run()
    try {
      const result = rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [], installationKey: key, asOf: '2026-03-01T00:00:00.000Z' })
      expect(result.omittedExpiredIdentities).toBe(1)
      for (const table of ['claim_scope', 'repository_identity', 'commit_observation', 'collection_job', 'source_snapshot', 'coverage_ledger', 'collection_checkpoint']) {
        expect(target.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get(), table).toBe(0)
      }
    } finally { source.close(); target.close() }
  })

  it('keeps per-observation C2 data only before its exact expiry', () => {
    expect(addUtcMonthsClamped('2024-01-31T00:00:00.000Z')).toBe('2025-02-28T00:00:00.000Z')
    expect(addUtcMonthsClamped('2024-02-29T00:00:00.000Z')).toBe('2025-03-29T00:00:00.000Z')
    expect(() => addUtcMonthsClamped('9999-12-31T00:00:00.000Z')).toThrow('INVALID_TIMESTAMP')
    const run = (asOf: string) => {
      const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 17)
      seedIdentity(source, 'observation-expiry', key, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z', 'c')
      try {
        rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: asOf.endsWith('999Z') ? [{ rawProviderId: 'observation-expiry' }] : [], installationKey: key, asOf })
        return target.prepare('SELECT sha, occurred_at, c2_expires_at FROM commit_observation').get()
      } finally { source.close(); target.close() }
    }
    expect(run('2026-02-01T00:00:00.000Z')).toEqual({ sha: null, occurred_at: null, c2_expires_at: null })
    expect(run('2026-01-31T23:59:59.999Z')).toMatchObject({ sha: 'sha-c', occurred_at: '2025-01-01T00:00:00.000Z' })
  })

  it('nulls an expired checkpoint while preserving its C1 graph and source lineage', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 18)
    const seeded = seedIdentity(source, 'checkpoint-expiry', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'a')
    seedIncremental(source, seeded.provider, {
      rangeStart: '2025-01-01T00:00:00.000Z',
      rangeEnd: '2025-02-01T00:00:00.000Z',
      observedAt: '2025-02-01T00:00:00.000Z',
      completedAt: '2025-02-01T00:00:00.000Z',
    })
    try {
      rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [{ rawProviderId: 'checkpoint-expiry' }], installationKey: key, asOf: '2026-03-01T00:00:00.000Z' })
      expect(target.prepare('SELECT COUNT(*) FROM claim_scope').pluck().get()).toBe(1)
      expect(target.prepare('SELECT COUNT(*) FROM collection_checkpoint').pluck().get()).toBe(1)
      expect(target.prepare('SELECT high_watermark, cursor_hint, bounded_overlap_start, last_complete_snapshot_hash, c2_expires_at FROM collection_checkpoint').get()).toEqual({ high_watermark: null, cursor_hint: null, bounded_overlap_start: null, last_complete_snapshot_hash: null, c2_expires_at: null })
    } finally { source.close(); target.close() }
  })

  it('remints a v2 claim to the exact documented v3 material', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 19)
    const seeded = seedIdentity(source, 'claim-golden', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'b')
    seedIncremental(source, seeded.provider)
    source.prepare('INSERT INTO evidence (evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id) VALUES (?, ?, ?, ?, ?, ?)').run('evidence-golden', 'observed', '2.0.0', 'coverage-seeded', '2026-01-01T00:00:00.000Z', 'job-seeded')
    const claim = computeClaimId({ layer: 'modelled', statementCode: 'DELIVERY_FLOW', methodId: 'method', methodVersion: '1.0.0', basis: [{ role: 'supports', targetEvidenceId: 'evidence-golden' }], windowStart: '2026-01-01T00:00:00.000Z', windowEnd: '2026-02-01T00:00:00.000Z', scopeId: seeded.scope, schemaVersion: CLAIM_SCHEMA_VERSION })
    source.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(claim, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', seeded.scope, CLAIM_SCHEMA_VERSION, 'claim-id.v2', '2026-02-01T00:00:00.000Z')
    source.prepare('INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id) VALUES (?, ?, ?)').run(claim, 'supports', 'evidence-golden')
    try {
      rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [{ rawProviderId: 'claim-golden' }], installationKey: key, asOf: '2026-03-01T00:00:00.000Z', randomBytes: (() => { let n = 0; return () => Buffer.alloc(32, ++n) })() })
      const evidence = target.prepare('SELECT evidence_id FROM evidence').pluck().get() as string
      const targetScope = target.prepare('SELECT scope_id FROM claim_scope').pluck().get() as string
      const material = ['claim-id.v3', 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', targetScope, CLAIM_SCHEMA_VERSION, `evidence|supports|${evidence}`].join('\n')
      expect(target.prepare('SELECT claim_id, claim_id_material_version FROM claim').get()).toEqual({ claim_id: `cl_${createHash('sha256').update(material, 'utf8').digest('hex')}`, claim_id_material_version: 'claim-id.v3' })
    } finally { source.close(); target.close() }
  })

  it('keeps duplicate coverage IDs distinct by the exact evidence composite', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 191)
    const seeded = seedIdentity(source, 'coverage-composite', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'c')
    seedIncremental(source, seeded.provider)
    source.prepare('INSERT INTO collection_job (job_id, storage_contract_version, payload_hash, capability_id, scope_alias, query_version, source_api_version, consent_revision, range_start, range_end, observed_at, started_at, completed_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('job-second', '2.2.0', 'c'.repeat(64), 'github.core', seeded.provider, 'github.core.v1', '2026-03-10', 'consent-v3', '2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', 'complete')
    source.prepare('INSERT INTO source_snapshot (snapshot_id, job_id, capability_id, scope_alias, snapshot_hash, range_start, range_end, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('snapshot-second', 'job-second', 'github.core', seeded.provider, 'd'.repeat(64), '2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z')
    source.prepare('INSERT INTO coverage_ledger (coverage_id, range_start, job_id, snapshot_id, capability_id, scope_alias, range_end, status, expected_units, observed_units, omitted_units, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('coverage-seeded', '2026-02-01T00:00:00.000Z', 'job-second', 'snapshot-second', 'github.core', seeded.provider, '2026-03-01T00:00:00.000Z', 'complete', 1, 1, 0, 0, '2026-03-01T00:00:00.000Z', 'NONE')
    try {
      let entropy = 192
      rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [{ rawProviderId: 'coverage-composite' }], installationKey: key, asOf: '2026-04-01T00:00:00.000Z', randomBytes: () => Buffer.alloc(32, entropy++) })
      expect(target.prepare('SELECT COUNT(*) FROM coverage_ledger').pluck().get()).toBe(2)
      expect(target.prepare('SELECT COUNT(DISTINCT source_coverage_id) FROM coverage_ledger').pluck().get()).toBe(1)
    } finally { source.close(); target.close() }
  })

  it.each([
    ['zero-edge claim', (db: Database.Database, seeded: { scope: string }) => {
      db.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`cl_${'1'.repeat(64)}`, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', seeded.scope, CLAIM_SCHEMA_VERSION, 'claim-id.v2', '2026-02-01T00:00:00.000Z')
    }],
    ['dangling coverage edge', (db: Database.Database, seeded: { scope: string }) => {
      db.pragma('foreign_keys = OFF')
      const claim = `cl_${'2'.repeat(64)}`
      db.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(claim, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', seeded.scope, CLAIM_SCHEMA_VERSION, 'claim-id.v2', '2026-02-01T00:00:00.000Z')
      db.prepare('INSERT INTO claim_evidence_edge (claim_id, role, target_coverage_id, target_coverage_range_start, target_coverage_job_id) VALUES (?, ?, ?, ?, ?)').run(claim, 'coverage_basis', 'missing-coverage', '2026-01-01T00:00:00.000Z', 'missing-job')
      db.pragma('foreign_keys = ON')
    }],
  ] as const)('refuses %s', (_name, addRows) => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 20)
    const seeded = seedIdentity(source, 'graph-refusal', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'd')
    addRows(source, seeded)
    try {
      expect(rewriteError(source, target, key, [{ rawProviderId: 'graph-refusal' }]).code).toBe(_name === 'dangling coverage edge' ? 'SOURCE_SCHEMA_REFUSED' : 'GRAPH_REFUSED')
      const claimTable = target.prepare("SELECT COUNT(*) FROM sqlite_schema WHERE type = 'table' AND name = 'claim'").pluck().get() as number
      expect(claimTable).toBe(_name === 'zero-edge claim' ? 1 : 0)
      if (claimTable === 1) expect(target.prepare('SELECT COUNT(*) FROM claim').pluck().get()).toBe(0)
    } finally { source.close(); target.close() }
  })

  it('refuses an evidence layer stronger than its claim layer', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 21)
    const first = seedIdentity(source, 'scope-one', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'e')
    seedIncremental(source, first.provider)
    source.prepare('INSERT INTO evidence (evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id) VALUES (?, ?, ?, ?, ?, ?)').run('evidence-strong', 'hypothesis', '2.0.0', 'coverage-seeded', '2026-01-01T00:00:00.000Z', 'job-seeded')
    const claim = `cl_${'3'.repeat(64)}`
    source.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(claim, 'deterministic', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', first.scope, CLAIM_SCHEMA_VERSION, 'claim-id.v2', '2026-02-01T00:00:00.000Z')
    source.prepare('INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id) VALUES (?, ?, ?)').run(claim, 'supports', 'evidence-strong')
    try {
      expect(rewriteError(source, target, key, [{ rawProviderId: 'scope-one' }]).code).toBe('GRAPH_REFUSED')
    } finally { source.close(); target.close() }
  })

  it('refuses a claim edge whose evidence belongs to another scope', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 212)
    const first = seedIdentity(source, 'claim-scope', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'e')
    const second = seedIdentity(source, 'evidence-scope', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'f')
    seedIncremental(source, second.provider)
    source.prepare('INSERT INTO evidence (evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id) VALUES (?, ?, ?, ?, ?, ?)').run('evidence-cross-scope', 'observed', '2.0.0', 'coverage-seeded', '2026-01-01T00:00:00.000Z', 'job-seeded')
    const claim = computeClaimId({
      layer: 'deterministic',
      statementCode: 'DELIVERY_FLOW',
      methodId: 'method',
      methodVersion: '1.0.0',
      basis: [{ role: 'supports', targetEvidenceId: 'evidence-cross-scope' }],
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-02-01T00:00:00.000Z',
      scopeId: first.scope,
      schemaVersion: CLAIM_SCHEMA_VERSION,
    })
    source.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(claim, 'deterministic', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', first.scope, CLAIM_SCHEMA_VERSION, 'claim-id.v2', '2026-02-01T00:00:00.000Z')
    source.prepare('INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id) VALUES (?, ?, ?)').run(claim, 'supports', 'evidence-cross-scope')
    try {
      expect(rewriteError(source, target, key, [{ rawProviderId: 'claim-scope' }, { rawProviderId: 'evidence-scope' }]).code).toBe('GRAPH_REFUSED')
    } finally { source.close(); target.close() }
  })

  it('refuses to reconstruct an erased scope alias from a retained claim graph', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 213)
    const seeded = seedIdentity(source, 'erased-scope-link', key, '2025-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'd')
    seedIncremental(source, seeded.provider)
    source.prepare('INSERT INTO evidence (evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id) VALUES (?, ?, ?, ?, ?, ?)').run('evidence-erased-link', 'observed', '2.0.0', 'coverage-seeded', '2026-01-01T00:00:00.000Z', 'job-seeded')
    const claim = computeClaimId({
      layer: 'deterministic',
      statementCode: 'DELIVERY_FLOW',
      methodId: 'method',
      methodVersion: '1.0.0',
      basis: [{ role: 'supports', targetEvidenceId: 'evidence-erased-link' }],
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-02-01T00:00:00.000Z',
      scopeId: seeded.scope,
      schemaVersion: CLAIM_SCHEMA_VERSION,
    })
    source.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(claim, 'deterministic', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', seeded.scope, CLAIM_SCHEMA_VERSION, 'claim-id.v2', '2026-02-01T00:00:00.000Z')
    source.prepare('INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id) VALUES (?, ?, ?)').run(claim, 'supports', 'evidence-erased-link')
    source.prepare('UPDATE claim_scope SET scope_alias = NULL WHERE scope_id = ?').run(seeded.scope)
    try {
      expect(rewriteError(source, target, key, [{ rawProviderId: 'erased-scope-link' }], '2026-03-01T00:00:00.000Z').code).toBe('GRAPH_REFUSED')
    } finally { source.close(); target.close() }
  })

  it.each(['series mismatch', 'supersession cycle'] as const)('refuses a %s', (kind) => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, kind === 'series mismatch' ? 22 : 23)
    const seeded = seedIdentity(source, `supersession-${kind}`, key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', kind === 'series mismatch' ? 'a' : 'b')
    seedIncremental(source, seeded.provider)
    source.prepare('INSERT INTO evidence (evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id) VALUES (?, ?, ?, ?, ?, ?)').run(`evidence-${kind.replace(' ', '_')}`, 'observed', '2.0.0', 'coverage-seeded', '2026-01-01T00:00:00.000Z', 'job-seeded')
    source.prepare('INSERT INTO evidence (evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id) VALUES (?, ?, ?, ?, ?, ?)').run(`evidence2-${kind.replace(' ', '_')}`, 'observed', '2.0.0', 'coverage-seeded', '2026-01-01T00:00:00.000Z', 'job-seeded')
    const base = { statementCode: 'DELIVERY_FLOW' as const, methodId: 'method', methodVersion: '1.0.0', windowStart: '2026-01-01T00:00:00.000Z', windowEnd: '2026-02-01T00:00:00.000Z', scopeId: seeded.scope, schemaVersion: CLAIM_SCHEMA_VERSION }
    const evidenceId = `evidence-${kind.replace(' ', '_')}`
    const first = computeClaimId({ ...base, layer: 'deterministic', basis: [{ role: 'supports', targetEvidenceId: evidenceId }] })
    const secondEvidenceId = `evidence2-${kind.replace(' ', '_')}`
    const second = computeClaimId({ ...base, layer: kind === 'series mismatch' ? 'modelled' : 'deterministic', basis: [{ role: 'supports', targetEvidenceId: secondEvidenceId }] })
    const insert = source.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at, superseded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    insert.run(second, kind === 'series mismatch' ? 'modelled' : 'deterministic', base.statementCode, base.methodId, base.methodVersion, base.windowStart, base.windowEnd, base.scopeId, CLAIM_SCHEMA_VERSION, 'claim-id.v2', base.windowEnd, null)
    insert.run(first, 'deterministic', base.statementCode, base.methodId, base.methodVersion, base.windowStart, base.windowEnd, base.scopeId, CLAIM_SCHEMA_VERSION, 'claim-id.v2', base.windowEnd, second)
    if (kind === 'supersession cycle') source.prepare('UPDATE claim SET superseded_by = ? WHERE claim_id = ?').run(first, second)
    source.prepare('INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id) VALUES (?, ?, ?)').run(first, 'supports', evidenceId)
    source.prepare('INSERT INTO claim_evidence_edge (claim_id, role, target_evidence_id) VALUES (?, ?, ?)').run(second, 'supports', secondEvidenceId)
    try {
      expect(rewriteError(source, target, key, [{ rawProviderId: `supersession-${kind}` }]).code).toBe('GRAPH_REFUSED')
    } finally { source.close(); target.close() }
  })

  it('remaps lineage subjects/causes and deduplicates exact legacy rows', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 24), suffix = 'd'.repeat(64)
    const seeded = seedIdentity(source, 'lineage-owner', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'a')
    seedIncremental(source, seeded.provider)
    source.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)').run(seeded.scope, 'correction', seeded.scope, '2026-01-02T00:00:00.000Z')
    source.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)').run('job-seeded', 'correction', 'snapshot-seeded', '2026-01-02T00:00:00.000Z')
    source.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)').run(`scope_tombstone_${suffix}`, 'tombstone_cascade', 'cap_github_core', '2026-01-03T00:00:00.000Z')
    source.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)').run(`scope_tombstone_${suffix}`, 'tombstone_cascade', 'cap_github_core', '2026-01-03T00:00:00.000Z')
    try {
      let entropy = 25
      const result = rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [{ rawProviderId: 'lineage-owner' }], installationKey: key, asOf: '2026-02-01T00:00:00.000Z', randomBytes: () => Buffer.alloc(32, entropy++) })
      expect(result.copiedLineageEvents).toBe(3)
      expect(target.prepare("SELECT subject_kind, subject_id, caused_by, event_kind FROM lineage_event WHERE event_kind = 'correction'").get()).toMatchObject({ subject_kind: 'scope', subject_id: seeded.scope, caused_by: seeded.scope })
      const jobId = target.prepare('SELECT job_id FROM collection_job').pluck().get() as string
      const snapshotId = target.prepare('SELECT snapshot_id FROM source_snapshot').pluck().get() as string
      expect(target.prepare("SELECT subject_kind, subject_id, caused_by FROM lineage_event WHERE subject_kind = 'job'").get()).toEqual({ subject_kind: 'job', subject_id: jobId, caused_by: snapshotId })
      expect(target.prepare("SELECT COUNT(*) FROM lineage_event WHERE event_kind = 'legacy_deletion_operation'").pluck().get()).toBe(1)
    } finally { source.close(); target.close() }
  })

  it('refuses a cross-scope lineage cause', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 26)
    const first = seedIdentity(source, 'lineage-first', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'b')
    const second = seedIdentity(source, 'lineage-second', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'c')
    source.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)').run(first.scope, 'correction', second.scope, '2026-01-02T00:00:00.000Z')
    try {
      expect(rewriteError(source, target, key, [{ rawProviderId: 'lineage-first' }, { rawProviderId: 'lineage-second' }]).code).toBe('GRAPH_REFUSED')
    } finally { source.close(); target.close() }
  })

  it('refuses conflicting slice-A compatibility rows', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 27), suffix = 'e'.repeat(64)
    source.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)').run(`scope_tombstone_${suffix}`, 'tombstone_cascade', 'cap_github_core', '2026-01-03T00:00:00.000Z')
    source.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)').run(`scope_tombstone_${suffix}`, 'tombstone_cascade', 'cap_github_core', '2026-01-04T00:00:00.000Z')
    try {
      expect(rewriteError(source, target, key).code).toBe('GRAPH_REFUSED')
      expect(target.prepare('SELECT COUNT(*) FROM lineage_event').pluck().get()).toBe(0)
    } finally { source.close(); target.close() }
  })

  it('counts unclassified non-reserved lineage without retaining it', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 27)
    seedIdentity(source, 'lineage-unclassified', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'd')
    source.prepare('INSERT INTO lineage_event (subject_id, event_kind, caused_by, occurred_at) VALUES (?, ?, ?, ?)').run('unclassified-token', 'correction', null, '2026-01-02T00:00:00.000Z')
    try {
      const result = rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [{ rawProviderId: 'lineage-unclassified' }], installationKey: key, asOf: '2026-02-01T00:00:00.000Z' })
      expect(result.omittedUnclassifiedLineageEvents).toBe(1)
      expect(target.prepare('SELECT COUNT(*) FROM lineage_event').pluck().get()).toBe(0)
    } finally { source.close(); target.close() }
  })

  it('preserves source bytes and rolls target back after a partial graph failure', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 28)
    const seeded = seedIdentity(source, 'rollback-source', key, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'e')
    const before = JSON.stringify({ identity: source.prepare('SELECT * FROM repository_identity').all(), observations: source.prepare('SELECT * FROM commit_observation').all() })
    source.prepare('INSERT INTO claim (claim_id, layer, statement_code, method_id, method_version, window_start, window_end, scope_id, schema_version, claim_id_material_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`cl_${'4'.repeat(64)}`, 'modelled', 'DELIVERY_FLOW', 'method', '1.0.0', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', seeded.scope, CLAIM_SCHEMA_VERSION, 'claim-id.v2', '2026-02-01T00:00:00.000Z')
    try {
      expect(rewriteError(source, target, key, [{ rawProviderId: 'rollback-source' }]).code).toBe('GRAPH_REFUSED')
      expect(JSON.stringify({ identity: source.prepare('SELECT * FROM repository_identity').all(), observations: source.prepare('SELECT * FROM commit_observation').all() })).toBe(before)
      expect(target.prepare('SELECT COUNT(*) FROM claim_scope').pluck().get()).toBe(0)
      expect(target.prepare('SELECT COUNT(*) FROM repository_identity').pluck().get()).toBe(0)
    } finally { source.close(); target.close() }
  })

  it.each(['extra table', 'TEMP table'] as const)('refuses a %s source object without leaking its name', (kind) => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 29)
    if (kind === 'extra table') source.exec('CREATE TABLE extra_source_table (value TEXT)')
    else source.exec('CREATE TEMP TABLE temp_shadow_table (value TEXT)')
    try {
      const error = rewriteError(source, target, key)
      expect(error.code).toBe('SOURCE_SCHEMA_REFUSED')
      expect(error.message).not.toContain('extra_source_table')
      expect(error.message).not.toContain('temp_shadow_table')
    } finally { source.close(); target.close() }
  })

  it('validates bridge coverage but copies none of it — the v3 target keeps the delete disposition', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 30)
    source.prepare('INSERT INTO v2_coverage_record (coverage_id, capability_id, scope_alias, range_start, range_end, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('bridge-valid', 'github.core', 'synthetic-independent-alias', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 'complete', 1, 1, 0, null, 0, '2026-02-01T00:00:00.000Z', 'NONE')
    try {
      rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [], installationKey: key, asOf: '2026-01-01T00:00:00.000Z' })
      // B3 decision: the v2 reader refuses v3 stores, so a preserved copy would be
      // unreadable dead weight carrying a verbatim C2 alias. Source rows are still
      // contract-validated (the refusal test below), the target stays empty, and the
      // untouched SOURCE keeps its bridge for the v2 API.
      expect(target.prepare('SELECT COUNT(*) FROM v2_coverage_record').pluck().get()).toBe(0)
      expect(source.prepare('SELECT COUNT(*) FROM v2_coverage_record').pluck().get()).toBe(1)
      expect(target.prepare('SELECT COUNT(*) FROM claim_scope').pluck().get()).toBe(0)
    } finally { source.close(); target.close() }
  })

  it('refuses malformed bridge coverage semantics opaquely', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 31)
    source.prepare('INSERT INTO v2_coverage_record (coverage_id, capability_id, scope_alias, range_start, range_end, status, expected_units, observed_units, omitted_units, saturation_reason, retryable, observed_at, limitation_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('bridge-bad', 'github.core', 'synthetic-orphan', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 'complete', 2, 1, 1, null, 0, '2026-02-01T00:00:00.000Z', 'NONE')
    try {
      const error = rewriteError(source, target, key)
      expect(error.code).toBe('SOURCE_BRIDGE_REFUSED')
      expect(error.message).toBe('SOURCE_BRIDGE_REFUSED')
      expect(error.message).not.toContain('bridge-bad')
    } finally { source.close(); target.close() }
  })

  it('returns only the closed result contract and opaque errors', () => {
    const source = sourceDb(), target = new Database(':memory:'), key = Buffer.alloc(32, 31)
    try {
      const result = rewriteStorageV3Shadow({ sourceDb: source, targetDb: target, identityBindings: [], installationKey: key, asOf: '2026-01-01T00:00:00.000Z' })
      expect(Object.keys(result).sort()).toEqual(['completeB1b', 'copiedClaims', 'copiedLineageEvents', 'copiedScopes', 'mintedIdentifiers', 'omittedExpiredIdentities', 'omittedUnclassifiedLineageEvents', 'schemaVersion', 'selectable', 'status'].sort())
      // mintedIdentifiers is the equivalence-proof seam: content-free C1 random keys
      // only, frozen, and the REST of the result still carries no identifier material.
      expect(Object.isFrozen(result.mintedIdentifiers)).toBe(true)
      for (const minted of result.mintedIdentifiers) {
        expect(minted).toMatch(/^(?:scope-|cl_|job-|snap-|ckpt-|cov-|ev-|art-|op-|del-|obs-|pr-|event-)[0-9a-f]{64}$/)
      }
      const { mintedIdentifiers: _minted, ...counts } = result
      expect(JSON.stringify(counts)).not.toMatch(/provider|scope-[0-9a-f]{64}/)
    } finally { source.close(); target.close() }
  })
})
