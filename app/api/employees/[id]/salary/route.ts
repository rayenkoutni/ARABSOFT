import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"
import { resolveSalary } from "@/lib/utils/salary"

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

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { salaryGrade: true },
  })

  if (!employee) {
    return NextResponse.json({ error: "Employé introuvable" }, { status: 404 })
  }

  const resolvedSalary = resolveSalary(employee)

  return NextResponse.json({
    grade: employee.salaryGrade,
    baseSalary: employee.salaryGrade?.baseSalary ?? 0,
    salaryOverride: employee.salaryOverride,
    resolvedSalary,
  })
}