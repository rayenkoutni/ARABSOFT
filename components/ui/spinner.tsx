import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

function BrandedLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-25" />
        <img
          src="/logo.png"
          alt="Loading..."
          className="h-12 w-auto animate-pulse relative z-10"
        />
      </div>
      <p className="text-sm font-medium animate-pulse" style={{ color: 'var(--color-brand-blue)' }}>
        Loading...
      </p>
    </div>
  )
}

export { Spinner, BrandedLoading }
