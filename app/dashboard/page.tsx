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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, PieChart, Pie, LineChart, Line } from 'recharts'

interface SlaStats {
  breachedThisMonth: number
  breachByType: { type: string; _count: { type: number } }[]
  slaStatusDistribution: { slaStatus: string; _count: { slaStatus: number } }[]
  byType: {
    type: string
    total: number
    breached: number
    met: number
    complianceRate: number
    avgHours: number
  }[]
  complianceRate: number
  metCount: number
  totalRequests: number
  averageResolutionHours: number
  breachTrend: { date: string; count: number }[]
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
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        setLoadError(null)

        const statsData = await requestService.getDashboardStats(user.id, user.role)
        setStats(statsData)

         if (user.role === 'RH' || user.role === 'CHEF') {
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
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
        setLoadError(error instanceof Error ? error.message : 'Impossible de charger le tableau de bord')
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

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

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
        {user.role === 'CHEF' && slaStats && (
          <StatCard
            label="Dépassements équipe (mois)"
            value={slaStats.breachedThisMonth}
            icon={AlertTriangle}
          />
        )}
      </div>

        {/* SLA Unified Dashboard - Single Card */}
        {(user.role === 'RH' || user.role === 'CHEF') && slaStats && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-4 lg:p-5 min-h-[500px] md:min-h-[550px]">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {user.role === 'CHEF' ? 'Analyse SLA – Vue équipe' : 'Analyse SLA – Vue globale'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {user.role === 'CHEF' ? 'Performance SLA de votre équipe' : 'Vue globale du respect des SLA'}
              </p>
            </div>

              {/* Main Grid: Trend (60%) | Column (40%) */}
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 md:gap-6">
               {/* Left: Trend Line Chart */}
               <div className="lg:col-span-6 flex flex-col">
                 <h4 className="text-sm font-medium text-gray-700 mb-4">
                   Tendance des dépassements (30 jours)
                 </h4>
                 <div className="h-[200px] md:h-[300px] lg:h-[500px]">
                   <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={slaStats.breachTrend || []}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#F9FAFB" vertical={false} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#6B7280' }}
                        tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                        interval="preserveStartEnd"
                      />
                       <YAxis
                         axisLine={false}
                         tickLine={false}
                         allowDecimals={false}
                         tick={{ fontSize: 10, fill: '#9CA3AF' }}
                         domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, dataMax + 1)]}
                       />
                      <Tooltip
                        labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR')}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #E5E7EB',
                          borderRadius: '6px',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '12px',
                        }}
                        formatter={(value) => [value, 'Breaches']}
                      />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#EF4444"
                          strokeWidth={4}
                          dot={(props) => {
                            const { payload, cx, cy, index } = props;
                            const maxValue = Math.max(...(slaStats.breachTrend || []).map(d => d.count));
                            const isPeak = payload.count === maxValue && maxValue > 0;
                            return (
                              <circle
                                key={index}
                                cx={cx}
                                cy={cy}
                                r={isPeak ? 6 : 3}
                                fill="#EF4444"
                                stroke="#fff"
                                strokeWidth={isPeak ? 3 : 1.5}
                              />
                            );
                          }}
                          activeDot={{ r: 8, fill: '#EF4444', stroke: '#fff', strokeWidth: 3 }}
                        />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

               {/* Right: Column - stacked */}
               <div className="lg:col-span-4 flex flex-col gap-4 md:gap-5">
                  {/* Top: Pie Chart */}
                  <div className="flex flex-col">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Répartition des statuts SLA
                    </h4>
                    <div className="h-[200px] md:h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={
                              // Always show all three status types for consistency
                              [
                                { name: 'Conforme', value: slaStats.slaStatusDistribution?.find(item => item.slaStatus === 'MET')?._count.slaStatus || 0, fill: '#10B981' },
                                { name: 'Attention', value: slaStats.slaStatusDistribution?.find(item => item.slaStatus === 'WARNING')?._count.slaStatus || 0, fill: '#F59E0B' },
                                { name: 'Dépassé', value: slaStats.slaStatusDistribution?.find(item => item.slaStatus === 'BREACHED')?._count.slaStatus || 0, fill: '#EF4444' },
                              ]
                            }
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                            outerRadius={75}
                            innerRadius={25}
                            dataKey="value"
                          />
                          <Tooltip formatter={(value) => [value, 'Demandes']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="flex justify-center gap-3 mt-2 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Conforme
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Attention
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Dépassé
                      </span>
                    </div>
                  </div>

                 {/* Bottom: Bar Chart */}
                  <div className="flex flex-col">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Dépassements par type
                    </h4>
                    <div className="h-[200px] md:h-[240px] flex items-center justify-center">
                      {slaStats.breachByType && slaStats.breachByType.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={slaStats.breachByType.map((b) => ({
                              name: typeLabels[b.type] || b.type,
                              count: b._count.type,
                            }))}
                            margin={{ top: 15, right: 5, left: 5, bottom: 40 }}
                            barCategoryGap={slaStats.breachByType.length === 1 ? '75%' : '8%'}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#F9FAFB" vertical={false} />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#6B7280' }}
                              interval={0}
                              angle={0}
                              textAnchor="middle"
                              height={30}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              allowDecimals={false}
                              tick={{ fontSize: 9, fill: '#9CA3AF' }}
                              domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, dataMax + 1)]}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #E5E7EB',
                                borderRadius: '6px',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '11px',
                              }}
                              formatter={(value) => [value, 'dépassements']}
                            />
                            <Bar dataKey="count" fill="#6B7280" radius={[4, 4, 0, 0]} maxBarSize={70}>
                              <LabelList
                                dataKey="count"
                                position="top"
                                style={{ fill: '#374151', fontSize: '12px', fontWeight: '600' }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center text-gray-400 text-sm italic">
                          Aucun dépassement détecté
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
          </div>
        )}

       {/* KPI Summary Cards */}
       {(user.role === 'RH' || user.role === 'CHEF') && slaStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white rounded-lg p-3 md:p-4 lg:p-5 border border-gray-200 shadow-sm">
             <h3 className="text-sm font-medium text-gray-500 mb-2">
               {user.role === 'CHEF' ? 'Taux de conformité (équipe)' : 'Taux de conformité SLA'}
             </h3>
             <div className="text-3xl font-bold text-green-600">
               {slaStats.complianceRate?.toFixed(1)}%
             </div>
             <p className="text-xs text-gray-500 mt-1">
               {slaStats.metCount || 0} / {slaStats.totalRequests} demandes
             </p>
           </div>

            <div className="bg-white rounded-lg p-3 md:p-4 lg:p-5 border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Temps de résolution moyen</h3>
             <div className="text-3xl font-bold text-blue-600">
               {slaStats.averageResolutionHours?.toFixed(1)}h
             </div>
             <p className="text-xs text-gray-500 mt-1">
               De la création à la résolution
             </p>
           </div>

            <div className="bg-white rounded-lg p-3 md:p-4 lg:p-5 border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                {user.role === 'CHEF' ? 'Dépassements équipe (mois)' : 'Total des dépassements (Mois)'}
              </h3>
             <div className="text-3xl font-bold text-red-600">
               {slaStats.breachedThisMonth}
             </div>
             <p className="text-xs text-gray-500 mt-1">
               {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
             </p>
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
