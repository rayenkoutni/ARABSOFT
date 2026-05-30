import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth } from "@/lib/services/server/auth.service";
import { tasksService, TaskInputError } from "@/lib/services/server/tasks.service";
import { taskCreateInputSchema } from "@/lib/tasks";
import { apiError, handleApiError } from "@/lib/utils/api-response";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["CHEF", "COLLABORATEUR"]);
    const { id } = await params;
    const body = await req.json();
    const result = body.taskId
      ? await tasksService.updateProjectTaskStatus(user, id, body.taskId, body.status)
      : await tasksService.createTask(user, id, taskCreateInputSchema.parse(body));
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

export async function DELETE(req: Request) {
  try {
    const user = await requireAuth(req, ["CHEF"]);
    const taskId = new URL(req.url).searchParams.get("taskId");
    if (!taskId) {
      throw apiError("Task ID required", 400);
    }
    const result = await tasksService.deleteProjectTask(user, taskId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to delete task");
  }
}
