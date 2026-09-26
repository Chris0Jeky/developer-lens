import { afterEach, describe, expect, it, vi } from 'vitest'
import { showcaseRoute, showcaseShareRequested, showcaseStoryOpened } from './showcaseUsage'

function installSdk() {
  const sdk = { route: vi.fn(() => true), track: vi.fn(() => true) }
  vi.stubGlobal('Pulseboard', sdk)
  return sdk
}

describe('showcase usage events', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('sends only closed enums in the showcase build for the public-demo dataset', () => {
    vi.stubEnv('MODE', 'showcase')
    const sdk = installSdk()

    showcaseStoryOpened(true, '12m')
    showcaseShareRequested(true, 'portable-download', 'wrapped')
    showcaseRoute(true, 'home')

    expect(sdk.route.mock.calls).toEqual([['story'], ['home']])
    expect(sdk.track.mock.calls).toEqual([
      ['story.opened', { story: 'wrapped', range: '12m' }],
      ['share.requested', { channel: 'portable-download', context: 'wrapped' }],
    ])
  })

  it('never calls the SDK outside the showcase build, even when a global exists', () => {
    const sdk = installSdk()
    expect(import.meta.env.MODE).not.toBe('showcase')

    showcaseStoryOpened(true, '6m')
    showcaseShareRequested(true, 'copy', 'overview')
    showcaseRoute(true, 'share')

    expect(sdk.route).not.toHaveBeenCalled()
    expect(sdk.track).not.toHaveBeenCalled()
  })

  it('never calls the SDK for a dataset that is not the public demo', () => {
    vi.stubEnv('MODE', 'showcase')
    const sdk = installSdk()

    showcaseStoryOpened(false, '6m')
    showcaseShareRequested(false, 'native', 'overview')
    showcaseRoute(false, 'story')

    expect(sdk.route).not.toHaveBeenCalled()
    expect(sdk.track).not.toHaveBeenCalled()
  })

  it('survives an absent, blocked or throwing SDK', () => {
    vi.stubEnv('MODE', 'showcase')
    expect((globalThis as { Pulseboard?: unknown }).Pulseboard).toBeUndefined()
    expect(() => showcaseStoryOpened(true, '6m')).not.toThrow()
    expect(() => showcaseShareRequested(true, 'link', 'overview')).not.toThrow()
    expect(() => showcaseRoute(true, 'home')).not.toThrow()

    vi.stubGlobal('Pulseboard', {
      route: () => {
        throw new Error('blocked')
      },
      track: () => {
        throw new Error('blocked')
      },
    })
    expect(() => showcaseStoryOpened(true, '6m')).not.toThrow()
    expect(() => showcaseShareRequested(true, 'link', 'overview')).not.toThrow()
    expect(() => showcaseRoute(true, 'home')).not.toThrow()
  })
})
