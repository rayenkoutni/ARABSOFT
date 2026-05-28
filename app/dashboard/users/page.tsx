'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, UserPlus, KeyRound, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import { BrandedLoading } from '@/components/ui/spinner'
import {
  EmployeeCreateDialog,
  getDefaultEmployeeCreateFormData,
  type EmployeeCreateFormData,
} from '@/components/users/employee-create-dialog'
import {
  createEmptyTechnicalSkillRow,
  hasDuplicateTechnicalSkills,
  mapTechnicalSkillCatalogItems,
  type TechnicalSkillCatalogItem,
} from '@/lib/skills/client'

interface Employee {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  department: string | null
  position: string | null
  managerId: string | null
  hireDate: string
  leaveBalance: number
  onLeave: boolean
  avatar: string | null
  salaryGradeId?: string | null
  salaryOverride?: number | null
}

interface SalaryGrade {
  id: string
  role: string
  level: number
  baseSalary: number
  description?: string | null
}

function mapEmployeeListResponse(payload: unknown): Employee[] {
  if (!Array.isArray(payload)) {
    return []
  }

  return payload
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      name: typeof item.name === 'string' ? item.name : '',
      email: typeof item.email === 'string' ? item.email : '',
      phone: typeof item.phone === 'string' ? item.phone : null,
      role: typeof item.role === 'string' ? item.role : '',
      department: typeof item.department === 'string' ? item.department : null,
      position: typeof item.position === 'string' ? item.position : null,
      managerId: typeof item.managerId === 'string' ? item.managerId : null,
      hireDate: typeof item.hireDate === 'string' ? item.hireDate : '',
      leaveBalance: typeof item.leaveBalance === 'number' ? item.leaveBalance : 0,
      onLeave: Boolean(item.onLeave),
      avatar: typeof item.avatar === 'string' ? item.avatar : null,
      salaryGradeId: typeof item.salaryGradeId === 'string' ? item.salaryGradeId : null,
      salaryOverride: typeof item.salaryOverride === 'number' ? item.salaryOverride : null,
    }))
    .filter((employee) => employee.id && employee.name && employee.email)
}

function getTodayDateInputMax() {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isFutureDateInputValue(value: string) {
  return Boolean(value) && value > getTodayDateInputMax()
}

const roleColors: Record<string, { style: React.CSSProperties }> = {
  RH: { style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
  CHEF: { style: { backgroundColor: '#FEF3C7', color: '#92400E' } },
  COLLABORATEUR: { style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
}

const roleLabels: Record<string, string> = {
  RH: 'RH',
  CHEF: 'Chef',
  COLLABORATEUR: 'Collaborateur',
}

function salaryGradeLabel(grade?: SalaryGrade | undefined) {
  if (!grade) {
    return 'Aucun grade'
  }

  return `${grade.role} - Niveau ${grade.level} (${grade.baseSalary} TND)`
}

export default function UsersPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [technicalSkillsCatalog, setTechnicalSkillsCatalog] = useState<TechnicalSkillCatalogItem[]>([])
  const [salaryGrades, setSalaryGrades] = useState<SalaryGrade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSkillsLoading, setIsSkillsLoading] = useState(false)

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [listError, setListError] = useState('')
  const [error, setError] = useState('')
  const [successInfo, setSuccessInfo] = useState<{ name: string; email: string; message: string } | null>(null)

  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [editError, setEditError] = useState('')

  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [resetInfo, setResetInfo] = useState<{ name: string; message: string } | null>(null)

  const [formData, setFormData] = useState<EmployeeCreateFormData>(getDefaultEmployeeCreateFormData)

  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    position: '',
    managerId: '',
    hireDate: '',
    salaryGradeId: null as string | null,
    salaryOverride: null as number | null,
  })

  const hireDateMax = getTodayDateInputMax()

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((segment) => segment[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const AvatarDisplay = ({ employee }: { employee: Employee }) => {
    if (employee.avatar) {
      return (
        <img
          src={employee.avatar}
          alt={employee.name}
          className="h-8 w-8 rounded-full object-cover"
        />
      )
    }

    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-medium text-white">
        {getInitials(employee.name)}
      </div>
    )
  }

  const toDateInputValue = (value: string | null | undefined) => {
    if (!value) return ''

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return ''
    }

    return parsed.toISOString().slice(0, 10)
  }

  const loadEmployees = async () => {
    try {
      setIsLoading(true)
      setListError('')
      const res = await fetch('/api/employees')
      if (res.ok) {
        const data = await res.json()
        setEmployees(mapEmployeeListResponse(data))
        return
      }

      setEmployees([])
      setListError('Impossible de charger la liste des collaborateurs')
    } catch {
      setEmployees([])
      setListError('Impossible de charger la liste des collaborateurs')
    } finally {
      setIsLoading(false)
    }
  }

  const loadTechnicalSkillsCatalog = async () => {
    try {
      setIsSkillsLoading(true)
      const res = await fetch('/api/skills?type=TECHNICAL', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setTechnicalSkillsCatalog(mapTechnicalSkillCatalogItems(data))
      }
    } finally {
      setIsSkillsLoading(false)
    }
  }

  const loadSalaryGrades = async () => {
    try {
      const res = await fetch('/api/salary-grades', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setSalaryGrades(data)
      }
    } catch {
      // Grades remain optional in the UI.
    }
  }

  useEffect(() => {
    if (user) {
      loadEmployees()
      loadTechnicalSkillsCatalog()
      loadSalaryGrades()
    }
  }, [user])

  if (!user || user.role !== 'RH') {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Acces refuse. Cette page est reservee aux administrateurs RH.</p>
      </div>
    )
  }

  const chefs = employees.filter((employee) => employee.role === 'CHEF')
  const collaborators = employees.filter((employee) => employee.role === 'COLLABORATEUR')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name || !formData.email || !formData.role || !formData.hireDate) {
      setError("Le nom, l'email, le role et la date d'embauche sont obligatoires")
      return
    }

    if (!formData.salaryGradeId) {
      setError('Le grade salarial est obligatoire')
      return
    }

    if (isFutureDateInputValue(formData.hireDate)) {
      setError("La date d'embauche ne peut pas etre dans le futur")
      return
    }

    try {
      if (formData.role === 'COLLABORATEUR') {
        const selectedTechnicalSkills = formData.technicalSkills.filter((skill) => skill.skillId)

        if (selectedTechnicalSkills.length < 2) {
          setError('Un collaborateur doit avoir au moins 2 competences techniques')
          return
        }

        if (hasDuplicateTechnicalSkills(formData.technicalSkills)) {
          setError("Une competence technique ne peut etre selectionnee qu'une seule fois")
          return
        }
      }

      setIsSubmitting(true)
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          managerId: formData.managerId || null,
          technicalSkills:
            formData.role === 'COLLABORATEUR'
              ? formData.technicalSkills.filter((skill) => skill.skillId)
              : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la creation')
        return
      }

      setSuccessInfo({ name: data.name, email: data.email, message: data.message })
      setFormData(getDefaultEmployeeCreateFormData())
      loadEmployees()
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditDialog = (employee: Employee) => {
    setEditEmployee(employee)
    setEditFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone || '',
      role: employee.role,
      department: employee.department || '',
      position: employee.position || '',
      managerId: employee.managerId || '',
      hireDate: toDateInputValue(employee.hireDate),
      salaryGradeId: employee.salaryGradeId || null,
      salaryOverride: employee.salaryOverride ?? null,
    })
    setEditError('')
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editEmployee) return
    setEditError('')

    if (!editFormData.hireDate) {
      setEditError("La date d'embauche est obligatoire")
      return
    }

    if (!editFormData.salaryGradeId) {
      setEditError('Le grade salarial est obligatoire')
      return
    }

    if (isFutureDateInputValue(editFormData.hireDate)) {
      setEditError("La date d'embauche ne peut pas etre dans le futur")
      return
    }

    try {
      setIsSubmitting(true)
      const res = await fetch(`/api/employees/${editEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editFormData,
          managerId: editFormData.managerId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error || 'Erreur lors de la modification')
        return
      }

      setEditEmployee(null)
      loadEmployees()
    } catch {
      setEditError('Erreur de connexion au serveur')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!editEmployee) return
    try {
      setIsSubmitting(true)
      const res = await fetch(`/api/employees/${editEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPassword: true }),
      })
      const data = await res.json()
      if (res.ok && data.message) {
        setEditEmployee(null)
        setResetInfo({ name: data.name, message: data.message })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteEmployee) return
    try {
      setIsDeleting(true)
      const res = await fetch(`/api/employees/${deleteEmployee.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteEmployee(null)
        loadEmployees()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const addTechnicalSkill = () => {
    setFormData((current) => ({
      ...current,
      technicalSkills:
        current.technicalSkills.length >= technicalSkillsCatalog.length
          ? current.technicalSkills
          : [...current.technicalSkills, createEmptyTechnicalSkillRow()],
    }))
  }

  const removeTechnicalSkill = (index: number) => {
    if (index < 2) return

    setFormData((current) => ({
      ...current,
      technicalSkills: current.technicalSkills.filter((_, rowIndex) => rowIndex !== index),
    }))
  }

  const closeAllDialogs = () => {
    setShowAddDialog(false)
    setSuccessInfo(null)
    setEditEmployee(null)
    setDeleteEmployee(null)
    setResetInfo(null)
    setError('')
    setEditError('')
    setFormData(getDefaultEmployeeCreateFormData())
  }

  const onLeaveCount = employees.filter((employee) => employee.onLeave).length
  const availableCount = employees.filter((employee) => !employee.onLeave).length
  const selectedEditGrade = salaryGrades.find((grade) => grade.id === editFormData.salaryGradeId) ?? null
  const filteredEditSalaryGrades = editFormData.role
    ? salaryGrades.filter((grade) => grade.role === editFormData.role)
    : salaryGrades

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>
            Gestion des collaborateurs
          </h1>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Gere tous les utilisateurs du portail RH
          </p>
        </div>
        <Button
          className="gap-2"
          style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}
          onClick={() => setShowAddDialog(true)}
        >
          <UserPlus className="h-4 w-4" />
          Ajouter un collaborateur
        </Button>
      </div>

      {listError && (
        <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
          {listError}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center"><BrandedLoading /></div>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Telephone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden lg:table-cell">Departement</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const roleColor = roleColors[employee.role] || roleColors.COLLABORATEUR
                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <AvatarDisplay employee={employee} />
                      </TableCell>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell className="hidden lg:table-cell">{employee.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge className="border-0" style={roleColor.style}>
                          {roleLabels[employee.role] || employee.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{employee.department || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          className="border-0"
                          style={employee.onLeave
                            ? { backgroundColor: '#FEF3C7', color: '#92400E' }
                            : { backgroundColor: '#D1FAE5', color: '#065F46' }
                          }
                        >
                          {employee.onLeave ? 'En conge' : 'Disponible'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(employee)} title="Modifier">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteEmployee(employee)}
                            title="Supprimer"
                            disabled={employee.id === user.id}
                            style={employee.id !== user.id ? { color: '#EF4444' } : {}}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(37, 99, 176, 0.1)' }}>
                  <User className="h-4 w-4" style={{ color: 'var(--color-brand-blue)' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total utilisateurs</p>
                  <p className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{employees.length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                  <User className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Disponibles</p>
                  <p className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{availableCount}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(245, 166, 35, 0.1)' }}>
                  <User className="h-4 w-4" style={{ color: '#F5A623' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>En conge</p>
                  <p className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{onLeaveCount}</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      <EmployeeCreateDialog
        open={showAddDialog && !successInfo}
        error={error}
        isSubmitting={isSubmitting}
        isSkillsLoading={isSkillsLoading}
        formData={formData}
        chefs={chefs}
        collaborators={collaborators}
        technicalSkillsCatalog={technicalSkillsCatalog}
        salaryGrades={salaryGrades}
        onOpenChange={(open) => {
          if (!open) closeAllDialogs()
        }}
        onSubmit={handleCreate}
        onFormDataChange={setFormData}
        onAddTechnicalSkill={addTechnicalSkill}
        onRemoveTechnicalSkill={removeTechnicalSkill}
      />

      <Dialog open={!!successInfo} onOpenChange={(open) => { if (!open) closeAllDialogs() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: '#10B981' }} />
              Compte cree avec succes
            </DialogTitle>
          </DialogHeader>
          {successInfo && (
            <div className="space-y-4">
              <div className="space-y-3 rounded-lg p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="rounded-full p-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                    <CheckCircle2 className="h-6 w-6" style={{ color: '#10B981' }} />
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>{successInfo.name}</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{successInfo.email}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                Un email contenant les informations de connexion et un mot de passe temporaire a ete envoye a <strong>{successInfo.email}</strong>.
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Le collaborateur recevra une notification lui demandant de changer son mot de passe des sa premiere connexion.
              </p>
              <DialogFooter>
                <Button onClick={closeAllDialogs} style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}>Termine</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEmployee} onOpenChange={(open) => { if (!open) setEditEmployee(null) }}>
        <DialogContent className="flex max-h-[min(92vh,56rem)] max-w-2xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
            <DialogTitle>Modifier le collaborateur</DialogTitle>
            <DialogDescription>
              Mettez a jour les informations du compte, le role, le manager et la configuration salariale.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {editEmployee && (
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{editEmployee.name}</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{editEmployee.email}</p>
                </div>
              )}

              {editError && (
                <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                  {editError}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nom complet</Label>
                  <Input
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adresse email</Label>
                  <Input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <Label>Numero de telephone</Label>
                  <Input
                    placeholder="ex : +216 XX XXX XXX"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label>Role</Label>
                  <Select
                    value={editFormData.role}
                    onValueChange={(value) =>
                      setEditFormData((current) => {
                        const currentGrade = salaryGrades.find((grade) => grade.id === current.salaryGradeId)
                        return {
                          ...current,
                          role: value,
                          managerId: value === 'COLLABORATEUR' ? current.managerId : '',
                          salaryGradeId: currentGrade && currentGrade.role !== value ? null : current.salaryGradeId,
                        }
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COLLABORATEUR">Collaborateur</SelectItem>
                      <SelectItem value="CHEF">Chef</SelectItem>
                      <SelectItem value="RH">RH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label>Departement</Label>
                  <Input
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date d&apos;embauche</Label>
                  <Input
                    type="date"
                    value={editFormData.hireDate}
                    onChange={(e) => setEditFormData({ ...editFormData, hireDate: e.target.value })}
                    max={hireDateMax}
                    required
                  />
                  {isFutureDateInputValue(editFormData.hireDate) && (
                    <p className="text-sm" style={{ color: '#991B1B' }}>
                      La date d&apos;embauche ne peut pas etre dans le futur.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Poste</Label>
                  <Input
                    value={editFormData.position}
                    onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="space-y-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Configuration salariale</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Selectionnez un grade salarial et definissez un override individuel si necessaire.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Grade salarial</Label>
                    <Select
                      value={editFormData.salaryGradeId || ''}
                      onValueChange={(value) =>
                        setEditFormData((current) => ({
                          ...current,
                          salaryGradeId: value || null,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectionner un grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredEditSalaryGrades.length === 0 ? (
                          <div className="px-2 py-2 text-sm text-muted-foreground">
                            {editFormData.role
                              ? 'Aucun grade disponible pour ce role'
                              : 'Selectionnez d abord un role'}
                          </div>
                        ) : (
                          filteredEditSalaryGrades.map((grade) => (
                            <SelectItem key={grade.id} value={grade.id}>
                              {salaryGradeLabel(grade)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Salaire individuel (override)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="ex : 4200"
                      value={editFormData.salaryOverride ?? ''}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        salaryOverride: e.target.value ? parseFloat(e.target.value) : null,
                      })}
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-muted/30 p-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Grade actif : <span style={{ color: 'var(--color-text)' }}>{salaryGradeLabel(selectedEditGrade ?? undefined)}</span>
                </div>
              </div>

              {editFormData.role === 'COLLABORATEUR' && (
                <div className="space-y-2">
                  <Label>Chef (manager)</Label>
                  <Select
                    value={editFormData.managerId}
                    onValueChange={(value) => setEditFormData({ ...editFormData, managerId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un chef" />
                    </SelectTrigger>
                    <SelectContent>
                      {chefs.filter((chef) => chef.id !== editEmployee?.id).map((chef) => (
                        <SelectItem key={chef.id} value={chef.id}>
                          {chef.name} - {chef.department || 'N/A'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Securite du compte</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Genere un nouveau mot de passe temporaire et notifie le collaborateur par e-mail.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    style={{ color: '#92400E' }}
                    onClick={handleResetPassword}
                    disabled={isSubmitting}
                  >
                    <KeyRound className="h-4 w-4" />
                    Reinitialiser le mot de passe
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setEditEmployee(null)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}>
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteEmployee} onOpenChange={(open) => { if (!open) setDeleteEmployee(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ color: '#EF4444' }}>Supprimer le collaborateur</DialogTitle>
            <DialogDescription>
              Etes-vous sur de vouloir supprimer <strong>{deleteEmployee?.name}</strong> ? Cette action est irreversible et supprimera toutes ses demandes et notifications.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteEmployee(null)} disabled={isDeleting}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetInfo} onOpenChange={(open) => { if (!open) setResetInfo(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: '#10B981' }} />
              Mot de passe reinitialise
            </DialogTitle>
          </DialogHeader>
          {resetInfo && (
            <div className="space-y-4">
              <div className="rounded-lg p-4" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                <p className="font-medium">{resetInfo.message}</p>
              </div>
              <DialogFooter>
                <Button onClick={() => setResetInfo(null)} style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}>OK</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
