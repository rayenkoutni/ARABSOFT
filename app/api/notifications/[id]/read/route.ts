import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  try {
    // Only allow updating if the notification belongs to this user
    const updated = await prisma.notification.updateMany({
      where: { 
        id,
        employeeId: user.id
      },
      data: {
        read: true
      }
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: "Notification not found or unauthorized" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
  }
}
