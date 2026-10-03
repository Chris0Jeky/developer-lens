import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EvidenceDrawer } from './EvidenceDrawer'
import { DETERMINISTIC_REFERENCE, resolveFixture } from './evidenceDrawerFixtures'

function view(open: boolean) {
  return <><button type="button">Invoker</button><EvidenceDrawer open={open}
    reference={DETERMINISTIC_REFERENCE} resolve={resolveFixture} onClose={() => {}} /></>
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('Evidence Drawer automatic focus preserves the underlying viewport (#397)', () => {
  it('focuses the close button without starting a page scroll', () => {
    const { rerender } = render(view(false))
    screen.getByRole('button', { name: 'Invoker' }).focus()
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    rerender(view(true))
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()
    const index = focus.mock.contexts.indexOf(close)
    expect(index).toBeGreaterThanOrEqual(0)
    expect(focus.mock.calls[index]).toEqual([{ preventScroll: true }])
  })
  it('restores the invoker without starting a competing smooth scroll on dismissal', () => {
    const { rerender } = render(view(false))
    const invoker = screen.getByRole('button', { name: 'Invoker' })
    invoker.focus()
    rerender(view(true))
    const focus = vi.spyOn(invoker, 'focus')
    rerender(view(false))
    expect(invoker).toHaveFocus()
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
  })
  it('uses the same no-scroll restoration when the drawer unmounts', () => {
    const invoker = document.createElement('button')
    document.body.appendChild(invoker)
    try {
      invoker.focus()
      const focus = vi.spyOn(invoker, 'focus')
      const { unmount } = render(<EvidenceDrawer open reference={DETERMINISTIC_REFERENCE}
        resolve={resolveFixture} onClose={() => {}} />)
      unmount()
      expect(invoker).toHaveFocus()
      expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
    } finally { invoker.remove() }
  })
})
