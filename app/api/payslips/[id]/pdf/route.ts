import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/services/server/auth.service";
import {
  generatePayslipPdf,
  getAuthorizedPayslipPdfPayload,
} from "@/lib/services/server/payslip-pdf.service";

function toFileNamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const payload = await getAuthorizedPayslipPdfPayload(id, {
      id: user.id,
      role: user.role,
    });

    if (!payload) {
      throw new Error("NOT_FOUND");
    }

    const pdfBuffer = await generatePayslipPdf(payload);
    const employeeSlug = toFileNamePart(payload.employee.name) || "employe";

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fiche-paie-${payload.downloadSlug}-${employeeSlug}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return handleApiError(apiError("Fiche de paie introuvable", 404));
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return handleApiError(apiError("Acces refuse", 403));
    }

    return handleApiError(error, "Impossible de generer le PDF");
  }
}
