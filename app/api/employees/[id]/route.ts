import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { handleApiError, apiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { employeesService } from "@/lib/services/server/employees.service";
import { employeeUpdateInputSchema } from "@/lib/skills";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const employee = await employeesService.getEmployeeById(user, id);
    return NextResponse.json(employee);
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement du collaborateur");
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const { id } = await params;
    const input = employeeUpdateInputSchema.parse(await req.json());
    const employee = await employeesService.updateEmployee(user, id, input);
    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleApiError(apiError(error.issues[0]?.message ?? "Payload employe invalide", 400));
    }

    return handleApiError(error, "Echec de la mise a jour du collaborateur");
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const { id } = await params;
    const result = await employeesService.deleteEmployee(user, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Echec de la suppression du collaborateur");
  }
}
