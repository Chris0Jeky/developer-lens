
export type RuleVerdict = 'pass' | 'fail' | 'not_applicable'

export interface RuleDefinition {
  id: string
  version: string
  label: string
  requiredMeasurements: readonly string[]
  evaluate(values: Readonly<Record<string, number | null>>): RuleVerdict
}

export const RESEARCH_RULES = {
  detectionFloor: {
    id: 'research.detection_floor',
    version: '1',
    label: 'Candidate meets the preregistered detection floor',
    requiredMeasurements: ['candidate.detection_rate'],
    evaluate: (v) =>
      v['candidate.detection_rate'] == null
        ? 'not_applicable'
        : v['candidate.detection_rate']! >= 0.75 ? 'pass' : 'fail',
  },
  falseAlertTwentyPercentImprovement: {
    id: 'research.false_alert_improvement_20pct',
    version: '1',
    label: 'Candidate improves false alerts by at least 20%',
    requiredMeasurements: [
      'baseline.false_alerts_per_year',
      'candidate.false_alerts_per_year',
    ],
    evaluate: (v) => {
      const baseline = v['baseline.false_alerts_per_year']
      const candidate = v['candidate.false_alerts_per_year']
      if (baseline == null || candidate == null) return 'not_applicable'
      return candidate <= baseline * 0.8 ? 'pass' : 'fail'
    },
  },
} satisfies Record<string, RuleDefinition>
