import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { bonusService } from "@/lib/services/server/bonus.service"

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }
  if (user.role !== "RH") {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { period } = body

    if (!period || typeof period !== "string") {
      return NextResponse.json({ error: "Le champ period est requis" }, { status: 400 })
    }

    const created = await bonusService.createAnnualBonuses(period)

    return NextResponse.json({
      message: `${created.length} bonus annuels crees`,
      count: created.length,
      bonuses: created,
    })
  } catch {
    return NextResponse.json({ error: "Erreur lors de la creation des bonus annuels" }, { status: 500 })
  }
}
