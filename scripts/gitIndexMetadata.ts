import {
  buildGitIndexMetadataArgs,
  createGitIndexTrackedTextValidationAccess,
  parseGitIndexEntries,
  type GitIndexCommandExecutor,
  type TrackedTextValidationAccess,
} from './projectContextValidation.js'

// Conservative UTF-16/quoting cost, including fixed arguments and executable headroom.
// This bounds argv, not output size or hostile concurrent mutation of the Git index.
export const MAX_METADATA_ARGUMENT_UNITS = 12_000
export const MAX_METADATA_PATHS = 128
const argumentUnits = (value: string): number => 2 * value.length + 3
const fixedUnits = 1024 + buildGitIndexMetadataArgs([]).reduce((sum, arg) => sum + argumentUnits(arg), 0)
const selectionError = () => new Error('Git metadata selection exceeds the bounded argument contract')

/** Plan the whole selection before the first command, preserving literal path order. */
export function planGitIndexMetadataBatches(paths: readonly string[]): string[][] {
  const seen = new Set<string>()
  const batches: string[][] = []
  let batch: string[] = []
  let units = fixedUnits
  for (const path of paths) {
    if (typeof path !== 'string' || path.length === 0 || path.includes('\0') || seen.has(path)) {
      throw selectionError()
    }
    const cost = argumentUnits(path)
    if (fixedUnits + cost > MAX_METADATA_ARGUMENT_UNITS) throw selectionError()
    seen.add(path)
    if (batch.length >= MAX_METADATA_PATHS || units + cost > MAX_METADATA_ARGUMENT_UNITS) {
      batches.push(batch)
      batch = []
      units = fixedUnits
    }
    batch.push(path)
    units += cost
  }
  if (batch.length) batches.push(batch)
  return batches
}

/** Retain the original path/blob readers and reconcile each metadata reply separately. */
export function createBatchedGitIndexTrackedTextValidationAccess(
  execute: GitIndexCommandExecutor,
): TrackedTextValidationAccess {
  const original = createGitIndexTrackedTextValidationAccess(execute)
  return {
    ...original,
    listEntries(paths) {
      const batches = planGitIndexMetadataBatches(paths)
      return batches.flatMap((batch) => {
        const entries = parseGitIndexEntries(execute(buildGitIndexMetadataArgs(batch)))
        const remaining = new Set(batch)
        if (entries.length !== batch.length || entries.some((entry) => !remaining.delete(entry.path))) {
          throw new Error('Git metadata batch did not match its literal selection')
        }
        return entries
      })
    },
  }
}
