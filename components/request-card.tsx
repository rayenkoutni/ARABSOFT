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

const statusColors: Record<RequestStatus, { bg: string; text: string; style: React.CSSProperties }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', style: { backgroundColor: '#F3F4F6', color: '#374151' } },
  SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-900', style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
  MANAGER_APPROVED: { bg: 'bg-amber-100', text: 'text-amber-900', style: { backgroundColor: '#FEF3C7', color: '#92400E' } },
  RH_APPROVED: { bg: 'bg-green-100', text: 'text-green-900', style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-900', style: { backgroundColor: '#FEE2E2', color: '#991B1B' } },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-900', style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
}

export function RequestCard({ request, onView, showApprovalAction }: RequestCardProps) {
  const statusColor = statusColors[request.status]
  const typeLabels = {
    LEAVE: 'Leave',
    EQUIPMENT: 'Equipment',
    TRAINING: 'Training',
    OTHER: 'Other',
  }

  const pendingApprovals = request.approvals.filter(a => a.status === 'PENDING')

  return (
    <Card className="flex flex-col gap-4 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{request.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {request.description}
          </p>
        </div>
        <Badge variant="secondary">{typeLabels[request.type]}</Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Badge className={`${statusColor.bg} ${statusColor.text} border-0`} style={statusColor.style}>
            {request.status.replace(/_/g, ' ')}
          </Badge>
          {pendingApprovals.length > 0 && (
            <Badge variant="outline" style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: 'none' }}>
              {pendingApprovals.length} pending
            </Badge>
          )}
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

      {showApprovalAction && pendingApprovals.length > 0 && (
        <div className="pt-2 border-t flex gap-2">
          <Button size="sm" variant="outline" className="flex-1">
            Review
          </Button>
          <Button size="sm" className="flex-1">
            Approve
          </Button>
        </div>
      )}
    </Card>
  )
}
