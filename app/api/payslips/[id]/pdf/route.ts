import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
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
      throw new AppError("Fiche de paie introuvable", 404);
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
    if (error instanceof AppError) {
      return handleApiError(apiError(error.message, error.status));
    }

    return handleApiError(error, "Impossible de generer le PDF");
  }
}
