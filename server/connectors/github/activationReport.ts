/**
 * Pure local-C2 envelope for an already validated github.core activation result.
 *
 * The task id, job id, and start time are caller-claimed C2 provenance. They are not an
 * authorization, continuity, source-completeness, retention, or review decision. The nested
 * C1 result's `stable` state remains bounded probe equality only. Card and report digests are
 * intentionally external: a report-carried card claim cannot replace later fresh card,
 * persisted-transition, lifecycle, and owner-anchor cross-binding.
 */

import {
  parseGithubCoreActivationResult,
  type GithubCoreActivationResult,
} from './activationResult.js'

export const GITHUB_CORE_ACTIVATION_REPORT_SCHEMA_VERSION =
  'github-core-activation-report.v1' as const
export const GITHUB_CORE_ACTIVATION_REPORT_ERROR_CODE =
  'INVALID_GITHUB_CORE_ACTIVATION_REPORT' as const

export class GithubCoreActivationReportError extends Error {
  readonly code = GITHUB_CORE_ACTIVATION_REPORT_ERROR_CODE

  constructor() {
    super(GITHUB_CORE_ACTIVATION_REPORT_ERROR_CODE)
    this.name = 'GithubCoreActivationReportError'
  }
}

export interface GithubCoreActivationReport {
  readonly schemaVersion: typeof GITHUB_CORE_ACTIVATION_REPORT_SCHEMA_VERSION
  readonly taskId: string
  readonly jobId: string
  readonly jobStartedAt: string
  readonly result: GithubCoreActivationResult
}

const ROOT_FIELDS = ['schemaVersion', 'taskId', 'jobId', 'jobStartedAt', 'result'] as const
const TASK_ID = /^[A-Za-z0-9_-]{1,128}$/
const JOB_ID = /^[A-Za-z0-9:._-]{1,128}$/
const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function invalid(): never {
  throw new GithubCoreActivationReportError()
}

/** Read own data properties only, recursively, and never invoke an accessor. */
function snapshotValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) invalid()
  seen.add(value)
  try {
    const prototype = Object.getPrototypeOf(value)
    if (Array.isArray(value) || (prototype !== Object.prototype && prototype !== null)) invalid()
    const keys = Reflect.ownKeys(value)
    const record = Object.create(null) as Record<string, unknown>
    for (const key of keys) {
      if (typeof key !== 'string') invalid()
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalid()
      record[key] = snapshotValue(descriptor.value, seen)
    }
    return record
  } catch {
    invalid()
  }
}

function exactRecord(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length !== fields.length || fields.some((field) => !Object.hasOwn(record, field))) invalid()
  return record
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !CANONICAL_UTC_TIMESTAMP.test(value)) return false
  const parsed = new Date(value)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value
}

/** Parse the closed local-C2 envelope; no clock, filesystem, key, network, or sink is consulted. */
export function parseGithubCoreActivationReport(input: unknown): GithubCoreActivationReport {
  let snapshot: unknown
  try {
    snapshot = snapshotValue(input)
  } catch {
    invalid()
  }
  const root = exactRecord(snapshot, ROOT_FIELDS)
  if (root.schemaVersion !== GITHUB_CORE_ACTIVATION_REPORT_SCHEMA_VERSION) invalid()
  if (typeof root.taskId !== 'string' || !TASK_ID.test(root.taskId) || root.taskId === '.' || root.taskId === '..') invalid()
  if (typeof root.jobId !== 'string' || !JOB_ID.test(root.jobId)) invalid()
  if (!isCanonicalTimestamp(root.jobStartedAt)) invalid()
  let result: GithubCoreActivationResult
  try {
    result = parseGithubCoreActivationResult(root.result)
  } catch {
    invalid()
  }
  return Object.freeze({
    schemaVersion: GITHUB_CORE_ACTIVATION_REPORT_SCHEMA_VERSION,
    taskId: root.taskId,
    jobId: root.jobId,
    jobStartedAt: root.jobStartedAt,
    result,
  })
}
