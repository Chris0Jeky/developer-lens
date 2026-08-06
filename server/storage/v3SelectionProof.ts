import { createHash, timingSafeEqual } from 'node:crypto'
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
  unlinkSync,
  writeSync,
  type BigIntStats,
} from 'node:fs'
import { dirname } from 'node:path'
import type Database from 'better-sqlite3'
import {
  assertStorageV3ArtifactCatalogue,
  assertStorageV3ArtifactRootInstallationKey,
  assertStorageV3ArtifactDirectorySyncSupported,
  storageV3ArtifactFilePath,
  syncStorageV3ArtifactDirectory,
  STORAGE_V3_ARTIFACT_LOCATORS,
  type StorageV3ArtifactRoot,
} from './v3ArtifactCatalogue.js'
import {
  bindTaskInstallationKeyBody,
  type TaskInstallationKeyHandle,
} from './taskInstallationKey.js'
import {
  readStorageV3MigrationSelection,
  type StorageV3MigrationSelection,
} from './v3SelectionReceipt.js'
import { isCanonicalTaskId } from '../taskId.js'

export const STORAGE_V3_SELECTION_PROOF_ERROR = 'STORAGE_V3_SELECTION_PROOF_INVALID' as const
export class StorageV3SelectionProofError extends Error {
  readonly code = STORAGE_V3_SELECTION_PROOF_ERROR
  constructor() {
    super(STORAGE_V3_SELECTION_PROOF_ERROR)
    this.name = 'StorageV3SelectionProofError'
  }
}

const fail = (): never => { throw new StorageV3SelectionProofError() }
const VERSION = 'migration_selection_v1' as const
const READER_STATE = 'v3_selected' as const
const FINAL_NAME = 'migration-selection-v1.json' as const
const TEMP_NAME = `${FINAL_NAME}.tmp` as const
const BODY_DOMAIN = 'developer-lens.storage-v3-selection-proof.v1' as const
const GRACE_MS = 7 * 24 * 60 * 60 * 1000
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ARTIFACT = /^art-[0-9a-f]{64}$/
const LEGACY = /^legacy-[0-9a-f]{64}$/
const HEX = /^[0-9a-f]{64}$/
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0

export const STORAGE_V3_SELECTION_PROOF_NAMES = Object.freeze({ final: FINAL_NAME, temp: TEMP_NAME })

const PREFLIGHT_SOURCE_NAME = 'selection-proof-preflight-source'
const PREFLIGHT_LINK_NAME = 'selection-proof-preflight-link'

export type StorageV3SelectionProofPublicationStage =
  | 'tempClaim'
  | 'tempDurable'
  | 'finalLink'
  | 'tempRemoval'

export type StorageV3MigrationSelectionProofPublication = Readonly<{
  kind: 'v3_migration_selection_proof'
  status: 'published' | 'replayed'
  selection: StorageV3MigrationSelection
}>

/** The proof's authority is held only in this module's WeakMap. */
export interface StorageV3MigrationSelectionProofHandle {
  readonly __storageV3MigrationSelectionProofHandle: never
}

type MarkerBody = Readonly<{
  version: typeof VERSION
  readerState: typeof READER_STATE
  legacySourceId: string
  selectedArtifactId: string
  backupArtifactId: string
  successfulReportAt: string
  graceDeadlineAt: string
  taskFingerprint: string
}>

type Marker = MarkerBody & Readonly<{
  bodySha256: string
  installationKeyBinding: string
}>

type HandleRecord = Readonly<{
  finalPath: string
  selection: StorageV3MigrationSelection
  bytes: Buffer
  installationKeyFingerprint: string
}>

const HANDLES = new WeakMap<StorageV3MigrationSelectionProofHandle, HandleRecord>()
const CONSUMED = new WeakSet<StorageV3MigrationSelectionProofHandle>()

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
  if (actual.map(String).sort().some((key, index) => key !== [...keys].sort()[index])) return fail()
  return object
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !TIMESTAMP.test(value)) return fail()
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) return fail()
  return value
}

function deadline(reportAt: string): string {
  const result = new Date(Date.parse(reportAt) + GRACE_MS).toISOString()
  if (!TIMESTAMP.test(result)) return fail()
  return result
}

function selectionValue(raw: unknown): StorageV3MigrationSelection {
  const object = assertPlain(raw, [
    'readerState', 'legacySourceId', 'selectedArtifactId', 'backupArtifactId',
    'successfulReportAt', 'graceDeadlineAt',
  ])
  if (own(object, 'readerState') !== READER_STATE) return fail()
  const legacySourceId = own(object, 'legacySourceId')
  const selectedArtifactId = own(object, 'selectedArtifactId')
  const backupArtifactId = own(object, 'backupArtifactId')
  if (typeof legacySourceId !== 'string' || !LEGACY.test(legacySourceId)) return fail()
  if (typeof selectedArtifactId !== 'string' || !ARTIFACT.test(selectedArtifactId)) return fail()
  if (typeof backupArtifactId !== 'string' || !ARTIFACT.test(backupArtifactId)) return fail()
  const successfulReportAt = timestamp(own(object, 'successfulReportAt'))
  const graceDeadlineAt = timestamp(own(object, 'graceDeadlineAt'))
  if (deadline(successfulReportAt) !== graceDeadlineAt) return fail()
  return Object.freeze({
    readerState: READER_STATE,
    legacySourceId,
    selectedArtifactId,
    backupArtifactId,
    successfulReportAt,
    graceDeadlineAt,
  })
}

function bodyFor(selection: StorageV3MigrationSelection, key: TaskInstallationKeyHandle): MarkerBody {
  if (!isCanonicalTaskId(key.taskId) || !HEX.test(key.fingerprint)) return fail()
  const taskIdDigest = createHash('sha256')
    .update(`developer-lens.storage-v3-selection-task.v1\0${key.taskId}`, 'utf8')
    .digest('hex')
  const taskFingerprint = bindTaskInstallationKeyBody(key, taskIdDigest)
  if (!HEX.test(taskFingerprint)) return fail()
  return Object.freeze({
    version: VERSION,
    readerState: READER_STATE,
    legacySourceId: selection.legacySourceId,
    selectedArtifactId: selection.selectedArtifactId,
    backupArtifactId: selection.backupArtifactId,
    successfulReportAt: selection.successfulReportAt,
    graceDeadlineAt: selection.graceDeadlineAt,
    taskFingerprint,
  })
}

function digestBody(body: MarkerBody): string {
  return createHash('sha256').update(`${BODY_DOMAIN}\0${JSON.stringify(body)}`, 'utf8').digest('hex')
}

function markerFor(selection: StorageV3MigrationSelection, key: TaskInstallationKeyHandle): Marker {
  const body = bodyFor(selection, key)
  const bodySha256 = digestBody(body)
  const installationKeyBinding = bindTaskInstallationKeyBody(key, bodySha256)
  if (!HEX.test(installationKeyBinding)) return fail()
  return Object.freeze({ ...body, bodySha256, installationKeyBinding })
}

function markerBytes(marker: Marker): Buffer {
  return Buffer.from(`${JSON.stringify(marker)}\n`, 'utf8')
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

function assertFileStat(entry: BigIntStats, expectedNlink: bigint): void {
  if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== expectedNlink) return fail()
  if (process.platform !== 'win32' && (entry.mode & 0o777n) !== 0o600n) return fail()
}

function assertDescriptorPath(path: string, descriptor: number, expectedNlink: bigint, expectedSize: bigint): BigIntStats {
  const before = stat(path)
  if (before === undefined) return fail()
  let canonical: string
  try { canonical = realpathSync.native(path) } catch { return fail() }
  const opened = fstatSync(descriptor, { bigint: true })
  const after = stat(path)
  if (after === undefined) return fail()
  assertFileStat(before, expectedNlink)
  assertFileStat(opened, expectedNlink)
  assertFileStat(after, expectedNlink)
  if (canonical !== path || opened.size !== expectedSize || before.size !== expectedSize || after.size !== expectedSize
    || opened.dev !== before.dev || opened.ino !== before.ino || opened.dev !== after.dev || opened.ino !== after.ino) return fail()
  return opened
}

function readDescriptor(path: string, expected: Buffer, expectedNlink: bigint): void {
  let descriptor: number | undefined
  let closeFailed = false
  try {
    descriptor = openSync(path, constants.O_RDONLY | NO_FOLLOW)
    assertDescriptorPath(path, descriptor, expectedNlink, BigInt(expected.length))
    const observed = Buffer.alloc(expected.length)
    let offset = 0
    while (offset < observed.length) {
      const count = readSync(descriptor, observed, offset, observed.length - offset, offset)
      if (count === 0) return fail()
      offset += count
    }
    const extra = Buffer.alloc(1)
    if (readSync(descriptor, extra, 0, 1, expected.length) !== 0) return fail()
    compareBytes(observed, expected)
    const after = assertDescriptorPath(path, descriptor, expectedNlink, BigInt(expected.length))
    if (after.size !== BigInt(expected.length)) return fail()
  } catch (error) {
    if (error instanceof StorageV3SelectionProofError) throw error
    return fail()
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor) } catch { closeFailed = true }
    }
  }
  if (closeFailed) return fail()
}

function writeExact(path: string, expected: Buffer, descriptor: number): void {
  let offset = 0
  while (offset < expected.length) {
    const count = writeSync(descriptor, expected, offset, expected.length - offset, offset)
    if (count <= 0) return fail()
    offset += count
  }
  fsyncSync(descriptor)
  assertDescriptorPath(path, descriptor, 1n, BigInt(expected.length))
}

function closeDescriptorOrFail(descriptor: number): void {
  try { closeSync(descriptor) } catch { fail() }
}

function exactPair(tempPath: string, finalPath: string, bytes: Buffer): void {
  const temp = stat(tempPath)
  const final = stat(finalPath)
  if (temp === undefined || final === undefined) return fail()
  assertFileStat(temp, 2n)
  assertFileStat(final, 2n)
  if (temp.dev !== final.dev || temp.ino !== final.ino) return fail()
  readDescriptor(tempPath, bytes, 2n)
  readDescriptor(finalPath, bytes, 2n)
}

function removeReservedEmptyProvisional(
  root: StorageV3ArtifactRoot,
  tempPath: string,
  entry: BigIntStats,
  synchronizer: DirectorySynchronizer,
): boolean {
  if (entry.size !== 0n) return false
  assertFileStat(entry, 1n)
  const reproved = stat(tempPath)
  if (reproved === undefined || reproved.dev !== entry.dev || reproved.ino !== entry.ino
    || reproved.size !== 0n || reproved.nlink !== 1n) return fail()
  unlinkSync(tempPath)
  syncDirectory(root, synchronizer, 'tempRemoval')
  return true
}

function rejectSidecars(rootPath: string): void {
  let names: string[]
  try { names = readdirSync(rootPath) } catch { return fail() }
  const finalLower = FINAL_NAME.toLowerCase()
  const tempLower = TEMP_NAME.toLowerCase()
  for (const name of names) {
    const lower = name.toLowerCase()
    if (lower.startsWith(finalLower) && name !== FINAL_NAME && name !== TEMP_NAME) return fail()
    if (lower === tempLower && name !== TEMP_NAME) return fail()
  }
}

function syncDirectory(root: StorageV3ArtifactRoot, synchronizer: (root: StorageV3ArtifactRoot, stage: StorageV3SelectionProofPublicationStage) => void, stage: StorageV3SelectionProofPublicationStage): void {
  synchronizer(root, stage)
}

function injectFailure(stage: StorageV3SelectionProofPublicationStage, configured?: StorageV3SelectionProofStageFailure): void {
  if (configured === stage) throw new Error('invented selection proof interruption')
}

type StorageV3SelectionProofStageFailure = StorageV3SelectionProofPublicationStage
type DirectorySynchronizer = (root: StorageV3ArtifactRoot, stage: StorageV3SelectionProofPublicationStage) => void

/**
 * Exercise the exact selected-root primitives used by publication before a
 * selector can commit its immutable receipt. Probe names are app-owned and
 * never replace an existing entry; foreign bytes therefore remain untouched.
 */
export function assertStorageV3SelectionProofDurability(root: StorageV3ArtifactRoot): void {
  let descriptor: number | undefined
  let sourceIdentity: BigIntStats | undefined
  let linkIdentity: BigIntStats | undefined
  const sourcePath = storageV3ArtifactFilePath(root, PREFLIGHT_SOURCE_NAME)
  const linkPath = storageV3ArtifactFilePath(root, PREFLIGHT_LINK_NAME)
  const cleanup = (path: string, expected: BigIntStats | undefined): void => {
    if (expected === undefined) return
    try {
      const current = stat(path)
      if (current === undefined || current.dev !== expected.dev || current.ino !== expected.ino
        || current.isSymbolicLink() || !current.isFile()) return
      unlinkSync(path)
      syncStorageV3ArtifactDirectory(root)
    } catch { /* the original failure remains the only public result */ }
  }
  try {
    assertStorageV3ArtifactDirectorySyncSupported()
    if (stat(sourcePath) !== undefined || stat(linkPath) !== undefined) return fail()
    descriptor = openSync(sourcePath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | NO_FOLLOW, 0o600)
    const byte = Buffer.from([0x01])
    if (writeSync(descriptor, byte, 0, byte.length, 0) !== byte.length) return fail()
    fsyncSync(descriptor)
    sourceIdentity = assertDescriptorPath(sourcePath, descriptor, 1n, 1n)
    closeDescriptorOrFail(descriptor)
    descriptor = undefined
    syncStorageV3ArtifactDirectory(root)
    linkSync(sourcePath, linkPath)
    linkIdentity = stat(linkPath)
    if (linkIdentity === undefined || sourceIdentity === undefined
      || linkIdentity.dev !== sourceIdentity.dev || linkIdentity.ino !== sourceIdentity.ino) return fail()
    assertFileStat(linkIdentity, 2n)
    syncStorageV3ArtifactDirectory(root)
    unlinkSync(linkPath)
    syncStorageV3ArtifactDirectory(root)
    unlinkSync(sourcePath)
    syncStorageV3ArtifactDirectory(root)
  } catch (error) {
    if (error instanceof StorageV3SelectionProofError) throw error
    return fail()
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor) } catch { /* cleanup below remains best-effort */ }
    }
    cleanup(linkPath, linkIdentity)
    cleanup(sourcePath, sourceIdentity)
  }
}

function publishInternal(
  root: StorageV3ArtifactRoot,
  rawSelection: StorageV3MigrationSelection,
  key: TaskInstallationKeyHandle,
  synchronizer: DirectorySynchronizer,
  failAtStage?: StorageV3SelectionProofStageFailure,
): StorageV3MigrationSelectionProofPublication {
  let tempDescriptor: number | undefined
  const finalPath = storageV3ArtifactFilePath(root, FINAL_NAME)
  const tempPath = storageV3ArtifactFilePath(root, TEMP_NAME)
  const rootPath = dirname(finalPath)
  const selection = selectionValue(rawSelection)
  assertStorageV3ArtifactRootInstallationKey(root, key)
  const expected = markerBytes(markerFor(selection, key))
  rejectSidecars(rootPath)
  const existingFinal = stat(finalPath)
  let existingTemp = stat(tempPath)
  if (existingTemp !== undefined && removeReservedEmptyProvisional(root, tempPath, existingTemp, synchronizer)) {
    existingTemp = undefined
  }
  const recoveredPair = existingFinal !== undefined && existingTemp !== undefined
  if (existingFinal !== undefined) {
    assertFileStat(existingFinal, existingTemp === undefined ? 1n : 2n)
    if (existingTemp === undefined) {
      readDescriptor(finalPath, expected, 1n)
      // A prior unlink may have completed before its directory sync failed.
      // Re-prove the final-only name's durability before replaying it.
      syncDirectory(root, synchronizer, 'tempRemoval')
      readDescriptor(finalPath, expected, 1n)
      return Object.freeze({ kind: 'v3_migration_selection_proof', status: 'replayed', selection })
    }
    exactPair(tempPath, finalPath, expected)
    // A recovered pair may have survived after the final-link sync but before
    // the temporary name was durably removed. Re-sync the final name before
    // unlinking the temporary name on every replay.
    syncDirectory(root, synchronizer, 'finalLink')
  } else if (existingTemp !== undefined) {
    assertFileStat(existingTemp, 1n)
    readDescriptor(tempPath, expected, 1n)
  } else {
    try {
      tempDescriptor = openSync(tempPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | NO_FOLLOW, 0o600)
      assertDescriptorPath(tempPath, tempDescriptor, 1n, 0n)
      syncDirectory(root, synchronizer, 'tempClaim')
      injectFailure('tempClaim', failAtStage)
      writeExact(tempPath, expected, tempDescriptor)
      syncDirectory(root, synchronizer, 'tempDurable')
      injectFailure('tempDurable', failAtStage)
    } catch (error) {
      if (error instanceof StorageV3SelectionProofError) throw error
      return fail()
    } finally {
      if (tempDescriptor !== undefined) {
        closeDescriptorOrFail(tempDescriptor)
        tempDescriptor = undefined
      }
    }
  }
  if (tempDescriptor !== undefined) { closeSync(tempDescriptor); tempDescriptor = undefined }
  const currentFinal = stat(finalPath)
  if (currentFinal === undefined) {
    try { linkSync(tempPath, finalPath) } catch {
      const raced = stat(finalPath)
      if (raced === undefined) return fail()
      assertFileStat(raced, 1n)
      readDescriptor(finalPath, expected, 1n)
    }
    const linked = stat(finalPath)
    if (linked === undefined) return fail()
    if (linked.nlink === 2n) exactPair(tempPath, finalPath, expected)
    else { assertFileStat(linked, 1n); readDescriptor(finalPath, expected, 1n); readDescriptor(tempPath, expected, 1n) }
    syncDirectory(root, synchronizer, 'finalLink')
    injectFailure('finalLink', failAtStage)
  } else {
    if (recoveredPair) exactPair(tempPath, finalPath, expected)
    else {
      assertFileStat(currentFinal, 1n)
      readDescriptor(finalPath, expected, 1n)
    }
  }
  const beforeRemoval = stat(tempPath)
  if (beforeRemoval === undefined) return fail()
  if (beforeRemoval.nlink === 2n) exactPair(tempPath, finalPath, expected)
  else { assertFileStat(beforeRemoval, 1n); readDescriptor(tempPath, expected, 1n) }
  unlinkSync(tempPath)
  syncDirectory(root, synchronizer, 'tempRemoval')
  injectFailure('tempRemoval', failAtStage)
  readDescriptor(finalPath, expected, 1n)
  return Object.freeze({ kind: 'v3_migration_selection_proof', status: existingFinal === undefined ? 'published' : 'replayed', selection })
}

function committedSelection(
  db: Database.Database,
  root: StorageV3ArtifactRoot,
): StorageV3MigrationSelection {
  if (!db?.open || db.readonly || db.inTransaction) return fail()
  const selectedPath = storageV3ArtifactFilePath(root, STORAGE_V3_ARTIFACT_LOCATORS.selectedStore)
  let openedPath: string
  try { openedPath = realpathSync.native(db.name) } catch { return fail() }
  if (openedPath !== selectedPath) return fail()
  assertStorageV3ArtifactCatalogue(db)
  const selection = readStorageV3MigrationSelection(db)
  if (selection === undefined) return fail()
  const selected = db.prepare(
    "SELECT artifact_id, state FROM app_artifact WHERE kind = 'selected_store' ORDER BY artifact_id",
  ).all() as Array<{ artifact_id: string; state: string }>
  if (selected.length !== 1 || selected[0]?.artifact_id !== selection.selectedArtifactId
    || selected[0]?.state !== 'active') return fail()
  return selection
}

export function publishStorageV3MigrationSelectionProof(
  db: Database.Database,
  root: StorageV3ArtifactRoot,
  installationKey: TaskInstallationKeyHandle,
): StorageV3MigrationSelectionProofPublication {
  try {
    assertStorageV3ArtifactDirectorySyncSupported()
    const selection = committedSelection(db, root)
    return publishInternal(root, selection, installationKey, (artifactRoot) => syncStorageV3ArtifactDirectory(artifactRoot))
  } catch (error) {
    if (error instanceof StorageV3SelectionProofError) throw error
    return fail()
  }
}

function parseMarker(bytes: Buffer, key: TaskInstallationKeyHandle, selection?: StorageV3MigrationSelection): Marker {
  let raw: unknown
  try { raw = JSON.parse(bytes.toString('utf8')) } catch { return fail() }
  const object = assertPlain(raw, [
    'version', 'readerState', 'legacySourceId', 'selectedArtifactId', 'backupArtifactId',
    'successfulReportAt', 'graceDeadlineAt', 'taskFingerprint', 'bodySha256', 'installationKeyBinding',
  ])
  const parsedSelection = selectionValue({
    readerState: own(object, 'readerState'),
    legacySourceId: own(object, 'legacySourceId'),
    selectedArtifactId: own(object, 'selectedArtifactId'),
    backupArtifactId: own(object, 'backupArtifactId'),
    successfulReportAt: own(object, 'successfulReportAt'),
    graceDeadlineAt: own(object, 'graceDeadlineAt'),
  })
  const taskFingerprint = own(object, 'taskFingerprint')
  const bodySha256 = own(object, 'bodySha256')
  const installationKeyBinding = own(object, 'installationKeyBinding')
  if (own(object, 'version') !== VERSION || typeof taskFingerprint !== 'string' || !HEX.test(taskFingerprint)
    || typeof bodySha256 !== 'string' || !HEX.test(bodySha256)
    || typeof installationKeyBinding !== 'string' || !HEX.test(installationKeyBinding)) return fail()
  const body = bodyFor(parsedSelection, key)
  if (body.taskFingerprint !== taskFingerprint) return fail()
  if (digestBody(body) !== bodySha256 || bindTaskInstallationKeyBody(key, bodySha256) !== installationKeyBinding) return fail()
  const marker = Object.freeze({ ...body, bodySha256, installationKeyBinding })
  compareBytes(markerBytes(marker), bytes)
  if (selection !== undefined && JSON.stringify(selection) !== JSON.stringify(parsedSelection)) return fail()
  return marker
}

export function verifyStorageV3MigrationSelectionProof(
  root: StorageV3ArtifactRoot,
  installationKey: TaskInstallationKeyHandle,
): StorageV3MigrationSelectionProofHandle {
  try {
    assertStorageV3ArtifactRootInstallationKey(root, installationKey)
    const finalPath = storageV3ArtifactFilePath(root, FINAL_NAME)
    const tempPath = storageV3ArtifactFilePath(root, TEMP_NAME)
    rejectSidecars(dirname(finalPath))
    const entry = stat(finalPath)
    if (entry === undefined) return fail()
    const tempEntry = stat(tempPath)
    // A temporary/final pair is still an in-progress publication. Do not mint
    // a restore handle until the durable final-only state is established.
    if (tempEntry !== undefined) return fail()
    assertFileStat(entry, 1n)
    let descriptor: number | undefined
    const bytes = Buffer.alloc(4096)
    try {
      descriptor = openSync(finalPath, constants.O_RDONLY | NO_FOLLOW)
      const opened = fstatSync(descriptor, { bigint: true })
      assertFileStat(opened, 1n)
      if (opened.size <= 0n || opened.size > BigInt(bytes.length)) return fail()
      const exact = Buffer.alloc(Number(opened.size))
      let offset = 0
      while (offset < exact.length) {
        const count = readSync(descriptor, exact, offset, exact.length - offset, offset)
        if (count === 0) return fail()
        offset += count
      }
      if (readSync(descriptor, bytes, 0, 1, exact.length) !== 0) return fail()
      assertDescriptorPath(finalPath, descriptor, 1n, BigInt(exact.length))
      parseMarker(exact, installationKey)
      const parsed = JSON.parse(exact.toString('utf8')) as Record<string, unknown>
      const selection = selectionValue({
        readerState: parsed.readerState,
        legacySourceId: parsed.legacySourceId,
        selectedArtifactId: parsed.selectedArtifactId,
        backupArtifactId: parsed.backupArtifactId,
        successfulReportAt: parsed.successfulReportAt,
        graceDeadlineAt: parsed.graceDeadlineAt,
      })
      const handle = Object.freeze({}) as StorageV3MigrationSelectionProofHandle
      HANDLES.set(handle, Object.freeze({ finalPath, selection, bytes: Buffer.from(exact), installationKeyFingerprint: installationKey.fingerprint }))
      return handle
    } finally { if (descriptor !== undefined) closeSync(descriptor) }
  } catch (error) {
    if (error instanceof StorageV3SelectionProofError) throw error
    return fail()
  }
}

export function consumeStorageV3MigrationSelectionProof(
  handle: StorageV3MigrationSelectionProofHandle,
  root: StorageV3ArtifactRoot,
  installationKey: TaskInstallationKeyHandle,
): StorageV3MigrationSelection {
  try {
    const record = HANDLES.get(handle)
    if (record === undefined || CONSUMED.has(handle)) return fail()
    assertStorageV3ArtifactRootInstallationKey(root, installationKey)
    const finalPath = storageV3ArtifactFilePath(root, FINAL_NAME)
    if (record.finalPath !== finalPath || record.installationKeyFingerprint !== installationKey.fingerprint) return fail()
    const tempPath = storageV3ArtifactFilePath(root, TEMP_NAME)
    rejectSidecars(dirname(finalPath))
    const tempEntry = stat(tempPath)
    readDescriptor(finalPath, record.bytes, tempEntry === undefined ? 1n : 2n)
    if (tempEntry !== undefined) exactPair(tempPath, finalPath, record.bytes)
    parseMarker(record.bytes, installationKey, record.selection)
    CONSUMED.add(handle)
    return record.selection
  } catch (error) {
    if (error instanceof StorageV3SelectionProofError) throw error
    return fail()
  }
}

/** @internal Invented-fixture ordering/failure seam; native publication always uses directory fsync. */
export const v3SelectionProofTestSeams = Object.freeze({
  publishWithDirectorySynchronizer(
    root: StorageV3ArtifactRoot,
    selection: StorageV3MigrationSelection,
    installationKey: TaskInstallationKeyHandle,
    synchronizer: DirectorySynchronizer,
    failAtStage?: StorageV3SelectionProofStageFailure,
  ): StorageV3MigrationSelectionProofPublication {
    if (typeof synchronizer !== 'function') return fail()
    try {
      return publishInternal(root, selection, installationKey, synchronizer, failAtStage)
    } catch (error) {
      if (error instanceof StorageV3SelectionProofError) throw error
      return fail()
    }
  },
  publishCommittedWithDirectorySynchronizer(
    db: Database.Database,
    root: StorageV3ArtifactRoot,
    installationKey: TaskInstallationKeyHandle,
    synchronizer: DirectorySynchronizer,
    failAtStage?: StorageV3SelectionProofStageFailure,
  ): StorageV3MigrationSelectionProofPublication {
    if (typeof synchronizer !== 'function') return fail()
    try {
      assertStorageV3ArtifactRootInstallationKey(root, installationKey)
      return publishInternal(
        root,
        committedSelection(db, root),
        installationKey,
        synchronizer,
        failAtStage,
      )
    } catch (error) {
      if (error instanceof StorageV3SelectionProofError) throw error
      return fail()
    }
  },
})

export const recoverStorageV3MigrationSelectionProof = publishStorageV3MigrationSelectionProof
export const readStorageV3MigrationSelectionProof = verifyStorageV3MigrationSelectionProof
