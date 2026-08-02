import { describe, expect, it } from 'vitest'
import {
  DEMO_REPOSITORY_NAMES,
  createDemoDataset,
  isCanonicalDemoRepositoryIdentity,
} from './demo.js'

describe('synthetic showcase repository identities', () => {
  it('keeps every generated repository in the canonical invented set', () => {
    const dataset = createDemoDataset('6m')

    expect(dataset.repositories).toHaveLength(DEMO_REPOSITORY_NAMES.length)
    expect(
      dataset.repositories.every((repository) =>
        isCanonicalDemoRepositoryIdentity(repository.nameWithOwner, repository.name),
      ),
    ).toBe(true)
  })

  it('rejects contaminated and mismatched repository labels', () => {
    expect(
      isCanonicalDemoRepositoryIdentity(
        'local/synthetic-repository',
        'PRIVATE_REPOSITORY_SENTINEL',
      ),
    ).toBe(false)
    expect(isCanonicalDemoRepositoryIdentity('local/prism-core', 'signal-garden')).toBe(false)
  })
})
