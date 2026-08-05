import { readFile, readdir } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

/**
 * Post-build credential canary for the PLAIN build (#78).
 *
 * `npm run build:showcase` already ends in `verify:showcase`, which enforces the full public
 * policy — synthetic identities, export boundaries, native-dependency markers, and these same
 * credential patterns. A hand-built `dist` from `npm run build` was scanned by nothing at all,
 * so a token that reached the bundle would only be caught if someone happened to run the
 * showcase build. This script is the narrow credential-only half of that policy, appended to
 * `build` so every emitted `dist` is scanned.
 *
 * It deliberately does NOT duplicate the showcase's synthetic-data rules: those describe what
 * may be PUBLISHED, and a private local build is not a publication. What must never be in a
 * bundle regardless of where it is served from is a credential.
 *
 * After #78 the browser holds no bearer at all, so a match here means the delivery channel came
 * back — which is exactly the regression this exists to catch.
 */

const dist = resolve('dist')
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt'])

const forbiddenPatterns: { label: string; pattern: RegExp }[] = [
  { label: 'GitHub token prefix', pattern: /\b(?:github_pat_|gh[pousr]_)\w+/i },
  { label: 'private key material', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    label: 'V2 bridge bearer environment object',
    pattern: /["'`]?(?:VITE_)?DEVELOPER_LENS_V2_TOKEN["'`]?\s*[:=]/,
  },
]

/**
 * Vite inlines `import.meta.env.VITE_*` at build time, and the emitted output keeps the VALUE
 * while the variable name never survives — so the name pattern above catches the env object and
 * the real detector is the value itself, whenever one is present in this environment.
 */
function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\-]/g, '\\$&')
}

for (const variable of ['VITE_DEVELOPER_LENS_V2_TOKEN', 'DEVELOPER_LENS_V2_TOKEN'] as const) {
  const value = process.env[variable]
  if (value && value.length >= 8) {
    forbiddenPatterns.push({
      label: `${variable} value`,
      pattern: new RegExp(escapeForRegExp(value)),
    })
  }
}

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? filesBelow(path) : Promise.resolve([path])
    }),
  )
  return files.flat()
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

let scanned = 0
for (const path of await filesBelow(dist)) {
  if (!textExtensions.has(extname(path))) continue
  const content = await readFile(path, 'utf8')
  scanned += 1
  for (const forbidden of forbiddenPatterns) {
    assert(!forbidden.pattern.test(content), `${forbidden.label} found in ${path}`)
  }
}

assert(scanned > 0, 'no build output was scanned; dist is empty or missing')
console.log(`Verified credential patterns across ${scanned} build output files.`)
