'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestService } from '@/lib'
import { REQUEST_STATUS, REQUEST_TYPE, ROLE, TASK_STATUS } from '@/lib/constants'
import { Request } from '@/lib/types'
import { RequestCard } from '@/components/request-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { KpiCard } from '@/components/ui/kpi-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  fetchDashboardEmployeeProfile,
  fetchDashboardEmployees,
  fetchDashboardReport,
  fetchDashboardTasks,
  fetchSlaStats,
} from '@/lib/services/client/dashboard.service'
import { fetchBonuses } from '@/lib/services/client/bonuses.service'
import {
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  TrendingUp,
  FileText,
  BriefcaseBusiness,
  Gift,
  CalendarDays,
  CheckCheck,
} from 'lucide-react'
import Link from 'next/link'
import { BrandedLoading } from '@/components/ui/spinner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, PieChart, Pie, LineChart, Line } from 'recharts'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { format } from 'date-fns'
import { formatAmountTnd, formatFrenchMonthYear, getBonusReasonLabel, getBonusTypeLabel, getMonthlyBounds } from '@/lib/payslip'

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

interface DashboardTask {
  id: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  taskScore?: number | null
  reviewComment?: string | null
  deliverableLink?: string | null
  deliverableNote?: string | null
  dueDate: string | null
  updatedAt: string
  assigneeId?: string
  project?: {
    id: string
    name: string
  } | null
  assignee?: {
    id: string
    name: string
  } | null
}

function canShowTaskCompletionDetails(task: DashboardTask) {
  return task.status === TASK_STATUS.DONE || task.status === TASK_STATUS.IN_PROGRESS
}

interface DashboardEmployee {
  id: string
  name: string
  role: string
  managerId: string | null
}

interface DashboardBonus {
  id: string
  amount: number
  type: string
  reason: string | null
  period: string | null
  createdAt: string
}

const chartTheme = {
  grid: 'var(--color-border)',
  axis: 'var(--color-text-muted)',
  surface: 'var(--color-surface)',
  text: 'var(--color-text)',
  mutedText: 'var(--color-text-muted)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  neutral: 'var(--color-brand-gray)',
}

const typeLabels: Record<string, string> = {
  [REQUEST_TYPE.LEAVE]: 'Conge',
  [REQUEST_TYPE.AUTHORIZATION]: 'Autorisation',
  [REQUEST_TYPE.DOCUMENT]: 'Document',
  [REQUEST_TYPE.LOAN]: 'Pret',
}

const taskStatusLabels: Record<DashboardTask['status'], string> = {
  [TASK_STATUS.TODO]: 'A faire',
  [TASK_STATUS.IN_PROGRESS]: 'En cours',
  [TASK_STATUS.IN_REVIEW]: 'En revision',
  [TASK_STATUS.DONE]: 'Terminee',
}

const taskPriorityLabels: Record<DashboardTask['priority'], string> = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
}

const taskPriorityBadgeStyles: Record<DashboardTask['priority'], { backgroundColor: string; color: string }> = {
  LOW: { backgroundColor: '#E0F2FE', color: '#075985' },
  MEDIUM: { backgroundColor: '#FEF3C7', color: '#92400E' },
  HIGH: { backgroundColor: '#FEE2E2', color: '#991B1B' },
}

function formatTaskDueDate(date: string | null) {
  if (!date) return 'Sans echeance'

  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getBonusMonthKey(bonus: DashboardBonus) {
  if (bonus.period && /^\d{4}-\d{2}$/.test(bonus.period)) {
    return bonus.period
  }

  return format(new Date(bonus.createdAt), 'yyyy-MM')
}

function unwrapRequestsResponse(response: Request[] | { data?: Request[] }) {
  if (Array.isArray(response)) return response
  return Array.isArray(response.data) ? response.data : []
}

function unwrapTasksResponse(response: DashboardTask[] | { data?: DashboardTask[] }) {
  if (Array.isArray(response)) return response
  return Array.isArray(response.data) ? response.data : []
}

function unwrapEmployeesResponse(response: DashboardEmployee[] | { data?: DashboardEmployee[] }) {
  if (Array.isArray(response)) return response
  return Array.isArray(response.data) ? response.data : []
}

export default function DashboardPage() {
  const { user } = useCurrentUser()
  const router = useRouter()
  const { toast } = useToast()
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
  })
  const [slaStats, setSlaStats] = useState<SlaStats | null>(null)
  const [requests, setRequests] = useState<Request[]>([])
  const [tasks, setTasks] = useState<DashboardTask[]>([])
  const [bonuses, setBonuses] = useState<DashboardBonus[]>([])
  const [leaveBalance, setLeaveBalance] = useState(0)
  const [employees, setEmployees] = useState<DashboardEmployee[]>([])
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all')
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all')
  const [selectedTaskStatusFilter, setSelectedTaskStatusFilter] = useState<'finished' | 'unfinished'>('finished')
  const [isLoading, setIsLoading] = useState(true)
  const [isExportingReport, setIsExportingReport] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        setLoadError(null)

        if (user.role === ROLE.HR || user.role === ROLE.MANAGER) {
          setSlaStats(await fetchSlaStats())
        }

        let requestsData: Request[] = []
        if (user.role === ROLE.HR) {
          requestsData = unwrapRequestsResponse(
            await requestService.getAllRequests() as Request[] | { data?: Request[] }
          )
        } else if (user.role === ROLE.MANAGER) {
          requestsData = unwrapRequestsResponse(
            await requestService.getManagerPendingRequests(user.id) as Request[] | { data?: Request[] }
          )
        } else {
          requestsData = unwrapRequestsResponse(
            await requestService.getUserRequests(user.id) as Request[] | { data?: Request[] }
          )
          requestsData = requestsData.filter((request) => request.status !== REQUEST_STATUS.DRAFT)
        }

        setStats({
          totalRequests: requestsData.length,
          pendingRequests: requestsData.filter((request) => request.status.startsWith('EN_ATTENTE')).length,
          approvedRequests: requestsData.filter((request) => request.status === REQUEST_STATUS.APPROVED).length,
          rejectedRequests: requestsData.filter((request) => request.status === REQUEST_STATUS.REJECTED).length,
        })
        setRequests(requestsData.slice(0, 5))

        if (user.role === ROLE.EMPLOYEE) {
          const [profileData, tasksData, bonusesData] = await Promise.all([
            fetchDashboardEmployeeProfile(),
            fetchDashboardTasks(),
            fetchBonuses(user.id),
          ])
          setLeaveBalance(typeof profileData.leaveBalance === 'number' ? profileData.leaveBalance : 0)
          setTasks(unwrapTasksResponse(tasksData as DashboardTask[] | { data?: DashboardTask[] }))
          setBonuses(Array.isArray(bonusesData) ? bonusesData : [])
        }

        if (user.role === ROLE.MANAGER || user.role === ROLE.HR) {
          const tasksData = await fetchDashboardTasks()
          setTasks(unwrapTasksResponse(tasksData as DashboardTask[] | { data?: DashboardTask[] }))
        }

        if (user.role === ROLE.HR) {
          const employeesData = await fetchDashboardEmployees()
          setEmployees(
            unwrapEmployeesResponse(employeesData as DashboardEmployee[] | { data?: DashboardEmployee[] })
          )
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Impossible de charger le tableau de bord')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user])

  if (!user) return null

  const dashboardTitle = {
    [ROLE.HR]: 'Tableau de bord RH',
    [ROLE.MANAGER]: 'Tableau de bord Manager',
    [ROLE.EMPLOYEE]: 'Tableau de bord employe',
  }[user.role]

  const currentMonthKey = format(new Date(), 'yyyy-MM')
  const currentMonthBonuses = bonuses.filter((bonus) => getBonusMonthKey(bonus) === currentMonthKey)
  const currentMonthBonusTotal = currentMonthBonuses.reduce((sum, bonus) => sum + bonus.amount, 0)

  const teamFilterOptions = user.role === ROLE.HR
    ? employees
        .filter((employee) => employee.role === ROLE.MANAGER)
        .map((chef) => ({
          id: chef.id,
          label: chef.name,
        }))
    : []

  const activeTeamTasks = user.role === ROLE.HR
    ? tasks.filter((task) => {
        if (selectedTeamFilter === 'all') return true

        const assignee = employees.find((employee) => employee.id === (task.assignee?.id || task.assigneeId))
        return assignee?.managerId === selectedTeamFilter
      })
    : tasks

  const projectSourceTasks = user.role === ROLE.EMPLOYEE ? tasks : activeTeamTasks

  const projectFilterOptions = Array.from(
    new Map(
      projectSourceTasks
        .filter((task) => task.project?.id && task.project?.name)
        .map((task) => [task.project!.id, task.project!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  const visibleTeamTasks = activeTeamTasks.filter((task) => {
    const matchesProject = selectedProjectFilter === 'all' || task.project?.id === selectedProjectFilter
    const matchesStatus = selectedTaskStatusFilter === 'finished'
      ? task.status === TASK_STATUS.DONE
      : task.status !== TASK_STATUS.DONE

    return matchesProject && matchesStatus
  })

  const visibleCollaboratorTasks = tasks.filter((task) => {
    const matchesProject = selectedProjectFilter === 'all' || task.project?.id === selectedProjectFilter
    const matchesStatus = selectedTaskStatusFilter === 'finished'
      ? task.status === TASK_STATUS.DONE
      : task.status !== TASK_STATUS.DONE

    return matchesProject && matchesStatus
  })

  // Navigate to My Approvals and pre-open the modal for the selected request
  const handleExamine = (request: Request) => {
    if (user.role === ROLE.MANAGER) {
      router.push(`/dashboard/my-approvals?requestId=${request.id}`)
      return
    }

    if (user.role === ROLE.HR) {
      router.push(`/dashboard/approvals?requestId=${request.id}`)
    }
  }

  const handleExportExecutiveReport = async () => {
    try {
      setIsExportingReport(true)

      const response = await fetchDashboardReport()
      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const disposition = response.headers.get('content-disposition')
      const fileName = disposition?.match(/filename="([^"]+)"/)?.[1] ?? 'rapport-performance-tableau-de-bord.pdf'
      const link = document.createElement('a')

      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)

      toast({
        title: 'Rapport PDF genere',
        description: 'Le rapport executif a ete telecharge avec succes.',
      })
    } catch {
      toast({
        title: "Echec de l'export",
        description: "Le rapport PDF n'a pas pu etre genere.",
        variant: 'destructive',
      })
    } finally {
      setIsExportingReport(false)
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
        <div className="flex items-center gap-3">
          {(user.role === ROLE.HR || user.role === ROLE.MANAGER) && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleExportExecutiveReport}
              disabled={isExportingReport}
            >
              <FileText className="h-4 w-4" />
              {isExportingReport ? 'Generation PDF...' : 'Exporter le rapport PDF'}
            </Button>
          )}
          {user.role === ROLE.EMPLOYEE && (
            <Link href="/dashboard/new-request">
              <Button className="gap-2" style={{ backgroundColor: '#2563B0', color: 'white' }}>
                <Plus className="h-4 w-4" />
               Nouvelle demande
              </Button>
            </Link>
          )}
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Stats Grid */}
      <div
        className={
          user.role === ROLE.EMPLOYEE
            ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
            : 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'
        }
      >
        <KpiCard
          label="Total des demandes"
          value={stats.totalRequests}
          icon={BarChart3}
          trend={{ direction: 'up', percentage: 12 }}
        />
        <KpiCard
          label="En attente"
          value={stats.pendingRequests}
          icon={Clock}
        />
        <KpiCard
          label="Approuvees"
          value={stats.approvedRequests}
          icon={CheckCircle2}
          trend={{ direction: 'up', percentage: 8 }}
        />
        <KpiCard
          label="Rejetees"
          value={stats.rejectedRequests}
          icon={XCircle}
        />
        {user.role === ROLE.EMPLOYEE && (
          <KpiCard
            label="Solde conge disponible"
            value={leaveBalance}
            icon={CalendarDays}
          />
        )}
        {user.role === ROLE.EMPLOYEE && (
          <Card className="flex flex-col gap-3 border-t-4 p-3 md:p-4 lg:p-5" style={{ borderTopColor: '#F5A623' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  Bonus du mois
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {formatFrenchMonthYear(getMonthlyBounds(currentMonthKey).start)}
                </p>
              </div>
              <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(245, 166, 35, 0.16)', color: '#D97706' }}>
                <Gift className="h-4 w-4" />
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="font-semibold" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)' }}>
                  {formatAmountTnd(currentMonthBonusTotal)}
                </h3>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {currentMonthBonuses.length} bonus ce mois-ci
                </p>
              </div>
              <Link href="/dashboard/bonuses">
                <Button variant="outline" size="sm">
                  Historique
                </Button>
              </Link>
            </div>

            <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
              {currentMonthBonuses.length > 0 ? (
                <>
                  {currentMonthBonuses.slice(0, 2).map((bonus) => (
                    <div key={bonus.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(245, 166, 35, 0.08)' }}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {getBonusReasonLabel(bonus.reason, bonus.type)}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {getBonusTypeLabel(bonus.type)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: '#B45309' }}>
                        {formatAmountTnd(bonus.amount)}
                      </span>
                    </div>
                  ))}
                  {currentMonthBonuses.length > 2 ? (
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      +{currentMonthBonuses.length - 2} autre{currentMonthBonuses.length - 2 > 1 ? 's' : ''} bonus dans l&apos;historique du mois
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Aucun bonus enregistre pour le mois en cours. Le suivi repart a zero chaque mois.
                </p>
              )}
            </div>
          </Card>
        )}
      </div>

        {/* SLA Unified Dashboard - Single Card */}
        {(user.role === ROLE.HR || user.role === ROLE.MANAGER) && slaStats && (
          <div className="min-h-[500px] rounded-xl border border-border bg-card p-3 shadow-sm md:min-h-[550px] md:p-4 lg:p-5">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">
                {user.role === ROLE.MANAGER ? 'Analyse SLA – Vue équipe' : 'Analyse SLA – Vue globale'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {user.role === ROLE.MANAGER ? 'Performance SLA de votre équipe' : 'Vue globale du respect des SLA'}
              </p>
            </div>

              {/* Main Grid: Trend (60%) | Column (40%) */}
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 md:gap-6">
               {/* Left: Trend Line Chart */}
               <div className="lg:col-span-6 flex flex-col">
                 <h4 className="mb-4 text-sm font-medium text-foreground">
                   Tendance des dépassements (30 jours)
                 </h4>
                 <div className="h-[200px] md:h-[300px] lg:h-[500px]">
                   <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={slaStats.breachTrend || []}>
                      <CartesianGrid strokeDasharray="4 4" stroke={chartTheme.grid} vertical={false} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: chartTheme.axis }}
                        tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                        interval="preserveStartEnd"
                      />
                       <YAxis
                         axisLine={false}
                         tickLine={false}
                         allowDecimals={false}
                         tick={{ fontSize: 10, fill: chartTheme.axis }}
                         domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, dataMax + 1)]}
                       />
                      <Tooltip
                        labelFormatter={(v) => new Date(v).toLocaleDateString('fr-FR')}
                        contentStyle={{
                          backgroundColor: chartTheme.surface,
                          border: `1px solid ${chartTheme.grid}`,
                          borderRadius: '6px',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '12px',
                          color: chartTheme.text,
                        }}
                        formatter={(value) => [value, 'Breaches']}
                      />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke={chartTheme.danger}
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
                                fill={chartTheme.danger}
                                stroke="#fff"
                                strokeWidth={isPeak ? 3 : 1.5}
                              />
                            );
                          }}
                          activeDot={{ r: 8, fill: chartTheme.danger, stroke: '#fff', strokeWidth: 3 }}
                        />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

               {/* Right: Column - stacked */}
               <div className="lg:col-span-4 flex flex-col gap-4 md:gap-5">
                  {/* Top: Pie Chart */}
                  <div className="flex flex-col">
                    <h4 className="mb-3 text-sm font-medium text-foreground">
                      Répartition des statuts SLA
                    </h4>
                    <div className="h-[200px] md:h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={
                              // Always show all three status types for consistency
                              [
                                { name: 'Conforme', value: slaStats.slaStatusDistribution?.find(item => item.slaStatus === 'MET')?._count.slaStatus || 0, fill: chartTheme.success },
                                { name: 'Attention', value: slaStats.slaStatusDistribution?.find(item => item.slaStatus === 'WARNING')?._count.slaStatus || 0, fill: chartTheme.warning },
                                { name: 'Dépassé', value: slaStats.slaStatusDistribution?.find(item => item.slaStatus === 'BREACHED')?._count.slaStatus || 0, fill: chartTheme.danger },
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
                          <Tooltip
                            formatter={(value) => [value, 'Demandes']}
                            contentStyle={{
                              backgroundColor: chartTheme.surface,
                              border: `1px solid ${chartTheme.grid}`,
                              borderRadius: '6px',
                              color: chartTheme.text,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="mt-2 flex justify-center gap-3 text-xs text-foreground">
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
                    <h4 className="mb-3 text-sm font-medium text-foreground">
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
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: chartTheme.axis }}
                              interval={0}
                              angle={0}
                              textAnchor="middle"
                              height={30}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              allowDecimals={false}
                              tick={{ fontSize: 9, fill: chartTheme.axis }}
                              domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, dataMax + 1)]}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: chartTheme.surface,
                                border: `1px solid ${chartTheme.grid}`,
                                borderRadius: '6px',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '11px',
                                color: chartTheme.text,
                              }}
                              formatter={(value) => [value, 'dépassements']}
                            />
                            <Bar dataKey="count" fill={chartTheme.neutral} radius={[4, 4, 0, 0]} maxBarSize={70}>
                              <LabelList
                                dataKey="count"
                                position="top"
                                style={{ fill: chartTheme.text, fontSize: '12px', fontWeight: '600' }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center text-sm italic text-muted-foreground">
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
       {(user.role === ROLE.HR || user.role === ROLE.MANAGER) && slaStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="rounded-lg border border-border bg-card p-3 shadow-sm md:p-4 lg:p-5">
             <h3 className="mb-2 text-sm font-medium text-muted-foreground">
               {user.role === ROLE.MANAGER ? 'Taux de conformité (équipe)' : 'Taux de conformité SLA'}
             </h3>
             <div className="text-3xl font-bold text-green-600">
               {slaStats.complianceRate?.toFixed(1)}%
             </div>
             <p className="mt-1 text-xs text-muted-foreground">
               {slaStats.metCount || 0} / {slaStats.totalRequests} demandes
             </p>
           </div>

            <div className="rounded-lg border border-border bg-card p-3 shadow-sm md:p-4 lg:p-5">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Temps de résolution moyen</h3>
             <div className="text-3xl font-bold text-blue-600">
               {slaStats.averageResolutionHours?.toFixed(1)}h
             </div>
             <p className="mt-1 text-xs text-muted-foreground">
               De la création à la résolution
             </p>
           </div>

            <div className="rounded-lg border border-border bg-card p-3 shadow-sm md:p-4 lg:p-5">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                {user.role === ROLE.MANAGER ? 'Dépassements équipe (mois)' : 'Total des dépassements (Mois)'}
              </h3>
             <div className="text-3xl font-bold text-red-600">
               {slaStats.breachedThisMonth}
             </div>
             <p className="mt-1 text-xs text-muted-foreground">
               {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
             </p>
           </div>
         </div>
       )}

      {user.role === ROLE.EMPLOYEE && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              Mes taches
            </h2>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Select value={selectedProjectFilter} onValueChange={setSelectedProjectFilter}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Filtrer par projet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les projets</SelectItem>
                  {projectFilterOptions.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedTaskStatusFilter} onValueChange={(value: 'finished' | 'unfinished') => setSelectedTaskStatusFilter(value)}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finished">Terminees</SelectItem>
                  <SelectItem value="unfinished">Non terminees</SelectItem>
                </SelectContent>
              </Select>

              <Link href="/dashboard/projects">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  Voir mes projets
                </Button>
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <BrandedLoading />
            </div>
          ) : visibleCollaboratorTasks.length > 0 ? (
            <div className="grid gap-4">
              {visibleCollaboratorTasks.map((task) => (
                <Card
                  key={task.id}
                  className="border border-border bg-card p-4 shadow-sm transition-colors hover:border-[color:var(--color-brand-blue)]/30"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{ backgroundColor: 'rgba(37, 99, 176, 0.1)', color: 'var(--color-brand-blue)' }}
                        >
                          <CheckCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                            {task.title}
                          </h3>
                          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {taskStatusLabels[task.status]}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <Badge
                        className="border-0"
                        style={
                          task.status === TASK_STATUS.DONE
                            ? { backgroundColor: '#DCFCE7', color: '#166534' }
                            : task.status === TASK_STATUS.IN_REVIEW
                              ? { backgroundColor: '#FEF3C7', color: '#92400E' }
                              : task.status === TASK_STATUS.IN_PROGRESS
                                ? { backgroundColor: '#DBEAFE', color: '#1D4ED8' }
                                : { backgroundColor: '#E2E8F0', color: '#334155' }
                        }
                      >
                        {taskStatusLabels[task.status]}
                      </Badge>
                      <Badge className="border-0" style={taskPriorityBadgeStyles[task.priority]}>
                        Priorite {taskPriorityLabels[task.priority]}
                      </Badge>
                      {typeof task.taskScore === 'number' ? (
                        <Badge className="border-0" style={{ backgroundColor: '#F5F3FF', color: '#6D28D9' }}>
                          Note {task.taskScore}/10
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {task.status === TASK_STATUS.DONE && (task.deliverableLink || task.deliverableNote) ? (
                    <div className="mt-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                      <p className="font-medium" style={{ color: '#1D4ED8' }}>Livrable soumis</p>
                      {task.deliverableLink ? (
                        <a
                          href={task.deliverableLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block break-all text-sm text-blue-700 underline"
                        >
                          {task.deliverableLink}
                        </a>
                      ) : null}
                      {task.deliverableNote ? (
                        <p className="mt-1 whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>
                          {task.deliverableNote}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {canShowTaskCompletionDetails(task) && task.reviewComment ? (
                    <div
                      className="mt-4 rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: task.status === TASK_STATUS.DONE ? '#DDD6FE' : '#FECACA',
                        backgroundColor: task.status === TASK_STATUS.DONE ? '#F5F3FF' : '#FEF2F2',
                        color: task.status === TASK_STATUS.DONE ? '#5B21B6' : '#B91C1C',
                      }}
                    >
                      <strong>Commentaire du chef :</strong> {task.reviewComment}
                    </div>
                  ) : null}

                  <div
                    className="mt-4 flex flex-col gap-2 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    <span>{`Echeance : ${formatTaskDueDate(task.dueDate)}`}</span>
                    <span>{`Mise a jour : ${new Date(task.updatedAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}`}</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckCheck}
              message="Aucune tache pour le moment"
              description="Ajustez le filtre de projet ou attendez de nouvelles taches assignees."
            />
          )}
        </div>
      )}

      {(user.role === ROLE.MANAGER || user.role === ROLE.HR) && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                Taches
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {user.role === ROLE.MANAGER
                  ? 'Suivez les taches actives de votre equipe.'
                  : 'Surveillez les taches actives de tous les collaborateurs ou filtrez par equipe.'}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              {user.role === ROLE.MANAGER && (
                <Select value={selectedProjectFilter} onValueChange={setSelectedProjectFilter}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Filtrer par projet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les projets</SelectItem>
                    {projectFilterOptions.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {user.role === ROLE.HR && (
                <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Filtrer par equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les equipes</SelectItem>
                    {teamFilterOptions.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        Equipe de {team.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={selectedTaskStatusFilter} onValueChange={(value: 'finished' | 'unfinished') => setSelectedTaskStatusFilter(value)}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finished">Terminees</SelectItem>
                  <SelectItem value="unfinished">Non terminees</SelectItem>
                </SelectContent>
              </Select>

              {user.role === ROLE.MANAGER && (
                <Link href="/dashboard/projects">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    Voir tout
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <BrandedLoading />
            </div>
          ) : visibleTeamTasks.length > 0 ? (
            <div className="grid gap-4">
              {visibleTeamTasks.map((task) => (
                <Card
                  key={task.id}
                  className="border border-border bg-card p-4 shadow-sm transition-colors hover:border-[color:var(--color-brand-blue)]/30"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{ backgroundColor: 'rgba(37, 99, 176, 0.1)', color: 'var(--color-brand-blue)' }}
                        >
                          <BriefcaseBusiness className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                            {task.title}
                          </h3>
                          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {user.role === ROLE.MANAGER
                              ? task.project?.name || 'Projet non renseigne'
                              : task.assignee?.name || 'Collaborateur non renseigne'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <Badge
                        className="border-0"
                        style={
                          task.status === TASK_STATUS.IN_REVIEW
                            ? { backgroundColor: '#FEF3C7', color: '#92400E' }
                            : task.status === TASK_STATUS.IN_PROGRESS
                              ? { backgroundColor: '#DBEAFE', color: '#1D4ED8' }
                              : { backgroundColor: '#E2E8F0', color: '#334155' }
                        }
                      >
                        {taskStatusLabels[task.status]}
                      </Badge>
                      <Badge className="border-0" style={taskPriorityBadgeStyles[task.priority]}>
                        Priorite {taskPriorityLabels[task.priority]}
                      </Badge>
                      {typeof task.taskScore === 'number' ? (
                        <Badge className="border-0" style={{ backgroundColor: '#F5F3FF', color: '#6D28D9' }}>
                          Note {task.taskScore}/10
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {task.status === TASK_STATUS.DONE && (task.deliverableLink || task.deliverableNote) ? (
                    <div className="mt-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                      <p className="font-medium" style={{ color: '#1D4ED8' }}>Livrable soumis</p>
                      {task.deliverableLink ? (
                        <a
                          href={task.deliverableLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block break-all text-sm text-blue-700 underline"
                        >
                          {task.deliverableLink}
                        </a>
                      ) : null}
                      {task.deliverableNote ? (
                        <p className="mt-1 whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>
                          {task.deliverableNote}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {canShowTaskCompletionDetails(task) && task.reviewComment ? (
                    <div
                      className="mt-4 rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: task.status === TASK_STATUS.DONE ? '#DDD6FE' : '#FECACA',
                        backgroundColor: task.status === TASK_STATUS.DONE ? '#F5F3FF' : '#FEF2F2',
                        color: task.status === TASK_STATUS.DONE ? '#5B21B6' : '#B91C1C',
                      }}
                    >
                      <strong>{task.status === TASK_STATUS.DONE ? 'Commentaire du chef :' : 'Commentaire du chef :'}</strong>{' '}
                      {task.reviewComment}
                    </div>
                  ) : null}

                  <div
                    className="mt-4 flex flex-col gap-2 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    <span>{`Echeance : ${formatTaskDueDate(task.dueDate)}`}</span>
                    <span>{`Mise a jour : ${new Date(task.updatedAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}`}</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div
              className="rounded-xl border border-dashed p-10 text-center"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <BriefcaseBusiness className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                Aucune tache active a afficher
              </p>
              <p className="mt-1 text-sm">
                {user.role === ROLE.HR
                  ? 'Ajustez le filtre d’equipe ou attendez de nouvelles taches en cours.'
                  : 'Ajustez le filtre de projet ou attendez de nouvelles taches de votre equipe.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent / Pending Requests */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            {user.role === ROLE.HR
              ? 'Demandes recentes'
              : user.role === ROLE.MANAGER
                ? 'Approbations en attente'
                : 'Mes demandes recentes'}
          </h2>
          <Link href={
            user.role === ROLE.HR
              ? '/dashboard/requests'
              : user.role === ROLE.MANAGER
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
                onExamine={user.role === ROLE.MANAGER || user.role === ROLE.HR ? handleExamine : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
            {user.role === ROLE.MANAGER
              ? <p>Aucune approbation en attente</p>
              : <p>Aucune demande pour le moment</p>
            }
          </div>
        )}
      </div>
    </div>
  )
}



