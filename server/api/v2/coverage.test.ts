import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CAPABILITY_REGISTRY } from '../../../shared/capabilities.js'
import { COVERAGE_STATUSES, completeObservedUnits } from '../../../shared/coverage.js'
import { isoWeekLabel } from '../../../shared/presentationGrain.js'
import { PresentationLeakError, assertPresentationSafe } from '../../analysis/integrationShape.js'
import type { V2RuntimeConfig } from './config.js'
import {
  SYNTHETIC_STORE_MARKER,
  V2CapabilitiesResponseSchema,
  V2CoverageResponseSchema,
  V2StoreProvenanceSchema,
} from './contract.js'
import { V2Error } from './errors.js'
import { assertV2Request } from './guard.js'
import { createV2Router } from './router.js'
import { SYNTHETIC_COVERAGE_RECORDS } from './syntheticCoverageFixtures.js'
import { seedSyntheticCoverageStore } from './syntheticImporter.js'

const TOKEN = 'f0e1d2c3b4a5968778695a4b3c2d1e0f0e1d2c3b4a5968778695a4b3c2d1e0f0'
const API_HOST = '127.0.0.1:4141'
const WEB_ORIGIN = 'http://127.0.0.1:5173'

const SAME_ORIGIN_METADATA = {
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
}

let directory: string
let syntheticStore: string

function configFor(storePath: string): V2RuntimeConfig {
  return {
    token: TOKEN,
    allowedHosts: [API_HOST],
    allowedOrigins: [WEB_ORIGIN],
    storePath,
  }
}

function appFor(storePath: string): express.Express {
  const app = express()
  app.use('/api/v2', createV2Router(configFor(storePath)))
  return app
}

function authorized(app: express.Express, path: string) {
  return request(app)
    .get(path)
    .set('Host', API_HOST)
    .set('Origin', WEB_ORIGIN)
    .set('Authorization', `Bearer ${TOKEN}`)
}

async function storeIn(name: string): Promise<string> {
  return join(await mkdtemp(join(directory, `${name}-`)), 'store.sqlite')
}

function mutateStore(path: string, mutate: (db: Database.Database) => void): void {
  const db = new Database(path)
  try {
    mutate(db)
  } finally {
    db.close()
  }
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'developer-lens-v2-bridge-'))
  syntheticStore = join(directory, 'synthetic.sqlite')
  seedSyntheticCoverageStore(syntheticStore)
})

afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('V2 bridge coverage endpoint', () => {
  it('serves every coverage state from the synthetic store under the shared contract', async () => {
    const response = await authorized(appFor(syntheticStore), '/api/v2/coverage').expect(200)
    const body = V2CoverageResponseSchema.parse(response.body)

    expect(body.provenance.mode).toBe('synthetic')
    expect(body.provenance.syntheticMarker).toBe(SYNTHETIC_STORE_MARKER)
    expect(body.records).toHaveLength(SYNTHETIC_COVERAGE_RECORDS.length)
    expect(new Set(body.records.map((record) => record.status))).toEqual(new Set(COVERAGE_STATUSES))
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('keeps absent and restricted states out of the numeric surface', async () => {
    const response = await authorized(appFor(syntheticStore), '/api/v2/coverage').expect(200)
    const body = V2CoverageResponseSchema.parse(response.body)

    for (const view of body.records) {
      const canonical = SYNTHETIC_COVERAGE_RECORDS.find((record) => record.status === view.status)!
      // The projection applies the complete-only rule itself, so the client never has to.
      expect(view.observedUnits).toBe(completeObservedUnits(canonical))
      if (view.status !== 'complete') expect(view.observedUnits).toBeNull()
    }
    const neverAuthorized = body.records.find((record) => record.status === 'never_authorized')
    expect(neverAuthorized?.expectedUnits).toBeNull()
    expect(neverAuthorized?.omittedUnits).toBeNull()
  })

  it('serves a PresentationView, never the canonical coverage record (#79)', async () => {
    const response = await authorized(appFor(syntheticStore), '/api/v2/coverage').expect(200)
    const body = V2CoverageResponseSchema.parse(response.body)
    const serialized = JSON.stringify(body)

    // The canonical shape would fail the presentation guard on `coverageId` alone; the
    // projection is what makes this response servable.
    expect(() => assertPresentationSafe(body, 'coverage response')).not.toThrow()
    expect(() =>
      assertPresentationSafe(
        { records: SYNTHETIC_COVERAGE_RECORDS },
        'canonical coverage records',
      ),
    ).toThrow(PresentationLeakError)

    for (const record of SYNTHETIC_COVERAGE_RECORDS) {
      expect(serialized).not.toContain(record.coverageId)
      expect(serialized).not.toContain(record.scopeAlias)
      expect(serialized).not.toContain(record.rangeStart)
      expect(serialized).not.toContain(record.rangeEnd)
      expect(serialized).not.toContain(record.observedAt)
    }
    for (const view of body.records) {
      expect(Object.keys(view).sort()).toEqual([
        'capabilityId',
        'expectedUnits',
        'limitationCode',
        'observedAtLabel',
        'observedUnits',
        'omittedUnits',
        'retryable',
        'rowKey',
        'saturationReason',
        'status',
        'windowEndLabel',
        'windowStartLabel',
      ])
      for (const label of [view.windowStartLabel, view.windowEndLabel, view.observedAtLabel]) {
        expect(label).toMatch(/^\d{4}-W\d{2}$/)
      }
    }
    expect(body.records.map((view) => view.rowKey)).toEqual(
      body.records.map((_view, index) => `coverage-row-${index + 1}`),
    )
  })

  it('computes the ISO-week window labels server-side from the UTC calendar date (#79)', async () => {
    const response = await authorized(appFor(syntheticStore), '/api/v2/coverage').expect(200)
    const body = V2CoverageResponseSchema.parse(response.body)

    for (const view of body.records) {
      const canonical = SYNTHETIC_COVERAGE_RECORDS.find((record) => record.status === view.status)!
      expect(view.windowStartLabel).toBe(isoWeekLabel(canonical.rangeStart))
      expect(view.windowEndLabel).toBe(isoWeekLabel(canonical.rangeEnd))
      expect(view.observedAtLabel).toBe(isoWeekLabel(canonical.observedAt))
    }
  })

  it('reports capability lifecycle without transitioning anything', async () => {
    const before = CAPABILITY_REGISTRY.map((definition) => definition.authorization)
    const response = await authorized(appFor(syntheticStore), '/api/v2/capabilities').expect(200)
    const body = V2CapabilitiesResponseSchema.parse(response.body)

    expect(body.activation).toBe('reporting_only')
    expect(body.capabilities).toHaveLength(CAPABILITY_REGISTRY.length)
    expect(body.capabilities.every((view) => view.lifecycleState === 'never_authorized')).toBe(true)
    expect(CAPABILITY_REGISTRY.map((definition) => definition.authorization)).toEqual(before)
  })
})

describe('V2 bridge request guard', () => {
  it('rejects a wrong or missing bearer', async () => {
    const app = appFor(syntheticStore)
    const wrong = await request(app)
      .get('/api/v2/coverage')
      .set('Host', API_HOST)
      .set('Origin', WEB_ORIGIN)
      .set('Authorization', `Bearer ${'0'.repeat(64)}`)
      .expect(401)
    expect(wrong.body).toEqual({ error: { code: 'V2_UNAUTHORIZED' } })

    await request(app)
      .get('/api/v2/coverage')
      .set('Host', API_HOST)
      .set('Origin', WEB_ORIGIN)
      .expect(401)

    await request(app)
      .get('/api/v2/coverage')
      .set('Host', API_HOST)
      .set('Origin', WEB_ORIGIN)
      .set('Authorization', TOKEN)
      .expect(401)
  })

  it('rejects a wrong or malformed Host', async () => {
    const app = appFor(syntheticStore)
    for (const host of ['localhost:4141', '127.0.0.1', '127.0.0.1:4141.evil.example', 'evil.example']) {
      const response = await request(app)
        .get('/api/v2/coverage')
        .set('Host', host)
        .set('Origin', WEB_ORIGIN)
        .set('Authorization', `Bearer ${TOKEN}`)
        .expect(403)
      expect(response.body).toEqual({ error: { code: 'V2_HOST_NOT_ALLOWED' } })
    }
  })

  it('rejects a missing or duplicated Host header at the guard boundary', () => {
    const options = configFor(syntheticStore)
    expect(() => assertV2Request({}, options)).toThrow(V2Error)
    expect(() => assertV2Request({}, options)).toThrow('V2_HOST_NOT_ALLOWED')
    expect(() => assertV2Request({ host: [API_HOST, API_HOST] }, options)).toThrow(
      'V2_HOST_NOT_ALLOWED',
    )
  })

  it('rejects a wrong or malformed Origin', async () => {
    const app = appFor(syntheticStore)
    for (const origin of [
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5173/',
      'https://127.0.0.1:5173',
      'http://evil.127.0.0.1:5173',
      'null',
      '',
    ]) {
      const response = await request(app)
        .get('/api/v2/coverage')
        .set('Host', API_HOST)
        .set('Origin', origin)
        .set('Authorization', `Bearer ${TOKEN}`)
        .expect(403)
      expect(response.body).toEqual({ error: { code: 'V2_ORIGIN_NOT_ALLOWED' } })
    }
  })

  it('rejects a missing Origin unless the browser proves a same-origin fetch', async () => {
    const app = appFor(syntheticStore)

    await request(app)
      .get('/api/v2/coverage')
      .set('Host', API_HOST)
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(403)

    await request(app)
      .get('/api/v2/coverage')
      .set('Host', API_HOST)
      .set('Authorization', `Bearer ${TOKEN}`)
      .set({ ...SAME_ORIGIN_METADATA, 'Sec-Fetch-Site': 'cross-site' })
      .expect(403)

    await request(app)
      .get('/api/v2/coverage')
      .set('Host', API_HOST)
      .set('Authorization', `Bearer ${TOKEN}`)
      .set({ ...SAME_ORIGIN_METADATA, 'Sec-Fetch-Mode': 'no-cors' })
      .expect(403)

    await request(app)
      .get('/api/v2/coverage')
      .set('Host', API_HOST)
      .set('Authorization', `Bearer ${TOKEN}`)
      .set(SAME_ORIGIN_METADATA)
      .expect(200)
  })

  it('rejects a disallowed Origin even when fetch metadata claims same-origin', async () => {
    await request(appFor(syntheticStore))
      .get('/api/v2/coverage')
      .set('Host', API_HOST)
      .set('Origin', 'http://evil.example')
      .set('Authorization', `Bearer ${TOKEN}`)
      .set(SAME_ORIGIN_METADATA)
      .expect(403)
  })

  it('rejects on Host before it ever inspects the bearer', async () => {
    const response = await request(appFor(syntheticStore))
      .get('/api/v2/coverage')
      .set('Host', 'evil.example')
      .set('Origin', WEB_ORIGIN)
      .set('Authorization', `Bearer ${'0'.repeat(64)}`)
      .expect(403)
    expect(response.body).toEqual({ error: { code: 'V2_HOST_NOT_ALLOWED' } })
  })

  it('answers an unknown V2 resource with a stable redacted code', async () => {
    const response = await authorized(appFor(syntheticStore), '/api/v2/features').expect(404)
    expect(response.body).toEqual({ error: { code: 'V2_NOT_FOUND' } })
  })
})

describe('V2 bridge store provenance gate', () => {
  it('refuses a store that does not exist', async () => {
    const response = await authorized(
      appFor(join(directory, 'absent', 'store.sqlite')),
      '/api/v2/coverage',
    ).expect(503)
    expect(response.body).toEqual({ error: { code: 'V2_STORE_UNAVAILABLE' } })
  })

  it('refuses a store with no provenance marker', async () => {
    const path = await storeIn('unmarked')
    seedSyntheticCoverageStore(path)
    mutateStore(path, (db) => {
      db.prepare('DELETE FROM v2_store_provenance').run()
    })

    const response = await authorized(appFor(path), '/api/v2/coverage').expect(409)
    expect(response.body).toEqual({ error: { code: 'V2_STORE_PROVENANCE_REFUSED' } })
    await authorized(appFor(path), '/api/v2/capabilities').expect(409)
  })

  it('refuses a store bound to an unreviewed activation card', async () => {
    const path = await storeIn('activation')
    seedSyntheticCoverageStore(path, {
      provenance: V2StoreProvenanceSchema.parse({
        mode: 'activation_card',
        syntheticMarker: null,
        activationCardId: 'invented-activation-card',
        importerVersion: '1.0.0',
        createdAt: '2026-08-04T00:00:00.000Z',
      }),
    })

    const response = await authorized(appFor(path), '/api/v2/coverage').expect(409)
    expect(response.body).toEqual({ error: { code: 'V2_ACTIVATION_CARD_NOT_REVIEWED' } })
  })

  it('refuses a SQLite file that is not a Developer Lens V2 store', async () => {
    const path = await storeIn('foreign')
    mutateStore(path, (db) => {
      db.exec('CREATE TABLE invented (value TEXT)')
    })

    const response = await authorized(appFor(path), '/api/v2/coverage').expect(409)
    expect(response.body).toEqual({ error: { code: 'V2_STORE_PROVENANCE_REFUSED' } })
  })

  it('refuses a stored identifier that the storage CHECK allows but the boundary does not', async () => {
    const path = await storeIn('identifier')
    seedSyntheticCoverageStore(path)
    // Accepted by the coverage_id CHECK (allowed charset, under 256 characters)
    // and by CoverageRecordSchema, rejected by the opaque-identifier rule the
    // V2 boundary applies.
    mutateStore(path, (db) => {
      db.prepare(
        "UPDATE v2_coverage_record SET coverage_id = '-synthetic-coverage-leading-dash' WHERE status = 'complete'",
      ).run()
    })

    const response = await authorized(appFor(path), '/api/v2/coverage').expect(500)
    expect(response.body).toEqual({ error: { code: 'V2_RESPONSE_CONTRACT_VIOLATION' } })
  })

  it('refuses a retryable value that is not exactly 0 or 1', async () => {
    const path = await storeIn('retryable')
    seedSyntheticCoverageStore(path)
    mutateStore(path, (db) => {
      // Rebuild the row table without its retryable CHECK, simulating a store
      // whose constraint was lost, then write a value that a truthiness
      // conversion would silently read as `false`.
      db.exec('DROP TABLE v2_coverage_record')
      db.exec(
        `CREATE TABLE v2_coverage_record (
          coverage_id TEXT PRIMARY KEY NOT NULL,
          capability_id TEXT NOT NULL,
          scope_alias TEXT NOT NULL,
          range_start TEXT NOT NULL,
          range_end TEXT NOT NULL,
          status TEXT NOT NULL,
          expected_units INTEGER,
          observed_units INTEGER NOT NULL,
          omitted_units INTEGER,
          saturation_reason TEXT,
          retryable INTEGER NOT NULL,
          observed_at TEXT NOT NULL,
          limitation_code TEXT NOT NULL
        ) STRICT`,
      )
      db.prepare(
        'INSERT INTO v2_coverage_record VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        'synthetic-coverage-bad-retryable',
        'github.core',
        'synthetic-scope-alpha',
        '2026-01-01T00:00:00.000Z',
        '2026-04-01T00:00:00.000Z',
        'failed',
        null,
        0,
        null,
        null,
        2,
        '2026-04-01T00:00:00.000Z',
        'TRANSPORT_FAILURE',
      )
    })

    const response = await authorized(appFor(path), '/api/v2/coverage').expect(500)
    expect(response.body).toEqual({ error: { code: 'V2_RESPONSE_CONTRACT_VIOLATION' } })
  })

  it('refuses a stored row that violates the shared coverage contract', async () => {
    const path = await storeIn('malformed')
    seedSyntheticCoverageStore(path)
    mutateStore(path, (db) => {
      db.prepare("UPDATE v2_coverage_record SET omitted_units = 5 WHERE status = 'complete'").run()
    })

    const response = await authorized(appFor(path), '/api/v2/coverage').expect(500)
    expect(response.body).toEqual({ error: { code: 'V2_RESPONSE_CONTRACT_VIOLATION' } })
    expect(Object.keys(response.body.error)).toEqual(['code'])
  })
})

// These two load real module graphs (the whole local API, then the native
// storage driver behind the lazy mount), which can exceed the default 5s
// budget when the full suite runs under constrained workers.
const MODULE_GRAPH_TIMEOUT_MS = 30_000

describe('V2 bridge mount', () => {
  it('mounts on the local API without touching the legacy surface', async () => {
    const { app } = await import('../../index.js')

    await request(app).get('/api/health').expect(200, { status: 'ok', privacy: 'local-only' })
    const rejected = await request(app)
      .get('/api/v2/coverage')
      .set('Host', API_HOST)
      .set('Origin', WEB_ORIGIN)
      .expect(401)
    expect(rejected.body).toEqual({ error: { code: 'V2_UNAUTHORIZED' } })
  }, MODULE_GRAPH_TIMEOUT_MS)

  it('serves both resources through the real lazy mount', async () => {
    const path = await storeIn('mounted')
    seedSyntheticCoverageStore(path)
    const previousStore = process.env.DEVELOPER_LENS_V2_STORE
    process.env.DEVELOPER_LENS_V2_STORE = path

    try {
      const { mountV2 } = await import('./mount.js')
      const app = express()
      app.use('/api/v2', mountV2(TOKEN))

      const coverage = await request(app)
        .get('/api/v2/coverage')
        .set('Host', API_HOST)
        .set('Authorization', `Bearer ${TOKEN}`)
        .set(SAME_ORIGIN_METADATA)
        .expect(200)
      const coverageBody = V2CoverageResponseSchema.parse(coverage.body)
      expect(coverageBody.provenance.syntheticMarker).toBe(SYNTHETIC_STORE_MARKER)
      expect(new Set(coverageBody.records.map((record) => record.status))).toEqual(
        new Set(COVERAGE_STATUSES),
      )

      const capabilities = await request(app)
        .get('/api/v2/capabilities')
        .set('Host', API_HOST)
        .set('Origin', WEB_ORIGIN)
        .set('Authorization', `Bearer ${TOKEN}`)
        .expect(200)
      expect(V2CapabilitiesResponseSchema.parse(capabilities.body).capabilities).toHaveLength(
        CAPABILITY_REGISTRY.length,
      )

      await request(app)
        .get('/api/v2/coverage')
        .set('Host', API_HOST)
        .set('Authorization', `Bearer ${'0'.repeat(64)}`)
        .set(SAME_ORIGIN_METADATA)
        .expect(401)
    } finally {
      if (previousStore === undefined) delete process.env.DEVELOPER_LENS_V2_STORE
      else process.env.DEVELOPER_LENS_V2_STORE = previousStore
    }
  }, MODULE_GRAPH_TIMEOUT_MS)

  it('keeps the native storage driver behind a dynamic import', async () => {
    const repositoryRoot = process.cwd()
    const indexSource = await readFile(join(repositoryRoot, 'server', 'index.ts'), 'utf8')
    const mountSource = await readFile(join(repositoryRoot, 'server', 'api', 'v2', 'mount.ts'), 'utf8')

    const v2Lines = indexSource.split('\n').filter((line) => line.includes('api/v2'))
    expect(v2Lines).toHaveLength(1)
    expect(indexSource).not.toMatch(/^import[^\n]*better-sqlite3/m)
    expect(mountSource).not.toMatch(/^import[^\n]*better-sqlite3/m)
    expect(mountSource).not.toMatch(/^import[^\n]*['"]\.\/(router|store)\.js['"]/m)
    expect(mountSource).toMatch(/import\('\.\/router\.js'\)/)
  })
})
