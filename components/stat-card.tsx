import { Card } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  trend?: {
    direction: 'up' | 'down'
    percentage: number
  }
}

export function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-3 p-6 border-t-4" style={{ borderTopColor: '#2563B0' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{label}</p>
        <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(37, 99, 176, 0.1)', color: '#2563B0' }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="font-semibold" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)' }}>{value}</h3>
        {trend && (
          <span
            className="text-xs font-medium"
            style={{
              color: trend.direction === 'up' ? 'var(--color-success)' : 'var(--color-danger)'
            }}
          >
            {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage}%
          </span>
        )}
      </div>
    </Card>
  )
}
