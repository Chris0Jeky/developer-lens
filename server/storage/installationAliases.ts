import { createHmac } from 'node:crypto'

export class InstallationKeyError extends Error {
  public readonly code: 'INSTALLATION_KEY_REQUIRED' | 'INSTALLATION_KEY_TOO_SHORT'

  constructor(code: 'INSTALLATION_KEY_REQUIRED' | 'INSTALLATION_KEY_TOO_SHORT') {
    super(code)
    this.name = 'InstallationKeyError'
    this.code = code
  }
}

export type GithubCoreAliasDomain = 'repository' | 'issue' | 'pull_request' | 'page'

export type GithubCoreAlias = (domain: GithubCoreAliasDomain, rawProviderId: string) => string

export interface GithubCoreAliasInput {
  readonly domain: GithubCoreAliasDomain
  readonly rawProviderId: string
}

export interface GithubCoreAliasAssignment {
  readonly domain: GithubCoreAliasDomain
  readonly alias: string
}

export interface InstallationAliases {
  readonly repositoryProviderId: (rawProviderId: string) => string
  readonly repositoryAnalyticalKey: (rawProviderId: string) => string
  readonly githubCoreAlias: GithubCoreAlias
  readonly assignGithubCoreAliases: (inputs: readonly GithubCoreAliasInput[]) => readonly GithubCoreAliasAssignment[]
}

const REPOSITORY_PROVIDER_DOMAIN = 'developer-lens/repository-provider/v1'
const REPOSITORY_ANALYTICAL_DOMAIN = 'developer-lens/repository-analytical/v1'
const GITHUB_CORE_DOMAINS: Readonly<Record<GithubCoreAliasDomain, string>> = Object.freeze({
  repository: REPOSITORY_PROVIDER_DOMAIN,
  issue: 'developer-lens/github-core/issue/v1',
  pull_request: 'developer-lens/github-core/pull-request/v1',
  page: 'developer-lens/github-core/page/v1',
})
const GITHUB_CORE_PREFIXES: Readonly<Record<GithubCoreAliasDomain, string>> = Object.freeze({
  repository: 'repo-',
  issue: 'issue-',
  pull_request: 'pull-request-',
  page: 'page-',
})
const GITHUB_CORE_ALIAS_DOMAINS = new Set<GithubCoreAliasDomain>(['repository', 'issue', 'pull_request', 'page'])

function snapshotInstallationKey(value: Buffer | undefined): Buffer {
  if (value === undefined || value.length === 0) throw new InstallationKeyError('INSTALLATION_KEY_REQUIRED')
  if (value.length < 32) throw new InstallationKeyError('INSTALLATION_KEY_TOO_SHORT')
  return Buffer.from(value)
}

function assertRawProviderId(rawProviderId: string): void {
  if (typeof rawProviderId !== 'string' || rawProviderId.length === 0) {
    throw new Error('INSTALLATION_ALIAS_INPUT_INVALID')
  }
}

function assertGithubCoreAliasDomain(domain: GithubCoreAliasDomain): void {
  if (!GITHUB_CORE_ALIAS_DOMAINS.has(domain)) throw new Error('INSTALLATION_ALIAS_INPUT_INVALID')
}

function digestAlias(key: Buffer, domain: string, rawProviderId: string): string {
  return createHmac('sha256', key).update(domain).update('\0').update(rawProviderId).digest('hex')
}

export function createInstallationAliases(value: Buffer | undefined): InstallationAliases {
  const key = snapshotInstallationKey(value)

  const repositoryProviderId = (rawProviderId: string): string => {
    assertRawProviderId(rawProviderId)
    return `repo-${digestAlias(key, REPOSITORY_PROVIDER_DOMAIN, rawProviderId)}`
  }

  const repositoryAnalyticalKey = (rawProviderId: string): string => {
    assertRawProviderId(rawProviderId)
    return `repo-${digestAlias(key, REPOSITORY_ANALYTICAL_DOMAIN, rawProviderId)}`
  }

  const githubCoreAlias: GithubCoreAlias = (domain, rawProviderId) => {
    assertGithubCoreAliasDomain(domain)
    assertRawProviderId(rawProviderId)
    return `${GITHUB_CORE_PREFIXES[domain]}${digestAlias(key, GITHUB_CORE_DOMAINS[domain], rawProviderId)}`
  }

  const assignGithubCoreAliases = (inputs: readonly GithubCoreAliasInput[]): readonly GithubCoreAliasAssignment[] => {
    const seenInputs = new Set<string>()
    const seenAliases = new Set<string>()
    const assignments: GithubCoreAliasAssignment[] = []
    for (const input of inputs) {
      assertGithubCoreAliasDomain(input.domain)
      assertRawProviderId(input.rawProviderId)
      const inputKey = `${input.domain}\0${input.rawProviderId}`
      if (seenInputs.has(inputKey)) throw new Error('INSTALLATION_ALIAS_COLLISION')
      seenInputs.add(inputKey)
      const alias = githubCoreAlias(input.domain, input.rawProviderId)
      if (seenAliases.has(alias)) throw new Error('INSTALLATION_ALIAS_COLLISION')
      seenAliases.add(alias)
      assignments.push(Object.freeze({ domain: input.domain, alias }))
    }
    return Object.freeze(assignments)
  }

  return Object.freeze({ repositoryProviderId, repositoryAnalyticalKey, githubCoreAlias, assignGithubCoreAliases })
}
