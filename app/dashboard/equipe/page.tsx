'use client'

import { useEffect, useMemo, useState } from 'react'
import { ROLE, TASK_STATUS } from '@/lib/constants'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { getBonusReasonLabel } from '@/lib/payslip'
import { formatSalaryGradeLabel } from '@/lib/utils/salary-grade'
import { useRouter } from 'next/navigation'
import {
  fetchEmployeeBonuses,
  fetchEmployeeDetails,
  fetchEmployeeEvaluations,
  fetchEmployeeSalary,
  fetchEmployeesList,
  fetchTeamTasks,
} from '@/lib/services/client/employees.service'
import { fetchEmployeeSkills } from '@/lib/services/client/skills.service'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BrandedLoading } from '@/components/ui/spinner'
import {
  Briefcase,
  Coins,
  CircleAlert,
  Gift,
  Mail,
  Phone,
  Sparkles,
  Users,
} from 'lucide-react'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  position: string | null
  avatar: string | null
  onLeave?: boolean
  pendingReviewCount?: number
  managerId?: string | null
}

function formatAmount(amount: number | null | undefined) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return '0.00 TND'
  }

  return `${amount.toFixed(2)} TND`
}

function getRoleLabel(role: string) {
  if (role === ROLE.EMPLOYEE) return 'Collaborateur'
  if (role === ROLE.MANAGER) return 'Chef'
  if (role === ROLE.HR) return 'Ressources humaines'
  return role
}

function getRoleBadgeClass(role: string) {
  if (role === ROLE.EMPLOYEE) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
  if (role === ROLE.MANAGER) return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
  if (role === ROLE.HR) return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
}

function getMemberCardClass(onLeave?: boolean) {
  if (onLeave) {
    return 'border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-amber-100/70 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-100/80 dark:border-amber-900/70 dark:from-amber-950/50 dark:via-slate-900 dark:to-orange-950/40 dark:shadow-none'
  }

  return 'border-slate-200 bg-white hover:border-[#1B3A6B]/30 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-[#4C8FE0]/60'
}

export default function MonEquipePage() {
  const { user, isLoading: authLoading } = useCurrentUser()
  const router = useRouter()
  const [team, setTeam] = useState<Employee[]>([])
  const [teamManagers, setTeamManagers] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [employeeDetail, setEmployeeDetail] = useState<any>(null)
  const [salaryData, setSalaryData] = useState<any>(null)
  const [bonuses, setBonuses] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all')

  const isRhView = user?.role === ROLE.HR

  useEffect(() => {
    if (!authLoading && user && user.role !== ROLE.MANAGER && user.role !== ROLE.HR) {
      router.push('/dashboard')
    }
  }, [authLoading, router, user])

  useEffect(() => {
    if (user?.role === ROLE.MANAGER || user?.role === ROLE.HR) {
      void fetchTeam()
    }
  }, [user])

  useEffect(() => {
    if (user?.role !== ROLE.MANAGER && user?.role !== ROLE.HR) {
      return
    }

    const handleVisibilityOrFocus = () => {
      void fetchTeam()
    }

    const intervalId = window.setInterval(() => {
      void fetchTeam()
    }, 30000)

    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
    }
  }, [user])

  const fetchTeam = async () => {
    try {
      setLoading(true)
      const { data: members = [] } = await fetchEmployeesList()
      const { data: allTasks = [] } = await fetchTeamTasks(`?excludeStatus=${TASK_STATUS.DONE}`)
        const managerOptions = members
          .filter((member: any) => member.role === ROLE.MANAGER)
          .map((member: any) => ({ id: member.id, name: member.name }))

        const visibleMembers = user?.role === ROLE.HR
          ? members.filter((member: any) => member.role === ROLE.EMPLOYEE)
          : members

        const enhancedTeam = visibleMembers.map((member: any) => {
          const pendingReviewCount = allTasks.filter(
            (task: any) => task.assigneeId === member.id && task.status === 'IN_REVIEW',
          ).length
          return { ...member, pendingReviewCount }
        })

        setTeam(enhancedTeam)
        setTeamManagers(managerOptions)
    } catch {
      setTeam([])
      setTeamManagers([])
    } finally {
      setLoading(false)
    }
  }

  const openEmployeeModal = async (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsModalOpen(true)
    setModalLoading(true)
    setModalError('')
    setEmployeeDetail(null)
    setSalaryData(null)
    setBonuses([])
    setTasks([])
    setEvaluations([])
    setSkills([])

    try {
      const requests: Promise<unknown>[] = [
        fetchEmployeeDetails(employee.id),
        fetchTeamTasks(`?assigneeId=${employee.id}`),
        fetchEmployeeEvaluations(employee.id),
        fetchEmployeeSkills(employee.id),
      ]

      if (isRhView) {
        requests.splice(1, 0, fetchEmployeeSalary(employee.id), fetchEmployeeBonuses(employee.id))
      }

      const responses = await Promise.all(requests)
      const [detail, salary, bonusList, taskList, evalList, skillList] = isRhView
        ? responses
        : [responses[0], null, [], responses[1], responses[2], responses[3]]
      const { data: employeeTasks = [] } = (taskList as { data?: any[] }) ?? {}

      setEmployeeDetail(detail)
      setSalaryData(salary)
      setBonuses(Array.isArray(bonusList) ? bonusList : [])
      setTasks(Array.isArray(employeeTasks) ? employeeTasks : [])
      setEvaluations(Array.isArray(evalList) ? evalList : [])
      setSkills((skillList as any)?.skills || [])
    } catch {
      setModalError('Impossible de charger les details du collaborateur')
    } finally {
      setModalLoading(false)
    }
  }

  const teamFilterOptions = useMemo(() => {
    if (!isRhView) return []
    return teamManagers.map((manager) => ({ id: manager.id, label: manager.name }))
  }, [isRhView, teamManagers])

  const displayedTeam = useMemo(() => {
    if (!isRhView || selectedTeamFilter === 'all') {
      return team
    }

    return team.filter((member) => member.managerId === selectedTeamFilter)
  }, [isRhView, selectedTeamFilter, team])

  const displayedActiveCount = useMemo(
    () => displayedTeam.filter((member) => !member.onLeave).length,
    [displayedTeam],
  )
  const displayedOnLeaveCount = useMemo(
    () => displayedTeam.filter((member) => member.onLeave).length,
    [displayedTeam],
  )

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center">
        <BrandedLoading />
      </div>
    )
  }

  if (!user || (user.role !== ROLE.MANAGER && user.role !== ROLE.HR)) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            {isRhView ? 'Equipes collaborateurs' : 'Mon Equipe'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {isRhView
              ? 'Consultez les equipes, filtrez par chef et accedez aux details RH des collaborateurs.'
              : 'Suivez votre equipe et consultez les profils de vos collaborateurs.'}
          </p>

          {isRhView ? (
            <div className="w-full lg:max-w-sm">
              <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                Filtrer par equipe
              </p>
              <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les equipes</SelectItem>
                  {teamFilterOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      Equipe de {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="min-w-[11rem] border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Membres</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{displayedTeam.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-[11rem] border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Actifs</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{displayedActiveCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-[11rem] border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-xl bg-amber-50 p-2 text-amber-700">
                <CircleAlert className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">En conge</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{displayedOnLeaveCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {displayedTeam.length === 0 ? (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex min-h-[16rem] flex-col items-center justify-center gap-3 p-8 text-center">
              <Users className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {isRhView ? 'Aucun collaborateur pour ce filtre' : 'Aucun membre dans votre equipe'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isRhView
                    ? 'Selectionnez une autre equipe ou attendez de nouvelles affectations.'
                    : 'Les collaborateurs affectes a votre equipe apparaitront ici.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          displayedTeam.map((member) => (
            <Card
              key={member.id}
              className={cn(
                'group cursor-pointer overflow-hidden shadow-sm transition-all hover:-translate-y-0.5',
                getMemberCardClass(member.onLeave),
              )}
              onClick={() => openEmployeeModal(member)}
            >
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 border border-slate-200 dark:border-slate-700">
                      <AvatarImage src={member.avatar || undefined} />
                      <AvatarFallback className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {member.name
                          .split(' ')
                          .map((segment) => segment[0])
                          .join('')
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{member.name}</h3>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">{member.position || 'Poste non renseigne'}</p>
                    </div>
                  </div>

                  <Badge className={getRoleBadgeClass(member.role)} variant="outline">
                    {getRoleLabel(member.role)}
                  </Badge>
                </div>

                {member.onLeave ? (
                  <div className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-amber-100/70 px-3 py-2 text-sm text-amber-900">
                    <span className="font-medium">Actuellement en conge</span>
                    <CircleAlert className="h-4 w-4 text-amber-700" />
                  </div>
                ) : null}

                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="truncate">{member.department || 'Departement non renseigne'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Suivi collaborateur
                  </span>
                  {member.pendingReviewCount ? (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" variant="outline">
                      {member.pendingReviewCount} a valider
                    </Badge>
                  ) : (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" variant="outline">
                      Rien a valider
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-xl">Profil de {selectedEmployee?.name}</DialogTitle>
          </DialogHeader>

          {selectedEmployee && (
            <div className="max-h-[calc(92vh-5rem)] overflow-y-auto px-6 py-5">
              {modalLoading ? (
                <div className="flex min-h-[20rem] items-center justify-center">
                  <BrandedLoading />
                </div>
              ) : modalError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {modalError}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className={cn('grid gap-4', isRhView ? 'lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)]' : 'grid-cols-1')}>
                    <Card className="border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <CardContent className="space-y-5 p-5">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-16 w-16 border border-slate-200 dark:border-slate-700">
                            <AvatarImage src={selectedEmployee.avatar || undefined} />
                            <AvatarFallback className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {selectedEmployee.name
                                .split(' ')
                                .map((segment) => segment[0])
                                .join('')
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedEmployee.name}</h3>
                              <Badge className={getRoleBadgeClass(selectedEmployee.role)} variant="outline">
                                {getRoleLabel(selectedEmployee.role)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {selectedEmployee.position || 'Poste non renseigne'}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Email</p>
                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{selectedEmployee.email}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Telephone</p>
                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                              {employeeDetail?.phone || 'Non renseigne'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Departement</p>
                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                              {selectedEmployee.department || 'Non renseigne'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Date d'embauche</p>
                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                              {employeeDetail?.hireDate || 'Non renseignee'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {isRhView ? (
                      <Card className="border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <CardContent className="space-y-4 p-5">
                          <div className="flex items-center gap-2">
                            <Coins className="h-4 w-4 text-[#1B3A6B]" />
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Remuneration</h4>
                          </div>

                          {salaryData ? (
                            <div className="space-y-3 text-sm">
                              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                                <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Grade</p>
                                <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                                  {salaryData.grade ? formatSalaryGradeLabel(salaryData.grade) : '-'}
                                </p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                                <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Salaire de base</p>
                                <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{formatAmount(salaryData.baseSalary)}</p>
                              </div>
                              {salaryData.salaryOverride ? (
                                <div className="rounded-xl bg-amber-50 p-4">
                                  <p className="text-xs uppercase tracking-wide text-amber-700/70">Salaire individuel</p>
                                  <p className="mt-1 font-medium text-amber-900">
                                    {formatAmount(salaryData.salaryOverride)}
                                  </p>
                                </div>
                              ) : null}
                              <div className="rounded-xl bg-[#1B3A6B] p-4 text-white">
                                <p className="text-xs uppercase tracking-wide text-white/70">Salaire effectif</p>
                                <p className="mt-1 text-lg font-semibold">
                                  {formatAmount(salaryData.resolvedSalary)}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">Aucune information salariale disponible.</p>
                          )}
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>

                  <div className={cn('grid gap-4', isRhView ? 'lg:grid-cols-2' : 'lg:grid-cols-1')}>
                    {isRhView ? (
                      <Card className="border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <CardContent className="space-y-4 p-5">
                          <div className="flex items-center gap-2">
                            <Gift className="h-4 w-4 text-[#1B3A6B]" />
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Historique des bonus</h4>
                          </div>

                          {bonuses.length > 0 ? (
                            <div className="space-y-3">
                              {bonuses.slice(0, 6).map((bonus: any) => (
                                <div
                                  key={bonus.id}
                                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                                >
                                  <div className="min-w-0">
                                    <Badge variant="outline" className="mb-2">{bonus.type}</Badge>
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                      {getBonusReasonLabel(bonus.reason, bonus.type)}
                                    </p>
                                    {bonus.period && (
                                      <p className="text-xs text-slate-500 dark:text-slate-400">Periode: {bonus.period}</p>
                                    )}
                                  </div>
                                  <div className="text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {formatAmount(bonus.amount)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">Aucun bonus enregistre.</p>
                          )}
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card className="border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-center gap-2">
                          <CircleAlert className="h-4 w-4 text-[#1B3A6B]" />
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100">Suivi d'activite</h4>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Derniere evaluation</p>
                            {evaluations.length > 0 ? (
                              <div className="mt-2 space-y-1 text-sm">
                                <p className="font-medium text-slate-900 dark:text-slate-100">{evaluations[0].period}</p>
                                <p className="text-slate-500 dark:text-slate-400">Statut: {evaluations[0].status}</p>
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Aucune evaluation</p>
                            )}
                          </div>

                          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Taches actives</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{tasks.length}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {tasks.filter((task) => task.status === TASK_STATUS.IN_REVIEW).length} en revue
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Liste des taches</p>
                          {tasks.length > 0 ? (
                            <div className="space-y-2">
                              {tasks.slice(0, 4).map((task: any) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/60"
                                >
                                  <div className="min-w-0">
                                    <span className="truncate text-slate-700 dark:text-slate-200">{task.title}</span>
                                    {typeof task.taskScore === 'number' ? (
                                      <p className="mt-1 text-xs text-violet-600 dark:text-violet-300">
                                        Note: {task.taskScore}/10
                                      </p>
                                    ) : null}
                                    {task.reviewComment ? (
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Commentaire: {task.reviewComment}
                                      </p>
                                    ) : null}
                                    {task.status === TASK_STATUS.DONE && task.deliverableNote ? (
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Note du livrable: {task.deliverableNote}
                                      </p>
                                    ) : null}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={
                                      task.status === 'IN_REVIEW'
                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                        : task.status === TASK_STATUS.DONE
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    }
                                  >
                                    {task.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">Aucune tache active.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#1B3A6B]" />
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">Competences</h4>
                      </div>

                      {skills.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {skills.map((skill: any, index: number) => (
                            <Badge key={index} variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {skill.skill?.name} ({skill.level})
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Aucune competence disponible.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
