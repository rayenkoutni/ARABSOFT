import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface CardSkeletonProps {
  rows?: number
}

export function CardSkeleton({ rows = 3 }: CardSkeletonProps) {
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <Skeleton className="h-5 w-1/3" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
    </Card>
  )
}

interface PageSkeletonProps {
  cards?: number
  rows?: number
}

export function PageSkeleton({ cards = 3, rows = 3 }: PageSkeletonProps) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: cards }).map((_, index) => (
        <CardSkeleton key={index} rows={rows} />
      ))}
    </div>
  )
}
