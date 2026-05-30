import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { auditService } from "@/lib/services/server/audit.service";

export async function GET(req: Request) {
  try {
    await requireAuth(req, ["RH"]);
    const url = new URL(req.url);
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Number.parseInt(url.searchParams.get("limit") || "20", 10);
    const entity = url.searchParams.get("entity");
    const search = url.searchParams.get("search");
    const data = await auditService.getLogs({ page, limit, entity, search });
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "Failed to fetch audit logs");
  }
}
