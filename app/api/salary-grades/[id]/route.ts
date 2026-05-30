import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { payrollService } from "@/lib/services/server/payroll.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const { id } = await params;
    const result = await payrollService.updateSalaryGrade(user, id, await req.json());
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la mise a jour");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const { id } = await params;
    const result = await payrollService.deleteSalaryGrade(user, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la suppression");
  }
}
