import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { requirePointerTarget, requirePointerEvents } from './atlasPointerContract.mjs'
import { matchesAtlasDrawer } from './atlasDrawerContract.mjs'
import { finishPointerReceipt } from './atlasPointerReceipt.mjs'
import { waitForStablePointerTarget } from './atlasPointerReadiness.mjs'

/** Process-private CDP transport; never attaches to a user's existing browser/profile. */
export async function openBrowser(executable = process.env.CHROME_PATH || 'google-chrome') {
  const profile = await mkdtemp(join(tmpdir(), 'lens-c0-pointer-'))
  const child = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking', '--disable-extensions',
    '--remote-debugging-pipe', `--user-data-dir=${profile}`,
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] })
  let sequence = 0
  let buffered = ''
  let closed = false
  const pending = new Map()
  const listeners = new Set()
  function rejectPending() {
    closed = true
    for (const value of pending.values()) { clearTimeout(value.timer); value.reject(new Error('Browser transport closed')) }
    pending.clear()
  }
  child.on('error', rejectPending)
  child.on('exit', rejectPending)
  child.stdio[3].on('error', rejectPending)
  child.stdio[4].setEncoding('utf8')
  child.stdio[4].on('data', (chunk) => {
    buffered += chunk
    let end
    while ((end = buffered.indexOf('\0')) !== -1) {
      const raw = buffered.slice(0, end)
      buffered = buffered.slice(end + 1)
      if (!raw) continue
      let message
      try { message = JSON.parse(raw) } catch { rejectPending(); return }
      const waiter = pending.get(message.id)
      if (waiter) {
        pending.delete(message.id); clearTimeout(waiter.timer)
        if (message.error) waiter.reject(new Error(`CDP command failed: ${waiter.method}`))
        else waiter.resolve(message.result)
      } else {
        for (const listener of listeners) listener(message)
      }
    }
  })
  const send = (method, params = {}, sessionId) => new Promise((resolveResult, reject) => {
    if (closed) { reject(new Error('Browser transport closed')); return }
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 10_000)
    pending.set(id, { resolve: resolveResult, reject, timer, method })
    child.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`)
  })
  const close = async () => {
    const exited = once(child, 'exit').catch(() => {})
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      await Promise.race([exited, delay(2000)])
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited }
    }
    rejectPending()
    await rm(profile, { recursive: true, force: true })
  }
  try { await send('Browser.getVersion') } catch (error) { await close(); throw error }
  return { send, listeners, close }
}

/** Serve only the explicitly selected, already-verified C0 build on an ephemeral loopback port. */
export async function serveBuild(directory) {
  const root = resolve(directory)
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      if (request.method !== 'GET' || !pathname.startsWith('/developer-lens/') || pathname.endsWith('/pulseboard.js')) throw new Error('Not allowed')
      const relative = pathname.slice('/developer-lens/'.length) || 'index.html'
      const file = resolve(root, relative)
      if (!file.startsWith(`${root}${sep}`) || !types[extname(file)] || !(await stat(file)).isFile()) throw new Error('Not allowed')
      response.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-store' })
      response.end(await readFile(file))
    } catch { response.writeHead(404); response.end() }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => { server.close(done); server.closeAllConnections() }) }
}

// Serialized into the C0 page. Return only geometry and content-free target identities.
export function targetSnapshot(selector) {
  const matches = document.querySelectorAll(selector)
  const element = matches[0]
  if (!element) return { count: 0 }
  const box = element.getBoundingClientRect()
  const x = box.left + box.width / 2
  const y = box.top + box.height / 2
  return { count: matches.length, connected: element.isConnected, disabled: element.disabled,
    mark: element.getAttribute('data-mark-id'), hit: document.elementFromPoint(x, y)?.closest('button')?.getAttribute('data-mark-id') ?? null,
    x, y, left: box.left, top: box.top, width: box.width, height: box.height,
    viewportWidth: innerWidth, viewportHeight: innerHeight, scrollX, scrollY }
}

/** Capture only rendered public evidence identities; never serialize arbitrary page text. */
export function drawerSnapshot() {
  const dialogs = document.querySelectorAll('[data-testid="evidence-drawer"]')
  const dialog = dialogs[0]
  if (!dialog) return { count: 0 }
  const box = dialog.getBoundingClientRect()
  const style = getComputedStyle(dialog)
  return { count: dialogs.length, visible: box.width > 0 && box.height > 0 &&
    style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0',
    referenceKind: dialog.getAttribute('data-reference-kind'),
    heading: dialog.querySelector('h2')?.textContent?.trim(),
    supports: [...dialog.querySelectorAll('[data-testid="edge-group-supports"] .evidence-drawer__toggle')]
      .map((element) => /^evidence ([A-Za-z0-9_.]+) · observed$/.exec(element.textContent.trim())?.[1] ?? null) }
}

async function pageSession(browser, origin, width) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
  const send = (method, params) => browser.send(method, params, sessionId)
  const failures = []
  const intercept = (message) => {
    if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return
    const url = new URL(message.params.request.url)
    const allowed = url.origin === origin && url.pathname.startsWith('/developer-lens/') && !url.pathname.endsWith('/pulseboard.js')
    send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId: message.params.requestId,
      ...(!allowed ? { errorReason: 'BlockedByClient' } : {}) }).catch(() => failures.push('request-interception-failed'))
  }
  browser.listeners.add(intercept)
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Network.setBypassServiceWorker', { bypass: true })
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error('Page probe evaluation failed')
    return result.result.value
  }
  const poll = async (expression) => {
    const end = Date.now() + 10_000
    do { if (await evaluate(expression)) return; await delay(40) } while (Date.now() < end)
    throw new Error('Expected page state did not become ready')
  }
  const close = async () => {
    browser.listeners.delete(intercept)
    await browser.send('Target.closeTarget', { targetId })
    assert.equal(failures.length, 0, 'Network isolation could not be proved')
  }
  return { send, evaluate, poll, close }
}

export async function runSmoke(directory = 'dist') {
  const build = await serveBuild(directory)
  const browser = await openBrowser().catch(async (error) => { await build.close(); throw error })
  const receipts = []
  try {
    for (const width of [1280, 390]) {
      for (let repetition = 0; repetition < 3; repetition += 1) {
        const page = await pageSession(browser, build.origin, width)
        const receipt = { width, repetition, status: 'failed', phase: 'navigate', traces: [] }
        receipts.push(receipt)
        try {
          const navigation = await page.send('Page.navigate', { url: `${build.origin}/developer-lens/?view=integration-shape` })
          if (navigation.errorText) throw new Error('C0 build navigation failed')
          receipt.phase = 'wait-for-c0'
          await page.poll(`document.readyState === 'complete' && document.fonts.status === 'loaded' && document.querySelector('[data-testid="change-batch-tail"][data-source="synthetic"]') !== null`)
          await page.evaluate(`window.__pointerEvents = []; for (const type of ['mousedown','mouseup','click']) document.addEventListener(type, event => { if (window.__pointerEvents.length < 12) window.__pointerEvents.push({type, trusted:event.isTrusted, mark:event.target.closest?.('button')?.getAttribute('data-mark-id') ?? null}) }, true)`)
          for (const column of [7, 8]) {
            receipt.phase = `pointer-column-${column}`
            const selector = `[data-testid="change-batch-primary"] [data-stratum="s1"] td:nth-of-type(${column}) button`
            await page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',inline:'center',behavior:'instant'})`)
            await page.evaluate('new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))')
            const snapshot = () => page.evaluate(`(${targetSnapshot.toString()})(${JSON.stringify(selector)})`)
            const first = await snapshot()
            receipt.traces.push({ column, phase: 'before', ...first })
            const point = await waitForStablePointerTarget(snapshot, (sample) => receipt.traces.push({ column, phase: 'settling', ...sample }))
            await page.evaluate('window.__pointerEvents = []')
            for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
              const before = await snapshot()
              receipt.traces.push({ column, phase: `before-${type}`, ...before })
              requirePointerTarget(before, point)
              await page.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y,
                button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0,
                clickCount: type === 'mouseMoved' ? 0 : 1 })
              receipt.traces.push({ column, phase: `after-${type}`, ...await snapshot() })
            }
            const events = await page.evaluate('window.__pointerEvents')
            receipt.traces.push({ column, events })
            requirePointerEvents(events, point.mark)
            receipt.phase = `drawer-column-${column}`
            try {
              await page.poll(`(${matchesAtlasDrawer.toString()})((${drawerSnapshot.toString()})(), ${JSON.stringify(point.mark)})`)
            } finally {
              receipt.traces.push({ column, drawer: await page.evaluate(`(${drawerSnapshot.toString()})()`) })
            }
            await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
            await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
            await page.poll(`document.querySelector('[data-testid="evidence-drawer"]') === null`)
          }
          receipt.phase = 'complete'
        } finally { await finishPointerReceipt(receipt, page.close) }
      }
    }
    return receipts
  } finally { try { await browser.close() } finally { await build.close() } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runSmoke(process.argv[2] || 'dist').then((receipts) => {
    console.log(`C0 native pointer smoke: ${receipts.length} sequences passed; no click retries. Public deployment and physical-device acceptance remain separate.`)
  }).catch(() => { console.error('C0 native pointer smoke failed; retain the preceding failed trace.'); process.exitCode = 1 })
}
