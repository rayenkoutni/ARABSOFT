import { Request } from "@/lib/types"

const API_BASE = '/api'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }
  return res.json()
}

export const projectService = {
  async getAll(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/projects`, { cache: 'no-store' })
    return handleResponse(res)
  },

  async getById(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/projects/${id}`, { cache: 'no-store' })
    return handleResponse(res)
  },

  async create(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async update(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete project')
  },

  async approve(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/projects/${id}/approve`, { method: 'POST' })
    return handleResponse(res)
  },

  async generateTasks(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/projects/${id}/generate-tasks`, { method: 'POST' })
    return handleResponse(res)
  },

  async saveGeneratedTasks(id: string, tasks: any[]): Promise<any> {
    const res = await fetch(`${API_BASE}/projects/${id}/generate-tasks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks })
    })
    return handleResponse(res)
  }
}

export const taskService = {
  async getByProject(projectId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, { cache: 'no-store' })
    return handleResponse(res)
  },

  async create(projectId: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async update(projectId: string, taskId: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/tasks?taskId=${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async review(projectId: string, taskId: string, action: string, comment?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/tasks/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, action, comment })
    })
    return handleResponse(res)
  },

  async getAll(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/tasks`, { cache: 'no-store' })
    return handleResponse(res)
  }
}

export const conversationService = {
  async getAll(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/conversations`, { cache: 'no-store' })
    return handleResponse(res)
  },

  async create(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async getMessages(conversationId: string, limit = 50): Promise<any> {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages?limit=${limit}`, { cache: 'no-store' })
    return handleResponse(res)
  },

  async markAsRead(conversationId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/read`, { method: 'PATCH' })
    if (!res.ok) throw new Error('Failed to mark as read')
  }
}

export const employeeService = {
  async getAll(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/employees`, { cache: 'no-store' })
    return handleResponse(res)
  },

  async create(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async update(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/employees/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete employee')
  },

  async getChatEmployees(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/employees/chat`, { cache: 'no-store' })
    return handleResponse(res)
  },

  async getTeam(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/users/team`, { cache: 'no-store' })
    return handleResponse(res)
  }
}

export const notificationService = {
  async getAll(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/notifications`, { cache: 'no-store' })
    return handleResponse(res)
  },

  async markAsRead(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, { method: 'PATCH' })
    if (!res.ok) throw new Error('Failed to mark as read')
  },

  async clearAll(): Promise<void> {
    const res = await fetch(`${API_BASE}/notifications`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to clear notifications')
  }
}
