import { parseDocument } from 'yaml'

type UnknownRecord = Record<string, unknown>

const REQUIRED_OBJECT_SUBTREES = [
  'owner_policy',
  'authority_files',
  'model_roles',
  'risk_tiers',
  'queues',
  'review_merge_protocol',
  'cross_repo',
] as const

const REQUIRED_MODEL_ROLES = [
  'coordinator',
  'scout',
  'builder',
  'reviewer',
  'mechanic',
  'governor_lite',
] as const

const REQUIRED_RISK_TIERS = ['W0', 'W1', 'W2', 'W3', 'W4'] as const

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requiredKeys(
  value: UnknownRecord,
  subtree: 'model_roles' | 'risk_tiers',
  keys: readonly string[],
): string[] {
  const nested = value[subtree]
  if (!isRecord(nested)) return []

  return keys
    .filter((key) => !Object.hasOwn(nested, key))
    .map((key) => `governor policy ${subtree} must declare key: ${key}`)
}

/**
 * Parse and validate the stable structural surface of governor.yaml.
 *
 * This deliberately validates policy shape rather than duplicating every
 * low-volatility prose invariant already checked by verifyProjectContext.ts.
 */
export function validateGovernorPolicyYaml(source: string): string[] {
  let root: unknown
  try {
    const document = parseDocument(source, { uniqueKeys: true })
    if (document.errors.length > 0) return ['governor policy is not valid YAML']
    root = document.toJS({ maxAliasCount: 0 })
  } catch {
    return ['governor policy is not valid YAML']
  }

  if (!isRecord(root)) return ['governor policy root must be an object']

  const violations: string[] = []
  if (root['governor_schema_version'] !== 1) {
    violations.push('governor policy governor_schema_version must equal 1')
  }

  for (const subtree of REQUIRED_OBJECT_SUBTREES) {
    if (!isRecord(root[subtree])) {
      violations.push(`governor policy must declare object subtree: ${subtree}`)
    }
  }

  violations.push(...requiredKeys(root, 'model_roles', REQUIRED_MODEL_ROLES))
  violations.push(...requiredKeys(root, 'risk_tiers', REQUIRED_RISK_TIERS))
  return violations
}
