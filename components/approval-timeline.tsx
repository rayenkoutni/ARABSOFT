import { Approval } from '@/lib/types'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

interface ApprovalTimelineProps {
  approvals: Approval[]
}

export function ApprovalTimeline({ approvals }: ApprovalTimelineProps) {
  const sortedApprovals = [...approvals].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-4">
      {sortedApprovals.map((approval, index) => (
        <div key={approval.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className="rounded-full p-1"
              style={{
                backgroundColor:
                  approval.status === 'APPROVED'
                    ? 'rgba(16, 185, 129, 0.1)'
                    : approval.status === 'REJECTED'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'rgba(245, 166, 35, 0.1)'
              }}
            >
              {approval.status === 'APPROVED' && (
                <CheckCircle2 className="h-5 w-5" style={{ color: '#10B981' }} />
              )}
              {approval.status === 'REJECTED' && (
                <XCircle className="h-5 w-5" style={{ color: '#EF4444' }} />
              )}
              {approval.status === 'PENDING' && (
                <Clock className="h-5 w-5" style={{ color: '#F5A623' }} />
              )}
            </div>
            {index < sortedApprovals.length - 1 && (
              <div className="h-8 w-0.5 my-1" style={{ backgroundColor: 'var(--color-border)' }} />
            )}
          </div>

          <div className="flex-1 pt-1">
            <p className="font-medium" style={{ color: 'var(--color-text)' }}>{approval.approverName}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {approval.approverRole === 'CHEF' ? 'Manager' : 'HR'} Review
            </p>
            {approval.status === 'PENDING' && (
              <p className="text-xs mt-1" style={{ color: '#92400E' }}>Awaiting action</p>
            )}
            {approval.timestamp && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {approval.timestamp.toLocaleDateString()}
              </p>
            )}
            {approval.comment && (
              <p className="text-sm mt-2 italic" style={{ color: 'var(--color-text)' }}>{`"${approval.comment}"`}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
