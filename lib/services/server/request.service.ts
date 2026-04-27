import { prisma } from '@/lib/services/prisma.service';
import { REQUEST_STATUS, APPROVAL_TYPE, SLA_DAYS, REQUEST_TYPE } from '@/lib';
import { notificationServerService } from '@/lib/services/server/notification.service';
import { RequestStatus, RequestType, ApprovalType } from '@prisma/client';

class RequestServerService {
  /**
   * Determine the approval workflow type based on request type
   */
  getApprovalType(type: string): 'DIRECT_RH' | 'CHEF_THEN_RH' {
    return type === REQUEST_TYPE.DOCUMENT || type === REQUEST_TYPE.LOAN
      ? APPROVAL_TYPE.DIRECT_HR
      : APPROVAL_TYPE.MANAGER_THEN_HR;
  }

  /**
   * Determine initial status based on approval type and draft state
   */
  getInitialStatus(approvalType: string, isDraft: boolean = false): string {
    if (isDraft) return REQUEST_STATUS.DRAFT;
    
    return approvalType === APPROVAL_TYPE.DIRECT_HR 
      ? REQUEST_STATUS.PENDING_HR 
      : REQUEST_STATUS.PENDING_MANAGER;
  }

  /**
   * Calculate SLA deadline
   */
  calculateSlaDeadline(type: string): Date {
    const deadline = new Date();
    const days = SLA_DAYS[type] ?? 3;
    deadline.setDate(deadline.getDate() + days);
    return deadline;
  }

  /**
   * Fetch requests based on user role and view
   */
  async getRequests(user: { id: string; role: string }, view: string | null) {
    if (user.role === "RH") {
      let whereClause: Record<string, any> = {};

      if (view === "rh-pending") {
        whereClause = {
          status: { in: [REQUEST_STATUS.PENDING_MANAGER, REQUEST_STATUS.PENDING_HR] },
        };
      } else if (view === "rh-history") {
        whereClause = {
          status: { in: [REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED] },
        };
      }

      return prisma.request.findMany({
        where: whereClause,
        include: { employee: { select: { name: true } }, history: true },
        orderBy: { createdAt: "desc" },
      });
    }

    if (user.role === "CHEF") {
      const teamMembers = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      const teamIds = teamMembers.map((e) => e.id);

      let whereClause: Record<string, any> = { employeeId: { in: teamIds } };

      if (view === "pending") {
        whereClause = {
          employeeId: { in: teamIds },
          approvalType: APPROVAL_TYPE.MANAGER_THEN_HR,
          status: { in: [REQUEST_STATUS.PENDING_MANAGER, REQUEST_STATUS.PENDING_HR] },
        };
      } else if (view === "history") {
        whereClause = {
          employeeId: { in: teamIds },
          approvalType: APPROVAL_TYPE.MANAGER_THEN_HR,
          status: { in: [REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED] },
        };
      }

      return prisma.request.findMany({
        where: whereClause,
        include: { employee: { select: { name: true } }, history: true },
        orderBy: { createdAt: "desc" },
      });
    }

    // Default: Employee view
    return prisma.request.findMany({
      where: { employeeId: user.id },
      include: { history: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Create a new request with audit history and notifications
   */
  async createRequest(data: {
    type: string;
    employeeId: string;
    managerId?: string | null;
    comment?: string;
    isDraft?: boolean;
    userName: string;
  }) {
    const approvalType = this.getApprovalType(data.type);
    const initialStatus = this.getInitialStatus(approvalType, data.isDraft);
    const slaDeadline = this.calculateSlaDeadline(data.type);

    const request = await prisma.request.create({
      data: {
        type: data.type as RequestType,
        approvalType: approvalType as ApprovalType,
        status: initialStatus as RequestStatus,
        employeeId: data.employeeId,
        managerId: data.managerId,
        slaDeadline,
        history: {
          create: {
            actorId: data.employeeId,
            actorName: data.userName,
            action: 'CREATED',
            comment: data.comment || null,
          },
        },
      },
      include: { history: true },
    });

    // Notify appropriate parties if not a draft
    if (!data.isDraft) {
      if (approvalType === APPROVAL_TYPE.DIRECT_HR) {
        await notificationServerService.notifyHR(
          'Nouvelle demande',
          `${data.userName} a soumis une nouvelle demande de type ${data.type}`
        );
      } else if (data.managerId) {
        await notificationServerService.notifyManager(
          data.managerId,
          'Nouvelle demande',
          `${data.userName} de votre équipe a soumis une nouvelle demande de type ${data.type}`
        );
      }
    }

    return request;
  }

  /**
   * Process an action (Approve/Reject) on a request
   */
  async processAction(id: string, action: 'APPROVE' | 'REJECT', actor: { id: string; name: string; role: string }) {
    const request = await prisma.request.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!request) throw new Error('Request not found');

    let nextStatus = request.status;

    if (action === 'REJECT') {
      nextStatus = REQUEST_STATUS.REJECTED as any;
    } else if (action === 'APPROVE') {
      if (request.status === REQUEST_STATUS.PENDING_MANAGER) {
        nextStatus = REQUEST_STATUS.PENDING_HR as any;
      } else if (request.status === REQUEST_STATUS.PENDING_HR) {
        nextStatus = REQUEST_STATUS.APPROVED as any;
      }
    }

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        status: nextStatus,
        history: {
          create: {
            actorId: actor.id,
            actorName: actor.name,
            action,
            comment: `Action processée par ${actor.role}`,
          },
        },
      },
      include: { history: true, employee: { select: { name: true, managerId: true } } },
    });

    // Create notifications for workflow transitions
    const isRejected = nextStatus === REQUEST_STATUS.REJECTED;
    const isFullyApproved = nextStatus === REQUEST_STATUS.APPROVED;
    const isAwaitingHR = nextStatus === REQUEST_STATUS.PENDING_HR;

    // 1. Notify the Employee who created the request
    let employeeTitle = "Mise à jour de votre demande";
    let employeeMsg = "";
    if (isRejected) {
      employeeMsg = `Votre demande (${request.type}) a été rejetée par ${actor.name}.`;
    } else if (isFullyApproved) {
      employeeMsg = `Votre demande (${request.type}) a été approuvée.`;
    } else if (isAwaitingHR) {
      employeeMsg = `Votre demande (${request.type}) a été validée par votre chef et est en attente RH.`;
    }

    if (employeeMsg) {
      await notificationServerService.createNotification(
        request.employeeId,
        employeeTitle,
        employeeMsg
      );
    }

    // 2. If it's now waiting for HR, notify all HRs
    if (isAwaitingHR) {
      await notificationServerService.notifyHR(
        "Nouvelle validation requise",
        `La demande de ${updatedRequest.employee.name} a été validée par son manager and nécessite votre validation finale.`
      );
    }

    return updatedRequest;
  }
}

export const requestServerService = new RequestServerService();

