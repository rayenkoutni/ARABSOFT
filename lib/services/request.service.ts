import { Request, RequestDocumentType, RequestHistoryEntry, RequestType, UserRole } from "../types";
import { APPROVAL_TYPE, REQUEST_STATUS } from "../constants";

export interface WorkflowActionStep {
  kind: "action";
  action: "APPROVE" | "REJECT";
  byYou: boolean;
  actorName: string;
  actorRole: "Chef" | "RH";
  comment: string | null | undefined;
  date: string;
}

export interface WorkflowPendingStep {
  kind: "pending";
  label: string;
}

export type WorkflowStep = WorkflowActionStep | WorkflowPendingStep;

export interface RequestCreatePayload {
  type: RequestType;
  title: string;
  description: string;
  isDraft?: boolean;
  startDate?: string;
  endDate?: string;
  documentType?: RequestDocumentType | null;
  reason?: string | null;
}

class RequestService {
  private async extractErrorMessage(res: Response): Promise<string> {
    const text = await res.text().catch(() => "");
    if (!text) {
      return res.statusText || "Unknown error";
    }

    try {
      const parsed = JSON.parse(text) as { error?: string };
      return parsed.error || text;
    } catch {
      return text;
    }
  }

  private async apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, init);

    if (!res.ok) {
      const isReadonlyRequest = !init?.method || init.method === "GET";
      if (res.status === 401 && isReadonlyRequest) {
        return [] as T;
      }

      const text = await this.extractErrorMessage(res);
      throw new Error(`Request failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getRequests(): Promise<Request[]> {
    return this.apiFetch<Request[]>("/api/requests", { cache: "no-store" });
  }

  async getRequestsWithView(view: string): Promise<Request[]> {
    return this.apiFetch<Request[]>(`/api/requests?view=${view}`, { cache: "no-store" });
  }

  async getRequestById(id: string): Promise<Request> {
    return this.apiFetch<Request>(`/api/requests/${id}`, { cache: "no-store" });
  }

  getGeneratedDocumentDownloadUrl(id: string): string {
    return `/api/requests/${id}/document`;
  }

  getRequestDownloadUrl(request: Pick<Request, "id" | "documentType" | "payslip">): string {
    if (request.documentType === "FICHE_PAIE" && request.payslip?.id) {
      return `/api/payslips/${request.payslip.id}/pdf`;
    }

    return this.getGeneratedDocumentDownloadUrl(request.id);
  }

  async createRequest(payload: RequestCreatePayload) {
    return this.apiFetch<Request>("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: payload.type,
        comment: `[${payload.title}] - ${payload.description}`,
        isDraft: payload.isDraft ?? false,
        startDate: payload.startDate || null,
        endDate: payload.endDate || null,
        documentType: payload.documentType ?? null,
        reason: payload.reason ?? null,
      }),
    });
  }

  async actionRequest(id: string, action: "APPROVE" | "REJECT", comment?: string) {
    return this.apiFetch<Request>(`/api/requests/${id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment }),
    });
  }

  async approveRequest(id: string, _role: string, comment?: string): Promise<Request> {
    return this.actionRequest(id, "APPROVE", comment);
  }

  async rejectRequest(id: string, _role: string, comment?: string): Promise<Request> {
    return this.actionRequest(id, "REJECT", comment);
  }

  async submitRequest(id: string, _role: string): Promise<Request> {
    const currentRequest = await this.getRequestById(id);

    return this.apiFetch<Request>(`/api/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: currentRequest.type,
        comment: currentRequest.comment ?? "",
        reason: currentRequest.reason ?? null,
        startDate: currentRequest.startDate ?? null,
        endDate: currentRequest.endDate ?? null,
        documentType: currentRequest.documentType ?? null,
        isDraft: false,
      }),
    });
  }

  async getDashboardStats(_userId: string, _role: string) {
    const requests = await this.getRequests();

    return {
      totalRequests: requests.length,
      pendingRequests: requests.filter((request) => request.status.startsWith("EN_ATTENTE")).length,
      approvedRequests: requests.filter((request) => request.status === REQUEST_STATUS.APPROVED).length,
      rejectedRequests: requests.filter((request) => request.status === REQUEST_STATUS.REJECTED).length,
    };
  }

  async getManagerPendingRequests(_managerId: string): Promise<Request[]> {
    return this.getRequestsWithView("pending");
  }

  async getManagerHistoryRequests(): Promise<Request[]> {
    return this.getRequestsWithView("history");
  }

  async getAllRequests(): Promise<Request[]> {
    return this.getRequests();
  }

  async getUserRequests(_userId: string): Promise<Request[]> {
    return this.getRequests();
  }

  async getRHPendingRequests(): Promise<Request[]> {
    return this.getRequestsWithView("rh-pending");
  }

  async getRHHistoryRequests(): Promise<Request[]> {
    return this.getRequestsWithView("rh-history");
  }

  canUserExamineRequest(request: Request, role?: UserRole): boolean {
    if (role === "CHEF") {
      return request.status === REQUEST_STATUS.PENDING_MANAGER;
    }

    if (role === "RH") {
      return request.status === REQUEST_STATUS.PENDING_HR;
    }

    return false;
  }

  private getActorRoleForStep(request: Request, stepIndex: number): "Chef" | "RH" {
    if (request.approvalType === APPROVAL_TYPE.DIRECT_HR) {
      return "RH";
    }

    return stepIndex === 0 ? "Chef" : "RH";
  }

  buildRequestWorkflowSteps(request: Request, currentUserId?: string): WorkflowStep[] {
    const actionEntries = [...request.history]
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .filter((entry) => entry.action === "APPROVE" || entry.action === "REJECT");

    const steps: WorkflowStep[] = actionEntries.map((entry, index) => ({
      kind: "action",
      action: entry.action as "APPROVE" | "REJECT",
      byYou: entry.actorId === currentUserId,
      actorName: entry.actorName,
      actorRole: this.getActorRoleForStep(request, index),
      comment: entry.comment,
      date: entry.createdAt,
    }));

    if (request.status === REQUEST_STATUS.PENDING_MANAGER) {
      steps.push({ kind: "pending", label: "En attente de Chef" });
    } else if (request.status === REQUEST_STATUS.PENDING_HR) {
      steps.push({ kind: "pending", label: "En attente de RH" });
    }

    return steps;
  }
}

export const requestService = new RequestService();

export type { Request, RequestHistoryEntry };
