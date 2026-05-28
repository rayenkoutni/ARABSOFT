import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  generatePayslipPdf,
  getAuthorizedPayslipPdfPayload,
} from "@/lib/services/server/payslip-pdf.service"

function toFileNamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  const { id } = await params

  try {
    const payload = await getAuthorizedPayslipPdfPayload(id, {
      id: user.id,
      role: user.role,
    })

    if (!payload) {
      return NextResponse.json({ error: "Fiche de paie introuvable" }, { status: 404 })
    }

    const pdfBuffer = await generatePayslipPdf(payload)
    const employeeSlug = toFileNamePart(payload.employee.name) || "employe"

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fiche-paie-${payload.downloadSlug}-${employeeSlug}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 })
    }

    console.error("Erreur generation PDF fiche de paie:", error)
    return NextResponse.json({ error: "Impossible de generer le PDF" }, { status: 500 })
  }
}
