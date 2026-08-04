import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  createInstallationAliases,
  InstallationKeyError,
} from './installationAliases.js'

const KEY = Buffer.from('synthetic-installation-key-material-0123456789', 'utf8')
const RAW_REPOSITORY_ID = 'repository-provider-101'

function expectedAlias(key: Buffer, domain: string, rawProviderId: string, prefix: string): string {
  return `${prefix}${createHmac('sha256', key).update(domain).update('\0').update(rawProviderId).digest('hex')}`
}

describe('installation-scoped aliases', () => {
  it('preserves stable key errors and snapshots the injected key', () => {
    expect(() => createInstallationAliases(undefined)).toThrow('INSTALLATION_KEY_REQUIRED')
    expect(() => createInstallationAliases(Buffer.alloc(0))).toThrow('INSTALLATION_KEY_REQUIRED')
    expect(() => createInstallationAliases(Buffer.alloc(31))).toThrow('INSTALLATION_KEY_TOO_SHORT')

    const mutableKey = Buffer.from(KEY)
    const aliases = createInstallationAliases(mutableKey)
    const beforeMutation = aliases.repositoryProviderId(RAW_REPOSITORY_ID)
    mutableKey.fill(0)
    expect(aliases.repositoryProviderId(RAW_REPOSITORY_ID)).toBe(beforeMutation)
    expect(() => aliases.repositoryProviderId('')).toThrow('INSTALLATION_ALIAS_INPUT_INVALID')
  })

  it('keeps the exact v1 repository provider and analytical aliases', () => {
    const aliases = createInstallationAliases(KEY)
    expect(aliases.repositoryProviderId(RAW_REPOSITORY_ID)).toBe(expectedAlias(KEY, 'developer-lens/repository-provider/v1', RAW_REPOSITORY_ID, 'repo-'))
    expect(aliases.repositoryAnalyticalKey(RAW_REPOSITORY_ID)).toBe(expectedAlias(KEY, 'developer-lens/repository-analytical/v1', RAW_REPOSITORY_ID, 'repo-'))
    expect(aliases.repositoryProviderId(RAW_REPOSITORY_ID)).not.toBe(aliases.repositoryAnalyticalKey(RAW_REPOSITORY_ID))
  })

  it('separates GitHub core domains and installation keys without raw IDs', () => {
    const aliases = createInstallationAliases(KEY)
    const otherKey = createInstallationAliases(Buffer.from('another-synthetic-installation-key-material-6789', 'utf8'))
    const issue = aliases.githubCoreAlias('issue', RAW_REPOSITORY_ID)
    const pullRequest = aliases.githubCoreAlias('pull_request', RAW_REPOSITORY_ID)
    const page = aliases.githubCoreAlias('page', RAW_REPOSITORY_ID)

    expect(issue).toMatch(/^issue-[a-f0-9]{64}$/)
    expect(pullRequest).toMatch(/^pull-request-[a-f0-9]{64}$/)
    expect(page).toMatch(/^page-[a-f0-9]{64}$/)
    expect(new Set([issue, pullRequest, page]).size).toBe(3)
    expect(otherKey.githubCoreAlias('issue', RAW_REPOSITORY_ID)).not.toBe(issue)
    expect(JSON.stringify({ issue, pullRequest, page })).not.toContain(RAW_REPOSITORY_ID)
  })

  it('rejects duplicate identities and any colliding batch aliases', () => {
    const aliases = createInstallationAliases(KEY)
    expect(aliases.assignGithubCoreAliases([
      { domain: 'issue', rawProviderId: 'unit-101' },
      { domain: 'pull_request', rawProviderId: 'unit-101' },
      { domain: 'page', rawProviderId: 'page-1' },
    ])).toEqual([
      { domain: 'issue', alias: aliases.githubCoreAlias('issue', 'unit-101') },
      { domain: 'pull_request', alias: aliases.githubCoreAlias('pull_request', 'unit-101') },
      { domain: 'page', alias: aliases.githubCoreAlias('page', 'page-1') },
    ])
    expect(() => aliases.assignGithubCoreAliases([
      { domain: 'issue', rawProviderId: 'unit-101' },
      { domain: 'issue', rawProviderId: 'unit-101' },
    ])).toThrow('INSTALLATION_ALIAS_COLLISION')
  })

  it('retains the exported error type for existing catches', () => {
    try {
      createInstallationAliases(Buffer.alloc(31))
      throw new Error('expected key error')
    } catch (error) {
      expect(error).toBeInstanceOf(InstallationKeyError)
      expect((error as InstallationKeyError).code).toBe('INSTALLATION_KEY_TOO_SHORT')
      expect((error as Error).message).toBe('INSTALLATION_KEY_TOO_SHORT')
    }
  })
})
