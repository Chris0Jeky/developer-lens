import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { V2_DEFAULT_API_PORT, V2_DEV_WEB_PORT } from './server/api/v2/config.js'

const CLIENT_CHUNK_BUDGET_BYTES = 500_000
const CLIENT_CHUNK_TARGET_BYTES = 450_000

/**
 * Rolldown names a shared application chunk after the common directory of its modules, which is
 * the checkout directory itself. Public asset names must not carry a local directory name, so that
 * chunk is emitted under a fixed name instead.
 */
const CHECKOUT_DIRECTORY_NAME = basename(process.cwd())

function clientChunkFileName(chunk: { name: string }): string {
  return chunk.name === CHECKOUT_DIRECTORY_NAME ? 'assets/app-[hash].js' : 'assets/[name]-[hash].js'
}

function clientAssetFileName(asset: { names?: readonly string[] }): string {
  const name = asset.names?.[0] ?? ''
  return name.startsWith(`${CHECKOUT_DIRECTORY_NAME}.`)
    ? 'assets/app-[hash][extname]'
    : 'assets/[name]-[hash][extname]'
}

/**
 * Keep the public client surface below Vite's 500 kB advisory and make regressions blocking.
 *
 * The budget is evaluated against final emitted JavaScript, after minification. Named vendor
 * groups keep stable cache boundaries while Rolldown's max-size partition handles future growth.
 */
function enforceClientChunkBudget(): Plugin {
  return {
    name: 'developer-lens-client-chunk-budget',
    generateBundle(_options, bundle) {
      const oversized: Array<{ bytes: number; fileName: string }> = []

      for (const artifact of Object.values(bundle)) {
        if (artifact.type !== 'chunk') continue
        const bytes = Buffer.byteLength(artifact.code, 'utf8')
        if (bytes > CLIENT_CHUNK_BUDGET_BYTES) oversized.push({ bytes, fileName: artifact.fileName })
      }

      if (oversized.length === 0) return

      const detail = oversized
        .sort((left, right) => right.bytes - left.bytes)
        .map(({ bytes, fileName }) => `${fileName} (${bytes} bytes)`)
        .join(', ')
      this.error(`Client JavaScript chunk budget exceeded: ${detail}`)
    },
  }
}

/**
 * Pulseboard SDK v3 is emitted into the PUBLIC SYNTHETIC SHOWCASE build only (`--mode showcase`).
 *
 * The artifact lives in `observatory/`, not `public/`, because Vite copies `public/` into every
 * build: a local or private build must contain no copy of the script, no tag loading it and no
 * collector origin (`scripts/verifyUninstrumentedBuild.ts` proves that after `npm run build`).
 * For the showcase build the plugin re-checks the artifact against `observatory.lock.json`, emits
 * it as `pulseboard.js`, and injects the deferred tag plus the empty bar placeholder.
 */
export const PULSEBOARD_SDK_SOURCE = 'observatory/pulseboard.js'
export const PULSEBOARD_SDK_FILE = 'pulseboard.js'

function pulseboardShowcaseOnly(mode: string): Plugin | null {
  if (mode !== 'showcase') return null
  let base = '/'
  return {
    name: 'developer-lens-pulseboard-showcase-only',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml() {
      return [
        {
          tag: 'div',
          attrs: { 'data-pulseboard-bar': true, style: 'min-height:2.5rem' },
          injectTo: 'body-prepend',
        },
        {
          tag: 'script',
          attrs: { defer: true, src: `${base}${PULSEBOARD_SDK_FILE}` },
          injectTo: 'head',
        },
      ]
    },
    generateBundle() {
      const lock = JSON.parse(readFileSync('observatory.lock.json', 'utf8')) as {
        installs: Record<string, { sha256: string }>
      }
      const source = readFileSync(PULSEBOARD_SDK_SOURCE)
      const sha256 = createHash('sha256').update(source).digest('hex')
      if (lock.installs[PULSEBOARD_SDK_SOURCE]?.sha256 !== sha256) {
        this.error(`${PULSEBOARD_SDK_SOURCE} does not match observatory.lock.json`)
      }
      this.emitFile({ type: 'asset', fileName: PULSEBOARD_SDK_FILE, source })
    },
  }
}

/**
 * The dev server port is pinned and the proxy target follows the API's own port resolution (#78).
 *
 * Without `strictPort`, an occupied 5173 silently moves the web app to 5174 — whose Host and
 * Origin are not on the V2 allowlist, so every `/api/v2` request 403s and the guard fails closed
 * for a reason that looks nothing like a port collision. Refusing to start is the honest outcome.
 *
 * The proxy target reads `DEVELOPER_LENS_PORT` exactly as `resolveV2RuntimeConfig` does, so
 * moving the API cannot leave the proxy pointing at the old port.
 */
function apiPort(): number {
  const configured = Number(process.env.DEVELOPER_LENS_PORT ?? V2_DEFAULT_API_PORT)
  return Number.isInteger(configured) && configured > 0 && configured < 65536
    ? configured
    : V2_DEFAULT_API_PORT
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), enforceClientChunkBudget(), pulseboardShowcaseOnly(mode)],
  build: {
    chunkSizeWarningLimit: CLIENT_CHUNK_BUDGET_BYTES / 1000,
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        chunkFileNames: clientChunkFileName,
        assetFileNames: clientAssetFileName,
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[/\\](?:react|react-dom|react-is|scheduler)[/\\]/,
              priority: 40,
            },
            {
              name: 'charts-vendor',
              test: /node_modules[/\\](?:recharts|victory-vendor|d3-[^/\\]+)[/\\]/,
              includeDependenciesRecursively: true,
              maxSize: CLIENT_CHUNK_TARGET_BYTES,
              priority: 30,
            },
            {
              name: 'motion-vendor',
              test: /node_modules[/\\](?:framer-motion|motion-dom|motion-utils)[/\\]/,
              includeDependenciesRecursively: true,
              maxSize: CLIENT_CHUNK_TARGET_BYTES,
              priority: 20,
            },
            {
              name: 'icons-vendor',
              test: /node_modules[/\\]lucide-react[/\\]/,
              includeDependenciesRecursively: true,
              maxSize: CLIENT_CHUNK_TARGET_BYTES,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              maxSize: CLIENT_CHUNK_TARGET_BYTES,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: V2_DEV_WEB_PORT,
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${apiPort()}`,
    },
  },
}))
