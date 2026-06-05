import {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  REQUEST_STATUS_CONFIG,
  REQUEST_TYPE_LABELS,
  ROLE_CONFIG,
  SLA_STATUS_CONFIG,
  TASK_PRIORITY_CONFIG,
  TASK_STATUS_CONFIG,
} from '@/lib/status'

type StatusDomain = 'request' | 'task' | 'sla' | 'role' | 'project' | 'priority'

const STATUS_CONFIG = {
  request: REQUEST_STATUS_CONFIG,
  task: TASK_STATUS_CONFIG,
  sla: SLA_STATUS_CONFIG,
  role: ROLE_CONFIG,
  priority: TASK_PRIORITY_CONFIG,
  project: Object.fromEntries(
    Object.entries(PROJECT_STATUS_LABELS).map(([status, label]) => [
      status,
      { label, style: PROJECT_STATUS_COLORS[status as keyof typeof PROJECT_STATUS_COLORS] },
    ]),
  ),
} as const

interface StatusBadgeProps {
  status: string
  domain: StatusDomain
  className?: string
}

export function StatusBadge({ status, domain, className }: StatusBadgeProps) {
  const configMap = STATUS_CONFIG[domain] as Record<string, { label: string; style: React.CSSProperties }>
  const config = configMap[status]
  const radiusClass = domain === 'sla' ? 'rounded-md' : 'rounded'

  return (
    <span
      className={`inline-flex items-center ${radiusClass} px-2 py-0.5 text-xs font-medium ${className ?? ''}`.trim()}
      style={config?.style}
    >
      {config?.label ?? status}
    </span>
  )
}

interface TypeBadgeProps {
  type: string
  className?: string
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  return <span className={className}>{REQUEST_TYPE_LABELS[type as keyof typeof REQUEST_TYPE_LABELS] ?? type}</span>
}

interface PriorityBadgeProps {
  priority: string
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const configMap = TASK_PRIORITY_CONFIG as Record<string, { label: string; style: React.CSSProperties }>
  const config = configMap[priority]

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${className ?? ''}`.trim()}
      style={config?.style}
    >
      {config?.label ?? priority}
    </span>
  )
}
