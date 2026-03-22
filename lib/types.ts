// User roles
export type UserRole = 'RH' | 'CHEF' | 'COLLABORATEUR'

// User type
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  department?: string
  position?: string
  managerId?: string
  createdAt: Date
}

// Request status — matches Prisma enum
export type RequestStatus = 'BROUILLON' | 'EN_ATTENTE_CHEF' | 'EN_ATTENTE_RH' | 'APPROUVE' | 'REJETE'

// Request type — matches Prisma enum
export type RequestType = 'CONGE' | 'AUTORISATION' | 'DOCUMENT' | 'PRET'

// History entry from Prisma
export interface RequestHistoryEntry {
  id: string
  requestId: string
  actorId: string
  actorName: string
  action: string
  comment?: string | null
  createdAt: string
}

// Request interface — matches Prisma model
export interface Request {
  id: string
  type: RequestType
  approvalType: 'CHEF_THEN_RH' | 'DIRECT_RH'
  status: RequestStatus
  employeeId: string
  managerId?: string | null
  comment?: string | null
  slaDeadline?: string | null
  slaBreached: boolean
  createdAt: string
  updatedAt: string
  employee?: { name: string }
  history: RequestHistoryEntry[]
}

// Dashboard stats
export interface DashboardStats {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  rejectedRequests: number
}
