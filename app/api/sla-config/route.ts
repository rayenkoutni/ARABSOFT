import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { slaService } from "@/lib/services/server/sla.service";

export async function GET(req: Request) {
  try {
    await requireAuth(req, ["RH"]);
    const configs = await slaService.getConfigs();
    return NextResponse.json(configs);
  } catch (error) {
    return handleApiError(error, "Failed to fetch SLA configs");
  }
}
