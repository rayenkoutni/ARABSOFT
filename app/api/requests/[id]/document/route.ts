import { NextResponse } from "next/server"
import { readGeneratedDocumentFile } from "@/lib/documents"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      generatedDocument: true,
    },
  })

  if (!request) {
    return NextResponse.json({ error: "Demande introuvable." }, { status: 404 })
  }

  const canDownload =
    user.role === "RH" || (user.role === "COLLABORATEUR" && request.employeeId === user.id)

  if (!canDownload) {
    return NextResponse.json({ error: "Vous n'etes pas autorise a telecharger ce document." }, { status: 403 })
  }

  if (request.status !== "APPROUVE" || request.type !== "DOCUMENT") {
    return NextResponse.json({ error: "Ce document n'est pas disponible." }, { status: 404 })
  }

  if (!request.generatedDocument) {
    return NextResponse.json({ error: "Aucun document genere n'est disponible pour cette demande." }, { status: 404 })
  }

  try {
    const fileBuffer = await readGeneratedDocumentFile(request.generatedDocument.filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${request.generatedDocument.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("Error reading generated document:", error)
    return NextResponse.json({ error: "Impossible de lire le document genere." }, { status: 500 })
  }
}
