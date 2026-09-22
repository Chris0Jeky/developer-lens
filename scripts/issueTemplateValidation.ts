import { parseDocument } from 'yaml'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseYaml(source: string, invalidMessage: string): { value?: unknown; violations: string[] } {
  try {
    const document = parseDocument(source, { uniqueKeys: true })
    if (document.errors.length > 0) return { violations: [invalidMessage] }
    return { value: document.toJS({ maxAliasCount: 0 }), violations: [] }
  } catch {
    return { violations: [invalidMessage] }
  }
}

/** Validate the fail-closed GitHub issue-template chooser configuration. */
export function validateIssueTemplateConfig(source: string): string[] {
  const parsed = parseYaml(source, 'issue-template config is not valid YAML')
  if (parsed.violations.length > 0) return parsed.violations
  if (!isRecord(parsed.value)) return ['issue-template config must be an object']

  const violations: string[] = []
  if (parsed.value['blank_issues_enabled'] !== false) {
    violations.push('issue-template config must keep blank_issues_enabled false')
  }

  const contactLinks = parsed.value['contact_links']
  if (!Array.isArray(contactLinks)) {
    violations.push('issue-template config must declare contact_links as an array')
    return violations
  }

  for (const [index, contactLink] of contactLinks.entries()) {
    const position = index + 1
    if (!isRecord(contactLink)) {
      violations.push(`issue-template contact link ${position} must be an object`)
      continue
    }
    for (const field of ['name', 'url', 'about'] as const) {
      if (!nonEmptyString(contactLink[field])) {
        violations.push(
          `issue-template contact link ${position} must declare non-empty ${field}`,
        )
      }
    }
  }

  return violations
}

function frontmatterSource(path: string, source: string): { body?: string; violations: string[] } {
  const lines = source.replaceAll('\r\n', '\n').split('\n')
  if (lines[0] !== '---') {
    return { violations: [`${path} must start with YAML frontmatter`] }
  }
  const closing = lines.indexOf('---', 1)
  if (closing < 0) {
    return { violations: [`${path} YAML frontmatter is not closed`] }
  }
  return { body: lines.slice(1, closing).join('\n'), violations: [] }
}

function declaredLabels(value: unknown): string[] | null {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean)
  }
  if (Array.isArray(value) && value.every((label) => typeof label === 'string')) {
    return value.map((label) => label.trim()).filter(Boolean)
  }
  return null
}

/** Validate one legacy Markdown issue template and, when supplied, its live label references. */
export function validateIssueTemplateFrontmatter(
  path: string,
  source: string,
  knownLabels?: ReadonlySet<string>,
): string[] {
  const extracted = frontmatterSource(path, source)
  if (extracted.body === undefined) return extracted.violations
  if (extracted.body.trim().length === 0) {
    return [...extracted.violations, `${path} YAML frontmatter must not be empty`]
  }

  const parsed = parseYaml(extracted.body, `${path} frontmatter is not valid YAML`)
  if (parsed.violations.length > 0) return parsed.violations
  if (!isRecord(parsed.value)) return [`${path} frontmatter must be an object`]

  const violations: string[] = []
  for (const field of ['name', 'about'] as const) {
    if (!nonEmptyString(parsed.value[field])) {
      violations.push(`${path} frontmatter must declare non-empty ${field}`)
    }
  }
  for (const field of ['title', 'assignees'] as const) {
    if (typeof parsed.value[field] !== 'string') {
      violations.push(`${path} frontmatter must declare string ${field}`)
    }
  }

  const labels = declaredLabels(parsed.value['labels'])
  if (labels === null) {
    violations.push(`${path} frontmatter labels must be a string or string array`)
    return violations
  }
  if (new Set(labels).size !== labels.length) {
    violations.push(`${path} frontmatter must not repeat a label`)
  }
  if (knownLabels) {
    for (const label of labels) {
      if (!knownLabels.has(label)) {
        violations.push(`${path} references missing repository label: ${label}`)
      }
    }
  }

  return violations
}
