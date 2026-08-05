import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { V2_DEFAULT_API_PORT, V2_DEV_WEB_PORT } from './server/api/v2/config.js'

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
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: V2_DEV_WEB_PORT,
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${apiPort()}`,
    },
  },
})
