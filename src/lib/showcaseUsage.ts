import type { RangeKey } from '../../shared/types'
import type { ShareContext } from './sharePayload'

/**
 * Product events for the PUBLIC SYNTHETIC SHOWCASE only (Pulseboard SDK v3, project
 * `developer-lens`).
 *
 * Every call is compiled away outside `--mode showcase`: Vite replaces `import.meta.env.MODE`
 * with a literal, so a local or private build keeps only an early return and never names the
 * SDK global (`scripts/verifyUninstrumentedBuild.ts` proves it). The SDK itself is emitted only
 * into the showcase build (vite.config.ts), and callers additionally pass the data's own
 * `public-demo` marker, so a private dataset can never produce an event.
 *
 * Props are closed enums from product code — never repository names, titles, captions, dataset
 * contents, export contents or identity. Every call is guarded: the product works unchanged when
 * the SDK is absent, blocked or throws.
 */

export type ShowcaseRoute = 'home' | 'story' | 'share'
export type ShareChannel =
  | 'native'
  | 'copy'
  | 'image'
  | 'report'
  | 'portable-share'
  | 'portable-download'
  | 'link'

interface ShowcaseUsageSdk {
  route(name: string): boolean
  track(name: string, props: Record<string, string>): boolean
}

function showcaseSdk(publicDemo: boolean): ShowcaseUsageSdk | undefined {
  if (import.meta.env.MODE !== 'showcase' || !publicDemo) return undefined
  try {
    return (globalThis as { Pulseboard?: ShowcaseUsageSdk }).Pulseboard
  } catch {
    return undefined
  }
}

export function showcaseRoute(publicDemo: boolean, route: ShowcaseRoute): void {
  try {
    showcaseSdk(publicDemo)?.route(route)
  } catch {
    // Usage measurement never affects the product.
  }
}

/** The Wrapped story opened; `story` is the product's own fixed slug, `range` its closed range key. */
export function showcaseStoryOpened(publicDemo: boolean, range: RangeKey): void {
  try {
    const sdk = showcaseSdk(publicDemo)
    if (!sdk) return
    sdk.route('story')
    sdk.track('story.opened', { story: 'wrapped', range })
  } catch {
    // Usage measurement never affects the product.
  }
}

/** A share action was requested; `channel` and `context` are closed enums, never share content. */
export function showcaseShareRequested(
  publicDemo: boolean,
  channel: ShareChannel,
  context: ShareContext['kind'],
): void {
  try {
    showcaseSdk(publicDemo)?.track('share.requested', { channel, context })
  } catch {
    // Usage measurement never affects the product.
  }
}
