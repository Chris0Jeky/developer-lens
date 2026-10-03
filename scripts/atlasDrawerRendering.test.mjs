import assert from 'node:assert/strict'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, it } from 'vitest'
import { ChangeBatchTailPanel } from '../src/components/ChangeBatchTailPanel'
import { buildSyntheticChangeBatchTailView } from '../shared/changeBatchTailSynthetic'
import { matchesAtlasDrawer } from './atlasDrawerContract.mjs'

// jsdom has no layout; native visibility/hit/geometry is separately enforced by
// atlasPointerSmoke. Here the actual React fixture pins the rendered identity.
function renderedIdentity(dialog) {
  return { count: screen.getAllByRole('dialog').length, visible: true,
    referenceKind: dialog.getAttribute('data-reference-kind'),
    heading: within(dialog).getByRole('heading', { level: 2 }).textContent.trim(),
    supports: [...within(dialog).getByTestId('edge-group-supports').querySelectorAll('.evidence-drawer__toggle')]
      .map((element) => /^evidence ([A-Za-z0-9_.]+) · observed$/.exec(element.textContent.trim())?.[1] ?? null) }
}

afterEach(cleanup)
describe('Atlas drawer smoke identity against the actual rendered fixture', () => {
  for (const measure of ['p90', 'lower_bound_p90']) {
    it(`matches ${measure} and rejects the other p90 basis`, () => {
      const view = buildSyntheticChangeBatchTailView()
      const pick = (wanted) => view.marks.find((mark) => mark.subject.basisId === 'lines_changed' &&
        mark.subject.binningId === 'declared_thresholds' && mark.subject.stratumId === 's1' && mark.subject.measure === wanted)
      const mark = pick(measure)
      const other = pick(measure === 'p90' ? 'lower_bound_p90' : 'p90')
      assert.ok(mark && other)
      render(createElement(ChangeBatchTailPanel, { view }))
      fireEvent.click(screen.getByTestId('change-batch-primary').querySelector(`[data-mark-id="${mark.markId}"]`))
      const dialog = screen.getByRole('dialog')
      assert.equal(dialog.textContent.includes(mark.statement), false, 'The old smoke incorrectly expected unrendered mark prose')
      assert.equal(matchesAtlasDrawer(renderedIdentity(dialog), mark.markId), true)
      assert.equal(matchesAtlasDrawer(renderedIdentity(dialog), other.markId), false)
    })
  }
})
