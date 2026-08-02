import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeDataset } from '../../server/analytics'
import { createDemoDataset } from '../../server/demo'
import { ShareStudio } from './ShareStudio'

const dashboard = analyzeDataset(createDemoDataset('6m'))

describe('ShareStudio', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('requires explicit confirmation before exporting a redacted local snapshot', async () => {
    const local = {
      ...dashboard,
      meta: { ...dashboard.meta, mode: 'private' as const, privacy: 'local-only' as const },
    }
    const user = userEvent.setup()
    render(
      <ShareStudio
        context={{ kind: 'overview' }}
        data={local}
        onClose={() => undefined}
        open
      />,
    )

    expect(screen.getByRole('dialog', { name: /turn the lens/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /share externally/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /download image/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /share full experience/i })).toBeDisabled()
    expect(screen.getByText(/no identity, repository names, pr titles/i)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /reviewed this redacted preview/i }))

    expect(screen.getByRole('button', { name: /share externally/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /export summary/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /download full file/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /alias every project/i }))

    expect(screen.getByRole('button', { name: /share full experience/i })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /reviewed this redacted preview/i })).not.toBeChecked()
  })

  it('makes the public synthetic link immediately shareable', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const publicDemo = {
      ...dashboard,
      meta: { ...dashboard.meta, privacy: 'public-demo' as const },
    }
    render(
      <ShareStudio
        context={{ kind: 'wrapped', chapterId: 'delivery', chapterNumber: 5 }}
        data={publicDemo}
        onClose={() => undefined}
        open
      />,
    )

    expect(screen.getByRole('button', { name: /share externally/i })).toBeEnabled()
    expect(screen.getByText(/ready for the public web/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /copy link/i }))
    expect(writeText).toHaveBeenCalledWith('https://chris0jeky.github.io/developer-lens/')
    expect(screen.getByText(/public showcase link copied/i)).toBeInTheDocument()
  })

  it('shares the selected full experience as an explicit local file when supported', async () => {
    const user = userEvent.setup()
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperties(window.navigator, {
      canShare: { configurable: true, value: vi.fn().mockReturnValue(true) },
      share: { configurable: true, value: share },
    })
    const local = {
      ...dashboard,
      meta: { ...dashboard.meta, mode: 'private' as const, privacy: 'local-only' as const },
    }
    render(
      <ShareStudio
        context={{ kind: 'wrapped', chapterId: 'connection', chapterNumber: 8 }}
        data={local}
        onClose={() => undefined}
        open
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: /reviewed this redacted preview/i }))
    await user.click(screen.getByRole('button', { name: /share full experience/i }))

    expect(share).toHaveBeenCalledOnce()
    const shareData = share.mock.calls[0][0] as ShareData
    expect(shareData.url).toBeUndefined()
    expect(shareData.files).toHaveLength(1)
    expect(shareData.files?.[0].name).toMatch(/wrapped-portable\.html$/)
    expect(screen.getByText(/sent to the system share sheet as a file/i)).toBeInTheDocument()
  })
})
