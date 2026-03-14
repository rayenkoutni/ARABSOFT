import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

const SLA_DAYS: Record<string, number> = {
  CONGE: 3,
  AUTORISATION: 1,
  DOCUMENT: 2,
  PRET: 5,
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let requests

  if (user.role === "RH") {
    requests = await prisma.request.findMany({
      include: { employee: { select: { name: true } }, history: true },
      orderBy: { createdAt: "desc" }
    })
  } else if (user.role === "CHEF") {
    const teamIds = await prisma.employee.findMany({
      where: { managerId: user.id },
      select: { id: true }
    })
    requests = await prisma.request.findMany({
      where: { employeeId: { in: teamIds.map((e: { id: string }) => e.id) } },
      include: { employee: { select: { name: true } }, history: true },
      orderBy: { createdAt: "desc" }
    })
  } else {
    requests = await prisma.request.findMany({
      where: { employeeId: user.id },
      include: { history: true },
      orderBy: { createdAt: "desc" }
    })
  }

  return NextResponse.json(requests)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const approvalType = 
    body.type === "DOCUMENT" || body.type === "PRET" 
      ? "DIRECT_RH" 
      : "CHEF_THEN_RH"

  const initialStatus = body.isDraft
    ? "BROUILLON"
    : (approvalType === "DIRECT_RH" ? "EN_ATTENTE_RH" : "EN_ATTENTE_CHEF")

  const slaDeadline = new Date()
  slaDeadline.setDate(slaDeadline.getDate() + (SLA_DAYS[body.type] ?? 3))

  const request = await prisma.request.create({
    data: {
      type: body.type,
      approvalType,
      status: initialStatus,
      employeeId: user.id,
      managerId: user.managerId,
      slaDeadline,
      history: {
        create: {
          actorId: user.id,
          actorName: user.name,
          action: "CREATED",
          comment: body.comment ?? null
        }
      }
    },
    include: { history: true }
  })

  // Create notifications depending on who needs to approve it first
  if (approvalType === "DIRECT_RH") {
    // Notify all RH users
    const rhUsers = await prisma.employee.findMany({ where: { role: "RH" } })
    if (rhUsers.length > 0) {
      await prisma.notification.createMany({
        data: rhUsers.map((rh: { id: string }) => ({
          employeeId: rh.id,
          title: "Nouvelle demande",
          message: `${user.name} a soumis une nouvelle demande de type ${body.type}`
        }))
      })
    }
  } else if (user.managerId) {
    // Notify specific Manager
    await prisma.notification.create({
      data: {
        employeeId: user.managerId,
        title: "Nouvelle demande",
        message: `${user.name} de votre équipe a soumis une nouvelle demande de type ${body.type}`
      }
    })
  }

  return NextResponse.json(request)
}
