import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { maxHours } = body

  if (typeof maxHours !== 'number' || maxHours <= 0) {
    return NextResponse.json({ error: "Invalid maxHours" }, { status: 400 })
  }

  const config = await prisma.slaConfig.update({
    where: { id: params.id },
    data: { maxHours },
  })

  return NextResponse.json(config)
}