import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // RH sees everyone, with leave status
  if (user.role === "RH") {
    const employees = await prisma.employee.findMany({
      select: { 
        id: true, name: true, email: true, 
        role: true, department: true, position: true, managerId: true,
        requests: {
          where: { type: "CONGE", status: "APPROUVE" },
          select: { id: true, status: true, type: true }
        }
      }
    })
    // Map to add a computed "onLeave" field
    const result = employees.map((e: typeof employees[number]) => ({
      ...e,
      onLeave: e.requests.length > 0
    }))
    return NextResponse.json(result)
  }

  // CHEF sees only their team
  if (user.role === "CHEF") {
    const team = await prisma.employee.findMany({
      where: { managerId: user.id },
      select: { id: true, name: true, email: true, 
                role: true, department: true }
    })
    return NextResponse.json(team)
  }

  // COLLABORATEUR sees only themselves + chef name
  const self = await prisma.employee.findUnique({
    where: { id: user.id },
    include: {
      manager: { select: { id: true, name: true } }
    }
  })
  return NextResponse.json(self)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only RH can create employees
  if (user.role !== "RH") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { name, email, role, department, position, managerId, subordinateIds } = body

  if (!name || !email || !role) {
    return NextResponse.json({ error: "Name, email, and role are required" }, { status: 400 })
  }

  // Check if email already exists
  const existing = await prisma.employee.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Un compte avec cet email existe déjà" }, { status: 409 })
  }

  // Generate a random temporary password
  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  // Use a transaction to create the employee and update subordinates if provided
  const newEmployee = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const emp = await tx.employee.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        department: department || null,
        position: position || null,
        managerId: managerId || null,
      },
      select: {
        id: true, name: true, email: true, role: true,
        department: true, position: true, managerId: true
      }
    })

    // If role is CHEF and subordinates are provided, update them
    if (role === 'CHEF' && subordinateIds && Array.isArray(subordinateIds) && subordinateIds.length > 0) {
      await tx.employee.updateMany({
        where: { id: { in: subordinateIds } },
        data: { managerId: emp.id }
      })
    }

    return emp
  })

  // Create a welcome notification for the new employee to change their password
  await prisma.notification.create({
    data: {
      employeeId: newEmployee.id,
      title: "Bienvenue sur ARABSOFT HR",
      message: `Bonjour ${name}, bienvenue sur le portail RH ! Veuillez changer votre mot de passe temporaire dans Paramètres > Sécurité dès votre première connexion.`
    }
  })

  // ─── EMAILJS INTEGRATION ────────────────────────────────────
  const serviceId = process.env.EMAILJS_SERVICE_ID
  const templateId = process.env.EMAILJS_TEMPLATE_ID
  const publicKey = process.env.EMAILJS_PUBLIC_KEY
  const privateKey = process.env.EMAILJS_PRIVATE_KEY

  if (serviceId && templateId && publicKey && privateKey) {
    try {
      const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            email: email,
            to_email: email,
            to_name: name,
            employee_name: name,
            employee_email: email,
            employee_role: role,
            employee_department: department || 'Non spécifié',
            temp_password: tempPassword,
            login_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
            company_phone: '+216 71 000 000',
            company_email: 'contact@arabsoft.tn'
          }
        })
      })

      if (!emailRes.ok) {
        const errText = await emailRes.text()
        console.error(`[EMAILJS ERROR] Status: ${emailRes.status}, Body: ${errText}`)
      } else {
        console.log(`[EMAILJS SUCCESS] Email sent to ${email}`)
      }
    } catch (err) {
      console.error('[EMAILJS FETCH ERROR]', err)
    }
  } else {
    console.warn('[EMAILJS SKIP] Missing environment variables. Logged to console instead.')
    console.log(`[SIMULATED EMAIL] To: ${email} — Temporary password: ${tempPassword}`)
  }

  return NextResponse.json({ 
    ...newEmployee, 
    message: `Le compte de ${name} a été créé avec succès. Les informations de connexion ont été envoyées à ${email}.`
  })
}
