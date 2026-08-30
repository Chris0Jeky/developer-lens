import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  GATES,
  LIMITATIONS,
  METRICS,
  METHODS,
  RESEARCH_FINDING_LAB_COMMIT,
  RESEARCH_FINDING_PRODUCT_COMMIT,
  RESEARCH_FINDING_PRODUCER,
  RESEARCH_FINDING_PUBLIC_URL,
  RESEARCH_FINDING_SCHEMA_VERSION,
  ResearchFindingSchema,
  UNSUPPORTED_CLAIMS,
  assertResearchFindingPrivacy,
  computeResearchFindingBundleHash,
  stableJson,
  type ResearchFinding,
} from '../shared/researchFinding.js'

const CONTRACT_ROOT = ['research-contracts', 'research-finding', 'v1'] as const

export function createWbc1ResearchFinding(): ResearchFinding {
  const finding = ResearchFindingSchema.parse({
    schema_version: RESEARCH_FINDING_SCHEMA_VERSION,
    classification: 'C0',
    subject_class: 'software-system',
    generated_at: '2026-08-30T00:00:00Z',
    finding: {
      id: 'wbc1',
      title: 'WB-C1 method trial: why the simple baseline won',
      question: 'Can the BOCPD candidate reduce false alerts per year versus the rolling median and MAD baseline without worsening detection or calibration?',
    },
    methods: {
      baseline: { method_code: 'rolling_median_mad', display_name: METHODS.rolling_median_mad },
      candidate: { method_code: 'bocpd_gaussian', display_name: METHODS.bocpd_gaussian },
    },
    decision: {
      outcome: 'reject',
      retained_fallback: 'rolling_median_mad',
      summary: 'The candidate is rejected because both selections are nonviable and false alerts are higher.',
    },
    metrics: [
      { key: 'detection_rate', label: METRICS.detection_rate.label, unit: 'rate', better_when: 'higher', baseline: { status: 'measured', value: 0.75 }, candidate: { status: 'measured', value: 0.75 } },
      { key: 'false_alerts_per_year', label: METRICS.false_alerts_per_year.label, unit: 'count_per_year', better_when: 'lower', baseline: { status: 'measured', value: 2.966666666666667 }, candidate: { status: 'measured', value: 4.2 } },
    ],
    gates: [
      { code: 'baseline_selection', label: GATES.baseline_selection, passed: false },
      { code: 'candidate_selection', label: GATES.candidate_selection, passed: false },
      { code: 'detection_floor', label: GATES.detection_floor, passed: true },
      { code: 'delay_budget', label: GATES.delay_budget, passed: true },
      { code: 'false_alert_improvement', label: GATES.false_alert_improvement, passed: false },
      { code: 'not_worse_detection', label: GATES.not_worse_detection, passed: true },
      { code: 'confound_guard', label: GATES.confound_guard, passed: true },
    ],
    limitations: Object.entries(LIMITATIONS).map(([code, display_text]) => ({ code, display_text })),
    unsupported_claims: Object.entries(UNSUPPORTED_CLAIMS).map(([code, display_text]) => ({ code, display_text })),
    provenance: {
      producer: RESEARCH_FINDING_PRODUCER,
      source_lab_commit: RESEARCH_FINDING_LAB_COMMIT,
      source_product_contract_commit: RESEARCH_FINDING_PRODUCT_COMMIT,
      bundle_hash: 'sha256:' + '0'.repeat(64),
      public_url: RESEARCH_FINDING_PUBLIC_URL,
    },
  } as ResearchFinding)
  finding.provenance.bundle_hash = computeResearchFindingBundleHash(finding)
  return ResearchFindingSchema.parse(finding)
}

type JsonSchemaObject = Record<string, unknown>

function enrichSchema(value: unknown): JsonSchemaObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ResearchFinding schema root must be an object')
  const schema = value as JsonSchemaObject
  schema.$comment = 'Structural validation is necessary but not sufficient. Consumers must also run ResearchFindingSchema semantic checks and the published privacy policy.'
  return schema
}

export function renderResearchFindingSchema(): string {
  return stableJson(enrichSchema(z.toJSONSchema(ResearchFindingSchema)))
}

export function renderResearchFindingFixture(): string {
  const finding = createWbc1ResearchFinding()
  assertResearchFindingPrivacy(finding)
  return stableJson(finding)
}

export function fixtureSha256(fixtureText = renderResearchFindingFixture()): string {
  return `sha256:${createHash('sha256').update(fixtureText, 'utf8').digest('hex')}`
}

async function writeOrCheck(path: string, content: string, check: boolean): Promise<void> {
  if (check) {
    let existing: string
    try { existing = await readFile(path, 'utf8') } catch { throw new Error(`research-finding output is missing: ${path}`) }
    if (existing !== content) throw new Error(`research-finding output drift: ${path}`)
  } else await writeFile(path, content, 'utf8')
}

export async function generateResearchFinding(root = process.cwd(), check = false): Promise<void> {
  const outputRoot = resolve(root, ...CONTRACT_ROOT)
  const fixture = renderResearchFindingFixture()
  assertResearchFindingPrivacy(JSON.parse(fixture))
  const outputs = new Map([
    ['schema.json', renderResearchFindingSchema()],
    ['wbc1.fixture.json', fixture],
  ])
  if (!check) await mkdir(outputRoot, { recursive: true })
  for (const [name, content] of outputs) await writeOrCheck(resolve(outputRoot, name), content, check)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await generateResearchFinding(process.cwd(), process.argv.includes('--check'))
}
