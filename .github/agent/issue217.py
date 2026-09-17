from pathlib import Path

path = Path('vite.config.ts')
text = path.read_text(encoding='utf-8')

old_import = "import { defineConfig } from 'vite'"
new_import = "import { defineConfig, type Plugin } from 'vite'"
if text.count(old_import) != 1:
    raise SystemExit(f'expected one Vite import, found {text.count(old_import)}')
text = text.replace(old_import, new_import)

anchor = "import { V2_DEFAULT_API_PORT, V2_DEV_WEB_PORT } from './server/api/v2/config.js'\n"
insert = """import { V2_DEFAULT_API_PORT, V2_DEV_WEB_PORT } from './server/api/v2/config.js'

const CLIENT_CHUNK_BUDGET_BYTES = 500_000
const CLIENT_CHUNK_TARGET_BYTES = 450_000

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
"""
if text.count(anchor) != 1:
    raise SystemExit(f'expected one config import anchor, found {text.count(anchor)}')
text = text.replace(anchor, insert)

old_config = """export default defineConfig({
  plugins: [react()],
  server: {"""
new_config = """export default defineConfig({
  plugins: [react(), enforceClientChunkBudget()],
  build: {
    chunkSizeWarningLimit: CLIENT_CHUNK_BUDGET_BYTES / 1000,
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:react|react-dom|react-is|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: 'charts-vendor',
              test: /node_modules[\\/](?:recharts|victory-vendor|d3-[^\\/]+)[\\/]/,
              includeDependenciesRecursively: true,
              maxSize: CLIENT_CHUNK_TARGET_BYTES,
              priority: 30,
            },
            {
              name: 'motion-vendor',
              test: /node_modules[\\/](?:framer-motion|motion-dom|motion-utils)[\\/]/,
              includeDependenciesRecursively: true,
              maxSize: CLIENT_CHUNK_TARGET_BYTES,
              priority: 20,
            },
            {
              name: 'icons-vendor',
              test: /node_modules[\\/]lucide-react[\\/]/,
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
  server: {"""
if text.count(old_config) != 1:
    raise SystemExit(f'expected one config body anchor, found {text.count(old_config)}')
text = text.replace(old_config, new_config)

path.write_text(text, encoding='utf-8', newline='\n')
