import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const notifications = await prisma.notification.findMany({
    where: { employeeId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50 // reasonable limit for UI
  })

  return NextResponse.json(notifications)
}
