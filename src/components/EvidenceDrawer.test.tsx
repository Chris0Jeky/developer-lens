import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { WhyMissingLinkReason } from '../../server/storage/whyResolver.js'
import {
  EvidenceDrawer,
  MISSING_LINK_COPY,
  UNRESOLVABLE_COPY,
  type AnalyticReference,
} from './EvidenceDrawer'
import {
  CLAIM_TREE_FIXTURES,
  CYCLE_REFERENCE,
  DEEP_ANCESTRY_REFERENCE,
  DEPTH_LIMITED_REFERENCE,
  DETERMINISTIC_REFERENCE,
  HYPOTHESIS_REFERENCE,
  MALFORMED_INPUT_STRING,
  MALFORMED_REFERENCE,
  OBSERVATION_ANCHOR_REFERENCE,
  OBSERVATION_TOMBSTONED_REFERENCE,
  TOMBSTONED_REFERENCE,
  UNRESOLVABLE_FIXTURES,
  resolveFixture,
} from './evidenceDrawerFixtures'

const DEMO_QUESTION =
  'What rerun distribution across independent CI runs would show this pattern is flakiness, not a real regression?'

function renderDrawer(reference: AnalyticReference, question?: string | null) {
  return render(
    <EvidenceDrawer
      open
      reference={reference}
      resolve={resolveFixture}
      onClose={() => {}}
      discriminatingQuestion={question}
    />,
  )
}

/** Reveal the whole collapsed tree so deep missing-links can be asserted. Terminates when
 *  no collapsed disclosure remains. */
function expandEverything() {
  for (let pass = 0; pass < 25; pass += 1) {
    const collapsed = screen.queryAllByRole('button', { expanded: false })
    if (collapsed.length === 0) break
    for (const button of collapsed) fireEvent.click(button)
  }
}

/** Which fixture surfaces each of the 12 resolver missing-link reasons. */
const REASON_FIXTURE: Readonly<Record<WhyMissingLinkReason, AnalyticReference>> = {
  CYCLE_DETECTED: CYCLE_REFERENCE,
  DEPTH_LIMIT_REACHED: DEPTH_LIMITED_REFERENCE,
  MALFORMED_EDGE: TOMBSTONED_REFERENCE,
  MISSING_CAPABILITY_BINDING: TOMBSTONED_REFERENCE,
  MISSING_CLAIM: CYCLE_REFERENCE,
  MISSING_COVERAGE: TOMBSTONED_REFERENCE,
  MISSING_EVIDENCE: TOMBSTONED_REFERENCE,
  MISSING_SCOPE: CYCLE_REFERENCE,
  SCOPE_ALIAS_CLEARED: TOMBSTONED_REFERENCE,
  TOMBSTONED_CLAIM: TOMBSTONED_REFERENCE,
  TOMBSTONED_EVIDENCE: TOMBSTONED_REFERENCE,
  UNREGISTERED_CAPABILITY: TOMBSTONED_REFERENCE,
}

afterEach(() => {
  cleanup()
})

describe('EvidenceDrawer — dialog semantics', () => {
  it('is a modal dialog with an accessible name', () => {
    renderDrawer(HYPOTHESIS_REFERENCE, DEMO_QUESTION)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(/why this number/i)
  })
})

describe('EvidenceDrawer — the full walk renders with no blank sections', () => {
  it.each(CLAIM_TREE_FIXTURES)('renders every section for the $name fixture', ({ reference }) => {
    const { container } = renderDrawer(reference)

    // Exactly the six edge groups, each carrying content or explicit furniture (never blank).
    const groups = container.querySelectorAll('[data-testid^="edge-group-"]')
    expect(groups).toHaveLength(6)
    for (const groupEl of groups) {
      // h4 label plus at least one child (a <ul> of edges or a furniture <p>).
      expect(groupEl.childElementCount).toBeGreaterThanOrEqual(2)
    }

    // No rendered section is just a heading.
    const sections = container.querySelectorAll('.evidence-drawer__section')
    expect(sections.length).toBeGreaterThan(0)
    for (const section of sections) {
      expect(section.childElementCount).toBeGreaterThanOrEqual(2)
    }

    // The named sections are all present.
    expect(screen.getByRole('heading', { name: /^Claim$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /scope/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /limitations/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /supersession walk/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /derivation ancestry/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /falsifying question/i })).toBeInTheDocument()
  })

  it('renders the six edge groups in the fixed CLAIM_EDGE_ROLES order', () => {
    const { container } = renderDrawer(HYPOTHESIS_REFERENCE)
    const roles = [...container.querySelectorAll('[data-testid^="edge-group-"]')].map((el) =>
      el.getAttribute('data-role'),
    )
    expect(roles).toEqual([
      'supports',
      'contradicts',
      'contextualizes',
      'derives_from',
      'coverage_basis',
      'limitation_basis',
    ])
  })
})

describe('EvidenceDrawer — the demo hypothesis walk', () => {
  it('shows supporting and contradicting evidence, a limitation, and the falsifying question', () => {
    renderDrawer(HYPOTHESIS_REFERENCE, DEMO_QUESTION)

    // Edge-group summaries are visible without expanding.
    expect(screen.getByText(/evidence ev_supp_ci_rerun/i)).toBeInTheDocument()
    expect(screen.getByText(/evidence ev_contra_flake/i)).toBeInTheDocument()

    // Limitation with dimension.
    const limitation = screen.getByText('COVERAGE_SPARSE').closest('li')
    expect(limitation).not.toBeNull()
    expect(limitation).toHaveTextContent('completeness')

    // The falsifying question renders in its slot.
    expect(screen.getByTestId('falsifying-question')).toHaveTextContent(DEMO_QUESTION)
  })

  it('walks a supporting edge to its coverage, job, and capability on demand', () => {
    renderDrawer(HYPOTHESIS_REFERENCE, DEMO_QUESTION)

    // The capability terminus is not eagerly in the DOM.
    expect(screen.queryByText('github.ci.core')).not.toBeInTheDocument()

    expandEverything()

    // After expanding the chain, the capability + consent revision are reachable.
    expect(screen.getAllByText('github.ci.core').length).toBeGreaterThan(0)
    expect(screen.getAllByText('consent-2026-07-01').length).toBeGreaterThan(0)
  })
})

describe('EvidenceDrawer — absence is furniture, never a hidden section', () => {
  it('renders empty edge groups as explicit facts', () => {
    renderDrawer(DETERMINISTIC_REFERENCE)

    expect(screen.getByText('No contradicting evidence recorded.')).toBeInTheDocument()
    expect(screen.getByText('No contextualizing evidence recorded.')).toBeInTheDocument()
    expect(screen.getByText('This claim derives from no prior claim.')).toBeInTheDocument()
    expect(screen.getByText('No limitation basis recorded.')).toBeInTheDocument()
  })

  it('never renders a numeric zero as an absence marker', () => {
    const { container } = renderDrawer(DETERMINISTIC_REFERENCE)
    // No furniture paragraph is a bare "0".
    for (const furniture of container.querySelectorAll('.evidence-drawer__furniture')) {
      expect(furniture.textContent?.trim()).not.toBe('0')
      expect(furniture.textContent ?? '').toMatch(/[a-z]/i)
    }
  })

  it('falls back to honest furniture when no falsifying question is supplied', () => {
    renderDrawer(DETERMINISTIC_REFERENCE)
    expect(screen.getByTestId('falsifying-question-empty')).toHaveTextContent(
      /no falsifying question was supplied/i,
    )
  })
})

describe('EvidenceDrawer — every missing-link reason has distinct honest copy', () => {
  it('covers all twelve resolver reason codes in the fixtures', () => {
    expect(Object.keys(REASON_FIXTURE).sort()).toEqual(Object.keys(MISSING_LINK_COPY).sort())
  })

  it.each(Object.keys(MISSING_LINK_COPY) as WhyMissingLinkReason[])(
    'renders the %s message',
    (reason) => {
      renderDrawer(REASON_FIXTURE[reason])
      expandEverything()
      expect(screen.getAllByText(MISSING_LINK_COPY[reason]).length).toBeGreaterThan(0)
    },
  )

  it('shows a tombstoned link with its own lineage self-explanation', () => {
    renderDrawer(TOMBSTONED_REFERENCE)
    expandEverything()
    // The tombstoned evidence carries a tombstone_cascade lineage event.
    expect(screen.getAllByText('tombstone_cascade').length).toBeGreaterThan(0)
  })

  it('renders cycle and depth-limit markers as data-quality furniture without crashing', () => {
    renderDrawer(CYCLE_REFERENCE)
    expect(screen.getByTestId('walk-derives_from_ancestry')).toHaveAttribute(
      'data-termination',
      'cycle_detected',
    )
    cleanup()

    renderDrawer(DEPTH_LIMITED_REFERENCE)
    expect(screen.getByTestId('walk-derives_from_ancestry')).toHaveAttribute(
      'data-termination',
      'depth_limit_reached',
    )
  })
})

describe('EvidenceDrawer — unresolvable references render honest errors, never blank', () => {
  it.each(UNRESOLVABLE_FIXTURES)('renders an honest error for $name', ({ reference, reason }) => {
    renderDrawer(reference)
    const alert = screen.getByTestId('evidence-drawer-unresolvable')
    expect(alert).toHaveAttribute('data-reason', reason)
    expect(alert).toHaveTextContent(UNRESOLVABLE_COPY[reason])
    // Never a blank drawer.
    expect(screen.getByRole('dialog').textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })

  it('never echoes a malformed claim identifier back to the user', () => {
    renderDrawer(MALFORMED_REFERENCE)
    expect(document.body.textContent ?? '').not.toContain(MALFORMED_INPUT_STRING)
    expect(screen.getByTestId('evidence-drawer-unresolvable')).toHaveAttribute(
      'data-reason',
      'MALFORMED_CLAIM_ID',
    )
  })

  it('shows revocation lineage for an unknown-but-revoked claim', () => {
    renderDrawer({ kind: 'claim', claimId: 'cl_unknown_revoked' })
    expect(screen.getByText('cl_unknown_revoked')).toBeInTheDocument()
    expect(screen.getByText('tombstone_cascade')).toBeInTheDocument()
  })
})

describe('EvidenceDrawer — observation references render the evidence-anchor path', () => {
  it('renders a resolved observation anchor', () => {
    renderDrawer(OBSERVATION_ANCHOR_REFERENCE)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-reference-kind', 'observation')
    expect(dialog).toHaveAccessibleName(/observation ev_observation_anchor/i)
    // The anchor's coverage chain renders without an extra expand (it is the top-level subject).
    expect(screen.getByRole('heading', { name: /coverage & consent/i })).toBeInTheDocument()
    expect(screen.getByText('ev_observation_anchor')).toBeInTheDocument()
  })

  it('renders an honest missing-link for a tombstoned observation', () => {
    renderDrawer(OBSERVATION_TOMBSTONED_REFERENCE)
    expect(screen.getByText(MISSING_LINK_COPY.TOMBSTONED_EVIDENCE)).toBeInTheDocument()
    expect(screen.getByText('tombstone_cascade')).toBeInTheDocument()
  })
})

describe('EvidenceDrawer — operational timestamps render at ISO-week grain', () => {
  it('renders week labels and never the raw millisecond instant', () => {
    renderDrawer(HYPOTHESIS_REFERENCE)
    const body = document.body.textContent ?? ''
    expect(body).toContain('2026-W32') // createdAt week
    expect(body).toContain('2026-W23') // windowStart week
    // The raw sub-day components of the fixtures never reach the screen.
    expect(body).not.toContain('12:34:56')
    expect(body).not.toContain('T00:00:00')
    expect(body).not.toContain('23:59:59')
  })
})

describe('EvidenceDrawer — bounded rendering of a deep ancestry', () => {
  it('mounts only the initial steps and expands the rest on demand', async () => {
    const user = userEvent.setup()
    renderDrawer(DEEP_ANCESTRY_REFERENCE)

    const stepList = screen.getByTestId('walk-steps-derives_from_ancestry')
    expect(within(stepList).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByText('cl_ancestor_099')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show all 100/i }))

    expect(within(stepList).getAllByRole('listitem')).toHaveLength(100)
    expect(screen.getByText('cl_ancestor_099')).toBeInTheDocument()
  })
})

describe('EvidenceDrawer — keyboard operation and focus management', () => {
  function Harness({ reference }: { reference: AnalyticReference }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open evidence
        </button>
        <EvidenceDrawer
          open={open}
          reference={reference}
          resolve={resolveFixture}
          onClose={() => setOpen(false)}
          discriminatingQuestion={DEMO_QUESTION}
        />
      </>
    )
  }

  it('moves focus into the drawer on open, closes on Escape, and restores focus to the opener', async () => {
    const user = userEvent.setup()
    render(<Harness reference={HYPOTHESIS_REFERENCE} />)

    const opener = screen.getByRole('button', { name: /open evidence/i })
    await user.click(opener)

    const closeButton = screen.getByRole('button', { name: /^close$/i })
    expect(document.activeElement).toBe(closeButton)

    // Navigate through a few tab stops; focus stays inside the drawer.
    const dialog = screen.getByRole('dialog')
    await user.tab()
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(opener)
  })

  it('traps focus: shift+Tab from the first control wraps to the last', async () => {
    const user = userEvent.setup()
    render(<Harness reference={HYPOTHESIS_REFERENCE} />)

    await user.click(screen.getByRole('button', { name: /open evidence/i }))
    const dialog = screen.getByRole('dialog')
    const closeButton = screen.getByRole('button', { name: /^close$/i })
    expect(document.activeElement).toBe(closeButton)

    await user.tab({ shift: true })

    // Focus wrapped to the last control inside the drawer, not out to the opener.
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(closeButton)
    expect(document.activeElement?.textContent).not.toMatch(/open evidence/i)
  })
})
