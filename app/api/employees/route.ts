import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { handleApiError, apiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { employeesService } from "@/lib/services/server/employees.service";
import { employeeCreateInputSchema } from "@/lib/skills";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");
    const employees = await employeesService.listEmployees(user, { page, limit });
    return NextResponse.json(employees);
  } catch (error) {
    return handleApiError(error, "Echec du chargement des collaborateurs");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const input = employeeCreateInputSchema.parse(await req.json());
    const employee = await employeesService.createEmployee(user, input);
    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleApiError(apiError(error.issues[0]?.message ?? "Payload employe invalide", 400));
    }

    return handleApiError(error, "Echec de la creation du collaborateur");
  }
}
