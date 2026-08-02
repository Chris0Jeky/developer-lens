interface LensLogoProps {
  compact?: boolean
}

export function LensLogo({ compact = false }: LensLogoProps) {
  return (
    <div className="lens-logo" aria-label="Developer Lens">
      <span className="lens-logo__mark" aria-hidden="true">
        <span />
      </span>
      {!compact && (
        <span className="lens-logo__wordmark">
          Developer <strong>Lens</strong>
        </span>
      )}
    </div>
  )
}
