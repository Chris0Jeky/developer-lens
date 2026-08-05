import { join } from 'node:path'
import { tmpdir } from 'node:os'
import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { V2RuntimeConfig } from './config.js'
import { V2EvidenceResolveResponseSchema } from './contract.js'
import { createV2Router } from './router.js'
import { CLAIM_IDS, EVIDENCE_IDS, INTEGRATION_SHAPE_SCOPE_ALIAS } from '../../../shared/integrationShape.js'
import {
  INTEGRATION_SHAPE_REFERENCES,
  resolveIntegrationShapeEvidence,
} from '../../../shared/integrationShapeEvidence.js'

/**
 * DL-VALUE-01 — the minimal evidence endpoint. It inherits the V2 guard (bearer + Host + same-origin
 * fetch-metadata), serves only presentation projections, and never touches the SQLite store.
 */

const TOKEN = 'f0e1d2c3b4a5968778695a4b3c2d1e0f0e1d2c3b4a5968778695a4b3c2d1e0f0'
const API_HOST = '127.0.0.1:4141'
const WEB_ORIGIN = 'http://127.0.0.1:5173'
// The evidence routes never open the store, so any path serves.
const UNUSED_STORE = join(tmpdir(), 'developer-lens-evidence-nostore.sqlite')

function configFor(): V2RuntimeConfig {
  return { token: TOKEN, allowedHosts: [API_HOST], allowedOrigins: [WEB_ORIGIN], storePath: UNUSED_STORE }
}

function app(): express.Express {
  const server = express()
  server.use('/api/v2', createV2Router(configFor()))
  return server
}

function authorized(path: string) {
  return request(app()).get(path).set('Host', API_HOST).set('Origin', WEB_ORIGIN).set('Authorization', `Bearer ${TOKEN}`)
}

describe('V2 evidence endpoint — guard', () => {
  it('rejects a request with no bearer', async () => {
    await request(app()).get('/api/v2/evidence/finding').set('Host', API_HOST).set('Origin', WEB_ORIGIN).expect(401)
  })

  it('rejects a request from a host outside the allowlist', async () => {
    await request(app())
      .get('/api/v2/evidence/finding')
      .set('Host', 'evil.example')
      .set('Origin', WEB_ORIGIN)
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(403)
  })

  it('accepts a same-origin fetch with no Origin header but the browser-set fetch metadata', async () => {
    await request(app())
      .get('/api/v2/evidence/finding')
      .set('Host', API_HOST)
      .set('Authorization', `Bearer ${TOKEN}`)
      .set('Sec-Fetch-Site', 'same-origin')
      .set('Sec-Fetch-Mode', 'cors')
      .set('Sec-Fetch-Dest', 'empty')
      .expect(200)
  })
})

describe('V2 evidence endpoint — the finding projection', () => {
  it('serves the validated finding with private cache headers and no CORS', async () => {
    const response = await authorized('/api/v2/evidence/finding').expect(200)
    expect(response.body.finding.layer).toBe('deterministic')
    expect(response.body.finding.statementCode).toBe('DELIVERY_FLOW')
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
    expect(response.body.references.length).toBeGreaterThanOrEqual(6)
  })

  it('never transports the C2 scope alias', async () => {
    const response = await authorized('/api/v2/evidence/finding').expect(200)
    expect(JSON.stringify(response.body)).not.toContain(INTEGRATION_SHAPE_SCOPE_ALIAS)
    expect(response.body.finding.scopeId.startsWith('scope-')).toBe(true)
  })
})

describe('V2 evidence endpoint — resolving one reference', () => {
  it('resolves a claim reference to its explanation walk', async () => {
    const response = await authorized(`/api/v2/evidence/resolve?kind=claim&id=${CLAIM_IDS.p50}`).expect(200)
    expect(response.body.projection.kind).toBe('explanation')
    expect(JSON.stringify(response.body)).not.toContain(INTEGRATION_SHAPE_SCOPE_ALIAS)
    // #86: a coverage row is named by (rangeStart, jobId), never a coverage_id.
    expect(JSON.stringify(response.body)).not.toContain('coverage_id')
    expect(JSON.stringify(response.body)).not.toContain('coverageId')
  })

  it('resolves an observation reference to its evidence anchor', async () => {
    const response = await authorized(`/api/v2/evidence/resolve?kind=observation&id=${EVIDENCE_IDS.openTailCurrent}`).expect(200)
    expect(response.body.projection.kind).toBe('evidence')
    expect(response.body.projection.evidenceId).toBe(EVIDENCE_IDS.openTailCurrent)
  })

  it('resolves a well-formed unknown reference to honest furniture, never an error and never a partial tree', async () => {
    const response = await authorized(`/api/v2/evidence/resolve?kind=claim&id=cl_${'0'.repeat(64)}`).expect(200)
    expect(response.body.projection.kind).toBe('unresolvable')
  })

  it('rejects a malformed query with V2_NOT_FOUND', async () => {
    await authorized('/api/v2/evidence/resolve?kind=nonsense&id=x').expect(404)
    await authorized('/api/v2/evidence/resolve?id=cl_x').expect(404)
    // Shaped like a claim id prefix but not a well-formed reference: malformed, not unknown.
    await authorized('/api/v2/evidence/resolve?kind=claim&id=cl_absent').expect(404)
  })

  it('serves exactly what the Atlas resolves locally, so the client fallback is equivalent', async () => {
    // The Atlas now calls this endpoint and falls back to `resolveIntegrationShapeEvidence` when
    // it does not answer. That fallback is only honest if the two produce the same walk — this
    // asserts it for every reference the finding renders, at the endpoint's own request path.
    for (const reference of INTEGRATION_SHAPE_REFERENCES) {
      const query =
        reference.kind === 'observation'
          ? `kind=observation&id=${encodeURIComponent(reference.evidenceId)}`
          : `kind=claim&id=${encodeURIComponent(reference.claimId)}`
      const response = await authorized(`/api/v2/evidence/resolve?${query}`).expect(200)
      expect(response.body.projection).toEqual(
        JSON.parse(JSON.stringify(resolveIntegrationShapeEvidence(reference))),
      )
      expect(response.body.reference).toEqual(
        reference.kind === 'observation'
          ? { kind: 'observation', evidenceId: reference.evidenceId }
          : { kind: 'claim', claimId: reference.claimId, claimLayer: 'deterministic' },
      )
      // The browser client accepts only bodies that parse the shared contract; every
      // served body must therefore parse it, or production would silently fall back.
      expect(V2EvidenceResolveResponseSchema.safeParse(response.body).success).toBe(true)
    }
  })
})
