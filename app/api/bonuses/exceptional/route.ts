import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";

export async function POST(req: Request) {
  try {
    await requireAuth(req, ["CHEF"]);
    throw apiError("La creation manuelle de bonus exceptionnels est desactivee.", 403);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la creation du bonus exceptionnel");
  }
}
