import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import {
  generateDashboardReportPdf,
  getDashboardReportPayload,
} from "@/lib/services/server/dashboard-report.service";

export const runtime = "nodejs";

function toFileNamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req, ["RH", "CHEF"]);
    const payload = await getDashboardReportPayload({
      id: user.id,
      name: user.name,
      role: user.role,
    });
    const pdfBuffer = await generateDashboardReportPdf(payload);
    const audienceSlug = user.role === "RH" ? "global-rh" : "equipe-manager";
    const actorSlug = toFileNamePart(user.name) || "responsable";

    await logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "EXPORT_PDF",
      entity: "DashboardReport",
      entityId: `${user.role}-${Date.now()}`,
      details: {
        scope: user.role === "RH" ? "all" : "team",
        audience: audienceSlug,
        totalRequests: payload.stats.totalRequests,
        pendingRequests: payload.stats.pendingRequests,
        slaBreaches: payload.sla.breachedThisMonth,
      },
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapport-performance-${audienceSlug}-${actorSlug}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Impossible de generer le rapport PDF");
  }
}
