import { createHash } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import Database from 'better-sqlite3'
import { z } from 'zod'
import { CoverageStatusSchema, COVERAGE_STATUSES } from '../../shared/coverage.js'
import {
  CANONICAL_ENVELOPE_SCHEMA_VERSION,
} from '../../shared/provenance.js'
import { PRIVACY_CONTRACT_VERSION } from '../../shared/privacy.js'
import {
  SQLITE_APPLICATION_ID,
  SQLITE_USER_VERSION,
} from '../storage/schema.js'

const MANIFEST_VERSION = '1.0.0' as const
const COVERAGE_ARTIFACT_PATH = 'tables/coverage.parquet' as const
const CONTROL_FILE_NAMES = ['checksums.sha256', 'manifest.json', 'tables'] as const
const COMPLETE_FILE_NAMES = ['COMPLETE', ...CONTROL_FILE_NAMES] as const
const SAFE_CAPABILITY_IDS = ['cap.local.git', 'github.core'] as const

const SafeCapabilityIdSchema = z.enum(SAFE_CAPABILITY_IDS)
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const PackIdSchema = z.string().regex(/^pack-[a-f0-9]{32}$/)
const CreatedAtSchema = z.string().datetime({ offset: true })
const LimitationCodeSchema = z.string().regex(/^[A-Z0-9_]{1,64}$/)
const ObservedUnitsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

const SourceCoverageFactSchema = z
  .object({
    capability_id: SafeCapabilityIdSchema,
    status: CoverageStatusSchema,
    limitation_code: LimitationCodeSchema,
    observed_units: ObservedUnitsSchema,
  })
  .strict()

const PackCoverageFactSchema = z
  .object({
    capability_id: SafeCapabilityIdSchema,
    status: CoverageStatusSchema,
    observed_units: ObservedUnitsSchema,
  })
  .strict()

const ArtifactSchema = z
  .object({
    path: z.literal(COVERAGE_ARTIFACT_PATH),
    sha256: Sha256Schema,
    classification: z.literal('C1'),
  })
  .strict()

const AnalysisPackManifestSchema = z
  .object({
    manifestVersion: z.literal(MANIFEST_VERSION),
    privacyContractVersion: z.literal(PRIVACY_CONTRACT_VERSION),
    canonicalEnvelopeSchemaVersion: z.literal(CANONICAL_ENVELOPE_SCHEMA_VERSION),
    packId: PackIdSchema,
    createdAt: CreatedAtSchema,
    exportClassification: z.literal('redacted_aggregate'),
    capabilities: z.array(SafeCapabilityIdSchema),
    coverageStatuses: z.array(CoverageStatusSchema),
    artifacts: z.tuple([ArtifactSchema]),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (new Set(manifest.capabilities).size !== manifest.capabilities.length) {
      context.addIssue({ code: 'custom', message: 'Capabilities must be unique', path: ['capabilities'] })
    }
    if (new Set(manifest.coverageStatuses).size !== manifest.coverageStatuses.length) {
      context.addIssue({ code: 'custom', message: 'Coverage statuses must be unique', path: ['coverageStatuses'] })
    }
  })

type SourceCoverageFact = z.infer<typeof SourceCoverageFactSchema>
type PackCoverageFact = z.infer<typeof PackCoverageFactSchema>
export type AnalysisPackManifest = z.infer<typeof AnalysisPackManifestSchema>

export type AnalysisPackErrorCode =
  | 'ANALYSIS_PACK_SOURCE_MISMATCH'
  | 'ANALYSIS_PACK_TARGET_EXISTS'
  | 'ANALYSIS_PACK_INCOMPLETE'
  | 'ANALYSIS_PACK_CORRUPT'

export class AnalysisPackError extends Error {
  public readonly code: AnalysisPackErrorCode

  constructor(code: AnalysisPackErrorCode) {
    super(code)
    this.name = 'AnalysisPackError'
    this.code = code
  }
}

export interface BuildAnalysisPackOptions {
  sourceDatabasePath: string
  outputDirectory: string
  createdAt: string
}

export interface BuildAnalysisPackResult {
  outputDirectory: string
  manifest: AnalysisPackManifest
}

export interface CoverageReplayRow {
  capabilityId: typeof SAFE_CAPABILITY_IDS[number]
  status: z.infer<typeof CoverageStatusSchema>
  scopes: number
}

interface VerifiedPack {
  manifest: AnalysisPackManifest
  manifestSha256: string
  coverageFacts: PackCoverageFact[]
  summary: CoverageReplayRow[]
}

interface AnalysisPackVerificationHooks {
  afterCoverageChecksumValidated?: () => Promise<void> | void
}

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function sqlitePragmaInteger(db: Database.Database, name: string): number {
  return Number(db.prepare(`PRAGMA ${name}`).pluck().get())
}

function exactStringArray(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index])
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

function readSafeCoverageFacts(sourceDatabasePath: string): SourceCoverageFact[] {
  let db: Database.Database | undefined
  try {
    db = new Database(sourceDatabasePath, { readonly: true, fileMustExist: true })
    db.pragma('query_only = ON')
    db.pragma('foreign_keys = ON')

    if (
      sqlitePragmaInteger(db, 'application_id') !== SQLITE_APPLICATION_ID ||
      sqlitePragmaInteger(db, 'user_version') !== SQLITE_USER_VERSION
    ) {
      throw new AnalysisPackError('ANALYSIS_PACK_SOURCE_MISMATCH')
    }

    const columns = db.prepare("PRAGMA table_info('coverage_observation')").all() as Array<{
      name: string
      type: string
      notnull: number
      pk: number
    }>
    const expectedColumns = [
      { name: 'capability_id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'status', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'limitation_code', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'observed_units', type: 'INTEGER', notnull: 1, pk: 0 },
    ]
    if (JSON.stringify(columns.map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }))) !== JSON.stringify(expectedColumns)) {
      throw new AnalysisPackError('ANALYSIS_PACK_SOURCE_MISMATCH')
    }

    if (db.prepare('PRAGMA quick_check').pluck().get() !== 'ok') {
      throw new AnalysisPackError('ANALYSIS_PACK_SOURCE_MISMATCH')
    }
    if (db.prepare('PRAGMA foreign_key_check').all().length !== 0) {
      throw new AnalysisPackError('ANALYSIS_PACK_SOURCE_MISMATCH')
    }

    const parsed = z.array(SourceCoverageFactSchema).parse(
      db.prepare(`
        SELECT capability_id, status, limitation_code, observed_units
        FROM coverage_observation
        ORDER BY capability_id
      `).all(),
    )
    if (new Set(parsed.map((fact) => fact.capability_id)).size !== parsed.length) {
      throw new AnalysisPackError('ANALYSIS_PACK_SOURCE_MISMATCH')
    }
    return parsed
  } catch (error) {
    if (error instanceof AnalysisPackError) {
      throw error
    }
    throw new AnalysisPackError('ANALYSIS_PACK_SOURCE_MISMATCH')
  } finally {
    db?.close()
  }
}

async function writeCoverageParquet(path: string, facts: readonly PackCoverageFact[]): Promise<void> {
  const instance = await DuckDBInstance.create(':memory:')
  let connection: Awaited<ReturnType<DuckDBInstance['connect']>> | undefined
  try {
    connection = await instance.connect()
    await connection.run(`
      CREATE TABLE coverage (
        capability_id VARCHAR NOT NULL,
        status VARCHAR NOT NULL,
        observed_units UBIGINT NOT NULL
      )
    `)
    if (facts.length > 0) {
      const values = facts.map((fact) =>
        `(${sqlString(fact.capability_id)}, ${sqlString(fact.status)}, ${fact.observed_units})`,
      ).join(', ')
      await connection.run(`INSERT INTO coverage VALUES ${values}`)
    }
    const normalizedPath = path.replaceAll('\\', '/')
    await connection.run(`
      COPY (
        SELECT capability_id, status, observed_units
        FROM coverage
        ORDER BY capability_id
      ) TO ${sqlString(normalizedPath)} (FORMAT parquet, COMPRESSION uncompressed)
    `)
  } finally {
    connection?.closeSync()
    instance.closeSync()
  }
}

function duckDbObservedUnits(value: unknown): number {
  if (typeof value !== 'bigint' && typeof value !== 'number') {
    throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
  }
  return parsed
}

async function inspectCoverageParquet(path: string): Promise<{
  facts: PackCoverageFact[]
  summary: CoverageReplayRow[]
}> {
  const instance = await DuckDBInstance.create(':memory:')
  let connection: Awaited<ReturnType<DuckDBInstance['connect']>> | undefined
  try {
    connection = await instance.connect()
    const normalizedPath = path.replaceAll('\\', '/')
    const source = `read_parquet(${sqlString(normalizedPath)})`
    const factsReader = await connection.runAndReadAll(`
      SELECT * FROM ${source} ORDER BY capability_id
    `)
    if (!exactStringArray(factsReader.columnNames(), ['capability_id', 'status', 'observed_units'])) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }
    if (!exactStringArray(factsReader.columnTypes().map((type) => type.toString()), ['VARCHAR', 'VARCHAR', 'UBIGINT'])) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }
    const facts = z.array(PackCoverageFactSchema).parse(
      factsReader.getRows().map(([capabilityId, status, observedUnits]) => ({
        capability_id: capabilityId,
        status,
        observed_units: duckDbObservedUnits(observedUnits),
      })),
    )
    if (new Set(facts.map((fact) => fact.capability_id)).size !== facts.length) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }

    const summaryReader = await connection.runAndReadAll(`
      SELECT capability_id, status, count(*)::UINTEGER AS scopes
      FROM ${source}
      GROUP BY capability_id, status
      ORDER BY capability_id, status
    `)
    const summary = summaryReader.getRows().map(([capabilityId, status, scopes]) => {
      const parsed = z.object({
        capabilityId: SafeCapabilityIdSchema,
        status: CoverageStatusSchema,
        scopes: z.number().int().positive(),
      }).strict().parse({
        capabilityId,
        status,
        scopes: Number(scopes),
      })
      return parsed
    })
    return { facts, summary }
  } catch (error) {
    if (error instanceof AnalysisPackError) {
      throw error
    }
    throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
  } finally {
    connection?.closeSync()
    instance.closeSync()
  }
}

async function assertPackFileSet(packDirectory: string, complete: boolean): Promise<void> {
  const expectedRootNames = [...(complete ? COMPLETE_FILE_NAMES : CONTROL_FILE_NAMES)].sort()
  const rootNames = (await readdir(packDirectory)).sort()
  if (!exactStringArray(rootNames, expectedRootNames)) {
    throw new AnalysisPackError(complete && !rootNames.includes('COMPLETE')
      ? 'ANALYSIS_PACK_INCOMPLETE'
      : 'ANALYSIS_PACK_CORRUPT')
  }

  for (const fileName of expectedRootNames.filter((name) => name !== 'tables')) {
    if (!(await lstat(join(packDirectory, fileName))).isFile()) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }
  }
  if (!(await lstat(join(packDirectory, 'tables'))).isDirectory()) {
    throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
  }
  const tableNames = (await readdir(join(packDirectory, 'tables'))).sort()
  if (!exactStringArray(tableNames, ['coverage.parquet'])) {
    throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
  }
  if (!(await lstat(join(packDirectory, COVERAGE_ARTIFACT_PATH))).isFile()) {
    throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
  }
}

async function verifyPack(
  packDirectory: string,
  complete: boolean,
  hooks?: AnalysisPackVerificationHooks,
): Promise<VerifiedPack> {
  try {
    if (complete && !(await pathExists(join(packDirectory, 'COMPLETE')))) {
      throw new AnalysisPackError('ANALYSIS_PACK_INCOMPLETE')
    }
    await assertPackFileSet(packDirectory, complete)

    const manifestBytes = await readFile(join(packDirectory, 'manifest.json'))
    const manifestSha256 = sha256(manifestBytes)
    const manifest = AnalysisPackManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')))
    const coveragePath = join(packDirectory, COVERAGE_ARTIFACT_PATH)
    const coverageSha256 = sha256(await readFile(coveragePath))
    if (manifest.artifacts[0].sha256 !== coverageSha256) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }

    const expectedChecksums =
      `${manifestSha256}  manifest.json\n${coverageSha256}  ${COVERAGE_ARTIFACT_PATH}\n`
    if (await readFile(join(packDirectory, 'checksums.sha256'), 'utf8') !== expectedChecksums) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }
    if (complete && await readFile(join(packDirectory, 'COMPLETE'), 'utf8') !== `${manifestSha256}\n`) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }

    await hooks?.afterCoverageChecksumValidated?.()
    const inspected = await inspectCoverageParquet(coveragePath)
    if (sha256(await readFile(coveragePath)) !== coverageSha256) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }
    if (!exactStringArray(
      inspected.facts.map((fact) => fact.capability_id),
      manifest.capabilities,
    )) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }
    const statuses = COVERAGE_STATUSES.filter((status) =>
      inspected.facts.some((fact) => fact.status === status),
    )
    if (!exactStringArray(statuses, manifest.coverageStatuses)) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }
    return {
      manifest,
      manifestSha256,
      coverageFacts: inspected.facts,
      summary: inspected.summary,
    }
  } catch (error) {
    if (error instanceof AnalysisPackError) {
      throw error
    }
    throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
  }
}

export async function buildAnalysisPack(options: BuildAnalysisPackOptions): Promise<BuildAnalysisPackResult> {
  const createdAt = CreatedAtSchema.parse(options.createdAt)
  const sourceFacts = readSafeCoverageFacts(options.sourceDatabasePath)
  const coverageFacts = sourceFacts.map(({ capability_id, status, observed_units }) =>
    PackCoverageFactSchema.parse({ capability_id, status, observed_units }),
  )

  if (await pathExists(options.outputDirectory)) {
    throw new AnalysisPackError('ANALYSIS_PACK_TARGET_EXISTS')
  }
  const parentDirectory = dirname(options.outputDirectory)
  await mkdir(parentDirectory, { recursive: true })
  const stagingPrefix = `.${basename(options.outputDirectory)}.tmp-`
  let stagingDirectory = await mkdtemp(join(parentDirectory, stagingPrefix))

  try {
    await mkdir(join(stagingDirectory, 'tables'))
    const coveragePath = join(stagingDirectory, COVERAGE_ARTIFACT_PATH)
    await writeCoverageParquet(coveragePath, coverageFacts)
    const coverageSha256 = sha256(await readFile(coveragePath))
    const packId = PackIdSchema.parse(
      `pack-${sha256(`${createdAt}\0${coverageSha256}`).slice(0, 32)}`,
    )
    const manifest = AnalysisPackManifestSchema.parse({
      manifestVersion: MANIFEST_VERSION,
      privacyContractVersion: PRIVACY_CONTRACT_VERSION,
      canonicalEnvelopeSchemaVersion: CANONICAL_ENVELOPE_SCHEMA_VERSION,
      packId,
      createdAt,
      exportClassification: 'redacted_aggregate',
      capabilities: coverageFacts.map((fact) => fact.capability_id),
      coverageStatuses: COVERAGE_STATUSES.filter((status) =>
        coverageFacts.some((fact) => fact.status === status),
      ),
      artifacts: [{
        path: COVERAGE_ARTIFACT_PATH,
        sha256: coverageSha256,
        classification: 'C1',
      }],
    })
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    const manifestSha256 = sha256(manifestBytes)
    await writeFile(join(stagingDirectory, 'manifest.json'), manifestBytes)
    await writeFile(
      join(stagingDirectory, 'checksums.sha256'),
      `${manifestSha256}  manifest.json\n${coverageSha256}  ${COVERAGE_ARTIFACT_PATH}\n`,
      'utf8',
    )

    const preComplete = await verifyPack(stagingDirectory, false)
    if (JSON.stringify(preComplete.coverageFacts) !== JSON.stringify(coverageFacts)) {
      throw new AnalysisPackError('ANALYSIS_PACK_CORRUPT')
    }

    await writeFile(join(stagingDirectory, 'COMPLETE'), `${preComplete.manifestSha256}\n`, 'utf8')
    await rename(stagingDirectory, options.outputDirectory)
    stagingDirectory = ''
    return { outputDirectory: options.outputDirectory, manifest }
  } catch (error) {
    if (error instanceof AnalysisPackError) {
      throw error
    }
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new AnalysisPackError('ANALYSIS_PACK_TARGET_EXISTS')
    }
    throw error
  } finally {
    if (stagingDirectory) {
      await rm(stagingDirectory, { recursive: true, force: true })
    }
  }
}

export async function replayCoverageSummary(
  packDirectory: string,
  /** @internal Test-only seam for deterministic concurrent-writer simulation. */
  hooks?: AnalysisPackVerificationHooks,
): Promise<CoverageReplayRow[]> {
  return (await verifyPack(packDirectory, true, hooks)).summary
}
