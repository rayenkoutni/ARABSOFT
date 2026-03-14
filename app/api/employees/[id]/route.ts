import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "RH") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { name, email, role, department, position, managerId, resetPassword } = body

  // Check the employee exists
  const existing = await prisma.employee.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 })

  // If changing email, check it doesn't conflict
  if (email && email !== existing.email) {
    const emailTaken = await prisma.employee.findUnique({ where: { email } })
    if (emailTaken) {
      return NextResponse.json({ error: "Un compte avec cet email existe déjà" }, { status: 409 })
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (email !== undefined) updateData.email = email
  if (role !== undefined) updateData.role = role
  if (department !== undefined) updateData.department = department || null
  if (position !== undefined) updateData.position = position || null
  if (managerId !== undefined) updateData.managerId = managerId || null

  // Optional: reset password to a new temp password
  let tempPassword: string | null = null
  if (resetPassword) {
    tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase()
    updateData.password = await bcrypt.hash(tempPassword, 10)
    console.log(`[PASSWORD RESET] ${existing.name} (${existing.email}) — New temp password: ${tempPassword}`)
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: updateData,
    select: {
      id: true, name: true, email: true, role: true,
      department: true, position: true, managerId: true
    }
  })

  return NextResponse.json({ ...updated, tempPassword })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "RH") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  // Prevent self-deletion
  if (id === user.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 })
  }

  const existing = await prisma.employee.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 })

  // Delete related records first (notifications, history, requests)
  await prisma.notification.deleteMany({ where: { employeeId: id } })
  await prisma.requestHistory.deleteMany({ where: { actorId: id } })
  
  // Delete requests where employee is the requester
  const employeeRequests = await prisma.request.findMany({ where: { employeeId: id }, select: { id: true } })
  const requestIds = employeeRequests.map(r => r.id)
  if (requestIds.length > 0) {
    await prisma.requestHistory.deleteMany({ where: { requestId: { in: requestIds } } })
    await prisma.request.deleteMany({ where: { employeeId: id } })
  }

  // Unlink any subordinates (set their managerId to null)
  await prisma.employee.updateMany({
    where: { managerId: id },
    data: { managerId: null }
  })

  await prisma.employee.delete({ where: { id } })

  return NextResponse.json({ success: true, message: "Employé supprimé avec succès" })
}
