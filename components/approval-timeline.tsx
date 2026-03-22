import { formatRequestDateTime } from '@/lib/request-date'
import { RequestHistoryEntry } from '@/lib/types'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

interface ApprovalTimelineProps {
  history: RequestHistoryEntry[]
}

export function ApprovalTimeline({ history }: ApprovalTimelineProps) {
  const sorted = [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const actionConfig: Record<string, { icon: React.ReactNode; label: string; bg: string }> = {
    CREATED: { icon: <Clock className="h-5 w-5" style={{ color: '#F5A623' }} />, label: 'Demande créée', bg: 'rgba(245, 166, 35, 0.1)' },
    APPROVE: { icon: <CheckCircle2 className="h-5 w-5" style={{ color: '#10B981' }} />, label: 'Approuvé', bg: 'rgba(16, 185, 129, 0.1)' },
    REJECT: { icon: <XCircle className="h-5 w-5" style={{ color: '#EF4444' }} />, label: 'Rejeté', bg: 'rgba(239, 68, 68, 0.1)' },
  }

  return (
    <div className="space-y-4">
      {sorted.map((entry, index) => {
        const config = actionConfig[entry.action] || actionConfig.CREATED
        return (
          <div key={entry.id} className="flex min-w-0 gap-4">
            <div className="flex flex-col items-center">
              <div className="rounded-full p-1" style={{ backgroundColor: config.bg }}>
                {config.icon}
              </div>
              {index < sorted.length - 1 && (
                <div className="h-8 w-0.5 my-1" style={{ backgroundColor: 'var(--color-border)' }} />
              )}
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <p className="font-medium wrap-anywhere" style={{ color: 'var(--color-text)' }}>{entry.actorName}</p>
              <p className="text-sm wrap-anywhere" style={{ color: 'var(--color-text-muted)' }}>{config.label}</p>
              <p className="mt-1 text-xs wrap-anywhere" style={{ color: 'var(--color-text-muted)' }}>
                {formatRequestDateTime(entry.createdAt)}
              </p>
              {entry.comment && (
                <p className="mt-2 text-sm italic wrap-anywhere" style={{ color: 'var(--color-text)' }}>{`"${entry.comment}"`}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
