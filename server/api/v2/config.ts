import { join } from 'node:path'
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

export interface V2RuntimeConfig extends V2GuardOptions {
  readonly storePath: string
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
  }
}
