'use client'

import { useState, useEffect } from 'react'
import { PROJECT_STATUS, ROLE, TASK_STATUS } from '@/lib/constants'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Plus, Calendar, Users, FolderKanban, ArrowRight, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

interface Project {
  id: string
  name: string
  description: string | null
  progress: number
  status: string
  priority: string
  managerId: string | null
  createdById: string | null
  createdByRole: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
  tasks: Task[]
  team: { id: string; name: string }[]
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

const STATUS_LABELS: Record<string, string> = {
  [PROJECT_STATUS.PENDING]: 'En attente',
  [PROJECT_STATUS.IN_PROGRESS]: 'En cours',
  TERMINE: 'Terminé'
}

const STATUS_COLORS: Record<string, string> = {
  [PROJECT_STATUS.PENDING]: 'bg-yellow-500',
  [PROJECT_STATUS.IN_PROGRESS]: 'bg-blue-500',
  [PROJECT_STATUS.COMPLETED]: 'bg-green-500'
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute'
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-red-500'
}

export default function ProjectsPage() {
  const { user } = useCurrentUser()
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    priority: 'MEDIUM',
    teamMemberIds: [] as string[]
  })

  const canCreateProject = user?.role === ROLE.MANAGER

  useEffect(() => {
    fetchProjects()
    if (canCreateProject) {
      fetchEmployees()
    }
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch {
      toast({
        title: 'Impossible de charger les projets',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      // For manager, use the dedicated team endpoint to get only their team members
      const endpoint = user?.role === ROLE.MANAGER ? '/api/users/team' : '/api/employees'
      const res = await fetch(endpoint)
      if (res.ok) {
        const data = await res.json()
        setEmployees(data)
      }
    } catch {
      toast({
        title: "Impossible de charger l'equipe",
        variant: 'destructive',
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        await fetchProjects()
        setIsDialogOpen(false)
        setFormData({ 
          name: '', 
          description: '', 
          startDate: '', 
          endDate: '', 
          priority: 'MEDIUM',
          teamMemberIds: [] 
        })
      } else {
        const error = await res.json().catch(() => ({}))
        toast({
          title: error.error || 'Erreur lors de la creation',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur lors de la creation',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter team members For manager - only show their team
  const availableEmployees = user?.role === ROLE.MANAGER 
    ? employees.filter(e => e.managerId === user.id)
    : employees

  const getTaskCount = (project: Project) => project.tasks.length
  const getCompletedTaskCount = (project: Project) => project.tasks.filter(t => t.status === TASK_STATUS.DONE).length
  const getProgress = (project: Project) => {
    if (project.tasks.length === 0) return project.progress || 0
    const completed = project.tasks.filter(t => t.status === TASK_STATUS.DONE).length
    return Math.round((completed / project.tasks.length) * 100)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projets</h1>
          <p className="text-muted-foreground">Gestion des projets et des tâches</p>
          {user?.role === ROLE.HR && (
            <Badge variant="outline" className="mt-2 text-blue-600 border-blue-300">
              Observateur
            </Badge>
          )}
        </div>
        {canCreateProject && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau projet
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer un nouveau projet</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du projet *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Date de début</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Date de fin</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priorité</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
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
                {availableEmployees.length > 0 && (
                  <div className="space-y-2">
                    <Label>Membres de l'équipe {user?.role === ROLE.MANAGER && '(votre équipe)'}</Label>
                    <div className="flex flex-wrap gap-2">
                      {availableEmployees.map((emp) => (
                        <Badge
                          key={emp.id}
                          variant={formData.teamMemberIds.includes(emp.id) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            const newIds = formData.teamMemberIds.includes(emp.id)
                              ? formData.teamMemberIds.filter(id => id !== emp.id)
                              : [...formData.teamMemberIds, emp.id]
                            setFormData({ ...formData, teamMemberIds: newIds })
                          }}
                        >
                          {emp.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Création...' : 'Créer le projet'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          message="Aucun projet trouve"
          description="Creez un projet ou attendez qu'une equipe en publie un."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const progress = getProgress(project)
            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      {project.createdByRole && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Créé par: {project.createdByRole}
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
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FolderKanban className="h-4 w-4" />
                        <span>{getTaskCount(project)} tâches</span>
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
                          {project.team.map(t => t.name).slice(0, 2).join(', ')}
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

