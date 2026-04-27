import { NextResponse } from "next/server"
import { Prisma, Role } from "@prisma/client"
import { ZodError } from "zod"
import { logAudit } from "@/lib/audit"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"
import {
  deleteSkillCatalogEntry,
  skillCatalogUpdateSchema,
  SkillDomainError,
  updateSkillCatalogEntry,
} from "@/lib/skills"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  try {
    const { id } = await params
    const input = skillCatalogUpdateSchema.parse(await req.json())
    const skill = await prisma.$transaction((tx: Prisma.TransactionClient) =>
      updateSkillCatalogEntry(
        tx,
        { id: user.id, role: user.role as Role, name: user.name },
        id,
        input
      )
    )

    return NextResponse.json(skill)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Charge utile de competence invalide" },
        { status: 400 }
      )
    }

    if (error instanceof SkillDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Erreur lors de la mise a jour d'une competence :", error)
    return NextResponse.json({ error: "Erreur lors de la mise a jour de la competence" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  try {
    const { id } = await params
    const deletedSkill = await prisma.$transaction((tx: Prisma.TransactionClient) =>
      deleteSkillCatalogEntry(
        tx,
        { id: user.id, role: user.role as Role, name: user.name },
        id
      )
    )

    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "DELETED",
      entity: "Skill",
      entityId: deletedSkill.id,
      details: {
        name: deletedSkill.name,
        type: deletedSkill.type,
      },
    })

    return NextResponse.json({ success: true, skill: deletedSkill })
  } catch (error) {
    if (error instanceof SkillDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Erreur lors de la suppression d'une competence :", error)
    return NextResponse.json({ error: "Erreur lors de la suppression de la competence" }, { status: 500 })
  }
}
