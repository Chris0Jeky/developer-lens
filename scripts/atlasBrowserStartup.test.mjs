import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { access, rm } from 'node:fs/promises'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { openBrowser } from './atlasPointerSmoke.mjs'

const fixtures = []

// Only the process transport is injected; profiles are disposable OS-temp fixtures.
async function startBrowser({ replyAfter, ignoreTerm = false } = {}) {
  const child = new EventEmitter()
  child.pid = 12345
  child.exitCode = null
  child.signalCode = null
  child.stdio = [null, null, null, new EventEmitter(), new EventEmitter()]
  child.stdio[4].setEncoding = () => {}
  const requests = []
  child.stdio[3].write = (raw) => {
    const request = JSON.parse(raw.slice(0, -1))
    requests.push(request)
    if (requests.length === 1 && replyAfter !== undefined) {
      setTimeout(() => child.stdio[4].emit('data', `${JSON.stringify({ id: request.id, result: {} })}\0`), replyAfter)
    }
    return true
  }
  child.kill = vi.fn((signal) => {
    if (signal === 'SIGTERM' && ignoreTerm) return true
    child.signalCode = signal
    child.emit('exit', null, signal)
    return true
  })
  let started
  const launched = new Promise((resolve) => { started = resolve })
  const f = { child, requests, profile: undefined, state: 'pending' }
  fixtures.push(f)
  f.outcome = openBrowser('invented-chrome', (_executable, args) => {
    f.profile = args.find((arg) => arg.startsWith('--user-data-dir=')).slice('--user-data-dir='.length)
    started()
    return child
  }).then((browser) => { f.state = 'ready'; return { browser } },
    (error) => { f.state = 'failed'; return { error } })
  await launched
  return f
}

beforeEach(() => vi.useFakeTimers())
afterEach(async () => {
  vi.clearAllTimers()
  vi.useRealTimers()
  for (const f of fixtures.splice(0)) {
    if (f.child.exitCode === null && f.child.signalCode === null) f.child.kill('SIGKILL')
    if (f.profile) await rm(f.profile, { recursive: true, force: true })
  }
})

describe('bounded cold-browser handshake (#428)', () => {
  it('accepts an immediate first response and cleans up on close', async () => {
    const f = await startBrowser({ replyAfter: 0 })
    await vi.advanceTimersByTimeAsync(0)
    const { browser, error } = await f.outcome
    assert.equal(error, undefined)
    assert.equal(f.requests[0].method, 'Browser.getVersion')
    await browser.close()
    assert.equal(f.child.signalCode, 'SIGTERM')
    await assert.rejects(access(f.profile))
    assert.equal(vi.getTimerCount(), 0)
  })

  it('accepts a cold handshake after 20 seconds without retrying it', async () => {
    const f = await startBrowser({ replyAfter: 20_000 })
    await vi.advanceTimersByTimeAsync(10_001)
    assert.equal(f.state, 'pending', 'the startup handshake must outlive the ordinary CDP deadline')
    assert.equal(f.child.kill.mock.calls.length, 0)
    await vi.advanceTimersByTimeAsync(9_999)
    const { browser, error } = await f.outcome
    assert.equal(error, undefined)
    assert.equal(f.requests.length, 1)
    await browser.close()
  })

  it('fails at the 45-second startup limit and kills the browser before rejecting', async () => {
    const f = await startBrowser()
    await vi.advanceTimersByTimeAsync(44_999)
    assert.equal(f.state, 'pending')
    assert.equal(f.child.kill.mock.calls.length, 0)
    await vi.advanceTimersByTimeAsync(1)
    const { error } = await f.outcome
    assert.match(error.message, /Browser startup failed.*CDP timeout: Browser\.getVersion/)
    assert.equal(f.requests.length, 1)
    assert.equal(f.child.signalCode, 'SIGTERM')
    await assert.rejects(access(f.profile))
    assert.equal(vi.getTimerCount(), 0)
  })

  it('fails promptly with startup context when the browser exits before replying', async () => {
    const f = await startBrowser()
    await vi.advanceTimersByTimeAsync(500)
    f.child.exitCode = 7
    f.child.emit('exit', 7, null)
    const { error } = await f.outcome
    assert.match(error.message, /Browser startup failed.*Browser exited.*7/)
    assert.equal(f.child.kill.mock.calls.length, 0)
    await assert.rejects(access(f.profile))
    assert.equal(vi.getTimerCount(), 0)
  })

  it('cleans up a failed launch without waiting for an exit from a process that never started', async () => {
    const f = await startBrowser()
    f.child.pid = undefined
    f.child.emit('error', new Error('invented launch failure'))
    const { error } = await f.outcome
    assert.match(error.message, /Browser startup failed.*Browser process failed/)
    assert.equal(f.child.kill.mock.calls.length, 0)
    await assert.rejects(access(f.profile))
    assert.equal(vi.getTimerCount(), 0)
  })

  for (const method of ['Target.createTarget', 'Browser.getVersion']) {
    it(`keeps the later ${method} command at 10 seconds`, async () => {
      const f = await startBrowser({ replyAfter: 0 })
      await vi.advanceTimersByTimeAsync(0)
      const { browser } = await f.outcome
      const rejected = assert.rejects(browser.send(method), new RegExp(`CDP timeout: ${method}`))
      await vi.advanceTimersByTimeAsync(9_999)
      assert.equal(vi.getTimerCount(), 1)
      await vi.advanceTimersByTimeAsync(1)
      await rejected
      assert.equal(vi.getTimerCount(), 0)
      await browser.close()
    })
  }

  it('forces termination after a bounded grace period if SIGTERM is ignored', async () => {
    const f = await startBrowser({ ignoreTerm: true })
    await vi.advanceTimersByTimeAsync(45_000)
    assert.deepEqual(f.child.kill.mock.calls, [['SIGTERM']])
    await vi.advanceTimersByTimeAsync(1_999)
    assert.equal(f.child.signalCode, null)
    await vi.advanceTimersByTimeAsync(1)
    const { error } = await f.outcome
    assert.match(error.message, /Browser startup failed/)
    assert.deepEqual(f.child.kill.mock.calls, [['SIGTERM'], ['SIGKILL']])
    assert.equal(f.child.signalCode, 'SIGKILL')
    await assert.rejects(access(f.profile))
    assert.equal(vi.getTimerCount(), 0)
  })
})
