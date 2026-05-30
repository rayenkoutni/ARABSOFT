import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { bonusService } from "@/lib/services/server/bonus.service";

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req, ["CHEF"]);
    const body = await req.json();
    const { employeeId, amount, reason, period } = body;
    const parsedAmount = Number(amount);

    if (!employeeId || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      throw apiError("employeeId et amount sont requis", 400);
    }

    const bonus = await bonusService.createExceptionalBonus({
      employeeId,
      amount: parsedAmount,
      reason,
      period,
      createdBy: user.id,
    });

    return NextResponse.json(bonus, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Erreur lors de la creation du bonus exceptionnel");
  }
}
