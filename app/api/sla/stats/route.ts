import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { slaService } from "@/lib/services/server/sla.service";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req, ["RH", "CHEF"]);
    const stats = await slaService.getStats(user);
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error, "Failed to fetch SLA stats");
  }
}
