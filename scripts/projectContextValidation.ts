import { dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path'

export type LinkResolution =
  | { kind: 'skip' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'local'; target: string }

export interface SkillFrontmatter {
  name: string
  description: string
}

const markdownLinkPattern =
  /!?\[(?:[^\]\r\n]|\r?\n(?!\r?\n))*\]\(\s*(?:<([^>\r\n]+)>|([^\s)\r\n]+))(?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'|\([^\r\n)]*\)))?\s*\)/g

export function extractMarkdownLinkTargets(contents: string): string[] {
  return [...contents.matchAll(markdownLinkPattern)].map((match) => match[1] ?? match[2] ?? '')
}

export function resolveRepositoryLinkTarget(
  root: string,
  sourcePath: string,
  rawTarget: string,
): LinkResolution {
  if (rawTarget.startsWith('#')) {
    return { kind: 'skip' }
  }

  const rawPathTarget = rawTarget.split('#', 1)[0]
  if (!rawPathTarget) {
    return { kind: 'skip' }
  }

  let decodedTarget: string
  try {
    decodedTarget = decodeURIComponent(rawPathTarget)
  } catch {
    return { kind: 'invalid', reason: `invalid URL encoding: ${rawPathTarget}` }
  }

  if (isAbsolute(decodedTarget) || win32.isAbsolute(decodedTarget)) {
    return { kind: 'invalid', reason: `absolute local path: ${rawTarget}` }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(decodedTarget)) {
    return { kind: 'skip' }
  }

  const target = resolve(root, dirname(sourcePath), decodedTarget)
  const rootRelativeTarget = relative(root, target)
  if (
    rootRelativeTarget === '..' ||
    rootRelativeTarget.startsWith(`..${sep}`) ||
    isAbsolute(rootRelativeTarget)
  ) {
    return { kind: 'invalid', reason: `target escapes repository root: ${rawTarget}` }
  }

  return { kind: 'local', target }
}

function parseScalar(value: string): { value?: string; error?: string } {
  if (value.startsWith('"')) {
    if (!value.endsWith('"')) {
      return { error: `unterminated quoted scalar: ${value}` }
    }
    try {
      return { value: JSON.parse(value) as string }
    } catch {
      return { error: `invalid double-quoted scalar: ${value}` }
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'")) {
      return { error: `unterminated quoted scalar: ${value}` }
    }
    return { value: value.slice(1, -1).replaceAll("''", "'") }
  }
  if (value.includes(': ') || value.includes(' #')) {
    return { error: `unsupported plain scalar: ${value}` }
  }
  if (
    value.startsWith('[') ||
    value.startsWith('{') ||
    /^[&*!|>@`#]/.test(value) ||
    /^-\s/.test(value) ||
    /^(?:~|null|true|false|yes|no|on|off|[-+]?\.(?:inf|nan))$/i.test(value) ||
    /^[+-]?(?:0[xob][0-9a-f_]+|[0-9][0-9_]*(?:\.[0-9_]*)?(?:e[+-]?[0-9]+)?|\.[0-9_]+(?:e[+-]?[0-9]+)?)$/i.test(value) ||
    /^\d{4}-\d{1,2}-\d{1,2}(?:$|[Tt]\d| \d)/i.test(value) ||
    /^\?\s/.test(value)
  ) {
    return { error: `plain scalar must remain a string: ${value}` }
  }
  return { value }
}

export function parseSkillFrontmatter(contents: string):
  | { value: SkillFrontmatter; errors: [] }
  | { value?: undefined; errors: string[] } {
  const normalized = contents.replaceAll('\r\n', '\n')
  if (!normalized.startsWith('---\n')) {
    return { errors: ['frontmatter must start with ---'] }
  }

  const closingDelimiter = normalized.indexOf('\n---\n', 4)
  if (closingDelimiter === -1) {
    return { errors: ['frontmatter must have a closing --- delimiter'] }
  }

  const fields = new Map<string, string>()
  const errors: string[] = []
  for (const line of normalized.slice(4, closingDelimiter).split('\n')) {
    if (line.trim() === '') {
      continue
    }
    const match = /^([a-z][a-z0-9_-]*):\s+(.+)$/i.exec(line)
    if (!match) {
      errors.push(`unsupported frontmatter syntax: ${line}`)
      continue
    }
    const [, key = '', rawValue = ''] = match
    if (!['name', 'description'].includes(key)) {
      errors.push(`unsupported frontmatter key: ${key}`)
      continue
    }
    if (fields.has(key)) {
      errors.push(`duplicate frontmatter key: ${key}`)
      continue
    }
    const parsedValue = parseScalar(rawValue.trim())
    if (parsedValue.error || parsedValue.value === undefined) {
      errors.push(parsedValue.error ?? `invalid frontmatter value for ${key}`)
      continue
    }
    fields.set(key, parsedValue.value)
  }

  const name = fields.get('name')
  const description = fields.get('description')
  if (name !== 'developer-lens-continuation') {
    errors.push('frontmatter name must be developer-lens-continuation')
  }
  if (!description) {
    errors.push('frontmatter description must be non-empty')
  }

  if (errors.length > 0 || !name || !description) {
    return { errors }
  }
  return { value: { name, description }, errors: [] }
}

function valueAtPath(value: unknown, path: readonly string[]): unknown {
  let current = value
  for (const segment of path) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

export function validateTierDeclaration(value: unknown): string[] {
  const expectedValues: ReadonlyArray<readonly [readonly string[], unknown]> = [
    [['tier'], 2],
    [['name'], 'daily-driver'],
    [['authority', 'push'], 'free'],
    [['authority', 'merge'], 'free'],
    [['public_synthetic_publication', 'remote'], 'origin'],
    [['public_synthetic_publication', 'repository'], 'Chris0Jeky/developer-lens'],
    [['flags', 'sensitive_data'], true],
    [['flags', 'wave_mode'], false],
    [['flags', 'dormant_production'], false],
    [['flags', 'relaxed_work_loss_guards'], false],
    [['human_todo'], 'HUMAN_TODO.md'],
  ]

  return expectedValues.flatMap(([path, expected]) => {
    const actual = valueAtPath(value, path)
    return actual === expected
      ? []
      : [`${path.join('.')} must be ${JSON.stringify(expected)} (received ${JSON.stringify(actual)})`]
  })
}
