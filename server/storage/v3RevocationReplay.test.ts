import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  createStorageV3ArtifactRoot,
  openStorageV3ArtifactRoot,
  registerSelectedStorageV3Artifact,
  storageV3MaintenanceStatus,
  STORAGE_V3_ARTIFACT_LOCATORS,
} from './v3ArtifactCatalogue.js'
import { v3BackupTestSeams } from './v3Backup.js'
import { readStorageV3DeletionLineage } from './v3Deletion.js'
import {
  STORAGE_V3_REVOCATION_REPLAY_NAMES,
  StorageV3RevocationReplayError,
  assertStorageV3RevocationReplayApplied,
  resumeStorageV3RevocationReplay,
  v3RevocationReplayTestSeams,
  verifyStorageV3RevocationReplay,
} from './v3RevocationReplay.js'
import {
  readStorageV3MigrationSelection,
  recordStorageV3MigrationSelectionWithInitialization,
  storageV3MigrationRootBinding,
  v3SelectionReceiptTestSeams,
  type StorageV3MigrationSelection,
} from './v3SelectionReceipt.js'
import { installStorageV3ShadowSchema } from './v3ShadowSchema.js'
import { openSelectedStorageV3Store } from './v3StoreFiles.js'
import {
  taskInstallationKeyTestSeams,
  type TaskInstallationKeyHandle,
} from './taskInstallationKey.js'
import { withStorageV3WriterLease } from './v3WriterLease.js'

const SCOPE_A = `scope-${'a'.repeat(64)}`
const SCOPE_B = `scope-${'b'.repeat(64)}`
const BACKUP = `art-${'4'.repeat(64)}`
const BACKUP_AT = '2026-08-06T12:35:05Z'
const SUCCESS_AT = '2026-08-06T12:40:00.000Z'
const DELETE_AT = '2026-08-06T13:00:00.000Z'

type Fixture = Readonly<{
  workspaceRoot: string
  root: string
  taskId: string
  key: TaskInstallationKeyHandle
  selection: StorageV3MigrationSelection
  close(): void
}>

async function fixture(claimCount = 0): Promise<Fixture> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'developer-lens-life03-revocation-'))
  const taskId = 'invented-repository-label'
  const root = join(workspaceRoot, '.developer-lens', 'activation', taskId)
  mkdirSync(root, { recursive: true })
  const rootHandle = createStorageV3ArtifactRoot(root)
  const db = new Database(join(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore))
  try {
    installStorageV3ShadowSchema(db)
    db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_A)
    db.prepare('INSERT INTO claim_scope (scope_id) VALUES (?)').run(SCOPE_B)
    db.prepare(`INSERT INTO commit_observation (
      scope_id, observation_id, sha, occurred_at, source, c2_expires_at,
      additions, deletions, files, parent_count, feature_type, is_revert, is_fixup, message_length
    ) VALUES (?, ?, NULL, NULL, NULL, NULL, 5, 2, 1, 1, 'docs', 0, 0, 12)`).run(
      SCOPE_A,
      `obs-${'1'.repeat(64)}`,
    )
    if (!Number.isSafeInteger(claimCount) || claimCount < 0) throw new Error('invalid invented claim count')
    if (claimCount > 0) db.prepare(`WITH RECURSIVE invented_claim(value) AS (
      VALUES(0) UNION ALL SELECT value + 1 FROM invented_claim WHERE value + 1 < ?
    ) INSERT INTO claim (
      scope_id, claim_id, layer, statement_code, method_id, method_version,
      window_start, window_end, schema_version, claim_id_material_version, created_at
    ) SELECT ?, 'cl_' || printf('%064x', value), 'modelled', 'DELIVERY_FLOW',
      'invented-method', '1.0.0', '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z', '1.0.0', 'claim-id.v3',
      '2026-02-01T00:00:00.000Z' FROM invented_claim`).run(claimCount, SCOPE_A)
    const selectedArtifactId = registerSelectedStorageV3Artifact(db, rootHandle, () => Buffer.alloc(32, 3))
    const key = await taskInstallationKeyTestSeams.setupWithRandomBytes(
      { workspaceRoot, taskId },
      () => Buffer.alloc(32, 7),
    )
    const backup = await v3BackupTestSeams.createWithDirectorySynchronizer({
      db,
      root: rootHandle,
      backupAt: BACKUP_AT,
      artifactId: BACKUP,
      ownerScopeIds: [SCOPE_A, SCOPE_B],
      installationKey: key,
    }, () => {})
    const reportInput = Object.freeze({
      legacySourceId: `legacy-${'5'.repeat(64)}`,
      selectedArtifactId,
      backupArtifactId: backup.artifactId,
      backupAt: BACKUP_AT,
      taskId,
      taskFingerprint: key.fingerprint,
      rootBinding: storageV3MigrationRootBinding(root),
    })
    const selection = withStorageV3WriterLease(rootHandle, (lease) => {
      const recorded = recordStorageV3MigrationSelectionWithInitialization(db, {
        ...reportInput,
        successReportProof: v3SelectionReceiptTestSeams.issueSuccessReportAt(
          reportInput,
          SUCCESS_AT,
        ),
      }, (pendingSelection, initializationGrant) => {
        v3RevocationReplayTestSeams.ensureWithDirectorySynchronizer(
          rootHandle,
          key,
          pendingSelection,
          initializationGrant,
          lease,
          () => {},
        )
      })
      v3RevocationReplayTestSeams.commitInitializationWithDirectorySynchronizer(
        rootHandle,
        key,
        recorded.selection,
        lease,
        () => {},
      )
      return recorded.selection
    })
    db.close()
    return Object.freeze({
      workspaceRoot,
      root,
      taskId,
      key,
      selection,
      close: () => rmSync(workspaceRoot, { recursive: true, force: true }),
    })
  } catch (error) {
    if (db.open) db.close()
    rmSync(workspaceRoot, { recursive: true, force: true })
    throw error
  }
}

function deleteScope(
  fx: Fixture,
  failAfterStage?: Parameters<typeof v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer>[2],
  subjectsPerChunk?: Parameters<typeof v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer>[3],
) {
  return v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
    directory: fx.root,
    installationKey: fx.key,
    scopeId: SCOPE_A,
    asOf: DELETE_AT,
    randomBytes: () => Buffer.alloc(32, 9),
  }, () => {}, failAfterStage, subjectsPerChunk)
}

describe('LIFE-03 external revocation replay', { timeout: 120_000 }, () => {
  it('publishes content-free intent before deletion and replays exactly', async () => {
    const fx = await fixture()
    try {
      const first = deleteScope(fx)
      expect(first).toMatchObject({ replayEntries: 1, maintenance: 'complete' })
      const files = readdirSync(fx.root)
        .filter((name) => name.startsWith(STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix))
        .sort()
      expect(files).toEqual([
        STORAGE_V3_REVOCATION_REPLAY_NAMES.anchor,
        'revocation-replay-v1-00000001.json',
        STORAGE_V3_REVOCATION_REPLAY_NAMES.head,
      ])
      const serialized = files.map((name) => readFileSync(join(fx.root, name), 'utf8')).join('\n')
      expect(serialized).not.toContain(fx.taskId)
      expect(serialized).not.toContain('repository-label')
      expect(serialized).not.toContain(fx.root)

      const selected = openSelectedStorageV3Store(fx.root)
      try {
        expect(selected.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A)).toBeUndefined()
        expect(selected.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_B)).toBeDefined()
        expect(selected.prepare('SELECT 1 FROM commit_observation WHERE scope_id = ?').get(SCOPE_A)).toBeUndefined()
        const lineage = readStorageV3DeletionLineage(selected)
        expect(lineage).toContainEqual(expect.objectContaining({
          subjectKind: 'scope',
          subjectId: SCOPE_A,
          eventKind: 'tombstone_cascade',
          eventWeek: '2026-W32',
        }))
        withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => {
          const state = verifyStorageV3RevocationReplay(
            openStorageV3ArtifactRoot(fx.root),
            fx.key,
            fx.selection,
            lease,
          )
          assertStorageV3RevocationReplayApplied(selected, state)
        })
      } finally { selected.close() }

      const replay = deleteScope(fx)
      expect(replay.deletion.status).toBe('replayed')
      expect(readdirSync(fx.root).filter((name) => name.startsWith(
        STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix,
      ))).toHaveLength(3)
    } finally { fx.close() }
  })

  it('publishes bounded chunks as one logical revocation entry', async () => {
    const fx = await fixture()
    try {
      const deleted = deleteScope(fx, undefined, 1)
      expect(deleted).toMatchObject({ replayEntries: 1, maintenance: 'complete' })
      const records = readdirSync(fx.root)
        .filter((name) => /^revocation-replay-v1-\d{8}\.json$/.test(name))
        .sort()
      expect(records).toEqual([
        STORAGE_V3_REVOCATION_REPLAY_NAMES.anchor,
        'revocation-replay-v1-00000001.json',
        'revocation-replay-v1-00000002.json',
      ])
      const chunks = records.slice(1).map((name) => JSON.parse(
        readFileSync(join(fx.root, name), 'utf8'),
      ) as Record<string, unknown>)
      expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1])
      expect(chunks.map((chunk) => chunk.chunkCount)).toEqual([2, 2])
      expect(chunks.map((chunk) => chunk.subjectsPerChunk)).toEqual([1, 1])
      expect(chunks.map((chunk) => chunk.subjectCount)).toEqual([2, 2])
      expect(chunks[0]?.subjectsSha256).toBe(chunks[1]?.subjectsSha256)

      withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => {
        const state = verifyStorageV3RevocationReplay(
          openStorageV3ArtifactRoot(fx.root),
          fx.key,
          fx.selection,
          lease,
        )
        expect(state.entries).toHaveLength(1)
        expect(state.entries[0]?.subjects).toHaveLength(2)
      })
    } finally { fx.close() }
  })

  it('refuses a head-matched partial group to readers and resumes its exact remaining chunks', async () => {
    const fx = await fixture()
    try {
      let headReplacements = 0
      expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: fx.root,
        installationKey: fx.key,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 9),
      }, (_root, stage) => {
        if (stage === 'headReplace' && ++headReplacements === 1) {
          throw new Error('invented partial-group interruption')
        }
      }, undefined, 1)).toThrow('invented partial-group interruption')

      expect(readdirSync(fx.root)).toContain('revocation-replay-v1-00000001.json')
      expect(readdirSync(fx.root)).not.toContain('revocation-replay-v1-00000002.json')
      expect(() => withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => {
        verifyStorageV3RevocationReplay(
          openStorageV3ArtifactRoot(fx.root),
          fx.key,
          fx.selection,
          lease,
        )
      })).toThrowError(new StorageV3RevocationReplayError())

      expect(v3RevocationReplayTestSeams.resumeWithDirectorySynchronizer(
        fx.root,
        fx.key,
        () => {},
      )).toBe(1)
      expect(readdirSync(fx.root)).toContain('revocation-replay-v1-00000002.json')
      const selected = openSelectedStorageV3Store(fx.root)
      try {
        expect(selected.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
          .toBeUndefined()
      } finally { selected.close() }
    } finally { fx.close() }
  })

  it.each([
    { label: 'middle record link', stage: 'finalLink' as const, occurrence: 2 },
    { label: 'middle durable head', stage: 'headReplace' as const, occurrence: 2 },
    { label: 'final durable head', stage: 'headReplace' as const, occurrence: 3 },
  ])('resumes a three-chunk group after interruption at $label', async ({ stage, occurrence }) => {
    const fx = await fixture(1)
    try {
      let seen = 0
      expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: fx.root,
        installationKey: fx.key,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 9),
      }, (_root, current) => {
        if (current === stage && ++seen === occurrence) {
          throw new Error(`invented three-chunk ${stage} interruption`)
        }
      }, undefined, 1)).toThrow(`invented three-chunk ${stage} interruption`)

      expect(v3RevocationReplayTestSeams.resumeWithDirectorySynchronizer(
        fx.root,
        fx.key,
        () => {},
      )).toBe(1)
      const head = JSON.parse(readFileSync(
        join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head),
        'utf8',
      )) as Record<string, unknown>
      expect(head.sequence).toBe(3)
      const selected = openSelectedStorageV3Store(fx.root)
      try {
        expect(selected.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
          .toBeUndefined()
      } finally { selected.close() }
    } finally { fx.close() }
  })

  it('preserves a partial group and live SQL when exact replanning changes', async () => {
    const fx = await fixture(1)
    try {
      let interrupted = false
      expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: fx.root,
        installationKey: fx.key,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 9),
      }, (_root, stage) => {
        if (stage === 'headReplace' && !interrupted) {
          interrupted = true
          throw new Error('invented partial exact-plan interruption')
        }
      }, undefined, 1)).toThrow('invented partial exact-plan interruption')
      const familyBefore = new Map(readdirSync(fx.root)
        .filter((name) => name.startsWith(STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix))
        .map((name) => [name, readFileSync(join(fx.root, name))]))

      const selected = openSelectedStorageV3Store(fx.root)
      const replacementClaim = `cl_${'f'.repeat(64)}`
      try {
        selected.prepare(`INSERT INTO claim (
          scope_id, claim_id, layer, statement_code, method_id, method_version,
          window_start, window_end, schema_version, claim_id_material_version, created_at
        ) VALUES (?, ?, 'modelled', 'DELIVERY_FLOW', 'invented-method', '1.0.0',
          '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z',
          '1.0.0', 'claim-id.v3', '2026-02-01T00:00:00.000Z')`)
          .run(SCOPE_A, replacementClaim)
      } finally { selected.close() }

      expect(() => v3RevocationReplayTestSeams.resumeWithDirectorySynchronizer(
        fx.root,
        fx.key,
        () => {},
      )).toThrowError(new StorageV3RevocationReplayError())
      expect(new Map(readdirSync(fx.root)
        .filter((name) => name.startsWith(STORAGE_V3_REVOCATION_REPLAY_NAMES.prefix))
        .map((name) => [name, readFileSync(join(fx.root, name))])))
        .toEqual(familyBefore)
      const preserved = openSelectedStorageV3Store(fx.root)
      try {
        expect(preserved.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
          .toBeDefined()
        expect(preserved.prepare('SELECT 1 FROM claim WHERE claim_id = ?').get(replacementClaim))
          .toBeDefined()
      } finally { preserved.close() }
    } finally { fx.close() }
  })

  it('refuses a missing middle physical chunk without touching the live scope', async () => {
    const fx = await fixture(1)
    try {
      let heads = 0
      expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: fx.root,
        installationKey: fx.key,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 9),
      }, (_root, stage) => {
        if (stage === 'headReplace' && ++heads === 3) {
          throw new Error('invented pre-SQL complete-group interruption')
        }
      }, undefined, 1)).toThrow('invented pre-SQL complete-group interruption')
      const headPath = join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head)
      const headBytes = readFileSync(headPath)
      rmSync(join(fx.root, 'revocation-replay-v1-00000002.json'))

      expect(() => v3RevocationReplayTestSeams.resumeWithDirectorySynchronizer(
        fx.root,
        fx.key,
        () => {},
      )).toThrowError(new StorageV3RevocationReplayError())
      expect(readFileSync(headPath)).toEqual(headBytes)
      const selected = openSelectedStorageV3Store(fx.root)
      try {
        expect(selected.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
          .toBeDefined()
      } finally { selected.close() }
    } finally { fx.close() }
  })

  it('durably publishes more than 100,000 invented subjects before touching SQL', async () => {
    const fx = await fixture(100_000)
    try {
      expect(() => deleteScope(fx, (stage) => {
        if (stage === 'intentDurable') throw new Error('invented large-scope pre-SQL stop')
      })).toThrow('invented large-scope pre-SQL stop')
      const records = readdirSync(fx.root)
        .filter((name) => /^revocation-replay-v1-\d{8}\.json$/.test(name))
        .sort()
      expect(records).toHaveLength(26)
      for (const name of records) {
        expect(statSync(join(fx.root, name)).size).toBeLessThanOrEqual(16 * 1024 * 1024)
      }
      const head = JSON.parse(readFileSync(
        join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head),
        'utf8',
      )) as Record<string, unknown>
      expect(head.sequence).toBe(25)

      const state = withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => (
        verifyStorageV3RevocationReplay(
          openStorageV3ArtifactRoot(fx.root),
          fx.key,
          fx.selection,
          lease,
        )
      ))
      expect(state.entries).toHaveLength(1)
      expect(state.entries[0]?.subjects.length).toBeGreaterThan(100_000)

      const selected = openSelectedStorageV3Store(fx.root)
      try {
        expect(selected.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
          .toBeDefined()
        expect(selected.prepare(
          'SELECT COUNT(*) FROM lineage_event WHERE operation_id = ?',
        ).pluck().get(state.entries[0]!.operationId)).toBe(0)
      } finally { selected.close() }
    } finally { fx.close() }
  })

  it('completes SQL deletion across the production chunk boundary', async () => {
    const fx = await fixture(4_096)
    try {
      expect(deleteScope(fx)).toMatchObject({ replayEntries: 1, maintenance: 'complete' })
      const records = readdirSync(fx.root)
        .filter((name) => /^revocation-replay-v1-\d{8}\.json$/.test(name))
        .sort()
      expect(records).toHaveLength(3)
      const state = withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => (
        verifyStorageV3RevocationReplay(
          openStorageV3ArtifactRoot(fx.root),
          fx.key,
          fx.selection,
          lease,
        )
      ))
      expect(state.entries).toHaveLength(1)
      expect(state.entries[0]?.subjects.length).toBeGreaterThan(4_096)
      const selected = openSelectedStorageV3Store(fx.root)
      try {
        expect(selected.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
          .toBeUndefined()
        expect(selected.prepare(
          'SELECT COUNT(*) FROM lineage_event WHERE operation_id = ?',
        ).pluck().get(state.entries[0]!.operationId)).toBe(state.entries[0]!.subjects.length)
      } finally { selected.close() }
    } finally { fx.close() }
  })

  it('keeps physical head sequence distinct from logical entry count', async () => {
    const fx = await fixture()
    try {
      expect(deleteScope(fx, undefined, 1).maintenance).toBe('complete')
      expect(v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: fx.root,
        installationKey: fx.key,
        scopeId: SCOPE_B,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 8),
      }, () => {})).toMatchObject({ replayEntries: 2, maintenance: 'complete' })
      const state = withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => (
        verifyStorageV3RevocationReplay(
          openStorageV3ArtifactRoot(fx.root),
          fx.key,
          fx.selection,
          lease,
        )
      ))
      const head = JSON.parse(readFileSync(
        join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head),
        'utf8',
      )) as Record<string, unknown>
      expect(state.entries).toHaveLength(2)
      expect(head.sequence).toBe(3)
      expect(state.entries.map((entry) => entry.sequence)).toEqual([2, 3])
    } finally { fx.close() }
  })

  it('refuses two deletion event kinds for the same applied subject', async () => {
    const fx = await fixture()
    try {
      expect(deleteScope(fx).maintenance).toBe('complete')
      const state = withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => (
        verifyStorageV3RevocationReplay(
          openStorageV3ArtifactRoot(fx.root),
          fx.key,
          fx.selection,
          lease,
        )
      ))
      const selected = openSelectedStorageV3Store(fx.root)
      try {
        selected.prepare(`INSERT INTO lineage_event (
          scope_id, subject_kind, subject_id, operation_id, capability_id,
          caused_by, event_kind, event_week
        ) VALUES (NULL, 'scope', ?, ?, 'github.core', NULL, 'index_deleted', '2026-W32')`)
          .run(SCOPE_A, `del-${'b'.repeat(64)}`)
        expect(() => assertStorageV3RevocationReplayApplied(selected, state))
          .toThrowError(new StorageV3RevocationReplayError())
      } finally { selected.close() }
    } finally { fx.close() }
  })

  it('refuses hidden scope-unbound deletion lineage for an applied non-scope subject', async () => {
    const fx = await fixture()
    try {
      expect(deleteScope(fx).maintenance).toBe('complete')
      const state = withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => (
        verifyStorageV3RevocationReplay(
          openStorageV3ArtifactRoot(fx.root),
          fx.key,
          fx.selection,
          lease,
        )
      ))
      const subject = state.entries[0]?.subjects.find((candidate) => candidate.subjectKind !== 'scope')
      expect(subject).toBeDefined()
      const selected = openSelectedStorageV3Store(fx.root)
      try {
        selected.prepare(`INSERT INTO lineage_event (
          scope_id, subject_kind, subject_id, operation_id, capability_id,
          caused_by, event_kind, event_week
        ) VALUES (NULL, ?, ?, ?, 'github.core', NULL, ?, '2026-W31')`)
          .run(subject!.subjectKind, subject!.subjectId, `del-${'c'.repeat(64)}`, subject!.eventKind)
        expect(() => assertStorageV3RevocationReplayApplied(selected, state))
          .toThrowError(new StorageV3RevocationReplayError())
      } finally { selected.close() }
    } finally { fx.close() }
  })

  it('resumes a durable intent after interruption before SQL deletion', async () => {
    const fx = await fixture()
    try {
      expect(() => deleteScope(fx, (stage) => {
        if (stage === 'intentDurable') throw new Error('invented process crash')
      })).toThrow('invented process crash')
      const before = openSelectedStorageV3Store(fx.root)
      expect(before.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A)).toBeDefined()
      before.close()

      expect(resumeStorageV3RevocationReplay(fx.root, fx.key)).toBe(1)
      const after = openSelectedStorageV3Store(fx.root)
      try {
        expect(after.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A)).toBeUndefined()
        expect(after.prepare(
          "SELECT 1 FROM lineage_event WHERE subject_kind = 'scope' AND subject_id = ? AND event_kind = 'tombstone_cascade'",
        ).get(SCOPE_A)).toBeDefined()
      } finally { after.close() }
    } finally { fx.close() }
  })

  it('never adopts a previously committed empty family as a new initialization', async () => {
    const fx = await fixture()
    const second = new Database(':memory:')
    try {
      installStorageV3ShadowSchema(second)
      const headPath = join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head)
      const headBytes = readFileSync(headPath)
      const reportInput = Object.freeze({
        legacySourceId: fx.selection.legacySourceId,
        selectedArtifactId: fx.selection.selectedArtifactId,
        backupArtifactId: fx.selection.backupArtifactId,
        backupAt: BACKUP_AT,
        taskId: fx.key.taskId,
        taskFingerprint: fx.key.fingerprint,
        rootBinding: storageV3MigrationRootBinding(fx.root),
      })
      expect(() => withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => {
        recordStorageV3MigrationSelectionWithInitialization(second, {
          ...reportInput,
          successReportProof: v3SelectionReceiptTestSeams.issueSuccessReportAt(
            reportInput,
            '2026-08-06T14:00:00.000Z',
          ),
        }, (selection, initializationGrant) => {
          v3RevocationReplayTestSeams.ensureWithDirectorySynchronizer(
            openStorageV3ArtifactRoot(fx.root),
            fx.key,
            selection,
            initializationGrant,
            lease,
            () => {},
          )
        })
      })).toThrowError(new StorageV3RevocationReplayError())
      expect(readStorageV3MigrationSelection(second)).toBeUndefined()
      expect(readFileSync(headPath)).toEqual(headBytes)
    } finally {
      second.close()
      fx.close()
    }
  })

  it('completes pending maintenance after interruption following SQL deletion', async () => {
    const fx = await fixture()
    try {
      expect(() => deleteScope(fx, (stage) => {
        if (stage === 'deletionCommitted') throw new Error('invented post-commit crash')
      })).toThrow('invented post-commit crash')

      const pending = openSelectedStorageV3Store(fx.root)
      try {
        expect(pending.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
          .toBeUndefined()
        expect(storageV3MaintenanceStatus(pending)).toBe('pending')
        expect(pending.prepare(
          "SELECT state FROM app_artifact WHERE kind = 'migration_backup_v1'",
        ).pluck().get()).toBe('pending')
      } finally { pending.close() }

      expect(resumeStorageV3RevocationReplay(fx.root, fx.key)).toBe(0)
      const recovered = openSelectedStorageV3Store(fx.root)
      try {
        expect(storageV3MaintenanceStatus(recovered)).toBe('complete')
        expect(recovered.prepare(
          "SELECT COUNT(*) FROM app_artifact WHERE kind = 'migration_backup_v1'",
        ).pluck().get()).toBe(0)
      } finally { recovered.close() }
      expect(resumeStorageV3RevocationReplay(fx.root, fx.key)).toBe(0)
    } finally { fx.close() }
  })

  it('refuses a truncated tail against the mandatory durable head', async () => {
    const fx = await fixture()
    try {
      expect(deleteScope(fx).maintenance).toBe('complete')
      const headPath = join(fx.root, STORAGE_V3_REVOCATION_REPLAY_NAMES.head)
      const headBytes = readFileSync(headPath)
      rmSync(join(fx.root, 'revocation-replay-v1-00000001.json'))

      expect(() => withStorageV3WriterLease(openStorageV3ArtifactRoot(fx.root), (lease) => {
        verifyStorageV3RevocationReplay(
          openStorageV3ArtifactRoot(fx.root),
          fx.key,
          fx.selection,
          lease,
        )
      })).toThrowError(new StorageV3RevocationReplayError())
      expect(() => resumeStorageV3RevocationReplay(fx.root, fx.key))
        .toThrowError(new StorageV3RevocationReplayError())
      expect(readFileSync(headPath)).toEqual(headBytes)
    } finally { fx.close() }
  })

  it.each(['headTempDurable', 'headReplace'] as const)(
    'recovers an exact event and head after interruption at %s',
    async (interruptedStage) => {
      const fx = await fixture()
      try {
        let interrupted = false
        expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
          directory: fx.root,
          installationKey: fx.key,
          scopeId: SCOPE_A,
          asOf: DELETE_AT,
          randomBytes: () => Buffer.alloc(32, 9),
        }, (_root, stage) => {
          if (stage === interruptedStage && !interrupted) {
            interrupted = true
            throw new Error(`invented ${interruptedStage} interruption`)
          }
        })).toThrow(`invented ${interruptedStage} interruption`)

        expect(v3RevocationReplayTestSeams.resumeWithDirectorySynchronizer(
          fx.root,
          fx.key,
          () => {},
        )).toBe(1)
        const recovered = openSelectedStorageV3Store(fx.root)
        try {
          expect(recovered.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(SCOPE_A))
            .toBeUndefined()
        } finally { recovered.close() }
        expect(existsSync(join(fx.root, `${STORAGE_V3_REVOCATION_REPLAY_NAMES.head}.tmp`))).toBe(false)
      } finally { fx.close() }
    },
  )

  it('recovers the exact hard-link pair and refuses foreign reserved names', async () => {
    const fx = await fixture()
    try {
      let interrupted = false
      expect(() => v3RevocationReplayTestSeams.deleteWithDirectorySynchronizer({
        directory: fx.root,
        installationKey: fx.key,
        scopeId: SCOPE_A,
        asOf: DELETE_AT,
        randomBytes: () => Buffer.alloc(32, 9),
      }, (_root, stage) => {
        if (stage === 'finalLink' && !interrupted) {
          interrupted = true
          throw new Error('invented final-link interruption')
        }
      })).toThrow('invented final-link interruption')
      expect(existsSync(join(fx.root, 'revocation-replay-v1-00000001.json.tmp'))).toBe(true)
      expect(deleteScope(fx).maintenance).toBe('complete')
      expect(existsSync(join(fx.root, 'revocation-replay-v1-00000001.json.tmp'))).toBe(false)

      const poison = join(fx.root, 'Revocation-replay-v1-00000002.json')
      writeFileSync(poison, 'foreign')
      const bytes = readFileSync(poison)
      expect(() => resumeStorageV3RevocationReplay(fx.root, fx.key))
        .toThrowError(new StorageV3RevocationReplayError())
      expect(readFileSync(poison)).toEqual(bytes)
    } finally { fx.close() }
  })
})
