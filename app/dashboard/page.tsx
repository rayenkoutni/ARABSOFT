'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib'
import { requestService } from '@/lib'
import { Request } from '@/lib/types'
import { StatCard } from '@/components/stat-card'
import { RequestCard } from '@/components/request-card'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import { BrandedLoading } from '@/components/ui/spinner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface SlaStats {
  breachedThisMonth: number
  breachByType: { type: string; _count: { type: number } }[]
}

const typeLabels: Record<string, string> = {
  CONGE: 'Congé',
  AUTORISATION: 'Autorisation',
  DOCUMENT: 'Document',
  PRET: 'Prêt',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
  })
  const [slaStats, setSlaStats] = useState<SlaStats | null>(null)
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!user) return

      try {
        setIsLoading(true)

        const statsData = await requestService.getDashboardStats(user.id, user.role)
        setStats(statsData)

        if (user.role === 'RH') {
          const res = await fetch('/api/sla/stats')
          if (res.ok) setSlaStats(await res.json())
        }

        let requestsData: Request[] = []
        if (user.role === 'RH') {
          requestsData = await requestService.getAllRequests()
        } else if (user.role === 'CHEF') {
          requestsData = await requestService.getManagerPendingRequests(user.id)
        } else {
          requestsData = await requestService.getUserRequests(user.id)
        }

        setRequests(requestsData.slice(0, 5))
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user])

  if (!user) return null

  const dashboardTitle = {
    RH: 'Tableau de bord RH',
    CHEF: 'Tableau de bord Manager',
    COLLABORATEUR: 'Tableau de bord employe',
  }[user.role]

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{dashboardTitle}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Bon retour, {user.name}
          </p>
        </div>
        {user.role === 'COLLABORATEUR' && (
          <Link href="/dashboard/new-request">
            <Button className="gap-2" style={{ backgroundColor: '#2563B0', color: 'white' }}>
              <Plus className="h-4 w-4" />
             Nouvelle demande
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total des demandes"
          value={stats.totalRequests}
          icon={BarChart3}
          trend={{ direction: 'up', percentage: 12 }}
        />
        <StatCard
          label="En attente"
          value={stats.pendingRequests}
          icon={Clock}
        />
        <StatCard
          label="Approuvees"
          value={stats.approvedRequests}
          icon={CheckCircle2}
          trend={{ direction: 'up', percentage: 8 }}
        />
        <StatCard
          label="Rejetees"
          value={stats.rejectedRequests}
          icon={XCircle}
        />
        {user.role === 'RH' && slaStats && (
          <StatCard
            label="SLA dépassés (mois)"
            value={slaStats.breachedThisMonth}
            icon={AlertTriangle}
          />
        )}
      </div>

      {/* SLA Chart - RH only */}
      {user.role === 'RH' && slaStats && slaStats.breachByType.length > 0 && (
        <div className="bg-card rounded-lg p-4 border">
          <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text)' }}>
            SLA dépassés par type (ce mois)
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slaStats.breachByType.map((b) => ({ name: typeLabels[b.type] || b.type, count: b._count.type }))}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent / Pending Requests */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            {user.role === 'RH'
              ? 'Demandes recentes'
              : user.role === 'CHEF'
                ? 'Approbations en attente'
                : 'Mes demandes recentes'}
          </h2>
          <Link href={
            user.role === 'RH'
              ? '/dashboard/requests'
              : user.role === 'CHEF'
                ? '/dashboard/my-approvals'
                : '/dashboard/my-requests'
          }>
            <Button variant="outline" size="sm">
              Voir tout
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
                onExamine={user.role === 'CHEF' || user.role === 'RH' ? handleExamine : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
            {user.role === 'CHEF'
              ? <p>Aucune approbation en attente</p>
              : <p>No requests yet</p>
            }
          </div>
        )}
      </div>
    </div>
  )
}
