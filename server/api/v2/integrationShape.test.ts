import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { analyticReferenceId } from '../../../shared/findings.js'
import { parseIntegrationShapePresentationEnvelope } from '../../../shared/integrationShapeStoredPresentation.js'
import { installStorageV3ShadowSchema } from '../../storage/v3ShadowSchema.js'
import {
  SYNTHETIC_STORED_OBSERVATION_AS_OF,
  SYNTHETIC_STORED_OBSERVATION_BASELINE,
  SYNTHETIC_STORED_OBSERVATION_CONSENT,
  SYNTHETIC_STORED_OBSERVATION_CURRENT,
  SYNTHETIC_STORED_OBSERVATION_SCOPE,
  createSyntheticV3StoredObservationDatabase,
} from '../../analysis/syntheticV3StoredObservation.js'
import type { PhaseEStoredAnalysisConfig, V2RuntimeConfig } from './config.js'
import {
  createSelectedStoredObservationSource,
  selectedStoredObservationReferenceIds,
} from './integrationShape.js'
import { createV2Router } from './router.js'

const TOKEN = 'f0e1d2c3b4a5968778695a4b3c2d1e0f0e1d2c3b4a5968778695a4b3c2d1e0f0'
const API_HOST = '127.0.0.1:4141'
const WEB_ORIGIN = 'http://127.0.0.1:5173'
let directory: string

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'developer-lens-phase-e-api-'))
})

afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
})

function phaseConfig(root = directory): PhaseEStoredAnalysisConfig {
  return {
    selectedStoreDirectory: root,
    scopeId: SYNTHETIC_STORED_OBSERVATION_SCOPE,
    consentRevision: SYNTHETIC_STORED_OBSERVATION_CONSENT,
    baselineWindow: SYNTHETIC_STORED_OBSERVATION_BASELINE,
    currentWindow: SYNTHETIC_STORED_OBSERVATION_CURRENT,
    asOf: SYNTHETIC_STORED_OBSERVATION_AS_OF,
  }
}

function runtimeConfig(phaseEAnalysis?: PhaseEStoredAnalysisConfig): V2RuntimeConfig {
  return {
    token: TOKEN,
    allowedHosts: [API_HOST],
    allowedOrigins: [WEB_ORIGIN],
    storePath: join(directory, 'unused-v2.sqlite'),
    phaseEAnalysis,
  }
}

function app(config: V2RuntimeConfig, createPhaseESource?: () => ReturnType<typeof createSelectedStoredObservationSource>) {
  const server = express()
  server.use('/api/v2', createV2Router(
    config,
    createPhaseESource === undefined ? {} : { createPhaseESource },
  ))
  return server
}

function authorized(server: express.Express, path: string) {
  return request(server)
    .get(path)
    .set('Host', API_HOST)
    .set('Origin', WEB_ORIGIN)
    .set('Authorization', `Bearer ${TOKEN}`)
}

describe('Phase E selected-store analysis route', () => {
  it('is absent by default and never substitutes the authored static composition', async () => {
    const response = await authorized(app(runtimeConfig()), '/api/v2/analysis/integration-shape').expect(404)
    expect(response.body).toEqual({ error: { code: 'V2_NOT_FOUND' } })
  })

  it('serves one strict selected-store presentation and the same evidence snapshot', async () => {
    const source = createSelectedStoredObservationSource(
      phaseConfig(),
      () => createSyntheticV3StoredObservationDatabase(),
    )
    const server = app(runtimeConfig(phaseConfig()), () => source)
    const response = await authorized(server, '/api/v2/analysis/integration-shape').expect(200)
    const envelope = parseIntegrationShapePresentationEnvelope(response.body)
    expect(envelope.mode).toBe('selected_store')
    expect(envelope.presentation).toBeNull()
    expect(envelope.storedObservation.status).toBe('complete')
    expect(selectedStoredObservationReferenceIds(source.load())).toHaveLength(6)

    const finding = await authorized(server, '/api/v2/evidence/finding').expect(200)
    expect(finding.body.finding.findingId).toBe('stored_integration_tail')
    expect(finding.body.references.map(analyticReferenceId)).toEqual(
      source.load().evidence.references.map(analyticReferenceId),
    )
    const reference = source.load().evidence.references[0]
    const resolved = await authorized(
      server,
      `/api/v2/evidence/resolve?kind=${reference.kind}&id=${encodeURIComponent(analyticReferenceId(reference))}`,
    ).expect(200)
    expect(resolved.body.projection.kind).not.toBe('unresolvable')

    const wire = JSON.stringify(response.body)
    for (const forbidden of ['coverageId', 'snapshotId', 'storePath', 'scopeAlias', directory]) {
      expect(wire).not.toContain(forbidden)
    }
  })

  it('returns typed abstention furniture for an insufficient selected synthetic corpus', async () => {
    const source = createSelectedStoredObservationSource(
      phaseConfig(),
      () => {
        const db = createSyntheticV3StoredObservationDatabase()
        db.prepare(`UPDATE pull_request_fact SET state = 'OPEN', merged_at = NULL, closed_at = NULL
          WHERE ready_for_review_at >= ? AND ready_for_review_at < ?`)
          .run(SYNTHETIC_STORED_OBSERVATION_CURRENT.start, SYNTHETIC_STORED_OBSERVATION_CURRENT.end)
        return db
      },
    )
    const response = await authorized(
      app(runtimeConfig(phaseConfig()), () => source),
      '/api/v2/analysis/integration-shape',
    ).expect(200)
    const envelope = parseIntegrationShapePresentationEnvelope(response.body)
    expect(envelope.storedObservation).toMatchObject({ status: 'abstained', code: 'ALL_CENSORED' })
    expect(envelope.resolutions).toEqual({})
  })

  it('re-proves every request so a revocation cannot leave a process-lifetime presentation cache', () => {
    let opens = 0
    const source = createSelectedStoredObservationSource(
      phaseConfig(),
      () => {
        const db = createSyntheticV3StoredObservationDatabase()
        if (opens > 0) db.prepare('DELETE FROM v2_store_provenance').run()
        opens += 1
        return db
      },
    )
    const first = source.load()
    expect(first.envelope.storedObservation.status).toBe('complete')
    const firstReference = first.evidence.references[0]
    expect(firstReference).toBeDefined()
    if (firstReference === undefined) throw new Error('expected a complete evidence reference')
    expect(source.load().envelope.storedObservation).toMatchObject({
      status: 'abstained',
      code: 'SOURCE_NOT_AUTHORIZED',
    })
    expect(source.evidenceSource().resolve(firstReference).kind).toBe('unresolvable')
    expect(opens).toBe(3)
  })

  it('refuses a schema-valid SQLite file that was never accepted as the selected artefact', async () => {
    const root = await mkdtemp(join(directory, 'unselected-'))
    const db = new Database(join(root, 'v3-store.sqlite'))
    installStorageV3ShadowSchema(db)
    db.close()
    const response = await authorized(
      app(runtimeConfig(phaseConfig(root))),
      '/api/v2/analysis/integration-shape',
    ).expect(503)
    expect(response.body).toEqual({ error: { code: 'V2_STORE_UNAVAILABLE' } })
    expect(JSON.stringify(response.body)).not.toContain(root)
  })
})
