/**
 * Canonical task identifiers name one confined `.developer-lens/activation/<taskId>` subtree.
 * This predicate deliberately validates only; callers must never normalize a supplied ID.
 */
export const CANONICAL_TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

export function isCanonicalTaskId(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_TASK_ID_PATTERN.test(value)
}
