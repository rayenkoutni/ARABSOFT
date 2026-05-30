import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { employeesService } from "@/lib/services/server/employees.service";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(req, ["RH"]);
    const { id } = await params;
    const updated = await employeesService.assignSalaryGrade(id, await req.json());
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "Erreur lors de l'assignation du grade");
  }
}
