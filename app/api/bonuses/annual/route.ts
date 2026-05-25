import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { bonusService } from "@/lib/services/server/bonus.service"

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { period } = body

    if (!period) {
      return NextResponse.json({ error: "Le champ period est requis" }, { status: 400 })
    }

    const created = await bonusService.createAnnualBonuses(period)

    return NextResponse.json({
      message: `${created.length} bonus annuels créés`,
      count: created.length,
      bonuses: created,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erreur lors de la création des bonus annuels" }, { status: 500 })
  }
}