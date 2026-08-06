import { describe, expect, it } from 'vitest'
import {
  PhaseEConfigurationError,
  resolvePhaseEStoredAnalysisConfig,
  resolveV2RuntimeConfig,
} from './config.js'

const configured = (): NodeJS.ProcessEnv => ({
  DEVELOPER_LENS_PHASE_E_STORE_ROOT: 'C:\\invented\\selected-v3',
  DEVELOPER_LENS_PHASE_E_SCOPE_ID: `scope-${'1a'.repeat(32)}`,
  DEVELOPER_LENS_PHASE_E_CONSENT_REVISION: 'consent-invented-v1',
  DEVELOPER_LENS_PHASE_E_BASELINE_START: '2026-06-01T00:00:00.000Z',
  DEVELOPER_LENS_PHASE_E_BASELINE_END: '2026-06-29T00:00:00.000Z',
  DEVELOPER_LENS_PHASE_E_CURRENT_START: '2026-06-29T00:00:00.000Z',
  DEVELOPER_LENS_PHASE_E_CURRENT_END: '2026-07-27T00:00:00.000Z',
  DEVELOPER_LENS_PHASE_E_AS_OF: '2026-07-27T00:00:00.000Z',
})

describe('Phase E selected-store runtime configuration', () => {
  it('is absent by default', () => {
    expect(resolvePhaseEStoredAnalysisConfig({})).toBeUndefined()
    expect(resolveV2RuntimeConfig('x'.repeat(32), {}).phaseEAnalysis).toBeUndefined()
  })

  it('requires the whole explicit selected-store binding once any field is present', () => {
    expect(() =>
      resolvePhaseEStoredAnalysisConfig({ DEVELOPER_LENS_PHASE_E_SCOPE_ID: `scope-${'1a'.repeat(32)}` }),
    ).toThrow(PhaseEConfigurationError)
  })

  it('accepts an absolute selected root with adjacent equal windows and an injected clock', () => {
    const result = resolvePhaseEStoredAnalysisConfig(configured())
    expect(result).toMatchObject({
      selectedStoreDirectory: 'C:\\invented\\selected-v3',
      consentRevision: 'consent-invented-v1',
      asOf: '2026-07-27T00:00:00.000Z',
    })
  })

  it('refuses arbitrary filenames, aliases, unequal windows, and an early clock', () => {
    expect(() =>
      resolvePhaseEStoredAnalysisConfig({ ...configured(), DEVELOPER_LENS_PHASE_E_STORE_ROOT: 'selected.sqlite' }),
    ).toThrow(PhaseEConfigurationError)
    expect(() =>
      resolvePhaseEStoredAnalysisConfig({ ...configured(), DEVELOPER_LENS_PHASE_E_SCOPE_ID: 'owner/repository' }),
    ).toThrow(PhaseEConfigurationError)
    expect(() =>
      resolvePhaseEStoredAnalysisConfig({ ...configured(), DEVELOPER_LENS_PHASE_E_CURRENT_END: '2026-08-03T00:00:00.000Z' }),
    ).toThrow(PhaseEConfigurationError)
    expect(() =>
      resolvePhaseEStoredAnalysisConfig({ ...configured(), DEVELOPER_LENS_PHASE_E_AS_OF: '2026-07-20T00:00:00.000Z' }),
    ).toThrow(PhaseEConfigurationError)
  })
})
