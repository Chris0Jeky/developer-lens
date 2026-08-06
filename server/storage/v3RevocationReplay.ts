import { createHash, randomBytes as cryptoRandomBytes, timingSafeEqual } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
} from 'node:fs'
import { dirname } from 'node:path'
import type Database from 'better-sqlite3'
import {
  assertStorageV3ArtifactCatalogue,
  assertStorageV3ArtifactDirectorySyncSupported,
  assertStorageV3ArtifactRootInstallationKey,
  openStorageV3ArtifactRoot,
  storageV3MaintenanceStatus,
  storageV3ArtifactFilePath,
  syncStorageV3ArtifactDirectory,
  type StorageV3ArtifactRoot,
} from './v3ArtifactCatalogue.js'
import {
  completeStorageV3DeletionMaintenance,
  deleteStorageV3Scope,
  planStorageV3ScopeDeletion,
  type StorageV3DeletionReplaySubject,
  type StorageV3ScopeDeletionResult,
} from './v3Deletion.js'
import {
  consumeStorageV3MigrationSelectionInitialization,
  readStorageV3MigrationSelection,
  type StorageV3MigrationSelection,
  type StorageV3MigrationSelectionInitializationGrant,
} from './v3SelectionReceipt.js'
import { isoWeekFromCanonicalTimestamp } from './v3ShadowRewrite.js'
import { openSelectedStorageV3Store } from './v3StoreFiles.js'
import {
  bindTaskInstallationKeyBody,
  type TaskInstallationKeyHandle,
} from './taskInstallationKey.js'
import {
  assertStorageV3WriterLease,
  withStorageV3WriterLease,
  type StorageV3WriterLease,
} from './v3WriterLease.js'
import { STORAGE_V3_SELECTION_PROOF_NAMES } from './v3SelectionProof.js'
import {
  C1_KEY_PREFIXES,
  DeletionOperationIdV3Schema,
  IsoWeekV3Schema,
  ScopeIdV3Schema,
} from './v3Proposal.js'

/**
 * Durable, content-free revocation intent outside the selected database.
 *
 * The immutable migration backup predates later deletions. Each deletion therefore
 * publishes one key-bound intent file before its SQL transaction commits. Restore
 * verifies the complete reserved family and replays it into the copied backup before
 * the selected name is published. Files contain only C1 identifiers and ISO week
 * grain; repository labels, paths, source bytes, and exact timestamps never enter it.
 */

export const STORAGE_V3_REVOCATION_REPLAY_ERROR = 'STORAGE_V3_REVOCATION_REPLAY_INVALID' as const

export class StorageV3RevocationReplayError extends Error {
  readonly code = STORAGE_V3_REVOCATION_REPLAY_ERROR
  constructor() {
    super(STORAGE_V3_REVOCATION_REPLAY_ERROR)
    this.name = 'StorageV3RevocationReplayError'
  }
}

const fail = (): never => { throw new StorageV3RevocationReplayError() }
const VERSION = 'revocation_replay_v1' as const
const FAMILY = 'revocation-replay-v1-' as const
const ANCHOR_SEQUENCE = 0
const ANCHOR_NAME = `${FAMILY}00000000.json` as const
const HEAD_NAME = `${FAMILY}head.json` as const
const HEAD_TEMP_NAME = `${HEAD_NAME}.tmp` as const
const BODY_DOMAIN = 'developer-lens.storage-v3-revocation-replay.v1' as const
const SELECTION_DOMAIN = 'developer-lens.storage-v3-revocation-selection.v1' as const
const ZERO_HASH = '0'.repeat(64)
const HEX = /^[0-9a-f]{64}$/
const ARTIFACT = /^art-[0-9a-f]{64}$/
const LEGACY = /^legacy-[0-9a-f]{64}$/
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const FINAL = /^revocation-replay-v1-(\d{8})\.json$/
const TEMP = /^revocation-replay-v1-(\d{8})\.json\.tmp$/
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0
const MAX_RECORD_BYTES = 16 * 1024 * 1024
const MAX_SUBJECTS = 100_000
const GRACE_MS = 7 * 24 * 60 * 60 * 1000

export const STORAGE_V3_REVOCATION_REPLAY_NAMES = Object.freeze({
  anchor: ANCHOR_NAME,
  head: HEAD_NAME,
  prefix: FAMILY,
})

export type StorageV3RevocationReplayPublicationStage =
  | 'tempClaim'
  | 'tempDurable'
  | 'finalLink'
  | 'tempRemoval'
  | 'headTempDurable'
  | 'headReplace'

type DirectorySynchronizer = (
  root: StorageV3ArtifactRoot,
  stage: StorageV3RevocationReplayPublicationStage,
) => void

type AnchorBody = Readonly<{
  version: typeof VERSION
  kind: 'anchor'
  sequence: 0
  selectionSha256: string
  taskFingerprint: string
  previousBodySha256: string
}>

type EventSubject = Readonly<{
  subjectKind: string
  subjectId: string
  causedBy: string | null
  eventKind: 'tombstone_cascade' | 'index_deleted'
}>

type EventBody = Readonly<{
  version: typeof VERSION
  kind: 'revocation'
  sequence: number
  selectionSha256: string
  taskFingerprint: string
  previousBodySha256: string
  scopeId: string
  operationId: string
  eventWeek: string
  subjects: readonly EventSubject[]
}>

type HeadBody = Readonly<{
  version: typeof VERSION
  kind: 'head'
  phase: 'initializing' | 'committed'
  sequence: number
  selectionSha256: string
  taskFingerprint: string
  lastBodySha256: string
}>

type ReplayBody = AnchorBody | EventBody | HeadBody

type Marker<T extends ReplayBody = ReplayBody> = T & Readonly<{
  bodySha256: string
  installationKeyBinding: string
}>

export type StorageV3RevocationReplayEntry = Readonly<{
  sequence: number
  scopeId: string
  operationId: string
  eventWeek: string
  subjects: readonly EventSubject[]
  bodySha256: string
}>

export type StorageV3RevocationReplayState = Readonly<{
  selectionSha256: string
  entries: readonly StorageV3RevocationReplayEntry[]
}>

export type StorageV3RevocationDeletionStage =
  | 'intentDurable'
  | 'deletionCommitted'
  | 'maintenanceComplete'

export type StorageV3RevocationDeletionInput = Readonly<{
  directory: string
  installationKey: TaskInstallationKeyHandle
  scopeId: string
  asOf: string
  randomBytes?: (size: number) => Buffer
}>

export type StorageV3RevocationDeletionResult = Readonly<{
  deletion: StorageV3ScopeDeletionResult
  replayEntries: number
  maintenance: 'complete'
}>

function own(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return fail()
  return descriptor.value
}

function assertPlain(value: unknown, keys: readonly string[]): object {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail()
  const object = value as object
  const prototype = Object.getPrototypeOf(object)
  if (prototype !== Object.prototype && prototype !== null) return fail()
  const actual = Reflect.ownKeys(object)
  if (actual.length !== keys.length || actual.some((key) => typeof key !== 'string')) return fail()
  const expected = [...keys].sort()
  if (actual.map(String).sort().some((key, index) => key !== expected[index])) return fail()
  return object
}

function canonicalSelection(selection: StorageV3MigrationSelection): StorageV3MigrationSelection {
  const object = assertPlain(selection, [
    'readerState', 'legacySourceId', 'selectedArtifactId', 'backupArtifactId',
    'successfulReportAt', 'graceDeadlineAt',
  ])
  const readerState = own(object, 'readerState')
  const legacySourceId = own(object, 'legacySourceId')
  const selectedArtifactId = own(object, 'selectedArtifactId')
  const backupArtifactId = own(object, 'backupArtifactId')
  const successfulReportAt = own(object, 'successfulReportAt')
  const graceDeadlineAt = own(object, 'graceDeadlineAt')
  if (readerState !== 'v3_selected'
    || typeof legacySourceId !== 'string' || !LEGACY.test(legacySourceId)
    || typeof selectedArtifactId !== 'string' || !ARTIFACT.test(selectedArtifactId)
    || typeof backupArtifactId !== 'string' || !ARTIFACT.test(backupArtifactId)
    || typeof successfulReportAt !== 'string' || !TIMESTAMP.test(successfulReportAt)
    || typeof graceDeadlineAt !== 'string' || !TIMESTAMP.test(graceDeadlineAt)
    || new Date(Date.parse(successfulReportAt) + GRACE_MS).toISOString() !== graceDeadlineAt) return fail()
  return Object.freeze({
    readerState: 'v3_selected' as const,
    legacySourceId,
    selectedArtifactId,
    backupArtifactId,
    successfulReportAt,
    graceDeadlineAt,
  })
}

function selectionSha256(selection: StorageV3MigrationSelection): string {
  const canonical = canonicalSelection(selection)
  // A rolled-back pre-commit family must survive a retry whose runtime report
  // has a new clock value. The durable head phase, not C2 timestamps, prevents
  // a previously committed family from authorizing a later receipt.
  return createHash('sha256')
    .update(`${SELECTION_DOMAIN}\0${JSON.stringify({
      readerState: canonical.readerState,
      legacySourceId: canonical.legacySourceId,
      selectedArtifactId: canonical.selectedArtifactId,
      backupArtifactId: canonical.backupArtifactId,
    })}`, 'utf8')
    .digest('hex')
}

function subjectPrefix(kind: string): string | undefined {
  return C1_KEY_PREFIXES[kind as keyof typeof C1_KEY_PREFIXES]
}

function canonicalSubjects(raw: readonly StorageV3DeletionReplaySubject[], scopeId: string): readonly EventSubject[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SUBJECTS) return fail()
  const subjects = raw.map((value): EventSubject => {
    const object = assertPlain(value, ['subjectKind', 'subjectId', 'causedBy', 'eventKind'])
    const subjectKind = own(object, 'subjectKind')
    const subjectId = own(object, 'subjectId')
    const causedBy = own(object, 'causedBy')
    const eventKind = own(object, 'eventKind')
    const prefix = typeof subjectKind === 'string' ? subjectPrefix(subjectKind) : undefined
    if (prefix === undefined || typeof subjectId !== 'string'
      || !new RegExp(`^${prefix}[0-9a-f]{64}$`).test(subjectId)
      || (causedBy !== null && causedBy !== scopeId)
      || (subjectKind === 'scope' ? causedBy !== null || subjectId !== scopeId : causedBy !== scopeId)
      || (subjectKind === 'artifact' ? eventKind !== 'index_deleted' : eventKind !== 'tombstone_cascade')) return fail()
    return Object.freeze({ subjectKind, subjectId, causedBy, eventKind }) as EventSubject
  }).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  if (subjects.filter((subject) => subject.subjectKind === 'scope' && subject.subjectId === scopeId).length !== 1) return fail()
  const identities = subjects.map((subject) => `${subject.eventKind}\0${subject.subjectKind}\0${subject.subjectId}`)
  if (new Set(identities).size !== identities.length) return fail()
  return Object.freeze(subjects)
}

function anchorBody(selection: StorageV3MigrationSelection, key: TaskInstallationKeyHandle): AnchorBody {
  if (!HEX.test(key.fingerprint)) return fail()
  return Object.freeze({
    version: VERSION,
    kind: 'anchor' as const,
    sequence: ANCHOR_SEQUENCE,
    selectionSha256: selectionSha256(selection),
    taskFingerprint: key.fingerprint,
    previousBodySha256: ZERO_HASH,
  })
}

function eventBody(
  sequence: number,
  previousBodySha256: string,
  selection: StorageV3MigrationSelection,
  key: TaskInstallationKeyHandle,
  input: Readonly<{
    scopeId: string
    operationId: string
    eventWeek: string
    subjects: readonly StorageV3DeletionReplaySubject[]
  }>,
): EventBody {
  if (!Number.isSafeInteger(sequence) || sequence <= 0 || sequence > 99_999_999
    || !HEX.test(previousBodySha256) || !HEX.test(key.fingerprint)
    || !ScopeIdV3Schema.safeParse(input.scopeId).success
    || !DeletionOperationIdV3Schema.safeParse(input.operationId).success
    || !IsoWeekV3Schema.safeParse(input.eventWeek).success) return fail()
  return Object.freeze({
    version: VERSION,
    kind: 'revocation' as const,
    sequence,
    selectionSha256: selectionSha256(selection),
    taskFingerprint: key.fingerprint,
    previousBodySha256,
    scopeId: input.scopeId,
    operationId: input.operationId,
    eventWeek: input.eventWeek,
    subjects: canonicalSubjects(input.subjects, input.scopeId),
  })
}

function headBody(
  phase: HeadBody['phase'],
  sequence: number,
  lastBodySha256: string,
  selection: StorageV3MigrationSelection,
  key: TaskInstallationKeyHandle,
): HeadBody {
  if ((phase !== 'initializing' && phase !== 'committed')
    || !Number.isSafeInteger(sequence) || sequence < 0 || sequence > 99_999_999
    || !HEX.test(lastBodySha256) || !HEX.test(key.fingerprint)) return fail()
  return Object.freeze({
    version: VERSION,
    kind: 'head' as const,
    phase,
    sequence,
    selectionSha256: selectionSha256(selection),
    taskFingerprint: key.fingerprint,
    lastBodySha256,
  })
}

function markerFor<T extends ReplayBody>(body: T, key: TaskInstallationKeyHandle): Marker<T> {
  const bodySha256 = createHash('sha256')
    .update(`${BODY_DOMAIN}\0${JSON.stringify(body)}`, 'utf8')
    .digest('hex')
  const installationKeyBinding = bindTaskInstallationKeyBody(key, bodySha256)
  if (!HEX.test(installationKeyBinding)) return fail()
  return Object.freeze({ ...body, bodySha256, installationKeyBinding }) as unknown as Marker<T>
}

function markerBytes(marker: Marker): Buffer {
  const bytes = Buffer.from(`${JSON.stringify(marker)}\n`, 'utf8')
  if (bytes.length <= 0 || bytes.length > MAX_RECORD_BYTES) return fail()
  return bytes
}

function compareBytes(left: Buffer, right: Buffer): void {
  if (left.length !== right.length || !timingSafeEqual(left, right)) return fail()
}

function stat(path: string): BigIntStats | undefined {
  try { return lstatSync(path, { bigint: true }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    return fail()
  }
}

function assertFile(entry: BigIntStats, nlink: bigint): void {
  if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== nlink) return fail()
  if (process.platform !== 'win32' && (entry.mode & 0o777n) !== 0o600n) return fail()
}

function assertDescriptorPath(
  path: string,
  descriptor: number,
  nlink: bigint,
  size: bigint,
): BigIntStats {
  const before = stat(path)
  if (before === undefined) return fail()
  const canonical = (() => { try { return realpathSync.native(path) } catch { return undefined } })()
  const opened = fstatSync(descriptor, { bigint: true })
  const after = stat(path)
  if (after === undefined || canonical !== path) return fail()
  for (const entry of [before, opened, after]) assertFile(entry, nlink)
  if (before.size !== size || opened.size !== size || after.size !== size
    || before.dev !== opened.dev || before.ino !== opened.ino
    || after.dev !== opened.dev || after.ino !== opened.ino) return fail()
  return opened
}

function readExact(path: string, nlink = 1n): Buffer {
  let descriptor: number | undefined
  try {
    descriptor = openSync(path, constants.O_RDONLY | NO_FOLLOW)
    const opened = fstatSync(descriptor, { bigint: true })
    assertFile(opened, nlink)
    if (opened.size <= 0n || opened.size > BigInt(MAX_RECORD_BYTES)) return fail()
    const exact = Buffer.alloc(Number(opened.size))
    let offset = 0
    while (offset < exact.length) {
      const count = readSync(descriptor, exact, offset, exact.length - offset, offset)
      if (count <= 0) return fail()
      offset += count
    }
    if (readSync(descriptor, Buffer.alloc(1), 0, 1, exact.length) !== 0) return fail()
    assertDescriptorPath(path, descriptor, nlink, BigInt(exact.length))
    return exact
  } catch (error) {
    if (error instanceof StorageV3RevocationReplayError) throw error
    return fail()
  } finally { if (descriptor !== undefined) closeSync(descriptor) }
}

function writeExact(path: string, descriptor: number, bytes: Buffer): void {
  let offset = 0
  while (offset < bytes.length) {
    const count = writeSync(descriptor, bytes, offset, bytes.length - offset, offset)
    if (count <= 0) return fail()
    offset += count
  }
  fsyncSync(descriptor)
  assertDescriptorPath(path, descriptor, 1n, BigInt(bytes.length))
}

function sequenceName(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > 99_999_999) return fail()
  return `${FAMILY}${String(sequence).padStart(8, '0')}.json`
}

function familyNames(root: StorageV3ArtifactRoot): Readonly<{
  finals: readonly string[]
  temps: readonly string[]
  head: boolean
  headTemp: boolean
}> {
  const anchorPath = storageV3ArtifactFilePath(root, ANCHOR_NAME)
  let names: string[]
  try { names = readdirSync(dirname(anchorPath)) } catch { return fail() }
  const finals: string[] = []
  const temps: string[] = []
  let head = false
  let headTemp = false
  for (const name of names) {
    if (!name.toLowerCase().startsWith(FAMILY)) continue
    const finalMatch = FINAL.exec(name)
    const tempMatch = TEMP.exec(name)
    if (finalMatch) finals.push(name)
    else if (tempMatch) temps.push(name)
    else if (name === HEAD_NAME) head = true
    else if (name === HEAD_TEMP_NAME) headTemp = true
    else return fail()
  }
  return Object.freeze({
    finals: Object.freeze(finals.sort()),
    temps: Object.freeze(temps.sort()),
    head,
    headTemp,
  })
}

function inventory(root: StorageV3ArtifactRoot, allowedTemp?: string): readonly string[] {
  const names = familyNames(root)
  const temps = [...names.temps, ...(names.headTemp ? [HEAD_TEMP_NAME] : [])]
  if ((allowedTemp === undefined && temps.length !== 0)
    || (allowedTemp !== undefined && (temps.length > 1
      || (temps.length === 1 && temps[0] !== allowedTemp)))) return fail()
  return names.finals
}

function assertSelectionProofNamespaceAbsent(root: StorageV3ArtifactRoot): void {
  const finalPath = storageV3ArtifactFilePath(root, STORAGE_V3_SELECTION_PROOF_NAMES.final)
  let names: string[]
  try { names = readdirSync(dirname(finalPath)) } catch { return fail() }
  const reserved = STORAGE_V3_SELECTION_PROOF_NAMES.final.toLowerCase()
  if (names.some((name) => name.toLowerCase().startsWith(reserved))) return fail()
}

function exactPair(tempPath: string, finalPath: string, bytes: Buffer): void {
  const temp = stat(tempPath)
  const final = stat(finalPath)
  if (temp === undefined || final === undefined) return fail()
  assertFile(temp, 2n)
  assertFile(final, 2n)
  if (temp.dev !== final.dev || temp.ino !== final.ino) return fail()
  compareBytes(readExact(tempPath, 2n), bytes)
  compareBytes(readExact(finalPath, 2n), bytes)
}

function publishRecord(
  root: StorageV3ArtifactRoot,
  sequence: number,
  bytes: Buffer,
  synchronize: DirectorySynchronizer,
  failAtStage?: StorageV3RevocationReplayPublicationStage,
): 'published' | 'replayed' {
  const finalName = sequenceName(sequence)
  const tempName = `${finalName}.tmp`
  const finalPath = storageV3ArtifactFilePath(root, finalName)
  const tempPath = storageV3ArtifactFilePath(root, tempName)
  inventory(root, tempName)
  let existingFinal = stat(finalPath)
  let existingTemp = stat(tempPath)
  if (existingTemp !== undefined && existingTemp.size === 0n) {
    assertFile(existingTemp, 1n)
    const reproved = stat(tempPath)
    if (reproved === undefined || reproved.dev !== existingTemp.dev || reproved.ino !== existingTemp.ino) return fail()
    unlinkSync(tempPath)
    synchronize(root, 'tempRemoval')
    existingTemp = undefined
  }
  if (existingFinal !== undefined && existingTemp === undefined) {
    assertFile(existingFinal, 1n)
    compareBytes(readExact(finalPath), bytes)
    synchronize(root, 'tempRemoval')
    compareBytes(readExact(finalPath), bytes)
    return 'replayed'
  }
  if (existingFinal !== undefined && existingTemp !== undefined) exactPair(tempPath, finalPath, bytes)
  else if (existingTemp !== undefined) {
    assertFile(existingTemp, 1n)
    compareBytes(readExact(tempPath), bytes)
  } else {
    let descriptor: number | undefined
    try {
      descriptor = openSync(tempPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | NO_FOLLOW, 0o600)
      assertDescriptorPath(tempPath, descriptor, 1n, 0n)
      synchronize(root, 'tempClaim')
      if (failAtStage === 'tempClaim') throw new Error('invented revocation interruption')
      writeExact(tempPath, descriptor, bytes)
      synchronize(root, 'tempDurable')
      if (failAtStage === 'tempDurable') throw new Error('invented revocation interruption')
    } finally { if (descriptor !== undefined) closeSync(descriptor) }
  }
  existingFinal = stat(finalPath)
  if (existingFinal === undefined) {
    try { linkSync(tempPath, finalPath) } catch { return fail() }
    exactPair(tempPath, finalPath, bytes)
    synchronize(root, 'finalLink')
    if (failAtStage === 'finalLink') throw new Error('invented revocation interruption')
  } else {
    exactPair(tempPath, finalPath, bytes)
    // Recovery must establish final-name durability before removing the only
    // name known to have survived the preceding interruption.
    synchronize(root, 'finalLink')
  }
  exactPair(tempPath, finalPath, bytes)
  unlinkSync(tempPath)
  synchronize(root, 'tempRemoval')
  if (failAtStage === 'tempRemoval') throw new Error('invented revocation interruption')
  compareBytes(readExact(finalPath), bytes)
  inventory(root)
  return 'published'
}

function publishHead(
  root: StorageV3ArtifactRoot,
  previousBytes: Buffer | undefined,
  bytes: Buffer,
  synchronize: DirectorySynchronizer,
  failAtStage?: StorageV3RevocationReplayPublicationStage,
): 'published' | 'replayed' {
  const finalPath = storageV3ArtifactFilePath(root, HEAD_NAME)
  const tempPath = storageV3ArtifactFilePath(root, HEAD_TEMP_NAME)
  const names = familyNames(root)
  if (names.temps.length !== 0) return fail()
  let existingFinal = stat(finalPath)
  let existingTemp = stat(tempPath)
  if (existingTemp !== undefined && existingTemp.size === 0n) {
    assertFile(existingTemp, 1n)
    const reproved = stat(tempPath)
    if (reproved === undefined || reproved.dev !== existingTemp.dev || reproved.ino !== existingTemp.ino) return fail()
    unlinkSync(tempPath)
    synchronize(root, 'tempRemoval')
    existingTemp = undefined
  }
  if (existingFinal !== undefined) {
    assertFile(existingFinal, 1n)
    const current = readExact(finalPath)
    if (previousBytes === undefined) {
      compareBytes(current, bytes)
      if (existingTemp !== undefined) return fail()
      return 'replayed'
    }
    if (current.length === bytes.length && timingSafeEqual(current, bytes)) {
      if (existingTemp !== undefined) return fail()
      return 'replayed'
    }
    compareBytes(current, previousBytes)
  } else if (previousBytes !== undefined) return fail()
  if (existingTemp !== undefined) {
    assertFile(existingTemp, 1n)
    compareBytes(readExact(tempPath), bytes)
  } else {
    let descriptor: number | undefined
    try {
      descriptor = openSync(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NO_FOLLOW, 0o600)
      if (failAtStage === 'tempClaim') throw new Error('invented revocation interruption')
      writeExact(tempPath, descriptor, bytes)
    } catch (error) {
      if (error instanceof StorageV3RevocationReplayError || (error as Error).message === 'invented revocation interruption') {
        throw error
      }
      return fail()
    } finally { if (descriptor !== undefined) closeSync(descriptor) }
    synchronize(root, 'headTempDurable')
    if (failAtStage === 'headTempDurable') throw new Error('invented revocation interruption')
  }
  compareBytes(readExact(tempPath), bytes)
  existingFinal = stat(finalPath)
  if (previousBytes === undefined) {
    if (existingFinal !== undefined) return fail()
  } else {
    if (existingFinal === undefined) return fail()
    compareBytes(readExact(finalPath), previousBytes)
  }
  renameSync(tempPath, finalPath)
  synchronize(root, 'headReplace')
  if (failAtStage === 'headReplace') throw new Error('invented revocation interruption')
  compareBytes(readExact(finalPath), bytes)
  inventory(root)
  return 'published'
}

function parseMarker(
  bytes: Buffer,
  key: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
): Marker {
  let raw: unknown
  try { raw = JSON.parse(bytes.toString('utf8')) } catch { return fail() }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fail()
  const rawKind = own(raw as object, 'kind')
  const expectedKeys = rawKind === 'anchor'
    ? ['version', 'kind', 'sequence', 'selectionSha256', 'taskFingerprint', 'previousBodySha256', 'bodySha256', 'installationKeyBinding']
    : rawKind === 'head'
      ? ['version', 'kind', 'phase', 'sequence', 'selectionSha256', 'taskFingerprint', 'lastBodySha256', 'bodySha256', 'installationKeyBinding']
      : ['version', 'kind', 'sequence', 'selectionSha256', 'taskFingerprint', 'previousBodySha256', 'scopeId', 'operationId', 'eventWeek', 'subjects', 'bodySha256', 'installationKeyBinding']
  const object = assertPlain(raw, expectedKeys)
  const selectionHash = own(object, 'selectionSha256')
  const taskFingerprint = own(object, 'taskFingerprint')
  const bodySha256 = own(object, 'bodySha256')
  const binding = own(object, 'installationKeyBinding')
  if (own(object, 'version') !== VERSION
    || selectionHash !== selectionSha256(selection)
    || taskFingerprint !== key.fingerprint
    || typeof bodySha256 !== 'string' || !HEX.test(bodySha256)
    || typeof binding !== 'string' || !HEX.test(binding)) return fail()
  let body: ReplayBody
  if (rawKind === 'anchor') {
    const previousBodySha256 = own(object, 'previousBodySha256')
    if (typeof previousBodySha256 !== 'string' || !HEX.test(previousBodySha256)) return fail()
    if (own(object, 'sequence') !== 0 || previousBodySha256 !== ZERO_HASH) return fail()
    body = anchorBody(selection, key)
  } else if (rawKind === 'head') {
    const phase = own(object, 'phase')
    const sequence = own(object, 'sequence')
    const lastBodySha256 = own(object, 'lastBodySha256')
    if ((phase !== 'initializing' && phase !== 'committed')
      || typeof sequence !== 'number' || typeof lastBodySha256 !== 'string'
      || !HEX.test(lastBodySha256)) return fail()
    body = headBody(phase, sequence, lastBodySha256, selection, key)
  } else if (rawKind === 'revocation') {
    const sequence = own(object, 'sequence')
    const previousBodySha256 = own(object, 'previousBodySha256')
    const scopeId = own(object, 'scopeId')
    const operationId = own(object, 'operationId')
    const eventWeek = own(object, 'eventWeek')
    const subjects = own(object, 'subjects')
    if (typeof sequence !== 'number' || typeof previousBodySha256 !== 'string' || !HEX.test(previousBodySha256)
      || typeof scopeId !== 'string'
      || typeof operationId !== 'string' || typeof eventWeek !== 'string'
      || !Array.isArray(subjects)) return fail()
    body = eventBody(sequence, previousBodySha256, selection, key, {
      scopeId,
      operationId,
      eventWeek,
      subjects: subjects as readonly StorageV3DeletionReplaySubject[],
    })
  } else return fail()
  const expected = markerFor(body, key)
  if (expected.bodySha256 !== bodySha256 || expected.installationKeyBinding !== binding) return fail()
  compareBytes(markerBytes(expected), bytes)
  return expected
}

type ReplayChain = Readonly<{
  state: StorageV3RevocationReplayState
  bodyHashes: readonly string[]
}>

function readChain(
  root: StorageV3ArtifactRoot,
  key: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  allowedTemp?: string,
): ReplayChain {
  const names = inventory(root, allowedTemp)
  if (names.length === 0 || names[0] !== ANCHOR_NAME) return fail()
  const anchorNlink = allowedTemp === `${ANCHOR_NAME}.tmp` ? 2n : 1n
  const anchorBytes = readExact(storageV3ArtifactFilePath(root, ANCHOR_NAME), anchorNlink)
  if (anchorNlink === 2n) exactPair(
    storageV3ArtifactFilePath(root, `${ANCHOR_NAME}.tmp`),
    storageV3ArtifactFilePath(root, ANCHOR_NAME),
    anchorBytes,
  )
  const anchor = parseMarker(anchorBytes, key, selection)
  if (anchor.kind !== 'anchor') return fail()
  let previous = anchor.bodySha256
  const bodyHashes = [anchor.bodySha256]
  const entries: StorageV3RevocationReplayEntry[] = []
  for (let index = 1; index < names.length; index += 1) {
    const name = names[index]
    if (name !== sequenceName(index)) return fail()
    const nlink = allowedTemp === `${name}.tmp` ? 2n : 1n
    const bytes = readExact(storageV3ArtifactFilePath(root, name!), nlink)
    if (nlink === 2n) exactPair(
      storageV3ArtifactFilePath(root, `${name}.tmp`),
      storageV3ArtifactFilePath(root, name!),
      bytes,
    )
    const marker = parseMarker(bytes, key, selection)
    if (marker.kind !== 'revocation' || marker.sequence !== index
      || marker.previousBodySha256 !== previous) return fail()
    entries.push(Object.freeze({
      sequence: marker.sequence,
      scopeId: marker.scopeId,
      operationId: marker.operationId,
      eventWeek: marker.eventWeek,
      subjects: marker.subjects,
      bodySha256: marker.bodySha256,
    }))
    previous = marker.bodySha256
    bodyHashes.push(marker.bodySha256)
  }
  const scopes = entries.map((entry) => entry.scopeId)
  if (new Set(scopes).size !== scopes.length) return fail()
  return Object.freeze({
    state: Object.freeze({
      selectionSha256: selectionSha256(selection),
      entries: Object.freeze(entries),
    }),
    bodyHashes: Object.freeze(bodyHashes),
  })
}

function readHead(
  root: StorageV3ArtifactRoot,
  key: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
): Readonly<{ marker: Marker<HeadBody>; bytes: Buffer }> {
  if (!familyNames(root).head) return fail()
  const bytes = readExact(storageV3ArtifactFilePath(root, HEAD_NAME))
  const marker = parseMarker(bytes, key, selection)
  if (marker.kind !== 'head') return fail()
  return Object.freeze({ marker, bytes })
}

function headMatchesChain(head: Marker<HeadBody>, chain: ReplayChain): boolean {
  return head.sequence === chain.state.entries.length
    && head.lastBodySha256 === chain.bodyHashes.at(-1)
}

function assertHeadMatchesChain(head: Marker<HeadBody>, chain: ReplayChain): void {
  if (!headMatchesChain(head, chain)) return fail()
}

function verifyInternal(
  root: StorageV3ArtifactRoot,
  key: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  lease: StorageV3WriterLease,
  expectedPhase: HeadBody['phase'] = 'committed',
): StorageV3RevocationReplayState {
  assertStorageV3WriterLease(root, lease)
  assertStorageV3ArtifactRootInstallationKey(root, key)
  const chain = readChain(root, key, selection)
  const head = readHead(root, key, selection).marker
  if (head.phase !== expectedPhase) return fail()
  assertHeadMatchesChain(head, chain)
  return chain.state
}

function recoverPendingRecord(
  root: StorageV3ArtifactRoot,
  key: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  lease: StorageV3WriterLease,
  synchronize: DirectorySynchronizer,
): void {
  assertStorageV3WriterLease(root, lease)
  assertStorageV3ArtifactRootInstallationKey(root, key)
  let names = familyNames(root)
  if (names.temps.length > 1 || (names.temps.length !== 0 && names.headTemp)) return fail()
  if (!names.head && names.headTemp && names.temps.length === 0) {
    const chain = readChain(root, key, selection, HEAD_TEMP_NAME)
    if (chain.state.entries.length !== 0) return fail()
    const initialBytes = markerBytes(markerFor(
      headBody('initializing', 0, chain.bodyHashes[0]!, selection, key),
      key,
    ))
    publishHead(root, undefined, initialBytes, synchronize)
    names = familyNames(root)
  }
  if (names.temps.length === 1) {
    const tempName = names.temps[0]!
    const match = TEMP.exec(tempName)
    if (!match) return fail()
    const sequence = Number(match[1])
    const finalName = sequenceName(sequence)
    const finalPath = storageV3ArtifactFilePath(root, finalName)
    const tempPath = storageV3ArtifactFilePath(root, tempName)
    const temp = stat(tempPath)
    if (temp === undefined) return fail()
    if (temp.size === 0n) {
      assertFile(temp, 1n)
      if (stat(finalPath) !== undefined) return fail()
      const reproved = stat(tempPath)
      if (reproved === undefined || reproved.dev !== temp.dev || reproved.ino !== temp.ino) return fail()
      unlinkSync(tempPath)
      synchronize(root, 'tempRemoval')
    } else {
      const head = readHead(root, key, selection).marker
      const final = stat(finalPath)
      if (final !== undefined) {
        const chain = readChain(root, key, selection, tempName)
        const priorHash = chain.bodyHashes[head.sequence]
        if (!headMatchesChain(head, chain)
          && (chain.state.entries.length !== head.sequence + 1
            || head.lastBodySha256 !== priorHash)) return fail()
        const bytes = readExact(finalPath, 2n)
        publishRecord(root, sequence, bytes, synchronize)
      } else {
        const chain = readChain(root, key, selection, tempName)
        assertHeadMatchesChain(head, chain)
        const bytes = readExact(tempPath)
        const marker = parseMarker(bytes, key, selection)
        if (sequence !== chain.state.entries.length + 1
          || marker.kind !== 'revocation' || marker.sequence !== sequence
          || marker.previousBodySha256 !== chain.bodyHashes.at(-1)) return fail()
        publishRecord(root, sequence, bytes, synchronize)
      }
    }
  }
  names = familyNames(root)
  if (names.temps.length !== 0 || !names.head) return fail()
  const allowedHeadTemp = names.headTemp ? HEAD_TEMP_NAME : undefined
  const chain = readChain(root, key, selection, allowedHeadTemp)
  const head = readHead(root, key, selection)
  if (headMatchesChain(head.marker, chain)) {
    if (names.headTemp) return fail()
    return
  }
  if (chain.state.entries.length !== head.marker.sequence + 1
    || head.marker.lastBodySha256 !== chain.bodyHashes[head.marker.sequence]) return fail()
  const nextBytes = markerBytes(markerFor(
    headBody('committed', chain.state.entries.length, chain.bodyHashes.at(-1)!, selection, key),
    key,
  ))
  publishHead(root, head.bytes, nextBytes, synchronize)
}

function initializeInternal(
  root: StorageV3ArtifactRoot,
  key: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  initializationGrant: StorageV3MigrationSelectionInitializationGrant,
  lease: StorageV3WriterLease,
  synchronize: DirectorySynchronizer,
  failAtStage?: StorageV3RevocationReplayPublicationStage,
): StorageV3RevocationReplayState {
  assertStorageV3WriterLease(root, lease)
  assertStorageV3ArtifactRootInstallationKey(root, key)
  consumeStorageV3MigrationSelectionInitialization(initializationGrant, selection)
  assertSelectionProofNamespaceAbsent(root)
  const names = familyNames(root)
  if (names.finals.some((name) => name !== ANCHOR_NAME)
    || names.temps.some((name) => name !== `${ANCHOR_NAME}.tmp`)) return fail()
  if ((names.head || names.headTemp)
    && (names.finals.length !== 1 || names.finals[0] !== ANCHOR_NAME
      || names.temps.length !== 0)) return fail()
  const anchor = markerFor(anchorBody(selection, key), key)
  const anchorBytes = markerBytes(anchor)
  if (names.headTemp) {
    if (names.head || names.temps.length !== 0 || names.finals.length !== 1
      || names.finals[0] !== ANCHOR_NAME) return fail()
    compareBytes(readExact(storageV3ArtifactFilePath(root, ANCHOR_NAME)), anchorBytes)
  } else {
    publishRecord(root, 0, anchorBytes, synchronize, failAtStage)
  }
  const initialHead = markerFor(headBody('initializing', 0, anchor.bodySha256, selection, key), key)
  publishHead(root, undefined, markerBytes(initialHead), synchronize, failAtStage)
  return verifyInternal(root, key, selection, lease, 'initializing')
}

function recoverInternal(
  root: StorageV3ArtifactRoot,
  key: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  lease: StorageV3WriterLease,
  synchronize: DirectorySynchronizer,
): StorageV3RevocationReplayState {
  recoverPendingRecord(root, key, selection, lease, synchronize)
  return verifyInternal(root, key, selection, lease)
}

function commitInitializationInternal(
  root: StorageV3ArtifactRoot,
  key: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  lease: StorageV3WriterLease,
  synchronize: DirectorySynchronizer,
): StorageV3RevocationReplayState {
  assertStorageV3WriterLease(root, lease)
  assertStorageV3ArtifactRootInstallationKey(root, key)
  const names = familyNames(root)
  if (names.temps.length !== 0) return fail()
  const chain = readChain(root, key, selection, names.headTemp ? HEAD_TEMP_NAME : undefined)
  const head = readHead(root, key, selection)
  assertHeadMatchesChain(head.marker, chain)
  if (head.marker.phase === 'committed') {
    if (names.headTemp) return fail()
    return chain.state
  }
  if (head.marker.phase !== 'initializing' || chain.state.entries.length !== 0) return fail()
  const committed = markerBytes(markerFor(
    headBody('committed', 0, chain.bodyHashes[0]!, selection, key),
    key,
  ))
  publishHead(root, head.bytes, committed, synchronize)
  return verifyInternal(root, key, selection, lease)
}

/** Initialize the empty replay family only for a receipt recorded in this call. */
export function initializeStorageV3RevocationReplay(
  root: StorageV3ArtifactRoot,
  installationKey: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  initializationGrant: StorageV3MigrationSelectionInitializationGrant,
  lease: StorageV3WriterLease,
): StorageV3RevocationReplayState {
  assertStorageV3ArtifactDirectorySyncSupported()
  return initializeInternal(
    root,
    installationKey,
    selection,
    initializationGrant,
    lease,
    (value) => syncStorageV3ArtifactDirectory(value),
  )
}

/** Verify the complete external replay chain under the same lifecycle writer lease. */
export function verifyStorageV3RevocationReplay(
  root: StorageV3ArtifactRoot,
  installationKey: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  lease: StorageV3WriterLease,
): StorageV3RevocationReplayState {
  return verifyInternal(root, installationKey, selection, lease)
}

function appendInternal(
  root: StorageV3ArtifactRoot,
  key: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  lease: StorageV3WriterLease,
  input: Readonly<{
    scopeId: string
    operationId: string
    eventWeek: string
    subjects: readonly StorageV3DeletionReplaySubject[]
  }>,
  synchronize: DirectorySynchronizer,
  failAtStage?: StorageV3RevocationReplayPublicationStage,
): StorageV3RevocationReplayState {
  let state = recoverInternal(root, key, selection, lease, synchronize)
  const existing = state.entries.find((entry) => entry.scopeId === input.scopeId)
  const canonical = canonicalSubjects(input.subjects, input.scopeId)
  if (existing !== undefined) {
    if (existing.operationId !== input.operationId || existing.eventWeek !== input.eventWeek
      || JSON.stringify(existing.subjects) !== JSON.stringify(canonical)) return fail()
    return state
  }
  const previous = state.entries.at(-1)?.bodySha256
    ?? parseMarker(readExact(storageV3ArtifactFilePath(root, ANCHOR_NAME)), key, selection).bodySha256
  const body = eventBody(state.entries.length + 1, previous, selection, key, {
    ...input,
    subjects: canonical,
  })
  const head = readHead(root, key, selection)
  publishRecord(root, body.sequence, markerBytes(markerFor(body, key)), synchronize, failAtStage)
  const chain = readChain(root, key, selection)
  publishHead(root, head.bytes, markerBytes(markerFor(
    headBody('committed', chain.state.entries.length, chain.bodyHashes.at(-1)!, selection, key),
    key,
  )), synchronize, failAtStage)
  state = verifyInternal(root, key, selection, lease)
  return state
}

function canonicalTimestampForIsoWeek(eventWeek: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(eventWeek)
  if (!match || !IsoWeekV3Schema.safeParse(eventWeek).success) return fail()
  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + ((week - 1) * 7))
  const timestamp = monday.toISOString()
  if (isoWeekFromCanonicalTimestamp(timestamp) !== eventWeek) return fail()
  return timestamp
}

function assertEntryApplied(db: Database.Database, entry: StorageV3RevocationReplayEntry): void {
  if (db.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(entry.scopeId)) return fail()
  for (const subject of entry.subjects) {
    const rows = db.prepare(
      `SELECT operation_id, caused_by, event_kind, event_week, capability_id
       FROM lineage_event
       WHERE scope_id IS NULL AND subject_kind = ? AND subject_id = ?
         AND event_kind IN ('tombstone_cascade', 'index_deleted')`,
    ).all(subject.subjectKind, subject.subjectId) as Array<Record<string, unknown>>
    if (rows.length !== 1 || rows[0]?.operation_id !== entry.operationId
      || rows[0]?.caused_by !== subject.causedBy || rows[0]?.event_kind !== subject.eventKind
      || rows[0]?.event_week !== entry.eventWeek || rows[0]?.capability_id !== 'github.core') return fail()
  }
}

/** Assert that every durable external intent is reflected in this selected store. */
export function assertStorageV3RevocationReplayApplied(
  db: Database.Database,
  state: StorageV3RevocationReplayState,
): void {
  try {
    assertStorageV3ArtifactCatalogue(db)
    for (const entry of state.entries) assertEntryApplied(db, entry)
  } catch (error) {
    if (error instanceof StorageV3RevocationReplayError) throw error
    return fail()
  }
}

function insertMissingReplaySubjects(
  db: Database.Database,
  entry: StorageV3RevocationReplayEntry,
): void {
  db.transaction(() => {
    const existing = db.prepare(
      `SELECT operation_id, caused_by, event_kind, event_week
       FROM lineage_event WHERE scope_id IS NULL AND subject_kind = ? AND subject_id = ?
         AND event_kind IN ('tombstone_cascade', 'index_deleted')`,
    )
    const insert = db.prepare(
      `INSERT INTO lineage_event (
        scope_id, subject_kind, subject_id, operation_id, capability_id,
        caused_by, event_kind, event_week
      ) VALUES (NULL, ?, ?, ?, 'github.core', ?, ?, ?)`,
    )
    for (const subject of entry.subjects) {
      const rows = existing.all(subject.subjectKind, subject.subjectId) as Array<Record<string, unknown>>
      if (rows.length === 0) {
        insert.run(
          subject.subjectKind,
          subject.subjectId,
          entry.operationId,
          subject.causedBy,
          subject.eventKind,
          entry.eventWeek,
        )
      } else if (rows.length !== 1 || rows[0]?.operation_id !== entry.operationId
        || rows[0]?.caused_by !== subject.causedBy || rows[0]?.event_kind !== subject.eventKind
        || rows[0]?.event_week !== entry.eventWeek) return fail()
    }
  }).immediate()
}

/** Replay all durable intents into a writable copied/selected store, idempotently. */
export function replayStorageV3Revocations(
  db: Database.Database,
  state: StorageV3RevocationReplayState,
): number {
  if (!db?.open || db.readonly || db.inTransaction) return fail()
  if (storageV3MaintenanceStatus(db) === 'pending') {
    completeStorageV3DeletionMaintenance(db)
  }
  let applied = 0
  for (const entry of state.entries) {
    let alreadyApplied = true
    try { assertEntryApplied(db, entry) } catch { alreadyApplied = false }
    if (alreadyApplied) continue
    const scopeExists = db.prepare('SELECT 1 FROM claim_scope WHERE scope_id = ?').get(entry.scopeId) !== undefined
    if (scopeExists) {
      const result = deleteStorageV3Scope({
        db,
        scopeId: entry.scopeId,
        asOf: canonicalTimestampForIsoWeek(entry.eventWeek),
        operationId: entry.operationId,
      })
      if (result.maintenance === 'pending') completeStorageV3DeletionMaintenance(db)
    }
    insertMissingReplaySubjects(db, entry)
    assertEntryApplied(db, entry)
    applied += 1
  }
  assertStorageV3RevocationReplayApplied(db, state)
  return applied
}

function closeDeletionInput(raw: StorageV3RevocationDeletionInput): StorageV3RevocationDeletionInput {
  const object = assertPlain(raw, raw.randomBytes === undefined
    ? ['directory', 'installationKey', 'scopeId', 'asOf']
    : ['directory', 'installationKey', 'scopeId', 'asOf', 'randomBytes'])
  const directory = own(object, 'directory')
  const installationKey = own(object, 'installationKey')
  const scopeId = own(object, 'scopeId')
  const asOf = own(object, 'asOf')
  const randomBytes = Reflect.ownKeys(object).includes('randomBytes') ? own(object, 'randomBytes') : undefined
  if (typeof directory !== 'string' || directory.length === 0
    || !installationKey || typeof installationKey !== 'object'
    || typeof scopeId !== 'string' || !ScopeIdV3Schema.safeParse(scopeId).success
    || typeof asOf !== 'string' || !TIMESTAMP.test(asOf)
    || (randomBytes !== undefined && typeof randomBytes !== 'function')) return fail()
  // The shared converter is the canonical timestamp validator.
  isoWeekFromCanonicalTimestamp(asOf)
  return Object.freeze({
    directory,
    installationKey: installationKey as TaskInstallationKeyHandle,
    scopeId,
    asOf,
    ...(randomBytes === undefined ? {} : { randomBytes: randomBytes as (size: number) => Buffer }),
  })
}

function runDeletion(
  rawInput: StorageV3RevocationDeletionInput,
  synchronize: DirectorySynchronizer,
  failAfterStage?: (stage: StorageV3RevocationDeletionStage) => void,
): StorageV3RevocationDeletionResult {
  const input = closeDeletionInput(rawInput)
  const root = openStorageV3ArtifactRoot(input.directory)
  assertStorageV3ArtifactRootInstallationKey(root, input.installationKey)
  return withStorageV3WriterLease(root, (lease) => {
    const db = openSelectedStorageV3Store(input.directory)
    try {
      const selection = readStorageV3MigrationSelection(db)
      if (selection === undefined) return fail()
      let state = recoverInternal(root, input.installationKey, selection, lease, synchronize)
      const eventWeek = isoWeekFromCanonicalTimestamp(input.asOf)
      const pending = state.entries.find((entry) => entry.scopeId === input.scopeId)
      let operationId: string
      let subjects: readonly StorageV3DeletionReplaySubject[]
      if (pending !== undefined) {
        if (pending.eventWeek !== eventWeek) return fail()
        operationId = pending.operationId
        subjects = pending.subjects
      } else {
        const plan = planStorageV3ScopeDeletion({
          db,
          scopeId: input.scopeId,
          asOf: input.asOf,
          randomBytes: input.randomBytes ?? cryptoRandomBytes,
        })
        operationId = plan.operationId
        subjects = plan.subjects
        state = appendInternal(root, input.installationKey, selection, lease, {
          scopeId: input.scopeId,
          operationId,
          eventWeek,
          subjects,
        }, synchronize)
      }
      failAfterStage?.('intentDurable')
      const deletion = deleteStorageV3Scope({
        db,
        scopeId: input.scopeId,
        asOf: input.asOf,
        operationId,
      })
      failAfterStage?.('deletionCommitted')
      if (deletion.maintenance === 'pending') completeStorageV3DeletionMaintenance(db)
      failAfterStage?.('maintenanceComplete')
      state = verifyInternal(root, input.installationKey, selection, lease)
      replayStorageV3Revocations(db, state)
      assertStorageV3RevocationReplayApplied(db, state)
      return Object.freeze({ deletion, replayEntries: state.entries.length, maintenance: 'complete' as const })
    } finally { if (db.open) db.close() }
  })
}

/** Delete one selected-store scope only after its external replay intent is durable. */
export function deleteStorageV3ScopeWithRevocationReplay(
  input: StorageV3RevocationDeletionInput,
): StorageV3RevocationDeletionResult {
  assertStorageV3ArtifactDirectorySyncSupported()
  return runDeletion(input, (root) => syncStorageV3ArtifactDirectory(root))
}

function resumeInternal(
  directory: string,
  installationKey: TaskInstallationKeyHandle,
  synchronize: DirectorySynchronizer,
): number {
  const root = openStorageV3ArtifactRoot(directory)
  assertStorageV3ArtifactRootInstallationKey(root, installationKey)
  return withStorageV3WriterLease(root, (lease) => {
    const db = openSelectedStorageV3Store(directory)
    try {
      const selection = readStorageV3MigrationSelection(db)
      if (selection === undefined) return fail()
      const state = recoverInternal(
        root,
        installationKey,
        selection,
        lease,
        synchronize,
      )
      return replayStorageV3Revocations(db, state)
    } finally { if (db.open) db.close() }
  })
}

/** Commit the pre-receipt empty family after the receipt transaction succeeds. */
export function commitStorageV3RevocationReplayInitialization(
  root: StorageV3ArtifactRoot,
  installationKey: TaskInstallationKeyHandle,
  selection: StorageV3MigrationSelection,
  lease: StorageV3WriterLease,
): StorageV3RevocationReplayState {
  assertStorageV3ArtifactDirectorySyncSupported()
  return commitInitializationInternal(
    root,
    installationKey,
    selection,
    lease,
    (value) => syncStorageV3ArtifactDirectory(value),
  )
}

/** Resume durable intents after a crash before/during selected-store deletion. */
export function resumeStorageV3RevocationReplay(
  directory: string,
  installationKey: TaskInstallationKeyHandle,
): number {
  return resumeInternal(
    directory,
    installationKey,
    (value) => syncStorageV3ArtifactDirectory(value),
  )
}

/** @internal Invented-fixture durability/failure seams. */
export const v3RevocationReplayTestSeams = Object.freeze({
  ensureWithDirectorySynchronizer(
    root: StorageV3ArtifactRoot,
    installationKey: TaskInstallationKeyHandle,
    selection: StorageV3MigrationSelection,
    initializationGrant: StorageV3MigrationSelectionInitializationGrant,
    lease: StorageV3WriterLease,
    synchronize: DirectorySynchronizer,
    failAtStage?: StorageV3RevocationReplayPublicationStage,
  ): StorageV3RevocationReplayState {
    if (typeof synchronize !== 'function') return fail()
    return initializeInternal(
      root,
      installationKey,
      selection,
      initializationGrant,
      lease,
      synchronize,
      failAtStage,
    )
  },
  commitInitializationWithDirectorySynchronizer(
    root: StorageV3ArtifactRoot,
    installationKey: TaskInstallationKeyHandle,
    selection: StorageV3MigrationSelection,
    lease: StorageV3WriterLease,
    synchronize: DirectorySynchronizer,
  ): StorageV3RevocationReplayState {
    if (typeof synchronize !== 'function') return fail()
    return commitInitializationInternal(
      root,
      installationKey,
      selection,
      lease,
      synchronize,
    )
  },
  deleteWithDirectorySynchronizer(
    input: StorageV3RevocationDeletionInput,
    synchronize: DirectorySynchronizer,
    failAfterStage?: (stage: StorageV3RevocationDeletionStage) => void,
  ): StorageV3RevocationDeletionResult {
    if (typeof synchronize !== 'function'
      || (failAfterStage !== undefined && typeof failAfterStage !== 'function')) return fail()
    return runDeletion(input, synchronize, failAfterStage)
  },
  resumeWithDirectorySynchronizer(
    directory: string,
    installationKey: TaskInstallationKeyHandle,
    synchronize: DirectorySynchronizer,
  ): number {
    if (typeof synchronize !== 'function') return fail()
    return resumeInternal(directory, installationKey, synchronize)
  },
})
