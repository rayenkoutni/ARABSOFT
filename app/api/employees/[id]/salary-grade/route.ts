import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"
import { syncSalaryHistoryOnCompensationChange } from "@/lib/services/server/salary-history.service"

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
    const effectiveAt = new Date()

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.employee.findUnique({
        where: { id },
        select: {
          id: true,
          role: true,
          salaryGradeId: true,
          salaryOverride: true,
        },
      })

      if (!existing) {
        throw new Error("EMPLOYEE_NOT_FOUND")
      }

      if (body.salaryGradeId) {
        const grade = await tx.salaryGrade.findUnique({
          where: { id: body.salaryGradeId },
          select: { id: true, role: true },
        })

        if (!grade) {
          throw new Error("GRADE_NOT_FOUND")
        }

        if (grade.role !== existing.role) {
          throw new Error("GRADE_ROLE_MISMATCH")
        }
      }

      const employee = await tx.employee.update({
        where: { id },
        data: {
          salaryGradeId: body.salaryGradeId || null,
          salaryOverride: body.salaryOverride ?? null,
        },
        include: { salaryGrade: true },
      })

      await syncSalaryHistoryOnCompensationChange(tx, {
        employeeId: employee.id,
        previousSalaryGradeId: existing.salaryGradeId,
        previousSalaryOverride: existing.salaryOverride,
        nextSalaryGradeId: employee.salaryGradeId,
        nextSalaryOverride: employee.salaryOverride,
        fallbackRole: employee.role,
        validFrom: effectiveAt,
      })

      return employee
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json({ error: "Employe introuvable" }, { status: 404 })
    }

    if (error instanceof Error && error.message === "GRADE_NOT_FOUND") {
      return NextResponse.json({ error: "Grade salarial introuvable" }, { status: 404 })
    }

    if (error instanceof Error && error.message === "GRADE_ROLE_MISMATCH") {
      return NextResponse.json(
        { error: "Le grade salarial selectionne ne correspond pas au role du collaborateur" },
        { status: 400 },
      )
    }

    return NextResponse.json({ error: "Erreur lors de l'assignation du grade" }, { status: 500 })
  }
}
