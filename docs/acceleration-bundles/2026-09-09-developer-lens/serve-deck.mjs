import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const port = Number.parseInt(process.env.DEVELOPER_LENS_DECK_PORT ?? '4177', 10)
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
  throw new Error('DEVELOPER_LENS_DECK_PORT must be an integer from 1024 to 65535')
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
])

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const pathname = decodeURIComponent(url.pathname === '/' ? '/interactive-decision-deck.html' : url.pathname)
    const candidate = resolve(root, `.${pathname}`)
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Forbidden')
      return
    }
    const metadata = statSync(candidate)
    if (!metadata.isFile()) throw new Error('not a file')
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes.get(extname(candidate)) ?? 'application/octet-stream',
      'Content-Length': metadata.size,
      'X-Content-Type-Options': 'nosniff',
    })
    createReadStream(candidate).pipe(response)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Developer Lens decision deck: http://127.0.0.1:${port}/interactive-decision-deck.html`)
})
