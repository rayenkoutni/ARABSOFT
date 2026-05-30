import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { payrollService } from "@/lib/services/server/payroll.service";
import { handleApiError } from "@/lib/utils/api-response";

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
    const result = await payrollService.createBonusRule(user, await req.json());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Erreur lors de la creation de la regle");
  }
}
