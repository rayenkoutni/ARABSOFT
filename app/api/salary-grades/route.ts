import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const grades = await prisma.salaryGrade.findMany({
    orderBy: [{ role: "asc" }, { level: "asc" }],
  })

  return NextResponse.json(grades)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  try {
    const body = await req.json()

    const grade = await prisma.salaryGrade.create({
      data: {
        role: body.role,
        level: body.level,
        baseSalary: body.baseSalary,
        description: body.description,
      },
    })

    return NextResponse.json(grade, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erreur lors de la création du grade" }, { status: 500 })
  }
}