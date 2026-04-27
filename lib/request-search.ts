import { parseRequestContent } from '@/lib/request-content'
import { formatRequestDateTime } from '@/lib/request-date'
import { formatDateOnly, getLeaveDurationLabel, getLeaveImpactSummary, isLeaveRequestType } from '@/lib/leave-request'
import { buildRequestWorkflowSteps, WorkflowStep } from '@/lib/request-workflow'
import { Request } from '@/lib/types'

const requestStatusLabels: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_CHEF: 'En attente Chef',
  EN_ATTENTE_RH: 'En attente RH',
  APPROUVE: 'Approuve',
  REJETE: 'Rejete',
}

const requestTypeLabels: Record<string, string> = {
  CONGE: 'Conge',
  AUTORISATION: 'Autorisation',
  DOCUMENT: 'Document',
  PRET: 'Pret',
}

export function formatWorkflowStepSearchText(step: WorkflowStep) {
  if (step.kind === 'pending') {
    return step.label
  }

  const actionLabel = step.action === 'APPROVE'
    ? (step.byYou ? 'Approuve par vous' : `Approuve · ${step.actorName} : ${step.actorRole}`)
    : (step.byYou ? 'Rejete par vous' : `Rejete · ${step.actorName} : ${step.actorRole}`)

  return [actionLabel, step.comment?.trim(), formatRequestDateTime(step.date)]
    .filter(Boolean)
    .join(' ')
}

export function buildRequestCardSearchText(request: Request, currentUserId?: string) {
  const { title, description } = parseRequestContent(request)
  const workflowSteps = buildRequestWorkflowSteps(request, currentUserId)
  const leaveImpact = getLeaveImpactSummary({
    startDate: request.startDate,
    endDate: request.endDate,
    leaveBalance: request.employee?.leaveBalance,
  })

  return [
    `Titre : ${title}`,
    `Description : ${description || 'Aucune description fournie'}`,
    request.type,
    requestTypeLabels[request.type] || request.type,
    request.employee?.name,
    request.status,
    requestStatusLabels[request.status] || request.status,
    formatRequestDateTime(request.createdAt),
    isLeaveRequestType(request.type) ? `Date debut : ${formatDateOnly(request.startDate)}` : '',
    isLeaveRequestType(request.type) ? `Date fin : ${formatDateOnly(request.endDate)}` : '',
    isLeaveRequestType(request.type) ? `Duree : ${getLeaveDurationLabel(leaveImpact.requestedDays)}` : '',
    ...workflowSteps.map(formatWorkflowStepSearchText),
  ]
    .filter(Boolean)
    .join(' ')
}

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
