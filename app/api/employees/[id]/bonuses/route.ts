import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const { id: employeeId } = await params

  // Permission check
  if (user.role === "COLLABORATEUR" && user.id !== employeeId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  if (user.role === "CHEF") {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { managerId: true },
    })
    if (employee?.managerId !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }
  }

  const bonuses = await prisma.bonus.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(bonuses)
}