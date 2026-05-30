import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { projectsService } from "@/lib/services/server/projects.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const projectId = new URL(req.url).searchParams.get("projectId");
    const result = projectId
      ? await projectsService.getProjectById(user, projectId)
      : await projectsService.listProjects(user);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to load projects");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const result = await projectsService.createProject(user, await req.json());
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to create project");
  }
}
