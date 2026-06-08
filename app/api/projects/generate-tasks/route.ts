import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { projectsService } from "@/lib/services/server/projects.service";
import { handleApiError } from "@/lib/utils/api-response";
import { optionalString, requireString, requireUuid } from "@/lib/utils/validate";

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req, ["CHEF"]);
    const body = await req.json();
    const result = await projectsService.generateTasksForProjectDraft(user, {
      name: requireString(body?.name, "name"),
      description: optionalString(body?.description),
      startDate: optionalString(body?.startDate) ?? null,
      endDate: optionalString(body?.endDate) ?? null,
      teamMemberIds: Array.isArray(body?.teamMemberIds)
        ? body.teamMemberIds.map((memberId: unknown) => requireUuid(memberId, "teamMemberId"))
        : [],
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la generation des taches du projet");
  }
}
