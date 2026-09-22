import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'

const SCANNED_EXTENSIONS = new Set(['.css', '.html', '.svg'])
const TAG_PATTERN = /<([A-Za-z][\w:-]*)(?:\s(?:[^<>"']|"[^"]*"|'[^']*')*?)?>/gu
const ATTRIBUTE_PATTERN = /\s(srcset|src|href|xlink:href|data|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/giu
const STYLE_ATTRIBUTE_PATTERN = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/giu
const SVG_PRESENTATION_ATTRIBUTE_PATTERN = /\s(clip-path|color-profile|cursor|fill|filter|marker(?:-start|-mid|-end)?|mask|stroke)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/giu
const STYLE_BLOCK_PATTERN = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/giu
const CSS_IMPORT_PATTERN = /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^'"\s;)]+))\s*\)?/giu
const CSS_URL_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'"\s)]+))\s*\)/giu
const NETWORK_URL_PATTERN = /^(?:https?:)?\/\/[^\s,)'"<>]+/iu
const MARKUP_CHARACTER_REFERENCE = /&(?:#x([0-9a-f]+)|#([0-9]+)|([a-z][a-z0-9]+));/giu

const NAMED_MARKUP_CHARACTER_REFERENCES: Readonly<Record<string, string>> = Object.freeze({
  amp: '&',
  apos: "'",
  colon: ':',
  gt: '>',
  lt: '<',
  quot: '"',
  sol: '/',
})

const RESOURCE_TAGS: Readonly<Record<string, ReadonlySet<string>>> = {
  src: new Set(['audio', 'embed', 'iframe', 'img', 'input', 'script', 'source', 'track', 'video']),
  srcset: new Set(['img', 'source']),
  href: new Set(['base', 'feimage', 'image', 'link', 'script', 'use']),
  'xlink:href': new Set(['feimage', 'image', 'script', 'use']),
  data: new Set(['object']),
  poster: new Set(['video']),
}

const CSS_ESCAPE_PATTERN = /\\([0-9a-f]{1,6}(?:\r\n|[ \t\n\r\f])?|[\s\S])/giu

/**
 * Decode CSS escape sequences the way browsers resolve them inside stylesheets:
 * 1-6 hex digits plus one optional whitespace terminator (a CRLF pair counts
 * as one, matching CSS input preprocessing), or a literal next character
 * (a line break after the backslash is a continuation and vanishes).
 */
function decodeCssEscapes(value: string): string {
  return value.replace(CSS_ESCAPE_PATTERN, (_escape, body: string) => {
    if (/^[0-9a-f]/i.test(body)) {
      const codePoint = Number.parseInt(body, 16)
      if (codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        return '\uFFFD'
      }
      return String.fromCodePoint(codePoint)
    }
    if (body === '\n' || body === '\r' || body === '\f') return ''
    return body
  })
}

/**
 * WHATWG URL tab/newline stripping plus backslash handling for special schemes
 * and scheme-relative references, applied after markup character-reference
 * decoding. Non-special schemes keep backslashes literal, as browsers do.
 */
function normalizeUrlValue(value: string): string {
  const stripped = decodeMarkupCharacterReferences(value).trim().replace(/[\t\n\r]/gu, '')
  const scheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.exec(stripped)?.[0].toLowerCase()
  if (
    !scheme ||
    scheme === 'http:' ||
    scheme === 'https:' ||
    scheme === 'ws:' ||
    scheme === 'wss:' ||
    scheme === 'ftp:' ||
    scheme === 'file:'
  ) {
    return stripped.replace(/\\/gu, '/')
  }
  return stripped
}

function portablePath(root: string, path: string): string {
  return relative(root, path).split(sep).join('/')
}

function decodeMarkupCharacterReferences(value: string): string {
  return value.replace(
    MARKUP_CHARACTER_REFERENCE,
    (reference, hex: string | undefined, decimal: string | undefined, named: string | undefined) => {
      if (named) return NAMED_MARKUP_CHARACTER_REFERENCES[named.toLowerCase()] ?? reference
      const codePoint = Number.parseInt(hex ?? decimal ?? '', hex ? 16 : 10)
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return reference
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) return reference
      return String.fromCodePoint(codePoint)
    },
  )
}

function networkUrl(value: string): string | null {
  return NETWORK_URL_PATTERN.exec(normalizeUrlValue(value))?.[0] ?? null
}

function firstSrcsetNetworkUrl(value: string): string | null {
  for (const candidate of decodeMarkupCharacterReferences(value).split(',')) {
    const resource = networkUrl(candidate)
    if (resource) return resource
  }
  return null
}

function attributeValue(match: RegExpExecArray, firstCapture: number): string {
  return match[firstCapture] ?? match[firstCapture + 1] ?? match[firstCapture + 2] ?? ''
}

function firstCssUrlNetworkResource(value: string): string | null {
  const decoded = decodeCssEscapes(decodeMarkupCharacterReferences(value))
  CSS_URL_PATTERN.lastIndex = 0
  for (let match = CSS_URL_PATTERN.exec(decoded); match; match = CSS_URL_PATTERN.exec(decoded)) {
    const resource = networkUrl(attributeValue(match, 1))
    if (resource) return resource
  }
  return null
}

function scanCssText(relativePath: string, text: string, violations: string[]): void {
  const importRanges: Array<readonly [number, number]> = []

  CSS_IMPORT_PATTERN.lastIndex = 0
  for (let match = CSS_IMPORT_PATTERN.exec(text); match; match = CSS_IMPORT_PATTERN.exec(text)) {
    importRanges.push([match.index, match.index + match[0].length])
    const resource = networkUrl(attributeValue(match, 1))
    if (resource) violations.push(`${relativePath}: css @import: ${resource}`)
  }

  CSS_URL_PATTERN.lastIndex = 0
  for (let match = CSS_URL_PATTERN.exec(text); match; match = CSS_URL_PATTERN.exec(text)) {
    if (importRanges.some(([start, end]) => match.index >= start && match.index < end)) continue
    const resource = networkUrl(attributeValue(match, 1))
    if (resource) violations.push(`${relativePath}: css url(): ${resource}`)
  }

}

function scanCss(relativePath: string, css: string): string[] {
  const violations: string[] = []
  // Raw and escape-decoded passes are complementary: the raw pass keeps quoted
  // values with escapes intact (an escaped quote stays inside its string, so the
  // URL still matches), while the decoded pass exposes evasions hidden in
  // identifiers and schemes (u\72l(), @\69mport, \68 ttps). Browsers agree with
  // at least one of the two views on every input, so their union cannot miss.
  scanCssText(relativePath, css, violations)
  scanCssText(relativePath, decodeCssEscapes(css), violations)
  return violations
}

function scanMarkup(relativePath: string, markup: string): string[] {
  const violations: string[] = []

  TAG_PATTERN.lastIndex = 0
  for (let tagMatch = TAG_PATTERN.exec(markup); tagMatch; tagMatch = TAG_PATTERN.exec(markup)) {
    const tag = tagMatch[1].toLowerCase()
    const tagSource = tagMatch[0]

    ATTRIBUTE_PATTERN.lastIndex = 0
    for (
      let attributeMatch = ATTRIBUTE_PATTERN.exec(tagSource);
      attributeMatch;
      attributeMatch = ATTRIBUTE_PATTERN.exec(tagSource)
    ) {
      const attribute = attributeMatch[1].toLowerCase()
      if (!RESOURCE_TAGS[attribute]?.has(tag)) continue
      const value = attributeValue(attributeMatch, 2)
      const resource = attribute === 'srcset'
        ? firstSrcsetNetworkUrl(value)
        : networkUrl(value)
      if (resource) violations.push(`${relativePath}: ${tag} ${attribute}: ${resource}`)
    }

    SVG_PRESENTATION_ATTRIBUTE_PATTERN.lastIndex = 0
    for (
      let presentationMatch = SVG_PRESENTATION_ATTRIBUTE_PATTERN.exec(tagSource);
      presentationMatch;
      presentationMatch = SVG_PRESENTATION_ATTRIBUTE_PATTERN.exec(tagSource)
    ) {
      const attribute = presentationMatch[1].toLowerCase()
      const resource = firstCssUrlNetworkResource(attributeValue(presentationMatch, 2))
      if (resource) violations.push(`${relativePath}: ${tag} ${attribute}: ${resource}`)
    }

    STYLE_ATTRIBUTE_PATTERN.lastIndex = 0
    for (
      let styleMatch = STYLE_ATTRIBUTE_PATTERN.exec(tagSource);
      styleMatch;
      styleMatch = STYLE_ATTRIBUTE_PATTERN.exec(tagSource)
    ) {
      violations.push(...scanCss(relativePath, decodeMarkupCharacterReferences(attributeValue(styleMatch, 1))))
    }
  }

  STYLE_BLOCK_PATTERN.lastIndex = 0
  for (let match = STYLE_BLOCK_PATTERN.exec(markup); match; match = STYLE_BLOCK_PATTERN.exec(markup)) {
    violations.push(...scanCss(relativePath, match[1]))
  }

  return violations
}

async function relevantFiles(root: string, directory = root): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await relevantFiles(root, path))
    else if (entry.isFile() && SCANNED_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(path)
  }
  return files
}

/**
 * Reject network-loaded resources from the complete emitted showcase while
 * leaving ordinary navigation links and local, fragment, or data assets alone.
 */
export async function scanDirectoryForExternalResources(root: string): Promise<string[]> {
  const violations: string[] = []
  for (const path of (await relevantFiles(root)).sort()) {
    const relativePath = portablePath(root, path)
    const contents = await readFile(path, 'utf8')
    violations.push(...(
      extname(path).toLowerCase() === '.css'
        ? scanCss(relativePath, contents)
        : scanMarkup(relativePath, contents)
    ))
  }
  return [...new Set(violations)].sort()
}
