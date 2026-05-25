import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId")

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId est requis" }, { status: 400 })
  }

  // Permission: CHEF can only see their team, RH can see all
  if (user.role === "CHEF") {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { managerId: true },
    })
    if (!employee || employee.managerId !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }
  }

  const evaluations = await prisma.evaluation.findMany({
    where: { employeeId },
    include: {
      objectives: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(evaluations)
}