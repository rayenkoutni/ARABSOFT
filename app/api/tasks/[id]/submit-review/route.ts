import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { tasksService } from "@/lib/services/server/tasks.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["COLLABORATEUR"]);
    const { id } = await params;
    const result = await tasksService.submitTaskForReview(user, id, await req.json());
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la soumission");
  }
}
