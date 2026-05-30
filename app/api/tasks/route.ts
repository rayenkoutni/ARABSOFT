import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth } from "@/lib/services/server/auth.service";
import { tasksService, TaskInputError } from "@/lib/services/server/tasks.service";
import { taskCreateInputSchema } from "@/lib/tasks";
import { apiError, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const result = await tasksService.listTasks(user, {
      assigneeId: searchParams.get("assigneeId"),
      excludeStatus: searchParams.get("excludeStatus"),
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement des taches");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req, ["CHEF", "COLLABORATEUR"]);
    const body = await req.json();
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    if (!projectId) {
      throw apiError("Le projet cible est obligatoire.", 400);
    }
    const input = taskCreateInputSchema.parse(body);
    const result = await tasksService.createTask(user, projectId, input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleApiError(apiError(error.issues[0]?.message ?? "Charge utile de creation de tache invalide.", 400));
    }
    if (error instanceof TaskInputError) {
      return handleApiError(apiError(error.message, error.status));
    }
    return handleApiError(error, "Erreur lors de la creation de la tache");
  }
}
