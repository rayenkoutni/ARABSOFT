import { prisma } from "@/lib/prisma"
import { resolveSalary } from "@/lib/utils/salary"

export class PayslipService {
  async generatePayslip(requestId: string) {
    try {
      const request = await prisma.request.findUnique({
        where: { id: requestId },
      })

      if (!request) {
        throw new Error(`Request not found: ${requestId}`)
      }
      if (request.type !== "DOCUMENT") {
        throw new Error(`Request type is not DOCUMENT: ${request.type}`)
      }
      if (request.status !== "APPROUVE") {
        throw new Error(`Request status is not APPROUVE: ${request.status}`)
      }

      if (!request.reason) {
        throw new Error("Missing reason field on DOCUMENT request for payslip period")
      }

      const parts = request.reason.split(":")
      if (parts.length !== 2) {
        throw new Error(`Invalid reason format "${request.reason}". Expected "MONTHLY:2026-03" or "ANNUAL:2026"`)
      }

      const [periodTypeRaw, period] = parts
      const periodType = periodTypeRaw.toUpperCase() as "MONTHLY" | "ANNUAL"

      if (!["MONTHLY", "ANNUAL"].includes(periodType) || !period) {
        throw new Error(`Invalid periodType or period in reason: ${request.reason}`)
      }

      // Check for existing payslip (idempotent)
      const existing = await prisma.payslip.findUnique({
        where: { requestId },
      })
      if (existing) {
        return existing
      }

      // Fetch employee with salary info
      const employee = await prisma.employee.findUnique({
        where: { id: request.employeeId },
        include: { salaryGrade: true },
      })
      if (!employee) {
        throw new Error(`Employee not found: ${request.employeeId}`)
      }

      const baseSalary = employee.salaryGrade?.baseSalary ?? 0
      const salaryOverride = employee.salaryOverride ?? null
      const resolvedSalary = resolveSalary(employee)

      // Fetch matching bonuses
      let matchedBonuses: any[] = []
      if (periodType === "MONTHLY") {
        matchedBonuses = await prisma.bonus.findMany({
          where: {
            employeeId: employee.id,
            period: period,
          },
        })
      } else {
        // ANNUAL: period e.g. "2026", match any bonus whose period starts with year
        matchedBonuses = await prisma.bonus.findMany({
          where: {
            employeeId: employee.id,
            period: { startsWith: period },
          },
        })
      }

      const bonusTotal = matchedBonuses.reduce((sum: number, b: any) => sum + (b.amount || 0), 0)

      const bonusDetails = matchedBonuses.map((b: any) => ({
        type: b.type,
        amount: b.amount,
        reason: b.reason,
        period: b.period,
      }))

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
          bonusDetails,
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
