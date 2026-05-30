import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { handleApiError, apiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { employeesService } from "@/lib/services/server/employees.service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const profile = await employeesService.getEmployeeSkills(user, id);
    return NextResponse.json(profile);
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement des competences du collaborateur");
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const input = employeesService.parseEmployeeSkillChanges(await req.json());
    const profile = await employeesService.updateEmployeeSkills(user, id, input);
    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleApiError(apiError(error.issues[0]?.message ?? "Charge utile de mise a jour des competences invalide", 400));
    }

    return handleApiError(error, "Erreur lors de la mise a jour des competences du collaborateur");
  }
}
