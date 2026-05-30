import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/services/server/auth.service";
import { apiError } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors";

interface BonusRuleInput {
  minScore: number;
  maxScore: number;
  percentage: number;
}

interface SalaryGradeInput {
  role: Role;
  level: number;
  baseSalary: number;
  description?: string | null;
}

class PayrollService {
  async listBonusRules(_user: CurrentUser) {
    return prisma.bonusRule.findMany({ orderBy: { minScore: "asc" } });
  }

  async createBonusRule(_user: CurrentUser, input: BonusRuleInput) {
    return prisma.bonusRule.create({ data: input });
  }

  async updateBonusRule(_user: CurrentUser, ruleId: string, input: BonusRuleInput) {
    return prisma.bonusRule.update({
      where: { id: ruleId },
      data: input,
    });
  }

  async deleteBonusRule(_user: CurrentUser, ruleId: string) {
    await prisma.bonusRule.delete({ where: { id: ruleId } });
    return { success: true };
  }

  async listSalaryGrades(_user: CurrentUser) {
    return prisma.salaryGrade.findMany({
      where: { role: { not: Role.RH } },
      orderBy: [{ role: "asc" }, { level: "asc" }],
    });
  }

  async createSalaryGrade(_user: CurrentUser, input: SalaryGradeInput) {
    if (input.role === Role.RH) {
      throw new AppError("Les grades salariaux RH sont desactives", 400);
    }

    return prisma.salaryGrade.create({ data: input });
  }

  async updateSalaryGrade(_user: CurrentUser, gradeId: string, input: SalaryGradeInput) {
    if (input.role === Role.RH) {
      throw new AppError("Les grades salariaux RH sont desactives", 400);
    }

    return prisma.salaryGrade.update({
      where: { id: gradeId },
      data: input,
    });
  }

  async deleteSalaryGrade(_user: CurrentUser, gradeId: string) {
    await prisma.salaryGrade.delete({ where: { id: gradeId } });
    return { success: true };
  }

  async listEvaluations(user: CurrentUser, employeeId: string) {
    if (!employeeId) {
      throw apiError("employeeId est requis", 400);
    }

    if (user.role === "CHEF") {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { managerId: true },
      });

      if (!employee || employee.managerId !== user.id) {
        throw apiError("Acces refuse", 403);
      }
    }

    return prisma.evaluation.findMany({
      where: { employeeId },
      include: { objectives: true },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const payrollService = new PayrollService();
