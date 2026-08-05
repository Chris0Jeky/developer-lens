import type {
  WhyMissingLinkReason,
  WhyUnresolvableReason,
} from '../../server/storage/whyResolver.js'

/**
 * The Evidence Drawer's reason copy, in a module that exports no component.
 *
 * These tables are exported (the drawer's tests assert exhaustiveness against the resolver's
 * reason unions), and a React component file that exports non-components breaks Fast Refresh —
 * editing the drawer would remount the whole tree instead of hot-swapping it. Both tables are
 * data with no JSX and no hooks, so they belong here rather than beside the component.
 *
 * Deliberately NOT placed in `evidenceDrawerFixtures.ts`: that module is imported only by the
 * drawer's test and carries several hundred lines of invented walk fixtures. Importing it from
 * the production component to reach two constants would pull all of that into the app bundle.
 *
 * Both records are exhaustive by type. A new resolver reason is a compile error here, not a
 * blank line in the drawer — absence is furniture, never silence.
 */

/** A distinct, honest, human-readable line for each of the 12 resolver missing-link reasons. */
export const MISSING_LINK_COPY: Readonly<Record<WhyMissingLinkReason, string>> = {
  CYCLE_DETECTED:
    'A reference cycle was detected here; the walk stopped so it stays finite.',
  DEPTH_LIMIT_REACHED:
    'The walk reached its depth limit before this link; older history below is not shown.',
  MALFORMED_EDGE:
    'This edge is malformed — its role and its target disagree — so it was not followed.',
  MISSING_CAPABILITY_BINDING:
    'The collection job that authorised this coverage is no longer recorded; the numbers survive but their consent binding does not.',
  MISSING_CLAIM: 'The claim this points to is not in the store.',
  MISSING_COVERAGE: 'The coverage row behind this evidence is not in the store.',
  MISSING_EVIDENCE: 'The evidence this points to is not in the store.',
  MISSING_SCOPE: 'The scope surrogate for this claim is not in the store.',
  SCOPE_ALIAS_CLEARED:
    'The installation alias for this scope was cleared; the claim keeps its own identity and grouping.',
  TOMBSTONED_CLAIM:
    'This claim was tombstoned; the lineage shown here is how its removal explains itself.',
  TOMBSTONED_EVIDENCE:
    'This evidence was tombstoned; the lineage shown here is how its removal explains itself.',
  UNREGISTERED_CAPABILITY:
    'This capability is not in the closed capability registry, so its terms cannot be shown.',
}

/** An honest error state for each of the 4 resolver unresolvable reasons. Never a blank drawer. */
export const UNRESOLVABLE_COPY: Readonly<Record<WhyUnresolvableReason, string>> = {
  INVALID_REQUEST: 'This was not a valid evidence request, so no walk could be started.',
  MALFORMED_CLAIM_ID:
    'The reference was not a well-formed claim identifier. It is not echoed back, because a caller could have passed prose.',
  STORAGE_UNAVAILABLE: 'The evidence store could not be read, so nothing is claimed here.',
  UNKNOWN_CLAIM: 'No claim with this identifier exists in the store.',
}
