'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge, TypeBadge } from '@/components/ui/status-badge'
import { RequestWorkflowTrail } from '@/components/request-workflow-trail'
import { REQUEST_STATUS, REQUEST_TYPE } from '@/lib/constants'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { getDocumentTypeLabel } from '@/lib/document-type'
import { canUserDownloadGeneratedDocument, canUserExamineRequest } from '@/lib/request-actions'
import { formatRequestDateTime } from '@/lib/request-date'
import { Request } from '@/lib/types'
import { parseRequestContent } from '@/lib/request-content'
import { buildRequestWorkflowSteps } from '@/lib/request-workflow'
import { formatDateOnly, getLeaveDurationLabel, getLeaveImpactSummary, isLeaveRequestType } from '@/lib/leave-request'
import { ChevronRight, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'

function formatSlaStatus(request: Request): string | null {
  if (request.slaStatus === 'BREACHED') return 'Depasse'
  if (request.slaStatus === 'WARNING' && request.slaDeadline) {
    const deadline = new Date(request.slaDeadline)
    const now = new Date()
    const hours = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60))
    if (hours <= 6 && hours > 0) return `Expire dans ${hours}h`
  }
  return null
}

interface RequestCardProps {
  request: Request
  onView?: (request: Request) => void
  showApprovalAction?: boolean
  onExamine?: (request: Request) => void
  onDownload?: (request: Request) => void
}

export function RequestCard({ request, onView, showApprovalAction, onExamine, onDownload }: RequestCardProps) {
  const { user } = useCurrentUser()
  const router = useRouter()
  const { title, description } = parseRequestContent(request)
  const workflowSteps = buildRequestWorkflowSteps(request, user?.id)
  const canExamine = canUserExamineRequest(request, user?.role)
  const canDownloadDocument = canUserDownloadGeneratedDocument(request, user)
  const slaStatus = formatSlaStatus(request)
  const isLeaveRequest = isLeaveRequestType(request.type)
  const documentTypeLabel = request.type === REQUEST_TYPE.DOCUMENT ? getDocumentTypeLabel(request.documentType) : null
  const downloadLabel = request.documentType === 'FICHE_PAIE'
    ? 'Telecharger la fiche de paie'
    : 'Telecharger le document'
  const leaveImpact = getLeaveImpactSummary({
    startDate: request.startDate,
    endDate: request.endDate,
    leaveBalance: request.employee?.leaveBalance,
  })

  const isDraft = request.status === REQUEST_STATUS.DRAFT

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
          {documentTypeLabel && (
            <p className="mt-2 text-xs text-muted-foreground">
              Type de document : {documentTypeLabel}
            </p>
          )}
          {request.employee && (
            <p className="text-xs text-muted-foreground mt-1">par {request.employee.name}</p>
          )}
        </div>
        <Badge variant="secondary" className="shrink-0">
          <TypeBadge type={request.type} />
        </Badge>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-2">
          <StatusBadge status={request.status} domain="request" className="border-0" />
          {request.slaStatus === 'BREACHED' && (
            <StatusBadge status={request.slaStatus} domain="sla" />
          )}
          {request.slaStatus === 'WARNING' && slaStatus && (
            <span className="text-xs text-amber-600 font-medium">{slaStatus}</span>
          )}
          {request.currentOwner && (
            <Badge variant="outline" className="text-xs">
              {request.currentOwner}
            </Badge>
          )}
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRequestDateTime(request.createdAt)}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onDownload && canDownloadDocument && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={(event) => {
                event.stopPropagation()
                onDownload(request)
              }}
            >
              <Download className="h-4 w-4" />
              {downloadLabel}
            </Button>
          )}
          {onView && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                onView(request)
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

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
