import { useEffect, useState } from 'react'
import type { DashboardData, RangeKey } from '../../shared/types'

interface DashboardState {
  data?: DashboardData
  loading: boolean
  error?: string
}

export function useDashboard(range: RangeKey): DashboardState {
  const [state, setState] = useState<DashboardState>({ loading: true })

  useEffect(() => {
    const controller = new AbortController()
    setState((current) => ({ ...current, loading: true, error: undefined }))

    fetch(`/api/dashboard?range=${range}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Local API returned ${response.status}`)
        return (await response.json()) as DashboardData
      })
      .then((data) => setState({ data, loading: false }))
      .catch((error: Error) => {
        if (error.name === 'AbortError') return
        setState({
          loading: false,
          error:
            'The local data service is not available. Run npm run dev, or npm run start after building.',
        })
      })

    return () => controller.abort()
  }, [range])

  return state
}
