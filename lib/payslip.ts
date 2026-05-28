import { format } from "date-fns"
import { fr } from "date-fns/locale"

export interface PayslipSalaryBreakdownItem {
  period: string
  salary: number
  months: number
}

export interface PayslipBonusDetailItem {
  type: string
  amount: number
  reason?: string | null
  period?: string | null
}

export interface PayslipBonusDetailsPayload {
  salaryBreakdown?: PayslipSalaryBreakdownItem[]
  bonuses: PayslipBonusDetailItem[]
}

const bonusTypeLabels: Record<string, string> = {
  PERFORMANCE: "Performance",
  ANNUAL: "Annuel",
  EXCEPTIONAL: "Exceptionnel",
}

export function formatAmountTnd(value: number) {
  return `${value.toFixed(2)} TND`
}

export function formatFrenchMonthYear(value: Date) {
  const formatted = format(value, "MMMM yyyy", { locale: fr })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function formatFrenchDate(value: Date) {
  return format(value, "dd/MM/yyyy", { locale: fr })
}

export function getMonthlyBounds(period: string) {
  const [yearRaw, monthRaw] = period.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Periode mensuelle invalide: ${period}`)
  }

  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999))

  return { start, end }
}

export function getAnnualBounds(period: string) {
  const year = Number(period)
  if (!Number.isInteger(year)) {
    throw new Error(`Periode annuelle invalide: ${period}`)
  }

  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  }
}

export function getPayslipPeriodLabel(periodType: "MONTHLY" | "ANNUAL", period: string) {
  if (periodType === "MONTHLY") {
    return formatFrenchMonthYear(getMonthlyBounds(period).start)
  }

  return `Annee ${period}`
}

export function getPayslipDownloadSlug(periodType: "MONTHLY" | "ANNUAL", period: string) {
  return periodType === "MONTHLY" ? period : `annee-${period}`
}

function parseYearMonth(value: string) {
  const [yearRaw, monthRaw] = value.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Periode annee-mois invalide: ${value}`)
  }

  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0))
}

export function formatSalaryBreakdownPeriodLabel(value: string) {
  const [startRaw, endRaw] = value.split(" to ")
  const start = parseYearMonth(startRaw)
  const end = parseYearMonth(endRaw ?? startRaw)
  const startLabel = format(start, "MMM yyyy", { locale: fr })
  const endLabel = format(end, "MMM yyyy", { locale: fr })

  if (startRaw === (endRaw ?? startRaw)) {
    return startLabel
  }

  return `${startLabel} - ${endLabel}`
}

export function getBonusTypeLabel(type: string) {
  return bonusTypeLabels[type] ?? type
}

export function parseBonusDetails(value: unknown): PayslipBonusDetailsPayload {
  if (!value || typeof value !== "object") {
    return { bonuses: [] }
  }

  const payload = value as Record<string, unknown>
  const salaryBreakdown = Array.isArray(payload.salaryBreakdown)
    ? payload.salaryBreakdown
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => ({
          period: typeof item.period === "string" ? item.period : "",
          salary: typeof item.salary === "number" ? item.salary : 0,
          months: typeof item.months === "number" ? item.months : 0,
        }))
        .filter((item) => item.period && item.months > 0)
    : []

  const bonuses = Array.isArray(payload.bonuses)
    ? payload.bonuses
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => ({
          type: typeof item.type === "string" ? item.type : "BONUS",
          amount: typeof item.amount === "number" ? item.amount : 0,
          reason: typeof item.reason === "string" ? item.reason : null,
          period: typeof item.period === "string" ? item.period : null,
        }))
    : []

  return { salaryBreakdown, bonuses }
}
