import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { projectsService } from "@/lib/services/server/projects.service";
import { handleApiError } from "@/lib/utils/api-response";
import { optionalString, requireUuid } from "@/lib/utils/validate";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    if (Array.isArray(body?.teamMemberIds)) {
      body.teamMemberIds = body.teamMemberIds.map((memberId: unknown) => requireUuid(memberId, "teamMemberId"));
    }
    if (body?.name !== undefined) {
      body.name = optionalString(body.name);
    }
    if (body?.description !== undefined) {
      body.description = optionalString(body.description) ?? null;
    }
    if (body?.startDate !== undefined) {
      body.startDate = optionalString(body.startDate) ?? null;
    }
    if (body?.endDate !== undefined) {
      body.endDate = optionalString(body.endDate) ?? null;
    }
    if (body?.priority !== undefined) {
      body.priority = optionalString(body.priority);
    }
    if (body?.status !== undefined) {
      body.status = optionalString(body.status);
    }
    const result = await projectsService.updateProject(user, id, body);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to update project");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const result = await projectsService.deleteProject(user, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to delete project");
  }
}
