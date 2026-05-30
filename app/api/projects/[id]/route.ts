import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { projectsService } from "@/lib/services/server/projects.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const result = await projectsService.updateProject(user, id, await req.json());
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
