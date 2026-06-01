import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/services/server/auth.service";
import { payrollService } from "@/lib/services/server/payroll.service";
import { handleApiError } from "@/lib/utils/api-response";
import { optionalString, requireEnum, requireNumber } from "@/lib/utils/validate";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const result = await payrollService.listSalaryGrades(user);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement des grades");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const body = await req.json();
    const result = await payrollService.createSalaryGrade(user, {
      role: requireEnum(body?.role, "role", Object.values(Role)),
      level: requireNumber(body?.level, "level"),
      baseSalary: requireNumber(body?.baseSalary, "baseSalary"),
      description: optionalString(body?.description) ?? null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Erreur lors de la creation du grade");
  }
}
