import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";

export async function POST(req: Request) {
  try {
    await requireAuth(req, ["RH"]);
    throw apiError("Les bonus annuels sont maintenant generes automatiquement en fin d'annee.", 403);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la creation des bonus annuels");
  }
}
