// Time formatting / parsing helpers.
// Kept in one place so display logic never leaks into components.

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

interface FormatOptions {
  /** Include hundredths of a second, e.g. "1:23.45". */
  centis?: boolean
}

/** Turn a millisecond count into "MM:SS" or "H:MM:SS" (optionally with centis). */
export function formatDuration(ms: number, opts: FormatOptions = {}): string {
  const abs = Math.max(0, Math.floor(ms))
  const totalSeconds = Math.floor(abs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  let result =
    hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`

  if (opts.centis) {
    const centis = Math.floor((abs % 1000) / 10)
    result += `.${pad(centis)}`
  }
  return result
}

/** Format a +/- difference, e.g. "-4.7s" (ahead) or "+1:30" (behind). */
export function formatDelta(ms: number): string {
  const sign = ms < 0 ? '-' : '+'
  const abs = Math.abs(ms)
  if (abs < 60_000) {
    return `${sign}${(abs / 1000).toFixed(1)}s`
  }
  return sign + formatDuration(abs)
}

/** Keep a duration draft limited to digits and at most two colons. */
export function sanitizeDurationInput(input: string): string {
  let colons = 0
  let result = ''

  for (const char of input) {
    if (char >= '0' && char <= '9') {
      result += char
    } else if (char === ':' && colons < 2) {
      result += char
      colons += 1
    }
  }

  return result
}

/**
 * Parse user input into milliseconds.
 * Accepts "90" (seconds), "1:30" (m:ss), or "1:05:00" (h:mm:ss).
 * Colon-separated minutes and seconds must be in the 0-59 range.
 * Returns null if the input can't be understood.
 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  if (!/^\d+(?::\d+){0,2}$/.test(trimmed)) return null

  const parts = trimmed.split(':')
  if (parts.length > 3) return null

  const numbers = parts.map((p) => Number(p))
  if (numbers.some((n) => !Number.isInteger(n) || n < 0)) return null
  if (parts.length >= 2 && numbers[numbers.length - 1] >= 60) return null
  if (parts.length === 3 && numbers[1] >= 60) return null

  // Fold the parts together: each step is "previous total, in the next unit".
  // "1:05:00" -> ((1)*60 + 5)*60 + 0 seconds.
  let seconds = 0
  for (const n of numbers) {
    seconds = seconds * 60 + n
  }
  return Math.round(seconds * 1000)
}

/** Format an epoch timestamp as a readable date + time, e.g. "May 21, 2026, 3:45 PM". */
export function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
