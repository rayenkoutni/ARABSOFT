import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { calculateLeaveBusinessDays, isLeaveRequestType, parseDateOnlyToUtcDate } from "@/lib/leave-request"
import { prisma } from "@/lib/prisma"
import { requestInputSchema } from "@/lib/request-validation"
import { slaService } from "@/lib/services/server/sla.service"

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
  generatedDocument: {
    select: {
      id: true,
      fileName: true,
      documentType: true,
      reference: true,
      generatedAt: true,
    },
  },
  history: {
    orderBy: { createdAt: "asc" as const },
  },
}

const requestIncludeWithoutGeneratedDocument = {
  employee: requestInclude.employee,
  history: requestInclude.history,
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  try {
    let request

    try {
      request = await prisma.request.findUnique({
        where: { id },
        include: requestInclude,
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021" &&
        String(error.meta?.table).includes("GeneratedDocument")
      ) {
        console.warn("GeneratedDocument table is missing; retrying single request query without generatedDocument relation.")
        request = await prisma.request.findUnique({
          where: { id },
          include: requestIncludeWithoutGeneratedDocument,
        })
      } else {
        throw error
      }
    }

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (request.employeeId !== user.id && user.role === "COLLABORATEUR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(request)
  } catch (error) {
    console.error("Error fetching request:", error)
    return NextResponse.json({ error: "Failed to fetch request" }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const rawBody = await req.json()
  const parsedBody = requestInputSchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Requete invalide" }, { status: 400 })
  }

  const body = parsedBody.data

  try {
    const existingRequest = await prisma.request.findUnique({
      where: { id },
    })

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (existingRequest.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

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
          id: { not: existingRequest.id },
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

    const nextStatus = body.isDraft
      ? "BROUILLON"
      : approvalType === "DIRECT_RH"
        ? "EN_ATTENTE_RH"
        : "EN_ATTENTE_CHEF"

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        type: body.type,
        approvalType,
        status: nextStatus,
        managerId: employee.managerId,
        comment: body.comment,
        startDate,
        endDate,
        documentType: body.type === "DOCUMENT" ? body.documentType : null,
      },
      include: requestInclude,
    })

    // Re-initialize SLA from DB config after possible type/status change
    await slaService.initializeSla(id, body.type)

    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error("Error updating request:", error)
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}
