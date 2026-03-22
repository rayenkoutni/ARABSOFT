// lib/request-service.ts
import { Request } from "./types";

export async function getRequests(): Promise<Request[]> {
  const res = await fetch("/api/requests", { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch requests")
  return res.json()
}

export async function getRequestsWithView(view: string): Promise<Request[]> {
  const res = await fetch(`/api/requests?view=${view}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch requests")
  return res.json()
}

export async function createRequest(userId: string, type: string, title: string, description: string, isDraft: boolean = false) {
  const res = await fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      type, 
      comment: `[${title}] - ${description}`,
      isDraft
    })
  })
  if (!res.ok) throw new Error("Failed to create request")
  return res.json()
}

export async function actionRequest(id: string, action: "APPROVE" | "REJECT", comment?: string) {
  const res = await fetch(`/api/requests/${id}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, comment })
  })
  if (!res.ok) throw new Error("Failed to process action")
  return res.json()
}

export const requestService = {
  getRequests,
  getRequestsWithView,
  createRequest,
  actionRequest,

  // Adding compatibility methods for the frontend components
  async getAllRequests(): Promise<Request[]> {
    return this.getRequests();
  },

  async getUserRequests(userId: string): Promise<Request[]> {
    return this.getRequests();
  },

  async getManagerPendingRequests(managerId: string): Promise<Request[]> {
    // Returns workflow-pending CHEF_THEN_RH requests for this manager
    return getRequestsWithView("pending");
  },

  async getManagerHistoryRequests(): Promise<Request[]> {
    // Returns only terminal CHEF_THEN_RH requests (APPROUVE or REJETE)
    return getRequestsWithView("history");
  },

  async getRHPendingRequests(): Promise<Request[]> {
    return getRequestsWithView("rh-pending");
  },

  async getRHHistoryRequests(): Promise<Request[]> {
    return getRequestsWithView("rh-history");
  },

  async getDashboardStats(userId: string, role: string) {
    const requests = await this.getRequests();
    
    return {
      totalRequests: requests.length,
      pendingRequests: requests.filter((r: any) => r.status.startsWith('EN_ATTENTE')).length,
      approvedRequests: requests.filter((r: any) => r.status === 'APPROUVE').length,
      rejectedRequests: requests.filter((r: any) => r.status === 'REJETE').length,
    };
  },

  async approveRequest(id: string, role: string, comment?: string): Promise<Request> {
    return this.actionRequest(id, "APPROVE", comment);
  },

  async rejectRequest(id: string, role: string, comment?: string): Promise<Request> {
    return this.actionRequest(id, "REJECT", comment);
  },

  async submitRequest(id: string, role: string): Promise<Request> {
     // Our new backend submits the request automatically in POST /api/requests
     // So this is basically a no-op just to satisfy UI components that expect it.
     return {} as unknown as Request;
  }
};
