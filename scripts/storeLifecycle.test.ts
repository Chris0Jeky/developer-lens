import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInstallationAliases } from '../server/storage/installationAliases.js'
import { StorageV3ShadowMigrationError } from '../server/storage/v3ShadowMigration.js'
import {
  STORAGE_V3_STORE_FILE_NAME,
  STORAGE_V3_TARGET_FILE_NAMES,
} from '../server/storage/v3StoreFiles.js'
import {
  INVENTED_COHORTS,
  INVENTED_INSTALLATION_KEY_BYTE,
  INVENTED_SOURCE_FILE_NAME,
  runStoreLifecycleCli,
  runStoreLifecycleDemo,
  STORE_LIFECYCLE_ENV_FLAG,
} from './storeLifecycle.js'

const enabled = { [STORE_LIFECYCLE_ENV_FLAG]: '1' }

const entries = (directory: string): string[] => readdirSync(directory).sort()

const storePath = (directory: string): string => join(directory, STORAGE_V3_STORE_FILE_NAME)

const isTemporaryArtifact = (name: string): boolean =>
  name.startsWith(INVENTED_SOURCE_FILE_NAME)
  || name.startsWith(STORAGE_V3_TARGET_FILE_NAMES.primary)
  || name.startsWith(STORAGE_V3_TARGET_FILE_NAMES.replay)

describe('store lifecycle command', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'developer-lens-store-lifecycle-'))
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('runs the invented journey from source to swept, re-validated store', () => {
    const lines: string[] = []
    const result = runStoreLifecycleDemo({ directory, log: (line) => lines.push(line) })

    expect(result.deletion).toMatchObject({ tables: 10, tombstoneWritten: true })
    expect(result.deletion.rowsAfter).toBeLessThan(result.deletion.rowsBefore)
    expect(result.migration).toEqual({ status: 'complete', checksumLength: 64 })
    expect(result.cas).toEqual({
      scope: 'created',
      firstApply: 'applied',
      replayApply: 'replayed',
      revisions: [1],
    })
    expect(result.sweep.status).toBe('complete')
    expect(result.sweep.clearedTotal).toBe(10)
    expect(result.sweep.lineageEvents).toBe(5)
    expect(result.report.tableCounts).toMatchObject({
      claim_scope: 2,
      repository_identity: 2,
      continuity_cas_state: 1,
      continuity_cas_operation: 1,
      import_run: 0,
      coverage_observation: 0,
      lineage_event: 6,
    })
    expect(result.report.casRevisions).toEqual([1])
    expect(result.lines).toEqual(lines)
    expect(lines).toHaveLength(7)

    expect(existsSync(storePath(directory))).toBe(true)
    expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary))).toBe(false)
    expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.replay))).toBe(false)
  })

  it('prints counts and statuses without any invented identifier or key material', () => {
    const lines: string[] = []
    runStoreLifecycleDemo({ directory, log: (line) => lines.push(line) })
    const key = Buffer.alloc(32, INVENTED_INSTALLATION_KEY_BYTE)
    const aliases = createInstallationAliases(key)
    const forbidden = [
      key.toString('hex'),
      key.toString('base64'),
      directory,
      ...INVENTED_COHORTS.flatMap(({ rawProviderId }) => [
        rawProviderId,
        aliases.repositoryProviderId(rawProviderId),
        aliases.repositoryAnalyticalKey(rawProviderId),
      ]),
    ]
    const output = lines.join('\n')
    for (const value of forbidden) expect(output).not.toContain(value)
    expect(output).not.toMatch(/[0-9a-f]{32}/)
    expect(output).not.toMatch(/scope-|cl_|op-|del-/)
  })

  it('leaves no store when the migration is interrupted and recovers over stale files', () => {
    expect(() => runStoreLifecycleDemo({
      directory,
      failAfterStage: (kind, stage) => {
        if (kind === 'primary' && stage === 'claims') throw new Error('invented interruption')
      },
    })).toThrow(StorageV3ShadowMigrationError)
    expect(existsSync(storePath(directory))).toBe(false)
    expect(entries(directory).every(isTemporaryArtifact)).toBe(true)

    // A crash that never unwinds leaves the temporary targets behind; the next
    // run must remove them rather than open whatever they contain.
    for (const name of Object.values(STORAGE_V3_TARGET_FILE_NAMES)) {
      writeFileSync(join(directory, name), 'invented stale bytes, not a database')
    }
    const recovered = runStoreLifecycleDemo({ directory })
    expect(recovered.migration.status).toBe('complete')
    expect(recovered.sweep.clearedTotal).toBe(10)
    expect(existsSync(storePath(directory))).toBe(true)
    expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary))).toBe(false)
    expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.replay))).toBe(false)
  })

  it('refuses to accept a second migration over an existing store', () => {
    runStoreLifecycleDemo({ directory })
    const before = readFileSync(storePath(directory))
    expect(() => runStoreLifecycleDemo({ directory })).toThrow(StorageV3ShadowMigrationError)
    expect(readFileSync(storePath(directory)).equals(before)).toBe(true)
    expect(existsSync(join(directory, STORAGE_V3_TARGET_FILE_NAMES.primary))).toBe(false)
  })

  it('refuses every invocation without the environment flag and an explicit directory', () => {
    const lines: string[] = []
    const log = (line: string): void => { lines.push(line) }
    expect(runStoreLifecycleCli(['demo', '--dir', directory], {}, log)).toBe(1)
    expect(lines[0]).toContain(STORE_LIFECYCLE_ENV_FLAG)
    expect(runStoreLifecycleCli(['demo'], enabled, log)).toBe(1)
    expect(runStoreLifecycleCli([], enabled, log)).toBe(1)
    expect(runStoreLifecycleCli(['demo', '--dir'], enabled, log)).toBe(1)
    expect(runStoreLifecycleCli(['delete-everything', '--dir', directory], enabled, log)).toBe(1)
    expect(lines.some((line) => line.includes('never defaults to a directory'))).toBe(true)
    expect(entries(directory)).toEqual([])
  })

  it('reports and sweeps a selected store through the command surface', () => {
    const lines: string[] = []
    const log = (line: string): void => { lines.push(line) }
    expect(runStoreLifecycleCli(['demo', '--dir', directory], enabled, log)).toBe(0)
    lines.length = 0
    expect(runStoreLifecycleCli(['status', '--dir', directory], enabled, log)).toBe(0)
    expect(lines.join('\n')).toContain('cas-scopes=1')
    expect(lines.join('\n')).toContain('cas: revisions=1')

    lines.length = 0
    expect(runStoreLifecycleCli(
      ['sweep', '--dir', directory, '--as-of', '2027-02-01T00:00:00.000Z'],
      enabled,
      log,
    )).toBe(0)
    expect(lines[0]).toMatch(/^sweep: status=complete cleared=10 lineage=5 /)

    lines.length = 0
    expect(runStoreLifecycleCli(['sweep', '--dir', directory, '--as-of', 'not-a-timestamp'], enabled, log))
      .toBe(1)
    expect(lines[0]).toBe('failed: INVALID_TIMESTAMP')
  })

  it('refuses a status report when no store has been selected', () => {
    const lines: string[] = []
    expect(runStoreLifecycleCli(['status', '--dir', directory], enabled, (line) => lines.push(line)))
      .toBe(1)
    expect(lines[0]).toBe('failed: STORAGE_V3_STORE_FILE_REFUSED')
    expect(entries(directory)).toEqual([])
  })
})
