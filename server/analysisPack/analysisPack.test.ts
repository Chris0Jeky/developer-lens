import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openStorageDatabase } from '../storage/database.js'
import {
  buildAnalysisPack,
  replayCoverageSummary,
} from './analysisPack.js'

const tempDirectories: string[] = []
const CREATED_AT = '2026-08-03T12:00:00.000Z'
const C2_PROVIDER_CANARY = 'repo-c2-provider-canary'
const C2_ANALYTICAL_CANARY = 'repo-c2-analytical-canary'
const CALLER_PACK_CANARY_ONE = 'acme-private-repository'
const CALLER_PACK_CANARY_TWO = 'developer@example.invalid'
const PACK_FILES = [
  'COMPLETE',
  'checksums.sha256',
  'manifest.json',
  'tables/coverage.parquet',
] as const

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ))
})

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function syntheticSource(): Promise<{ root: string; databasePath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'developer lens analysis pack '))
  tempDirectories.push(root)
  const databasePath = join(root, 'synthetic P2.sqlite')
  const db = openStorageDatabase(databasePath)
  try {
    db.prepare(`
      INSERT INTO coverage_observation (
        capability_id, status, limitation_code, observed_units
      ) VALUES (?, ?, ?, ?)
    `).run('github.core', 'never_authorized', 'OWNER_GATE_NOT_APPROVED', 0)
    db.prepare(`
      INSERT INTO coverage_observation (
        capability_id, status, limitation_code, observed_units
      ) VALUES (?, ?, ?, ?)
    `).run('cap.local.git', 'refused', 'OWNER_GATE_NOT_APPROVED', 0)
    db.prepare(`
      INSERT INTO repository_identity (
        provider_id, analytical_key, is_private, is_archived, is_fork
      ) VALUES (?, ?, 1, 0, 0)
    `).run(C2_PROVIDER_CANARY, C2_ANALYTICAL_CANARY)
  } finally {
    db.close()
  }
  return { root, databasePath }
}

async function readPackFiles(packDirectory: string): Promise<Record<typeof PACK_FILES[number], Buffer>> {
  const entries = await Promise.all(PACK_FILES.map(async (path) => [
    path,
    await readFile(join(packDirectory, path)),
  ] as const))
  return Object.fromEntries(entries) as Record<typeof PACK_FILES[number], Buffer>
}

async function rewriteManifestWithModelEvidence(packDirectory: string): Promise<void> {
  const manifestPath = join(packDirectory, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>
  manifest.externalModelEvidence = {
    schemaVersion: '1.0.0',
    classification: 'C1',
    artifactPath: 'llm-pack/evidence.jsonl',
  }
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  const manifestSha256 = sha256(manifestBytes)
  const coverageSha256 = sha256(await readFile(join(packDirectory, 'tables/coverage.parquet')))
  await writeFile(manifestPath, manifestBytes)
  await writeFile(
    join(packDirectory, 'checksums.sha256'),
    `${manifestSha256}  manifest.json\n${coverageSha256}  tables/coverage.parquet\n`,
    'utf8',
  )
  await writeFile(join(packDirectory, 'COMPLETE'), `${manifestSha256}\n`, 'utf8')
}

describe('synthetic analysis-pack foundation', () => {
  it('builds deterministic C1 coverage packs and replays the same DuckDB query', async () => {
    const { root, databasePath } = await syntheticSource()
    const firstPack = join(root, 'pack output one')
    const secondPack = join(root, 'pack output two')
    const sourceBefore = await readFile(databasePath)

    const firstOptions = {
      sourceDatabasePath: databasePath,
      outputDirectory: firstPack,
      packId: CALLER_PACK_CANARY_ONE,
      createdAt: CREATED_AT,
    }
    const secondOptions = {
      sourceDatabasePath: databasePath,
      outputDirectory: secondPack,
      packId: CALLER_PACK_CANARY_TWO,
      createdAt: CREATED_AT,
    }
    const first = await buildAnalysisPack(firstOptions)
    const second = await buildAnalysisPack(secondOptions)

    const firstFiles = await readPackFiles(firstPack)
    const secondFiles = await readPackFiles(secondPack)
    for (const path of PACK_FILES) {
      expect(firstFiles[path]).toEqual(secondFiles[path])
    }
    expect(await readFile(databasePath)).toEqual(sourceBefore)

    expect((await readdir(firstPack)).sort()).toEqual([
      'COMPLETE',
      'checksums.sha256',
      'manifest.json',
      'tables',
    ])
    expect(await readdir(join(firstPack, 'tables'))).toEqual(['coverage.parquet'])
    expect(first.manifest).toEqual(second.manifest)
    expect(first.manifest).toMatchObject({
      manifestVersion: '1.0.0',
      privacyContractVersion: '1.0.0',
      canonicalEnvelopeSchemaVersion: '2.0.0',
      packId: expect.stringMatching(/^pack-[a-f0-9]{32}$/),
      createdAt: CREATED_AT,
      exportClassification: 'redacted_aggregate',
      capabilities: ['cap.local.git', 'github.core'],
      coverageStatuses: ['never_authorized', 'refused'],
      artifacts: [{
        path: 'tables/coverage.parquet',
        classification: 'C1',
      }],
    })
    expect('externalModelEvidence' in first.manifest).toBe(false)

    const combined = Buffer.concat(Object.values(firstFiles))
    expect(combined.includes(Buffer.from(C2_PROVIDER_CANARY, 'utf8'))).toBe(false)
    expect(combined.includes(Buffer.from(C2_ANALYTICAL_CANARY, 'utf8'))).toBe(false)
    expect(combined.includes(Buffer.from(CALLER_PACK_CANARY_ONE, 'utf8'))).toBe(false)
    expect(combined.includes(Buffer.from(CALLER_PACK_CANARY_TWO, 'utf8'))).toBe(false)
    expect(combined.includes(Buffer.from('OWNER_GATE_NOT_APPROVED', 'utf8'))).toBe(false)

    const expectedReplay = [
      { capabilityId: 'cap.local.git', status: 'refused', scopes: 1 },
      { capabilityId: 'github.core', status: 'never_authorized', scopes: 1 },
    ]
    await expect(replayCoverageSummary(firstPack)).resolves.toEqual(expectedReplay)
    await expect(replayCoverageSummary(firstPack)).resolves.toEqual(expectedReplay)
    await expect(replayCoverageSummary(secondPack)).resolves.toEqual(expectedReplay)
  })

  it('fails closed when COMPLETE is absent', async () => {
    const { root, databasePath } = await syntheticSource()
    const packDirectory = join(root, 'incomplete pack')
    await buildAnalysisPack({
      sourceDatabasePath: databasePath,
      outputDirectory: packDirectory,
      createdAt: CREATED_AT,
    })
    await unlink(join(packDirectory, 'COMPLETE'))

    await expect(replayCoverageSummary(packDirectory)).rejects.toMatchObject({
      code: 'ANALYSIS_PACK_INCOMPLETE',
    })
  })

  it('fails closed on a corrupt Parquet checksum before replay', async () => {
    const { root, databasePath } = await syntheticSource()
    const packDirectory = join(root, 'corrupt pack')
    await buildAnalysisPack({
      sourceDatabasePath: databasePath,
      outputDirectory: packDirectory,
      createdAt: CREATED_AT,
    })
    await writeFile(join(packDirectory, 'tables/coverage.parquet'), 'invented-corruption', 'utf8')

    await expect(replayCoverageSummary(packDirectory)).rejects.toMatchObject({
      code: 'ANALYSIS_PACK_CORRUPT',
    })
  })

  it('rejects an internally checksummed model artifact declaration', async () => {
    const { root, databasePath } = await syntheticSource()
    const packDirectory = join(root, 'model declaration pack')
    await buildAnalysisPack({
      sourceDatabasePath: databasePath,
      outputDirectory: packDirectory,
      createdAt: CREATED_AT,
    })
    await rewriteManifestWithModelEvidence(packDirectory)

    await expect(replayCoverageSummary(packDirectory)).rejects.toMatchObject({
      code: 'ANALYSIS_PACK_CORRUPT',
    })
  })
})
