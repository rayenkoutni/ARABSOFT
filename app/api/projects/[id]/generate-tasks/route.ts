import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { projectsService } from "@/lib/services/server/projects.service";
import { apiError, handleApiError } from "@/lib/utils/api-response";
import { optionalString, requireEnum, requireUuid } from "@/lib/utils/validate";

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
    const body = await req.json();
    const tasks = body?.tasks;
    if (!Array.isArray(tasks)) {
      throw apiError("Aucune tache a sauvegarder", 400);
    }
    const validatedTasks = tasks.map((task, index) => ({
      title: optionalString(task?.title) || (() => { throw apiError(`Le titre de la tache ${index + 1} est obligatoire`, 400); })(),
      description: optionalString(task?.description) || (() => { throw apiError(`La description de la tache ${index + 1} est obligatoire`, 400); })(),
      assignedUserId: requireUuid(task?.assignedUserId, `assignedUserId[${index}]`),
      dueDate: optionalString(task?.dueDate) || (() => { throw apiError(`La date d'echeance de la tache ${index + 1} est obligatoire`, 400); })(),
      priority: requireEnum(task?.priority, `priority[${index}]`, ["HIGH", "MEDIUM", "LOW"] as const),
      comment: optionalString(task?.comment) ?? null,
    }));
    const result = await projectsService.saveGeneratedTasks(user, id, validatedTasks);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la sauvegarde des taches");
  }
}
