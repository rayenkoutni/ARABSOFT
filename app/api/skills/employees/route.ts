import { NextResponse } from "next/server"
import { Role } from "@prisma/client"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"
import { listScopedEmployeeSkills, SkillDomainError } from "@/lib/skills"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const employees = await listScopedEmployeeSkills(prisma, {
      id: user.id,
      role: user.role as Role,
      name: user.name,
    })

    return NextResponse.json(employees)
  } catch (error) {
    if (error instanceof SkillDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Erreur lors du chargement des compétences collaborateurs :", error)
    return NextResponse.json({ error: "Erreur lors du chargement des compétences collaborateurs" }, { status: 500 })
  }
}
