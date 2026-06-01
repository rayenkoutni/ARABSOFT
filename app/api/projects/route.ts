import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { projectsService } from "@/lib/services/server/projects.service";
import { handleApiError } from "@/lib/utils/api-response";
import { optionalString, requireString, requireUuid } from "@/lib/utils/validate";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = req.nextUrl;
    const projectId = searchParams.get("projectId");
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const result = projectId
      ? await projectsService.getProjectById(user, projectId)
      : await projectsService.listProjects(user, { page, limit });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to load projects");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const result = await projectsService.createProject(user, {
      name: requireString(body?.name, "name"),
      description: optionalString(body?.description),
      startDate: optionalString(body?.startDate) ?? null,
      endDate: optionalString(body?.endDate) ?? null,
      priority: requireString(body?.priority, "priority"),
      teamMemberIds: Array.isArray(body?.teamMemberIds)
        ? body.teamMemberIds.map((memberId: unknown) => requireUuid(memberId, "teamMemberId"))
        : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to create project");
  }
}
