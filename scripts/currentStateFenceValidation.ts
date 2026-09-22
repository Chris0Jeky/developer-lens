const ROOT_LEVEL_MARKDOWN_FENCE = /^ {0,3}(?:`{3,}|~{3,})/u
const CANONICAL_OPENER = '```yaml'
const CANONICAL_CLOSER = '```'

interface RootLevelFence {
  readonly line: string
  readonly number: number
}

function rootLevelFences(contents: string): RootLevelFence[] {
  return contents
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => ROOT_LEVEL_MARKDOWN_FENCE.test(line))
}

/**
 * Enforce the tracked CURRENT_STATE.md container contract before YAML parsing.
 *
 * A root-level Markdown fence starts with three or more matching backticks or
 * tildes after zero to three literal spaces. The repository permits exactly
 * one such block, whose opener and closer remain byte-exact and unindented.
 */
export function validateCurrentStateFenceContract(contents: string): string[] {
  const fences = rootLevelFences(contents)
  if (fences.length === 0) {
    return ['line 1: expected exactly one root-level ```yaml fenced block']
  }

  const errors: string[] = []
  const opener = fences.find(({ line }) => line === CANONICAL_OPENER)
  for (const fence of fences) {
    if (fence.line === CANONICAL_OPENER || fence.line === CANONICAL_CLOSER) continue
    errors.push(
      `line ${fence.number}: root-level Markdown fence must be exactly ${CANONICAL_OPENER} or ${CANONICAL_CLOSER} (received ${fence.line})`,
    )
  }

  if (!opener) {
    errors.push('line 1: expected a root-level ```yaml fenced block opener')
  } else {
    const closer = fences.find(
      ({ line, number }) => number > opener.number && line === CANONICAL_CLOSER,
    )
    if (!closer) {
      errors.push(`line ${opener.number}: YAML fenced block is unterminated`)
    }
  }

  if (fences.length !== 2) {
    const diagnosticFence = fences[2] ?? fences.find(
      ({ line }) => line !== CANONICAL_OPENER && line !== CANONICAL_CLOSER,
    ) ?? fences[0]
    errors.push(
      `line ${diagnosticFence.number}: expected exactly one root-level fenced block; found ${fences.length} fence lines`,
    )
  }

  return errors
}
