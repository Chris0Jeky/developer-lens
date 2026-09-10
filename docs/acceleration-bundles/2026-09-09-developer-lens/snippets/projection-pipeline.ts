
export interface ProjectionContext {
  target: 'public-pages' | 'local-export' | 'lab-handoff' | 'commit-atlas'
  maximumDataClass: 'C0' | 'C1'
  acknowledgeRedaction: boolean
}

export interface ProjectionResult<T> {
  schemaVersion: string
  dataClass: 'C0' | 'C1'
  body: T
  provenance: {
    producerCommit: string
    inputHash: string
    projectionHash: string
    ruleSetHash: string
  }
}

export function projectFinding<TInternal, TWire>(
  finding: TInternal,
  context: ProjectionContext,
  classify: (finding: TInternal) => 'C0' | 'C1',
  build: (finding: TInternal) => TWire,
): ProjectionResult<TWire> {
  const dataClass = classify(finding)
  if (context.maximumDataClass !== dataClass) {
    throw new Error('PROJECTION_DATA_CLASS_MISMATCH')
  }
  if (context.target === 'public-pages' && dataClass !== 'C0') {
    throw new Error('PUBLIC_PROJECTION_REQUIRES_C0')
  }
  if (dataClass === 'C1' && !context.acknowledgeRedaction) {
    throw new Error('C1_EXPORT_REQUIRES_ACKNOWLEDGEMENT')
  }

  const body = build(finding)
  // validate structural schema, semantic rules, denied-content corpus and sink policy here
  return {
    schemaVersion: 'PublicLensProjection.v1',
    dataClass,
    body,
    provenance: {
      producerCommit: process.env.DEVELOPER_LENS_COMMIT ?? 'unknown',
      inputHash: 'sha256:replace-me',
      projectionHash: 'sha256:replace-me',
      ruleSetHash: 'sha256:replace-me',
    },
  }
}
