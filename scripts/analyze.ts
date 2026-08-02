import { readFile, writeFile } from 'node:fs/promises'
import type { RangeKey, RawDataset } from '../shared/types.js'
import { analyzeDataset } from '../server/analytics.js'
import { dashboardPath, rawPath } from '../server/dataStore.js'

async function main() {
  for (const range of ['6m', '12m'] as RangeKey[]) {
    try {
      const raw = JSON.parse(await readFile(rawPath(range), 'utf8')) as RawDataset
      const dashboard = analyzeDataset(raw)
      await writeFile(dashboardPath(range), JSON.stringify(dashboard, null, 2), 'utf8')
      console.log(`Rebuilt ${range} with ${dashboard.insights.length} insights.`)
    } catch (error) {
      const missing = error as NodeJS.ErrnoException
      if (missing.code !== 'ENOENT') throw error
    }
  }
}

main().catch((error: Error) => {
  console.error(`Analysis failed: ${error.message}`)
  process.exitCode = 1
})
