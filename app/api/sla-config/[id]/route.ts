import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { slaService } from "@/lib/services/server/sla.service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(req, ["RH"]);
    const { id } = await params;
    const body = await req.json();
    const { maxHours } = body;

    if (typeof maxHours !== "number" || maxHours <= 0) {
      throw apiError("Invalid maxHours", 400);
    }

    const config = await slaService.updateConfig(id, maxHours);
    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error, "Failed to update SLA config");
  }
}
