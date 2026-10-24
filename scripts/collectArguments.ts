import type { RangeKey } from '../shared/types.js'

export function parseArguments(argv: string[], localRoots = '') {
  const roots: string[] = []
  const ranges = new Set<RangeKey>()
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const equalsIndex = argument.indexOf('=')
    const option = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex)
    if (option !== '--local-root' && option !== '--range') {
      throw new Error('Unknown collection argument.')
    }

    const value = equalsIndex === -1 ? argv[++index] : argument.slice(equalsIndex + 1)
    if (!value?.trim() || value.trimStart().startsWith('-')) {
      throw new Error(`${option} requires a value.`)
    }

    if (option === '--local-root') {
      roots.push(value)
    } else {
      if (value !== '6m' && value !== '12m') {
        throw new Error('--range must be 6m or 12m.')
      }
      ranges.add(value)
    }
  }

  const environmentRoots = localRoots
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
  return {
    roots: [...new Set([...roots, ...environmentRoots])],
    ranges: ranges.size > 0 ? [...ranges] : (['6m', '12m'] as RangeKey[]),
  }
}

