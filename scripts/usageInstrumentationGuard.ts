import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

/**
 * Markers of the Pulseboard SDK v3 install. None of them may appear in a local/private build, a
 * portable export or a share artifact; only the synthetic showcase build carries them.
 */
export const USAGE_INSTRUMENTATION_MARKERS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'Pulseboard SDK or global', pattern: /pulseboard/i },
  { label: 'Pulseboard collector origin', pattern: /commit-atlas\.workers\.dev/i },
  { label: 'legacy Observatory adapter', pattern: /observatory\.js|PulseboardUsage/i },
]

/** One `<label> in <where>` message per marker found in `content`. */
export function usageInstrumentationViolations(where: string, content: string): string[] {
  return USAGE_INSTRUMENTATION_MARKERS.filter(({ pattern }) => pattern.test(content)).map(
    ({ label }) => `${label} in ${where}`,
  )
}

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? filesBelow(path) : Promise.resolve([path])
    }),
  )
  return nested.flat()
}

/**
 * Scans EVERY file below `root` (file names and bytes, binary included, read as latin1 so any
 * ASCII marker is visible) for the instrumentation markers.
 */
export async function uninstrumentedBuildViolations(
  root: string,
): Promise<{ scanned: number; violations: string[] }> {
  const files = (await filesBelow(root)).sort()
  const violations: string[] = []
  for (const path of files) {
    const where = relative(root, path).split(sep).join('/')
    violations.push(...usageInstrumentationViolations(`file name ${where}`, where))
    violations.push(...usageInstrumentationViolations(where, (await readFile(path)).toString('latin1')))
  }
  return { scanned: files.length, violations }
}
