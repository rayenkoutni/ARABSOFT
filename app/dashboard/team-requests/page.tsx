'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { requestService } from '@/lib/request-service'
import { Request } from '@/lib/types'
import { RequestCard } from '@/components/request-card'
import { BrandedLoading } from '@/components/ui/spinner'

export default function TeamRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        const data = await requestService.getAllRequests()
        // Filter for team members' requests
        setRequests(data)
      } finally {
        setIsLoading(false)
      }
    }

    loadRequests()
  }, [user])

  if (!user || user.role !== 'CHEF') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">This page is for managers only</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>Team Requests</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          View all requests from your team members
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <BrandedLoading />
        </div>
      ) : requests.length > 0 ? (
        <div className="grid gap-4">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <p>No team requests found</p>
        </div>
      )}
    </div>
  )
}
