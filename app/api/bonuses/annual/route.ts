import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { bonusService } from "@/lib/services/server/bonus.service";

export async function POST(req: Request) {
  try {
    await requireAuth(req, ["RH"]);
    const body = await req.json();
    const { period } = body;

    if (!period || typeof period !== "string") {
      throw apiError("Le champ period est requis", 400);
    }

    const created = await bonusService.createAnnualBonuses(period);
    return NextResponse.json({
      message: `${created.length} bonus annuels crees`,
      count: created.length,
      bonuses: created,
    });
  } catch (error) {
    return handleApiError(error, "Erreur lors de la creation des bonus annuels");
  }
}
