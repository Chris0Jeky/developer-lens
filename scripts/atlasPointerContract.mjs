/** Validate a hit-tested DOM witness before dispatching any native pointer input. */
export function requirePointerTarget(value, previous = null) {
  if (!value || value.count !== 1 || value.connected !== true || value.disabled !== false ||
      typeof value.mark !== 'string' || value.mark.length === 0 || value.hit !== value.mark ||
      !['x', 'y', 'left', 'top', 'width', 'height', 'viewportWidth', 'viewportHeight'].every((key) => Number.isFinite(value[key])) ||
      value.width <= 0 || value.height <= 0 || value.x < 0 || value.y < 0 ||
      value.x >= value.viewportWidth || value.y >= value.viewportHeight ||
      (previous && (value.mark !== previous.mark || Math.abs(value.x - previous.x) > 0.5 || Math.abs(value.y - previous.y) > 0.5))) {
    throw new Error('Pointer target absent, obscured, ambiguous, or moving')
  }
  return { x: value.x, y: value.y, mark: value.mark }
}

/** A programmatic DOM click or silently retried click is not native pointer proof. */
export function requirePointerEvents(events, mark) {
  const types = ['mousedown', 'mouseup', 'click']
  if (!Array.isArray(events) || events.length !== 3 || events.some((event, index) =>
    event.type !== types[index] || event.mark !== mark || event.trusted !== true)) {
    throw new Error('Native pointer event sequence did not reach the intended mark exactly once')
  }
  return true
}
