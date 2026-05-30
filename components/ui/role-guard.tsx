import { ReactNode } from 'react'
import { Role } from '@/lib/constants'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

interface RoleGuardProps {
  roles: Role[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { user, isLoading } = useCurrentUser()

  if (isLoading) {
    return null
  }

  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
