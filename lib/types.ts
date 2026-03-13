// User roles
export type UserRole = 'RH' | 'CHEF' | 'COLLABORATEUR'

// User type
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  department?: string
  manager?: string
  createdAt: Date
}

// Request status
export type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'MANAGER_APPROVED' | 'RH_APPROVED' | 'REJECTED' | 'COMPLETED'

// Request type
export type RequestType = 'LEAVE' | 'EQUIPMENT' | 'TRAINING' | 'OTHER'

// Request interface
export interface Request {
  id: string
  userId: string
  type: RequestType
  title: string
  description: string
  status: RequestStatus
  createdAt: Date
  updatedAt: Date
  submittedAt?: Date
  approvals: Approval[]
  attachments?: Attachment[]
}

// Approval step
export interface Approval {
  id: string
  requestId: string
  approverRole: UserRole
  approverName: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  comment?: string
  timestamp?: Date
  order: number
}

// Attachment
export interface Attachment {
  id: string
  requestId: string
  filename: string
  url: string
  uploadedAt: Date
}

// Dashboard stats
export interface DashboardStats {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  rejectedRequests: number
}
