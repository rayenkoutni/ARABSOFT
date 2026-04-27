import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const notifications = await prisma.notification.findMany({
    where: { 
      employeeId: user.id,
      NOT: { title: "Nouveau message" }
    },
    orderBy: { createdAt: "desc" },
    take: 50 // reasonable limit for UI
  })

  return NextResponse.json(notifications)
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await prisma.notification.deleteMany({
      where: { employeeId: user.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 })
  }
}
