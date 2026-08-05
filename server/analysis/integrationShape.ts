import {
  buildIntegrationShapeAbstentionFinding,
  buildIntegrationShapeFinding,
  buildIntegrationShapePresentation,
  compositionConformsToGolden,
  INTEGRATION_SHAPE_SCOPE_ALIAS,
  type IntegrationShapePresentation,
} from '../../shared/integrationShape.js'
import {
  assertRenderableFinding,
  buildFindingReferenceWalk,
  validateFinding,
  type Finding,
  type FindingReferenceWalkEntry,
} from '../../shared/findings.js'
import {
  INTEGRATION_SHAPE_REFERENCES,
  resolveIntegrationShapeEvidence,
  type IntegrationShapeEvidenceResolution,
} from '../../shared/integrationShapeEvidence.js'
import type { AnalyticReference } from '../../shared/findings.js'

/**
 * DL-VALUE-01 — the server-side composition. This module owns the ONE path from invented facts to a
 * rendered finding: it runs the shared, client-safe composition through `validateFinding` and
 * `assertRenderableFinding` (the only contract-blessed path to render), so the copy the Atlas panel
 * shows is proven contract-valid at module load. If any of it is invalid — a causal word slipped
 * into the observation, a mark resolving to the wrong layer, coverage citing a dimension the metric
 * does not consume — importing this module throws, which fails the server and the tests loudly.
 *
 * The composition itself lives in `shared/integrationShape.ts` (client-safe, no `node:crypto`); this
 * module is the server half that may import `shared/findings.ts` and therefore the validators.
 */
export const INTEGRATION_SHAPE_ANALYSIS_VERSION = '1.0.0' as const

/** The validated, renderable primary finding. Fails closed at load if the contract rejects it. */
export const INTEGRATION_SHAPE_FINDING: Finding = assertRenderableFinding(buildIntegrationShapeFinding(), 'atlas').finding

/** The validated abstention finding for the low-support variant. */
export const INTEGRATION_SHAPE_ABSTENTION_FINDING: Finding = assertRenderableFinding(
  buildIntegrationShapeAbstentionFinding(),
  'atlas',
).finding

/** The full reference walk behind the primary finding (result provenance → marks → evidence). */
export const INTEGRATION_SHAPE_WALK: readonly FindingReferenceWalkEntry[] = buildFindingReferenceWalk(INTEGRATION_SHAPE_FINDING)

export function composeIntegrationShapePresentation(): IntegrationShapePresentation {
  // Re-validate on every call so a caller that mutates the shared constants is caught, not trusted.
  validateFinding(buildIntegrationShapeFinding())
  validateFinding(buildIntegrationShapeAbstentionFinding())
  return buildIntegrationShapePresentation()
}

export function integrationShapeConformsToGolden(): boolean {
  return compositionConformsToGolden()
}

/* ------------------------------------------------------------------------------------------ *
 * Presentation-safety guard (#79 / #86). Every byte served to a client must be a presentation
 * projection: never the C2 scope alias, and never a `coverage_id` that carries the alias verbatim.
 * ------------------------------------------------------------------------------------------ */

export class PresentationLeakError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PresentationLeakError'
  }
}

const LEAKED_KEYS = ['coverageId', 'coverage_id'] as const

/**
 * Throws if a value about to be served carries the installation alias VALUE, or transports a
 * `coverage_id` field at all. The field stays banned from this boundary after #86 made the
 * connector's coverage key content-free (`cov-` plus 64 lowercase hex): a storage identifier is
 * not presentation material even once it stops embedding the alias, and older stores can still
 * hold the alias-bearing `github.core:${scopeAlias}:${rangeEnd}` form this canary was written
 * for. The projection names coverage rows by `(rangeStart, jobId)` instead, so a clean projection
 * has neither.
 */
export function assertPresentationSafe(value: unknown, label: string): void {
  const serialized = JSON.stringify(value)
  if (serialized.includes(INTEGRATION_SHAPE_SCOPE_ALIAS)) {
    throw new PresentationLeakError(`${label} transports the C2 scope alias value; only the content-free scope_id surrogate may cross the boundary`)
  }
  for (const key of LEAKED_KEYS) {
    if (serialized.includes(`"${key}"`)) {
      throw new PresentationLeakError(`${label} transports a ${key} field; a coverage row is named by (rangeStart, jobId), never a coverage_id that carries the alias (#86)`)
    }
  }
}

/** Resolve one reference to its evidence-walk projection, proven presentation-safe before returning. */
export function resolveIntegrationShapeEvidenceSafe(reference: AnalyticReference): IntegrationShapeEvidenceResolution {
  const projection = resolveIntegrationShapeEvidence(reference)
  assertPresentationSafe(projection, `evidence projection for ${reference.kind}`)
  return projection
}

export { INTEGRATION_SHAPE_REFERENCES }
