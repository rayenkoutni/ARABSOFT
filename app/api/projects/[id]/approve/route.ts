import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { projectsService } from "@/lib/services/server/projects.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const { id } = await params;
    const result = await projectsService.reviewProjectChange(user, id, await req.json());
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to process approval");
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const { id } = await params;
    const result = await projectsService.listPendingChanges(user, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to fetch pending changes");
  }
}
