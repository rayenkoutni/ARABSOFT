import { Prisma, PayslipPeriodType, SalaryHistory } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  getAnnualBounds,
  getMonthlyBounds,
  PayslipBonusDetailItem,
  PayslipBonusDetailsPayload,
  PayslipSalaryBreakdownItem,
} from "@/lib/payslip"
import { AppError } from "@/lib/errors"

type SalaryHistoryRecord = Pick<
  SalaryHistory,
  | "id"
  | "baseSalary"
  | "salaryOverride"
  | "resolvedSalary"
  | "validFrom"
  | "validTo"
>

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0))
}

function endOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999))
}

function addUtcMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 0, 0, 0, 0))
}

function maxDate(left: Date, right: Date) {
  return left.getTime() > right.getTime() ? left : right
}

function minDate(left: Date, right: Date) {
  return left.getTime() < right.getTime() ? left : right
}

function overlapsRange(record: SalaryHistoryRecord, start: Date, end: Date) {
  const recordEnd = record.validTo ?? new Date(8640000000000000)
  return record.validFrom.getTime() <= end.getTime() && recordEnd.getTime() >= start.getTime()
}

function getOverlapDurationMs(record: SalaryHistoryRecord, start: Date, end: Date) {
  const overlapStart = maxDate(record.validFrom, start)
  const overlapEnd = minDate(record.validTo ?? end, end)
  return Math.max(0, overlapEnd.getTime() - overlapStart.getTime())
}

function pickMajorityHistoryForRange(records: SalaryHistoryRecord[], start: Date, end: Date) {
  const overlapping = records.filter((record) => overlapsRange(record, start, end))
  if (overlapping.length === 0) {
    return null
  }

  return overlapping
    .map((record) => ({
      record,
      overlapMs: getOverlapDurationMs(record, start, end),
    }))
    .sort((left, right) => {
      if (right.overlapMs !== left.overlapMs) {
        return right.overlapMs - left.overlapMs
      }

      return left.record.validFrom.getTime() - right.record.validFrom.getTime()
    })[0]?.record ?? null
}

function buildAnnualSalaryBreakdown(
  salaryHistory: SalaryHistoryRecord[],
  hireDate: Date,
  period: string,
) {
  const { start, end } = getAnnualBounds(period)
  const firstMonth = startOfUtcMonth(maxDate(start, hireDate))
  const salaryMonths: Array<{ monthStart: Date; record: SalaryHistoryRecord }> = []

  for (let cursor = firstMonth; cursor.getTime() <= end.getTime(); cursor = addUtcMonths(cursor, 1)) {
    const monthStart = cursor
    const monthEnd = endOfUtcMonth(cursor)
    const record = pickMajorityHistoryForRange(salaryHistory, monthStart, monthEnd)

    if (record) {
      salaryMonths.push({ monthStart, record })
    }
  }

  const breakdown: PayslipSalaryBreakdownItem[] = []

  for (const month of salaryMonths) {
    const monthKey = `${month.monthStart.getUTCFullYear()}-${String(month.monthStart.getUTCMonth() + 1).padStart(2, "0")}`
    const previous = breakdown[breakdown.length - 1]

    if (previous && previous.salary === month.record.resolvedSalary) {
      previous.months += 1
      previous.period = `${previous.period.split(" to ")[0]} to ${monthKey}`
      continue
    }

    breakdown.push({
      period: `${monthKey} to ${monthKey}`,
      salary: month.record.resolvedSalary,
      months: 1,
    })
  }

  return breakdown.map((item) => {
    const [startPeriod, endPeriod] = item.period.split(" to ")
    return {
      ...item,
      period: startPeriod === endPeriod ? startPeriod : `${startPeriod} to ${endPeriod}`,
    }
  })
}

async function fetchMatchingBonuses(
  employeeId: string,
  periodType: PayslipPeriodType,
  period: string,
) {
  if (periodType === "MONTHLY") {
    return prisma.bonus.findMany({
      where: {
        employeeId,
        period,
      },
      orderBy: [{ period: "asc" }, { createdAt: "asc" }],
    })
  }

  return prisma.bonus.findMany({
    where: {
      employeeId,
      period: { startsWith: period },
    },
    orderBy: [{ period: "asc" }, { createdAt: "asc" }],
  })
}

export class PayslipService {
  async generatePayslip(requestId: string) {
    try {
      const request = await prisma.request.findUnique({
        where: { id: requestId },
      })

      if (!request) {
        throw new AppError(`Request not found: ${requestId}`, 404)
      }
      if (request.type !== "DOCUMENT") {
        throw new AppError(`Request type is not DOCUMENT: ${request.type}`, 400)
      }
      if (request.status !== "APPROUVE") {
        throw new AppError(`Request status is not APPROUVE: ${request.status}`, 400)
      }

      if (!request.reason) {
        throw new AppError("Missing reason field on DOCUMENT request for payslip period", 400)
      }

      const parts = request.reason.split(":")
      if (parts.length !== 2) {
        throw new AppError(
          `Invalid reason format "${request.reason}". Expected "MONTHLY:2026-03" or "ANNUAL:2026"`,
          400,
        )
      }

      const [periodTypeRaw, period] = parts
      const periodType = periodTypeRaw.toUpperCase() as PayslipPeriodType

      if (!["MONTHLY", "ANNUAL"].includes(periodType) || !period) {
        throw new AppError(`Invalid periodType or period in reason: ${request.reason}`, 400)
      }

      const existingByRequest = await prisma.payslip.findUnique({
        where: { requestId },
      })
      if (existingByRequest) {
        return existingByRequest
      }

      const employee = await prisma.employee.findUnique({
        where: { id: request.employeeId },
        include: {
          salaryHistory: {
            orderBy: { validFrom: "asc" },
          },
        },
      })
      if (!employee) {
        throw new AppError(`Employee not found: ${request.employeeId}`, 404)
      }

      if (employee.salaryHistory.length === 0) {
        throw new AppError("Aucun historique de salaire trouve", 400)
      }

      const existingPeriodPayslip = await prisma.payslip.findFirst({
        where: {
          employeeId: employee.id,
          period,
          periodType,
        },
      })

      if (existingPeriodPayslip) {
        return existingPeriodPayslip
      }

      const matchedBonuses = await fetchMatchingBonuses(employee.id, periodType, period)
      const bonusTotal = matchedBonuses.reduce((sum, bonus) => sum + (bonus.amount || 0), 0)
      const bonuses: PayslipBonusDetailItem[] = matchedBonuses.map((bonus) => ({
        type: bonus.type,
        amount: bonus.amount,
        reason: bonus.reason,
        period: bonus.period,
      }))

      let baseSalary = 0
      let salaryOverride: number | null = null
      let resolvedSalary = 0
      let salaryBreakdown: PayslipSalaryBreakdownItem[] = []

      if (periodType === "MONTHLY") {
        const { start, end } = getMonthlyBounds(period)
        const record = pickMajorityHistoryForRange(employee.salaryHistory, start, end)

        if (!record) {
          throw new AppError("Aucun historique de salaire trouve", 400)
        }

        baseSalary = record.baseSalary
        salaryOverride = record.salaryOverride
        resolvedSalary = record.resolvedSalary
        salaryBreakdown = [
          {
            period,
            salary: record.resolvedSalary,
            months: 1,
          },
        ]
      } else {
        salaryBreakdown = buildAnnualSalaryBreakdown(employee.salaryHistory, employee.hireDate, period)

        if (salaryBreakdown.length === 0) {
          throw new AppError("Aucun historique de salaire trouve", 400)
        }

        resolvedSalary = salaryBreakdown.reduce((sum, item) => sum + item.salary * item.months, 0)
        baseSalary = resolvedSalary
        salaryOverride = null
      }

      const bonusDetails: PayslipBonusDetailsPayload = {
        salaryBreakdown,
        bonuses,
      }

      const payslip = await prisma.payslip.create({
        data: {
          employeeId: employee.id,
          requestId,
          period,
          periodType,
          baseSalary,
          salaryOverride,
          resolvedSalary,
          bonusTotal,
          bonusDetails: bonusDetails as unknown as Prisma.InputJsonValue,
        },
      })

      return payslip
    } catch (err) {
      console.error(`[PayslipService] generatePayslip failed for requestId=${requestId}:`, err)
      throw err
    }
  }
}

export const payslipService = new PayslipService()
