import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { action, comment } = await req.json()
  const request = await prisma.request.findUnique({ 
    where: { id },
    include: { employee: true }
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let newStatus = request.status

  if (user.role === "CHEF" && request.status === "EN_ATTENTE_CHEF") {
    newStatus = action === "APPROVE" ? "EN_ATTENTE_RH" : "REJETE"
  } else if (user.role === "RH" && request.status === "EN_ATTENTE_RH") {
    newStatus = action === "APPROVE" ? "APPROUVE" : "REJETE"
  } else {
    return NextResponse.json({ error: "Action not allowed" }, { status: 403 })
  }

  const updated = await prisma.request.update({
    where: { id },
    data: {
      status: newStatus,
      history: {
        create: {
          actorId: user.id,
          actorName: user.name,
          action,
          comment: comment ?? null
        }
      }
    },
    include: { history: true }
  })

  // Notifications logic
  const isRejected = newStatus === "REJETE"
  const isFullyApproved = newStatus === "APPROUVE"
  const isAwaitingHR = newStatus === "EN_ATTENTE_RH"

  // 1. Notify the Employee who created the request
  let employeeMsg = ""
  if (isRejected) employeeMsg = `Votre demande (${request.type}) a été rejetée par ${user.name}.`
  else if (isFullyApproved) employeeMsg = `Votre demande (${request.type}) a été approuvée.`
  else if (isAwaitingHR) employeeMsg = `Votre demande (${request.type}) a été validée par votre chef et est en attente RH.`

  if (employeeMsg) {
    await prisma.notification.create({
      data: {
        employeeId: request.employeeId,
        title: "Mise à jour de votre demande",
        message: employeeMsg
      }
    })
  }

  // 2. If it's now waiting for HR, notify all HRs
  if (isAwaitingHR) {
    const rhUsers = await prisma.employee.findMany({ where: { role: "RH" } })
    if (rhUsers.length > 0) {
      await prisma.notification.createMany({
        data: rhUsers.map((rh: { id: string }) => ({
          employeeId: rh.id,
          title: "Nouvelle validation requise",
          message: `La demande de ${request.employee.name} a été validée par son manager et nécessite votre validation finale.`
        }))
      })
    }
  }

  return NextResponse.json(updated)
}
