const dateOnlyFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
})

const leaveBalanceFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseDateOnlyParts(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return null
  }

  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) {
    return null
  }

  return { year, month, day }
}

export function parseDateOnlyToUtcDate(value: string) {
  const parts = parseDateOnlyParts(value)
  if (!parts) {
    return null
  }

  const parsed = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== parts.year ||
    parsed.getUTCMonth() !== parts.month - 1 ||
    parsed.getUTCDate() !== parts.day
  ) {
    return null
  }

  return parsed
}

export function isValidDateOnlyInput(value: string) {
  return parseDateOnlyToUtcDate(value) !== null
}

export function getTodayDateOnly() {
  const now = new Date()
  const year = String(now.getUTCFullYear())
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const day = String(now.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function addDaysToDateOnly(value: string, days: number) {
  const parsed = parseDateOnlyToUtcDate(value)
  if (!parsed || !Number.isFinite(days)) {
    return ""
  }

  parsed.setUTCDate(parsed.getUTCDate() + Math.trunc(days))
  return parsed.toISOString().slice(0, 10)
}

export function toDateOnlyValue(value?: string | Date | null) {
  if (!value) {
    return ""
  }

  if (typeof value === "string") {
    if (DATE_ONLY_PATTERN.test(value)) {
      return value
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return ""
    }

    return parsed.toISOString().slice(0, 10)
  }

  if (Number.isNaN(value.getTime())) {
    return ""
  }

  return value.toISOString().slice(0, 10)
}

export function formatDateOnly(value?: string | Date | null) {
  const normalized = toDateOnlyValue(value)
  if (!normalized) {
    return ""
  }

  const parsed = parseDateOnlyToUtcDate(normalized)
  return parsed ? dateOnlyFormatter.format(parsed) : normalized
}

export function formatLeaveBalance(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0"
  }

  return leaveBalanceFormatter.format(value)
}

export function calculateLeaveBusinessDays(startDate: string, endDate: string) {
  const start = parseDateOnlyToUtcDate(startDate)
  const end = parseDateOnlyToUtcDate(endDate)

  if (!start || !end || start.getTime() > end.getTime()) {
    return 0
  }

  const cursor = new Date(start)
  let days = 0

  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) {
      days += 1
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return days
}

export function hasLeaveDateRangeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  return startA <= endB && endA >= startB
}

export const UPCOMING_LEAVE_LOOKAHEAD_DAYS = 15

type LeaveDateRangeInput = {
  startDate?: string | Date | null
  endDate?: string | Date | null
}

export function findNearestLeavePeriodInWindow(
  leaveRanges: LeaveDateRangeInput[],
  options?: {
    fromDate?: string
    lookaheadDays?: number
  },
) {
  const windowStart = options?.fromDate || getTodayDateOnly()
  const lookaheadDays = Math.max(0, options?.lookaheadDays ?? UPCOMING_LEAVE_LOOKAHEAD_DAYS)
  const windowEnd = addDaysToDateOnly(windowStart, lookaheadDays)

  if (!windowEnd) {
    return null
  }

  const matchingRanges = leaveRanges
    .map((range) => {
      const startDate = toDateOnlyValue(range.startDate)
      const endDate = toDateOnlyValue(range.endDate)

      if (!startDate || !endDate) {
        return null
      }

      if (!hasLeaveDateRangeOverlap(startDate, endDate, windowStart, windowEnd)) {
        return null
      }

      const effectiveStartDate = startDate < windowStart ? windowStart : startDate

      return {
        startDate,
        endDate,
        effectiveStartDate,
      }
    })
    .filter(
      (
        range,
      ): range is {
        startDate: string
        endDate: string
        effectiveStartDate: string
      } => Boolean(range),
    )
    .sort((left, right) => {
      if (left.effectiveStartDate !== right.effectiveStartDate) {
        return left.effectiveStartDate.localeCompare(right.effectiveStartDate)
      }

      if (left.startDate !== right.startDate) {
        return left.startDate.localeCompare(right.startDate)
      }

      return left.endDate.localeCompare(right.endDate)
    })

  if (matchingRanges.length === 0) {
    return null
  }

  return {
    startDate: matchingRanges[0].startDate,
    endDate: matchingRanges[0].endDate,
  }
}

export function isDateOnlyWithinRange(targetDate: string, startDate: string, endDate: string) {
  return targetDate >= startDate && targetDate <= endDate
}

export function isLeaveRequestType(type?: string | null) {
  return type === "CONGE"
}

export function getLeaveDurationLabel(days: number) {
  return `${leaveBalanceFormatter.format(days)} jour${days > 1 ? "s" : ""}`
}

export function getLeaveRequestValidationMessage(input: {
  type?: string | null
  startDate?: string | null
  endDate?: string | null
  leaveBalance?: number | null
}) {
  if (!isLeaveRequestType(input.type)) {
    return ""
  }

  const startDate = input.startDate?.trim() ?? ""
  const endDate = input.endDate?.trim() ?? ""

  if (!startDate || !endDate) {
    return "Les dates de debut et de fin sont obligatoires pour une demande de conge."
  }

  if (!isValidDateOnlyInput(startDate) || !isValidDateOnlyInput(endDate)) {
    return "Les dates du conge sont invalides."
  }

  if (endDate < startDate) {
    return "La date de fin doit etre posterieure ou egale a la date de debut."
  }

  const requestedDays = calculateLeaveBusinessDays(startDate, endDate)
  if (requestedDays <= 0) {
    return "La duree du conge doit contenir au moins un jour ouvrable."
  }

  if (typeof input.leaveBalance === "number" && requestedDays > input.leaveBalance) {
    return "Solde conge insuffisant, veuillez changer la duree."
  }

  return ""
}

export function getLeaveImpactSummary(input: {
  startDate?: string | null
  endDate?: string | null
  leaveBalance?: number | null
}) {
  const startDate = input.startDate ? toDateOnlyValue(input.startDate) : ""
  const endDate = input.endDate ? toDateOnlyValue(input.endDate) : ""
  const requestedDays = startDate && endDate ? calculateLeaveBusinessDays(startDate, endDate) : 0
  const currentBalance = typeof input.leaveBalance === "number" ? input.leaveBalance : null
  const projectedBalance = currentBalance == null ? null : currentBalance - requestedDays

  return {
    requestedDays,
    currentBalance,
    projectedBalance,
  }
}
