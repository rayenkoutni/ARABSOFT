import { REQUEST_STATUS_CONFIG, REQUEST_TYPE_LABELS } from '@/lib/status'

interface StatusBadgeProps {
  status: keyof typeof REQUEST_STATUS_CONFIG
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = REQUEST_STATUS_CONFIG[status] || REQUEST_STATUS_CONFIG.BROUILLON
  
  return (
    <span 
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
      style={config.style}
    >
      {config.label}
    </span>
  )
}

interface TypeBadgeProps {
  type: keyof typeof REQUEST_TYPE_LABELS
  className?: string
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  return (
    <span className={className}>
      {REQUEST_TYPE_LABELS[type] || type}
    </span>
  )
}
