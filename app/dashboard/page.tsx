'use client'

import { useEffect, useState } from 'react'
<<<<<<< HEAD
import { useRouter } from 'next/navigation'
=======
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
import { useAuth } from '@/lib/auth-context'
import { requestService } from '@/lib/request-service'
import { Request } from '@/lib/types'
import { StatCard } from '@/components/stat-card'
import { RequestCard } from '@/components/request-card'
import { Button } from '@/components/ui/button'
<<<<<<< HEAD
=======
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
import {
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { BrandedLoading } from '@/components/ui/spinner'

export default function DashboardPage() {
  const { user } = useAuth()
<<<<<<< HEAD
  const router = useRouter()
=======
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
  })
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!user) return

      try {
        setIsLoading(true)

<<<<<<< HEAD
        // Load stats — unchanged for all roles
=======
        // Load stats
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
        const statsData = await requestService.getDashboardStats(user.id, user.role)
        setStats(statsData)

        // Load requests based on role
        let requestsData: Request[] = []
        if (user.role === 'RH') {
          requestsData = await requestService.getAllRequests()
        } else if (user.role === 'CHEF') {
<<<<<<< HEAD
          // Only EN_ATTENTE_CHEF + CHEF_THEN_RH requests — the actionable pending ones
=======
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
          requestsData = await requestService.getManagerPendingRequests(user.id)
        } else {
          requestsData = await requestService.getUserRequests(user.id)
        }

<<<<<<< HEAD
        // Limit to 5 most recent
=======
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
        setRequests(requestsData.slice(0, 5))
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user])

  if (!user) return null

  const dashboardTitle = {
    RH: 'HR Dashboard',
    CHEF: 'Manager Dashboard',
    COLLABORATEUR: 'Employee Dashboard',
  }[user.role]

<<<<<<< HEAD
  // Navigate to My Approvals and pre-open the modal for the selected request
  const handleExamine = (request: Request) => {
    if (user.role === 'CHEF') {
      router.push(`/dashboard/my-approvals?requestId=${request.id}`)
      return
    }

    if (user.role === 'RH') {
      router.push(`/dashboard/approvals?requestId=${request.id}`)
    }
  }

=======
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{dashboardTitle}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Welcome back, {user.name}
          </p>
        </div>
        {user.role === 'COLLABORATEUR' && (
          <Link href="/dashboard/new-request">
            <Button className="gap-2" style={{ backgroundColor: '#2563B0', color: 'white' }}>
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Requests"
          value={stats.totalRequests}
          icon={BarChart3}
          trend={{ direction: 'up', percentage: 12 }}
        />
        <StatCard
          label="Pending"
          value={stats.pendingRequests}
          icon={Clock}
        />
        <StatCard
          label="Approved"
          value={stats.approvedRequests}
          icon={CheckCircle2}
          trend={{ direction: 'up', percentage: 8 }}
        />
        <StatCard
          label="Rejected"
          value={stats.rejectedRequests}
          icon={XCircle}
        />
      </div>

<<<<<<< HEAD
      {/* Recent / Pending Requests */}
=======
      {/* Recent Requests */}
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            {user.role === 'RH'
              ? 'Recent Requests'
              : user.role === 'CHEF'
                ? 'Pending Approvals'
                : 'My Recent Requests'}
          </h2>
          <Link href={
            user.role === 'RH'
              ? '/dashboard/requests'
              : user.role === 'CHEF'
                ? '/dashboard/my-approvals'
                : '/dashboard/my-requests'
          }>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
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
<<<<<<< HEAD
                onExamine={user.role === 'CHEF' || user.role === 'RH' ? handleExamine : undefined}
=======
                showApprovalAction={user.role === 'CHEF' || user.role === 'RH'}
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
<<<<<<< HEAD
            {user.role === 'CHEF'
              ? <p>Aucune approbation en attente</p>
              : <p>No requests yet</p>
            }
=======
            <p>No requests yet</p>
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
          </div>
        )}
      </div>
    </div>
  )
}
