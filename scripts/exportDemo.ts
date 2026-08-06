import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { analyzeDataset } from '../server/analytics.js'
import { createDemoDataset } from '../server/demo.js'
import { analyticReferenceId } from '../shared/findings.js'
import { buildIntegrationShapePresentation } from '../shared/integrationShape.js'
import {
  INTEGRATION_SHAPE_REFERENCES,
  resolveIntegrationShapeEvidence,
} from '../shared/integrationShapeEvidence.js'
import {
  INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
  parseIntegrationShapePresentationEnvelope,
} from '../shared/integrationShapeStoredPresentation.js'

const outputDirectory = resolve('public', 'data')

function publicDashboard(range: RangeKey): DashboardData {
  const dashboard = analyzeDataset(createDemoDataset(range))
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
  dashboard.meta.warnings = [
    'This hosted showcase demonstrates the analytical engine; its statistics do not describe a person.',
  ]
  return dashboard
}

await mkdir(outputDirectory, { recursive: true })
for (const range of ['6m', '12m'] as RangeKey[]) {
  const path = resolve(outputDirectory, `dashboard-${range}.json`)
  await writeFile(path, `${JSON.stringify(publicDashboard(range), null, 2)}\n`, 'utf8')
  console.log(`Generated synthetic public dashboard: ${path}`)
}

const integrationShapePath = resolve(outputDirectory, 'integration-shape.json')
const integrationShape = parseIntegrationShapePresentationEnvelope({
  presentationContractVersion: INTEGRATION_SHAPE_PRESENTATION_CONTRACT_VERSION,
  mode: 'synthetic',
  presentation: buildIntegrationShapePresentation(),
  resolutions: Object.fromEntries(
    INTEGRATION_SHAPE_REFERENCES.map((reference) => [
      analyticReferenceId(reference),
      resolveIntegrationShapeEvidence(reference),
    ]),
  ),
})
await writeFile(integrationShapePath, `${JSON.stringify(integrationShape, null, 2)}\n`, 'utf8')
console.log(`Generated synthetic Integration Shape presentation: ${integrationShapePath}`)
