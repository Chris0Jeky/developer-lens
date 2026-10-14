import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import type { RangeKey } from '../shared/types.js'
import { resolveV2RuntimeConfig } from './api/v2/config.js'
import { V2Error, v2ErrorBody } from './api/v2/errors.js'
import { assertV2Request } from './api/v2/guard.js'
import { mountV2, V2_LAUNCH_BEARER_TOKEN } from './api/v2/mount.js'
import { dashboardPath, loadDashboard } from './dataStore.js'

const app = express()
const port = Number(process.env.DEVELOPER_LENS_PORT ?? 4141)
const host = '127.0.0.1'
const production = process.argv.includes('--production')

app.disable('x-powered-by')
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  next()
})

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', privacy: 'local-only' })
})

// #416: the legacy private routes take the exact `/api/v2` Host/Origin/Fetch-Metadata boundary,
// so a page on another origin (DNS rebinding, foreign Host) cannot read them. `/api/health` stays public.
const legacyGuardConfig = resolveV2RuntimeConfig(V2_LAUNCH_BEARER_TOKEN)
app.use(['/api/dashboard', '/api/status'], (request, response, next) => {
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('Vary', 'Origin')
  try {
    assertV2Request(request.headers, legacyGuardConfig)
    next()
  } catch (error) {
    if (!(error instanceof V2Error)) throw error
    response.status(error.status).json(v2ErrorBody(error.code))
  }
})

app.get('/api/dashboard', async (request, response, next) => {
  try {
    const range: RangeKey = request.query.range === '6m' ? '6m' : '12m'
    response.setHeader('Cache-Control', 'private, no-store')
    response.json(await loadDashboard(range))
  } catch (error) {
    next(error)
  }
})

app.get('/api/status', async (_request, response, next) => {
  try {
    const ranges = await Promise.all(
      (['6m', '12m'] as RangeKey[]).map(async (range) => {
        try {
          await access(dashboardPath(range))
          return { range, ready: true }
        } catch {
          return { range, ready: false }
        }
      }),
    )
    response.setHeader('Cache-Control', 'private, no-store')
    response.json({ ranges })
  } catch (error) {
    next(error)
  }
})

app.use('/api/v2', mountV2())

if (production) {
  const currentDirectory = fileURLToPath(new URL('.', import.meta.url))
  const dist = join(currentDirectory, '..', 'dist')
  app.use(express.static(dist, { index: false }))
  app.use((request, response, next) => {
    if (request.method !== 'GET' || request.path.startsWith('/api/')) {
      next()
      return
    }
    response.sendFile(join(dist, 'index.html'))
  })
}

app.use(
  (
    error: Error,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error.message)
    response.status(500).json({
      error: 'Developer Lens could not load the local dataset.',
    })
  },
)

export function startServer() {
  return app.listen(port, host, () => {
    console.log(
      `Developer Lens is available locally at http://${host}:${port}${production ? '' : ' (API)'}`,
    )
  })
}

if (process.env.NODE_ENV !== 'test') {
  startServer()
}

export { app }
