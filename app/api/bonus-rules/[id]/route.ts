import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { payrollService } from "@/lib/services/server/payroll.service";
import { handleApiError } from "@/lib/utils/api-response";
import { requireNumber } from "@/lib/utils/validate";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const { id } = await params;
    const body = await req.json();
    const result = await payrollService.updateBonusRule(user, id, {
      minScore: requireNumber(body?.minScore, "minScore"),
      maxScore: requireNumber(body?.maxScore, "maxScore"),
      percentage: requireNumber(body?.percentage, "percentage"),
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la mise a jour");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const { id } = await params;
    const result = await payrollService.deleteBonusRule(user, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la suppression");
  }
}
