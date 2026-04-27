// User roles
export type UserRole = 'RH' | 'CHEF' | 'COLLABORATEUR'

// User type
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  phone?: string
  department?: string
  position?: string
  managerId?: string
  avatar?: string | null
  hireDate?: string | null
  leaveBalance?: number
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
  reason?: string | null
  startDate?: string | null
  endDate?: string | null
  slaDeadline?: string | null
  slaBreached: boolean
  createdAt: string
  updatedAt: string
  employee?: {
    id?: string
    name: string
    email?: string
    leaveBalance?: number | null
    hireDate?: string | null
  } | null
  history: RequestHistoryEntry[]
}

// Dashboard stats
export interface DashboardStats {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  rejectedRequests: number
}

export type SkillType = 'SOFT' | 'TECHNICAL'
export type EmployeeSkillHistoryAction = 'ADD' | 'LEVEL_UPDATE' | 'REMOVE'

export interface SkillCatalogItem {
  id: string
  name: string
  type: SkillType
  isMandatory: boolean
  isActive?: boolean
  description?: string | null
  createdAt: string
  updatedAt: string
}

export interface EmployeeSkillProfileItem {
  id: string
  employeeId: string
  skillId: string
  level: number
  acquiredAt?: string | null
  createdAt: string
  updatedAt: string
  skill: SkillCatalogItem
}

export interface EmployeeSkillHistoryEntry {
  id: string
  employeeId: string
  skillId: string | null
  skillName: string
  skillType: SkillType
  action: EmployeeSkillHistoryAction
  oldLevel?: number | null
  newLevel?: number | null
  actorId: string
  createdAt: string
  actor: Pick<User, 'id' | 'name' | 'role'>
}
