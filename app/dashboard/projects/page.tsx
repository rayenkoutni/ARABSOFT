'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowRight, Calendar, FolderKanban, Plus, Sparkles, Trash2 } from 'lucide-react'
import { PROJECT_STATUS, ROLE, TASK_STATUS } from '@/lib/constants'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  calculateTechnicalSkillMatch,
  createEmptyTechnicalSkillRow,
  DEFAULT_TECHNICAL_SKILL_LEVEL,
  getSkillLevelLabel,
  hasDuplicateTechnicalSkills,
  mapEmployeeSkillsListItems,
  mapTechnicalSkillCatalogItems,
  skillLevelOptions,
  type EmployeeSkillsListItem,
  type TechnicalSkillCatalogItem,
  type TechnicalSkillFormRow,
} from '@/lib/skills/client'
import { addDaysToDateOnly, getTodayDateOnly } from '@/lib/leave-request'
import { isProjectSlaBreached, PROJECT_SLA_BREACHED_LABEL, PROJECT_SLA_BREACHED_STYLE } from '@/lib/project-sla'
import {
  createProject,
  fetchProjectTeam,
  fetchProjects as fetchProjectsList,
  generateProjectTasksFromDraft,
} from '@/lib/services/client/projects.service'
import { fetchSkillsEmployees } from '@/lib/services/client/skills.service'
import { useToast } from '@/hooks/use-toast'

interface Project {
  id: string
  name: string
  description: string | null
  progress: number
  status: string
  priority: string
  slaBreached: boolean
  managerId: string | null
  createdById: string | null
  createdByRole: string | null
  creator?: {
    id: string
    name: string
  } | null
  manager?: {
    id: string
    name: string
  } | null
  startDate: string | null
  endDate: string | null
  createdAt: string
  tasks: Task[]
  team: { id: string; name: string }[]
  changeHistory?: Array<{
    id: string
    action: string
    createdAt: string
  }>
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
}

interface Employee {
  id: string
  name: string
  managerId: string | null
}

interface ProjectTaskDraft {
  title: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  assigneeId: string
  dueDate: string
  requiredSkills: TechnicalSkillFormRow[]
}

interface GeneratedTaskDraft {
  title: string
  description: string
  assignedUserId: string
  dueDate: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
}

const STATUS_LABELS: Record<string, string> = {
  [PROJECT_STATUS.IN_PROGRESS]: 'En cours',
  TERMINE: 'Termine',
}

const STATUS_COLORS: Record<string, string> = {
  [PROJECT_STATUS.IN_PROGRESS]: 'bg-blue-500',
  [PROJECT_STATUS.COMPLETED]: 'bg-green-500',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-red-500',
}

function getEmptyTaskDraft(defaultAssigneeId: string, minDueDate: string): ProjectTaskDraft {
  return {
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigneeId: defaultAssigneeId,
    dueDate: minDueDate,
    requiredSkills: [createEmptyTechnicalSkillRow()],
  }
}

function toErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback
  }

  try {
    const parsed = JSON.parse(error.message) as { error?: string }
    return parsed.error || fallback
  } catch {
    return error.message || fallback
  }
}

export default function ProjectsPage() {
  const { user } = useCurrentUser()
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [technicalSkillsCatalog, setTechnicalSkillsCatalog] = useState<TechnicalSkillCatalogItem[]>([])
  const [teamEmployeeSkills, setTeamEmployeeSkills] = useState<EmployeeSkillsListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>(PROJECT_STATUS.IN_PROGRESS)
  const [formError, setFormError] = useState('')
  const [aiWarning, setAiWarning] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    priority: 'MEDIUM',
    teamMemberIds: [] as string[],
  })
  const [projectTasks, setProjectTasks] = useState<ProjectTaskDraft[]>([])

  const canCreateProject = user?.role === ROLE.MANAGER
  const todayDate = getTodayDateOnly()
  const projectEndMinDate = addDaysToDateOnly(formData.startDate || todayDate, 1)
  const taskDueDateMin = useMemo(() => {
    const tomorrowDate = addDaysToDateOnly(todayDate, 1)
    if (formData.startDate && formData.startDate > tomorrowDate) {
      return formData.startDate
    }
    return tomorrowDate
  }, [formData.startDate, todayDate])

  const availableEmployees = useMemo(
    () => (user?.role === ROLE.MANAGER ? employees.filter((employee) => employee.managerId === user.id) : employees),
    [employees, user?.id, user?.role]
  )

  const selectedTeamMembers = useMemo(
    () => availableEmployees.filter((employee) => formData.teamMemberIds.includes(employee.id)),
    [availableEmployees, formData.teamMemberIds]
  )

  useEffect(() => {
    void loadProjects()
    if (canCreateProject) {
      void Promise.all([loadEmployees(), loadTechnicalSkills(), loadTeamEmployeeSkills()])
    }
  }, [canCreateProject, user?.id])

  useEffect(() => {
    if (!isDialogOpen) {
      return
    }

    setProjectTasks((currentTasks) => {
      if (currentTasks.length === 0) {
        const defaultAssigneeId = selectedTeamMembers[0]?.id || ''
        return [getEmptyTaskDraft(defaultAssigneeId, taskDueDateMin)]
      }

      return currentTasks.map((task) => {
        const nextAssigneeId = formData.teamMemberIds.includes(task.assigneeId)
          ? task.assigneeId
          : selectedTeamMembers[0]?.id || ''
        const nextDueDate = task.dueDate && task.dueDate >= taskDueDateMin ? task.dueDate : taskDueDateMin

        return {
          ...task,
          assigneeId: nextAssigneeId,
          dueDate: nextDueDate,
        }
      })
    })
  }, [formData.teamMemberIds, isDialogOpen, selectedTeamMembers, taskDueDateMin])

  const employeeSkillsById = useMemo(
    () => new Map(teamEmployeeSkills.map((employee) => [employee.id, employee.skills])),
    [teamEmployeeSkills]
  )

  const skillNamesById = useMemo(
    () => new Map(technicalSkillsCatalog.map((skill) => [skill.id, skill.name])),
    [technicalSkillsCatalog]
  )

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'ALL') {
      return projects
    }

    return projects.filter((project) => project.status === statusFilter)
  }, [projects, statusFilter])

  const loadProjects = async () => {
    try {
      const { data: nextProjects = [] } = await fetchProjectsList()
      setProjects(Array.isArray(nextProjects) ? nextProjects : [])
    } catch {
      toast({
        title: 'Impossible de charger les projets',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async () => {
    try {
      const endpoint = user?.role === ROLE.MANAGER ? '/api/users/team' : '/api/employees'
      const data = await fetchProjectTeam(endpoint)
      setEmployees(Array.isArray(data) ? data : [])
    } catch {
      toast({
        title: "Impossible de charger l'equipe",
        variant: 'destructive',
      })
    }
  }

  const loadTechnicalSkills = async () => {
    try {
      const data = await fetchProjectTeam('/api/skills?type=TECHNICAL')
      setTechnicalSkillsCatalog(mapTechnicalSkillCatalogItems(data))
    } catch {
      toast({
        title: 'Impossible de charger les competences techniques',
        variant: 'destructive',
      })
    }
  }

  const loadTeamEmployeeSkills = async () => {
    try {
      const data = await fetchSkillsEmployees()
      setTeamEmployeeSkills(mapEmployeeSkillsListItems(data))
    } catch {
      toast({
        title: "Impossible de charger les competences de l'equipe",
        variant: 'destructive',
      })
    }
  }

  const resetProjectForm = () => {
    setFormData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      priority: 'MEDIUM',
      teamMemberIds: [],
    })
    setProjectTasks([getEmptyTaskDraft('', addDaysToDateOnly(todayDate, 1))])
    setFormError('')
    setAiWarning(null)
  }

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      resetProjectForm()
    }
  }

  const updateTask = (taskIndex: number, patch: Partial<ProjectTaskDraft>) => {
    setProjectTasks((currentTasks) =>
      currentTasks.map((task, index) => (index === taskIndex ? { ...task, ...patch } : task))
    )
  }

  const updateTaskSkill = (taskIndex: number, skillIndex: number, patch: Partial<TechnicalSkillFormRow>) => {
    setProjectTasks((currentTasks) =>
      currentTasks.map((task, index) => {
        if (index !== taskIndex) {
          return task
        }

        return {
          ...task,
          requiredSkills: task.requiredSkills.map((skill, currentSkillIndex) =>
            currentSkillIndex === skillIndex ? { ...skill, ...patch } : skill
          ),
        }
      })
    )
  }

  const addTaskSkillRow = (taskIndex: number) => {
    setProjectTasks((currentTasks) =>
      currentTasks.map((task, index) =>
        index === taskIndex
          ? { ...task, requiredSkills: [...task.requiredSkills, createEmptyTechnicalSkillRow()] }
          : task
      )
    )
  }

  const removeTaskSkillRow = (taskIndex: number, skillIndex: number) => {
    setProjectTasks((currentTasks) =>
      currentTasks.map((task, index) => {
        if (index !== taskIndex) {
          return task
        }

        const nextSkills = task.requiredSkills.filter((_, currentSkillIndex) => currentSkillIndex !== skillIndex)
        return {
          ...task,
          requiredSkills: nextSkills.length > 0 ? nextSkills : [createEmptyTechnicalSkillRow()],
        }
      })
    )
  }

  const addManualTask = () => {
    setProjectTasks((currentTasks) => [
      ...currentTasks,
      getEmptyTaskDraft(selectedTeamMembers[0]?.id || '', taskDueDateMin),
    ])
  }

  const removeTask = (taskIndex: number) => {
    if (projectTasks.length === 1) {
      setFormError('Le projet doit contenir au moins une tache.')
      return
    }

    setProjectTasks((currentTasks) => currentTasks.filter((_, index) => index !== taskIndex))
  }

  const handleGenerateTasks = async () => {
    setFormError('')
    setAiWarning(null)

    if (!formData.name.trim()) {
      setFormError('Le nom du projet est obligatoire avant la generation IA.')
      return
    }

    if (formData.teamMemberIds.length === 0) {
      setFormError("Selectionnez au moins un membre d'equipe avant la generation IA.")
      return
    }

    setIsGeneratingTasks(true)
    try {
      const response = await generateProjectTasksFromDraft({
        name: formData.name,
        description: formData.description,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        teamMemberIds: formData.teamMemberIds,
      })

      const generatedTasks = Array.isArray(response.tasks) ? response.tasks : []
      setProjectTasks(
        generatedTasks.map((task: GeneratedTaskDraft) => ({
          title: task.title,
          description: task.description,
          assigneeId: task.assignedUserId,
          dueDate: task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate,
          priority: task.priority,
          requiredSkills: [createEmptyTechnicalSkillRow()],
        }))
      )
      setAiWarning(response.warning || null)
    } catch (error) {
      setFormError(toErrorMessage(error, 'Erreur lors de la generation des taches'))
    } finally {
      setIsGeneratingTasks(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (projectTasks.length === 0) {
      setFormError('Ajoutez au moins une tache avant de creer le projet.')
      return
    }

    for (const task of projectTasks) {
      const selectedRequiredSkills = task.requiredSkills.filter((skill) => skill.skillId)
      if (hasDuplicateTechnicalSkills(selectedRequiredSkills)) {
        setFormError('Chaque competence technique requise doit etre unique dans une tache.')
        return
      }
    }

    setIsSubmitting(true)

    try {
      await createProject({
        ...formData,
        tasks: projectTasks.map((task) => ({
          title: task.title,
          description: task.description || null,
          priority: task.priority,
          assigneeId: task.assigneeId,
          dueDate: task.dueDate || null,
          requiredSkills: task.requiredSkills
            .filter((skill) => skill.skillId)
            .map((skill) => ({
              skillId: skill.skillId,
              minimumLevel: skill.level,
            })),
        })),
      })

      await loadProjects()
      setIsDialogOpen(false)
      resetProjectForm()
    } catch (error) {
      setFormError(toErrorMessage(error, 'Erreur lors de la creation du projet'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTaskCount = (project: Project) => project.tasks.length

  const getProgress = (project: Project) => {
    if (project.tasks.length === 0) return project.progress || 0
    const completed = project.tasks.filter((task) => task.status === TASK_STATUS.DONE).length
    return Math.round((completed / project.tasks.length) * 100)
  }

  const getProjectOwnershipLabel = (project: Project) => {
    if (project.changeHistory?.[0]?.action === 'TRANSFERRED' && project.manager?.name) {
      return `Transfere a: ${project.manager.name}`
    }

    if (project.createdByRole === ROLE.HR) {
      return null
    }

    if (project.creator?.name) {
      return `Cree par: ${project.creator.name}`
    }

    return null
  }

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter((part) => part.length > 0)
      .map((part) => part[0].toUpperCase())
      .join('')
      .substring(0, 2)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projets</h1>
          <p className="text-muted-foreground">Gestion des projets et des taches</p>
          {user?.role === ROLE.HR && (
            <Badge variant="outline" className="mt-2 text-blue-600 border-blue-300">
              Observateur
            </Badge>
          )}
        </div>
        {canCreateProject && (
          <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau projet
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl overflow-hidden p-0 sm:max-h-[92vh]">
              <DialogHeader className="border-b bg-slate-50/80 px-6 py-5 text-left backdrop-blur">
                <DialogTitle>Creer un nouveau projet</DialogTitle>
                <DialogDescription>
                  Definissez le projet, selectionnez l&apos;equipe, puis preparez les taches initiales avant creation.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex max-h-[calc(92vh-88px)] flex-col">
                <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="mb-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Equipe</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{selectedTeamMembers.length}</p>
                    <p className="text-xs text-slate-500">membre(s) selectionne(s)</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Taches</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{projectTasks.length}</p>
                    <p className="text-xs text-slate-500">initiales a creer</p>
                  </div>
                  <div className="rounded-xl border bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Validation</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Projet + taches</p>
                    <p className="text-xs text-slate-500">en une seule action</p>
                  </div>
                </div>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
                  <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom du projet *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData((current) => ({ ...current, description: e.target.value }))}
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Date de debut</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => {
                            const startDate = e.target.value
                            const endMinDate = addDaysToDateOnly(startDate || todayDate, 1)
                            setFormData((current) => ({
                              ...current,
                              startDate,
                              endDate: current.endDate && current.endDate < endMinDate ? '' : current.endDate,
                            }))
                          }}
                          min={todayDate}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate">Date de fin</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => setFormData((current) => ({ ...current, endDate: e.target.value }))}
                          min={projectEndMinDate}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priorite</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData((current) => ({ ...current, priority: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Basse</SelectItem>
                          <SelectItem value="MEDIUM">Moyenne</SelectItem>
                          <SelectItem value="HIGH">Haute</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm xl:sticky xl:top-0 xl:self-start">
                    <div>
                      <p className="text-sm font-medium">Equipe du projet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Seuls les membres choisis ici peuvent recevoir les taches initiales.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {availableEmployees.map((employee) => (
                        <Badge
                          key={employee.id}
                          variant={formData.teamMemberIds.includes(employee.id) ? 'default' : 'outline'}
                          className="cursor-pointer justify-between rounded-xl px-3 py-2 text-sm"
                          onClick={() =>
                            setFormData((current) => ({
                              ...current,
                              teamMemberIds: current.teamMemberIds.includes(employee.id)
                                ? current.teamMemberIds.filter((id) => id !== employee.id)
                                : [...current.teamMemberIds, employee.id],
                            }))
                          }
                        >
                          {employee.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      {selectedTeamMembers.length === 0
                        ? "Aucun membre selectionne pour l'instant."
                        : `${selectedTeamMembers.length} membre(s) selectionne(s) pour recevoir les taches.`}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGenerateTasks}
                      disabled={isGeneratingTasks || formData.teamMemberIds.length === 0 || !formData.name.trim()}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {isGeneratingTasks ? 'Generation en cours...' : 'Generer les taches avec IA'}
                    </Button>
                    {aiWarning && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {aiWarning}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">Taches initiales du projet</h3>
                      <p className="text-sm text-muted-foreground">
                        Au moins une tache est requise pour creer le projet.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={addManualTask}>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter une tache
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {projectTasks.map((task, taskIndex) => {
                      const selectedRequiredSkills = task.requiredSkills.filter((skill) => skill.skillId)
                      const selectedAssigneeSkills = employeeSkillsById.get(task.assigneeId) ?? []
                      const assigneeMatch = calculateTechnicalSkillMatch(selectedRequiredSkills, selectedAssigneeSkills)
                      const orderedSelectedTeamMembers = [...selectedTeamMembers].sort((left, right) => {
                        const leftMatch = calculateTechnicalSkillMatch(
                          selectedRequiredSkills,
                          employeeSkillsById.get(left.id) ?? []
                        )
                        const rightMatch = calculateTechnicalSkillMatch(
                          selectedRequiredSkills,
                          employeeSkillsById.get(right.id) ?? []
                        )

                        if (leftMatch !== rightMatch) {
                          return rightMatch - leftMatch
                        }

                        return left.name.localeCompare(right.name)
                      })

                      return (
                        <Card key={`task-${taskIndex}`} className="overflow-hidden rounded-xl border-slate-200 shadow-none">
                          <CardHeader className="bg-slate-50/70 pb-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <CardTitle className="text-base">Tache {taskIndex + 1}</CardTitle>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Assignee, echeance et competences requises.
                                </p>
                              </div>
                              <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removeTask(taskIndex)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Titre *</Label>
                                <Input
                                  value={task.title}
                                  onChange={(e) => updateTask(taskIndex, { title: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Priorite</Label>
                                <Select
                                  value={task.priority}
                                  onValueChange={(value: 'LOW' | 'MEDIUM' | 'HIGH') =>
                                    updateTask(taskIndex, { priority: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="LOW">Basse</SelectItem>
                                    <SelectItem value="MEDIUM">Moyenne</SelectItem>
                                    <SelectItem value="HIGH">Haute</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                value={task.description}
                                onChange={(e) => updateTask(taskIndex, { description: e.target.value })}
                                rows={3}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Assigne *</Label>
                                <Select
                                  value={task.assigneeId}
                                  onValueChange={(value) => updateTask(taskIndex, { assigneeId: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choisir un membre" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {orderedSelectedTeamMembers.map((employee) => {
                                      const employeeMatch = calculateTechnicalSkillMatch(
                                        selectedRequiredSkills,
                                        employeeSkillsById.get(employee.id) ?? []
                                      )

                                      return (
                                        <SelectItem key={employee.id} value={employee.id}>
                                          {employee.name}{selectedRequiredSkills.length > 0 ? ` (${employeeMatch}%)` : ''}
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                                {task.assigneeId && selectedRequiredSkills.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Match competences pour l'assigne choisi: {assigneeMatch}%
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Date limite *</Label>
                                <Input
                                  type="date"
                                  value={task.dueDate}
                                  onChange={(e) => updateTask(taskIndex, { dueDate: e.target.value })}
                                  min={taskDueDateMin}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-3 rounded-xl border bg-slate-50/60 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">Competences techniques requises</p>
                                  <p className="text-xs text-muted-foreground">
                                    Le matching est calcule a partir des competences de l'equipe deja chargees.
                                  </p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => addTaskSkillRow(taskIndex)}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Ajouter
                                </Button>
                              </div>

                              <div className="space-y-3">
                                {task.requiredSkills.map((requiredSkill, skillIndex) => (
                                  <div key={`task-${taskIndex}-skill-${skillIndex}`} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Competence</Label>
                                      <Select
                                        value={requiredSkill.skillId}
                                        onValueChange={(value) => updateTaskSkill(taskIndex, skillIndex, { skillId: value })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Choisir une competence" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {technicalSkillsCatalog.map((skill) => (
                                            <SelectItem key={skill.id} value={skill.id}>
                                              {skill.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Niveau minimal</Label>
                                      <Select
                                        value={String(requiredSkill.level)}
                                        onValueChange={(value) =>
                                          updateTaskSkill(taskIndex, skillIndex, { level: Number(value) })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {skillLevelOptions.map((option) => (
                                            <SelectItem key={option.value} value={String(option.value)}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex items-end">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeTaskSkillRow(taskIndex, skillIndex)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {selectedRequiredSkills.length > 0 && (
                                <div className="rounded-lg bg-white p-3 text-xs text-muted-foreground ring-1 ring-slate-200">
                                  {orderedSelectedTeamMembers.length > 0 ? (
                                    orderedSelectedTeamMembers.map((employee) => {
                                      const employeeMatch = calculateTechnicalSkillMatch(
                                        selectedRequiredSkills,
                                        employeeSkillsById.get(employee.id) ?? []
                                      )
                                      const matchedSkillLabels = selectedRequiredSkills.map((skill) => {
                                        const employeeSkill = (employeeSkillsById.get(employee.id) ?? []).find(
                                          (item) => item.skill.id === skill.skillId
                                        )
                                        const skillName = skillNamesById.get(skill.skillId) ?? 'Competence'
                                        return `${skillName}: ${employeeSkill ? getSkillLevelLabel(employeeSkill.level) : 'Aucune'}`
                                      })

                                      return (
                                        <div key={`${employee.id}-${taskIndex}`} className="flex flex-wrap items-center gap-2 py-1">
                                          <Badge variant="outline">{employee.name}</Badge>
                                          <Badge>{employeeMatch}%</Badge>
                                          <span>{matchedSkillLabels.join(' | ')}</span>
                                        </div>
                                      )
                                    })
                                  ) : (
                                    <span>Selectionnez les membres du projet pour voir le matching.</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>

                </div>

                {formError && (
                  <div className="mx-6 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <DialogFooter className="border-t bg-white px-6 py-4">
                  <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmitting || isGeneratingTasks}>
                    {isSubmitting ? 'Creation...' : 'Creer le projet'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="max-w-xs">
        <Label htmlFor="project-status-filter">Statut</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger id="project-status-filter" className="mt-2">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous</SelectItem>
            <SelectItem value={PROJECT_STATUS.IN_PROGRESS}>En cours</SelectItem>
            <SelectItem value={PROJECT_STATUS.COMPLETED}>Termine</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          message="Aucun projet trouve"
          description="Aucun projet ne correspond au filtre selectionne."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const progress = getProgress(project)
            const ownershipLabel = getProjectOwnershipLabel(project)
            const projectSlaBreached = isProjectSlaBreached(project)

            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      {ownershipLabel && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {ownershipLabel}
                          </Badge>
                          {project.priority && project.priority !== 'MEDIUM' && (
                            <span className={`h-2 w-2 rounded-full ${PRIORITY_COLORS[project.priority]}`} />
                          )}
                        </div>
                      )}
                    </div>
                    <Link href={`/dashboard/projects/${project.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progression</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${STATUS_COLORS[project.status] || 'bg-slate-500'} text-white text-xs`}>
                        {STATUS_LABELS[project.status] || project.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {PRIORITY_LABELS[project.priority] || project.priority}
                      </Badge>
                      {projectSlaBreached && (
                        <span
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                          style={PROJECT_SLA_BREACHED_STYLE}
                        >
                          {PROJECT_SLA_BREACHED_LABEL}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FolderKanban className="h-4 w-4" />
                        <span>{getTaskCount(project)} taches</span>
                      </div>
                      {project.endDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(project.endDate), 'dd MMM yyyy', { locale: fr })}</span>
                        </div>
                      )}
                    </div>
                    {project.team.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {project.team.slice(0, 3).map((member) => (
                            <Avatar key={member.id} className="h-6 w-6 border-2 border-white">
                              <AvatarFallback className="text-xs">{getInitials(member.name)}</AvatarFallback>
                            </Avatar>
                          ))}
                          {project.team.length > 3 && (
                            <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs">
                              +{project.team.length - 3}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {project.team.map((member) => member.name).slice(0, 2).join(', ')}
                          {project.team.length > 2 && ` +${project.team.length - 2}`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
