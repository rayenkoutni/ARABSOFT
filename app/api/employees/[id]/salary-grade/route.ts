import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  try {
    const updated = await prisma.employee.update({
      where: { id },
      data: {
        salaryGradeId: body.salaryGradeId || null,
        salaryOverride: body.salaryOverride ?? null,
      },
      include: { salaryGrade: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de l'assignation du grade" }, { status: 500 })
  }
}