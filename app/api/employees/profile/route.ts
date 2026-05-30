import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { handleApiError, apiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { employeesService } from "@/lib/services/server/employees.service";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const employee = await employeesService.getProfile(user);
    return NextResponse.json(employee);
  } catch (error) {
    return handleApiError(error, "Failed to fetch profile");
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req);
    const input = employeesService.parseProfileUpdateInput(await req.json());
    const updated = await employeesService.updateProfile(user, input);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleApiError(apiError(error.issues[0]?.message ?? "Invalid profile payload", 400));
    }

    return handleApiError(error, "Failed to update profile");
  }
}
