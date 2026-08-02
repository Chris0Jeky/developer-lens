import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from './index.js'

describe('local API', () => {
  it('exposes a local-only health contract with hardened headers', async () => {
    const response = await request(app).get('/api/health').expect(200)

    expect(response.body).toEqual({ status: 'ok', privacy: 'local-only' })
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    expect(response.headers['x-powered-by']).toBeUndefined()
  })
})
