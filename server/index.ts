import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import type { RangeKey } from '../shared/types.js'
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
