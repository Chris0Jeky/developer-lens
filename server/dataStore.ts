import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DashboardData, RangeKey } from '../shared/types.js'
import { analyzeDataset } from './analytics.js'
import { createDemoDataset } from './demo.js'

export const PRIVATE_DATA_DIRECTORY = join(process.cwd(), '.developer-lens')

export function dashboardPath(range: RangeKey): string {
  return join(PRIVATE_DATA_DIRECTORY, `dashboard-${range}.json`)
}

export function rawPath(range: RangeKey): string {
  return join(PRIVATE_DATA_DIRECTORY, `raw-${range}.json`)
}

export async function loadDashboard(range: RangeKey): Promise<DashboardData> {
  try {
    const serialized = await readFile(dashboardPath(range), 'utf8')
    return JSON.parse(serialized) as DashboardData
  } catch (error) {
    const missing = error as NodeJS.ErrnoException
    if (missing.code !== 'ENOENT') throw error
    return analyzeDataset(createDemoDataset(range))
  }
}
