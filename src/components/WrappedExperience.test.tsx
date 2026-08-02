import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeDataset } from '../../server/analytics'
import { createDemoDataset } from '../../server/demo'
import { WrappedExperience } from './WrappedExperience'

const dashboard = analyzeDataset(createDemoDataset('6m'))

describe('WrappedExperience', () => {
  afterEach(cleanup)

  it('reveals deeper evidence, jumps through the story map, and shares the active chapter', async () => {
    const onShare = vi.fn()
    const user = userEvent.setup()
    render(
      <WrappedExperience
        data={dashboard}
        onClose={() => undefined}
        onShare={onShare}
        open
      />,
    )

    expect(screen.getByRole('dialog', { name: /developer lens wrapped.*you didn’t just write code/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /read the density.*dig deeper/i }))
    expect(screen.getByRole('region', { name: /deeper chapter insight/i })).toHaveTextContent(
      /signals per active week/i,
    )

    await user.click(screen.getByRole('button', { name: '01 · The opening frame' }))
    const storyMap = screen.getByRole('navigation', { name: /wrapped chapters/i })
    await user.click(within(storyMap).getByRole('button', { name: /the constellation/i }))

    expect(screen.getByRole('dialog', { name: /developer lens wrapped.*repositories/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /share chapter 2/i }))
    expect(onShare).toHaveBeenCalledWith({
      kind: 'wrapped',
      chapterId: 'constellation',
      chapterNumber: 2,
      chapterLabel: '02 · The constellation',
    })
  })
})
