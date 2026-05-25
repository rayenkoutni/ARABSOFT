import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { logAudit } from "@/lib/audit"
import {
  buildGeneratedDocumentFileName,
  buildGeneratedDocumentReference,
  generateWorkCertificatePdf,
  persistGeneratedDocumentFile,
  removeGeneratedDocumentFile,
} from "@/lib/documents"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { calculateLeaveBusinessDays, isLeaveRequestType, toDateOnlyValue } from "@/lib/leave-request"
import { prisma } from "@/lib/prisma"
import { notificationServerService } from "@/lib/services/server/notification.service"
import { payslipService } from "@/lib/services/server/payslip.service"
import { slaService } from "@/lib/services/server/sla.service"
import type { RequestStatus } from "@/lib/types"

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

const INSUFFICIENT_LEAVE_BALANCE_MESSAGE =
  "Cet employe ne dispose plus d'un solde conge suffisant ; vous devez refuser cette demande."
const DOCUMENT_GENERATION_FAILED_MESSAGE =
  "La demande n'a pas pu etre approuvee car la generation du document a echoue."

interface PreparedGeneratedDocument {
  documentType: string
  reference: string
  fileName: string
  filePath: string
  generatedAt: Date
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { action, comment } = await req.json()
  let preparedGeneratedDocument: PreparedGeneratedDocument | null = null
  let result: {
    request: {
      id: string
      status: string
      type: string
      documentType: string | null
      employeeId: string
      employee: { name: string }
    }
    updated: unknown
    newStatus: RequestStatus
    deductedDays: number
    generatedDocumentCreated: boolean
    generatedDocumentReference: string | null
  } | null = null

  try {
    const requestForGeneration =
      action === "APPROVE" && user.role === "RH"
        ? await prisma.request.findUnique({
            where: { id },
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  department: true,
                  position: true,
                  hireDate: true,
                },
              },
              generatedDocument: {
                select: {
                  id: true,
                },
              },
            },
          })
        : null

    const shouldPrepareDocument =
      requestForGeneration &&
      requestForGeneration.status === "EN_ATTENTE_RH" &&
      requestForGeneration.type === "DOCUMENT" &&
      requestForGeneration.documentType === "ATTESTATION_TRAVAIL" &&
      !requestForGeneration.generatedDocument

    if (shouldPrepareDocument) {
      try {
        const generatedAt = new Date()
        const reference = buildGeneratedDocumentReference(requestForGeneration.id, generatedAt)
        const fileName = buildGeneratedDocumentFileName(requestForGeneration.employee.name, reference)
        const actorProfile = await prisma.employee.findUnique({
          where: { id: user.id },
          select: {
            position: true,
          },
        })

        const pdfBuffer = await generateWorkCertificatePdf({
          employeeName: requestForGeneration.employee.name,
          employeePosition: requestForGeneration.employee.position ?? null,
          employeeDepartment: requestForGeneration.employee.department ?? null,
          hireDate: requestForGeneration.employee.hireDate,
          companyName: "ARAB SOFT",
          companyAddress: "Centre Urbain Nord, Tunis, Tunisie",
          companyCity: "Tunis",
          generatedAt,
          documentReference: reference,
          validatedByName: user.name,
          validatedByRole: actorProfile?.position || "Responsable Ressources Humaines",
        })

        const storedFile = await persistGeneratedDocumentFile({
          requestId: requestForGeneration.id,
          fileName,
          buffer: pdfBuffer,
        })

        preparedGeneratedDocument = {
          documentType: requestForGeneration.documentType ?? "ATTESTATION_TRAVAIL",
          reference,
          fileName: storedFile.fileName,
          filePath: storedFile.filePath,
          generatedAt,
        }
      } catch (generationError) {
        console.error("Error generating request document:", generationError)
        throw new Error("DOCUMENT_GENERATION_FAILED")
      }
    }

    result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const request = await tx.request.findUnique({
        where: { id },
        include: {
          employee: true,
          generatedDocument: true,
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

      const employee = await tx.employee.findUnique({
        where: { id: request.employeeId },
      })

      if (!employee) {
        throw new Error("EMPLOYEE_NOT_FOUND")
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

        if (employee.leaveBalance < deductedDays) {
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

      await tx.requestHistory.create({
        data: {
          requestId: id,
          actorId: user.id,
          actorName: user.name,
          action,
          comment: comment ?? null,
        },
      })

      let generatedDocumentCreated = false
      let generatedDocumentReference: string | null = null

      if (
        action === "APPROVE" &&
        newStatus === "APPROUVE" &&
        request.type === "DOCUMENT" &&
        request.documentType === "ATTESTATION_TRAVAIL" &&
        preparedGeneratedDocument &&
        !request.generatedDocument
      ) {
        await tx.generatedDocument.create({
          data: {
            requestId: request.id,
            employeeId: request.employeeId,
            documentType: preparedGeneratedDocument.documentType,
            reference: preparedGeneratedDocument.reference,
            fileName: preparedGeneratedDocument.fileName,
            filePath: preparedGeneratedDocument.filePath,
            generatedById: user.id,
            generatedByName: user.name,
            generatedAt: preparedGeneratedDocument.generatedAt,
          },
        })

        await tx.requestHistory.create({
          data: {
            requestId: request.id,
            actorId: user.id,
            actorName: user.name,
            action: "DOCUMENT_GENERATED",
            comment: "Document genere automatiquement.",
          },
        })

        generatedDocumentCreated = true
        generatedDocumentReference = preparedGeneratedDocument.reference
      }

      const updated = await tx.request.findUnique({
        where: { id },
        include: requestActionInclude,
      })

      if (!updated) {
        throw new Error("NOT_FOUND")
      }

      return {
        request: {
          id: request.id,
          status: request.status,
          type: request.type,
          documentType: request.documentType,
          employeeId: request.employeeId,
          employee: { name: request.employee.name },
        },
        updated,
        newStatus,
        deductedDays,
        generatedDocumentCreated,
        generatedDocumentReference,
      }
    })
  } catch (error) {
    if (preparedGeneratedDocument) {
      await removeGeneratedDocumentFile(preparedGeneratedDocument.filePath).catch((cleanupError) => {
        console.error("Error cleaning up generated document file:", cleanupError)
      })
    }

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

      if (error.message === "DOCUMENT_GENERATION_FAILED") {
        return NextResponse.json({ error: DOCUMENT_GENERATION_FAILED_MESSAGE }, { status: 500 })
      }
    }

    console.error("Error processing request action:", error)
    return NextResponse.json({ error: "Echec du traitement de l'action." }, { status: 500 })
  }

  if (!result) {
    return NextResponse.json({ error: "Echec du traitement de l'action." }, { status: 500 })
  }

  if (preparedGeneratedDocument && !result.generatedDocumentCreated) {
    await removeGeneratedDocumentFile(preparedGeneratedDocument.filePath).catch((cleanupError) => {
      console.error("Error cleaning up unused generated document file:", cleanupError)
    })
  }

  await slaService.transitionSla(id, result.newStatus)

  const isRejected = result.newStatus === "REJETE"
  const isFullyApproved = result.newStatus === "APPROUVE"
  const isAwaitingHR = result.newStatus === "EN_ATTENTE_RH"

  if (
    isFullyApproved &&
    result.request.type === "DOCUMENT" &&
    result.request.documentType !== "ATTESTATION_TRAVAIL"
  ) {
    try {
      await payslipService.generatePayslip(result.request.id)
    } catch (err) {
      console.error("Payslip auto-generation failed (approval still succeeded):", err)
    }
  }

  let employeeMsg = ""
  if (isRejected) employeeMsg = `Votre demande (${result.request.type}) a ete rejetee par ${user.name}.`
  else if (isFullyApproved) employeeMsg = `Votre demande (${result.request.type}) a ete approuvee.`
  else if (isAwaitingHR) employeeMsg = `Votre demande (${result.request.type}) a ete validee par votre chef et est en attente RH.`

  if (employeeMsg) {
    await notificationServerService.createNotification(
      result.request.employeeId,
      result.generatedDocumentCreated ? "Document disponible" : "Mise a jour de votre demande",
      result.generatedDocumentCreated
        ? "Votre attestation de travail est disponible."
        : employeeMsg,
    )
  }

  if (isAwaitingHR) {
    const rhUsers = await prisma.employee.findMany({ where: { role: "RH" } })
    if (rhUsers.length > 0) {
      await notificationServerService.notifyHR(
        "Nouvelle validation requise",
        `La demande de ${result.request.employee.name} a ete validee par son manager et necessite votre validation finale.`,
      )
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

  if (result.generatedDocumentCreated) {
    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "DOCUMENT_GENERATED",
      entity: "Request",
      entityId: id,
      details: {
        documentType: "ATTESTATION_TRAVAIL",
        reference: result.generatedDocumentReference,
      },
    })
  }

  return NextResponse.json(result.updated)
}
