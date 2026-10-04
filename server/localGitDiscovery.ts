import { lstat, readdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

interface FileKind { isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean }
interface Entry extends FileKind { name: string }
export interface LocalDiscoveryAccess {
  lstat(path: string): Promise<FileKind>
  readDirectory(path: string): Promise<readonly Entry[]>
}
// A marker in a directory five levels below a selected root is at path level six.
export const MAX_LOCAL_DISCOVERY_DEPTH = 5
export const MAX_LOCAL_DISCOVERY_DIRECTORIES = 10_000
export interface LocalDiscoveryResult { candidates: string[]; failedLocations: number }
const excluded = new Set(['.git', 'node_modules', '.venv', 'vendor', '.cache', 'dist', 'build',
  '.developer-lens', '.developer-lens-synthetic', 'coverage'])
const protectedChildren = new Set(['public/data', '.claude/worktrees', '.agent-harness/runtime'])

/** Literal metadata-only traversal. Symlink checks are not hostile-writer confinement. */
export async function discoverLocalGitCandidates(
  roots: readonly string[],
  access: LocalDiscoveryAccess = { lstat, readDirectory: (path) => readdir(path, { withFileTypes: true }) },
): Promise<LocalDiscoveryResult> {
  const candidates = new Set<string>()
  const cache = new Map<string, readonly Entry[] | null>()
  const expanded = new Map<string, number>()
  let failedLocations = 0
  let truncated = false

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
        const entries = [...await access.readDirectory(directory)].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
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
  return { candidates: [...candidates], failedLocations }
}
