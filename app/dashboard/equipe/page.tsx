'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  position: string | null
  avatar: string | null
  hasPendingReview?: boolean
}

interface EmployeeDetail extends Employee {
  phone: string | null
  hireDate: string
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
  const [modalError, setModalError] = useState<string>('')

  // Bonus modal state
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false)
  const [bonusAmount, setBonusAmount] = useState('')
  const [bonusReason, setBonusReason] = useState('')
  const [bonusPeriod, setBonusPeriod] = useState('')
  const [bonusSubmitting, setBonusSubmitting] = useState(false)
  const [bonusError, setBonusError] = useState('')

  // Protection
  useEffect(() => {
    if (!authLoading && user && user.role !== 'CHEF') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'CHEF') {
      fetchTeam()
    }
  }, [user])

  const fetchTeam = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/employees')
      if (res.ok) {
        const members: any[] = await res.json()

        // Fetch all active tasks for the team to detect pending reviews
        const tasksRes = await fetch('/api/tasks?excludeStatus=DONE')
        const allTasks = await tasksRes.json()

        const enhancedTeam = members.map((member: any) => {
          const hasPendingReview = allTasks.some(
            (t: any) => t.assigneeId === member.id && t.status === 'IN_REVIEW'
          )
          return { ...member, hasPendingReview }
        })

        setTeam(enhancedTeam)
      }
    } catch (error) {
      console.error('Error fetching team:', error)
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

      // Check if any request failed
      for (const res of responses) {
        if (!res.ok) {
          console.error("API error:", res.status, await res.text())
        }
      }

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
      setModalError('Impossible de charger les détails du collaborateur')
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
    if (!bonusAmount || !bonusReason) {
      setBonusError('Le montant et la raison sont obligatoires')
      return
    }

    setBonusSubmitting(true)

    try {
      const res = await fetch('/api/bonuses/exceptional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          amount: parseFloat(bonusAmount),
          reason: bonusReason,
          period: bonusPeriod || undefined,
        }),
      })

      if (res.ok) {
        // Refresh bonuses
        const bonusesRes = await fetch(`/api/employees/${selectedEmployee.id}/bonuses`)
        const updatedBonuses = await bonusesRes.json()
        setBonuses(updatedBonuses || [])

        setIsBonusModalOpen(false)

        toast({
          description: "Bonus exceptionnel ajouté avec succès",
          className: "bg-[#10B981] text-white border-none",
          duration: 3000,
        })
      } else {
        const data = await res.json()
        setBonusError(data.error || 'Erreur lors de l\'ajout du bonus')
      }
    } catch (err) {
      setBonusError('Erreur de connexion')
    } finally {
      setBonusSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return <div className="p-8">Chargement...</div>
  }

  if (!user || user.role !== 'CHEF') {
    return null
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mon Équipe</h1>
          <p className="text-muted-foreground">Gérez et suivez vos collaborateurs</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold">{team.length}</div>
          <div className="text-xs text-muted-foreground">membres</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {team.length === 0 ? (
          <p className="col-span-full text-muted-foreground">Aucun membre dans votre équipe.</p>
        ) : (
          team.map((member) => (
            <Card
              key={member.id}
              className="cursor-pointer hover:shadow-lg transition-all border hover:border-[#1B3A6B]/30"
              onClick={() => openEmployeeModal(member)}
            >
              <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={member.avatar || undefined} />
                  <AvatarFallback className="text-lg">
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <h3 className="font-semibold text-lg">{member.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {member.position || '—'} {member.department ? `• ${member.department}` : ''}
                  </p>
                </div>

                <Badge variant="outline">{member.role}</Badge>

                {member.hasPendingReview && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    En attente de révision
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Profile Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Profil de {selectedEmployee?.name}</DialogTitle>
          </DialogHeader>

          {selectedEmployee && (
            <div className="space-y-6 pt-4">
              {/* Basic Info */}
              <div>
                <h3 className="font-semibold mb-3">Informations générales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><strong>Email :</strong> {selectedEmployee.email}</div>
                  <div><strong>Rôle :</strong> {selectedEmployee.role}</div>
                  <div><strong>Département :</strong> {selectedEmployee.department || '—'}</div>
                  <div><strong>Poste :</strong> {selectedEmployee.position || '—'}</div>
                </div>
              </div>

              {modalLoading ? (
                <div>Chargement des détails...</div>
              ) : modalError ? (
                <div className="text-sm text-red-600">{modalError}</div>
              ) : (
                <>
                  {/* Salary */}
                  {salaryData && (
                    <div>
                      <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">Rémunération</h4>
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm space-y-1.5 border">
                        <div>Grade : <span className="font-medium">{salaryData.grade?.role} — Niv. {salaryData.grade?.level}</span></div>
                        <div>Salaire de base : <span className="font-medium">{salaryData.baseSalary} €</span></div>
                        {salaryData.salaryOverride && (
                          <div className="text-amber-600">Salaire individuel : <span className="font-medium">{salaryData.salaryOverride} €</span></div>
                        )}
                        <div className="pt-1 border-t font-semibold text-base">
                          Salaire effectif : {salaryData.resolvedSalary} €
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bonus History */}
                  <div>
                    <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">Historique des bonus</h4>
                    {bonuses.length > 0 ? (
                      <div className="space-y-2">
                        {bonuses.slice(0, 5).map((b: any) => (
                          <div key={b.id} className="flex justify-between items-center text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                            <div>
                              <Badge variant="outline" className="mr-2">{b.type}</Badge>
                              {b.reason || 'Bonus'}
                            </div>
                            <div className="font-medium">{b.amount} € {b.period && <span className="text-xs text-muted-foreground">({b.period})</span>}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucun bonus enregistré</p>
                    )}
                  </div>

                  {/* Evaluations & Tasks side by side on larger screens */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Evaluations */}
                    <div>
                      <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">Dernière évaluation</h4>
                      {evaluations.length > 0 ? (
                        <div className="text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                          <div>Période : <span className="font-medium">{evaluations[0].period}</span></div>
                          <div>Statut : <Badge>{evaluations[0].status}</Badge></div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucune évaluation</p>
                      )}
                    </div>

                    {/* Active Tasks */}
                    <div>
                      <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">Tâches actives</h4>
                      {tasks.length > 0 ? (
                        <div className="space-y-1 text-sm">
                          {tasks.slice(0, 4).map((t: any) => (
                            <div key={t.id} className={t.status === 'IN_REVIEW' ? 'text-amber-600 font-medium' : ''}>
                              • {t.title} <span className="text-xs">({t.status})</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucune tâche active</p>
                      )}
                    </div>
                  </div>

                  {/* Skills */}
                  {skills.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">Compétences</h4>
                      <div className="flex flex-wrap gap-2">
                        {skills.slice(0, 8).map((s: any, idx: number) => (
                          <Badge key={idx} variant="secondary">{s.skill?.name} ({s.level})</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bonus Button */}
                  <div className="pt-4 border-t">
                    <Button 
                      className="w-full bg-[#1B3A6B] hover:bg-[#15305a]" 
                      onClick={openBonusModal}
                    >
                      Donner un bonus exceptionnel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bonus Creation Modal */}
      <Dialog open={isBonusModalOpen} onOpenChange={setIsBonusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Donner un bonus exceptionnel</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Employé</label>
              <div className="mt-1 p-2 bg-muted rounded text-sm">
                {selectedEmployee?.name}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Montant (€) *</label>
              <Input
                type="number"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="1500"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Raison *</label>
              <textarea
                className="w-full border rounded p-2 text-sm"
                rows={3}
                value={bonusReason}
                onChange={(e) => setBonusReason(e.target.value)}
                placeholder="Excellente contribution sur le projet..."
              />
            </div>

            <div>
              <label className="text-sm font-medium">Période (optionnel)</label>
              <Input
                value={bonusPeriod}
                onChange={(e) => setBonusPeriod(e.target.value)}
                placeholder="2026-Q2 ou 2026-ANNUAL"
              />
            </div>

            {bonusError && (
              <p className="text-sm text-red-600">{bonusError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsBonusModalOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={submitExceptionalBonus} 
              disabled={bonusSubmitting}
            >
              {bonusSubmitting ? 'Envoi...' : 'Valider le bonus'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
