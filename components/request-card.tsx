'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
<<<<<<< HEAD
import { RequestWorkflowTrail } from '@/components/request-workflow-trail'
import { useAuth } from '@/lib/auth-context'
import { canUserExamineRequest } from '@/lib/request-actions'
import { formatRequestDateTime } from '@/lib/request-date'
import { Request, RequestStatus } from '@/lib/types'
import { parseRequestContent } from '@/lib/request-content'
import { buildRequestWorkflowSteps } from '@/lib/request-workflow'
=======
import { Request, RequestStatus } from '@/lib/types'
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
import { ChevronRight } from 'lucide-react'

interface RequestCardProps {
  request: Request
  onView?: (request: Request) => void
  showApprovalAction?: boolean
<<<<<<< HEAD
  onExamine?: (request: Request) => void
=======
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
}

const statusConfig: Record<RequestStatus, { label: string; style: React.CSSProperties }> = {
  BROUILLON: { label: 'Brouillon', style: { backgroundColor: '#F3F4F6', color: '#374151' } },
  EN_ATTENTE_CHEF: { label: 'En attente Chef', style: { backgroundColor: '#FEF3C7', color: '#92400E' } },
  EN_ATTENTE_RH: { label: 'En attente RH', style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
  APPROUVE: { label: 'Approuvé', style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
  REJETE: { label: 'Rejeté', style: { backgroundColor: '#FEE2E2', color: '#991B1B' } },
}

const typeLabels: Record<string, string> = {
  CONGE: 'Congé',
  AUTORISATION: 'Autorisation',
  DOCUMENT: 'Document',
  PRET: 'Prêt',
}

<<<<<<< HEAD
export function RequestCard({ request, onView, showApprovalAction, onExamine }: RequestCardProps) {
  const { user } = useAuth()
  const status = statusConfig[request.status] || statusConfig.BROUILLON
  const { title, description } = parseRequestContent(request)
  const workflowSteps = buildRequestWorkflowSteps(request, user?.id)
  const canExamine = canUserExamineRequest(request, user?.role)

  return (
    <Card className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-hidden p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="min-w-0 max-w-full text-sm font-semibold text-foreground wrap-anywhere line-clamp-2">
            Title: {title}
          </p>
          <p className="mt-1 min-w-0 max-w-full text-sm text-muted-foreground wrap-anywhere line-clamp-3">
            Description: {description || 'No description provided'}
          </p>
=======
export function RequestCard({ request, onView, showApprovalAction }: RequestCardProps) {
  const status = statusConfig[request.status] || statusConfig.BROUILLON

  // Parse title and description from comment field: "[Title] - Description"
  let title = request.type
  let description = ''
  if (request.comment) {
    const match = request.comment.match(/^\[(.+?)\]\s*-\s*(.*)$/)
    if (match) {
      title = match[1]
      description = match[2]
    } else {
      description = request.comment
    }
  }

  const isPending = request.status === 'EN_ATTENTE_CHEF' || request.status === 'EN_ATTENTE_RH'

  return (
    <Card className="flex flex-col gap-4 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{description}</p>
          )}
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
          {request.employee && (
            <p className="text-xs text-muted-foreground mt-1">par {request.employee.name}</p>
          )}
        </div>
<<<<<<< HEAD
        <Badge variant="secondary" className="shrink-0">
          {typeLabels[request.type] || request.type}
        </Badge>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-2">
          <Badge className="border-0" style={status.style}>
            {status.label}
          </Badge>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRequestDateTime(request.createdAt)}
=======
        <Badge variant="secondary">{typeLabels[request.type] || request.type}</Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Badge className="border-0" style={status.style}>
            {status.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(request.createdAt).toLocaleDateString()}
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
          </span>
        </div>
        {onView && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onView(request)}
            className="ml-auto"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

<<<<<<< HEAD
      {/* Examiner button — navigates to My Approvals with modal pre-open */}
      <RequestWorkflowTrail steps={workflowSteps} />
      {onExamine && canExamine && (
        <div className="pt-2 border-t flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onExamine(request)}
          >
            Examiner
          </Button>
        </div>
      )}

      {/* Legacy approval action for non-navigating contexts (e.g. RH approvals page) */}
      {showApprovalAction && !onExamine && canExamine && (
=======
      {showApprovalAction && isPending && (
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
        <div className="pt-2 border-t flex gap-2">
          <Button size="sm" variant="outline" className="flex-1">
            Examiner
          </Button>
        </div>
      )}
    </Card>
  )
}
