import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        department: true,
        position: true,
        hireDate: true,
        leaveBalance: true,
      }
    })

    return NextResponse.json(employee)
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { avatar, name, phone } = body

    console.log("🔧 Profile update - user:", user.id, "avatar:", avatar ? "yes" : "no")

    const updateData: any = {}

    if (avatar !== undefined) {
      // Handle null to remove, or string to set
      updateData.avatar = avatar === null ? null : avatar
    }
    if (name !== undefined) {
      updateData.name = name
    }
    if (phone !== undefined) {
      updateData.phone = phone
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No data to update" }, { status: 400 })
    }

    const updated = await prisma.employee.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true
      }
    })

    console.log("✅ Profile updated:", updated.id, "avatar:", updated.avatar ? "yes" : "no")

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
