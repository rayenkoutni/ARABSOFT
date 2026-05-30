import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import { auditService } from "@/lib/services/server/audit.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") === "all" ? "all" : "filtered";
    const entity = url.searchParams.get("entity");
    const search = url.searchParams.get("search");
    const { workbook, filename } = await auditService.exportLogs(user, { mode, entity, search });

    return new Response(workbook, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to export audit logs");
  }
}
