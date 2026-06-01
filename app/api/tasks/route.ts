import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth } from "@/lib/services/server/auth.service";
import { tasksService, TaskInputError } from "@/lib/services/server/tasks.service";
import { taskCreateInputSchema } from "@/lib/tasks";
import { apiError, handleApiError } from "@/lib/utils/api-response";
import { requireUuid } from "@/lib/utils/validate";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const result = await tasksService.listTasks(user, {
      assigneeId: searchParams.get("assigneeId"),
      excludeStatus: searchParams.get("excludeStatus"),
    }, { page, limit });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement des taches");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req, ["CHEF", "COLLABORATEUR"]);
    const body = await req.json();
    const projectId = requireUuid(body?.projectId, "projectId");
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
