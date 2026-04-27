import { NextResponse } from "next/server"
import { Prisma, Role } from "@prisma/client"
import { ZodError } from "zod"
import { logAudit } from "@/lib/audit"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"
import {
  applyManagerSkillChanges,
  employeeSkillChangeBatchSchema,
  getEmployeeSkillProfile,
  SkillDomainError,
} from "@/lib/skills"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, managerId: true },
    })

    if (!employee) {
      return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 })
    }

    const canRead =
      user.role === Role.RH ||
      user.id === id ||
      (user.role === Role.CHEF && employee.managerId === user.id)

    if (!canRead) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 })
    }

    const profile = await getEmployeeSkillProfile(prisma, id)
    return NextResponse.json(profile)
  } catch (error) {
    if (error instanceof SkillDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Erreur lors du chargement des compétences du collaborateur :", error)
    return NextResponse.json({ error: "Erreur lors du chargement des compétences du collaborateur" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const { id } = await params
    const input = employeeSkillChangeBatchSchema.parse(await req.json())

    const profile = await prisma.$transaction((tx: Prisma.TransactionClient) =>
      applyManagerSkillChanges(tx, {
        employeeId: id,
        actor: {
          id: user.id,
          role: user.role as Role,
          name: user.name,
        },
        changes: input.changes,
      })
    )

    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "UPDATED",
      entity: "EmployeeSkill",
      entityId: id,
      details: {
        changeCount: input.changes.length,
        changes: input.changes,
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Charge utile de mise à jour des compétences invalide" }, { status: 400 })
    }

    if (error instanceof SkillDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Erreur lors de la mise à jour des compétences du collaborateur :", error)
    return NextResponse.json({ error: "Erreur lors de la mise à jour des compétences du collaborateur" }, { status: 500 })
  }
}
