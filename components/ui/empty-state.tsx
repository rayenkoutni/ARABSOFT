import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  message: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon,
  message,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-dashed p-10 text-center ${className ?? ''}`.trim()}
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
    >
      <Icon className="mx-auto mb-4 h-12 w-12 opacity-50" />
      <p className="font-medium" style={{ color: 'var(--color-text)' }}>
        {message}
      </p>
      {description ? <p className="mt-1 text-sm">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="mt-4" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
