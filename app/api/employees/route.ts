import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { logAudit } from "@/lib/audit"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { Prisma, Role } from "@prisma/client"
import { sendEmail } from "@/lib/mailer"
import { getTodayDateOnly, isDateOnlyWithinRange, toDateOnlyValue } from "@/lib/leave-request"
import {
  employeeCreateInputSchema,
  initializeCollaboratorSkillProfile,
  SkillDomainError,
} from "@/lib/skills"
import { ZodError } from "zod"

function buildAccountEmailHtml(data: { name: string; email: string; role: string; department: string; tempPassword: string; loginUrl: string }) {
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
      <h1 style="font-size: 24px; color: #1B3A6B; margin-bottom: 8px;">Bienvenue sur ArabSoft HR</h1>
      <p style="color: #64748B; margin-top: 0; margin-bottom: 24px; font-size: 14px;">Votre compte a ete cree avec succes par le service RH.</p>
      <div style="background-color: #F4F6FA; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; border-left: 4px solid #F5A623;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #1B3A6B; font-size: 15px;">Vos informations de connexion</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #64748B; width: 40%;">Nom complet</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.name}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Email</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.email}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Role</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.role}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Departement</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.department}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Mot de passe temporaire</td><td style="padding: 6px 0;"><span style="background-color: #1B3A6B; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 15px; letter-spacing: 0.1em;">${data.tempPassword}</span></td></tr>
        </table>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${data.loginUrl}" target="_blank" style="display: inline-block; background-color: #1B3A6B; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.02em;">Acceder au portail</a>
      </div>
    </div>
    <div style="background-color: #F5A623; height: 4px;"></div>
    <div style="text-align: center; background-color: #1B3A6B; padding: 24px 16px; border-radius: 0 0 32px 32px;">
      <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 8px;">Pour toute question, regardez vos notifications a la connexion.</p>
      <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.4);">(c) 2026 ArabSoft. Tous droits reserves.</p>
    </div>
  </div>
</div>`
}

function mapEmployeeListItem(employee: {
  id: string
  name: string
  email: string
  phone: string | null
  avatar: string | null
  role: Role
  department: string | null
  position: string | null
  managerId: string | null
  hireDate: Date | null
  leaveBalance: number | null
  requests: Array<{ id: string; startDate: Date | null; endDate: Date | null }>
}) {
  const todayDate = getTodayDateOnly()
  const onLeave = employee.requests.some((request) => {
    const startDate = toDateOnlyValue(request.startDate)
    const endDate = toDateOnlyValue(request.endDate)

    if (!startDate || !endDate) {
      return false
    }

    return isDateOnlyWithinRange(todayDate, startDate, endDate)
  })

  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    avatar: employee.avatar,
    role: employee.role,
    department: employee.department,
    position: employee.position,
    managerId: employee.managerId,
    hireDate: employee.hireDate ? employee.hireDate.toISOString() : null,
    leaveBalance: typeof employee.leaveBalance === "number" ? employee.leaveBalance : 0,
    onLeave,
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Non autorise" }, { status: 401 })

  try {
    if (user.role === "RH") {
      const employees = await prisma.employee.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          role: true,
          department: true,
          position: true,
          managerId: true,
          hireDate: true,
          leaveBalance: true,
          requests: {
            where: { type: "CONGE", status: "APPROUVE" },
            select: { id: true, startDate: true, endDate: true },
          },
        },
        orderBy: [
          { role: "asc" },
          { department: "asc" },
          { name: "asc" },
        ],
      })

      return NextResponse.json(
        employees.map((employee: (typeof employees)[number]) => mapEmployeeListItem(employee))
      )
    }

    if (user.role === "CHEF") {
      const team = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true, name: true, email: true, role: true, department: true },
      })
      return NextResponse.json(team)
    }

    const self = await prisma.employee.findUnique({
      where: { id: user.id },
      include: {
        manager: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(self)
  } catch (error) {
    console.error("Erreur lors du chargement des employes RH :", error)
    return NextResponse.json({ error: "Echec du chargement des collaborateurs" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Non autorise" }, { status: 401 })

  if (user.role !== "RH") {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 })
  }

  let input
  try {
    input = employeeCreateInputSchema.parse(await req.json())
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Payload employe invalide" }, { status: 400 })
    }

    return NextResponse.json({ error: "Payload employe invalide" }, { status: 400 })
  }

  const { name, email, phone, role, department, position, managerId, hireDate, subordinateIds, technicalSkills } = input

  const existing = await prisma.employee.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Un compte avec cet email existe deja" }, { status: 409 })
  }

  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  try {
    const newEmployee = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const employee = await tx.employee.create({
        data: {
          name,
          email,
          phone: phone || null,
          password: hashedPassword,
          role,
          department: department || null,
          position: position || null,
          managerId: managerId || null,
          hireDate,
          leaveBalance: 0,
        },
        select: {
          id: true, name: true, email: true, phone: true, role: true,
          department: true, position: true, managerId: true, hireDate: true, leaveBalance: true
        }
      })

      if (role === Role.COLLABORATEUR) {
        await initializeCollaboratorSkillProfile(tx, {
          employeeId: employee.id,
          technicalSkills,
          actor: {
            id: user.id,
            role: user.role as Role,
            name: user.name,
          },
        })
      }

      if (role === Role.CHEF && subordinateIds && subordinateIds.length > 0) {
        await tx.employee.updateMany({
          where: { id: { in: subordinateIds } },
          data: { managerId: employee.id }
        })
      }

      return employee
    })

    await prisma.notification.create({
      data: {
        employeeId: newEmployee.id,
        title: "Bienvenue sur ARABSOFT HR",
        message: `Bonjour ${name}, bienvenue sur le portail RH ! Veuillez changer votre mot de passe temporaire dans Parametres > Securite des votre premiere connexion.`
      }
    })

    await sendEmail({
      to: email,
      subject: "Bienvenue sur ArabSoft HR - Vos informations de connexion",
      html: buildAccountEmailHtml({
        name,
        email,
        role,
        department: department || "Non specifie",
        tempPassword,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`
      })
    })

    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "CREATED",
      entity: "Employee",
      entityId: newEmployee.id,
      details: { name, email, role, department, hireDate: hireDate.toISOString() },
    })

    return NextResponse.json({
      ...newEmployee,
      message: `Le compte de ${name} a ete cree avec succes. Les informations de connexion ont ete envoyees a ${email}.`
    })
  } catch (error) {
    if (error instanceof SkillDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Error creating employee:", error)
    return NextResponse.json({ error: "Echec de la creation du collaborateur" }, { status: 500 })
  }
}
