import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  LENS_PROJECTION_FIXTURE_GENERATED_AT,
  LENS_PROJECTION_FIXTURE_PRODUCER_COMMIT,
  LENS_PROJECTION_FIXTURE_RANGE,
  PublicLensProjectionContentSchema,
  type PublicLensProjection,
} from '../shared/lensProjection.js'
import { stableJson } from '../shared/researchFinding.js'
import { createPublicLensProjectionFromDashboard } from '../src/lib/publicLensProjection.js'
import { createPublicShowcaseDashboard } from './exportDemo.js'
import { isApprovedShowcaseRepositoryName } from './showcasePrivacyPolicy.js'

const CONTRACT_ROOT = ['research-contracts', 'lens-projection', 'v1'] as const

/** The producer version every projection carries: the package version, which is semver. */
export function lensProducerVersion(root = process.cwd()): string {
  return (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }).version
}

/**
 * The synthetic showcase reads the clock and the local time zone (day boundaries, DST-shifted
 * merge intervals). Pinning both makes the tracked fixture byte-identical on every machine.
 */
export function withPinnedUtc<T>(build: () => T): T {
  const previous = process.env.TZ
  process.env.TZ = 'UTC'
  try {
    return build()
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
}

/** The C0 showcase projection, produced by the real projection function from the synthetic showcase. */
export function createShowcaseLensProjection(root = process.cwd()): PublicLensProjection {
  return withPinnedUtc(() => {
    const dashboard = createPublicShowcaseDashboard(
      LENS_PROJECTION_FIXTURE_RANGE,
      new Date(LENS_PROJECTION_FIXTURE_GENERATED_AT),
    )
    const { projection } = createPublicLensProjectionFromDashboard(dashboard, {
      aliasSeed: `synthetic-showcase-${LENS_PROJECTION_FIXTURE_RANGE}`,
      repositoryRedaction: 'private-aliases',
      producerCommit: LENS_PROJECTION_FIXTURE_PRODUCER_COMMIT,
      producerVersion: lensProducerVersion(root),
      generatedAt: LENS_PROJECTION_FIXTURE_GENERATED_AT,
    })
    if (projection.dataClass !== 'C0' || !projection.repositories.every((repository) => repository.disclosure === 'synthetic' && isApprovedShowcaseRepositoryName(repository.label))) {
      throw new Error('lens-projection fixture is not a canonical C0 synthetic showcase projection')
    }
    return projection
  })
}

export function renderLensProjectionSchema(): string {
  const schema = z.toJSONSchema(PublicLensProjectionContentSchema) as Record<string, unknown>
  // zod emits the fixed six-entry DNA tuple as bare `prefixItems`, which JSON Schema would let
  // run short or long; close it the way the runtime tuple already does.
  const dna = (schema.properties as Record<string, Record<string, unknown>>).dna
  if (!Array.isArray(dna.prefixItems) || dna.prefixItems.length !== 6) throw new Error('lens-projection dna schema is not a six-entry tuple')
  Object.assign(dna, { items: false, minItems: 6, maxItems: 6 })
  schema.$comment = 'Structural validation is necessary but not sufficient. Consumers must also run the PublicLensProjectionSchema semantic, projectionHash and privacy checks stated in README.md.'
  return stableJson(schema)
}

export function renderLensProjectionFixture(root = process.cwd()): string {
  return stableJson(createShowcaseLensProjection(root))
}

export function lensFixtureSha256(fixtureText: string): string {
  return `sha256:${createHash('sha256').update(fixtureText, 'utf8').digest('hex')}`
}

function normalizeGeneratedText(text: string): string {
  return text.replaceAll('\r\n', '\n')
}

async function writeOrCheck(path: string, content: string, check: boolean): Promise<void> {
  if (check) {
    let existing: string
    try { existing = await readFile(path, 'utf8') } catch { throw new Error(`lens-projection output is missing: ${path}`) }
    if (normalizeGeneratedText(existing) !== normalizeGeneratedText(content)) throw new Error(`lens-projection output drift: ${path}`)
  } else await writeFile(path, content, 'utf8')
}

export async function generateLensProjection(root = process.cwd(), check = false): Promise<void> {
  const outputRoot = resolve(root, ...CONTRACT_ROOT)
  const outputs = new Map([
    ['schema.json', renderLensProjectionSchema()],
    ['showcase.fixture.json', renderLensProjectionFixture(root)],
  ])
  if (!check) await mkdir(outputRoot, { recursive: true })
  for (const [name, content] of outputs) await writeOrCheck(resolve(outputRoot, name), content, check)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await generateLensProjection(process.cwd(), process.argv.includes('--check'))
}
