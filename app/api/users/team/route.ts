import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { employeesService } from "@/lib/services/server/employees.service";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req, ["CHEF"]);
    const teamMembers = await employeesService.getManagerTeam(user);
    return NextResponse.json(teamMembers);
  } catch (error) {
    return handleApiError(error, "Failed to fetch team members");
  }
}
