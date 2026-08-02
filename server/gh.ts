import { spawn } from 'node:child_process'

const DEFAULT_TIMEOUT_MS = 120_000

export class GhError extends Error {
  readonly exitCode: number | null

  constructor(message: string, exitCode: number | null) {
    super(message)
    this.name = 'GhError'
    this.exitCode = exitCode
  }
}

export async function runGh(
  args: string[],
  input?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn('gh', args, {
      windowsHide: true,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill()
      reject(new GhError(`GitHub CLI timed out after ${timeoutMs}ms`, null))
    }, timeoutMs)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(new GhError(`Unable to launch GitHub CLI: ${error.message}`, null))
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve(stdout)
        return
      }

      const safeMessage = stderr.trim() || `GitHub CLI exited with code ${code}`
      reject(new GhError(safeMessage, code))
    })

    if (input) {
      child.stdin.write(input)
    }
    child.stdin.end()
  })
}

export async function ghJson<T>(
  args: string[],
  input?: string,
  timeoutMs?: number,
): Promise<T> {
  const output = await runGh(args, input, timeoutMs)
  return JSON.parse(output) as T
}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await ghJson<{
    data?: T
    errors?: Array<{ message: string }>
  }>(
    ['api', 'graphql', '--input', '-'],
    JSON.stringify({ query, variables }),
  )
  if (response.errors?.length) {
    throw new GhError(
      response.errors.map((error) => error.message).join('; '),
      null,
    )
  }
  if (!response.data) {
    throw new GhError('GitHub GraphQL returned no data.', null)
  }
  return response.data
}
