'use client'

import { formatRequestDateTime } from '@/lib/request-date'
import { WorkflowStep } from '@/lib/request-workflow'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

interface RequestWorkflowTrailProps {
  steps: WorkflowStep[]
}

function WorkflowStepRow({ step }: { step: WorkflowStep }) {
  if (step.kind === 'pending') {
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Clock className="h-4 w-4 shrink-0" style={{ color: '#F59E0B' }} />
        <span className="wrap-anywhere" style={{ color: 'var(--color-text-muted)' }}>
          {step.label}
        </span>
      </div>
    )
  }

  const isApprove = step.action === 'APPROVE'
  const IconComponent = isApprove ? CheckCircle2 : XCircle
  const iconColor = isApprove ? '#10B981' : '#EF4444'
  const mainLabel = isApprove
    ? step.byYou
      ? 'Approuvé par vous'
      : `Approuvé · ${step.actorName} : ${step.actorRole}`
    : step.byYou
      ? 'Rejeté par vous'
      : `Rejeté · ${step.actorName} : ${step.actorRole}`

  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <IconComponent className="h-4 w-4 shrink-0" style={{ color: iconColor }} />
        <span
          className="min-w-0 flex-1 font-medium wrap-anywhere"
          style={{ color: step.byYou ? 'var(--color-text)' : 'var(--color-text-muted)' }}
        >
          {mainLabel}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {formatRequestDateTime(step.date)}
        </span>
      </div>
      {step.comment && step.comment.trim() && (
        <div className="ml-6 text-xs italic wrap-anywhere" style={{ color: 'var(--color-text-muted)' }}>
          commentaire : {step.comment.trim()}
        </div>
      )}
    </div>
  )
}

export function RequestWorkflowTrail({ steps }: RequestWorkflowTrailProps) {
  if (steps.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 border-t pt-2">
      {steps.map((step, index) => (
        <WorkflowStepRow key={index} step={step} />
      ))}
    </div>
  )
}
