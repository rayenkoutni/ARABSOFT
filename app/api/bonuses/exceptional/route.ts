import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { bonusService } from "@/lib/services/server/bonus.service"

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }
  if (user.role !== "CHEF") {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { employeeId, amount, reason, period } = body
    const parsedAmount = Number(amount)

    if (!employeeId || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "employeeId et amount sont requis" }, { status: 400 })
    }

    const bonus = await bonusService.createExceptionalBonus({
      employeeId,
      amount: parsedAmount,
      reason,
      period,
      createdBy: user.id,
    })

    return NextResponse.json(bonus, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur lors de la creation du bonus exceptionnel" },
      { status: 400 },
    )
  }
}
