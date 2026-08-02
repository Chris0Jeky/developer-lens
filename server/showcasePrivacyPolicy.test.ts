import { describe, expect, it } from 'vitest'
import {
  APPROVED_SHOWCASE_REPOSITORY_NAMES,
  isApprovedShowcaseRepositoryIdentity,
} from '../scripts/showcasePrivacyPolicy.js'
import { createDemoDataset } from './demo.js'

describe('independent synthetic showcase repository policy', () => {
  it('matches every generated repository exactly once', () => {
    const dataset = createDemoDataset('6m')
    const generatedNames = dataset.repositories.map((repository) => repository.name)

    expect(new Set(generatedNames).size).toBe(APPROVED_SHOWCASE_REPOSITORY_NAMES.length)
    expect([...generatedNames].sort()).toEqual(
      [...APPROVED_SHOWCASE_REPOSITORY_NAMES].sort(),
    )
    expect(
      dataset.repositories.every((repository) =>
        isApprovedShowcaseRepositoryIdentity(repository.nameWithOwner, repository.name),
      ),
    ).toBe(true)
  })

  it('rejects leaked labels even when the owner identity looks synthetic', () => {
    expect(
      isApprovedShowcaseRepositoryIdentity(
        'local/synthetic-repository',
        'PRIVATE_REPOSITORY_SENTINEL',
      ),
    ).toBe(false)
    expect(
      isApprovedShowcaseRepositoryIdentity(
        'local/prism-core',
        'PRIVATE_REPOSITORY_SENTINEL',
      ),
    ).toBe(false)
    expect(isApprovedShowcaseRepositoryIdentity('local/prism-core', 'signal-garden')).toBe(
      false,
    )
  })
})
