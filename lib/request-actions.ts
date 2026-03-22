import { Request, UserRole } from '@/lib/types'

export function canUserExamineRequest(request: Request, role?: UserRole) {
  if (role === 'CHEF') {
    return request.status === 'EN_ATTENTE_CHEF'
  }

  if (role === 'RH') {
    return request.status === 'EN_ATTENTE_RH'
  }

  return false
}
