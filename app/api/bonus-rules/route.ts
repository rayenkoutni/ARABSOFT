import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/services/server/auth.service";
import { payrollService } from "@/lib/services/server/payroll.service";
import { handleApiError } from "@/lib/utils/api-response";
import { optionalNumber, requireEnum, requireNumber } from "@/lib/utils/validate";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const result = await payrollService.listBonusRules(user);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement des regles");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const body = await req.json();
    const result = await payrollService.createBonusRule(user, {
      minScore: requireNumber(body?.minScore, "minScore"),
      maxScore: requireNumber(body?.maxScore, "maxScore"),
      percentage: requireNumber(body?.percentage, "percentage"),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Erreur lors de la creation de la regle");
  }
}
