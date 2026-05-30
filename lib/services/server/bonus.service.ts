import { prisma } from "@/lib/prisma"
import { BonusType, Role } from "@prisma/client"
import { resolveSalary } from "@/lib/utils/salary"
import { AppError } from "@/lib/errors"

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
  async getMatchingBonusRule(avgScore: number) {
    return prisma.bonusRule.findFirst({
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
   * Create ANNUAL bonuses for all employees (RH only)
   */
  async createAnnualBonuses(period: string) {
    const employees = await prisma.employee.findMany({
      include: { salaryGrade: true },
    })

    // Pre-fetch all existing annual bonuses for the period to avoid N+1 queries
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

      const resolved = resolveSalary(emp)
      if (resolved <= 0) continue

      bonusesToCreate.push({
        employeeId: emp.id,
        amount: Math.round(resolved * 100) / 100,
        type: "ANNUAL" as BonusType,
        period,
      })
    }

    if (bonusesToCreate.length > 0) {
      await prisma.bonus.createMany({
        data: bonusesToCreate
      })
    }

    // Return the newly created bonuses (createMany returns a count, so we query them if needed, or return the payload list)
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
