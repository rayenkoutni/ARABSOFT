import { Prisma, type ApprovalType, type RequestStatus, type RequestType } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { APPROVAL_TYPE, REQUEST_STATUS, REQUEST_TYPE, ROLE } from "@/lib/constants";
import {
  calculateLeaveBusinessDays,
  isLeaveRequestType,
  parseDateOnlyToUtcDate,
  toDateOnlyValue,
} from "@/lib/leave-request";
import { prisma } from "@/lib/services/prisma.service";
import type { CurrentUser } from "@/lib/services/server/auth.service";
import { documentsService, type PreparedGeneratedDocument } from "@/lib/services/server/documents.service";
import { notificationServerService } from "@/lib/services/server/notification.service";
import { payslipService } from "@/lib/services/server/payslip.service";
import { slaService } from "@/lib/services/server/sla.service";
import { ApiError } from "@/lib/api-response";
import { removeGeneratedDocumentFile } from "@/lib/documents";
import { AppError } from "@/lib/errors";

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
  payslip: {
    select: {
      id: true,
    },
  },
  history: {
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.RequestInclude;

const requestIncludeWithoutGeneratedDocument = {
  employee: requestInclude.employee,
  payslip: requestInclude.payslip,
  history: requestInclude.history,
} satisfies Prisma.RequestInclude;

export interface RequestMutationInput {
  type: RequestType;
  comment?: string | null;
  reason?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  documentType?: string | null;
  isDraft?: boolean;
}

class RequestServerService {
  private readonly insufficientLeaveBalanceMessage =
    "Cet employe ne dispose plus d'un solde conge suffisant ; vous devez refuser cette demande.";

  private async assertRequestAccessForUser(
    user: CurrentUser,
    request: { employeeId: string; managerId: string | null },
  ) {
    if (user.role === ROLE.HR) {
      return;
    }

    if (user.role === ROLE.MANAGER) {
      if (request.managerId !== user.id) {
        throw new AppError("Forbidden", 403);
      }
      return;
    }

    if (request.employeeId !== user.id) {
      throw new AppError("Forbidden", 403);
    }
  }

  private getApprovalType(type: RequestType): ApprovalType {
    return type === REQUEST_TYPE.DOCUMENT || type === REQUEST_TYPE.LOAN
      ? APPROVAL_TYPE.DIRECT_HR
      : APPROVAL_TYPE.MANAGER_THEN_HR;
  }

  private async validatePayslipGenerationPreconditions(requestId: string) {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        employee: {
          select: {
            id: true,
            salaryHistory: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!request) {
      throw new ApiError("Demande introuvable.", 404);
    }

    if (!request.reason) {
      throw new ApiError("La periode de fiche de paie est invalide.", 400);
    }

    const [periodType, period] = request.reason.split(":");
    if (!periodType || !period || !["MONTHLY", "ANNUAL"].includes(periodType)) {
      throw new ApiError("La periode de fiche de paie est invalide.", 400);
    }

    if (request.employee.salaryHistory.length === 0) {
      throw new ApiError("Aucun historique de salaire trouve", 400);
    }

    const existingPayslip = await prisma.payslip.findFirst({
      where: {
        employeeId: request.employee.id,
        period,
        periodType: periodType as "MONTHLY" | "ANNUAL",
      },
      select: { id: true },
    });

    if (existingPayslip) {
      throw new ApiError("Une fiche de paie existe deja pour cette periode.", 409);
    }
  }

  private getNextRequestStatus(user: CurrentUser, currentStatus: RequestStatus, action: string) {
    if (user.role === ROLE.MANAGER && currentStatus === REQUEST_STATUS.PENDING_MANAGER) {
      return action === "APPROVE" ? REQUEST_STATUS.PENDING_HR : REQUEST_STATUS.REJECTED;
    }

    if (user.role === ROLE.HR && currentStatus === REQUEST_STATUS.PENDING_HR) {
      return action === "APPROVE" ? REQUEST_STATUS.APPROVED : REQUEST_STATUS.REJECTED;
    }

    throw new ApiError("Cette action n'est pas autorisee.", 403);
  }

  private async transitionSlaWithinTransaction(
    tx: Prisma.TransactionClient,
    requestId: string,
    requestType: RequestType,
    currentOwner: string | null,
    newStatus: RequestStatus,
    currentDeadline: Date | null,
  ) {
    let newOwner = currentOwner;

    if (newStatus === REQUEST_STATUS.PENDING_MANAGER) {
      newOwner = ROLE.MANAGER;
    } else if (newStatus === REQUEST_STATUS.PENDING_HR) {
      newOwner = ROLE.HR;
    }

    let newDeadline = currentDeadline;
    if (newOwner !== currentOwner) {
      const config = await tx.slaConfig.findUnique({
        where: { requestType },
      });
      if (config) {
        newDeadline = slaService.calculateDeadline(new Date(), config.maxHours);
      }
    }

    return tx.request.update({
      where: { id: requestId },
      data: {
        currentOwner: newOwner,
        slaDeadline: newDeadline,
        slaStatus: "MET",
        slaBreached: false,
        slaNearingNotified: false,
        slaLastNotifiedAt: null,
      },
    });
  }

  private getInitialStatus(approvalType: ApprovalType, isDraft = false): RequestStatus {
    if (isDraft) {
      return REQUEST_STATUS.DRAFT;
    }

    return approvalType === APPROVAL_TYPE.DIRECT_HR
      ? REQUEST_STATUS.PENDING_HR
      : REQUEST_STATUS.PENDING_MANAGER;
  }

  private async findRequestsWithFallback(args: {
    where: Prisma.RequestWhereInput;
    orderBy: Prisma.RequestOrderByWithRelationInput;
  }) {
    try {
      return await prisma.request.findMany({
        where: args.where,
        include: requestInclude,
        orderBy: args.orderBy,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021" &&
        String(error.meta?.table).includes("GeneratedDocument")
      ) {
        return prisma.request.findMany({
          where: args.where,
          include: requestIncludeWithoutGeneratedDocument,
          orderBy: args.orderBy,
        });
      }

      throw error;
    }
  }

  private async findRequestByIdWithFallback(id: string) {
    try {
      return await prisma.request.findUnique({
        where: { id },
        include: requestInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021" &&
        String(error.meta?.table).includes("GeneratedDocument")
      ) {
        return prisma.request.findUnique({
          where: { id },
          include: requestIncludeWithoutGeneratedDocument,
        });
      }

      throw error;
    }
  }

  private async getEmployeeForRequestUser(userId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        managerId: true,
        leaveBalance: true,
      },
    });

    if (!employee) {
      throw new ApiError("Utilisateur introuvable", 404);
    }

    return employee;
  }

  private async validateRequestDates(
    input: RequestMutationInput,
    employeeId: string,
    leaveBalance: number,
    excludeRequestId?: string,
  ) {
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (!isLeaveRequestType(input.type)) {
      return { startDate, endDate };
    }

    startDate = parseDateOnlyToUtcDate(input.startDate ?? "");
    endDate = parseDateOnlyToUtcDate(input.endDate ?? "");

    if (!startDate || !endDate) {
      throw new ApiError("Les dates de debut et de fin sont obligatoires pour une demande de conge.", 400);
    }

    const requestedDays = calculateLeaveBusinessDays(input.startDate ?? "", input.endDate ?? "");
    if (requestedDays > leaveBalance) {
      throw new ApiError("Solde conge insuffisant, veuillez changer la duree.", 400);
    }

    const overlappingRequest = await prisma.request.findFirst({
      where: {
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
        employeeId,
        type: REQUEST_TYPE.LEAVE,
        status: {
          in: [REQUEST_STATUS.PENDING_MANAGER, REQUEST_STATUS.PENDING_HR, REQUEST_STATUS.APPROVED],
        },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });

    if (overlappingRequest) {
      throw new ApiError("Une demande de conge existe deja sur cette periode.", 400);
    }

    return { startDate, endDate };
  }

  async getRequestsForUser(user: CurrentUser, view: string | null) {
    if (user.role === ROLE.HR) {
      let where: Prisma.RequestWhereInput = {};

      if (view === "rh-pending") {
        where = {
          status: { in: [REQUEST_STATUS.PENDING_MANAGER, REQUEST_STATUS.PENDING_HR] },
        };
      } else if (view === "rh-history") {
        where = {
          status: { in: [REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED] },
        };
      }

      return this.findRequestsWithFallback({
        where,
        orderBy: { createdAt: "desc" },
      });
    }

    if (user.role === ROLE.MANAGER) {
      const teamMembers = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      const teamIds = teamMembers.map((employee) => employee.id);

      let where: Prisma.RequestWhereInput = {
        employeeId: { in: teamIds },
      };

      if (view === "pending") {
        where = {
          employeeId: { in: teamIds },
          approvalType: APPROVAL_TYPE.MANAGER_THEN_HR,
          status: { in: [REQUEST_STATUS.PENDING_MANAGER, REQUEST_STATUS.PENDING_HR] },
        };
      } else if (view === "history") {
        where = {
          employeeId: { in: teamIds },
          approvalType: APPROVAL_TYPE.MANAGER_THEN_HR,
          status: { in: [REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED] },
        };
      }

      return this.findRequestsWithFallback({
        where,
        orderBy: { createdAt: "desc" },
      });
    }

    return this.findRequestsWithFallback({
      where: { employeeId: user.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async getRequestByIdForUser(id: string, user: CurrentUser) {
    const request = await this.findRequestByIdWithFallback(id);

    if (!request) {
      throw new AppError("Request not found", 404);
    }

    await this.assertRequestAccessForUser(user, request);

    return request;
  }

  async createRequestForUser(input: RequestMutationInput, user: CurrentUser) {
    const employee = await this.getEmployeeForRequestUser(user.id);
    const { startDate, endDate } = await this.validateRequestDates(
      input,
      user.id,
      employee.leaveBalance,
    );
    const approvalType = this.getApprovalType(input.type);
    const initialStatus = this.getInitialStatus(approvalType, input.isDraft ?? false);

    const request = await prisma.request.create({
      data: {
        type: input.type,
        approvalType,
        status: initialStatus,
        employeeId: user.id,
        managerId: employee.managerId,
        comment: input.comment,
        reason: input.reason ?? null,
        startDate,
        endDate,
        documentType: input.type === REQUEST_TYPE.DOCUMENT ? input.documentType : null,
        history: {
          create: {
            actorId: user.id,
            actorName: employee.name,
            action: "CREATED",
            comment: input.comment,
          },
        },
      },
      include: requestInclude,
    });

    await slaService.initializeSla(request.id, input.type);

    if (approvalType === APPROVAL_TYPE.DIRECT_HR) {
      await notificationServerService.notifyHR(
        "Nouvelle demande",
        `${employee.name} a soumis une nouvelle demande de type ${input.type}`,
      );
    } else if (employee.managerId) {
      await notificationServerService.notifyManager(
        employee.managerId,
        "Nouvelle demande",
        `${employee.name} de votre equipe a soumis une nouvelle demande de type ${input.type}`,
      );
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
        documentType: request.documentType ?? null,
      },
    });

    return request;
  }

  async updateRequestForUser(id: string, input: RequestMutationInput, user: CurrentUser) {
    const existingRequest = await prisma.request.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      throw new AppError("Request not found", 404);
    }

    if (existingRequest.employeeId !== user.id) {
      throw new AppError("Forbidden", 403);
    }

    const employee = await this.getEmployeeForRequestUser(user.id);
    const { startDate, endDate } = await this.validateRequestDates(
      input,
      user.id,
      employee.leaveBalance,
      existingRequest.id,
    );
    const approvalType = this.getApprovalType(input.type);
    const nextStatus = this.getInitialStatus(approvalType, input.isDraft ?? false);

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        type: input.type,
        approvalType,
        status: nextStatus,
        managerId: employee.managerId,
        comment: input.comment,
        reason: input.reason ?? null,
        startDate,
        endDate,
        documentType: input.type === REQUEST_TYPE.DOCUMENT ? input.documentType : null,
      },
      include: requestInclude,
    });

    await slaService.initializeSla(id, input.type);

    return updatedRequest;
  }

  async processRequestAction(user: CurrentUser, requestId: string, action: string, comment?: string | null) {
    if (action !== "APPROVE" && action !== "REJECT") {
      throw new ApiError("Cette action n'est pas autorisee.", 400);
    }

    const requestForGeneration =
      action === "APPROVE" && user.role === ROLE.HR
        ? await prisma.request.findUnique({
          where: { id: requestId },
          include: {
            generatedDocument: {
              select: { id: true },
            },
          },
        })
        : null;

    if (
      action === "APPROVE" &&
      user.role === ROLE.HR &&
      requestForGeneration &&
      requestForGeneration.status === REQUEST_STATUS.PENDING_HR &&
      requestForGeneration.type === REQUEST_TYPE.DOCUMENT &&
      requestForGeneration.documentType === "FICHE_PAIE"
    ) {
      await this.validatePayslipGenerationPreconditions(requestId);
    }

    let preparedGeneratedDocument: PreparedGeneratedDocument | null = null;
    if (
      requestForGeneration &&
      requestForGeneration.status === REQUEST_STATUS.PENDING_HR &&
      requestForGeneration.type === REQUEST_TYPE.DOCUMENT &&
      requestForGeneration.documentType === "ATTESTATION_TRAVAIL" &&
      !requestForGeneration.generatedDocument
    ) {
      try {
        preparedGeneratedDocument = await documentsService.prepareWorkCertificateDocument(requestId, user);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        throw new ApiError("La demande n'a pas pu etre approuvee car la generation du document a echoue.", 500);
      }
    }

    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const request = await tx.request.findUnique({
          where: { id: requestId },
          include: {
            employee: true,
            generatedDocument: true,
          },
        });

        if (!request) {
          throw new AppError("Demande introuvable.", 404);
        }

        await this.assertRequestAccessForUser(user, request);

        const newStatus = this.getNextRequestStatus(user, request.status, action);
        const employee = await tx.employee.findUnique({
          where: { id: request.employeeId },
        });

        if (!employee) {
          throw new ApiError("Utilisateur introuvable", 404);
        }

        let deductedDays = 0;
        if (action === "APPROVE" && isLeaveRequestType(request.type)) {
          const startDate = toDateOnlyValue(request.startDate);
          const endDate = toDateOnlyValue(request.endDate);

          if (!startDate || !endDate) {
            throw new ApiError("Les dates de ce conge sont invalides.", 400);
          }

          deductedDays = calculateLeaveBusinessDays(startDate, endDate);
          if (deductedDays <= 0) {
            throw new ApiError("Les dates de ce conge sont invalides.", 400);
          }

          if (employee.leaveBalance < deductedDays) {
            throw new ApiError(this.insufficientLeaveBalanceMessage, 409);
          }
        }

        const statusUpdate = await tx.request.updateMany({
          where: { id: requestId, status: request.status },
          data: { status: newStatus },
        });

        if (statusUpdate.count === 0) {
          throw new ApiError("Cette action n'est pas autorisee.", 403);
        }

        if (newStatus === REQUEST_STATUS.APPROVED && action === "APPROVE" && isLeaveRequestType(request.type)) {
          const employeeBalanceUpdate = await tx.employee.updateMany({
            where: {
              id: request.employeeId,
              leaveBalance: { gte: deductedDays },
            },
            data: {
              leaveBalance: { decrement: deductedDays },
            },
          });

          if (employeeBalanceUpdate.count === 0) {
            throw new ApiError(this.insufficientLeaveBalanceMessage, 409);
          }
        }

        await tx.requestHistory.create({
          data: {
            requestId,
            actorId: user.id,
            actorName: user.name,
            action,
            comment: comment ?? null,
          },
        });

        let generatedDocumentCreated = false;
        let generatedDocumentReference: string | null = null;
        if (
          action === "APPROVE" &&
          newStatus === REQUEST_STATUS.APPROVED &&
          request.type === REQUEST_TYPE.DOCUMENT &&
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
          });

          await tx.requestHistory.create({
            data: {
              requestId: request.id,
              actorId: user.id,
              actorName: user.name,
              action: "DOCUMENT_GENERATED",
              comment: "Document genere automatiquement.",
            },
          });

          generatedDocumentCreated = true;
          generatedDocumentReference = preparedGeneratedDocument.reference;
        }

        await this.transitionSlaWithinTransaction(
          tx,
          requestId,
          request.type,
          request.currentOwner,
          newStatus,
          request.slaDeadline,
        );

        const isRejected = newStatus === REQUEST_STATUS.REJECTED;
        const isFullyApproved = newStatus === REQUEST_STATUS.APPROVED;
        const isAwaitingHR = newStatus === REQUEST_STATUS.PENDING_HR;
        let employeeMessage = "";

        if (isRejected) {
          employeeMessage = `Votre demande (${request.type}) a ete rejetee par ${user.name}.`;
        } else if (isFullyApproved) {
          employeeMessage = `Votre demande (${request.type}) a ete approuvee.`;
        } else if (isAwaitingHR) {
          employeeMessage = `Votre demande (${request.type}) a ete validee par votre chef et est en attente RH.`;
        }

        if (employeeMessage) {
          await tx.notification.create({
            data: {
              employeeId: request.employeeId,
              title: generatedDocumentCreated ? "Document disponible" : "Mise a jour de votre demande",
              message: generatedDocumentCreated
                ? "Votre attestation de travail est disponible."
                : request.documentType === "FICHE_PAIE" && isFullyApproved
                  ? "Votre fiche de paie est disponible."
                  : employeeMessage,
            },
          });
        }

        if (isAwaitingHR) {
          const rhUsers = await tx.employee.findMany({
            where: { role: ROLE.HR },
            select: { id: true },
          });

          if (rhUsers.length > 0) {
            await tx.notification.createMany({
              data: rhUsers.map((rhUser) => ({
                employeeId: rhUser.id,
                title: "Nouvelle validation requise",
                message: `La demande de ${request.employee.name} a ete validee par son manager et necessite votre validation finale.`,
              })),
            });
          }
        }

        const updated = await tx.request.findUnique({
          where: { id: requestId },
          include: requestInclude,
        });

        if (!updated) {
          throw new ApiError("Demande introuvable.", 404);
        }

        return {
          updated,
          request,
          newStatus,
          deductedDays,
          generatedDocumentCreated,
          generatedDocumentReference,
        };
      });

      if (preparedGeneratedDocument && !result.generatedDocumentCreated) {
        await removeGeneratedDocumentFile(preparedGeneratedDocument.filePath).catch(() => undefined);
      }

      const isFullyApproved = result.newStatus === REQUEST_STATUS.APPROVED;
      if (
        isFullyApproved &&
        result.request.type === REQUEST_TYPE.DOCUMENT &&
        result.request.documentType !== "ATTESTATION_TRAVAIL"
      ) {
        await payslipService.generatePayslip(result.request.id);
      }

      const auditAction =
        action === "APPROVE"
          ? result.newStatus === REQUEST_STATUS.APPROVED || result.newStatus === REQUEST_STATUS.PENDING_HR
            ? "APPROVED"
            : "APPROVED_PENDING"
          : "REJECTED";

      logAudit({
        actorId: user.id,
        actorName: user.name,
        action: auditAction,
        entity: "Request",
        entityId: requestId,
        details: {
          previousStatus: result.request.status,
          newStatus: result.newStatus,
          action,
          comment,
          deductedDays: result.deductedDays,
        },
      });

      if (result.generatedDocumentCreated) {
        logAudit({
          actorId: user.id,
          actorName: user.name,
          action: "DOCUMENT_GENERATED",
          entity: "Request",
          entityId: requestId,
          details: {
            documentType: "ATTESTATION_TRAVAIL",
            reference: result.generatedDocumentReference,
          },
        });
      }

      return result.updated;
    } catch (error) {
      if (preparedGeneratedDocument) {
        await removeGeneratedDocumentFile(preparedGeneratedDocument.filePath).catch(() => undefined);
      }

      throw error;
    }
  }
}

export const requestServerService = new RequestServerService();
export const requestService = requestServerService;
