import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { bonusService } from "@/lib/services/server/bonus.service"

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== "CHEF") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { employeeId, amount, reason, period } = body

    if (!employeeId || !amount) {
      return NextResponse.json({ error: "employeeId et amount sont requis" }, { status: 400 })
    }

    const bonus = await bonusService.createExceptionalBonus({
      employeeId,
      amount,
      reason,
      period,
      createdBy: user.id,
    })

    return NextResponse.json(bonus, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur lors de la création du bonus exceptionnel" },
      { status: 400 }
    )
  }
}