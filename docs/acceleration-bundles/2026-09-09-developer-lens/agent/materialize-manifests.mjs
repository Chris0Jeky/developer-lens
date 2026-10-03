import { lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

function materialize(stem) {
  const index = JSON.parse(readFileSync(join(here, `${stem}.json`), 'utf8'))
  const values = []
  for (const [partIndex, part] of index.parts.entries()) {
    const parsed = JSON.parse(readFileSync(join(here, part.path), 'utf8'))
    if (parsed.part !== partIndex + 1 || parsed.totalParts !== index.parts.length) {
      throw new Error(`${stem}: invalid part sequence for ${part.path}`)
    }
    if (!Array.isArray(parsed[index.collectionKey]) || parsed[index.collectionKey].length !== part.count) {
      throw new Error(`${stem}: part count mismatch for ${part.path}`)
    }
    values.push(...parsed[index.collectionKey])
  }
  if (values.length !== index.totalCount) throw new Error(`${stem}: total count mismatch`)
  return {
    schemaVersion: index.materializedSchemaVersion,
    generatedAt: index.generatedAt,
    [index.collectionKey]: values,
  }
}

const results = {
  'decision-catalog': materialize('decision-catalog'),
  'issue-manifest': materialize('issue-manifest'),
}

const outIndex = process.argv.indexOf('--out')
if (outIndex >= 0) {
  const out = process.argv[outIndex + 1]
  if (!out) throw new Error('--out requires a directory')
  mkdirSync(out, { recursive: true })
  if (realpathSync(out) === realpathSync(here)) {
    throw new Error('The output directory must not resolve to the source directory')
  }
  // Preflight both targets before writing either one. Directory aliases, symlinked
  // output files and hard links must never turn an export into a source-index write.
  const sources = Object.keys(results).map((name) => statSync(join(here, `${name}.json`)))
  for (const name of Object.keys(results)) {
    const target = lstatSync(join(out, `${name}.json`), { throwIfNoEntry: false })
    if (target?.isSymbolicLink()) throw new Error('An output target must not be a symlink')
    if (target && sources.some((source) => source.dev === target.dev && source.ino === target.ino)) {
      throw new Error('An output target must not alias a source index')
    }
  }
  for (const [name, value] of Object.entries(results)) {
    writeFileSync(join(out, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  }
}

console.log(JSON.stringify({
  decisions: results['decision-catalog'].decisions.length,
  issues: results['issue-manifest'].issues.length,
}, null, 2))
