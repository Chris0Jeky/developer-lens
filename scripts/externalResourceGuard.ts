import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'

const SCANNED_EXTENSIONS = new Set(['.css', '.html', '.svg'])
const TAG_PATTERN = /<([A-Za-z][\w:-]*)(?:\s[^<>]*?)?>/gu
const ATTRIBUTE_PATTERN = /\s(srcset|src|href|xlink:href|data|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/giu
const STYLE_ATTRIBUTE_PATTERN = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/giu
const STYLE_BLOCK_PATTERN = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/giu
const CSS_IMPORT_PATTERN = /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^'"\s;)]+))\s*\)?/giu
const CSS_URL_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'"\s)]+))\s*\)/giu
const NETWORK_URL_PATTERN = /(?:https?:)?\/\/[^\s,)'"<>]+/iu

const RESOURCE_TAGS: Readonly<Record<string, ReadonlySet<string>>> = {
  src: new Set(['audio', 'embed', 'iframe', 'img', 'input', 'script', 'source', 'track', 'video']),
  srcset: new Set(['img', 'source']),
  href: new Set(['base', 'feimage', 'image', 'link', 'script', 'use']),
  'xlink:href': new Set(['feimage', 'image', 'script', 'use']),
  data: new Set(['object']),
  poster: new Set(['video']),
}

function portablePath(root: string, path: string): string {
  return relative(root, path).split(sep).join('/')
}

function firstNetworkUrl(value: string): string | null {
  return NETWORK_URL_PATTERN.exec(value.trim())?.[0] ?? null
}

function attributeValue(match: RegExpExecArray, firstCapture: number): string {
  return match[firstCapture] ?? match[firstCapture + 1] ?? match[firstCapture + 2] ?? ''
}

function scanCss(relativePath: string, css: string): string[] {
  const violations: string[] = []
  const importRanges: Array<readonly [number, number]> = []

  CSS_IMPORT_PATTERN.lastIndex = 0
  for (let match = CSS_IMPORT_PATTERN.exec(css); match; match = CSS_IMPORT_PATTERN.exec(css)) {
    importRanges.push([match.index, match.index + match[0].length])
    const resource = firstNetworkUrl(attributeValue(match, 1))
    if (resource) violations.push(`${relativePath}: css @import: ${resource}`)
  }

  CSS_URL_PATTERN.lastIndex = 0
  for (let match = CSS_URL_PATTERN.exec(css); match; match = CSS_URL_PATTERN.exec(css)) {
    if (importRanges.some(([start, end]) => match.index >= start && match.index < end)) continue
    const resource = firstNetworkUrl(attributeValue(match, 1))
    if (resource) violations.push(`${relativePath}: css url(): ${resource}`)
  }

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
      const resource = firstNetworkUrl(attributeValue(attributeMatch, 2))
      if (resource) violations.push(`${relativePath}: ${tag} ${attribute}: ${resource}`)
    }

    STYLE_ATTRIBUTE_PATTERN.lastIndex = 0
    for (
      let styleMatch = STYLE_ATTRIBUTE_PATTERN.exec(tagSource);
      styleMatch;
      styleMatch = STYLE_ATTRIBUTE_PATTERN.exec(tagSource)
    ) {
      violations.push(...scanCss(relativePath, attributeValue(styleMatch, 1)))
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
