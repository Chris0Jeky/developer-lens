import {
  closeSync,
  constants,
  existsSync,
  linkSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createStorageV3ArtifactRoot,
  storageV3WriterLeasePath,
} from './v3ArtifactCatalogue.js'
import {
  STORAGE_V3_WRITER_LEASE_BUSY,
  STORAGE_V3_WRITER_LEASE_REFUSED,
  StorageV3WriterLeaseError,
  withStorageV3WriterLease,
} from './v3WriterLease.js'

describe('storage v3 writer lease', () => {
  const roots: string[] = []

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  })

  const freshRoot = (): { directory: string; root: ReturnType<typeof createStorageV3ArtifactRoot> } => {
    const directory = mkdtempSync(join(tmpdir(), 'developer-lens-writer-lease-'))
    roots.push(directory)
    return { directory, root: createStorageV3ArtifactRoot(directory) }
  }

  it('acquires, releases, and reacquires the exact fixed marker', () => {
    const { root } = freshRoot()
    let seen = false
    withStorageV3WriterLease(root, () => {
      seen = true
      expect(existsSync(storageV3WriterLeasePath(root))).toBe(true)
    })
    expect(seen).toBe(true)
    expect(existsSync(storageV3WriterLeasePath(root))).toBe(false)
    expect(() => withStorageV3WriterLease(root, () => 'reacquired')).not.toThrow()
  })

  it('refuses a second compliant acquisition before its callback runs', () => {
    const { root } = freshRoot()
    let secondCalls = 0
    withStorageV3WriterLease(root, () => {
      expect(() => withStorageV3WriterLease(root, () => {
        secondCalls += 1
      })).toThrowError(new StorageV3WriterLeaseError(STORAGE_V3_WRITER_LEASE_BUSY))
    })
    expect(secondCalls).toBe(0)
  })

  it('releases an ordinary callback error and permits the next writer', () => {
    const { root } = freshRoot()
    expect(() => withStorageV3WriterLease(root, () => {
      throw new Error('invented callback failure')
    })).toThrow('invented callback failure')
    expect(existsSync(storageV3WriterLeasePath(root))).toBe(false)
    expect(() => withStorageV3WriterLease(root, () => undefined)).not.toThrow()
  })

  it('holds the marker until an asynchronous callback settles', async () => {
    const { root } = freshRoot()
    let resolveCallback: (() => void) | undefined
    const first = withStorageV3WriterLease(root, () => new Promise<void>((resolve) => {
      resolveCallback = resolve
    }))

    expect(existsSync(storageV3WriterLeasePath(root))).toBe(true)
    expect(() => withStorageV3WriterLease(root, () => undefined))
      .toThrowError(new StorageV3WriterLeaseError(STORAGE_V3_WRITER_LEASE_BUSY))
    resolveCallback?.()
    await first

    expect(existsSync(storageV3WriterLeasePath(root))).toBe(false)
    expect(() => withStorageV3WriterLease(root, () => undefined)).not.toThrow()
  })

  it('releases an asynchronous callback rejection and permits the next writer', async () => {
    const { root } = freshRoot()
    await expect(withStorageV3WriterLease(root, async () => {
      await Promise.resolve()
      throw new Error('invented asynchronous callback failure')
    })).rejects.toThrow('invented asynchronous callback failure')
    expect(existsSync(storageV3WriterLeasePath(root))).toBe(false)
    expect(() => withStorageV3WriterLease(root, () => undefined)).not.toThrow()
  })

  it('keeps a crash-held marker busy until manual exact removal', () => {
    const { root } = freshRoot()
    const path = storageV3WriterLeasePath(root)
    const descriptor = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, 0o600)
    closeSync(descriptor)
    expect(() => withStorageV3WriterLease(root, () => undefined))
      .toThrowError(new StorageV3WriterLeaseError(STORAGE_V3_WRITER_LEASE_BUSY))
    rmSync(path)
    expect(() => withStorageV3WriterLease(root, () => undefined)).not.toThrow()
  })

  it.each([
    ['regular', (path: string) => writeFileSync(path, 'invented marker')],
    ['hardlink', (path: string) => {
      const outside = `${path}.outside`
      writeFileSync(outside, 'invented outside')
      linkSync(outside, path)
    }],
  ])('refuses a pre-existing %s entry without changing its bytes', (_kind, prepare) => {
    const { root } = freshRoot()
    const path = storageV3WriterLeasePath(root)
    prepare(path)
    const before = readFileSync(path)
    expect(() => withStorageV3WriterLease(root, () => undefined))
      .toThrowError(new StorageV3WriterLeaseError(STORAGE_V3_WRITER_LEASE_BUSY))
    expect(readFileSync(path).equals(before)).toBe(true)
  })

  it.skipIf(process.platform === 'win32')('refuses pre-existing symlink and dangling symlink entries', () => {
    const { root, directory } = freshRoot()
    const outside = join(directory, 'outside.sqlite')
    const path = storageV3WriterLeasePath(root)
    writeFileSync(outside, 'invented outside')
    symlinkSync(outside, path, 'file')
    expect(() => withStorageV3WriterLease(root, () => undefined))
      .toThrowError(new StorageV3WriterLeaseError(STORAGE_V3_WRITER_LEASE_BUSY))
    expect(readFileSync(outside, 'utf8')).toBe('invented outside')
    rmSync(path)
    rmSync(outside)
    symlinkSync(join(directory, 'missing.sqlite'), path, 'file')
    expect(() => withStorageV3WriterLease(root, () => undefined))
      .toThrowError(new StorageV3WriterLeaseError(STORAGE_V3_WRITER_LEASE_BUSY))
    expect(existsSync(join(directory, 'missing.sqlite'))).toBe(false)
  })

  it('exposes only content-free busy/refused errors', () => {
    const { root, directory } = freshRoot()
    const path = storageV3WriterLeasePath(root)
    const descriptor = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, 0o600)
    closeSync(descriptor)
    try {
      withStorageV3WriterLease(root, () => undefined)
      throw new Error('expected busy')
    } catch (error) {
      expect(error).toBeInstanceOf(StorageV3WriterLeaseError)
      expect(error).toMatchObject({
        code: STORAGE_V3_WRITER_LEASE_BUSY,
        message: STORAGE_V3_WRITER_LEASE_BUSY,
      })
      expect(String(error)).not.toContain(directory)
      expect(String(error)).not.toContain(String(process.pid))
      expect(String(error)).not.toContain(path)
    } finally { rmSync(path) }
    expect(STORAGE_V3_WRITER_LEASE_REFUSED).toBe('STORAGE_V3_WRITER_LEASE_REFUSED')
  })

  it('maps an unreviewed root capability to the refused constant', () => {
    expect(() => withStorageV3WriterLease({} as never, () => undefined))
      .toThrowError(new StorageV3WriterLeaseError(STORAGE_V3_WRITER_LEASE_REFUSED))
  })
})
