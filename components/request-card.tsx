'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RequestWorkflowTrail } from '@/components/request-workflow-trail'
import { useAuth } from '@/lib'
import { canUserExamineRequest } from '@/lib/request-actions'
import { formatRequestDateTime } from '@/lib/request-date'
import { Request, RequestStatus } from '@/lib/types'
import { parseRequestContent } from '@/lib/request-content'
import { buildRequestWorkflowSteps } from '@/lib/request-workflow'
import { formatDateOnly, getLeaveDurationLabel, getLeaveImpactSummary, isLeaveRequestType } from '@/lib/leave-request'
import { ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

function formatSlaStatus(request: Request): string | null {
  if (!request.slaDeadline || request.slaBreached) return null
  const deadline = new Date(request.slaDeadline)
  const now = new Date()
  const hours = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60))
  if (hours < 0) return 'Expiré'
  if (hours <= 6) return `Expire dans ${hours}h`
  return null
}

interface RequestCardProps {
  request: Request
  onView?: (request: Request) => void
  showApprovalAction?: boolean
  onExamine?: (request: Request) => void
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

export function RequestCard({ request, onView, showApprovalAction, onExamine }: RequestCardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const status = statusConfig[request.status] || statusConfig.BROUILLON
  const { title, description } = parseRequestContent(request)
  const workflowSteps = buildRequestWorkflowSteps(request, user?.id)
  const canExamine = canUserExamineRequest(request, user?.role)
  const slaStatus = formatSlaStatus(request)
  const isLeaveRequest = isLeaveRequestType(request.type)
  const leaveImpact = getLeaveImpactSummary({
    startDate: request.startDate,
    endDate: request.endDate,
    leaveBalance: request.employee?.leaveBalance,
  })

  const isDraft = request.status === 'BROUILLON'

  const handleClick = () => {
    if (isDraft) {
      router.push(`/dashboard/new-request?draftId=${request.id}`)
    } else if (onView) {
      onView(request)
    }
  }

  return (
    <Card 
      className={`flex w-full min-w-0 max-w-full flex-col gap-4 overflow-hidden p-4 transition-shadow hover:shadow-md ${isDraft ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="min-w-0 max-w-full text-sm font-semibold text-foreground wrap-anywhere line-clamp-2">
            Titre : {title}
          </p>
          <p className="mt-1 min-w-0 max-w-full text-sm text-muted-foreground wrap-anywhere line-clamp-3">
            Description : {description || 'Aucune description fournie'}
          </p>
          {isLeaveRequest && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Periode : {formatDateOnly(request.startDate) || '-'} au {formatDateOnly(request.endDate) || '-'}
              </span>
              <span>Duree : {getLeaveDurationLabel(leaveImpact.requestedDays)}</span>
            </div>
          )}
          {request.employee && (
            <p className="text-xs text-muted-foreground mt-1">par {request.employee.name}</p>
          )}
        </div>
        <Badge variant="secondary" className="shrink-0">
          {typeLabels[request.type] || request.type}
        </Badge>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-2">
          <Badge className="border-0" style={status.style}>
            {status.label}
          </Badge>
          {request.slaBreached && (
            <Badge variant="destructive">SLA Dépassé</Badge>
          )}
          {slaStatus && (
            <span className="text-xs text-amber-600 font-medium">{slaStatus}</span>
          )}
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRequestDateTime(request.createdAt)}
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
        <div className="pt-2 border-t flex gap-2">
          <Button size="sm" variant="outline" className="flex-1">
            Examiner
          </Button>
        </div>
      )}
    </Card>
  )
}
