import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const rules = await prisma.bonusRule.findMany({ orderBy: { minScore: "asc" } })
  return NextResponse.json(rules)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  try {
    const body = await req.json()

    const rule = await prisma.bonusRule.create({
      data: {
        minScore: body.minScore,
        maxScore: body.maxScore,
        percentage: body.percentage,
      },
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la création de la règle" }, { status: 500 })
  }
}