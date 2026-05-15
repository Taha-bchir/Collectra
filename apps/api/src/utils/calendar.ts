/** Start of calendar day in UTC (midnight), for date-only comparisons. */
export function utcCalendarDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parses `YYYY-MM-DD` or an ISO datetime into a UTC calendar-day start. */
export function parsePromisedDateInput(value: string): Date | null {
  const trimmed = value.trim()
  const dateOnly = DATE_ONLY_RE.exec(trimmed)
  if (dateOnly) {
    const year = Number(dateOnly[1])
    const month = Number(dateOnly[2])
    const day = Number(dateOnly[3])
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return null
    }
    return parsed
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return utcCalendarDayStart(parsed)
}
