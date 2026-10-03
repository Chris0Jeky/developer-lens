/** Match the rendered C0 evidence basis, not mark prose the drawer never renders. */
export function matchesAtlasDrawer(value, mark) {
  const match = typeof mark === 'string' && /^m\.(lines_changed|changed_files)\.(declared_thresholds|value_thirds)\.(s[123])\.(p90|lower_bound_p90)\.-$/.exec(mark)
  if (!match || !value || value.count !== 1 || value.visible !== true ||
      value.referenceKind !== 'claim' || value.heading !== 'Why this number: DELIVERY_FLOW' ||
      !Array.isArray(value.supports)) return false
  const prefix = `ev.cbt.${match[1]}.${match[2]}.${match[3]}`
  const expected = [`${prefix}.merged`]
  if (match[4] === 'lower_bound_p90') expected.push(`${prefix}.open_tail`)
  return value.supports.length === expected.length && new Set(value.supports).size === expected.length &&
    expected.every((id) => value.supports.includes(id))
}
