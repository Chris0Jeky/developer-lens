import { lstat, opendir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

interface FileKind { isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean }
interface Entry extends FileKind { name: string }
export interface LocalDiscoveryAccess {
  lstat(path: string): Promise<FileKind>
  /** Entries may stream; the walker stops pulling at its entry ceilings, so an array is also fine. */
  readDirectory(path: string): Promise<Iterable<Entry> | AsyncIterable<Entry>>
}
// A marker in a directory five levels below a selected root is at path level six.
export const MAX_LOCAL_DISCOVERY_DEPTH = 5
export const MAX_LOCAL_DISCOVERY_DIRECTORIES = 10_000
// Ceilings on entries pulled per directory and in total (assumed, issue #415 names none). Hitting one
// keeps what was read, counts the directory in failedLocations and cappedDirectories, never complete.
export const MAX_LOCAL_DISCOVERY_ENTRIES_PER_DIRECTORY = 50_000
export const MAX_LOCAL_DISCOVERY_ENTRIES = 500_000
export interface LocalDiscoveryResult { candidates: string[]; failedLocations: number; cappedDirectories?: number }
const excluded = new Set(['.git', 'node_modules', '.venv', 'vendor', '.cache', 'dist', 'build',
  '.developer-lens', '.developer-lens-synthetic', 'coverage'])
const protectedChildren = new Set(['public/data', '.claude/worktrees', '.agent-harness/runtime'])

/** Literal metadata-only traversal. Symlink checks are not hostile-writer confinement. */
export async function discoverLocalGitCandidates(
  roots: readonly string[],
  access: LocalDiscoveryAccess = { lstat, readDirectory: (path) => opendir(path) },
): Promise<LocalDiscoveryResult> {
  const candidates = new Set<string>()
  const cache = new Map<string, readonly Entry[] | null>()
  const expanded = new Map<string, number>()
  let failedLocations = 0
  let truncated = false
  let pulled = 0
  let cappedDirectories = 0

  async function visit(directory: string, remaining: number): Promise<void> {
    if (truncated || (expanded.get(directory) ?? -1) >= remaining) return
    expanded.set(directory, remaining)
    if (!cache.has(directory)) {
      if (cache.size >= MAX_LOCAL_DISCOVERY_DIRECTORIES) {
        truncated = true
        failedLocations++
        return
      }
      cache.set(directory, null)
      try {
        const kind = await access.lstat(directory)
        if (kind.isSymbolicLink() || !kind.isDirectory()) throw new Error('Invalid discovery directory')
        const entries: Entry[] = []
        let capped = false
        for await (const entry of await access.readDirectory(directory)) {
          if (entries.length >= MAX_LOCAL_DISCOVERY_ENTRIES_PER_DIRECTORY || pulled >= MAX_LOCAL_DISCOVERY_ENTRIES) {
            capped = true
            truncated ||= pulled >= MAX_LOCAL_DISCOVERY_ENTRIES
            break
          }
          entries.push(entry)
          pulled++
        }
        if (capped) { cappedDirectories++; failedLocations++ }
        entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
        cache.set(directory, entries)
        const marker = entries.find((entry) => entry.name === '.git')
        if (marker) {
          if (!marker.isSymbolicLink() && (marker.isFile() || marker.isDirectory())) candidates.add(directory)
          else failedLocations++
        }
      } catch { failedLocations++ }
    }
    if (remaining === 0) return
    for (const entry of cache.get(directory) ?? []) {
      if (truncated) break
      if (entry.isSymbolicLink() || !entry.isDirectory() || excluded.has(entry.name.toLowerCase()) ||
          protectedChildren.has(`${basename(directory).toLowerCase()}/${entry.name.toLowerCase()}`)) continue
      await visit(join(directory, entry.name), remaining - 1)
    }
  }

  for (const root of roots) {
    if (truncated) break
    if (typeof root !== 'string' || root.trim().length === 0 || root.includes('\0')) {
      failedLocations++
      continue
    }
    await visit(resolve(root), MAX_LOCAL_DISCOVERY_DEPTH)
  }
  return { candidates: [...candidates], failedLocations, ...(cappedDirectories > 0 && { cappedDirectories }) }
}
