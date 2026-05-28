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

export function canUserDownloadGeneratedDocument(
  request: Request,
  user?: { id: string; role: UserRole } | null,
) {
  if (!user) {
    return false
  }

  if (
    request.type !== 'DOCUMENT' ||
    request.status !== 'APPROUVE' ||
    (request.documentType === 'ATTESTATION_TRAVAIL' && !request.generatedDocument) ||
    (request.documentType === 'FICHE_PAIE' && !request.payslip)
  ) {
    return false
  }

  if (user.role === 'RH') {
    return true
  }

  if (user.role === 'COLLABORATEUR') {
    return request.employeeId === user.id
  }

  return false
}
