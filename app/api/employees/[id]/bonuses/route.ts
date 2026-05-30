import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { employeesService } from "@/lib/services/server/employees.service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const bonuses = await employeesService.getEmployeeBonuses(user, id);
    return NextResponse.json(bonuses);
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement des bonus");
  }
}
