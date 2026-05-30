import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { projectsService } from "@/lib/services/server/projects.service";
import { apiError, handleApiError } from "@/lib/utils/api-response";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["CHEF"]);
    const { id } = await params;
    const result = await projectsService.generateTasksForProject(user, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la generation des taches");
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["CHEF"]);
    const { id } = await params;
    const { tasks } = await req.json();
    if (!Array.isArray(tasks)) {
      throw apiError("Aucune tache a sauvegarder", 400);
    }
    const result = await projectsService.saveGeneratedTasks(user, id, tasks);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la sauvegarde des taches");
  }
}
