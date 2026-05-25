import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { logAudit } from "@/lib/audit"
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { sendEmail } from "@/lib/mailer"
import { employeeUpdateInputSchema } from "@/lib/skills"
import { ZodError } from "zod"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const { id } = await params

  // Permission checks
  if (user.role === "COLLABORATEUR" && user.id !== id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  if (user.role === "CHEF") {
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { managerId: true },
    })
    if (!employee || employee.managerId !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, name: true } },
      salaryGrade: true,
    },
  })

  if (!employee) {
    return NextResponse.json({ error: "Employé introuvable" }, { status: 404 })
  }

  return NextResponse.json(employee)
}

function buildPasswordResetEmailHtml(data: { name: string; email: string; tempPassword: string; loginUrl: string }) {
  return `<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; color: #212121">
  <div style="max-width: 600px; margin: auto">
    <div style="text-align: center; background-color: #1B3A6B; padding: 32px 16px; border-radius: 32px 32px 0 0;">
      <span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.04em;">
        ARAB<span style="color: #F5A623;">SOFT</span>
        <span style="font-size: 13px; color: rgba(255,255,255,0.5); border-left: 1px solid rgba(255,255,255,0.2); padding-left: 10px; margin-left: 4px; letter-spacing: 0.08em; font-weight: 400;">HR</span>
      </span>
    </div>
    <div style="background-color: #F5A623; height: 4px;"></div>
    <div style="padding: 32px 24px; background-color: #ffffff;">
      <h1 style="font-size: 24px; color: #1B3A6B; margin-bottom: 8px;">Reinitialisation du mot de passe</h1>
      <p style="color: #64748B; margin-top: 0; margin-bottom: 24px; font-size: 14px;">Un administrateur a reinitialise votre mot de passe. Voici vos nouvelles informations de connexion.</p>
      <div style="background-color: #F4F6FA; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; border-left: 4px solid #F5A623;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #1B3A6B; font-size: 15px;">Vos nouvelles informations de connexion</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #64748B; width: 40%;">Nom complet</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.name}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Email</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.email}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Nouveau mot de passe</td><td style="padding: 6px 0;"><span style="background-color: #1B3A6B; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 15px; letter-spacing: 0.1em;">${data.tempPassword}</span></td></tr>
        </table>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${data.loginUrl}" target="_blank" style="display: inline-block; background-color: #1B3A6B; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.02em;">Acceder au portail</a>
      </div>
    </div>
    <div style="background-color: #F5A623; height: 4px;"></div>
    <div style="text-align: center; background-color: #1B3A6B; padding: 24px 16px; border-radius: 0 0 32px 32px;">
      <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 8px;">Pour toute question, contactez le service RH.</p>
      <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.4);">(c) 2026 ArabSoft. Tous droits reserves.</p>
    </div>
  </div>
</div>`
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  if (user.role !== "RH") return NextResponse.json({ error: "Acces refuse" }, { status: 403 })

  const { id } = await params
  let body
  try {
    body = employeeUpdateInputSchema.parse(await req.json())
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Payload employe invalide" }, { status: 400 })
    }

    return NextResponse.json({ error: "Payload employe invalide" }, { status: 400 })
  }

  const { name, email, phone, role, department, position, managerId, hireDate, resetPassword, salaryGradeId, salaryOverride } = body

  let finalRole = role
  if (salaryGradeId) {
    const grade = await prisma.salaryGrade.findUnique({ where: { id: salaryGradeId } })
    if (grade) finalRole = grade.role
  }

  const existing = await prisma.employee.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Employe introuvable" }, { status: 404 })

  if (email && email !== existing.email) {
    const emailTaken = await prisma.employee.findUnique({ where: { email } })
    if (emailTaken) {
      return NextResponse.json({ error: "Un compte avec cet email existe deja" }, { status: 409 })
    }
  }

  // Role change validation
  if (role && role !== existing.role) {
    // If changing to Collaborateur, ensure they have a manager
    if (role === "COLLABORATEUR" && !managerId && !existing.managerId) {
      return NextResponse.json(
        { error: "Un collaborateur doit obligatoirement avoir un manager." },
        { status: 400 }
      )
    }

    // Role changes involving COLLABORATEUR require skill management (not implemented)
    if (role === "COLLABORATEUR" || existing.role === "COLLABORATEUR") {
      return NextResponse.json(
        { error: "La migration automatique des competences lors d'un changement de role n'est pas encore supportee." },
        { status: 400 }
      )
    }
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (email !== undefined) updateData.email = email
  if (phone !== undefined) updateData.phone = phone || null
  if (finalRole !== undefined) updateData.role = finalRole
  if (department !== undefined) updateData.department = department || null
  if (position !== undefined) updateData.position = position || null
  if (managerId !== undefined) updateData.managerId = managerId || null
  if (hireDate !== undefined) updateData.hireDate = hireDate
  if (salaryGradeId !== undefined) updateData.salaryGradeId = salaryGradeId || null
  if (salaryOverride !== undefined) updateData.salaryOverride = salaryOverride ?? null

  let tempPassword: string | null = null
  if (resetPassword) {
    tempPassword = crypto.randomBytes(6).toString("hex").toUpperCase()
    updateData.password = await bcrypt.hash(tempPassword, 10)
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: updateData,
    select: {
      id: true, name: true, email: true, phone: true, avatar: true, role: true,
      department: true, position: true, managerId: true, hireDate: true, leaveBalance: true,
      salaryGradeId: true, salaryOverride: true
    }
  })

  if (tempPassword) {
    await sendEmail({
      to: updated.email,
      subject: "Votre mot de passe a ete reinitialise - ArabSoft HR",
      html: buildPasswordResetEmailHtml({
        name: updated.name,
        email: updated.email,
        tempPassword,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`
      })
    })
  }

  logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATED",
    entity: "Employee",
    entityId: id,
    details: { name, email, role, department, position, hireDate: hireDate?.toISOString() },
  })

  return NextResponse.json({
    ...updated,
    message: tempPassword
      ? `Le mot de passe a ete reinitialise et un email a ete envoye a ${updated.email}`
      : updated
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  if (user.role !== "RH") return NextResponse.json({ error: "Acces refuse" }, { status: 403 })

  const { id } = await params

  if (id === user.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 })
  }

  const existing = await prisma.employee.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Employe introuvable" }, { status: 404 })

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.notification.deleteMany({ where: { employeeId: id } })
    await tx.requestHistory.deleteMany({ where: { actorId: id } })
    await tx.employeeSkillHistory.deleteMany({ where: { actorId: id } })
    await tx.employeeSkillHistory.deleteMany({ where: { employeeId: id } })
    await tx.employeeSkill.deleteMany({ where: { employeeId: id } })

    const employeeRequests = await tx.request.findMany({ where: { employeeId: id }, select: { id: true } })
    const requestIds = employeeRequests.map((r: { id: string }) => r.id)
    if (requestIds.length > 0) {
      await tx.requestHistory.deleteMany({ where: { requestId: { in: requestIds } } })
      await tx.request.deleteMany({ where: { employeeId: id } })
    }

    await tx.employee.updateMany({
      where: { managerId: id },
      data: { managerId: null }
    })

    await tx.employee.delete({ where: { id } })
  })

  logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "DELETED",
    entity: "Employee",
    entityId: id,
    details: { deletedName: existing.name, deletedEmail: existing.email },
  })

  return NextResponse.json({ success: true, message: "Employe supprime avec succes" })
}
