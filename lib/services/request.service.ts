import { Request, RequestHistoryEntry, UserRole } from '../types';
import { REQUEST_STATUS, APPROVAL_TYPE } from '../constants';

/**
 * Unified Request Service
 * Consolidates all request-related logic from multiple files into one service
 * Follows single responsibility principle
 */

// Types
export interface WorkflowActionStep {
  kind: 'action';
  action: 'APPROVE' | 'REJECT';
  byYou: boolean;
  actorName: string;
  actorRole: 'Chef' | 'RH';
  comment: string | null | undefined;
  date: string;
}

export interface WorkflowPendingStep {
  kind: 'pending';
  label: string;
}

export type WorkflowStep = WorkflowActionStep | WorkflowPendingStep;

export interface RequestCreatePayload {
  type: string;
  title: string;
  description: string;
  isDraft?: boolean;
  startDate?: string;
  endDate?: string;
}

class RequestService {
  /**
   * Fetch all requests
   */
  async getRequests(): Promise<Request[]> {
    const res = await fetch("/api/requests", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch requests");
    return res.json();
  }

  /**
   * Fetch requests with specific view filter
   */
  async getRequestsWithView(view: string): Promise<Request[]> {
    const res = await fetch(`/api/requests?view=${view}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch requests");
    return res.json();
  }

  /**
   * Get single request by ID
   */
  async getRequestById(id: string): Promise<Request> {
    const res = await fetch(`/api/requests/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch request");
    return res.json();
  }

  /**
   * Create new request
   */
  async createRequest(payload: RequestCreatePayload) {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        type: payload.type,
        comment: `[${payload.title}] - ${payload.description}`,
        isDraft: payload.isDraft ?? false,
        startDate: payload.startDate || null,
        endDate: payload.endDate || null,
      })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Failed to create request");
    }
    return res.json();
  }

  /**
   * Execute action on request (approve/reject)
   */
  async actionRequest(id: string, action: "APPROVE" | "REJECT", comment?: string) {
    const res = await fetch(`/api/requests/${id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Failed to process action");
    }
    return res.json();
  }

  /**
   * Approve request shortcut
   */
  async approveRequest(id: string, role: string, comment?: string): Promise<Request> {
    return this.actionRequest(id, "APPROVE", comment);
  }

  /**
   * Reject request shortcut
   */
  async rejectRequest(id: string, role: string, comment?: string): Promise<Request> {
    return this.actionRequest(id, "REJECT", comment);
  }

  /**
   * Submit request (no-op for backward compatibility)
   */
  async submitRequest(id: string, role: string): Promise<Request> {
    return {} as unknown as Request;
  }

  /**
   * Get dashboard statistics for user
   */
  async getDashboardStats(userId: string, role: string) {
    const requests = await this.getRequests();
    
    return {
      totalRequests: requests.length,
      pendingRequests: requests.filter(r => r.status.startsWith('EN_ATTENTE')).length,
      approvedRequests: requests.filter(r => r.status === REQUEST_STATUS.APPROVED).length,
      rejectedRequests: requests.filter(r => r.status === REQUEST_STATUS.REJECTED).length,
    };
  }

  /**
   * Get manager pending requests
   */
  async getManagerPendingRequests(managerId: string): Promise<Request[]> {
    return this.getRequestsWithView("pending");
  }

  /**
   * Get manager history requests
   */
  async getManagerHistoryRequests(): Promise<Request[]> {
    return this.getRequestsWithView("history");
  }

  /**
   * Get all requests (for RH)
   */
  async getAllRequests(): Promise<Request[]> {
    return this.getRequests();
  }

  /**
   * Get user specific requests
   */
  async getUserRequests(userId: string): Promise<Request[]> {
    return this.getRequests();
  }

  /**
   * Get HR pending requests
   */
  async getRHPendingRequests(): Promise<Request[]> {
    return this.getRequestsWithView("rh-pending");
  }

  /**
   * Get HR history requests
   */
  async getRHHistoryRequests(): Promise<Request[]> {
    return this.getRequestsWithView("rh-history");
  }

  /**
   * Check if user can examine (approve/reject) a request
   */
  canUserExamineRequest(request: Request, role?: UserRole): boolean {
    if (role === 'CHEF') {
      return request.status === REQUEST_STATUS.PENDING_MANAGER;
    }

    if (role === 'RH') {
      return request.status === REQUEST_STATUS.PENDING_HR;
    }

    return false;
  }

  /**
   * Get actor role for workflow step
   */
  private getActorRoleForStep(request: Request, stepIndex: number): 'Chef' | 'RH' {
    if (request.approvalType === APPROVAL_TYPE.DIRECT_HR) {
      return 'RH';
    }
    return stepIndex === 0 ? 'Chef' : 'RH';
  }

  /**
   * Build workflow timeline steps for a request
   */
  buildRequestWorkflowSteps(request: Request, currentUserId?: string): WorkflowStep[] {
    const actionEntries = [...request.history]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .filter((entry) => entry.action === 'APPROVE' || entry.action === 'REJECT');

    const steps: WorkflowStep[] = actionEntries.map((entry, index) => ({
      kind: 'action',
      action: entry.action as 'APPROVE' | 'REJECT',
      byYou: entry.actorId === currentUserId,
      actorName: entry.actorName,
      actorRole: this.getActorRoleForStep(request, index),
      comment: entry.comment,
      date: entry.createdAt,
    }));

    // Add pending step if applicable
    if (request.status === REQUEST_STATUS.PENDING_MANAGER) {
      steps.push({ kind: 'pending', label: 'En attente de Chef' });
    } else if (request.status === REQUEST_STATUS.PENDING_HR) {
      steps.push({ kind: 'pending', label: 'En attente de RH' });
    }

    return steps;
  }
}

// Export singleton instance
export const requestService = new RequestService();

// Export types for backward compatibility
export type { Request, RequestHistoryEntry };
