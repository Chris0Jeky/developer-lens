import { format, parseISO } from 'date-fns'

const compactFormatter = new Intl.NumberFormat('en-GB', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const numberFormatter = new Intl.NumberFormat('en-GB')

export function compactNumber(value: number): string {
  return value >= 1_000 ? compactFormatter.format(value) : numberFormatter.format(value)
}

export function fullNumber(value: number): string {
  return numberFormatter.format(value)
}

export function percentage(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function precisePercentage(value: number): string {
  const percent = value * 100
  if (percent === 0) return '0%'
  if (percent < 0.1) return '<0.1%'
  if (percent < 10) return `${percent.toFixed(1).replace(/\.0$/, '')}%`
  return `${Math.round(percent)}%`
}

export function formatRange(from: string, to: string): string {
  return `${format(parseISO(from), 'd MMM yyyy')} — ${format(parseISO(to), 'd MMM yyyy')}`
}

export function formatDay(value: string): string {
  return format(parseISO(value), 'EEEE, d MMMM yyyy')
}

export function formatDuration(hours?: number): string {
  if (hours === undefined) return 'Not available'
  if (hours < 24) return `${Math.round(hours)}h`
  return `${Math.round((hours / 24) * 10) / 10}d`
}
