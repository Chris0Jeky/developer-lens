import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { repositoryLabels } from './githubRepositoryLabels.js'

const environment = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'invented/fixture',
  GITHUB_TOKEN: 'synthetic-token-canary',
}
const epoch = Date.parse('2026-10-03T00:00:00Z')

function harness(responses: Array<Response | Error>) {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const delays: number[] = []
  let now = epoch
  const dependencies = {
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init })
      const response = responses.shift()
      if (!response) throw new Error('Unexpected additional request')
      if (response instanceof Error) throw response
      return response
    }) as typeof fetch,
    sleep: async (milliseconds: number) => { delays.push(milliseconds); now += milliseconds },
    now: () => now,
  }
  return { dependencies, requests, delays }
}
const ok = (names = ['bug', 'enhancement']) => Response.json(names.map((name) => ({ name })))
const failure = (status: number, headers: Record<string, string> = {}, message = 'synthetic-body-canary') =>
  Response.json({ message }, { status, headers })

// Node assertions let the same regression bodies run in a dependency-free diagnostic probe.
// The repository suite still owns discovery and execution through Vitest.
describe('hosted repository label lookup', () => {
  it('keeps local context verification offline', async () => {
    const h = harness([])
    assert.equal(await repositoryLabels({}, h.dependencies), undefined)
    assert.equal(h.requests.length, 0)
  })
  it('rejects malformed repository selection before HTTP', async () => {
    const h = harness([])
    await assert.rejects(repositoryLabels({ ...environment, GITHUB_REPOSITORY: '../fixture' }, h.dependencies), /missing or invalid/)
    assert.equal(h.requests.length, 0)
  })
  it('returns the exact live set and keeps optional authentication', async () => {
    const h = harness([ok()])
    assert.deepEqual(await repositoryLabels(environment, h.dependencies), new Set(['bug', 'enhancement']))
    assert.equal(h.requests[0]?.url, 'https://api.github.com/repos/invented/fixture/labels?per_page=100&page=1')
    assert.equal(new Headers(h.requests[0]?.init?.headers).get('Authorization'), 'Bearer synthetic-token-canary')
  })
  it('does not require authentication', async () => {
    const h = harness([ok()])
    await repositoryLabels({ ...environment, GITHUB_TOKEN: '' }, h.dependencies)
    assert.equal(new Headers(h.requests[0]?.init?.headers).has('Authorization'), false)
  })
  it('recovers a documented primary-limit 403 after reset', async () => {
    const h = harness([failure(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(epoch / 1000 + 2) }), ok()])
    assert.deepEqual(await repositoryLabels(environment, h.dependencies), new Set(['bug', 'enhancement']))
    assert.deepEqual(h.delays, [2000])
  })
  it('honours Retry-After on a 429', async () => {
    const h = harness([failure(429, { 'retry-after': '3' }), ok()])
    assert.deepEqual(await repositoryLabels(environment, h.dependencies), new Set(['bug', 'enhancement']))
    assert.deepEqual(h.delays, [3000])
  })
  it('recognizes secondary-limit 403 without misclassifying every forbidden response', async () => {
    const h = harness([failure(403, {}, 'You have exceeded a secondary rate limit.'), ok()])
    await repositoryLabels(environment, h.dependencies)
    assert.deepEqual(h.delays, [60_000])
  })
  it('honours both primary reset and Retry-After without retrying early', async () => {
    const h = harness([failure(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(epoch / 1000 + 5), 'retry-after': '1' }), ok()])
    await repositoryLabels(environment, h.dependencies)
    assert.deepEqual(h.delays, [5000])
  })
  for (const status of [403, 429]) {
    for (const reset of [undefined, '', 'not-a-number', '-1', 'Infinity']) {
      it(`refuses primary HTTP ${status} with unavailable reset ${JSON.stringify(reset)}`, async () => {
        const headers: Record<string, string> = { 'x-ratelimit-remaining': '0' }
        if (reset !== undefined) headers['x-ratelimit-reset'] = reset
        const h = harness([failure(status, headers), ok()])
        await assert.rejects(repositoryLabels(environment, h.dependencies), (error: unknown) => {
          assert.ok(error instanceof Error)
          assert.match(error.message, /primary rate-limit reset is unavailable/)
          assert.match(error.message, /no automatic retry/)
          assert.doesNotMatch(error.message, /synthetic-body-canary|synthetic-token-canary/)
          return true
        })
        assert.equal(h.requests.length, 1)
        assert.deepEqual(h.delays, [])
      })
    }
  }
  it('does not substitute Retry-After for an unknown exhausted primary window', async () => {
    const h = harness([failure(403, { 'x-ratelimit-remaining': '0', 'retry-after': '1' }), ok()])
    await assert.rejects(repositoryLabels(environment, h.dependencies), /primary rate-limit reset is unavailable/)
    assert.equal(h.requests.length, 1)
    assert.deepEqual(h.delays, [])
  })
  for (const status of [401, 403, 404]) {
    it(`fails a permanent HTTP ${status} once with safe actionable diagnostics`, async () => {
      const h = harness([failure(status)])
      await assert.rejects(repositoryLabels(environment, h.dependencies), (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, new RegExp(`HTTP ${status}`))
        assert.match(error.message, /authentication=present/)
        assert.match(error.message, /check|verify/i)
        assert.doesNotMatch(error.message, /synthetic-body-canary|synthetic-token-canary/)
        return true
      })
      assert.equal(h.requests.length, 1)
      assert.deepEqual(h.delays, [])
    })
  }
  it('bounds repeated rate limiting to one recovery retry', async () => {
    const h = harness([failure(429), failure(429), ok()])
    await assert.rejects(repositoryLabels(environment, h.dependencies), /attempt=2\/2.*retry limit/)
    assert.equal(h.requests.length, 2)
    assert.deepEqual(h.delays, [60_000])
  })
  it('refuses a reset beyond the wait budget instead of truncating it', async () => {
    const h = harness([failure(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(epoch / 1000 + 3600) })])
    await assert.rejects(repositoryLabels(environment, h.dependencies), /wait budget.*rerun/i)
    assert.equal(h.requests.length, 1)
    assert.deepEqual(h.delays, [])
  })
  it('refuses an excessive Retry-After without an early retry', async () => {
    const h = harness([failure(429, { 'retry-after': '999999999' })])
    await assert.rejects(repositoryLabels(environment, h.dependencies), /wait budget/)
    assert.deepEqual(h.delays, [])
  })
  for (const value of ['', 'not-a-number', '-1', 'Infinity']) {
    it(`uses safe secondary backoff for malformed Retry-After ${JSON.stringify(value)}`, async () => {
      const h = harness([failure(429, { 'retry-after': value }), ok()])
      await repositoryLabels(environment, h.dependencies)
      assert.deepEqual(h.delays, [60_000])
    })
  }
  it('retries transient transport failures without echoing their messages', async () => {
    const h = harness([new Error('synthetic-token-canary'), ok()])
    assert.deepEqual(await repositoryLabels(environment, h.dependencies), new Set(['bug', 'enhancement']))
    assert.deepEqual(h.delays, [1000])
  })
  it('bounds repeated transport failure and suppresses untrusted exception text', async () => {
    const h = harness(Array.from({ length: 3 }, () => new Error('synthetic-token-canary')))
    await assert.rejects(repositoryLabels(environment, h.dependencies), (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /transport.*attempt=2\/2/)
      assert.doesNotMatch(error.message, /synthetic-token-canary/)
      return true
    })
    assert.equal(h.requests.length, 2)
  })
  it('retries only the failed pagination page and preserves earlier labels', async () => {
    const names = Array.from({ length: 100 }, (_, i) => `label-${i}`)
    const h = harness([ok(names), failure(429, { 'retry-after': '1' }), ok(['final'])])
    assert.deepEqual(await repositoryLabels(environment, h.dependencies), new Set([...names, 'final']))
    assert.deepEqual(h.requests.map(({ url }) => new URL(url).searchParams.get('page')), ['1', '2', '2'])
  })
  it('does not reset the total wait budget at a page boundary', async () => {
    const names = Array.from({ length: 100 }, (_, i) => `label-${i}`)
    const h = harness([failure(429, { 'retry-after': '120' }), ok(names), failure(429, { 'retry-after': '61' })])
    await assert.rejects(repositoryLabels(environment, h.dependencies), /wait budget/)
    assert.equal(h.requests.length, 3)
    assert.deepEqual(h.delays, [120_000])
  })
  it('fails closed when pagination never terminates', async () => {
    const names = Array.from({ length: 100 }, (_, i) => `label-${i}`)
    const h = harness(Array.from({ length: 10 }, () => ok(names)))
    await assert.rejects(repositoryLabels(environment, h.dependencies), /pagination.*ceiling/)
    assert.equal(h.requests.length, 10)
  })
  it('rejects malformed success payloads rather than silently returning a partial label set', async () => {
    for (const payload of [{ name: 'bug' }, [{ name: 'bug' }, { unexpected: 'synthetic-body-canary' }]]) {
      const h = harness([Response.json(payload)])
      await assert.rejects(repositoryLabels(environment, h.dependencies), /response.*invalid|response.*array/)
      assert.equal(h.requests.length, 1)
    }
  })
  it('sanitizes invalid success JSON and does not retry it', async () => {
    const h = harness([new Response('synthetic-token-canary')])
    await assert.rejects(repositoryLabels(environment, h.dependencies), (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /invalid JSON/)
      assert.doesNotMatch(error.message, /synthetic-token-canary/)
      return true
    })
    assert.equal(h.requests.length, 1)
  })
  it('does not infer absent required labels as an HTTP recovery case', async () => {
    const h = harness([ok(['bug'])])
    const labels = await repositoryLabels(environment, h.dependencies)
    assert.equal(labels?.has('enhancement'), false)
    assert.equal(h.requests.length, 1)
  })
  it('applies a request deadline to every HTTP attempt', async () => {
    const h = harness([ok()])
    await repositoryLabels(environment, h.dependencies)
    assert.ok(h.requests[0]?.init?.signal instanceof AbortSignal)
  })
})
