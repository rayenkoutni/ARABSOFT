import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { tasksService } from "@/lib/services/server/tasks.service";
import { apiError, handleApiError } from "@/lib/utils/api-response";
import { optionalString } from "@/lib/utils/validate";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["COLLABORATEUR"]);
    const { id } = await params;
    const body = await req.json();
    const deliverableLink = optionalString(body?.deliverableLink);
    const deliverableNote = optionalString(body?.deliverableNote);
    if (!deliverableLink && !deliverableNote) {
      throw apiError("Veuillez fournir au moins un lien ou une note pour le livrable", 400);
    }
    const result = await tasksService.submitTaskForReview(user, id, { deliverableLink, deliverableNote });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la soumission");
  }
}
