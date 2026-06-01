import { prisma } from "@/lib/prisma"
import { BonusType, Prisma, SalaryHistory } from "@prisma/client"
import { resolveSalary } from "@/lib/utils/salary"
import { AppError } from "@/lib/errors"
import { format } from "date-fns"
import { getAnnualBounds } from "@/lib/payslip"

const TASK_PRIORITY_MULTIPLIER = {
  LOW: 0.8,
  MEDIUM: 1,
  HIGH: 1.25,
} as const

const TASK_BONUS_DIVISOR = 20
const ANNUAL_BONUS_RATE = 0.03

type SalaryHistoryRecord = Pick<
  SalaryHistory,
  | "id"
  | "resolvedSalary"
  | "validFrom"
  | "validTo"
>
type BonusDbClient = Prisma.TransactionClient | typeof prisma

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

export class BonusService {
  /**
   * Resolve the effective salary for an employee
   */
  async resolveSalary(employeeId: string): Promise<number> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { salaryGrade: true },
    })

    if (!employee) throw new AppError("Employee not found", 404)

    return resolveSalary(employee)
  }

  /**
   * Get the matching bonus rule for a given average score
   */
  async getMatchingBonusRule(avgScore: number, db: BonusDbClient = prisma) {
    return db.bonusRule.findFirst({
      where: {
        minScore: { lte: avgScore },
        maxScore: { gte: avgScore },
      },
    })
  }

  /**
   * Create PERFORMANCE bonus when evaluation is validated
   */
  async createPerformanceBonus(evaluationId: string) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        objectives: true,
        employee: { include: { salaryGrade: true } },
      },
    })

    if (!evaluation || evaluation.status !== "VALIDATED") return null

    // Check if bonus already exists for this evaluation
    const existing = await prisma.bonus.findUnique({
      where: { evaluationId },
    })
    if (existing) return existing

    const objectives = evaluation.objectives
    if (objectives.length === 0) return null

    const scores = objectives
      .map((o: { score: number | null }) => o.score ?? 0)
      .filter((s: number) => s > 0)

    if (scores.length === 0) return null

    const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length

    const rule = await this.getMatchingBonusRule(avgScore)
    if (!rule || rule.percentage <= 0) return null

    const resolvedSalary = await this.resolveSalary(evaluation.employeeId)
    const amount = resolvedSalary * (rule.percentage / 100)

    let bonus = null
    try {
      bonus = await prisma.bonus.create({
        data: {
          employeeId: evaluation.employeeId,
          amount: Math.round(amount * 100) / 100,
          type: "PERFORMANCE",
          period: evaluation.period,
          evaluationId,
        },
      })
    } catch (err) {
      console.error(`[BonusService] Failed to create PERFORMANCE bonus for evaluation ${evaluationId}:`, err)
    }

    return bonus
  }

  /**
   * Create or update a PERFORMANCE bonus tied to a single approved task.
   * This gives collaborators a running monthly total on the dashboard while
   * still storing month-scoped bonus rows for payslip generation.
   */
  async createOrUpdateTaskPerformanceBonus(taskId: string, db: BonusDbClient = prisma) {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          include: { salaryGrade: true },
        },
      },
    })

    if (!task || task.status !== "DONE" || task.taskScore == null || !task.reviewedAt) {
      return null
    }

    const rule = await this.getMatchingBonusRule(task.taskScore, db)
    if (!rule || rule.percentage <= 0) {
      return null
    }

    const resolvedSalary = resolveSalary(task.assignee)
    if (resolvedSalary <= 0) {
      return null
    }

    const period = format(task.reviewedAt, "yyyy-MM")
    const priorityMultiplier = TASK_PRIORITY_MULTIPLIER[task.priority] ?? TASK_PRIORITY_MULTIPLIER.MEDIUM
    const amount = Math.round((resolvedSalary * (rule.percentage / 100) * priorityMultiplier / TASK_BONUS_DIVISOR) * 100) / 100

    if (amount <= 0) {
      return null
    }

    const reason = `[TASK_BONUS:${task.id}] ${task.title}`
    const existing = await db.bonus.findFirst({
      where: {
        employeeId: task.assigneeId,
        type: "PERFORMANCE",
        reason,
      },
    })

    if (existing) {
      return db.bonus.update({
        where: { id: existing.id },
        data: {
          amount,
          period,
        },
      })
    }

    return db.bonus.create({
      data: {
        employeeId: task.assigneeId,
        amount,
        type: "PERFORMANCE",
        period,
        reason,
      },
    })
  }

  /**
   * Create ANNUAL bonuses automatically at year end.
   * Each worked month contributes 3% of the employee's resolved monthly salary.
   */
  async createAnnualBonuses(period: string) {
    const { start, end } = getAnnualBounds(period)
    const employees = await prisma.employee.findMany({
      include: {
        salaryHistory: {
          orderBy: { validFrom: "asc" },
          select: {
            id: true,
            resolvedSalary: true,
            validFrom: true,
            validTo: true,
          },
        },
      },
    })

    const existingBonuses = await prisma.bonus.findMany({
      where: {
        type: "ANNUAL",
        period,
      },
      select: { employeeId: true }
    })
    const existingEmployeeIds = new Set(existingBonuses.map((b: { employeeId: string }) => b.employeeId))

    const bonusesToCreate = []

    for (const emp of employees) {
      if (existingEmployeeIds.has(emp.id)) continue
      if (emp.salaryHistory.length === 0) continue

      const firstMonth = startOfUtcMonth(maxDate(start, emp.hireDate))
      let monthsWorked = 0
      let amount = 0

      for (let cursor = firstMonth; cursor.getTime() <= end.getTime(); cursor = addUtcMonths(cursor, 1)) {
        const monthStart = cursor
        const monthEnd = endOfUtcMonth(cursor)
        const record = pickMajorityHistoryForRange(emp.salaryHistory, monthStart, monthEnd)

        if (!record || record.resolvedSalary <= 0) {
          continue
        }

        monthsWorked += 1
        amount += record.resolvedSalary * ANNUAL_BONUS_RATE
      }

      const roundedAmount = Math.round(amount * 100) / 100
      if (roundedAmount <= 0 || monthsWorked === 0) continue

      bonusesToCreate.push({
        employeeId: emp.id,
        amount: roundedAmount,
        type: "ANNUAL" as BonusType,
        period,
        reason: `Bonus annuel automatique - 3% x ${monthsWorked} mois travailles`,
      })
    }

    if (bonusesToCreate.length > 0) {
      await prisma.bonus.createMany({
        data: bonusesToCreate
      })
    }

    return bonusesToCreate
  }

  /**
   * Create EXCEPTIONAL bonus (CHEF for their team)
   */
  async createExceptionalBonus(params: {
    employeeId: string
    amount: number
    reason?: string
    period?: string
    createdBy: string // the chef's id
  }) {
    // Verify the chef manages this employee
    const employee = await prisma.employee.findUnique({
      where: { id: params.employeeId },
      select: { managerId: true },
    })

    if (!employee || employee.managerId !== params.createdBy) {
      throw new AppError("You can only create exceptional bonuses for employees you manage", 403)
    }

    return prisma.bonus.create({
      data: {
        employeeId: params.employeeId,
        amount: params.amount,
        type: "EXCEPTIONAL",
        reason: params.reason,
        period: params.period,
      },
    })
  }
}

export const bonusService = new BonusService()
