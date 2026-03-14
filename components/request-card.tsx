'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Request, RequestStatus } from '@/lib/types'
import { ChevronRight } from 'lucide-react'

interface RequestCardProps {
  request: Request
  onView?: (request: Request) => void
  showApprovalAction?: boolean
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
          {request.employee && (
            <p className="text-xs text-muted-foreground mt-1">par {request.employee.name}</p>
          )}
        </div>
        <Badge variant="secondary">{typeLabels[request.type] || request.type}</Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Badge className="border-0" style={status.style}>
            {status.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(request.createdAt).toLocaleDateString()}
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

      {showApprovalAction && isPending && (
        <div className="pt-2 border-t flex gap-2">
          <Button size="sm" variant="outline" className="flex-1">
            Examiner
          </Button>
        </div>
      )}
    </Card>
  )
}
