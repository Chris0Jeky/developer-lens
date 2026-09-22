import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { analyzeDataset } from '../server/analytics.js'
import { COLLECTION_WARNINGS } from '../server/collectionWarnings.js'
import { createDemoDataset } from '../server/demo.js'

const outputDirectory = resolve('public', 'data')

/** Every range the synthetic showcase and the headless artifact exporter support. */
export const SHOWCASE_RANGES: readonly RangeKey[] = Object.freeze(['6m', '12m'] as const)

/**
 * The single constructor for the publishable synthetic dashboard. `scripts/exportArtifacts.ts`
 * imports it so the headless export and the hosted showcase can never describe different data.
 */
export function createPublicShowcaseDashboard(range: RangeKey, now?: Date): DashboardData {
  const dashboard = analyzeDataset(createDemoDataset(range, now))
  dashboard.meta.privacy = 'public-demo'
  dashboard.meta.subject = {
    login: 'synthetic-builder',
    name: 'Synthetic development story',
  }
  dashboard.meta.coverageScore = 100
  dashboard.meta.coverage = [
    {
      id: 'synthetic-generator',
      label: 'Synthetic activity generator',
      status: 'complete',
      detail: 'Every event in this hosted dataset is deterministic, invented showcase data.',
      itemCount: dashboard.summary.contributions,
    },
    {
      id: 'public-boundary',
      label: 'Public privacy boundary',
      status: 'complete',
      detail: 'Authenticated GitHub data and local Git history are intentionally excluded.',
    },
  ]
  dashboard.meta.warnings = [COLLECTION_WARNINGS.hostedShowcase()]
  return dashboard
}

async function writePublicShowcaseData(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true })
  for (const range of SHOWCASE_RANGES) {
    const path = resolve(outputDirectory, `dashboard-${range}.json`)
    await writeFile(
      path,
      `${JSON.stringify(createPublicShowcaseDashboard(range), null, 2)}\n`,
      'utf8',
    )
    console.log(`Generated synthetic public dashboard: ${path}`)
  }
}

// Importing this module must stay side-effect free: the exporter needs the constructor above
// without rewriting `public/data`.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writePublicShowcaseData()
}
