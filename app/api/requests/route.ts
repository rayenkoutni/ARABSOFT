import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { calculateLeaveBusinessDays, isLeaveRequestType, parseDateOnlyToUtcDate } from "@/lib/leave-request"
import { prisma } from "@/lib/prisma"
import { requestInputSchema } from "@/lib/request-validation"
import { getSlaDeadline } from "@/lib/sla"

const requestInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      email: true,
      leaveBalance: true,
      hireDate: true,
    },
  },
  history: {
    orderBy: { createdAt: "asc" as const },
  },
}

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const view = url.searchParams.get("view")

  let requests

  if (user.role === "RH") {
    let whereClause: Record<string, unknown> = {}

    if (view === "rh-pending") {
      whereClause = {
        status: { in: ["EN_ATTENTE_CHEF", "EN_ATTENTE_RH"] },
      }
    } else if (view === "rh-history") {
      whereClause = {
        status: { in: ["APPROUVE", "REJETE"] },
      }
    }

    requests = await prisma.request.findMany({
      where: whereClause,
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    })
  } else if (user.role === "CHEF") {
    const teamMembers = await prisma.employee.findMany({
      where: { managerId: user.id },
      select: { id: true },
    })
    const teamIds = teamMembers.map((employee: { id: string }) => employee.id)

    let whereClause: Record<string, unknown> = { employeeId: { in: teamIds } }

    if (view === "pending") {
      whereClause = {
        employeeId: { in: teamIds },
        approvalType: "CHEF_THEN_RH",
        status: { in: ["EN_ATTENTE_CHEF", "EN_ATTENTE_RH"] },
      }
    } else if (view === "history") {
      whereClause = {
        employeeId: { in: teamIds },
        approvalType: "CHEF_THEN_RH",
        status: { in: ["APPROUVE", "REJETE"] },
      }
    }

    requests = await prisma.request.findMany({
      where: whereClause,
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    })
  } else {
    requests = await prisma.request.findMany({
      where: { employeeId: user.id },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    })
  }

  return NextResponse.json(requests)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rawBody = await req.json()
  const parsedBody = requestInputSchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Requete invalide" }, { status: 400 })
  }

  const body = parsedBody.data

  const employee = await prisma.employee.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      managerId: true,
      leaveBalance: true,
    },
  })

  if (!employee) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
  }

  let startDate: Date | null = null
  let endDate: Date | null = null

  if (isLeaveRequestType(body.type)) {
    startDate = parseDateOnlyToUtcDate(body.startDate ?? "")
    endDate = parseDateOnlyToUtcDate(body.endDate ?? "")

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Les dates de debut et de fin sont obligatoires pour une demande de conge." },
        { status: 400 },
      )
    }

    const requestedDays = calculateLeaveBusinessDays(body.startDate ?? "", body.endDate ?? "")
    if (requestedDays > employee.leaveBalance) {
      return NextResponse.json(
        { error: "Solde conge insuffisant, veuillez changer la duree." },
        { status: 400 },
      )
    }

    const overlappingRequest = await prisma.request.findFirst({
      where: {
        employeeId: user.id,
        type: "CONGE",
        status: { in: ["EN_ATTENTE_CHEF", "EN_ATTENTE_RH", "APPROUVE"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    })

    if (overlappingRequest) {
      return NextResponse.json(
        { error: "Une demande de conge existe deja sur cette periode." },
        { status: 400 },
      )
    }
  }

  const approvalType =
    body.type === "DOCUMENT" || body.type === "PRET"
      ? "DIRECT_RH"
      : "CHEF_THEN_RH"

  const initialStatus = body.isDraft
    ? "BROUILLON"
    : approvalType === "DIRECT_RH"
      ? "EN_ATTENTE_RH"
      : "EN_ATTENTE_CHEF"

  const slaDeadline = await getSlaDeadline(body.type)

  const request = await prisma.request.create({
    data: {
      type: body.type,
      approvalType,
      status: initialStatus,
      employeeId: user.id,
      managerId: employee.managerId,
      comment: body.comment,
      startDate,
      endDate,
      slaDeadline,
      history: {
        create: {
          actorId: user.id,
          actorName: employee.name,
          action: "CREATED",
          comment: body.comment,
        },
      },
    },
    include: requestInclude,
  })

  if (approvalType === "DIRECT_RH") {
    const rhUsers = await prisma.employee.findMany({ where: { role: "RH" } })
    if (rhUsers.length > 0) {
      await prisma.notification.createMany({
        data: rhUsers.map((rh: { id: string }) => ({
          employeeId: rh.id,
          title: "Nouvelle demande",
          message: `${employee.name} a soumis une nouvelle demande de type ${body.type}`,
        })),
      })
    }
  } else if (employee.managerId) {
    await prisma.notification.create({
      data: {
        employeeId: employee.managerId,
        title: "Nouvelle demande",
        message: `${employee.name} de votre equipe a soumis une nouvelle demande de type ${body.type}`,
      },
    })
  }

  logAudit({
    actorId: user.id,
    actorName: employee.name,
    action: "CREATED",
    entity: "Request",
    entityId: request.id,
    details: {
      type: request.type,
      status: request.status,
      startDate: request.startDate?.toISOString() ?? null,
      endDate: request.endDate?.toISOString() ?? null,
    },
  })

  return NextResponse.json(request)
}
