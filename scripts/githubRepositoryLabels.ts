import { setTimeout as sleep } from 'node:timers/promises'

export interface LabelLookupDependencies {
  readonly fetch?: typeof globalThis.fetch
  readonly sleep?: (milliseconds: number) => Promise<void>
  readonly now?: () => number
}

const MAX_PAGES = 10
const MAX_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 10_000
const TOTAL_WAIT_BUDGET_MS = 180_000

// Read numeric control headers, never interpolate arbitrary response text into diagnostics.
// Oversized positive values remain Infinity so they exceed the budget, not an early retry.
function seconds(value: string | null): number | null {
  return value !== null && /^\d+$/.test(value.trim()) ? Number(value.trim()) : null
}

function rateLimitDelay(response: Response, message: unknown, attempt: number, now: number): number | null {
  if (response.status !== 403 && response.status !== 429) return null
  const retryAfter = seconds(response.headers.get('retry-after'))
  const exhausted = response.headers.get('x-ratelimit-remaining')?.trim() === '0'
  const declared = typeof message === 'string' && (
    /\b(?:API|secondary) rate limit\b.*\bexceeded\b/i.test(message) ||
    /\bexceeded\b.*\b(?:secondary )?rate limit\b/i.test(message)
  )
  if (response.status !== 429 && !exhausted && retryAfter === null && !declared) return null

  const reset = exhausted ? seconds(response.headers.get('x-ratelimit-reset')) : null
  const resetDelay = reset === null ? null : Math.max(0, reset * 1000 - now)
  const instructed = [retryAfter === null ? null : retryAfter * 1000, resetDelay]
    .filter((value): value is number => value !== null)
  // GitHub requires at least a minute for secondary limits without timing headers.
  // Honor the later of both headers when supplied; never cap a server-directed delay.
  return instructed.length > 0
    ? Math.max(1000, ...instructed)
    : 60_000 * 2 ** (attempt - 1)
}

/** Hosted-only, live label proof. No cache, fallback label list, permission change or token requirement. */
export async function repositoryLabels(
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: LabelLookupDependencies = {},
): Promise<ReadonlySet<string> | undefined> {
  if (environment['GITHUB_ACTIONS'] !== 'true') return undefined
  const repository = environment['GITHUB_REPOSITORY']
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
      repository.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('GITHUB_REPOSITORY is missing or invalid')
  }
  const apiBase = environment['GITHUB_API_URL'] ?? 'https://api.github.com'
  // Preserve existing optional authentication. Wiring CI credentials is a separate reviewed task.
  const token = environment['GITHUB_TOKEN']
  const request = dependencies.fetch ?? globalThis.fetch
  const wait = dependencies.sleep ?? sleep
  const now = dependencies.now ?? Date.now
  const labels = new Set<string>()
  let waited = 0

  async function retry(delay: number, context: string, attempt: number): Promise<void> {
    if (attempt === MAX_ATTEMPTS) {
      throw new Error(`${context}; retry limit reached. Verify the service/access state before rerunning.`)
    }
    if (delay > TOTAL_WAIT_BUDGET_MS - waited) {
      throw new Error(`${context}; wait budget exceeded. Rerun after the server-directed rate-limit window; no early retry was made.`)
    }
    waited += delay
    await wait(delay)
  }

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const context = `authentication=${token ? 'present' : 'absent'}; page=${page}; attempt=${attempt}/${MAX_ATTEMPTS}`
      let response: Response
      try {
        response = await request(`${apiBase}/repos/${repository}/labels?per_page=100&page=${page}`, {
          headers: {
            Accept: 'application/vnd.github+json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'User-Agent': 'developer-lens-context-verifier',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch {
        await retry(1000 * 2 ** (attempt - 1), `GitHub labels transport failure (${context})`, attempt)
        continue
      }

      if (!response.ok) {
        // Consume the failed body before another request. Only a closed classification escapes.
        let message: unknown
        try {
          const payload: unknown = await response.json()
          if (payload !== null && typeof payload === 'object' && 'message' in payload) message = payload.message
        } catch { /* Non-JSON error responses carry no additional rate-limit evidence. */ }
        const delay = rateLimitDelay(response, message, attempt, now())
        const failed = `GitHub labels request failed (HTTP ${response.status}; ${context})`
        if (delay !== null) {
          await retry(delay, `${failed}; rate limited`, attempt)
          continue
        }
        const reason = response.status === 403 ? 'Rate limiting was not established. ' : ''
        throw new Error(`${failed}. ${reason}Check repository access and any existing CI authentication; no automatic retry was made.`)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new Error(`GitHub labels response contains invalid JSON (${context})`)
      }
      if (!Array.isArray(payload)) throw new Error(`GitHub labels response is not an array (${context})`)
      for (const entry of payload) {
        if (entry === null || typeof entry !== 'object' || typeof entry.name !== 'string' || entry.name.length === 0) {
          throw new Error(`GitHub labels response contains an invalid label (${context})`)
        }
        labels.add(entry.name)
      }
      if (payload.length < 100) return labels
      break
    }
  }
  throw new Error('GitHub label pagination exceeded the verifier ceiling')
}
