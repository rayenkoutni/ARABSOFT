import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { skillsService } from "@/lib/services/server/skills.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const result = await skillsService.listEmployeeSkills(user);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement des competences collaborateurs");
  }
}
