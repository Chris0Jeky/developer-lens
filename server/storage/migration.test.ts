import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { openStorageDatabase, runStorageChecks } from './database.js'
import { importV1Json, parseV1Dataset, selectStorageReader, storageV2Enabled } from './migrateV1.js'
import { SQLITE_APPLICATION_ID, SQLITE_USER_VERSION } from './schema.js'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function fixturePaths(): Promise<{ directory: string; source: string; target: string; sourceBytes: Buffer }> {
  const directory = await mkdtemp(join(tmpdir(), 'developer-lens-storage-'))
  tempDirectories.push(directory)
  const source = join(directory, 'invented-v1.json')
  const target = join(directory, 'storage-v2.sqlite')
  const sourceBytes = Buffer.from(JSON.stringify(inventedV1Fixture(), null, 2), 'utf8')
  await writeFile(source, sourceBytes)
  return { directory, source, target, sourceBytes }
}

function inventedV1Fixture() {
  return {
    schemaVersion: 1,
    range: '6m',
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-06-30T23:59:59.999Z',
    collectedAt: '2026-07-01T00:00:00.000Z',
    subject: { login: 'invented-person', name: 'Invented Person', avatarUrl: 'https://invalid.example/avatar.png' },
    contributionCalendar: [{ date: '2026-01-02', count: 1 }],
    contributionTotal: 1,
    restrictedContributions: 0,
    repositories: [{ id: 'repo-provider-101', nameWithOwner: 'invented-org/invented-repository', name: 'invented-repository', url: 'https://invalid.example/repository', description: 'Invented repository description', isPrivate: true, isArchived: false, isFork: false, languages: [{ name: 'TypeScript', color: '#3178c6', size: 10 }], topics: ['invented-topic'] }],
    commits: [{ sha: 'invented-sha-101', repository: 'invented-org/invented-repository', occurredAt: '2026-01-02T12:00:00.000Z', source: 'github', additions: 3, deletions: 1, files: 1, parentCount: 1, features: { type: 'feat', isRevert: false, isFixup: false, subjectLength: 38 } }],
    lineChanges: { additions: 3, deletions: 1, commits: 1, repositories: 1 },
    commitDaysByRepository: [{ repository: 'invented-org/invented-repository', date: '2026-01-02', count: 1 }],
    pullRequests: [{ id: 'pr-provider-101', repository: 'invented-org/invented-repository', number: 17, title: 'Invented title that must not persist', url: 'https://invalid.example/pull/17', createdAt: '2026-01-02T13:00:00.000Z', mergedAt: '2026-01-03T13:00:00.000Z', state: 'MERGED', isDraft: false, additions: 3, deletions: 1, changedFiles: 1, comments: 2, reviews: 1 }],
    reviews: [{ id: 'review-event-101', repository: 'invented-org/invented-repository', occurredAt: '2026-01-02T15:00:00.000Z' }],
    issues: [{ id: 'issue-event-101', repository: 'invented-org/invented-repository', occurredAt: '2026-01-02T16:00:00.000Z' }],
    coverage: [
      { id: 'github-core', label: 'Invented coverage label', status: 'complete', detail: 'Invented coverage prose', itemCount: 1 },
      { id: 'local-git', label: 'Invented local coverage label', status: 'partial', detail: 'Invented local coverage prose', itemCount: 2 },
    ],
    warnings: ['Invented warning prose'],
  }
}

function databaseDigest(path: string): string {
  const db = openStorageDatabase(path)
  const rows = [
    'import_run',
    'repository_identity',
    'commit_observation',
    'pull_request_fact',
    'coverage_observation',
    'dated_event_observation',
  ].map((table) => {
    const order = table === 'commit_observation' ? 'repository_provider_id, sha' : '1'
    return db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all()
  })
  db.close()
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex')
}

describe('v1 to SQLite v2 synthetic migration proof', () => {
  it('keeps storage disabled unless the exact flag is supplied', async () => {
    const { source, target, sourceBytes } = await fixturePaths()

    expect(storageV2Enabled(undefined)).toBe(false)
    expect(storageV2Enabled(false)).toBe(false)
    expect(storageV2Enabled('true')).toBe(false)
    expect(storageV2Enabled('1')).toBe(true)
    const selected = await selectStorageReader({ sourcePath: source, targetPath: target, enabled: false })

    expect(selected).toEqual({ reader: 'legacy-json', code: 'storage-disabled' })
    await expect(readFile(source)).resolves.toEqual(sourceBytes)
    expect(existsSync(target)).toBe(false)
  })

  it('imports a strict invented v1 fixture with integrity and FK checks', async () => {
    const { source, target, sourceBytes } = await fixturePaths()
    const selected = await selectStorageReader({ sourcePath: source, targetPath: target, enabled: true })
    const db = openStorageDatabase(target)
    const checks = runStorageChecks(db)
    const schema = db.prepare("SELECT group_concat(sql, ' ') FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().get() as string
    const values = JSON.stringify([
      ...db.prepare('SELECT * FROM repository_identity').all(),
      ...db.prepare('SELECT * FROM pull_request_fact').all(),
      ...db.prepare('SELECT * FROM commit_observation').all(),
      ...db.prepare('SELECT * FROM coverage_observation').all(),
    ])
    const applicationId = db.prepare('PRAGMA application_id').pluck().get()
    const userVersion = db.prepare('PRAGMA user_version').pluck().get()
    const coverage = db.prepare('SELECT capability_id, status, limitation_code, observed_units FROM coverage_observation ORDER BY capability_id').all()
    db.close()

    expect(selected.reader).toBe('sqlite-v2')
    expect(checks).toEqual({ integrity: 'ok', quick: 'ok', foreignKeys: [] })
    expect(applicationId).toBe(SQLITE_APPLICATION_ID)
    expect(userVersion).toBe(SQLITE_USER_VERSION)
    expect(schema).toContain('STRICT')
    expect(schema).not.toMatch(/nameWithOwner|title|url|subject|warning|description|avatar|detail/i)
    expect(values).not.toContain('invented-org/invented-repository')
    expect(values).not.toContain('Invented title that must not persist')
    expect(values).not.toContain('https://invalid.example/pull/17')
    expect(coverage).toEqual([
      { capability_id: 'cap.local.git', status: 'censored', limitation_code: 'V1_PARTIAL_COVERAGE', observed_units: 2 },
      { capability_id: 'github.core', status: 'censored', limitation_code: 'V1_COMPLETENESS_UNVERIFIED', observed_units: 1 },
    ])
    await expect(readFile(source)).resolves.toEqual(sourceBytes)
  })

  it('is idempotent on replay with the same canonical checksum and row counts', async () => {
    const { source, target, sourceBytes } = await fixturePaths()
    const first = await importV1Json({ sourcePath: source, targetPath: target })
    const firstDigest = databaseDigest(target)
    const second = await importV1Json({ sourcePath: source, targetPath: target })
    const secondDigest = databaseDigest(target)
    const db = openStorageDatabase(target)
    const rowCounts = [
      'import_run',
      'repository_identity',
      'commit_observation',
      'pull_request_fact',
      'coverage_observation',
      'dated_event_observation',
    ].map((table) => Number(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()))
    db.close()

    expect(second.checksum).toBe(first.checksum)
    expect(secondDigest).toBe(firstDigest)
    expect(second.foreignKeyViolations).toBe(0)
    expect(rowCounts).toEqual([1, 1, 1, 1, 2, 2])
    await expect(readFile(source)).resolves.toEqual(sourceBytes)
  })

  it('rejects unknown v1 fields and keeps the fallback non-sensitive', async () => {
    const { source, target, sourceBytes } = await fixturePaths()
    const invalid = { ...inventedV1Fixture(), unrecognized: 'not allowed' }
    await writeFile(source, JSON.stringify(invalid))

    expect(() => parseV1Dataset(JSON.stringify(invalid))).toThrow('V1_VALIDATION_FAILED')
    await expect(selectStorageReader({ sourcePath: source, targetPath: target, enabled: true })).resolves.toEqual({ reader: 'legacy-json', code: 'v1-validation-failed' })
    expect(existsSync(target)).toBe(false)
    expect(await readFile(source, 'utf8')).toBe(JSON.stringify(invalid))
    expect(sourceBytes).not.toEqual(await readFile(source))
  })

  it('refuses a zero-header database that already owns user tables without mutating it', async () => {
    const { source, target, sourceBytes } = await fixturePaths()
    const unrelated = new Database(target)
    unrelated.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY, value TEXT NOT NULL)')
    unrelated.prepare('INSERT INTO unrelated (value) VALUES (?)').run('sentinel')
    unrelated.close()

    await expect(selectStorageReader({ sourcePath: source, targetPath: target, enabled: true })).resolves.toEqual({ reader: 'legacy-json', code: 'storage-target-mismatch' })
    const after = new Database(target)
    const tables = after.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").pluck().all()
    expect(after.prepare('PRAGMA application_id').pluck().get()).toBe(0)
    expect(after.prepare('PRAGMA user_version').pluck().get()).toBe(0)
    expect(tables).toEqual(['unrelated'])
    expect(after.prepare('SELECT value FROM unrelated').pluck().get()).toBe('sentinel')
    after.close()
    await expect(readFile(source)).resolves.toEqual(sourceBytes)
  })

  it('refuses partial application and user-version tuples without repairing either header', async () => {
    const { directory, source, sourceBytes } = await fixturePaths()
    const partialTargets = [
      { applicationId: SQLITE_APPLICATION_ID, userVersion: 0 },
      { applicationId: 0, userVersion: SQLITE_USER_VERSION },
    ]

    for (const [index, partial] of partialTargets.entries()) {
      const target = join(directory, `partial-${index}.sqlite`)
      const seeded = new Database(target)
      seeded.pragma(`application_id = ${partial.applicationId}`)
      seeded.pragma(`user_version = ${partial.userVersion}`)
      seeded.close()

      await expect(selectStorageReader({ sourcePath: source, targetPath: target, enabled: true })).resolves.toEqual({ reader: 'legacy-json', code: 'storage-target-mismatch' })
      const after = new Database(target)
      expect(after.prepare('PRAGMA application_id').pluck().get()).toBe(partial.applicationId)
      expect(after.prepare('PRAGMA user_version').pluck().get()).toBe(partial.userVersion)
      after.close()
    }
    await expect(readFile(source)).resolves.toEqual(sourceBytes)
  })

  it('rejects unsafe v1 identifiers and constrains persisted categorical values', async () => {
    const whitespaceIdentifier = inventedV1Fixture()
    whitespaceIdentifier.repositories[0]!.id = 'repo provider 101'
    const unknownState = inventedV1Fixture()
    unknownState.pullRequests[0]!.state = 'DRAFT'
    const unknownCoverage = inventedV1Fixture()
    unknownCoverage.coverage[0]!.id = 'unknown-source'

    expect(() => parseV1Dataset(JSON.stringify(whitespaceIdentifier))).toThrow('V1_VALIDATION_FAILED')
    expect(() => parseV1Dataset(JSON.stringify(unknownState))).toThrow('V1_VALIDATION_FAILED')
    expect(() => parseV1Dataset(JSON.stringify(unknownCoverage))).toThrow('V1_VALIDATION_FAILED')

    const { target } = await fixturePaths()
    const db = openStorageDatabase(target)
    db.prepare('INSERT INTO repository_identity (provider_id, analytical_key, is_private, is_archived, is_fork) VALUES (?, ?, 0, 0, 0)').run('repo-provider-101', 'repo-101')
    expect(() => db.prepare('INSERT INTO commit_observation (repository_provider_id, sha, occurred_at, source, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, ?, ?, 0, 0, 0)').run('repo-provider-101', 'sha-101', '2026-01-02T12:00:00.000Z', 'github', 'narrative')).toThrow()
    expect(() => db.prepare('INSERT INTO pull_request_fact (provider_id, repository_provider_id, number, created_at, state, is_draft, comments, reviews) VALUES (?, ?, 1, ?, ?, 0, 0, 0)').run('pr-provider-101', 'repo-provider-101', '2026-01-02T12:00:00.000Z', 'DRAFT')).toThrow()
    expect(() => db.prepare('INSERT INTO coverage_observation (capability_id, status, limitation_code, observed_units) VALUES (?, ?, ?, 0)').run('github.core', 'partial', 'V1_PARTIAL_COVERAGE')).toThrow()
    db.close()
  })

  it('maps unavailable v1 coverage without inventing completeness', async () => {
    const { source, target } = await fixturePaths()
    const unavailable = inventedV1Fixture()
    unavailable.coverage = [{ id: 'local-git', label: 'Unavailable source', status: 'unavailable', detail: 'Unavailable', itemCount: 0 }]
    await writeFile(source, JSON.stringify(unavailable))

    await expect(importV1Json({ sourcePath: source, targetPath: target })).resolves.toMatchObject({ integrity: 'ok', foreignKeyViolations: 0 })
    const db = openStorageDatabase(target)
    expect(db.prepare('SELECT capability_id, status, limitation_code, observed_units FROM coverage_observation').get()).toEqual({ capability_id: 'cap.local.git', status: 'unavailable', limitation_code: 'V1_UNAVAILABLE', observed_units: 0 })
    db.close()
  })

  it('rolls back importer writes when an existing V2 target fails its in-transaction foreign-key check', async () => {
    const { source, target, sourceBytes } = await fixturePaths()
    const seeded = openStorageDatabase(target)
    seeded.pragma('foreign_keys = OFF')
    seeded.prepare('INSERT INTO commit_observation (repository_provider_id, sha, occurred_at, source, feature_type, is_revert, is_fixup, message_length) VALUES (?, ?, ?, ?, ?, 0, 0, 0)').run('orphan-parent-101', 'orphan-sha-101', '2026-01-02T12:00:00.000Z', 'github', 'feat')
    seeded.close()

    await expect(selectStorageReader({ sourcePath: source, targetPath: target, enabled: true })).resolves.toEqual({ reader: 'legacy-json', code: 'storage-import-failed' })
    const db = openStorageDatabase(target)
    expect(Number(db.prepare('SELECT COUNT(*) FROM import_run').pluck().get())).toBe(0)
    expect(Number(db.prepare('SELECT COUNT(*) FROM repository_identity').pluck().get())).toBe(0)
    expect(Number(db.prepare('SELECT COUNT(*) FROM pull_request_fact').pluck().get())).toBe(0)
    expect(Number(db.prepare('SELECT COUNT(*) FROM coverage_observation').pluck().get())).toBe(0)
    expect(Number(db.prepare('SELECT COUNT(*) FROM dated_event_observation').pluck().get())).toBe(0)
    expect(Number(db.prepare('SELECT COUNT(*) FROM commit_observation').pluck().get())).toBe(1)
    db.close()
    await expect(readFile(source)).resolves.toEqual(sourceBytes)
  })

  it('rolls back a failed first import without publishing a partial target', async () => {
    const { source, target, sourceBytes } = await fixturePaths()

    await expect(importV1Json({ sourcePath: source, targetPath: target, failAt: 'after-repository-upsert' })).rejects.toThrow('INJECTED_FAILURE')
    await expect(selectStorageReader({ sourcePath: source, targetPath: target, enabled: true, failAt: 'after-repository-upsert' })).resolves.toEqual({ reader: 'legacy-json', code: 'storage-import-failed' })
    expect(existsSync(target)).toBe(false)
    await expect(readFile(source)).resolves.toEqual(sourceBytes)
  })

  it('rolls back a failed re-import and retains the previous canonical state', async () => {
    const { source, target, sourceBytes } = await fixturePaths()
    await importV1Json({ sourcePath: source, targetPath: target })
    const before = databaseDigest(target)

    await expect(importV1Json({ sourcePath: source, targetPath: target, failAt: 'after-repository-upsert' })).rejects.toThrow('INJECTED_FAILURE')
    await expect(selectStorageReader({ sourcePath: source, targetPath: target, enabled: true, failAt: 'after-repository-upsert' })).resolves.toEqual({ reader: 'legacy-json', code: 'storage-import-failed' })
    expect(databaseDigest(target)).toBe(before)
    await expect(readFile(source)).resolves.toEqual(sourceBytes)
  })
})
