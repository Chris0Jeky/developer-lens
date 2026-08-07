import { createHash } from 'node:crypto'
import { CAPABILITY_REGISTRY } from '../../shared/capabilities.js'
import {
  analyticReferenceId,
  type AnalyticReference,
  type Finding,
} from '../../shared/findings.js'
import type { ChangeBatchIntegrationTailPresentation } from '../../shared/changeBatchIntegrationTail.js'
import type { IntegrationShapeEvidenceResolution } from '../../shared/integrationShapeEvidence.js'
import {
  WhyResolutionSchema,
  whyResolutionAnswersReference,
} from '../../shared/whyContract.js'

export interface StoredObservationEvidenceSnapshot {
  readonly finding: Finding
  readonly references: readonly AnalyticReference[]
  readonly resolutions: Readonly<Record<string, IntegrationShapeEvidenceResolution>>
  readonly resolve: (reference: AnalyticReference) => IntegrationShapeEvidenceResolution
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function unresolvable(reference: AnalyticReference): IntegrationShapeEvidenceResolution {
  return reference.kind === 'claim'
    ? {
        kind: 'unresolvable',
        resolverVersion: '1.0.0',
        reason: 'UNKNOWN_CLAIM',
        claimId: reference.claimId,
        lineage: [],
      }
    : {
        kind: 'missing_link',
        reason: 'MISSING_EVIDENCE',
        targetKind: 'evidence',
        targetId: reference.evidenceId,
        coverageKey: null,
        lineage: [],
      }
}

function parseResolution(
  reference: AnalyticReference,
  candidate: unknown,
): IntegrationShapeEvidenceResolution {
  const parsed = WhyResolutionSchema.parse(candidate)
  if (!whyResolutionAnswersReference(reference, parsed)) {
    throw new Error('STORED_OBSERVATION_EVIDENCE_MISMATCH')
  }
  return parsed
}

/**
 * Build presentation-only evidence walks for an in-memory aggregate finding. The identifiers below
 * are domain-separated presentation surrogates; no job, coverage, snapshot, fact, or path identifier
 * from storage crosses the sink. Exact operational timestamps are represented only as ISO-week labels.
 */
export function buildV3StoredObservationEvidence(
  presentation: ChangeBatchIntegrationTailPresentation,
  finding: Finding,
): StoredObservationEvidenceSnapshot {
  const capability = CAPABILITY_REGISTRY.find((entry) => entry.id === 'github.core')
  if (capability === undefined) throw new Error('STORED_OBSERVATION_CAPABILITY_MISSING')

  const current = presentation.current
  const provenance = presentation.provenance.current
  const presentationJobId = `job-${digest(
    `stored-observation.job.v1\0${presentation.scopeId}\0${current.weekLabels.start}\0${current.weekLabels.end}`,
  )}`
  const observationReference = finding.evidence[0]
  const observationId = observationReference?.kind === 'observation'
    ? observationReference.evidenceId
    : `ev_${digest(`stored-observation.evidence.v1\0${presentation.scopeId}`)}`
  const deletionLineage = presentation.deletionLineage.events.map((event) => ({
    kind: 'lineage_event' as const,
    subjectId: presentation.scopeId,
    eventKind: `${event.eventKind}:${event.subjectKind}:count-${event.count}`,
    causedBy: null,
    occurredAt: event.week,
  }))
  const coverage = {
    kind: 'coverage' as const,
    coverageKey: { rangeStart: current.weekLabels.start, jobId: presentationJobId },
    rangeEnd: current.weekLabels.end,
    status: provenance.coverage.status,
    limitationCode: 'COMPLETE',
    retryable: false,
    expectedUnits: provenance.coverage.expectedUnits,
    observedUnits: provenance.coverage.observedUnits,
    omittedUnits: provenance.coverage.omittedUnits,
    saturationReason: null,
    observedAt: current.weekLabels.end,
    job: {
      kind: 'collection_job' as const,
      jobId: presentationJobId,
      status: provenance.job.status,
      consentRevision: provenance.job.consentRevision,
      capability: {
        kind: 'capability' as const,
        capabilityId: capability.id,
        purposeCode: capability.purposeCode,
        classCeiling: capability.classCeiling,
        requiredGates: [...capability.requiredGates],
        refusalStatus: capability.refusalStatus,
      },
    },
  }
  const evidence = {
    kind: 'evidence' as const,
    evidenceId: observationId,
    layer: 'observed',
    schemaVersion: 'stored-observation.v1',
    coverage,
    lineage: deletionLineage,
  }
  const emptyWalk = (relation: 'supersession' | 'derives_from_ancestry') => ({
    kind: 'walk' as const,
    relation,
    bound: 64,
    steps: [],
    termination: 'terminal' as const,
    missingLinks: [],
  })
  const emptyGroups = [
    { kind: 'edge_group' as const, role: 'contradicts' as const, targetKind: 'evidence' as const, edges: [] },
    { kind: 'edge_group' as const, role: 'contextualizes' as const, targetKind: 'evidence' as const, edges: [] },
    { kind: 'edge_group' as const, role: 'derives_from' as const, targetKind: 'claim' as const, edges: [] },
    { kind: 'edge_group' as const, role: 'limitation_basis' as const, targetKind: 'evidence' as const, edges: [] },
  ]

  const resolutions: Record<string, IntegrationShapeEvidenceResolution> = {}
  const observation = { kind: 'observation' as const, evidenceId: observationId }
  resolutions[observationId] = parseResolution(observation, evidence)
  for (const mark of finding.marks) {
    const reference = mark.reference
    if (reference.kind !== 'claim') continue
    const explanation = {
      kind: 'explanation' as const,
      resolverVersion: '1.0.0' as const,
      bound: 64,
      element: { kind: 'ui_element' as const, elementId: mark.markId },
      claim: {
        kind: 'claim' as const,
        claimId: reference.claimId,
        layer: reference.claimLayer,
        statementCode: finding.statementCode,
        methodId: finding.method.methodId,
        methodVersion: finding.method.methodVersion,
        windowStart: current.weekLabels.start,
        windowEnd: current.weekLabels.end,
        scopeId: presentation.scopeId,
        schemaVersion: finding.schemaVersion,
        createdAt: current.weekLabels.end,
        supersededBy: null,
      },
      scope: {
        kind: 'scope' as const,
        scopeId: presentation.scopeId,
        hasAlias: false,
        linkedAt: 'unknown',
        aliasLink: {
          kind: 'missing_link' as const,
          reason: 'SCOPE_ALIAS_CLEARED' as const,
          targetKind: 'scope' as const,
          targetId: presentation.scopeId,
          coverageKey: null,
          lineage: [],
        },
      },
      edges: [
        {
          kind: 'edge_group' as const,
          role: 'supports' as const,
          targetKind: 'evidence' as const,
          edges: [{ kind: 'edge' as const, role: 'supports' as const, targetRef: observationId, target: evidence }],
        },
        ...emptyGroups,
        {
          kind: 'edge_group' as const,
          role: 'coverage_basis' as const,
          targetKind: 'coverage' as const,
          edges: [{
            kind: 'edge' as const,
            role: 'coverage_basis' as const,
            targetRef: `${current.weekLabels.start}|${presentationJobId}`,
            target: coverage,
          }],
        },
      ],
      limitations: finding.limitations.map((limitation) => ({ kind: 'limitation' as const, ...limitation })),
      lineage: [],
      supersession: emptyWalk('supersession'),
      ancestry: emptyWalk('derives_from_ancestry'),
      unresolvedEdges: [],
    }
    resolutions[reference.claimId] = parseResolution(reference, explanation)
  }

  const references = [
    ...finding.marks.map((mark) => mark.reference),
    ...finding.evidence,
    ...finding.counterEvidence,
  ].filter((reference, index, all) =>
    all.findIndex((candidate) => analyticReferenceId(candidate) === analyticReferenceId(reference)) === index,
  )
  return {
    finding,
    references,
    resolutions,
    resolve(reference) {
      return resolutions[analyticReferenceId(reference)] ?? unresolvable(reference)
    },
  }
}
