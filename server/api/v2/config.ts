import { isAbsolute, join, normalize } from 'node:path'
import { HalfOpenWindowSchema, type HalfOpenWindow } from '../../../shared/comparison.js'
import type { V2GuardOptions } from './guard.js'

/**
 * Runtime configuration for the `/api/v2` bootstrap slice.
 *
 * The API binds to `127.0.0.1:4141` and the dev web origin is
 * `http://127.0.0.1:5173`. The Vite dev proxy forwards `/api` without rewriting
 * the Host header, so both loopback authorities are allowlisted exactly; there
 * are no wildcards and no CORS headers anywhere on this surface.
 */
export const V2_DEFAULT_API_PORT = 4141
export const V2_DEV_WEB_PORT = 5173

/**
 * The synthetic bridge store lives in its own directory, deliberately NOT in
 * `.developer-lens/`: that directory holds real private runtime data and
 * `AGENTS.md` forbids inspecting it, so a synthetic fixture store must not
 * share it. This directory is gitignored and holds invented C0 data only.
 */
export const V2_SYNTHETIC_STORE_DIRECTORY = '.developer-lens-synthetic'
export const V2_STORE_FILENAME = 'v2-bridge-synthetic.sqlite'

export function defaultV2StorePath(env: NodeJS.ProcessEnv = process.env): string {
  return env.DEVELOPER_LENS_V2_STORE ?? join(V2_SYNTHETIC_STORE_DIRECTORY, V2_STORE_FILENAME)
}

export interface PhaseEStoredAnalysisConfig {
  /** Selected storage-v3 artifact ROOT; never a caller-supplied SQLite filename. */
  readonly selectedStoreDirectory: string
  readonly scopeId: string
  readonly consentRevision: string
  readonly baselineWindow: HalfOpenWindow
  readonly currentWindow: HalfOpenWindow
  readonly asOf: string
}

const PHASE_E_ENVIRONMENT = [
  'DEVELOPER_LENS_PHASE_E_STORE_ROOT',
  'DEVELOPER_LENS_PHASE_E_SCOPE_ID',
  'DEVELOPER_LENS_PHASE_E_CONSENT_REVISION',
  'DEVELOPER_LENS_PHASE_E_BASELINE_START',
  'DEVELOPER_LENS_PHASE_E_BASELINE_END',
  'DEVELOPER_LENS_PHASE_E_CURRENT_START',
  'DEVELOPER_LENS_PHASE_E_CURRENT_END',
  'DEVELOPER_LENS_PHASE_E_AS_OF',
] as const

export class PhaseEConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhaseEConfigurationError'
  }
}

/**
 * The selected-store analysis is absent by default. Once any binding is named, every binding is
 * required and checked together; a partial environment never falls through to an arbitrary path
 * or a default scope/window.
 */
export function resolvePhaseEStoredAnalysisConfig(
  env: NodeJS.ProcessEnv = process.env,
): PhaseEStoredAnalysisConfig | undefined {
  const present = PHASE_E_ENVIRONMENT.filter((name) => env[name] !== undefined)
  if (present.length === 0) return undefined
  if (present.length !== PHASE_E_ENVIRONMENT.length) {
    throw new PhaseEConfigurationError('Phase E selected-store analysis requires every explicit store, scope, consent, window, and clock binding')
  }

  const selectedStoreDirectory = env.DEVELOPER_LENS_PHASE_E_STORE_ROOT as string
  if (!isAbsolute(selectedStoreDirectory)) {
    throw new PhaseEConfigurationError('Phase E selected-store root must be an absolute directory')
  }
  const scopeId = env.DEVELOPER_LENS_PHASE_E_SCOPE_ID as string
  if (!/^scope-[0-9a-f]{64}$/.test(scopeId)) {
    throw new PhaseEConfigurationError('Phase E scope must be a content-free scope surrogate')
  }
  const consentRevision = env.DEVELOPER_LENS_PHASE_E_CONSENT_REVISION as string
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(consentRevision)) {
    throw new PhaseEConfigurationError('Phase E consent revision is malformed')
  }

  const baselineWindow = HalfOpenWindowSchema.parse({
    start: env.DEVELOPER_LENS_PHASE_E_BASELINE_START,
    end: env.DEVELOPER_LENS_PHASE_E_BASELINE_END,
  })
  const currentWindow = HalfOpenWindowSchema.parse({
    start: env.DEVELOPER_LENS_PHASE_E_CURRENT_START,
    end: env.DEVELOPER_LENS_PHASE_E_CURRENT_END,
  })
  if (baselineWindow.end !== currentWindow.start) {
    throw new PhaseEConfigurationError('Phase E comparison windows must be adjacent')
  }
  if (
    Date.parse(baselineWindow.end) - Date.parse(baselineWindow.start)
    !== Date.parse(currentWindow.end) - Date.parse(currentWindow.start)
  ) {
    throw new PhaseEConfigurationError('Phase E comparison windows must have equal duration')
  }
  const asOf = env.DEVELOPER_LENS_PHASE_E_AS_OF as string
  if (Number.isNaN(Date.parse(asOf)) || Date.parse(asOf) < Date.parse(currentWindow.end)) {
    throw new PhaseEConfigurationError('Phase E as-of clock must be parseable and at or after the current window end')
  }

  return Object.freeze({
    selectedStoreDirectory: normalize(selectedStoreDirectory),
    scopeId,
    consentRevision,
    baselineWindow,
    currentWindow,
    asOf,
  })
}

export interface V2RuntimeConfig extends V2GuardOptions {
  readonly storePath: string
  readonly phaseEAnalysis?: PhaseEStoredAnalysisConfig
}

function apiPort(env: NodeJS.ProcessEnv): number {
  const configured = Number(env.DEVELOPER_LENS_PORT ?? V2_DEFAULT_API_PORT)
  return Number.isInteger(configured) && configured > 0 && configured < 65536
    ? configured
    : V2_DEFAULT_API_PORT
}

export function resolveV2RuntimeConfig(
  token: string,
  env: NodeJS.ProcessEnv = process.env,
): V2RuntimeConfig {
  const port = apiPort(env)
  return {
    token,
    allowedHosts: [`127.0.0.1:${port}`, `127.0.0.1:${V2_DEV_WEB_PORT}`],
    allowedOrigins: [`http://127.0.0.1:${port}`, `http://127.0.0.1:${V2_DEV_WEB_PORT}`],
    storePath: defaultV2StorePath(env),
    phaseEAnalysis: resolvePhaseEStoredAnalysisConfig(env),
  }
}
