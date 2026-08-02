import { describe, expect, it } from 'vitest'
import { dashboardEndpoint } from './useDashboard'

describe('dashboardEndpoint', () => {
  it('keeps private runtime requests local and resolves static showcase data under the Pages base', () => {
    expect(dashboardEndpoint('6m', false, '/developer-lens/')).toBe('/api/dashboard?range=6m')
    expect(dashboardEndpoint('12m', true, '/developer-lens/')).toBe(
      '/developer-lens/data/dashboard-12m.json',
    )
  })
})
