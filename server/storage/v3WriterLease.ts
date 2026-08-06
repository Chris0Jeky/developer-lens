import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  realpathSync,
  rmSync,
  type BigIntStats,
} from 'node:fs'
import {
  storageV3WriterLeasePath,
  type StorageV3ArtifactRoot,
} from './v3ArtifactCatalogue.js'

/**
 * LIFE-03 criterion 1: one trusted Developer Lens writer for the complete
 * selected-store lifecycle. A crash leaves this marker behind. There is no
 * programmatic recovery or auto-break; an owner may remove the exact marker
 * manually only after verifying every Developer Lens writer has stopped.
 */
export const STORAGE_V3_WRITER_LEASE_BUSY = 'STORAGE_V3_WRITER_LEASE_BUSY' as const
export const STORAGE_V3_WRITER_LEASE_REFUSED = 'STORAGE_V3_WRITER_LEASE_REFUSED' as const
export type StorageV3WriterLeaseErrorCode =
  | typeof STORAGE_V3_WRITER_LEASE_BUSY
  | typeof STORAGE_V3_WRITER_LEASE_REFUSED

export class StorageV3WriterLeaseError extends Error {
  public readonly code: StorageV3WriterLeaseErrorCode

  constructor(code: StorageV3WriterLeaseErrorCode) {
    super(code)
    this.name = 'StorageV3WriterLeaseError'
    this.code = code
  }
}

/** Opaque runtime capability; only this module's WeakMap can validate it. */
export interface StorageV3WriterLease {
  readonly __storageV3WriterLease: unique symbol
}

interface LeaseRecord {
  readonly descriptor: number
  readonly path: string
  readonly identity: Readonly<{ dev: bigint; ino: bigint }>
}

const LEASES = new WeakMap<object, LeaseRecord>()
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0

const fail = (code: StorageV3WriterLeaseErrorCode): never => {
  throw new StorageV3WriterLeaseError(code)
}

function sameIdentity(
  left: Readonly<{ dev: bigint; ino: bigint }>,
  right: Readonly<{ dev: bigint; ino: bigint }>,
): boolean {
  return (left.dev !== 0n || left.ino !== 0n)
    && (right.dev !== 0n || right.ino !== 0n)
    && left.dev === right.dev
    && left.ino === right.ino
}

function lockEntry(path: string): BigIntStats {
  try {
    const entry = lstatSync(path, { bigint: true })
    if (
      !entry.isFile()
      || entry.isSymbolicLink()
      || entry.nlink !== 1n
      || realpathSync.native(path) !== path
    ) fail(STORAGE_V3_WRITER_LEASE_REFUSED)
    return entry
  } catch (error) {
    if (error instanceof StorageV3WriterLeaseError) throw error
    fail(STORAGE_V3_WRITER_LEASE_REFUSED)
  }
}

function proveLease(record: LeaseRecord): void {
  try {
    const entry = lockEntry(record.path)
    const handle = fstatSync(record.descriptor, { bigint: true })
    if (!handle.isFile() || handle.isSymbolicLink() || handle.nlink !== 1n
      || !sameIdentity(record.identity, entry)
      || !sameIdentity(record.identity, handle)) {
      fail(STORAGE_V3_WRITER_LEASE_REFUSED)
    }
  } catch (error) {
    if (error instanceof StorageV3WriterLeaseError) throw error
    fail(STORAGE_V3_WRITER_LEASE_REFUSED)
  }
}

function acquireStorageV3WriterLease(root: StorageV3ArtifactRoot): StorageV3WriterLease {
  let path: string
  try {
    path = storageV3WriterLeasePath(root)
  } catch {
    fail(STORAGE_V3_WRITER_LEASE_REFUSED)
  }
  let descriptor: number
  try {
    descriptor = openSync(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | NO_FOLLOW,
      0o600,
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') fail(STORAGE_V3_WRITER_LEASE_BUSY)
    fail(STORAGE_V3_WRITER_LEASE_REFUSED)
  }
  try {
    const identity = lockEntry(path)
    const record: LeaseRecord = Object.freeze({
      descriptor,
      path,
      identity: Object.freeze({ dev: identity.dev, ino: identity.ino }),
    })
    const lease = Object.freeze({}) as StorageV3WriterLease
    LEASES.set(lease, record)
    proveLease(record)
    return lease
  } catch (error) {
    try { closeSync(descriptor) } catch { /* preserve the content-free refusal */ }
    throw error instanceof StorageV3WriterLeaseError
      ? error
      : new StorageV3WriterLeaseError(STORAGE_V3_WRITER_LEASE_REFUSED)
  }
}

function releaseStorageV3WriterLease(lease: StorageV3WriterLease): void {
  const record = LEASES.get(lease)
  if (record === undefined) fail(STORAGE_V3_WRITER_LEASE_REFUSED)
  proveLease(record)
  closeSync(record.descriptor)
  try {
    rmSync(record.path)
  } catch {
    // No auto-break or alternate cleanup path: the exact marker remains for
    // owner-directed manual recovery after all writers are verified stopped.
    fail(STORAGE_V3_WRITER_LEASE_REFUSED)
  }
  LEASES.delete(lease)
}

/** Hold the writer descriptor for the complete callback, including failures. */
export function withStorageV3WriterLease<T>(
  root: StorageV3ArtifactRoot,
  callback: (lease: StorageV3WriterLease) => T,
): T {
  const lease = acquireStorageV3WriterLease(root)
  try {
    return callback(lease)
  } finally {
    releaseStorageV3WriterLease(lease)
  }
}
