'use client'

import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/navigation'
import { Sidebar } from '@/components/sidebar'
import { GlobalMessageHandler } from '@/components/global-message-handler'
import { useEffect } from 'react'
import { BrandedLoading } from '@/components/ui/spinner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, isOtpVerified, isLoading } = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/')
      } else if (!isOtpVerified) {
        router.push('/')
      }
    }
  }, [isAuthenticated, isOtpVerified, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        <BrandedLoading />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Navigation />
      <GlobalMessageHandler />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="container max-w-7xl mx-auto px-3 md:px-4 lg:px-6 py-4 md:py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
