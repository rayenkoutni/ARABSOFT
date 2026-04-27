import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"
import {
  createSkillCatalogEntry,
  listSkillCatalog,
  skillCatalogInputSchema,
  SkillDomainError,
} from "@/lib/skills"
import { Prisma, Role, SkillType } from "@prisma/client"
import { ZodError } from "zod"

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const typeParam = searchParams.get("type")
    const includeInactive = searchParams.get("includeInactive") === "true"
    const type = typeParam && Object.values(SkillType).includes(typeParam as SkillType)
      ? (typeParam as SkillType)
      : undefined

    const skills = await listSkillCatalog(
      prisma,
      { id: user.id, role: user.role as Role, name: user.name },
      { type, includeInactive }
    )

    return NextResponse.json(skills)
  } catch (error) {
    if (error instanceof SkillDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Erreur lors du chargement du catalogue de compétences :", error)
    return NextResponse.json({ error: "Erreur lors du chargement du catalogue de compétences" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const input = skillCatalogInputSchema.parse(await req.json())
    const skill = await prisma.$transaction((tx: Prisma.TransactionClient) =>
      createSkillCatalogEntry(
        tx,
        { id: user.id, role: user.role as Role, name: user.name },
        input
      )
    )

    return NextResponse.json(skill, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Charge utile de compétence invalide" }, { status: 400 })
    }

    if (error instanceof SkillDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Erreur lors de la création d'une compétence :", error)
    return NextResponse.json({ error: "Erreur lors de la création de la compétence" }, { status: 500 })
  }
}
