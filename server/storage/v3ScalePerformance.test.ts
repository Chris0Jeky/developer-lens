/**
 * Phase-1c generated scale corpus and equivalence budget.
 *
 * WHY: the acceptance-time equivalence proof used to be super-linear in identifier
 * count (graph-colouring refinement over every minted identity column), which was
 * fine for fixtures and a practical hang risk at multi-year scale. The mint-order
 * proof (#133) replaced it with a near-linear (sort-bound O(R log R)) encode-and-digest pass. This file is the
 * measurement that keeps that claim honest: a generated corpus large enough that a
 * super-linear regression cannot hide, run through the whole product journey.
 *
 * TWO LANES — the heavy body is NOT part of an ordinary `npm test` run:
 *
 *   SMOKE (always on)  ~1/20 volume, 30-second total budget. This is what
 *                      `npm test` executes; it proves the journey and the
 *                      generator, not the scale.
 *   SCALE (opt-in)     the full corpus, gated on DEVELOPER_LENS_SCALE=1:
 *                        DEVELOPER_LENS_SCALE=1 npx vitest run server/storage/v3ScalePerformance.test.ts
 *                      PowerShell:
 *                        $env:DEVELOPER_LENS_SCALE='1'; npx vitest run server/storage/v3ScalePerformance.test.ts
 *
 * BUDGET (deliberately generous — these are regression tripwires for a STRUCTURAL
 * change, not performance targets; CI variance must never turn them red):
 *   full journey        < 120 s   |  migration stage alone < 90 s
 *   smoke journey       <  30 s
 * The equivalence proof is near-linear with a sort-bound O(R log R) term, so missing
 * these by ~10x means something structural regressed, not that the box was busy.
 *
 * MEASURED on ONE Windows dev box (Windows 11, vitest 4.1.10, better-sqlite3
 * 12.11.1, three runs, the spread across them shown). These are one machine's
 * numbers on one day — evidence that the budget has room, NOT a promise about any
 * other machine, and NOT a target anyone should tune towards:
 *
 *   SCALE  25,469 source rows -> 17,572 rows in the store after deletion
 *          source-build          0.43 s
 *          migration             4.10 - 4.24 s   (budget 90 s, ~21x headroom)
 *          c2-sweep              0.90 - 0.94 s
 *          b3-deletion           0.57 - 0.61 s
 *          reopen-revalidation   0.20 - 0.21 s
 *          TOTAL                 6.21 - 6.38 s   (budget 120 s, ~19x headroom)
 *   SMOKE  1,295 source rows
 *          TOTAL                 0.35 - 0.36 s   (budget 30 s)
 *
 * The headroom is the point: at these budgets a ~20x slowdown is required to turn
 * the lane red, which no amount of CI noise produces but a return to super-linear
 * equivalence would.
 *
 * The corpus is invented, deterministic, and local: every identifier and timestamp
 * is derived from sha256 counters over a fixed seed (no Math.random, no Date.now),
 * it is written only inside a fresh temp directory, and it activates no capability
 * and performs no network call.
 */
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { CLAIM_SCHEMA_VERSION, computeClaimId } from '../../shared/claims.js'
import { CANONICAL_ENVELOPE_SCHEMA_VERSION } from '../../shared/provenance.js'
import { SYNTHETIC_STORE_MARKER } from '../api/v2/contract.js'
import { installV2BridgeStore } from '../api/v2/store.js'
import { installClaimGraphStorage } from './claims.js'
import { openStorageDatabase } from './database.js'
import { installIncrementalGithubCoreStorage } from './incremental.js'
import { createInstallationAliases } from './installationAliases.js'
import {
  completeStorageV3DeletionMaintenance,
  deleteStorageV3Scope,
} from './v3Deletion.js'
import { orchestrateStorageV3ShadowMigration } from './v3ShadowMigration.js'
import { STORAGE_V3_SHADOW_TABLES } from './v3ShadowSchema.js'
import { sweepStorageV3C2 } from './v3ShadowSweep.js'
import {
  createStorageV3TargetFactory,
  openSelectedStorageV3Store,
} from './v3StoreFiles.js'

export const SCALE_LANE_ENV_FLAG = 'DEVELOPER_LENS_SCALE'
const SCALE_LANE_ENABLED = process.env[SCALE_LANE_ENV_FLAG] === '1'

/** One fixed seed: the whole corpus is a pure function of this string. */
const CORPUS_SEED = 'developer-lens/v3-scale-corpus/v1'
const DAY_MS = 86_400_000

const digest = (label: string): string =>
  createHash('sha256').update(`${CORPUS_SEED}/${label}`).digest('hex')
/** A deterministic counter below 2^52, so integer arithmetic stays exact. */
const counter = (label: string): number => Number.parseInt(digest(label).slice(0, 13), 16)
const canonicalAt = (milliseconds: number): string => new Date(milliseconds).toISOString()
const between = (label: string, startMs: number, endMs: number): string =>
  canonicalAt(startMs + (counter(label) % Math.max(1, endMs - startMs)))
const pick = <T>(label: string, values: readonly T[]): T => values[counter(label) % values.length]

const FEATURE_TYPES = ['feat', 'fix', 'docs', 'test', 'refactor', 'chore'] as const
const EVENT_KINDS = ['review', 'issue'] as const

/**
 * The journey clock. `migrationAsOf` sits after the expired cohort's inclusive
 * 13-month C2 boundary and before the other two, so the migration carries both
 * cleared and retained C2. `sweepAsOf` then crosses the mixed cohort's boundary,
 * so one sweep has both something to clear and something it must not touch.
 */
const SCALE_TIMELINE = Object.freeze({
  migrationAsOf: '2026-06-01T00:00:00.000Z',
  sweepAsOf: '2026-10-01T00:00:00.000Z',
  deletionAsOf: '2026-10-02T00:00:00.000Z',
})

interface ScaleCohort {
  readonly label: 'expired' | 'mixed' | 'live'
  readonly rawProviderId: string
  readonly windowStart: string
  readonly windowEnd: string
  /**
   * Whether this cohort's identity is still bindable at `migrationAsOf`. Derived
   * from `windowEnd + 13 months` by hand and re-proven by the migration itself:
   * an eligible identity MUST be bound (or the rewrite refuses) and an expired one
   * MUST NOT be (or the rewrite refuses), so a wrong value here fails the test.
   */
  readonly bindable: boolean
}

/** Timestamps span 2023-2026, so expired and live C2 cohorts coexist in one source. */
const SCALE_COHORTS: readonly ScaleCohort[] = Object.freeze([
  Object.freeze({
    label: 'expired' as const,
    rawProviderId: 'invented-scale-repository-expired',
    windowStart: '2023-01-02T00:00:00.000Z',
    windowEnd: '2023-12-01T00:00:00.000Z',
    bindable: false,
  }),
  Object.freeze({
    label: 'mixed' as const,
    rawProviderId: 'invented-scale-repository-mixed',
    windowStart: '2024-06-01T00:00:00.000Z',
    windowEnd: '2025-08-01T00:00:00.000Z',
    bindable: true,
  }),
  Object.freeze({
    label: 'live' as const,
    rawProviderId: 'invented-scale-repository-live',
    windowStart: '2025-09-01T00:00:00.000Z',
    windowEnd: '2026-05-01T00:00:00.000Z',
    bindable: true,
  }),
])

/** The cohort the B3 stage deletes: the one whose rows survive the sweep intact. */
const DELETED_COHORT_LABEL = 'live'

export interface ScaleVolume {
  readonly lane: 'scale' | 'smoke'
  readonly commitsPerScope: number
  readonly pullRequestsPerScope: number
  readonly datedEventsPerScope: number
  readonly jobsPerScope: number
  /** Evidence rows and claims are 1:1, so one number sizes both. */
  readonly claimsPerScope: number
  readonly totalBudgetMs: number
  readonly migrationBudgetMs: number
}

/**
 * ~10k pull-request facts, ~10k commits, ~2k dated events, ~150 jobs each with its
 * own snapshot and coverage row, ~600 evidence rows and ~600 claims across three
 * scopes. Checkpoints are capped at ONE PER SCOPE by the v2 source itself
 * (`collection_checkpoint PRIMARY KEY (capability_id, scope_alias)`), and the
 * rewrite re-proves that uniqueness, so 3 is the maximum a v2 source can carry.
 */
const SCALE_VOLUME: ScaleVolume = Object.freeze({
  lane: 'scale' as const,
  commitsPerScope: 3_334,
  pullRequestsPerScope: 3_334,
  datedEventsPerScope: 667,
  jobsPerScope: 50,
  claimsPerScope: 200,
  totalBudgetMs: 120_000,
  migrationBudgetMs: 90_000,
})

/** ~1/20 of the scale volume: the always-on lane proves the journey, not the size. */
const SMOKE_VOLUME: ScaleVolume = Object.freeze({
  lane: 'smoke' as const,
  commitsPerScope: 167,
  pullRequestsPerScope: 167,
  datedEventsPerScope: 34,
  jobsPerScope: 3,
  claimsPerScope: 10,
  totalBudgetMs: 30_000,
  migrationBudgetMs: 30_000,
})

/** Fourfold row calibration used only by the opt-in scaling lane. */
const SCALE_CALIBRATION_SMALL_VOLUME: ScaleVolume = Object.freeze({
  lane: 'scale' as const,
  commitsPerScope: 834,
  pullRequestsPerScope: 834,
  datedEventsPerScope: 167,
  jobsPerScope: 12,
  claimsPerScope: 50,
  totalBudgetMs: 120_000,
  migrationBudgetMs: 90_000,
})

interface ScaleSource {
  readonly db: Database.Database
  readonly installationKey: Buffer
  readonly identityBindings: readonly { readonly rawProviderId: string }[]
  readonly deletedScopeId: string
  readonly rows: Readonly<Record<string, number>>
  readonly totalRows: number
}

const SOURCE_FILE_NAME = 'invented-scale-source.sqlite'

/**
 * Build one invented v2 source: three repository scopes with identities and
 * bindings, the bulk observation tables, per-job snapshot/coverage/checkpoint
 * material, a claim graph, lineage including three slice-A legacy tombstones, and
 * the C0 bridge present from the start.
 */
function buildScaleSource(directory: string, volume: ScaleVolume): ScaleSource {
  const db = openStorageDatabase(join(directory, SOURCE_FILE_NAME))
  try {
    installIncrementalGithubCoreStorage(db)
    installClaimGraphStorage(db)
    installV2BridgeStore(db)

    const installationKey = Buffer.alloc(32, 0x2f)
    const aliases = createInstallationAliases(installationKey)
    const insert = {
      scope: db.prepare('INSERT INTO claim_scope (scope_id, scope_alias, linked_at) VALUES (?, ?, ?)'),
      identity: db.prepare(`INSERT INTO repository_identity (
        provider_id, analytical_key, is_private, is_archived, is_fork
      ) VALUES (?, ?, 0, 0, 0)`),
      commit: db.prepare(`INSERT INTO commit_observation (
        repository_provider_id, sha, occurred_at, source, additions, deletions, files,
        parent_count, feature_type, is_revert, is_fixup, message_length
      ) VALUES (?, ?, ?, 'github', ?, ?, ?, 1, ?, 0, 0, ?)`),
      pullRequest: db.prepare(`INSERT INTO pull_request_fact (
        provider_id, repository_provider_id, number, created_at, merged_at, closed_at,
        state, is_draft, additions, deletions, changed_files, comments, reviews
      ) VALUES (?, ?, ?, ?, ?, ?, 'MERGED', 0, ?, ?, ?, ?, ?)`),
      datedEvent: db.prepare(`INSERT INTO dated_event_observation (
        provider_id, repository_provider_id, occurred_at, event_kind
      ) VALUES (?, ?, ?, ?)`),
      job: db.prepare(`INSERT INTO collection_job (
        job_id, storage_contract_version, payload_hash, capability_id, scope_alias,
        query_version, source_api_version, consent_revision, range_start, range_end,
        observed_at, started_at, completed_at, status
      ) VALUES (?, '2.2.0', ?, 'github.core', ?, 'github.core.v1', '2026-03-10',
        'invented-scale-consent-v1', ?, ?, ?, ?, ?, 'complete')`),
      snapshot: db.prepare(`INSERT INTO source_snapshot (
        snapshot_id, job_id, capability_id, scope_alias, snapshot_hash,
        range_start, range_end, observed_at
      ) VALUES (?, ?, 'github.core', ?, ?, ?, ?, ?)`),
      coverage: db.prepare(`INSERT INTO coverage_ledger (
        coverage_id, range_start, job_id, snapshot_id, capability_id, scope_alias,
        range_end, status, expected_units, observed_units, omitted_units, retryable,
        observed_at, limitation_code
      ) VALUES (?, ?, ?, ?, 'github.core', ?, ?, 'complete', ?, ?, 0, 0, ?, 'NONE')`),
      checkpoint: db.prepare(`INSERT INTO collection_checkpoint (
        capability_id, scope_alias, query_version, source_api_version, high_watermark,
        cursor_hint, bounded_overlap_start, last_complete_snapshot_hash, consent_revision,
        committed_job_id, source_snapshot_id
      ) VALUES ('github.core', ?, 'github.core.v1', '2026-03-10', ?, ?, ?, ?,
        'invented-scale-consent-v1', ?, ?)`),
      evidence: db.prepare(`INSERT INTO evidence (
        evidence_id, layer, schema_version, coverage_id, coverage_range_start, coverage_job_id
      ) VALUES (?, 'observed', ?, ?, ?, ?)`),
      claim: db.prepare(`INSERT INTO claim (
        claim_id, layer, statement_code, method_id, method_version, window_start,
        window_end, scope_id, schema_version, claim_id_material_version, created_at
      ) VALUES (?, 'modelled', 'DELIVERY_FLOW', 'invented.scale.method', '1.0.0', ?, ?, ?, ?, 'claim-id.v2', ?)`),
      edge: db.prepare(`INSERT INTO claim_evidence_edge (
        claim_id, role, target_evidence_id
      ) VALUES (?, 'supports', ?)`),
      limitation: db.prepare(`INSERT INTO limitation_instance (
        claim_id, limitation_code, dimension, copy_key
      ) VALUES (?, 'SAMPLE_TOO_SMALL', 'sample', 'invented.scale.copy')`),
      lineage: db.prepare(`INSERT INTO lineage_event (
        subject_id, event_kind, caused_by, occurred_at
      ) VALUES (?, ?, ?, ?)`),
    }

    const deletedScopeIds: string[] = []
    db.transaction(() => {
      for (const cohort of SCALE_COHORTS) {
        const { label, windowStart, windowEnd } = cohort
        const startMs = Date.parse(windowStart)
        const endMs = Date.parse(windowEnd)
        const provider = aliases.repositoryProviderId(cohort.rawProviderId)
        const analytical = aliases.repositoryAnalyticalKey(cohort.rawProviderId)
        const scopeId = `scope-${digest(`scope/${label}`)}`
        if (label === DELETED_COHORT_LABEL) deletedScopeIds.push(scopeId)

        insert.scope.run(scopeId, provider, windowEnd)
        insert.identity.run(provider, analytical)

        // The identity's C2 anchor is the LATEST observation, so one commit is
        // pinned to the exact window end: cohort eligibility is then a property of
        // the declared window, not of where the generator's hashes happened to land.
        insert.commit.run(provider, `sha-${label}-anchor`, windowEnd, 5, 2, 3, 'feat', 24)
        for (let index = 1; index < volume.commitsPerScope; index += 1) {
          const seed = `commit/${label}/${index}`
          insert.commit.run(
            provider,
            `sha-${label}-${index}`,
            between(seed, startMs, endMs),
            counter(`${seed}/additions`) % 400,
            counter(`${seed}/deletions`) % 200,
            counter(`${seed}/files`) % 20,
            pick(`${seed}/feature`, FEATURE_TYPES),
            10 + (counter(`${seed}/message`) % 120),
          )
        }

        for (let index = 0; index < volume.pullRequestsPerScope; index += 1) {
          const seed = `pull-request/${label}/${index}`
          const createdMs = Date.parse(between(seed, startMs, endMs))
          const settledMs = Math.min(createdMs + (counter(`${seed}/lag`) % (5 * DAY_MS)), endMs)
          const settled = canonicalAt(settledMs)
          insert.pullRequest.run(
            `pr-${label}-${index}`,
            provider,
            index + 1,
            canonicalAt(createdMs),
            settled,
            settled,
            counter(`${seed}/additions`) % 900,
            counter(`${seed}/deletions`) % 400,
            counter(`${seed}/changed`) % 30,
            counter(`${seed}/comments`) % 12,
            counter(`${seed}/reviews`) % 6,
          )
        }

        for (let index = 0; index < volume.datedEventsPerScope; index += 1) {
          const seed = `dated-event/${label}/${index}`
          insert.datedEvent.run(
            `event-${label}-${index}`,
            provider,
            between(seed, startMs, endMs),
            pick(`${seed}/kind`, EVENT_KINDS),
          )
        }

        const coverageWindows: Array<{ coverageId: string; jobId: string; rangeStart: string; rangeEnd: string; observedAt: string }> = []
        for (let index = 0; index < volume.jobsPerScope; index += 1) {
          const seed = `job/${label}/${index}`
          const jobId = `job-${label}-${index}`
          const snapshotId = `snap-${label}-${index}`
          // #86: ledger keys are the content-free registry shape (`cov-` + 64 lowercase
          // hex) and UNIQUE(coverage_id) binds, so each key is derived per job.
          const coverageId = `cov-${digest(`coverage/${label}/${index}`)}`
          const snapshotHash = digest(`snapshot-hash/${label}/${index}`)
          const rangeStartMs = Date.parse(between(seed, startMs, Math.max(startMs + 1, endMs - 8 * DAY_MS)))
          const rangeStart = canonicalAt(rangeStartMs)
          const rangeEnd = canonicalAt(rangeStartMs + 7 * DAY_MS)
          const observedAt = rangeEnd
          insert.job.run(
            jobId,
            digest(`payload/${label}/${index}`),
            provider,
            rangeStart,
            rangeEnd,
            observedAt,
            rangeStart,
            observedAt,
          )
          insert.snapshot.run(snapshotId, jobId, provider, snapshotHash, rangeStart, rangeEnd, observedAt)
          insert.coverage.run(
            coverageId,
            rangeStart,
            jobId,
            snapshotId,
            provider,
            rangeEnd,
            3 + (counter(`${seed}/expected`) % 40),
            3 + (counter(`${seed}/expected`) % 40),
            observedAt,
          )
          // One checkpoint per scope is the v2 source maximum: see SCALE_VOLUME.
          if (index === 0) {
            insert.checkpoint.run(
              provider,
              rangeEnd,
              `cursor-${label}`,
              rangeStart,
              snapshotHash,
              jobId,
              snapshotId,
            )
          }
          coverageWindows.push({ coverageId, jobId, rangeStart, rangeEnd, observedAt })
        }

        for (let index = 0; index < volume.claimsPerScope; index += 1) {
          const window = coverageWindows[index % coverageWindows.length]
          const evidenceId = `ev-${label}-${index}`
          insert.evidence.run(
            evidenceId,
            CANONICAL_ENVELOPE_SCHEMA_VERSION,
            window.coverageId,
            window.rangeStart,
            window.jobId,
          )
          const claimId = computeClaimId({
            layer: 'modelled',
            statementCode: 'DELIVERY_FLOW',
            methodId: 'invented.scale.method',
            methodVersion: '1.0.0',
            basis: [{ role: 'supports', targetEvidenceId: evidenceId }],
            windowStart: window.rangeStart,
            windowEnd: window.rangeEnd,
            scopeId,
            schemaVersion: CLAIM_SCHEMA_VERSION,
          })
          insert.claim.run(
            claimId,
            window.rangeStart,
            window.rangeEnd,
            scopeId,
            CLAIM_SCHEMA_VERSION,
            window.observedAt,
          )
          insert.edge.run(claimId, evidenceId)
          insert.limitation.run(claimId)
          // A minority of lineage rows carry a scope cause, which exercises the
          // target's cross-scope cause guards without making every insert pay for
          // the unindexed `caused_by` scan.
          insert.lineage.run(claimId, 'correction', index < 5 ? scopeId : null, window.observedAt)
        }

        // One historical slice-A legacy tombstone per cohort: scope-unbound in the
        // target, DERIVED (never minted) from this subject id.
        insert.lineage.run(
          `scope_tombstone_${digest(`tombstone/${label}`)}`,
          'tombstone_cascade',
          'cap_github_core',
          windowEnd,
        )
      }

      db.prepare(`INSERT INTO v2_store_provenance (
        singleton, mode, synthetic_marker, importer_version, created_at
      ) VALUES (1, 'synthetic', ?, '1.0.0', ?)`)
        .run(SYNTHETIC_STORE_MARKER, SCALE_COHORTS[0].windowStart)
      db.prepare(`INSERT INTO v2_coverage_record (
        coverage_id, capability_id, scope_alias, range_start, range_end, status,
        expected_units, observed_units, omitted_units, retryable, observed_at, limitation_code
      ) VALUES (?, 'github.core', ?, ?, ?, 'complete', 3, 3, 0, 0, ?, 'NONE')`)
        .run(
          'invented-scale-c0-coverage',
          'invented-scale-c0-scope',
          SCALE_COHORTS[0].windowStart,
          SCALE_COHORTS[0].windowEnd,
          SCALE_COHORTS[0].windowEnd,
        )
    })()

    const rows: Record<string, number> = {}
    let totalRows = 0
    for (const table of [
      'claim_scope', 'repository_identity', 'commit_observation', 'pull_request_fact',
      'dated_event_observation', 'collection_job', 'source_snapshot', 'coverage_ledger',
      'collection_checkpoint', 'evidence', 'claim', 'claim_evidence_edge',
      'limitation_instance', 'lineage_event', 'v2_store_provenance', 'v2_coverage_record',
    ]) {
      const count = Number(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get())
      rows[table] = count
      totalRows += count
    }

    return {
      db,
      installationKey,
      identityBindings: SCALE_COHORTS
        .filter(({ bindable }) => bindable)
        .map(({ rawProviderId }) => ({ rawProviderId })),
      deletedScopeId: deletedScopeIds[0],
      rows,
      totalRows,
    }
  } catch (error) {
    db.close()
    throw error
  }
}

interface StageTiming {
  readonly stage: string
  readonly ms: number
}

interface JourneyReport {
  readonly lane: ScaleVolume['lane']
  readonly stages: readonly StageTiming[]
  readonly totalMs: number
  readonly migrationMs: number
  readonly migrationStatus: string
  readonly migrationChecksum: string
  readonly sourceRows: Readonly<Record<string, number>>
  readonly sourceTotalRows: number
  readonly migratedRows: number
  readonly scopesBeforeDeletion: number
  readonly scopesAfterDeletion: number
  readonly sweptCells: number
  readonly deletedRows: number
  readonly tombstonesWritten: number
  readonly reopenedRows: number
  readonly provenance: unknown
}

const totalOf = (values: Readonly<Record<string, number>>): number =>
  Object.values(values).reduce((total, count) => total + count, 0)

function storeRowCount(store: Database.Database): number {
  let rows = 0
  for (const table of STORAGE_V3_SHADOW_TABLES) {
    rows += Number(store.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get())
  }
  return rows
}

/**
 * The whole product journey on one generated corpus, one timed stage at a time:
 * build -> orchestrated migration (both rewrites, mint-order digests, acceptance)
 * -> C2 sweep -> B3 scope deletion + maintenance -> reopen and re-validate.
 */
function runScaleJourney(volume: ScaleVolume): JourneyReport {
  const directory = mkdtempSync(join(tmpdir(), `developer-lens-v3-scale-${volume.lane}-`))
  const stages: StageTiming[] = []
  const measure = <T>(stage: string, run: () => T, detail: (value: T) => string): T => {
    const started = performance.now()
    const value = run()
    const ms = performance.now() - started
    stages.push({ stage, ms })
    // The reported line is counts and durations only; no identifier, path, or
    // alias from the corpus reaches it.
    console.log(`v3-scale[${volume.lane}] ${stage}: ${ms.toFixed(1)}ms ${detail(value)}`)
    return value
  }

  let source: ScaleSource | undefined
  let store: Database.Database | undefined
  let reopened: Database.Database | undefined
  try {
    source = measure(
      'source-build',
      () => buildScaleSource(directory, volume),
      (built) => `rows=${built.totalRows} scopes=${built.rows.claim_scope} commits=${built.rows.commit_observation} pull-requests=${built.rows.pull_request_fact} dated-events=${built.rows.dated_event_observation} jobs=${built.rows.collection_job} evidence=${built.rows.evidence} claims=${built.rows.claim} lineage=${built.rows.lineage_event}`,
    )
    const built = source

    const migration = measure(
      'migration',
      () => orchestrateStorageV3ShadowMigration({
        sourceDb: built.db,
        identityBindings: built.identityBindings,
        installationKey: built.installationKey,
        asOf: SCALE_TIMELINE.migrationAsOf,
        targetFactory: createStorageV3TargetFactory(directory),
      }),
      (result) => `status=${result.status} checksum-digits=${result.checksum.length}`,
    )
    built.db.close()
    source = undefined

    // The selected store is opened inside the sweep stage: selection is the
    // re-validation the sweep requires, so its cost belongs to this stage rather
    // than to an untimed gap between stages.
    const swept = measure(
      'c2-sweep',
      () => {
        store = openSelectedStorageV3Store(directory)
        return sweepStorageV3C2({ targetDb: store, asOf: SCALE_TIMELINE.sweepAsOf })
      },
      (result) => `status=${result.status} cleared=${totalOf(result.cleared)} cas-receipts=${result.casReceiptsCleared} lineage=${result.lineageEvents}`,
    )
    const selected = store!
    const migratedRows = storeRowCount(selected)
    const scopesBeforeDeletion = Number(selected.prepare('SELECT COUNT(*) FROM claim_scope').pluck().get())

    const deletion = measure(
      'b3-deletion',
      () => {
        const result = deleteStorageV3Scope({
          db: selected,
          scopeId: built.deletedScopeId,
          asOf: SCALE_TIMELINE.deletionAsOf,
        })
        const maintenance = completeStorageV3DeletionMaintenance(selected)
        return { result, maintenance }
      },
      ({ result, maintenance }) => `status=${result.status} rows-removed=${totalOf(result.deletedRows)} tombstones=${result.tombstonesWritten} maintenance=${maintenance.maintenance}`,
    )
    const scopesAfterDeletion = Number(selected.prepare('SELECT COUNT(*) FROM claim_scope').pluck().get())

    const revalidated = measure(
      'reopen-revalidation',
      () => {
        selected.close()
        store = undefined
        reopened = openSelectedStorageV3Store(directory)
        return {
          rows: storeRowCount(reopened),
          provenance: reopened.prepare(
            'SELECT singleton, mode, synthetic_marker, activation_card_id, importer_version FROM v2_store_provenance',
          ).get(),
        }
      },
      (value) => `rows=${value.rows}`,
    )

    const totalMs = stages.reduce((total, { ms }) => total + ms, 0)
    console.log(`v3-scale[${volume.lane}] TOTAL: ${totalMs.toFixed(1)}ms (budget ${volume.totalBudgetMs}ms, migration budget ${volume.migrationBudgetMs}ms)`)
    return {
      lane: volume.lane,
      stages,
      totalMs,
      migrationMs: stages.find(({ stage }) => stage === 'migration')!.ms,
      migrationStatus: migration.status,
      migrationChecksum: migration.checksum,
      sourceRows: built.rows,
      sourceTotalRows: built.totalRows,
      migratedRows,
      scopesBeforeDeletion,
      scopesAfterDeletion,
      sweptCells: totalOf(swept.cleared),
      deletedRows: totalOf(deletion.result.deletedRows),
      tombstonesWritten: deletion.result.tombstonesWritten,
      reopenedRows: revalidated.rows,
      provenance: revalidated.provenance,
    }
  } finally {
    if (source?.db.open) source.db.close()
    if (store?.open) store.close()
    if (reopened?.open) reopened.close()
    rmSync(directory, { recursive: true, force: true })
  }
}

/** Every assertion that must hold at either volume. */
function expectHealthyJourney(report: JourneyReport, volume: ScaleVolume): void {
  expect(report.migrationStatus).toBe('complete')
  expect(report.migrationChecksum).toMatch(/^[0-9a-f]{64}$/)
  expect(report.sourceRows.claim_scope).toBe(SCALE_COHORTS.length)
  expect(report.sourceRows.commit_observation).toBe(SCALE_COHORTS.length * volume.commitsPerScope)
  expect(report.sourceRows.pull_request_fact).toBe(SCALE_COHORTS.length * volume.pullRequestsPerScope)
  expect(report.sourceRows.dated_event_observation).toBe(SCALE_COHORTS.length * volume.datedEventsPerScope)
  expect(report.sourceRows.collection_job).toBe(SCALE_COHORTS.length * volume.jobsPerScope)
  expect(report.sourceRows.source_snapshot).toBe(SCALE_COHORTS.length * volume.jobsPerScope)
  expect(report.sourceRows.coverage_ledger).toBe(SCALE_COHORTS.length * volume.jobsPerScope)
  expect(report.sourceRows.collection_checkpoint).toBe(SCALE_COHORTS.length)
  expect(report.sourceRows.evidence).toBe(SCALE_COHORTS.length * volume.claimsPerScope)
  expect(report.sourceRows.claim).toBe(SCALE_COHORTS.length * volume.claimsPerScope)
  // One 'correction' per claim plus one legacy tombstone per cohort.
  expect(report.sourceRows.lineage_event)
    .toBe(SCALE_COHORTS.length * (volume.claimsPerScope + 1))

  expect(report.scopesBeforeDeletion).toBe(SCALE_COHORTS.length)
  expect(report.scopesAfterDeletion).toBe(SCALE_COHORTS.length - 1)
  expect(report.migratedRows).toBeGreaterThan(report.sourceTotalRows / 2)
  // The clock is set so one sweep has real work and the deletion has survivors.
  expect(report.sweptCells).toBeGreaterThan(0)
  expect(report.deletedRows).toBeGreaterThan(0)
  expect(report.tombstonesWritten).toBeGreaterThan(0)
  expect(report.reopenedRows).toBeGreaterThan(0)
  expect(report.reopenedRows).toBeLessThan(report.migratedRows)
  // The C0 bridge record survives the whole journey verbatim.
  expect(report.provenance).toEqual({
    singleton: 1,
    mode: 'synthetic',
    synthetic_marker: SYNTHETIC_STORE_MARKER,
    activation_card_id: null,
    importer_version: '1.0.0',
  })
  for (const { stage, ms } of report.stages) {
    expect(Number.isFinite(ms), stage).toBe(true)
  }
}

describe('storage-v3 generated scale corpus (smoke lane)', () => {
  it('runs the whole journey on a reduced corpus inside the smoke budget', () => {
    const report = runScaleJourney(SMOKE_VOLUME)
    expectHealthyJourney(report, SMOKE_VOLUME)
    expect(report.totalMs).toBeLessThan(SMOKE_VOLUME.totalBudgetMs)
  }, 120_000)
})

describe.skipIf(!SCALE_LANE_ENABLED)('storage-v3 generated scale corpus (scale lane)', () => {
  it('runs the whole journey on the full corpus inside the documented budget', () => {
    const calibration = runScaleJourney(SCALE_CALIBRATION_SMALL_VOLUME)
    expectHealthyJourney(calibration, SCALE_CALIBRATION_SMALL_VOLUME)
    const report = runScaleJourney(SCALE_VOLUME)
    expectHealthyJourney(report, SCALE_VOLUME)
    // Calibrated curve check: the full corpus is ~4x the source rows. A >6x
    // migration ratio trips a super-linear regression without another absolute
    // timing gate beyond the generous journey budget below.
    expect(report.sourceTotalRows).toBeGreaterThan(calibration.sourceTotalRows * 3.5)
    expect(report.sourceTotalRows).toBeLessThan(calibration.sourceTotalRows * 4.5)
    expect(report.migrationMs).toBeLessThan(calibration.migrationMs * 6)
    expect(report.migrationMs).toBeLessThan(SCALE_VOLUME.migrationBudgetMs)
    expect(report.totalMs).toBeLessThan(SCALE_VOLUME.totalBudgetMs)
  }, 900_000)
})
