import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

// Invented fixture only: the legacy routes must never touch `.developer-lens/` in a test.
vi.mock('./dataStore.js', () => ({
  loadDashboard: vi.fn(async (range: string) => ({ syntheticFixture: true, range })),
  dashboardPath: (range: string) => `__nonexistent__/synthetic-dashboard-${range}.json`,
}))

const { app } = await import('./index.js')

const SAME_ORIGIN_FETCH = {
  Host: '127.0.0.1:4141',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
}

describe('local API', () => {
  it('exposes a local-only health contract with hardened headers', async () => {
    const response = await request(app).get('/api/health').expect(200)

    expect(response.body).toEqual({ status: 'ok', privacy: 'local-only' })
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    expect(response.headers['x-powered-by']).toBeUndefined()
  })

  // #416: the legacy private routes sit behind the same Host/Origin boundary as `/api/v2`.
  describe.each([
    '/api/dashboard?range=12m',
    '/api/status',
    // Express routing is case-insensitive and non-strict; the guard must cover every alias.
    '/API/Dashboard',
    '/api/status/',
  ])('legacy route %s', (path) => {
    it('refuses a foreign Host (DNS rebinding)', async () => {
      const response = await request(app)
        .get(path)
        .set({ ...SAME_ORIGIN_FETCH, Host: 'attacker-controlled.test:4141' })
        .expect(403)
      expect(response.body).toEqual({ error: { code: 'V2_HOST_NOT_ALLOWED' } })
    })

    it('refuses a foreign Origin on an allowlisted Host', async () => {
      const response = await request(app)
        .get(path)
        .set({
          Host: '127.0.0.1:4141',
          Origin: 'http://attacker-controlled.test:4141',
          'Sec-Fetch-Site': 'cross-site',
        })
        .expect(403)
      expect(response.body).toEqual({ error: { code: 'V2_ORIGIN_NOT_ALLOWED' } })
    })

    it('refuses a bare request with no browser proof and no bearer', async () => {
      await request(app).get(path).set('Host', '127.0.0.1:4141').expect(403)
    })

    it.each(['127.0.0.1:4141', '127.0.0.1:5173'])(
      'serves a same-origin browser fetch on %s (direct and Vite proxy)',
      async (host) => {
        const response = await request(app)
          .get(path)
          .set({ ...SAME_ORIGIN_FETCH, Host: host })
          .expect(200)
        expect(response.headers['cache-control']).toBe('private, no-store')
      },
    )
  })

  it('returns the invented dashboard fixture to a same-origin fetch', async () => {
    const response = await request(app).get('/api/dashboard?range=6m').set(SAME_ORIGIN_FETCH)
    expect(response.body).toEqual({ syntheticFixture: true, range: '6m' })
  })
})
