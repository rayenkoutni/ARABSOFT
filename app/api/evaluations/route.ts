import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { payrollService } from "@/lib/services/server/payroll.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const employeeId = new URL(req.url).searchParams.get("employeeId") || "";
    const result = await payrollService.listEvaluations(user, employeeId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement des evaluations");
  }
}
