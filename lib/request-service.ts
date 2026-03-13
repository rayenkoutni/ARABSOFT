import { Request, RequestStatus, Approval, UserRole } from './types'

// Mock data for demo
let mockRequests: Request[] = [
  {
    id: '1',
    userId: '3',
    type: 'LEAVE',
    title: 'Annual Leave Request',
    description: 'Requesting 5 days of leave in April',
    status: 'SUBMITTED',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-05'),
    submittedAt: new Date('2024-03-05'),
    approvals: [
      {
        id: 'a1',
        requestId: '1',
        approverRole: 'CHEF',
        approverName: 'Manager User',
        status: 'APPROVED',
        comment: 'Approved',
        timestamp: new Date('2024-03-06'),
        order: 1,
      },
      {
        id: 'a2',
        requestId: '1',
        approverRole: 'RH',
        approverName: 'Admin User',
        status: 'PENDING',
        order: 2,
      },
    ],
  },
  {
    id: '2',
    userId: '3',
    type: 'EQUIPMENT',
    title: 'Laptop Request',
    description: 'Need a new laptop for development work',
    status: 'MANAGER_APPROVED',
    createdAt: new Date('2024-03-03'),
    updatedAt: new Date('2024-03-08'),
    submittedAt: new Date('2024-03-03'),
    approvals: [
      {
        id: 'a3',
        requestId: '2',
        approverRole: 'CHEF',
        approverName: 'Manager User',
        status: 'APPROVED',
        comment: 'Approved',
        timestamp: new Date('2024-03-04'),
        order: 1,
      },
      {
        id: 'a4',
        requestId: '2',
        approverRole: 'RH',
        approverName: 'Admin User',
        status: 'PENDING',
        order: 2,
      },
    ],
  },
]

export const requestService = {
  // Get all requests (for RH dashboard)
  getAllRequests: async (): Promise<Request[]> => {
    await new Promise(resolve => setTimeout(resolve, 500))
    return mockRequests
  },

  // Get requests for a specific user
  getUserRequests: async (userId: string): Promise<Request[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockRequests.filter(r => r.userId === userId)
  },

  // Get requests awaiting manager approval
  getManagerPendingRequests: async (managerId: string): Promise<Request[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockRequests.filter(r =>
      r.approvals.some(
        a => a.approverRole === 'CHEF' && a.status === 'PENDING'
      )
    )
  },

  // Get requests awaiting RH approval
  getRHPendingRequests: async (): Promise<Request[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    return mockRequests.filter(r =>
      r.approvals.some(
        a => a.approverRole === 'RH' && a.status === 'PENDING'
      )
    )
  },

  // Get single request
  getRequest: async (requestId: string): Promise<Request | null> => {
    await new Promise(resolve => setTimeout(resolve, 200))
    return mockRequests.find(r => r.id === requestId) || null
  },

  // Create new request
  createRequest: async (
    userId: string,
    type: any,
    title: string,
    description: string
  ): Promise<Request> => {
    await new Promise(resolve => setTimeout(resolve, 400))
    const newRequest: Request = {
      id: String(mockRequests.length + 1),
      userId,
      type,
      title,
      description,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
      approvals: [],
    }
    mockRequests.push(newRequest)
    return newRequest
  },

  // Submit request for approval
  submitRequest: async (requestId: string, userRole: UserRole): Promise<Request | null> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    const request = mockRequests.find(r => r.id === requestId)
    if (!request) return null

    request.status = 'SUBMITTED'
    request.submittedAt = new Date()
    request.updatedAt = new Date()

    // Create approval chain
    request.approvals = [
      {
        id: `a${Date.now()}`,
        requestId,
        approverRole: 'CHEF',
        approverName: 'Manager User',
        status: 'PENDING',
        order: 1,
      },
      {
        id: `a${Date.now() + 1}`,
        requestId,
        approverRole: 'RH',
        approverName: 'Admin User',
        status: 'PENDING',
        order: 2,
      },
    ]

    return request
  },

  // Approve request
  approveRequest: async (
    requestId: string,
    approverRole: UserRole,
    comment?: string
  ): Promise<Request | null> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    const request = mockRequests.find(r => r.id === requestId)
    if (!request) return null

    const approval = request.approvals.find(a => a.approverRole === approverRole && a.status === 'PENDING')
    if (!approval) return null

    approval.status = 'APPROVED'
    approval.comment = comment
    approval.timestamp = new Date()

    // Check if all approvals are done
    const allApproved = request.approvals.every(a => a.status === 'APPROVED')
    if (allApproved) {
      request.status = 'COMPLETED'
    } else {
      const nextPending = request.approvals.find(a => a.status === 'PENDING')
      if (nextPending?.approverRole === 'RH') {
        request.status = 'MANAGER_APPROVED'
      }
    }

    request.updatedAt = new Date()
    return request
  },

  // Reject request
  rejectRequest: async (
    requestId: string,
    approverRole: UserRole,
    comment: string
  ): Promise<Request | null> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    const request = mockRequests.find(r => r.id === requestId)
    if (!request) return null

    const approval = request.approvals.find(a => a.approverRole === approverRole && a.status === 'PENDING')
    if (!approval) return null

    approval.status = 'REJECTED'
    approval.comment = comment
    approval.timestamp = new Date()
    request.status = 'REJECTED'
    request.updatedAt = new Date()

    return request
  },

  // Get dashboard stats
  getDashboardStats: async (userId: string, role: UserRole) => {
    await new Promise(resolve => setTimeout(resolve, 300))

    let requests: Request[] = []
    if (role === 'COLLABORATEUR') {
      requests = mockRequests.filter(r => r.userId === userId)
    } else if (role === 'CHEF') {
      requests = mockRequests.filter(r =>
        r.approvals.some(a => a.approverRole === 'CHEF')
      )
    } else {
      requests = mockRequests
    }

    return {
      totalRequests: requests.length,
      pendingRequests: requests.filter(r => r.status === 'SUBMITTED' || r.status === 'DRAFT').length,
      approvedRequests: requests.filter(r => r.status === 'COMPLETED').length,
      rejectedRequests: requests.filter(r => r.status === 'REJECTED').length,
    }
  },
}
