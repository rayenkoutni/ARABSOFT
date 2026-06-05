import { PROJECT_STATUS, REQUEST_STATUS, REQUEST_TYPE, ROLE, TASK_PRIORITY, TASK_STATUS } from '@/lib/constants'

export const PROJECT_STATUS_LABELS = {
  [PROJECT_STATUS.IN_PROGRESS]: 'En cours',
  [PROJECT_STATUS.COMPLETED]: 'Termine',
} as const

export const PROJECT_STATUS_COLORS = {
  [PROJECT_STATUS.IN_PROGRESS]: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  [PROJECT_STATUS.COMPLETED]: { backgroundColor: '#DCFCE7', color: '#166534' },
} as const

export const PRIORITY_LABELS = {
  [TASK_PRIORITY.LOW]: 'Basse',
  [TASK_PRIORITY.MEDIUM]: 'Moyenne',
  [TASK_PRIORITY.HIGH]: 'Haute',
} as const

export const PRIORITY_COLORS = {
  [TASK_PRIORITY.LOW]: { backgroundColor: '#E0F2FE', color: '#075985' },
  [TASK_PRIORITY.MEDIUM]: { backgroundColor: '#FEF3C7', color: '#92400E' },
  [TASK_PRIORITY.HIGH]: { backgroundColor: '#FEE2E2', color: '#991B1B' },
} as const

export const REQUEST_STATUS_CONFIG = {
  [REQUEST_STATUS.DRAFT]: { label: 'Brouillon', style: { backgroundColor: '#F3F4F6', color: '#374151' } },
  [REQUEST_STATUS.PENDING_MANAGER]: { label: 'En attente Chef', style: { backgroundColor: '#FEF3C7', color: '#92400E' } },
  [REQUEST_STATUS.PENDING_HR]: { label: 'En attente RH', style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
  [REQUEST_STATUS.APPROVED]: { label: 'Approuve', style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
  [REQUEST_STATUS.REJECTED]: { label: 'Rejete', style: { backgroundColor: '#FEE2E2', color: '#991B1B' } },
} as const

export const REQUEST_TYPE_LABELS = {
  [REQUEST_TYPE.LEAVE]: 'Conge',
  [REQUEST_TYPE.AUTHORIZATION]: 'Autorisation',
  [REQUEST_TYPE.DOCUMENT]: 'Document RH',
  [REQUEST_TYPE.LOAN]: 'Pret',
} as const

export const TASK_STATUS_CONFIG = {
  [TASK_STATUS.TODO]: { label: 'A faire', style: { backgroundColor: '#E2E8F0', color: '#334155' } },
  [TASK_STATUS.IN_PROGRESS]: { label: 'En cours', style: { backgroundColor: '#DBEAFE', color: '#1D4ED8' } },
  [TASK_STATUS.IN_REVIEW]: { label: 'En revision', style: { backgroundColor: '#FEF3C7', color: '#92400E' } },
  [TASK_STATUS.DONE]: { label: 'Terminee', style: { backgroundColor: '#DCFCE7', color: '#166534' } },
} as const

export const TASK_PRIORITY_CONFIG = {
  [TASK_PRIORITY.LOW]: { label: 'Priorite Basse', style: PRIORITY_COLORS[TASK_PRIORITY.LOW] },
  [TASK_PRIORITY.MEDIUM]: { label: 'Priorite Moyenne', style: PRIORITY_COLORS[TASK_PRIORITY.MEDIUM] },
  [TASK_PRIORITY.HIGH]: { label: 'Priorite Haute', style: PRIORITY_COLORS[TASK_PRIORITY.HIGH] },
} as const

export const SLA_STATUS_CONFIG = {
  MET: { label: 'Conforme', style: { backgroundColor: '#DCFCE7', color: '#166534' } },
  WARNING: { label: 'Attention', style: { backgroundColor: '#FEF3C7', color: '#92400E' } },
  BREACHED: { label: 'SLA dépassé', style: { backgroundColor: '#FEE2E2', color: '#991B1B' } },
} as const

export const ROLE_CONFIG = {
  [ROLE.HR]: { label: 'RH', style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
  [ROLE.MANAGER]: { label: 'Chef', style: { backgroundColor: '#FEF3C7', color: '#92400E' } },
  [ROLE.EMPLOYEE]: { label: 'Collaborateur', style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
} as const
