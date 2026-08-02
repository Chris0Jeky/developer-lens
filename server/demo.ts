import { addDays, formatISO, subMonths } from 'date-fns'
import type { RangeKey, RawDataset } from '../shared/types.js'
import { classifyCommit } from './github.js'

function seeded(index: number): number {
  const value = Math.sin(index * 9187.13) * 43758.5453
  return value - Math.floor(value)
}

export function createDemoDataset(range: RangeKey): RawDataset {
  const months = range === '6m' ? 6 : 12
  const toDate = new Date()
  const fromDate = subMonths(toDate, months)
  const from = formatISO(fromDate)
  const to = formatISO(toDate)
  const contributionCalendar: Array<{ date: string; count: number }> = []
  const commitDaysByRepository: RawDataset['commitDaysByRepository'] = []
  const repos = ['prism-core', 'signal-garden', 'orbit-cli', 'quiet-infra']
  const commits: RawDataset['commits'] = []
  const totalDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000)
  let contributionTotal = 0

  for (let index = 0; index <= totalDays; index += 1) {
    const date = addDays(fromDate, index)
    const weekday = date.getDay()
    const wave = Math.sin(index / 19) * 0.9 + Math.sin(index / 47) * 0.7
    const active = weekday !== 0 && seeded(index) + wave * 0.1 > 0.46
    const count = active ? 1 + Math.floor(seeded(index + 99) * 7) : 0
    const dateString = formatISO(date, { representation: 'date' })
    contributionCalendar.push({ date: dateString, count })
    contributionTotal += count
    if (count === 0) continue
    const repo = repos[Math.floor(seeded(index + 31) * repos.length)]
    const commitCount = Math.max(1, Math.floor(count * 0.68))
    commitDaysByRepository.push({
      repository: `local/${repo}`,
      date: dateString,
      count: commitCount,
    })
    for (let commitIndex = 0; commitIndex < commitCount; commitIndex += 1) {
      const messages = [
        'feat: compose the next signal layer',
        'fix: guard the refresh boundary',
        'test: prove the replay path',
        'docs: map the operational model',
        'refactor: clarify the event pipeline',
        'chore: align release configuration',
      ]
      const message = messages[(index + commitIndex) % messages.length]
      commits.push({
        sha: `demo-${index}-${commitIndex}`,
        repository: `local/${repo}`,
        occurredAt: `${dateString}T12:00:00Z`,
        source: 'github',
        features: classifyCommit(message),
      })
    }
  }

  const pullRequests = Array.from({ length: range === '6m' ? 24 : 47 }, (_, index) => {
    const created = addDays(fromDate, Math.floor((index / 47) * totalDays))
    const merged = addDays(created, 1 + Math.floor(seeded(index + 17) * 8))
    const repository = `local/${repos[index % repos.length]}`
    return {
      id: `demo-pr-${index}`,
      repository,
      number: 100 + index,
      title: [
        'Shape the signal pipeline',
        'Close the replay gap',
        'Refine private data boundaries',
        'Make the release path observable',
      ][index % 4],
      url: '#',
      createdAt: formatISO(created),
      mergedAt: index % 8 === 0 ? undefined : formatISO(merged),
      state: index % 8 === 0 ? 'OPEN' : 'MERGED',
      isDraft: false,
      additions: 80 + Math.floor(seeded(index) * 680),
      deletions: 20 + Math.floor(seeded(index + 4) * 240),
      changedFiles: 2 + Math.floor(seeded(index + 8) * 18),
      comments: Math.floor(seeded(index + 2) * 7),
      reviews: 1 + Math.floor(seeded(index + 3) * 4),
    }
  })

  const reviews = Array.from({ length: range === '6m' ? 38 : 72 }, (_, index) => ({
    id: `demo-review-${index}`,
    repository: `local/${repos[(index + 1) % repos.length]}`,
    occurredAt: formatISO(addDays(fromDate, Math.floor((index / 72) * totalDays))),
  }))

  return {
    schemaVersion: 1,
    range,
    from,
    to,
    collectedAt: new Date().toISOString(),
    subject: {
      login: 'demo-builder',
      name: 'Your development story',
    },
    contributionCalendar,
    contributionTotal,
    restrictedContributions: 0,
    repositories: repos.map((name, index) => ({
      id: `demo-repo-${index}`,
      nameWithOwner: `local/${name}`,
      name,
      description: [
        'A systems-focused foundation for trustworthy workflows.',
        'Experimental tooling for patterns, evidence, and reflection.',
        'A fast local command line for repeatable operations.',
        'The maintenance layer that makes everything else possible.',
      ][index],
      isPrivate: index % 3 === 0,
      isArchived: false,
      isFork: false,
      primaryLanguage: {
        name: ['TypeScript', 'Python', 'Rust', 'PowerShell'][index],
        color: ['#6ea8fe', '#55b4d4', '#f2845c', '#61a7ef'][index],
      },
      languages: [
        {
          name: ['TypeScript', 'Python', 'Rust', 'PowerShell'][index],
          color: ['#6ea8fe', '#55b4d4', '#f2845c', '#61a7ef'][index],
          size: 80,
        },
        { name: 'Shell', color: '#7de5ac', size: 20 },
      ],
      topics: [['agents', 'systems'], ['research', 'data'], ['cli', 'devtools'], ['reliability']][
        index
      ],
    })),
    commits,
    commitDaysByRepository,
    pullRequests,
    reviews,
    issues: Array.from({ length: range === '6m' ? 11 : 21 }, (_, index) => ({
      id: `demo-issue-${index}`,
      repository: `local/${repos[index % repos.length]}`,
      occurredAt: formatISO(addDays(fromDate, Math.floor((index / 21) * totalDays))),
    })),
    coverage: [
      {
        id: 'demo',
        label: 'Illustrative data',
        status: 'complete',
        detail: 'Synthetic activity used until a private local collection is generated.',
        itemCount: contributionTotal,
      },
      {
        id: 'local-git',
        label: 'Local Git enrichment',
        status: 'unavailable',
        detail: 'Demo mode does not inspect the filesystem.',
      },
    ],
    warnings: ['This is illustrative data. Run npm run collect to reveal your own development story.'],
  }
}
