async function readDeckJson(path) {
  const response = await fetch(path, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}

async function materializeDeckManifest(indexPath) {
  const index = await readDeckJson(indexPath)
  const prefix = indexPath.slice(0, indexPath.lastIndexOf('/') + 1)
  const parts = await Promise.all(index.parts.map(part => readDeckJson(`${prefix}${part.path}`)))
  const values = []
  for (const [partIndex, part] of parts.entries()) {
    const descriptor = index.parts[partIndex]
    if (part.part !== partIndex + 1 || part.totalParts !== index.parts.length) {
      throw new Error(`${indexPath}: invalid part sequence for ${descriptor.path}`)
    }
    const collection = part[index.collectionKey]
    if (!Array.isArray(collection) || collection.length !== descriptor.count) {
      throw new Error(`${indexPath}: part count mismatch for ${descriptor.path}`)
    }
    values.push(...collection)
  }
  if (values.length !== index.totalCount) throw new Error(`${indexPath}: total count mismatch`)
  return values
}

window.DEVELOPER_LENS_DECK_DATA_READY = (async () => {
  const [rawSnapshot, issues, decisions, queue] = await Promise.all([
    readDeckJson('agent/repository-snapshot.json'),
    materializeDeckManifest('agent/issue-manifest.json'),
    materializeDeckManifest('agent/decision-catalog.json'),
    readDeckJson('agent/work_queue.json'),
  ])

  const snapshot = {
    observedAt: rawSnapshot.observedAt,
    reviewOriginallyGeneratedAt: rawSnapshot.reviewOriginallyGeneratedAt,
    repository: rawSnapshot.repository,
    head: rawSnapshot.mainCommit,
    visibility: rawSnapshot.visibility,
    version: rawSnapshot.version,
    releaseCount: rawSnapshot.releases,
    issueCounts: rawSnapshot.issues,
    pullRequestCounts: rawSnapshot.pullRequests,
    openIssuePortfolio: {
      withoutMilestone: rawSnapshot.issues.openWithoutMilestone,
      withoutLabels: rawSnapshot.issues.openWithoutLabels,
    },
    pairedLab: rawSnapshot.pairedLab,
    releaseBlocker: rawSnapshot.releaseBlocker,
  }

  window.DEVELOPER_LENS_DECK_DATA = {
    snapshot,
    issues,
    decisions,
    workQueue: queue.tasks,
  }
  return window.DEVELOPER_LENS_DECK_DATA
})()
