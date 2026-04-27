import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { current, new: newPassword } = await req.json()

    // Get employee from database
    const employee = await prisma.employee.findUnique({
      where: { id: user.id }
    })

    if (!employee) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify current password
    const isValid = await bcrypt.compare(current, employee.password)
    if (!isValid) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 })
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.employee.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    return NextResponse.json({ message: "Mot de passe mis à jour avec succès" })
  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json({ error: "Erreur lors du changement de mot de passe" }, { status: 500 })
  }
}
