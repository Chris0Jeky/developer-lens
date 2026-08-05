import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { isoWeekLabel, omittedLabel } from '../lib/coverageCockpit'
import { MISSING_LINK_COPY, UNRESOLVABLE_COPY } from './evidenceDrawerCopy'
import type {
  WhyCapabilityNode,
  WhyClaimNode,
  WhyClaimReferenceNode,
  WhyCollectionJobNode,
  WhyCoverageNode,
  WhyEdge,
  WhyEdgeGroup,
  WhyEvidenceNode,
  WhyExplanationTree,
  WhyLimitation,
  WhyLineageEvent,
  WhyMissingLink,
  WhyScopeNode,
  WhyUnresolvable,
  WhyWalk,
  WhyWalkStep,
} from '../../server/storage/whyResolver.js'
import type { AnalyticReference } from '../../shared/findings.js'

/**
 * Evidence Drawer — the universal claim inspector (card DL-UX-ED).
 *
 * It answers "why am I seeing this number, what contradicts it, and what limits it?" by
 * rendering the SPINE-03 walk that `server/storage/whyResolver.ts` produces: claim header,
 * the six edge groups, scope, limitations, correction/tombstone lineage, the supersession
 * and derives-from walks, and the falsifying question. It is the RENDER half of that module;
 * the resolver owns the data and this component owns bounded, honest presentation.
 *
 * Server-code discipline (mandatory): every import from `whyResolver.js` is `import type`.
 * That module type-imports `better-sqlite3`, so a runtime import would drag a native binding
 * into the showcase bundle; here the types are erased at build and runtime data arrives only
 * through the `resolve` prop. Two AUTOMATED nets hold this — not a manual scan:
 * 1. `tsc -b` under `verbatimModuleSyntax` (tsconfig.app.json): turning any of these into a
 *    value import of server code is a compile error, because a name used only as a type cannot
 *    be value-imported — so the native module can never even reach the bundler.
 * 2. `scripts/verifyShowcase.ts` (run by `npm run build:showcase`) fails the build if a
 *    native-dependency marker (`better-sqlite3`, `better_sqlite3`, `duckdb`, `node-gyp`) appears
 *    in any emitted `dist` asset — the backstop for anything that slips past net 1.
 *
 * Two house rules inherited from the Coverage Cockpit and the resolver contract:
 * - Absence is furniture, never silence or a numeric zero: every empty edge group states the
 *   fact ("No contradicting evidence recorded"), and every missing/tombstoned link renders a
 *   distinct honest message rather than a blank.
 * - Operational timestamps render at ISO-week grain or coarser (ADR-01 grain rule). The
 *   resolver deliberately exposes raw millisecond timestamps and hands the grain floor to this
 *   layer, so every rendered instant goes through `isoWeekLabel`.
 */

/**
 * The reference the drawer accepts. RECONCILED (issue #87): this now IS `shared/findings.ts`'s
 * `AnalyticReference = ObservationReference | ClaimReference` — same field names, same discriminant
 * — re-exported type-only so the findings/claims value graph (and its `node:crypto` import) never
 * reaches the browser bundle. Raw allowed facts are addressed by an observation/evidence id;
 * derived numbers (counts, ratios, quantiles, deltas) are claims addressed by a claim id. The
 * shared `ClaimReference` carries `claimLayer`, so a reference records the layer of the claim it
 * resolves to (the #87 post-merge triage item), decidable from the finding alone.
 */
export type {
  AnalyticReference,
  ClaimReference,
  ObservationReference,
} from '../../shared/findings.js'

/**
 * What `resolve` returns, reusing the resolver's own node types so a `WhyEvidenceNode` renders
 * identically whether it hangs off a claim edge or is the top-level anchor for an observation
 * reference. The four members carry distinct `kind` discriminants
 * (`explanation | unresolvable | evidence | missing_link`), so one switch covers every case:
 * - a claim reference resolves to a full `WhyExplanationTree` or a `WhyUnresolvable`;
 * - an observation reference resolves to its `WhyEvidenceNode` anchor, or a `WhyMissingLink`
 *   when that evidence is absent or tombstoned.
 *
 * At this stage there is no live endpoint: `resolve` is a pure callback over typed fixtures.
 * DL-VALUE-01 wires it to the minimal V2 evidence endpoint. The component never fetches.
 */
export type EvidenceResolution =
  | WhyExplanationTree
  | WhyUnresolvable
  | WhyEvidenceNode
  | WhyMissingLink

export interface EvidenceDrawerProps {
  readonly open: boolean
  readonly reference: AnalyticReference
  readonly resolve: (reference: AnalyticReference) => EvidenceResolution
  readonly onClose: () => void
  /**
   * The falsifying/discriminating question. The resolver does not carry it — it belongs to the
   * finding layer (DL-FINDING-01), so it arrives as a prop and is fixture-driven for now.
   */
  readonly discriminatingQuestion?: string | null
  /** Initial visible depth for the bounded transitive walks. Small on purpose. */
  readonly initialWalkSteps?: number
}

const DEFAULT_INITIAL_WALK_STEPS = 5

/** The six edge-group roles: a label and the fact to state when the group is empty. */
const EDGE_ROLE_COPY: Readonly<
  Record<WhyEdgeGroup['role'], { readonly label: string; readonly empty: string }>
> = {
  supports: { label: 'Supports', empty: 'No supporting evidence recorded.' },
  contradicts: { label: 'Contradicts', empty: 'No contradicting evidence recorded.' },
  contextualizes: { label: 'Contextualizes', empty: 'No contextualizing evidence recorded.' },
  derives_from: { label: 'Derives from', empty: 'This claim derives from no prior claim.' },
  coverage_basis: { label: 'Coverage basis', empty: 'No coverage basis recorded.' },
  limitation_basis: { label: 'Limitation basis', empty: 'No limitation basis recorded.' },
}

const WALK_COPY: Readonly<Record<WhyWalk['relation'], { readonly label: string; readonly empty: string }>> = {
  supersession: {
    label: 'Supersession',
    empty: 'This claim is the head of its series; nothing supersedes it.',
  },
  derives_from_ancestry: {
    label: 'Derivation ancestry',
    empty: 'This claim rests on no earlier claim.',
  },
}

/** DOM elements the focus trap treats as tab stops. Collapsed content is absent, so excluded. */
function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  const selector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return [...root.querySelectorAll<HTMLElement>(selector)]
}

/** A labelled fact row. Never renders a bare number as absence — callers pass furniture text. */
function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="evidence-drawer__fact">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** A collapsed-by-default disclosure. Bounds the tree: deeper chain is out of the DOM until asked. */
function Expandable({
  summary,
  children,
  testId,
}: {
  summary: ReactNode
  children: ReactNode
  testId?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="evidence-drawer__expandable" data-testid={testId}>
      <button
        type="button"
        className="evidence-drawer__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {summary}
      </button>
      {open && <div className="evidence-drawer__expandable-body">{children}</div>}
    </div>
  )
}

function LayerBadge({ layer }: { layer: string }) {
  return (
    <span className="evidence-drawer__layer" data-layer={layer}>
      {layer}
    </span>
  )
}

function LineageList({ lineage }: { lineage: readonly WhyLineageEvent[] }) {
  if (lineage.length === 0) {
    return <p className="evidence-drawer__furniture">No correction or tombstone lineage recorded.</p>
  }
  return (
    <ul className="evidence-drawer__lineage" aria-label="Lineage events">
      {lineage.map((event, index) => (
        <li key={`${event.subjectId}:${event.occurredAt}:${event.eventKind}:${index}`} data-event-kind={event.eventKind}>
          <strong>{event.eventKind}</strong> · {isoWeekLabel(event.occurredAt)}
          {event.causedBy !== null && (
            <>
              {' '}
              · caused by <code>{event.causedBy}</code>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

function MissingLinkView({ link }: { link: WhyMissingLink }) {
  return (
    <div className="evidence-drawer__missing" data-missing-reason={link.reason}>
      <p className="evidence-drawer__missing-copy">{MISSING_LINK_COPY[link.reason]}</p>
      <dl className="evidence-drawer__facts">
        <Fact term="Missing">{link.targetKind}</Fact>
        {link.targetId !== null && (
          <Fact term="Reference">
            <code>{link.targetId}</code>
          </Fact>
        )}
        {link.coverageKey !== null && (
          <Fact term="Coverage">
            <code>
              {isoWeekLabel(link.coverageKey.rangeStart)} · job {link.coverageKey.jobId}
            </code>
          </Fact>
        )}
      </dl>
      {link.lineage.length > 0 && <LineageList lineage={link.lineage} />}
    </div>
  )
}

function CapabilityView({ node }: { node: WhyCapabilityNode | WhyMissingLink }) {
  if (node.kind === 'missing_link') return <MissingLinkView link={node} />
  return (
    <dl className="evidence-drawer__facts" data-node="capability">
      <Fact term="Capability">
        <code>{node.capabilityId}</code>
      </Fact>
      <Fact term="Purpose">{node.purposeCode}</Fact>
      <Fact term="Class ceiling">{node.classCeiling}</Fact>
      <Fact term="Required gates">
        {node.requiredGates.length === 0 ? 'none required' : node.requiredGates.join(', ')}
      </Fact>
      <Fact term="Refusal state">{node.refusalStatus}</Fact>
    </dl>
  )
}

function CollectionJobView({ node }: { node: WhyCollectionJobNode | WhyMissingLink }) {
  if (node.kind === 'missing_link') return <MissingLinkView link={node} />
  return (
    <div data-node="collection_job">
      <dl className="evidence-drawer__facts">
        <Fact term="Job">
          <code>{node.jobId}</code>
        </Fact>
        <Fact term="Status">{node.status}</Fact>
        <Fact term="Consent revision">{node.consentRevision}</Fact>
      </dl>
      <Expandable summary="Capability & consent terms" testId="expand-capability">
        <CapabilityView node={node.capability} />
      </Expandable>
    </div>
  )
}

function CoverageView({ node }: { node: WhyCoverageNode | WhyMissingLink }) {
  if (node.kind === 'missing_link') return <MissingLinkView link={node} />
  return (
    <div data-node="coverage">
      <dl className="evidence-drawer__facts">
        <Fact term="Coverage">
          <code>
            {isoWeekLabel(node.coverageKey.rangeStart)} · job {node.coverageKey.jobId}
          </code>
        </Fact>
        <Fact term="Status">{node.status}</Fact>
        <Fact term="Limitation">{node.limitationCode}</Fact>
        <Fact term="Range end">{isoWeekLabel(node.rangeEnd)}</Fact>
        <Fact term="Observed">{isoWeekLabel(node.observedAt)}</Fact>
        <Fact term="Observed units">{node.observedUnits.toLocaleString('en-GB')}</Fact>
        <Fact term="Expected units">
          {node.expectedUnits === null ? 'not declared' : node.expectedUnits.toLocaleString('en-GB')}
        </Fact>
        <Fact term="Omitted units">{omittedLabel(node.omittedUnits)}</Fact>
        <Fact term="Retryable">{node.retryable ? 'yes' : 'no'}</Fact>
        {node.saturationReason !== null && <Fact term="Saturation">{node.saturationReason}</Fact>}
      </dl>
      <Expandable summary="Collection job & consent revision" testId="expand-job">
        <CollectionJobView node={node.job} />
      </Expandable>
    </div>
  )
}

function EvidenceView({ node, defaultAnchor = false }: { node: WhyEvidenceNode; defaultAnchor?: boolean }) {
  return (
    <div data-node="evidence">
      <dl className="evidence-drawer__facts">
        <Fact term="Evidence">
          <code>{node.evidenceId}</code>
        </Fact>
        <Fact term="Layer">
          <LayerBadge layer={node.layer} />
        </Fact>
        <Fact term="Schema">{node.schemaVersion}</Fact>
      </dl>
      {node.lineage.length > 0 && <LineageList lineage={node.lineage} />}
      {defaultAnchor ? (
        <div className="evidence-drawer__anchor-chain">
          <h4>Coverage & consent</h4>
          <CoverageView node={node.coverage} />
        </div>
      ) : (
        <Expandable summary="Coverage, job & consent chain" testId="expand-coverage">
          <CoverageView node={node.coverage} />
        </Expandable>
      )}
    </div>
  )
}

function ClaimReferenceView({ node }: { node: WhyClaimReferenceNode }) {
  return (
    <dl className="evidence-drawer__facts" data-node="claim_reference">
      <Fact term="Claim">
        <code>{node.claimId}</code>
      </Fact>
      <Fact term="Statement">{node.statementCode}</Fact>
      <Fact term="Layer">
        <LayerBadge layer={node.layer} />
      </Fact>
      <Fact term="Method">
        {node.methodId}@{node.methodVersion}
      </Fact>
      <Fact term="Window">
        {isoWeekLabel(node.windowStart)} → {isoWeekLabel(node.windowEnd)}
      </Fact>
      <Fact term="Trace">Open this claim in the drawer to walk its own evidence.</Fact>
    </dl>
  )
}

function EdgeTargetView({ edge }: { edge: WhyEdge }) {
  const target = edge.target
  if (target.kind === 'missing_link') return <MissingLinkView link={target} />
  if (target.kind === 'evidence') return <EvidenceView node={target} />
  if (target.kind === 'coverage') return <CoverageView node={target} />
  return <ClaimReferenceView node={target} />
}

function edgeSummary(edge: WhyEdge): string {
  const target = edge.target
  if (target.kind === 'missing_link') return `${edge.targetRef} — link missing`
  if (target.kind === 'evidence') return `evidence ${target.evidenceId} · ${target.layer}`
  if (target.kind === 'coverage') return `coverage ${isoWeekLabel(target.coverageKey.rangeStart)} · ${target.status}`
  return `claim ${target.claimId} · ${target.statementCode}`
}

function EdgeGroupView({ group }: { group: WhyEdgeGroup }) {
  const copy = EDGE_ROLE_COPY[group.role]
  const headingId = useId()
  return (
    <section
      className="evidence-drawer__edge-group"
      data-role={group.role}
      data-empty={group.edges.length === 0}
      data-testid={`edge-group-${group.role}`}
      aria-labelledby={headingId}
    >
      <h4 id={headingId}>
        {copy.label} <span className="evidence-drawer__target-kind">({group.targetKind})</span>
      </h4>
      {group.edges.length === 0 ? (
        <p className="evidence-drawer__furniture">{copy.empty}</p>
      ) : (
        <ul className="evidence-drawer__edges">
          {group.edges.map((edge) => (
            <li key={`${group.role}:${edge.targetRef}`}>
              <Expandable summary={edgeSummary(edge)}>
                <EdgeTargetView edge={edge} />
              </Expandable>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ScopeView({ node }: { node: WhyScopeNode | WhyMissingLink }) {
  if (node.kind === 'missing_link') return <MissingLinkView link={node} />
  return (
    <div data-node="scope">
      <dl className="evidence-drawer__facts">
        <Fact term="Scope">
          <code>{node.scopeId}</code>
        </Fact>
        <Fact term="Installation alias">{node.hasAlias ? 'linked' : 'cleared'}</Fact>
        <Fact term="Linked">{isoWeekLabel(node.linkedAt)}</Fact>
      </dl>
      {node.aliasLink !== null && <MissingLinkView link={node.aliasLink} />}
    </div>
  )
}

function LimitationsView({ limitations }: { limitations: readonly WhyLimitation[] }) {
  if (limitations.length === 0) {
    return <p className="evidence-drawer__furniture">No limitations recorded against this claim.</p>
  }
  return (
    <ul className="evidence-drawer__limitations" aria-label="Limitations">
      {limitations.map((limitation) => (
        <li
          key={`${limitation.limitationCode}:${limitation.dimension}`}
          data-limitation={limitation.limitationCode}
        >
          <strong>{limitation.limitationCode}</strong>
          <span className="evidence-drawer__dimension"> · {limitation.dimension}</span>
          <span className="evidence-drawer__copy-key"> · copy: {limitation.copyKey}</span>
        </li>
      ))}
    </ul>
  )
}

function WalkStepLine({ step }: { step: WhyWalkStep }) {
  return (
    <li data-claim-id={step.claimId} data-depth={step.depth}>
      <LayerBadge layer={step.layer} /> <code>{step.claimId}</code> · {step.statementCode} ·{' '}
      {step.methodId}@{step.methodVersion} · {isoWeekLabel(step.windowStart)} →{' '}
      {isoWeekLabel(step.windowEnd)}
    </li>
  )
}

/**
 * A transitive walk (supersession or ancestry). The resolver puts no budget on the number of
 * steps, so rendering is bounded here: only the first `initial` steps are placed in the DOM,
 * the rest arrive on demand behind an `aria-expanded` toggle. A 100-node ancestry therefore
 * mounts a handful of nodes, not 100.
 */
function WalkView({ walk, initial }: { walk: WhyWalk; initial: number }) {
  const [expanded, setExpanded] = useState(false)
  const copy = WALK_COPY[walk.relation]
  const canExpand = walk.steps.length > initial
  const shown = expanded ? walk.steps : walk.steps.slice(0, initial)
  const hidden = walk.steps.length - shown.length

  return (
    <div className="evidence-drawer__walk" data-testid={`walk-${walk.relation}`} data-termination={walk.termination}>
      <p className="evidence-drawer__walk-meta">
        {copy.label} · termination: <strong>{walk.termination}</strong> · bound {walk.bound}
      </p>
      {walk.steps.length === 0 ? (
        <p className="evidence-drawer__furniture">{copy.empty}</p>
      ) : (
        <>
          <ol className="evidence-drawer__walk-steps" data-testid={`walk-steps-${walk.relation}`}>
            {shown.map((step) => (
              <WalkStepLine key={`${step.claimId}:${step.depth}`} step={step} />
            ))}
          </ol>
          {canExpand && (
            <button
              type="button"
              className="evidence-drawer__more"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? `Show fewer ${copy.label.toLowerCase()} steps` : `Show all ${walk.steps.length} ${copy.label.toLowerCase()} steps (${hidden} hidden)`}
            </button>
          )}
        </>
      )}
      {walk.missingLinks.length > 0 && (
        <ul className="evidence-drawer__walk-missing" aria-label={`${copy.label} data quality`}>
          {walk.missingLinks.map((link, index) => (
            <li key={`${link.reason}:${link.targetId ?? ''}:${index}`}>
              <MissingLinkView link={link} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ClaimHeader({ claim }: { claim: WhyClaimNode }) {
  return (
    <dl className="evidence-drawer__facts" data-node="claim">
      <Fact term="Statement">{claim.statementCode}</Fact>
      <Fact term="Layer">
        <LayerBadge layer={claim.layer} />
      </Fact>
      <Fact term="Method">
        {claim.methodId}@{claim.methodVersion}
      </Fact>
      <Fact term="Window">
        {isoWeekLabel(claim.windowStart)} → {isoWeekLabel(claim.windowEnd)}
      </Fact>
      <Fact term="Created">{isoWeekLabel(claim.createdAt)}</Fact>
      <Fact term="Schema">{claim.schemaVersion}</Fact>
      <Fact term="Supersession">
        {claim.supersededBy === null ? (
          'Current — head of its series.'
        ) : (
          <>
            Superseded by <code>{claim.supersededBy}</code>.
          </>
        )}
      </Fact>
    </dl>
  )
}

function QuestionSlot({ question }: { question: string | null | undefined }) {
  return question ? (
    <p className="evidence-drawer__question" data-testid="falsifying-question">
      {question}
    </p>
  ) : (
    <p className="evidence-drawer__furniture" data-testid="falsifying-question-empty">
      No falsifying question was supplied for this claim.
    </p>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <section className="evidence-drawer__section" aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      {children}
    </section>
  )
}

function ExplanationView({
  tree,
  question,
  initialWalkSteps,
}: {
  tree: WhyExplanationTree
  question: string | null | undefined
  initialWalkSteps: number
}) {
  return (
    <div className="evidence-drawer__explanation">
      <Section title="Claim">
        <ClaimHeader claim={tree.claim} />
      </Section>

      <Section title="Evidence, contradictions & basis">
        {tree.edges.map((group) => (
          <EdgeGroupView key={group.role} group={group} />
        ))}
      </Section>

      <Section title="Scope">
        <ScopeView node={tree.scope} />
      </Section>

      <Section title="Limitations">
        <LimitationsView limitations={tree.limitations} />
      </Section>

      <Section title="Correction & tombstone lineage">
        <LineageList lineage={tree.lineage} />
      </Section>

      <Section title="Supersession walk">
        <WalkView walk={tree.supersession} initial={initialWalkSteps} />
      </Section>

      <Section title="Derivation ancestry">
        <WalkView walk={tree.ancestry} initial={initialWalkSteps} />
      </Section>

      <Section title="Edge data quality">
        {tree.unresolvedEdges.length === 0 ? (
          <p className="evidence-drawer__furniture">No malformed or unresolved edges.</p>
        ) : (
          <ul aria-label="Unresolved edges">
            {tree.unresolvedEdges.map((link, index) => (
              <li key={`${link.reason}:${link.targetId ?? ''}:${index}`}>
                <MissingLinkView link={link} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Falsifying question">
        <QuestionSlot question={question} />
      </Section>
    </div>
  )
}

function UnresolvableView({ result }: { result: WhyUnresolvable }) {
  return (
    <div
      className="evidence-drawer__unresolvable"
      data-testid="evidence-drawer-unresolvable"
      data-reason={result.reason}
      role="alert"
    >
      <p className="evidence-drawer__unresolvable-copy">{UNRESOLVABLE_COPY[result.reason]}</p>
      {result.claimId !== null && (
        <dl className="evidence-drawer__facts">
          <Fact term="Claim">
            <code>{result.claimId}</code>
          </Fact>
        </dl>
      )}
      {result.lineage.length > 0 && (
        <>
          <p className="evidence-drawer__furniture">Recorded lineage explains the absence:</p>
          <LineageList lineage={result.lineage} />
        </>
      )}
    </div>
  )
}

/** Heading derived from the RESOLUTION, never the raw reference, so a malformed id is never echoed. */
function headingFor(resolution: EvidenceResolution): string {
  switch (resolution.kind) {
    case 'explanation':
      return `Why this number: ${resolution.claim.statementCode}`
    case 'evidence':
      return `Observation ${resolution.evidenceId}`
    case 'missing_link':
      return 'This observation could not be resolved'
    case 'unresolvable':
      return 'This reference could not be resolved'
  }
}

export function EvidenceDrawer({
  open,
  reference,
  resolve,
  onClose,
  discriminatingQuestion,
  initialWalkSteps = DEFAULT_INITIAL_WALK_STEPS,
}: EvidenceDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const resolution = useMemo(() => resolve(reference), [resolve, reference])

  // Focus management: capture the invoking element when the drawer opens, move focus inside,
  // and restore it on close. The cleanup runs when `open` flips to false or the drawer unmounts.
  useEffect(() => {
    if (!open) return
    const invoker = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => {
      invoker?.focus?.()
    }
  }, [open])

  if (!open) return null

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusables = focusableWithin(containerRef.current)
    if (focusables.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  let body: ReactNode
  switch (resolution.kind) {
    case 'explanation':
      body = (
        <ExplanationView
          tree={resolution}
          question={discriminatingQuestion}
          initialWalkSteps={initialWalkSteps}
        />
      )
      break
    case 'evidence':
      body = (
        <Section title="Evidence anchor">
          <EvidenceView node={resolution} defaultAnchor />
        </Section>
      )
      break
    case 'missing_link':
      body = (
        <Section title="Unresolved observation">
          <MissingLinkView link={resolution} />
        </Section>
      )
      break
    case 'unresolvable':
      body = <UnresolvableView result={resolution} />
      break
  }

  return (
    <div className="evidence-drawer-root">
      <div className="evidence-drawer-backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={containerRef}
        className="evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="evidence-drawer"
        data-reference-kind={reference.kind}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="evidence-drawer__header">
          <h2 id={titleId}>{headingFor(resolution)}</h2>
          <button
            ref={closeRef}
            type="button"
            className="evidence-drawer__close"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className="evidence-drawer__body">{body}</div>
      </div>
    </div>
  )
}
