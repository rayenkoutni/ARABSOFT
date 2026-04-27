import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { logAudit } from "@/lib/audit"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { calculateLeaveBusinessDays, isLeaveRequestType, toDateOnlyValue } from "@/lib/leave-request"
import { prisma } from "@/lib/prisma"

const requestActionInclude = {
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

const INSUFFICIENT_LEAVE_BALANCE_MESSAGE =
  "Cet employe ne dispose plus d'un solde conge suffisant ; vous devez refuser cette demande."

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { action, comment } = await req.json()

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const request = await tx.request.findUnique({
        where: { id },
        include: {
          employee: true,
        },
      })

      if (!request) {
        throw new Error("NOT_FOUND")
      }

      let newStatus = request.status

      if (user.role === "CHEF" && request.status === "EN_ATTENTE_CHEF") {
        newStatus = action === "APPROVE" ? "EN_ATTENTE_RH" : "REJETE"
      } else if (user.role === "RH" && request.status === "EN_ATTENTE_RH") {
        newStatus = action === "APPROVE" ? "APPROUVE" : "REJETE"
      } else {
        throw new Error("ACTION_NOT_ALLOWED")
      }

      let deductedDays = 0

      if (action === "APPROVE" && isLeaveRequestType(request.type)) {
        const startDate = toDateOnlyValue(request.startDate)
        const endDate = toDateOnlyValue(request.endDate)

        if (!startDate || !endDate) {
          throw new Error("INVALID_LEAVE_RANGE")
        }

        deductedDays = calculateLeaveBusinessDays(startDate, endDate)
        if (deductedDays <= 0) {
          throw new Error("INVALID_LEAVE_RANGE")
        }

        if (request.employee.leaveBalance < deductedDays) {
          throw new Error("INSUFFICIENT_LEAVE_BALANCE")
        }
      }

      const statusUpdate = await tx.request.updateMany({
        where: {
          id,
          status: request.status,
        },
        data: {
          status: newStatus,
        },
      })

      if (statusUpdate.count === 0) {
        throw new Error("ACTION_NOT_ALLOWED")
      }

      if (newStatus === "APPROUVE" && action === "APPROVE" && isLeaveRequestType(request.type)) {
        const employeeBalanceUpdate = await tx.employee.updateMany({
          where: {
            id: request.employeeId,
            leaveBalance: { gte: deductedDays },
          },
          data: {
            leaveBalance: { decrement: deductedDays },
          },
        })

        if (employeeBalanceUpdate.count === 0) {
          throw new Error("INSUFFICIENT_LEAVE_BALANCE")
        }
      }

      const updated = await tx.request.update({
        where: { id },
        data: {
          history: {
            create: {
              actorId: user.id,
              actorName: user.name,
              action,
              comment: comment ?? null,
            },
          },
        },
        include: requestActionInclude,
      })

      return {
        request,
        updated,
        newStatus,
        deductedDays,
      }
    })

    const isRejected = result.newStatus === "REJETE"
    const isFullyApproved = result.newStatus === "APPROUVE"
    const isAwaitingHR = result.newStatus === "EN_ATTENTE_RH"

    let employeeMsg = ""
    if (isRejected) employeeMsg = `Votre demande (${result.request.type}) a ete rejetee par ${user.name}.`
    else if (isFullyApproved) employeeMsg = `Votre demande (${result.request.type}) a ete approuvee.`
    else if (isAwaitingHR) employeeMsg = `Votre demande (${result.request.type}) a ete validee par votre chef et est en attente RH.`

    if (employeeMsg) {
      await prisma.notification.create({
        data: {
          employeeId: result.request.employeeId,
          title: "Mise a jour de votre demande",
          message: employeeMsg,
        },
      })
    }

    if (isAwaitingHR) {
      const rhUsers = await prisma.employee.findMany({ where: { role: "RH" } })
      if (rhUsers.length > 0) {
        await prisma.notification.createMany({
          data: rhUsers.map((rh: { id: string }) => ({
            employeeId: rh.id,
            title: "Nouvelle validation requise",
            message: `La demande de ${result.request.employee.name} a ete validee par son manager et necessite votre validation finale.`,
          })),
        })
      }
    }

    const auditAction =
      action === "APPROVE"
        ? result.newStatus === "APPROUVE" || result.newStatus === "EN_ATTENTE_RH"
          ? "APPROVED"
          : "APPROVED_PENDING"
        : "REJECTED"

    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: auditAction,
      entity: "Request",
      entityId: id,
      details: {
        previousStatus: result.request.status,
        newStatus: result.newStatus,
        action,
        comment,
        deductedDays: result.deductedDays,
      },
    })

    return NextResponse.json(result.updated)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Demande introuvable." }, { status: 404 })
      }

      if (error.message === "ACTION_NOT_ALLOWED") {
        return NextResponse.json({ error: "Cette action n'est pas autorisee." }, { status: 403 })
      }

      if (error.message === "INSUFFICIENT_LEAVE_BALANCE") {
        return NextResponse.json({ error: INSUFFICIENT_LEAVE_BALANCE_MESSAGE }, { status: 409 })
      }

      if (error.message === "INVALID_LEAVE_RANGE") {
        return NextResponse.json({ error: "Les dates de ce conge sont invalides." }, { status: 400 })
      }
    }

    console.error("Error processing request action:", error)
    return NextResponse.json({ error: "Echec du traitement de l'action." }, { status: 500 })
  }
}
