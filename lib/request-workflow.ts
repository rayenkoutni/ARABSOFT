import { Request, RequestHistoryEntry } from '@/lib/types'

export interface WorkflowActionStep {
  kind: 'action'
  action: 'APPROVE' | 'REJECT'
  byYou: boolean
  actorName: string
  actorRole: 'Chef' | 'RH'
  comment: string | null | undefined
  date: string
}

export interface WorkflowPendingStep {
  kind: 'pending'
  label: string
}

export type WorkflowStep = WorkflowActionStep | WorkflowPendingStep

function getActorRoleForStep(request: Request, stepIndex: number): 'Chef' | 'RH' {
  if (request.approvalType === 'DIRECT_RH') {
    return 'RH'
  }

  return stepIndex === 0 ? 'Chef' : 'RH'
}

export function buildRequestWorkflowSteps(
  request: Request,
  currentUserId?: string
): WorkflowStep[] {
  const actionEntries = [...request.history]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .filter((entry) => entry.action === 'APPROVE' || entry.action === 'REJECT')

  const steps: WorkflowStep[] = actionEntries.map((entry, index) => ({
    kind: 'action',
    action: entry.action as 'APPROVE' | 'REJECT',
    byYou: entry.actorId === currentUserId,
    actorName: entry.actorName,
    actorRole: getActorRoleForStep(request, index),
    comment: entry.comment,
    date: entry.createdAt,
  }))

  if (request.status === 'EN_ATTENTE_CHEF') {
    steps.push({ kind: 'pending', label: 'En attente de Chef' })
  } else if (request.status === 'EN_ATTENTE_RH') {
    steps.push({ kind: 'pending', label: 'En attente de RH' })
  }

  return steps
}
