'use client'

import { useState, useEffect, useMemo } from 'react'
import { PROJECT_STATUS, ROLE } from '@/lib/constants'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  createEmptyTechnicalSkillRow,
  DEFAULT_TECHNICAL_SKILL_LEVEL,
  getSkillLevelLabel,
  hasDuplicateTechnicalSkills,
  mapTechnicalSkillCatalogItems,
  skillLevelOptions,
  TechnicalSkillCatalogItem,
  TechnicalSkillFormRow,
} from '@/lib/skills/client'
import { formatDateOnly } from '@/lib/leave-request'
import { 
  Plus, 
  ArrowLeft, 
  Calendar, 
  Users, 
  Trash2,
  GripVertical,
  CheckCircle2,
  Clock,
  Eye,
  AlertCircle,
  Sparkles,
  Loader2,
  Pencil,
  X
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  assigneeId: string
  assignee?: {
    id: string
    name: string
  }
  submittedForReview?: boolean
  reviewComment?: string | null
  deliverableLink?: string | null
  deliverableNote?: string | null
  taskScore?: number | null
  requiredSkills: Array<{
    id: string
    minimumLevel: number
    skill: {
      id: string
      name: string
      type: 'TECHNICAL'
      isActive?: boolean
    }
  }>
}

interface Project {
  id: string
  name: string
  description: string | null
  progress: number
  status: string
  priority: string
  startDate: string | null
  endDate: string | null
  createdById: string | null
  createdByRole: string | null
  tasks: Task[]
   team: { id: string; name: string; avatar: string | null }[]
  changeHistory: ChangeHistory[]
}

interface ChangeHistory {
  id: string
  actorId: string
  actorName: string
  action: string
  approved: boolean
  createdAt: string
}

interface Employee {
  id: string
  name: string
  managerId: string | null
  upcomingApprovedLeave?: {
    startDate: string
    endDate: string
  } | null
}

// AI generated task preview interface
interface GeneratedTask {
  title: string
  description: string
  assignedUserId: string
  dueDate: string
  priority: string
  comment?: string | null
}

interface AITeamMember {
  id: string
  name: string
  jobTitle?: string
  status?: 'active' | 'en_conge'
  skills?: Array<{ name: string; level: number }>
}

const AI_PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  LOW: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

function getAiPriorityLabel(priority: string) {
  return PRIORITIES.find((item) => item.id === priority)?.label || priority
}

function formatGeneratedDueDate(value: string | null | undefined) {
  if (!value) return ''
  return value.includes('T') ? value.split('T')[0] : value
}

// 4-column Kanban: TODO, IN_PROGRESS, IN_REVIEW, DONE
const COLUMNS = [
  { id: 'TODO', title: 'À faire', icon: AlertCircle, color: 'bg-slate-100 dark:bg-slate-700' },
  { id: 'IN_PROGRESS', title: 'En cours', icon: Clock, color: 'bg-blue-100 dark:bg-blue-900' },
  { id: 'IN_REVIEW', title: 'En révision', icon: Eye, color: 'bg-yellow-100 dark:bg-yellow-900' },
  { id: 'DONE', title: 'Terminé', icon: CheckCircle2, color: 'bg-green-100 dark:bg-green-900' }
]

const PRIORITIES = [
  { id: 'LOW', label: 'Basse', color: 'bg-slate-500' },
  { id: 'MEDIUM', label: 'Moyenne', color: 'bg-yellow-500' },
  { id: 'HIGH', label: 'Haute', color: 'bg-red-500' }
]

const STATUS_LABELS: Record<string, string> = {
  [PROJECT_STATUS.PENDING]: 'En attente',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé'
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useCurrentUser()
  const { toast } = useToast()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [technicalSkillsCatalog, setTechnicalSkillsCatalog] = useState<TechnicalSkillCatalogItem[]>([])
  const [taskDialogError, setTaskDialogError] = useState('')

  // AI Task Generation state
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false)
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([])
  const [isAIPreviewOpen, setIsAIPreviewOpen] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiWarning, setAiWarning] = useState<string | null>(null)
  const [aiTeamMembers, setAiTeamMembers] = useState<AITeamMember[]>([])

  // Review state
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [reviewingTask, setReviewingTask] = useState<Task | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewScore, setReviewScore] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)

  // Submit for review (employee)
  const [isSubmitReviewOpen, setIsSubmitReviewOpen] = useState(false)
  const [submittingTask, setSubmittingTask] = useState<Task | null>(null)
  const [deliverableLink, setDeliverableLink] = useState('')
  const [deliverableNote, setDeliverableNote] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [submitReviewError, setSubmitReviewError] = useState('')

  // Move Task Dialog (used for both drag + buttons)
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
  const [taskToMove, setTaskToMove] = useState<Task | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('')

  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigneeId: '',
    dueDate: ''
  })
  const [taskRequiredSkills, setTaskRequiredSkills] = useState<TechnicalSkillFormRow[]>([
    { skillId: '', level: DEFAULT_TECHNICAL_SKILL_LEVEL }
  ])

  // CHEF can create/assign tasks, but only to their team
  // Employees can create tasks for themselves
  // RH is read-only observer
  const canManageTasks = user?.role === 'CHEF' || user?.role === ROLE.EMPLOYEE
  const canCreateTasks = user?.role === 'CHEF' || user?.role === ROLE.EMPLOYEE
  const canShowTaskButtons = user?.role === 'CHEF' // Only CHEF can see Create Task and Generate AI buttons
  const canManageProject = user?.role === 'CHEF'

  // Add team member state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [isAddingMembers, setIsAddingMembers] = useState(false)

  useEffect(() => {
    fetchProject()
    fetchEmployees()
    if (user?.role === 'CHEF') {
      void fetchTechnicalSkills()
    }
  }, [projectId, user?.role])

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects?projectId=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setProject(data)
      }
    } catch {
      toast({
        title: 'Impossible de charger le projet',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      // For CHEF, use the dedicated team endpoint to get only their team members
      const endpoint = user?.role === 'CHEF' ? '/api/users/team' : '/api/employees'
      const res = await fetch(endpoint)
      if (res.ok) {
        const data = await res.json()
        setEmployees(Array.isArray(data) ? data : [])
      }
    } catch {
      toast({
        title: "Impossible de charger l'equipe",
        variant: 'destructive',
      })
    }
  }

  const fetchTechnicalSkills = async () => {
    try {
      const res = await fetch('/api/skills?type=TECHNICAL', { cache: 'no-store' })
      if (!res.ok) {
        return
      }

      const data = await res.json()
      setTechnicalSkillsCatalog(mapTechnicalSkillCatalogItems(data))
    } catch {
      toast({
        title: 'Impossible de charger les competences techniques',
        variant: 'destructive',
      })
    }
  }

  const handleDragStart = (task: Task) => {
    // Employees can only drag their own tasks
    if (user?.role === ROLE.EMPLOYEE && task.assigneeId !== user.id) {
      return
    }
    // Block dragging for employee when task is in review
    if (user?.role === ROLE.EMPLOYEE && task.status === 'IN_REVIEW' && task.assigneeId === user.id) {
      return
    }
    setDraggedTask(task)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Reusable function to change task status (used by both drag and buttons)
  const changeTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: newStatus })
      })

      if (res.ok) {
        await fetchProject()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({
          title: data.error || "Impossible de deplacer la tache",
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur lors du changement de statut',
        variant: 'destructive',
      })
    }
  }

  const handleDrop = async (status: string) => {
    if (!draggedTask) return

    // Employees can only move their own tasks
    if (user?.role === ROLE.EMPLOYEE && draggedTask.assigneeId !== user.id) {
      setDraggedTask(null)
      return
    }

    if (draggedTask.status === status) {
      setDraggedTask(null)
      return
    }

    // For drag & drop, keep some restrictions for better UX
    const allowedTransitions = {
      [ROLE.EMPLOYEE]: { TODO: 'IN_PROGRESS', IN_PROGRESS: 'IN_REVIEW' },
      CHEF: { TODO: 'IN_PROGRESS', IN_PROGRESS: 'IN_REVIEW', IN_REVIEW: 'DONE' }
    }

    const userRole = user?.role as typeof ROLE.EMPLOYEE | typeof ROLE.MANAGER
    const allowedTarget = allowedTransitions[userRole]?.[draggedTask.status as keyof typeof allowedTransitions[typeof userRole]]

    if (allowedTarget !== status) {
      setDraggedTask(null)
      return
    }

    // Special case for employees:
    // Dragging their own IN_PROGRESS task to IN_REVIEW → open the deliverable submission modal
    if (
      user?.role === ROLE.EMPLOYEE &&
      draggedTask.status === 'IN_PROGRESS' &&
      status === 'IN_REVIEW' &&
      draggedTask.assigneeId === user.id
    ) {
      openSubmitReviewModal(draggedTask)
      setDraggedTask(null)
      return
    }

    // Direct move without popup for simple forward transition: TODO → IN_PROGRESS (via drag)
    if (draggedTask.status === 'TODO' && status === 'IN_PROGRESS') {
      await changeTaskStatus(draggedTask.id, status)
      setDraggedTask(null)
      return
    }

    // Normal case: open the generic Move dialog
    openMoveDialog(draggedTask, status)
    setDraggedTask(null)
  }

  // Open the unified Move Dialog (used by both drag and buttons)
  const openMoveDialog = (task: Task, preselectedStatus?: string) => {
    setTaskToMove(task)
    setSelectedStatus(preselectedStatus || task.status)
    setIsMoveDialogOpen(true)
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setTaskDialogError('')

    try {
      const selectedRequiredSkills = taskRequiredSkills.filter((skill) => skill.skillId)
      if (user?.role === 'CHEF' && hasDuplicateTechnicalSkills(selectedRequiredSkills)) {
        setTaskDialogError('Chaque competence technique requise doit etre unique.')
        return
      }

      const taskData = user?.role === ROLE.EMPLOYEE
        ? { ...taskForm, assigneeId: user.id, requiredSkills: [] }
        : {
            ...taskForm,
            requiredSkills: selectedRequiredSkills.map((skill) => ({
              skillId: skill.skillId,
              minimumLevel: skill.level,
            })),
          }

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      })

      if (res.ok) {
        await fetchProject()
        setIsTaskDialogOpen(false)
        setTaskDialogError('')
        setTaskForm({
          title: '',
          description: '',
          priority: 'MEDIUM',
          assigneeId: '',
          dueDate: ''
        })
        setTaskRequiredSkills([createEmptyTechnicalSkillRow()])
      } else {
        try {
          const error = await res.json()
          setTaskDialogError(error.error || 'Erreur lors de la creation')
        } catch {
          setTaskDialogError('Erreur lors de la creation')
        }
      }
    } catch {
      toast({
        title: 'Erreur lors de la creation de la tache',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche?')) return

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks?taskId=${taskId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchProject()
      }
    } catch {
      toast({
        title: 'Erreur lors de la suppression de la tache',
        variant: 'destructive',
      })
    }
  }

  // AI Task Generation functions
  const handleGenerateTasks = async () => {
    setIsGeneratingTasks(true)
    setAiError(null)
    setAiWarning(null)
    setGeneratedTasks([])
    setAiTeamMembers([])

    try {
      const res = await fetch(`/api/projects/${projectId}/generate-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await res.json()

      if (!res.ok) {
        setAiError(data.error || 'Erreur lors de la génération des tâches')
        return
      }

      setGeneratedTasks(
        (data.tasks || []).map((task: GeneratedTask) => ({
          ...task,
          dueDate: formatGeneratedDueDate(task.dueDate),
        }))
      )
      setAiTeamMembers(Array.isArray(data.teamMembers) ? data.teamMembers : [])
      setAiWarning(data.warning || null)
      setIsAIPreviewOpen(true)
    } catch {
      toast({
        title: 'Erreur lors de la generation des taches',
        variant: 'destructive',
      })
      setAiError('Erreur lors de la génération des tâches')
    } finally {
      setIsGeneratingTasks(false)
    }
  }

  const handleSaveGeneratedTasks = async () => {
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/projects/${projectId}/generate-tasks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: generatedTasks })
      })

      if (res.ok) {
        await fetchProject()
        setIsAIPreviewOpen(false)
        setGeneratedTasks([])
        setAiTeamMembers([])
      } else {
        const error = await res.json()
        toast({
          title: error.error || 'Erreur lors de la sauvegarde des taches',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur lors de la sauvegarde des taches',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateGeneratedTask = (index: number, field: keyof GeneratedTask, value: string) => {
    const updatedTasks = [...generatedTasks]
    updatedTasks[index] = { ...updatedTasks[index], [field]: value }
    setGeneratedTasks(updatedTasks)
  }

  const handleDeleteGeneratedTask = (index: number) => {
    setGeneratedTasks(generatedTasks.filter((_, i) => i !== index))
  }

  const handleAddManualTask = () => {
    const defaultAssigneeId = aiTeamMembers[0]?.id || project?.team[0]?.id || ''

    setGeneratedTasks([
      ...generatedTasks,
      {
        title: '',
        description: '',
        assignedUserId: defaultAssigneeId,
        dueDate: formatGeneratedDueDate(project?.endDate || ''),
        priority: 'MEDIUM',
        comment: ''
      }
    ])
  }

  const previewTeamMembers: AITeamMember[] = aiTeamMembers.length > 0
    ? aiTeamMembers
    : (project?.team || []).map((member) => ({
        id: member.id,
        name: member.name,
      }))

  const generatedAssignments = useMemo(
    () =>
      previewTeamMembers.map((member) => ({
        ...member,
        taskCount: generatedTasks.filter((task) => task.assignedUserId === member.id).length,
      })),
    [generatedTasks, previewTeamMembers]
  )

  // Task review handlers for CHEF/RH
  const openReviewDialog = (task: Task) => {
    setReviewingTask(task)
    setReviewComment('')
    setReviewScore('')
    setIsReviewDialogOpen(true)
  }

  // New: Submit task for review (employee)
  const openSubmitReviewModal = (task: Task) => {
    setSubmittingTask(task)
    setDeliverableLink('')
    setDeliverableNote('')
    setIsSubmitReviewOpen(true)
  }

  const handleSubmitForReview = async () => {
    if (!submittingTask) return
    setSubmitReviewError('')

    if (!deliverableLink && !deliverableNote) {
      setSubmitReviewError("Veuillez fournir au moins un lien ou une note")
      return
    }

    setIsSubmittingReview(true)
    try {
      const res = await fetch(`/api/tasks/${submittingTask.id}/submit-review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliverableLink: deliverableLink || undefined,
          deliverableNote: deliverableNote || undefined,
        }),
      })

      if (res.ok) {
        setIsSubmitReviewOpen(false)
        setSubmittingTask(null)
        setDeliverableLink('')
        setDeliverableNote('')
        setSubmitReviewError('')
        await fetchProject()
      } else {
        const data = await res.json()
        setSubmitReviewError(data.error || "Erreur lors de la soumission")
      }
    } catch (err) {
      setSubmitReviewError("Erreur de connexion au serveur")
    } finally {
      setIsSubmittingReview(false)
    }
  }

  // New: Review task (CHEF)
  const handleReviewDeliverable = async (taskId: string, decision: 'APPROVE' | 'REJECT', comment?: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewComment: comment, taskScore: decision === 'APPROVE' ? reviewScore : undefined }),
      })

      if (res.ok) {
        await fetchProject()
        setIsReviewDialogOpen(false)
        setReviewingTask(null)
        setReviewComment('')
        setReviewScore('')
      } else {
        const data = await res.json()
        toast({
          title: data.error || 'Erreur lors de la revision',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur serveur',
        variant: 'destructive',
      })
    }
  }

  const handleReviewTask = async (action: 'accept' | 'request_revision') => {
    if (!reviewingTask) return
    
    setIsReviewing(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: reviewingTask.id,
          action,
          comment: reviewComment,
          taskScore: action === 'accept' ? reviewScore : undefined,
        })
      })

      if (res.ok) {
        await fetchProject()
        setIsReviewDialogOpen(false)
        setReviewingTask(null)
        setReviewComment('')
        setReviewScore('')
      } else {
        const error = await res.json()
        toast({
          title: error.error || 'Erreur lors de la revision',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur lors de la revision',
        variant: 'destructive',
      })
    } finally {
      setIsReviewing(false)
    }
  }

  // Add/remove team member handlers
  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) return
    setIsAddingMembers(true)
    try {
      const currentTeamIds = project?.team.map(t => t.id) || []
      const newMembers = selectedMembers.filter(id => !currentTeamIds.includes(id))
      
      if (newMembers.length === 0) {
        toast({
          title: 'Les membres selectionnes sont deja dans le projet',
          variant: 'destructive',
        })
        return
      }

      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamMemberIds: [...currentTeamIds, ...newMembers] })
      })

      if (res.ok) {
        await fetchProject()
        setIsAddMemberOpen(false)
        setSelectedMembers([])
      } else {
        const error = await res.json()
        toast({
          title: error.error || "Erreur lors de l'ajout des membres",
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: "Erreur lors de l'ajout des membres",
        variant: 'destructive',
      })
    } finally {
      setIsAddingMembers(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Voulez-vous vraiment retirer ce membre du projet?')) return
    
    try {
      const currentTeamIds = project?.team.map(t => t.id).filter(id => id !== memberId) || []
      
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamMemberIds: currentTeamIds })
      })

      if (res.ok) {
        await fetchProject()
      } else {
        const error = await res.json()
        toast({
          title: error.error || 'Erreur lors de la suppression du membre',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur lors de la suppression du membre',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteProject = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet? Cette action est irréversible.')) return
    
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        router.push('/dashboard/projects')
      } else {
        const error = await res.json()
        toast({
          title: error.error || 'Erreur lors de la suppression du projet',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur lors de la suppression du projet',
        variant: 'destructive',
      })
    }
  }

  // Filter employees for CHEF - only show their team members
  const availableEmployees = user?.role === 'CHEF'
    ? (employees || []).filter(e => e.managerId === user.id)
    : (employees || [])

  const availableAdditionalRequiredSkills = useMemo(
    () => technicalSkillsCatalog.filter((skill) => !taskRequiredSkills.some((row) => row.skillId === skill.id)),
    [taskRequiredSkills, technicalSkillsCatalog]
  )
  const selectedAssigneeUpcomingLeave = useMemo(
    () => availableEmployees.find((employee) => employee.id === taskForm.assigneeId)?.upcomingApprovedLeave ?? null,
    [availableEmployees, taskForm.assigneeId]
  )

  const updateRequiredSkillRow = (index: number, updates: Partial<TechnicalSkillFormRow>) => {
    setTaskDialogError('')
    setTaskRequiredSkills((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row))
    )
  }

  const addRequiredSkillRow = () => {
    setTaskDialogError('')
    setTaskRequiredSkills((current) => [...current, createEmptyTechnicalSkillRow()])
  }

  const removeRequiredSkillRow = (index: number) => {
    setTaskDialogError('')
    setTaskRequiredSkills((current) => {
      if (current.length === 1) {
        return [createEmptyTechnicalSkillRow()]
      }

      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  const getTasksByStatus = (status: string) => {
    return project?.tasks.filter(t => t.status === status) || []
  }

  const getPriorityColor = (priority: string) => {
    return PRIORITIES.find(p => p.id === priority)?.color || 'bg-slate-500'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0].toUpperCase())
      .join('')
      .substring(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <EmptyState
        icon={AlertCircle}
        message="Projet non trouve"
        description="Retournez a la liste des projets pour en selectionner un autre."
        actionLabel="Retour aux projets"
        onAction={() => router.push('/dashboard/projects')}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/projects')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <Badge className={
                project.status === 'TERMINE' ? 'bg-green-500' :
                project.status === 'EN_COURS' ? 'bg-blue-500' : 'bg-yellow-500'
              }>
                {STATUS_LABELS[project.status] || project.status}
              </Badge>
              {user?.role === 'RH' && (
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  Observateur
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
        {canShowTaskButtons && (
          <div className="flex flex-wrap items-center gap-2">
            {canManageProject && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddMemberOpen(true)}
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  Gérer l'équipe
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteProject}
                  className="border-red-500 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Supprimer
                </Button>
              </>
            )}
            <Button
              onClick={handleGenerateTasks}
              disabled={isGeneratingTasks || !project || project.team.length === 0}
              variant="outline"
              size="sm"
              className="border-[#1B3A6B] text-[#1B3A6B] hover:bg-[#1B3A6B] hover:text-white"
            >
              {isGeneratingTasks ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Générer avec l'IA
                </>
              )}
            </Button>
            <Dialog
              open={isTaskDialogOpen}
              onOpenChange={(open) => {
                setIsTaskDialogOpen(open)
                if (!open) {
                  setTaskDialogError('')
                  setTaskRequiredSkills([createEmptyTechnicalSkillRow()])
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nouvelle tâche
                </Button>
              </DialogTrigger>
              <DialogContent className="flex max-h-[min(92vh,56rem)] max-w-2xl flex-col overflow-hidden p-0">
                <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
                  <DialogTitle>Creer une nouvelle tache</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {taskDialogError && (
                  <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                    {taskDialogError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="taskTitle">Titre *</Label>
                  <Input
                    id="taskTitle"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskDescription">Description</Label>
                  <Textarea
                    id="taskDescription"
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priorité</Label>
                    <Select
                      value={taskForm.priority}
                      onValueChange={(value) => setTaskForm({ ...taskForm, priority: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignee">
                      Assigné à {user?.role === 'CHEF' && '(votre équipe)'}{user?.role === ROLE.EMPLOYEE && '(vous-même)'}
                    </Label>
                    <Select
                      value={taskForm.assigneeId}
                      onValueChange={(value) => setTaskForm({ ...taskForm, assigneeId: value })}
                      disabled={user?.role === ROLE.EMPLOYEE}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {user?.role === ROLE.EMPLOYEE ? (
                          <SelectItem value={user.id}>{user.name} (vous)</SelectItem>
                        ) : (
                          availableEmployees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {user?.role === 'CHEF' && selectedAssigneeUpcomingLeave && (
                      <div
                        className="rounded-lg border px-3 py-2 text-sm"
                        style={{
                          borderColor: '#FCD34D',
                          backgroundColor: '#FFFBEB',
                          color: '#92400E',
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <p>
                            Rappel : ce collaborateur a un conge prevu entre le{' '}
                            {formatDateOnly(selectedAssigneeUpcomingLeave.startDate)} et le{' '}
                            {formatDateOnly(selectedAssigneeUpcomingLeave.endDate)}.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Date d'echeance</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  />
                </div>
                {user?.role === 'CHEF' && (
                  <div className="space-y-4 rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="space-y-1">
                      <Label>Competences techniques requises</Label>
                      <p className="text-sm text-muted-foreground">
                        Definissez les competences techniques minimales attendues pour cette tache.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {taskRequiredSkills.map((row, index) => {
                        const unavailableSkillIds = taskRequiredSkills
                          .map((skill, skillIndex) => (skillIndex === index ? null : skill.skillId))
                          .filter((skillId): skillId is string => Boolean(skillId))

                        const rowSkills = technicalSkillsCatalog.filter(
                          (skill) => !unavailableSkillIds.includes(skill.id) || skill.id === row.skillId
                        )

                        return (
                          <div
                            key={`task-required-skill-${index}`}
                            className="space-y-3 rounded-lg border p-3"
                            style={{ borderColor: 'var(--color-border)' }}
                          >
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)] md:items-end">
                              <div className="min-w-0 space-y-2">
                                <Label>Competence requise {index + 1}</Label>
                                <Select
                                  value={row.skillId}
                                  onValueChange={(value) => updateRequiredSkillRow(index, { skillId: value })}
                                >
                                  <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Selectionner une competence technique" />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="max-h-64" sideOffset={6}>
                                    {rowSkills.map((skill) => (
                                      <SelectItem key={skill.id} value={skill.id}>
                                        {skill.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="min-w-0 space-y-2">
                                <Label>Niveau minimum</Label>
                                <Select
                                  value={String(row.level)}
                                  onValueChange={(value) => updateRequiredSkillRow(index, { level: Number(value) })}
                                >
                                  <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Selectionner un niveau" />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="max-h-64" sideOffset={6}>
                                    {skillLevelOptions.map((option) => (
                                      <SelectItem key={option.value} value={String(option.value)}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="flex justify-end border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => removeRequiredSkillRow(index)}
                                className="w-full gap-2 sm:w-auto"
                              >
                                <Trash2 className="h-4 w-4" />
                                Retirer
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Les doublons sont refuses et seuls les skills techniques actifs sont proposes.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addRequiredSkillRow}
                        disabled={availableAdditionalRequiredSkills.length === 0}
                        className="w-full gap-2 md:w-auto"
                      >
                        <Plus className="h-4 w-4" />
                        Ajouter une autre competence
                      </Button>
                    </div>
                  </div>
                )}
                </div>
                <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
                  <Button type="button" variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Création...' : 'Créer la tâche'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      {/* AI Task Preview Dialog */}
      <Dialog open={isAIPreviewOpen} onOpenChange={setIsAIPreviewOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <span className="rounded-xl bg-[#1B3A6B]/10 p-2 text-[#1B3A6B]">
                <Sparkles className="h-5 w-5" />
              </span>
              Tâches générées par l'IA
            </DialogTitle>
            <DialogDescription>
              Revoyez, ajustez et distribuez les suggestions avant l&apos;enregistrement dans le projet.
            </DialogDescription>
          </DialogHeader>
          
          {aiError && (
            <div className="mx-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {aiError}
            </div>
          )}

          {aiWarning && (
            <div className="mx-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {aiWarning}
            </div>
          )}

          {generatedTasks.length > 0 ? (
            <div className="max-h-[calc(88vh-11rem)] overflow-y-auto px-6 py-5">
              <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Suggestions</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{generatedTasks.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Membres actifs</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{previewTeamMembers.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Source</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {aiWarning ? 'Suggestion locale' : 'Generation IA'}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Repartition proposee</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {generatedAssignments.map((member) => (
                    <div key={member.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{member.name}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{member.jobTitle || 'Membre actif'}</p>
                        </div>
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          {member.taskCount} tache{member.taskCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {member.skills && member.skills.length > 0 && (
                        <p className="mt-3 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                          {member.skills
                            .slice(0, 3)
                            .map((skill) => `${skill.name} ${skill.level}/5`)
                            .join(' | ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {generatedTasks.map((task, index) => (
                <Card key={index} className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <CardContent className="space-y-4 p-5">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 dark:border-slate-800 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1B3A6B]/10 text-sm font-semibold text-[#1B3A6B]">
                            {String(index + 1).padStart(2, '0')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tache proposee</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Ajustez les details avant validation.</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={AI_PRIORITY_STYLES[task.priority] || AI_PRIORITY_STYLES.MEDIUM}>
                          {getAiPriorityLabel(task.priority)}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <Label>Titre</Label>
                        <Input
                          value={task.title}
                          onChange={(e) => handleUpdateGeneratedTask(index, 'title', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Description</Label>
                        <Textarea
                          value={task.description}
                          onChange={(e) => handleUpdateGeneratedTask(index, 'description', e.target.value)}
                          rows={4}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Note d&apos;affectation</Label>
                        <Textarea
                          value={task.comment || ''}
                          onChange={(e) => handleUpdateGeneratedTask(index, 'comment', e.target.value)}
                          rows={3}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Mentionnez ici le skill principal, le niveau estime et la logique d&apos;equilibrage.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Assignee</Label>
                          <Select
                            value={task.assignedUserId}
                            onValueChange={(value) => handleUpdateGeneratedTask(index, 'assignedUserId', value)}
                          >
                            <SelectTrigger className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {previewTeamMembers.map(member => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Date limite</Label>
                          <Input
                            type="date"
                            value={task.dueDate}
                            onChange={(e) => handleUpdateGeneratedTask(index, 'dueDate', e.target.value)}
                            className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Priorite</Label>
                          <Select
                            value={task.priority}
                            onValueChange={(value) => handleUpdateGeneratedTask(index, 'priority', value)}
                          >
                            <SelectTrigger className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HIGH">Haute</SelectItem>
                              <SelectItem value="MEDIUM">Moyenne</SelectItem>
                              <SelectItem value="LOW">Basse</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 xl:w-64">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Verifiez l&apos;echeance, la priorite et la charge avant l&apos;enregistrement.
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => handleDeleteGeneratedTask(index)}
                        className="justify-start text-red-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer cette tache
                      </Button>
                    </div>
                    </div>
                  </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="outline"
                onClick={handleAddManualTask}
                className="w-full border-dashed border-[#1B3A6B]/35 text-[#1B3A6B] hover:bg-[#1B3A6B]/5"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une tache manuellement
              </Button>
            </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucune tâche générée
            </p>
          )}

          <DialogFooter className="border-t px-6 py-4">
            <Button variant="outline" onClick={() => setIsAIPreviewOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveGeneratedTasks}
              disabled={isSubmitting || generatedTasks.length === 0}
              className="bg-[#1B3A6B] hover:bg-[#15305a]"
            >
              {isSubmitting ? 'Enregistrement...' : 'Confirmer et enregistrer les tâches'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Info Cards */}
       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Progression</p>
            <div className="flex items-center gap-2">
              <Progress value={project.progress} className="h-1.5 flex-1" />
              <span className="text-sm font-semibold">{project.progress}%</span>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Date de fin</p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {project.endDate 
                  ? format(new Date(project.endDate), 'dd MMM yyyy', { locale: fr })
                  : 'Non définie'}
              </span>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Équipe</p>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{project.team.length} membre{project.team.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Priorité</p>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${getPriorityColor(project.priority)}`} />
              <span className="text-sm">{PRIORITIES.find(p => p.id === project.priority)?.label || project.priority}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Kanban Board - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 h-[calc(100vh-16rem)]">
        {COLUMNS.map(column => {
          const ColumnIcon = column.icon
          const tasks = getTasksByStatus(column.id)
          const columnColors: Record<string, { bg: string, border: string, header: string }> = {
            TODO: { bg: 'var(--color-bg-secondary)', border: 'var(--color-border)', header: 'var(--color-bg-tertiary)' },
            IN_PROGRESS: { bg: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.2)', header: 'rgba(59, 130, 246, 0.1)' },
            IN_REVIEW: { bg: 'rgba(245, 158, 11, 0.05)', border: 'rgba(245, 158, 11, 0.2)', header: 'rgba(245, 158, 11, 0.1)' },
            DONE: { bg: 'rgba(34, 197, 94, 0.05)', border: 'rgba(34, 197, 94, 0.2)', header: 'rgba(34, 197, 94, 0.1)' }
          }
          const colors = columnColors[column.id] || columnColors.TODO
          
          return (
            <div
              key={column.id}
              className="rounded-lg border flex flex-col"
              style={{ backgroundColor: colors.bg, borderColor: colors.border }}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
            >
              <div className="px-3 py-2 border-b flex items-center justify-between rounded-t-lg" style={{ backgroundColor: colors.header, borderColor: colors.border }}>
                <div className="flex items-center gap-2">
                  <ColumnIcon className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{column.title}</h3>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {tasks.length}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {tasks.map(task => {
                   const canDrag = 
                     (user?.role === 'CHEF' && project.team.some(t => t.id === user.id)) ||
                     (user?.role === ROLE.EMPLOYEE && 
                      task.assigneeId === user.id && 
                      task.status !== 'IN_REVIEW')
                  const priorityColors: Record<string, string> = {
                    HIGH: '#EF4444',
                    MEDIUM: '#F59E0B',
                    LOW: '#6B7280'
                  }
                  
                  return (
                    <Card
                      key={task.id}
                      className={`shadow-sm border ${canDrag ? 'cursor-move hover:shadow-md transition-all' : 'opacity-75'}`}
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                      draggable={canDrag}
                      onDragStart={() => canDrag && handleDragStart(task)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {canDrag && <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                            <span className="font-medium text-sm truncate">{task.title}</span>
                          </div>
                           {user?.role === 'CHEF' && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {task.submittedForReview && user?.role === 'CHEF' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => openReviewDialog(task)}
                                  title="Réviser la tâche"
                                >
                                  <Eye className="h-3 w-3 text-amber-600" />
                                </Button>
                              )}
                               <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-6 w-6"
                                 onClick={() => handleDeleteTask(task.id)}
                               >
                                 <Trash2 className="h-3 w-3 text-muted-foreground" />
                               </Button>
                             </div>
                           )}

                          </div>
                         {task.description && (
                           <p className="text-xs text-muted-foreground line-clamp-2">
                             {task.description}
                           </p>
                         )}

                         {/* Deliverable info for CHEF on IN_REVIEW */}
                         {task.status === 'IN_REVIEW' && (task.deliverableLink || task.deliverableNote) && user?.role === 'CHEF' && (
                           <div className="text-xs bg-amber-50 dark:bg-amber-950 p-2 rounded border border-amber-200">
                             {task.deliverableLink && (
                               <a 
                                 href={task.deliverableLink} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="text-blue-600 hover:underline block truncate"
                               >
                                Lien: {task.deliverableLink}
                               </a>
                             )}
                             {task.deliverableNote && (
                               <p className="text-muted-foreground mt-1">{task.deliverableNote}</p>
                             )}
                           </div>
                         )}

                         {/* Show review comment on rejected tasks */}
                         {task.status === 'IN_PROGRESS' && task.reviewComment && (
                           <div className="text-xs bg-red-50 dark:bg-red-950 p-2 rounded border border-red-200 text-red-700">
                             <strong>Commentaire du chef :</strong> {task.reviewComment}
                           </div>
                         )}
                        {task.requiredSkills.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Competences requises
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {task.requiredSkills.map((requiredSkill) => (
                                <Badge
                                  key={requiredSkill.id}
                                  variant="outline"
                                  className="border-0 text-[11px]"
                                  style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
                                >
                                  {requiredSkill.skill.name} · Min. {getSkillLevelLabel(requiredSkill.minimumLevel)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span 
                              className="h-2 w-2 rounded-full" 
                              style={{ backgroundColor: priorityColors[task.priority] || priorityColors.MEDIUM }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {PRIORITIES.find(p => p.id === task.priority)?.label}
                            </span>
                          </div>
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(task.dueDate), 'dd MMM', { locale: fr })}</span>
                            </div>
                          )}
                        </div>
                         {task.assignee && (
                           <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
                             <Avatar className="h-5 w-5">
                               <AvatarFallback className="text-[10px]">
                                 {getInitials(task.assignee.name)}
                               </AvatarFallback>
                             </Avatar>
                             <span className="text-xs text-muted-foreground truncate">{task.assignee.name}</span>
                           </div>
                         )}

                           {/* Primary Action Button - Dynamic based on status (same style as Soumettre pour révision) */}
                           <div className="pt-2">
                             {/* Employee actions */}
                             {user?.role === ROLE.EMPLOYEE && task.assigneeId === user.id && (
                               <>
                                 {task.status === 'TODO' && (
                                    <Button
                                      size="sm"
                                      className="h-8 w-full border border-[#1B3A6B] bg-white text-xs text-[#1B3A6B] transition-all duration-200 active:scale-[0.985] hover:border-[#F59E0B] hover:bg-[#F59E0B] hover:text-white dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600"
                                      onClick={() => changeTaskStatus(task.id, 'IN_PROGRESS')}
                                    >
                                      Commencer la tâche
                                    </Button>
                                  )}

                                  {task.status === 'IN_PROGRESS' && (
                                    <Button
                                      size="sm"
                                      className="flex h-8 w-full items-center justify-center gap-1 border border-[#1B3A6B] bg-white text-xs text-[#1B3A6B] transition-all duration-200 active:scale-[0.985] hover:border-[#F59E0B] hover:bg-[#F59E0B] hover:text-white dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600"
                                      onClick={() => openSubmitReviewModal(task)}
                                    >
                                      Soumettre pour révision
                                    </Button>
                                  )}

                                 {task.status === 'IN_REVIEW' && (
                                   <div className="text-xs text-center py-1.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                                     En attente de révision par votre chef
                                   </div>
                                 )}
                               </>
                             )}

                             {/* CHEF has no primary button here — uses the eye icon instead */}
                           </div>
                       </CardContent>
                    </Card>
                  )
                })}
                {tasks.length === 0 && (
                  <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Aucune tâche
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Task Review Dialog for CHEF/RH */}
      <Dialog open={isReviewDialogOpen} onOpenChange={(open) => {
        setIsReviewDialogOpen(open)
        if (!open) {
          setReviewComment('')
          setReviewScore('')
          setReviewingTask(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réviser la tâche</DialogTitle>
          </DialogHeader>
          
          {reviewingTask && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-slate-700">
                <h4 className="font-medium">{reviewingTask.title}</h4>
                {reviewingTask.description && (
                  <p className="text-sm text-muted-foreground mt-1">{reviewingTask.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    Assigné à: {reviewingTask.assignee?.name || 'Inconnu'}
                  </Badge>
                  {reviewingTask.dueDate && (
                    <Badge variant="outline" className="text-xs">
                      Échéance: {format(new Date(reviewingTask.dueDate), 'dd MMM yyyy', { locale: fr })}
                    </Badge>
                  )}
                </div>
               </div>

               {/* Deliverable info */}
               {(reviewingTask.deliverableLink || reviewingTask.deliverableNote) && (
                 <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                   <div className="font-medium text-sm mb-2 flex items-center gap-2">
                     <Eye className="h-4 w-4" /> Livrable soumis
                   </div>
                   
                   {reviewingTask.deliverableLink && (
                     <a 
                       href={reviewingTask.deliverableLink} 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       className="mb-2 block break-all text-sm text-blue-600 hover:underline dark:text-blue-400"
                     >
                      Lien: {reviewingTask.deliverableLink}
                     </a>
                   )}
                   
                   {reviewingTask.deliverableNote && (
                     <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                       {reviewingTask.deliverableNote}
                     </p>
                   )}
                 </div>
                )}

                {/* Task Score - Required for APPROVE / Accepter */}
                <div className="space-y-2">
                  <Label>Score de la tâche (1-10) <span className="text-red-500">*</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {[1,2,3,4,5,6,7,8,9,10].map((num) => (
                      <Button
                        key={num}
                        type="button"
                        variant={reviewScore === String(num) ? "default" : "outline"}
                        size="sm"
                        className={`h-9 w-9 p-0 text-sm ${reviewScore === String(num) ? 'bg-[#1B3A6B] text-white' : ''}`}
                        onClick={() => setReviewScore(String(num))}
                        disabled={isReviewing}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Requis pour approuver la tâche</p>
                </div>

                <div className="space-y-2">
                  <Label>Commentaire (optionnel)</Label>
                 <Textarea
                   value={reviewComment}
                   onChange={(e) => setReviewComment(e.target.value)}
                   placeholder="Ajouter un commentaire pour le collaborateur..."
                   rows={3}
                 />
               </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleReviewTask('request_revision')}
                  disabled={isReviewing}
                  className="border-orange-500 text-orange-600 hover:bg-orange-50"
                >
                   Demander une révision
                </Button>
                 <Button
                   onClick={() => handleReviewTask('accept')}
                   disabled={isReviewing || !reviewScore || Number(reviewScore) < 1 || Number(reviewScore) > 10}
                   className="bg-green-600 hover:bg-green-700"
                 >
                    Accepter
                 </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unified Move Task Dialog (used for both dragging and buttons) */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Déplacer la tâche</DialogTitle>
            <DialogDescription>
              Choisissez le nouveau statut pour « {taskToMove?.title} »
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            {(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const).map((status) => {
              const isCurrent = taskToMove?.status === status
              const isSelected = selectedStatus === status

              return (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  disabled={isCurrent}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-gray-200 hover:border-gray-300 dark:border-slate-700 dark:hover:border-slate-500'
                  } ${isCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="font-medium text-sm">
                    {status === 'TODO' && 'À faire'}
                    {status === 'IN_PROGRESS' && 'En cours'}
                     {status === 'IN_REVIEW' && 'En révision'}
                     {status === 'DONE' && 'Terminé'}
                  </div>
                  {isCurrent && (
                    <div className="text-[11px] text-muted-foreground mt-1">Statut actuel</div>
                  )}
                </button>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!taskToMove || selectedStatus === taskToMove.status}
              onClick={async () => {
                if (taskToMove && selectedStatus !== taskToMove.status) {
                  await changeTaskStatus(taskToMove.id, selectedStatus)
                }
                setIsMoveDialogOpen(false)
                setTaskToMove(null)
              }}
            >
              Confirmer le déplacement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit for Review Modal - employee */}
      <Dialog open={isSubmitReviewOpen} onOpenChange={(open) => {
        setIsSubmitReviewOpen(open)
        if (!open) {
          setSubmitReviewError('')
          setDeliverableLink('')
          setDeliverableNote('')
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Soumettre pour révision</DialogTitle>
            <DialogDescription>
              Fournissez un lien et/ou une note pour votre livrable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Lien du livrable (GitHub PR, Google Doc...)</Label>
              <Input
                placeholder="https://..."
                value={deliverableLink}
                onChange={(e) => setDeliverableLink(e.target.value)}
              />
            </div>

            <div>
              <Label>Note ou description</Label>
              <Textarea
                placeholder="Description du travail réalisé..."
                value={deliverableNote}
                onChange={(e) => setDeliverableNote(e.target.value)}
                rows={4}
              />
            </div>

            {submitReviewError && (
              <p className="text-sm text-red-600">{submitReviewError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubmitReviewOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmitForReview} 
              disabled={isSubmittingReview || (!deliverableLink && !deliverableNote)}
            >
              {isSubmittingReview ? "Envoi..." : "Soumettre pour révision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gérer les membres de l'équipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current team members */}
            <div className="space-y-2">
              <Label>Membres actuels</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {project?.team.map(member => (
                  <div key={member.id} className="flex items-center justify-between rounded bg-gray-50 p-2 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{member.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {project?.team.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun membre dans l'équipe</p>
                )}
              </div>
            </div>

            {/* Add new members */}
            <div className="space-y-2">
              <Label>Ajouter des membres (votre équipe)</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {availableEmployees
                  .filter(emp => !project?.team.some(t => t.id === emp.id))
                  .map(emp => (
                    <div key={emp.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`add-${emp.id}`}
                        checked={selectedMembers.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMembers([...selectedMembers, emp.id])
                          } else {
                            setSelectedMembers(selectedMembers.filter(id => id !== emp.id))
                          }
                        }}
                        className="rounded"
                      />
                      <label htmlFor={`add-${emp.id}`} className="text-sm cursor-pointer">
                        {emp.name}
                      </label>
                    </div>
                  ))}
                {availableEmployees.filter(emp => !project?.team.some(t => t.id === emp.id)).length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun autre membre disponible</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddMemberOpen(false); setSelectedMembers([]) }}>
              Annuler
            </Button>
            <Button onClick={handleAddMembers} disabled={isAddingMembers || selectedMembers.length === 0}>
              {isAddingMembers ? 'Ajout...' : 'Ajouter les membres'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

