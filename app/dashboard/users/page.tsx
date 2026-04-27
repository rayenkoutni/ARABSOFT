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

export default function UsersPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [technicalSkillsCatalog, setTechnicalSkillsCatalog] = useState<TechnicalSkillCatalogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSkillsLoading, setIsSkillsLoading] = useState(false)

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)
  }

  const AvatarDisplay = ({ employee }: { employee: Employee }) => {
    if (employee.avatar) {
      return (
        <img 
          src={employee.avatar} 
          alt={employee.name}
          className="w-8 h-8 rounded-full object-cover"
        />
      )
    }
    
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
        {getInitials(employee.name)}
      </div>
    )
  }

  // Add dialog
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [listError, setListError] = useState('')
  const [error, setError] = useState('')
  const [successInfo, setSuccessInfo] = useState<{ name: string; email: string; message: string } | null>(null)

  // Edit dialog
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [editError, setEditError] = useState('')

  // Delete dialog
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Password reset result
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
  })
  const hireDateMax = getTodayDateInputMax()

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
      setListError("Impossible de charger la liste des collaborateurs")
    } catch {
      setEmployees([])
      setListError("Impossible de charger la liste des collaborateurs")
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

  useEffect(() => {
    if (user) {
      loadEmployees()
      loadTechnicalSkillsCatalog()
    }
  }, [user])

  if (!user || user.role !== 'RH') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Accès refusé. Cette page est réservée aux administrateurs RH.</p>
      </div>
    )
  }

  const chefs = employees.filter(e => e.role === 'CHEF')
  const collaborators = employees.filter(e => e.role === 'COLLABORATEUR')

  // ── CREATE ───────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name || !formData.email || !formData.role || !formData.hireDate) {
      setError("Le nom, l'email, le rôle et la date d'embauche sont obligatoires")
      return
    }

    if (isFutureDateInputValue(formData.hireDate)) {
      setError("La date d'embauche ne peut pas être dans le futur")
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
          setError('Une competence technique ne peut etre selectionnee qu une seule fois')
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
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur lors de la création'); return }

      setSuccessInfo({ name: data.name, email: data.email, message: data.message })
      setFormData(getDefaultEmployeeCreateFormData())
      loadEmployees()
    } catch { setError('Erreur de connexion au serveur') }
    finally { setIsSubmitting(false) }
  }

  // ── UPDATE ───────────────────────────────────────────────
  const openEditDialog = (emp: Employee) => {
    setEditEmployee(emp)
    setEditFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      role: emp.role,
      department: emp.department || '',
      position: emp.position || '',
      managerId: emp.managerId || '',
      hireDate: toDateInputValue(emp.hireDate),
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

    if (isFutureDateInputValue(editFormData.hireDate)) {
      setEditError("La date d'embauche ne peut pas être dans le futur")
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
        })
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error || 'Erreur lors de la modification'); return }

      setEditEmployee(null)
      loadEmployees()
    } catch { setEditError('Erreur de connexion au serveur') }
    finally { setIsSubmitting(false) }
  }

  const handleResetPassword = async () => {
    if (!editEmployee) return
    try {
      setIsSubmitting(true)
      const res = await fetch(`/api/employees/${editEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPassword: true })
      })
      const data = await res.json()
      if (res.ok && data.message) {
        setEditEmployee(null)
        setResetInfo({ name: data.name, message: data.message })
      }
    } finally { setIsSubmitting(false) }
  }

  // ── DELETE ───────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteEmployee) return
    try {
      setIsDeleting(true)
      const res = await fetch(`/api/employees/${deleteEmployee.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteEmployee(null)
        loadEmployees()
      }
    } finally { setIsDeleting(false) }
  }

  // ── HELPERS ──────────────────────────────────────────────
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

  const onLeaveCount = employees.filter(e => e.onLeave).length
  const availableCount = employees.filter(e => !e.onLeave).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>Gestion des Collaborateurs</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Gérez tous les utilisateurs du portail RH
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
        <div className="text-center py-12"><BrandedLoading /></div>
      ) : (
        <>
          <Card>
            <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead className="w-12"></TableHead>
                   <TableHead>Nom</TableHead>
                   <TableHead>Email</TableHead>
                   <TableHead>Téléphone</TableHead>
                   <TableHead>Rôle</TableHead>
                   <TableHead>Département</TableHead>
                   <TableHead>Statut</TableHead>
                   <TableHead className="text-right">Actions</TableHead>
                 </TableRow>
               </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const roleColor = roleColors[emp.role] || roleColors.COLLABORATEUR
                  return (
                     <TableRow key={emp.id}>
                       <TableCell>
                         <AvatarDisplay employee={emp} />
                       </TableCell>
                       <TableCell className="font-medium">{emp.name}</TableCell>
                       <TableCell>{emp.email}</TableCell>
                      <TableCell>{emp.phone || '—'}</TableCell>
                      <TableCell>
                        <Badge className="border-0" style={roleColor.style}>
                          {roleLabels[emp.role] || emp.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{emp.department || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          className="border-0"
                          style={emp.onLeave
                            ? { backgroundColor: '#FEF3C7', color: '#92400E' }
                            : { backgroundColor: '#D1FAE5', color: '#065F46' }
                          }
                        >
                          {emp.onLeave ? 'En Congé' : 'Disponible'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(emp)} title="Modifier">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteEmployee(emp)}
                            title="Supprimer"
                            disabled={emp.id === user.id}
                            style={emp.id !== user.id ? { color: '#EF4444' } : {}}
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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(37, 99, 176, 0.1)' }}>
                  <User className="h-4 w-4" style={{ color: 'var(--color-brand-blue)' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total Utilisateurs</p>
                  <p className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{employees.length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
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
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(245, 166, 35, 0.1)' }}>
                  <User className="h-4 w-4" style={{ color: '#F5A623' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>En Congé</p>
                  <p className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{onLeaveCount}</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ─── CREATE DIALOG ─────────────────────────────────── */}
      <EmployeeCreateDialog
        open={showAddDialog && !successInfo}
        error={error}
        isSubmitting={isSubmitting}
        isSkillsLoading={isSkillsLoading}
        formData={formData}
        chefs={chefs}
        collaborators={collaborators}
        technicalSkillsCatalog={technicalSkillsCatalog}
        onOpenChange={(open) => { if (!open) closeAllDialogs() }}
        onSubmit={handleCreate}
        onFormDataChange={setFormData}
        onAddTechnicalSkill={addTechnicalSkill}
        onRemoveTechnicalSkill={removeTechnicalSkill}
      />

      {/* CREATE SUCCESS */}
      <Dialog open={!!successInfo} onOpenChange={(open) => { if (!open) closeAllDialogs() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: '#10B981' }} />
              Compte créé avec succès
            </DialogTitle>
          </DialogHeader>
          {successInfo && (
            <div className="space-y-4">
              <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                    <CheckCircle2 className="h-6 w-6" style={{ color: '#10B981' }} />
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>{successInfo.name}</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{successInfo.email}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                Un email contenant les informations de connexion et un mot de passe temporaire a été envoyé à <strong>{successInfo.email}</strong>.
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Le collaborateur recevra une notification lui demandant de changer son mot de passe dès sa première connexion.
              </p>
              <DialogFooter>
                <Button onClick={closeAllDialogs} style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}>Terminé</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── EDIT DIALOG ───────────────────────────────────── */}
      <Dialog open={!!editEmployee} onOpenChange={(open) => { if (!open) setEditEmployee(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le collaborateur</DialogTitle>
            <DialogDescription>Mettez à jour les informations de {editEmployee?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            {editError && <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{editError}</div>}
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={editFormData.name || ''} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Adresse email</Label>
              <Input type="email" value={editFormData.email || ''} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Numéro de téléphone</Label>
              <Input placeholder="ex: +216 XX XXX XXX" value={editFormData.phone || ''} onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select
                  value={editFormData.role}
                  onValueChange={v =>
                    setEditFormData({
                      ...editFormData,
                      role: v,
                      managerId: v === 'COLLABORATEUR' ? editFormData.managerId : '',
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COLLABORATEUR">Collaborateur</SelectItem>
                    <SelectItem value="CHEF">Chef</SelectItem>
                    <SelectItem value="RH">RH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Département</Label>
                <Input value={editFormData.department || ''} onChange={e => setEditFormData({ ...editFormData, department: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date d&apos;embauche</Label>
              <Input
                type="date"
                value={editFormData.hireDate || ''}
                onChange={e => setEditFormData({ ...editFormData, hireDate: e.target.value })}
                max={hireDateMax}
                required
              />
              {isFutureDateInputValue(editFormData.hireDate) && (
                <p className="text-sm" style={{ color: '#991B1B' }}>
                  La date d&apos;embauche ne peut pas être dans le futur.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Poste</Label>
              <Input value={editFormData.position || ''} onChange={e => setEditFormData({ ...editFormData, position: e.target.value })} />
            </div>
            {editFormData.role === 'COLLABORATEUR' && (
              <div className="space-y-2">
                <Label>Chef (Manager)</Label>
                <Select value={editFormData.managerId} onValueChange={v => setEditFormData({ ...editFormData, managerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un chef" /></SelectTrigger>
                  <SelectContent>
                    {chefs.filter(c => c.id !== editEmployee?.id).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} — {c.department || 'N/A'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Password reset section */}
            <div className="pt-2 border-t">
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
                Réinitialiser le mot de passe
              </Button>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Génère un nouveau mot de passe temporaire</p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditEmployee(null)}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}>
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION DIALOG ─────────────────────── */}
      <Dialog open={!!deleteEmployee} onOpenChange={(open) => { if (!open) setDeleteEmployee(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ color: '#EF4444' }}>Supprimer le collaborateur</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteEmployee?.name}</strong> ? Cette action est irréversible et supprimera toutes ses demandes et notifications.
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

      {/* ─── PASSWORD RESET RESULT ──────────────────────────── */}
      <Dialog open={!!resetInfo} onOpenChange={(open) => { if (!open) setResetInfo(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: '#10B981' }} />
              Mot de passe réinitialisé
            </DialogTitle>
          </DialogHeader>
          {resetInfo && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
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
