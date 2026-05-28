'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BrandedLoading } from '@/components/ui/spinner'
import { useToast } from '@/hooks/use-toast'
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
}

function formatAmount(amount: number | null | undefined) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return '0.00 TND'
  }

  return `${amount.toFixed(2)} TND`
}

function getRoleLabel(role: string) {
  if (role === 'COLLABORATEUR') return 'Collaborateur'
  if (role === 'CHEF') return 'Chef'
  if (role === 'RH') return 'RH'
  return role
}

function getRoleBadgeClass(role: string) {
  if (role === 'COLLABORATEUR') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (role === 'CHEF') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (role === 'RH') return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export default function MonEquipePage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [team, setTeam] = useState<Employee[]>([])
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

  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false)
  const [bonusAmount, setBonusAmount] = useState('')
  const [bonusReason, setBonusReason] = useState('')
  const [bonusPeriod, setBonusPeriod] = useState('')
  const [bonusSubmitting, setBonusSubmitting] = useState(false)
  const [bonusError, setBonusError] = useState('')

  useEffect(() => {
    if (!authLoading && user && user.role !== 'CHEF') {
      router.push('/dashboard')
    }
  }, [authLoading, router, user])

  useEffect(() => {
    if (user?.role === 'CHEF') {
      void fetchTeam()
    }
  }, [user])

  useEffect(() => {
    if (user?.role !== 'CHEF') {
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
      const res = await fetch('/api/employees')
      if (res.ok) {
        const members: any[] = await res.json()
        const tasksRes = await fetch('/api/tasks?excludeStatus=DONE')
        const allTasks = tasksRes.ok ? await tasksRes.json() : []

        const enhancedTeam = members.map((member: any) => {
          const pendingReviewCount = allTasks.filter(
            (task: any) => task.assigneeId === member.id && task.status === 'IN_REVIEW',
          ).length
          return { ...member, pendingReviewCount }
        })

        setTeam(enhancedTeam)
      } else {
        setTeam([])
      }
    } catch (error) {
      console.error('Error fetching team:', error)
      setTeam([])
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
      const responses = await Promise.all([
        fetch(`/api/employees/${employee.id}`),
        fetch(`/api/employees/${employee.id}/salary`),
        fetch(`/api/employees/${employee.id}/bonuses`),
        fetch(`/api/tasks?assigneeId=${employee.id}&excludeStatus=DONE`),
        fetch(`/api/evaluations?employeeId=${employee.id}`),
        fetch(`/api/employees/${employee.id}/skills`),
      ])

      const [detailRes, salaryRes, bonusesRes, tasksRes, evalsRes, skillsRes] = responses

      const [detail, salary, bonusList, taskList, evalList, skillList] = await Promise.all([
        detailRes.ok ? detailRes.json() : null,
        salaryRes.ok ? salaryRes.json() : null,
        bonusesRes.ok ? bonusesRes.json() : [],
        tasksRes.ok ? tasksRes.json() : [],
        evalsRes.ok ? evalsRes.json() : [],
        skillsRes.ok ? skillsRes.json() : { skills: [] },
      ])

      setEmployeeDetail(detail)
      setSalaryData(salary)
      setBonuses(bonusList || [])
      setTasks(taskList || [])
      setEvaluations(evalList || [])
      setSkills((skillList as any)?.skills || [])
    } catch (error) {
      console.error('Error loading employee details:', error)
      setModalError('Impossible de charger les details du collaborateur')
    } finally {
      setModalLoading(false)
    }
  }

  const openBonusModal = () => {
    setBonusAmount('')
    setBonusReason('')
    setBonusPeriod('')
    setBonusError('')
    setIsBonusModalOpen(true)
  }

  const submitExceptionalBonus = async () => {
    if (!selectedEmployee) return

    setBonusError('')
    const parsedAmount = Number(bonusAmount)

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0 || !bonusReason.trim()) {
      setBonusError('Le montant doit etre valide et la raison est obligatoire')
      return
    }

    setBonusSubmitting(true)

    try {
      const res = await fetch('/api/bonuses/exceptional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          amount: parsedAmount,
          reason: bonusReason.trim(),
          period: bonusPeriod.trim() || undefined,
        }),
      })

      if (res.ok) {
        const bonusesRes = await fetch(`/api/employees/${selectedEmployee.id}/bonuses`)
        const updatedBonuses = bonusesRes.ok ? await bonusesRes.json() : []
        setBonuses(updatedBonuses || [])
        setIsBonusModalOpen(false)

        toast({
          description: 'Bonus exceptionnel ajoute avec succes',
          className: 'bg-[#10B981] text-white border-none',
          duration: 3000,
        })
      } else {
        const data = await res.json().catch(() => null)
        setBonusError(data?.error || "Erreur lors de l'ajout du bonus")
      }
    } catch {
      setBonusError('Erreur de connexion')
    } finally {
      setBonusSubmitting(false)
    }
  }

  const activeCount = useMemo(
    () => team.filter((member) => !member.onLeave).length,
    [team],
  )
  const onLeaveCount = useMemo(
    () => team.filter((member) => member.onLeave).length,
    [team],
  )

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center">
        <BrandedLoading />
      </div>
    )
  }

  if (!user || user.role !== 'CHEF') {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            Mon Equipe
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Suivez votre equipe, consultez les profils et accordez des bonus exceptionnels.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="min-w-[11rem] border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Membres</p>
                <p className="text-xl font-semibold text-slate-900">{team.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-[11rem] border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Actifs</p>
                <p className="text-xl font-semibold text-slate-900">{activeCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-[11rem] border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-xl bg-amber-50 p-2 text-amber-700">
                <CircleAlert className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">En conge</p>
                <p className="text-xl font-semibold text-slate-900">{onLeaveCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {team.length === 0 ? (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex min-h-[16rem] flex-col items-center justify-center gap-3 p-8 text-center">
              <Users className="h-10 w-10 text-slate-300" />
              <div>
                <p className="font-medium text-slate-900">Aucun membre dans votre equipe</p>
                <p className="text-sm text-slate-500">
                  Les collaborateurs affectes a votre equipe apparaitront ici.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          team.map((member) => (
            <Card
              key={member.id}
              className="group cursor-pointer overflow-hidden border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1B3A6B]/30 hover:shadow-lg"
              onClick={() => openEmployeeModal(member)}
            >
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 border border-slate-200">
                      <AvatarImage src={member.avatar || undefined} />
                      <AvatarFallback className="bg-slate-100 text-slate-700">
                        {member.name
                          .split(' ')
                          .map((segment) => segment[0])
                          .join('')
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">{member.name}</h3>
                      <p className="truncate text-sm text-slate-500">{member.position || 'Poste non renseigne'}</p>
                    </div>
                  </div>

                  <Badge className={getRoleBadgeClass(member.role)} variant="outline">
                    {getRoleLabel(member.role)}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{member.department || 'Departement non renseigne'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Suivi collaborateur
                  </span>
                  {member.pendingReviewCount ? (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                      {member.pendingReviewCount} a valider
                    </Badge>
                  ) : (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
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
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)]">
                    <Card className="border-slate-200 shadow-sm">
                      <CardContent className="space-y-5 p-5">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-16 w-16 border border-slate-200">
                            <AvatarImage src={selectedEmployee.avatar || undefined} />
                            <AvatarFallback className="bg-slate-100 text-slate-700">
                              {selectedEmployee.name
                                .split(' ')
                                .map((segment) => segment[0])
                                .join('')
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-900">{selectedEmployee.name}</h3>
                              <Badge className={getRoleBadgeClass(selectedEmployee.role)} variant="outline">
                                {getRoleLabel(selectedEmployee.role)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                              {selectedEmployee.position || 'Poste non renseigne'}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Email</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">{selectedEmployee.email}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Telephone</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {employeeDetail?.phone || 'Non renseigne'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Departement</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {selectedEmployee.department || 'Non renseigne'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Date d'embauche</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {employeeDetail?.hireDate || 'Non renseignee'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-sm">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-[#1B3A6B]" />
                          <h4 className="font-semibold text-slate-900">Remuneration</h4>
                        </div>

                        {salaryData ? (
                          <div className="space-y-3 text-sm">
                            <div className="rounded-xl bg-slate-50 p-4">
                              <p className="text-xs uppercase tracking-wide text-slate-400">Grade</p>
                              <p className="mt-1 font-medium text-slate-900">
                                {salaryData.grade?.role || '-'} - Niveau {salaryData.grade?.level || '-'}
                              </p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-4">
                              <p className="text-xs uppercase tracking-wide text-slate-400">Salaire de base</p>
                              <p className="mt-1 font-medium text-slate-900">{formatAmount(salaryData.baseSalary)}</p>
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
                          <p className="text-sm text-slate-500">Aucune information salariale disponible.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="border-slate-200 shadow-sm">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-[#1B3A6B]" />
                          <h4 className="font-semibold text-slate-900">Historique des bonus</h4>
                        </div>

                        {bonuses.length > 0 ? (
                          <div className="space-y-3">
                            {bonuses.slice(0, 6).map((bonus: any) => (
                              <div
                                key={bonus.id}
                                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                              >
                                <div className="min-w-0">
                                  <Badge variant="outline" className="mb-2">{bonus.type}</Badge>
                                  <p className="text-sm font-medium text-slate-900">
                                    {bonus.reason || 'Bonus exceptionnel'}
                                  </p>
                                  {bonus.period && (
                                    <p className="text-xs text-slate-500">Periode: {bonus.period}</p>
                                  )}
                                </div>
                                <div className="text-right text-sm font-semibold text-slate-900">
                                  {formatAmount(bonus.amount)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">Aucun bonus enregistre.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-sm">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-center gap-2">
                          <CircleAlert className="h-4 w-4 text-[#1B3A6B]" />
                          <h4 className="font-semibold text-slate-900">Suivi d'activite</h4>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Derniere evaluation</p>
                            {evaluations.length > 0 ? (
                              <div className="mt-2 space-y-1 text-sm">
                                <p className="font-medium text-slate-900">{evaluations[0].period}</p>
                                <p className="text-slate-500">Statut: {evaluations[0].status}</p>
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-slate-500">Aucune evaluation</p>
                            )}
                          </div>

                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Taches actives</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">{tasks.length}</p>
                            <p className="text-xs text-slate-500">
                              {tasks.filter((task) => task.status === 'IN_REVIEW').length} en revue
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Liste des taches</p>
                          {tasks.length > 0 ? (
                            <div className="space-y-2">
                              {tasks.slice(0, 4).map((task: any) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                >
                                  <span className="truncate text-slate-700">{task.title}</span>
                                  <Badge
                                    variant="outline"
                                    className={
                                      task.status === 'IN_REVIEW'
                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                        : 'border-slate-200 bg-slate-50 text-slate-700'
                                    }
                                  >
                                    {task.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">Aucune tache active.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#1B3A6B]" />
                        <h4 className="font-semibold text-slate-900">Competences</h4>
                      </div>

                      {skills.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {skills.map((skill: any, index: number) => (
                            <Badge key={index} variant="secondary" className="bg-slate-100 text-slate-700">
                              {skill.skill?.name} ({skill.level})
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Aucune competence disponible.</p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button className="bg-[#1B3A6B] hover:bg-[#15305a]" onClick={openBonusModal}>
                      Donner un bonus exceptionnel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isBonusModalOpen} onOpenChange={setIsBonusModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Donner un bonus exceptionnel</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-400">Collaborateur</p>
              <p className="mt-1 font-medium text-slate-900">{selectedEmployee?.name}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Montant (TND) *</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                  placeholder="1500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Periode</label>
                <Input
                  value={bonusPeriod}
                  onChange={(e) => setBonusPeriod(e.target.value)}
                  placeholder="2026-Q2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Raison *</label>
              <Textarea
                rows={4}
                value={bonusReason}
                onChange={(e) => setBonusReason(e.target.value)}
                placeholder="Excellente contribution sur le projet..."
              />
            </div>

            {bonusError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {bonusError}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsBonusModalOpen(false)} disabled={bonusSubmitting}>
              Annuler
            </Button>
            <Button onClick={submitExceptionalBonus} disabled={bonusSubmitting} className="bg-[#1B3A6B] hover:bg-[#15305a]">
              {bonusSubmitting ? 'Envoi...' : 'Valider le bonus'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
