export const APPROVED_SHOWCASE_REPOSITORY_NAMES = Object.freeze([
  'prism-core',
  'signal-garden',
  'orbit-cli',
  'quiet-infra',
  'release-weaver',
  'docs-atlas',
  'relay-api',
  'sandbox-lab',
] as const)

const approvedShowcaseRepositoryNameSet = new Set<string>(
  APPROVED_SHOWCASE_REPOSITORY_NAMES,
)

export function isApprovedShowcaseRepositoryName(repositoryName: string): boolean {
  return approvedShowcaseRepositoryNameSet.has(repositoryName)
}

export function isApprovedShowcaseRepositoryIdentity(
  nameWithOwner: string,
  repositoryName: string,
): boolean {
  return (
    isApprovedShowcaseRepositoryName(repositoryName) &&
    nameWithOwner === `local/${repositoryName}`
  )
}
