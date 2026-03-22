'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
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
import { Checkbox } from '@/components/ui/checkbox'
import { User, UserPlus, Copy, CheckCircle2, Pencil, Trash2, KeyRound } from 'lucide-react'
import { BrandedLoading } from '@/components/ui/spinner'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  position: string | null
  managerId: string | null
  onLeave: boolean
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
  const [isLoading, setIsLoading] = useState(true)

  // Add dialog
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successInfo, setSuccessInfo] = useState<{ name: string; email: string; message: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Edit dialog
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [editError, setEditError] = useState('')

  // Delete dialog
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Password reset result
  const [resetInfo, setResetInfo] = useState<{ name: string; tempPassword: string } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    department: '',
    position: '',
    managerId: '',
    subordinateIds: [] as string[],
  })

  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: '',
    department: '',
    position: '',
    managerId: '',
  })

  const loadEmployees = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/employees')
      if (res.ok) {
        const data = await res.json()
        setEmployees(Array.isArray(data) ? data : [data])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadEmployees()
  }, [user])

  if (!user || user.role !== 'RH') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Accès refusé. Cette page est réservée aux administrateurs RH.</p>
      </div>
    )
  }

  const chefs = employees.filter(e => e.role === 'CHEF')

  // ── CREATE ───────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name || !formData.email || !formData.role) {
      setError("Le nom, l'email et le rôle sont obligatoires")
      return
    }

    try {
      setIsSubmitting(true)
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur lors de la création'); return }

      setSuccessInfo({ name: data.name, email: data.email, message: data.message })
      setFormData({ name: '', email: '', role: '', department: '', position: '', managerId: '', subordinateIds: [] })
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
      role: emp.role,
      department: emp.department || '',
      position: emp.position || '',
      managerId: emp.managerId || '',
    })
    setEditError('')
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editEmployee) return
    setEditError('')

    try {
      setIsSubmitting(true)
      const res = await fetch(`/api/employees/${editEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
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
      if (res.ok && data.tempPassword) {
        setEditEmployee(null)
        setResetInfo({ name: data.name, tempPassword: data.tempPassword })
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
  const handleCopyPassword = (pw: string) => {
    navigator.clipboard.writeText(pw)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const closeAllDialogs = () => {
    setShowAddDialog(false)
    setSuccessInfo(null)
    setEditEmployee(null)
    setDeleteEmployee(null)
    setResetInfo(null)
    setError('')
    setEditError('')
    setCopied(false)
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

      {isLoading ? (
        <div className="text-center py-12"><BrandedLoading /></div>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
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
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.email}</TableCell>
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
      <Dialog open={showAddDialog && !successInfo} onOpenChange={(open) => { if (!open) closeAllDialogs() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un collaborateur</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer un nouveau compte. Un mot de passe temporaire sera généré automatiquement.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{error}</div>}
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input placeholder="ex: Jean Dupont" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Adresse email *</Label>
              <Input type="email" placeholder="ex: jean.dupont@company.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rôle *</Label>
                <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COLLABORATEUR">Collaborateur</SelectItem>
                    <SelectItem value="CHEF">Chef</SelectItem>
                    <SelectItem value="RH">RH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Département</Label>
                <Input placeholder="ex: Engineering" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Poste</Label>
              <Input placeholder="ex: Développeur Full-Stack" value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} />
            </div>
            {(formData.role === 'COLLABORATEUR' || formData.role === '') && (
              <div className="space-y-2">
                <Label>Chef (Manager)</Label>
                <Select value={formData.managerId} onValueChange={v => setFormData({ ...formData, managerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un chef" /></SelectTrigger>
                  <SelectContent>
                    {chefs.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.department || 'N/A'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.role === 'CHEF' && (
              <div className="space-y-2">
                <Label>Affecter des collaborateurs (Subordonnés)</Label>
                <div className="rounded-md border p-2 space-y-1 max-h-40 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                  {employees.filter(e => e.role === 'COLLABORATEUR').map(emp => (
                    <div key={emp.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded transition-colors">
                      <Checkbox 
                        id={`sub-${emp.id}`}
                        checked={formData.subordinateIds.includes(emp.id)}
                        onCheckedChange={(checked: boolean) => {
                          const newIds = checked 
                            ? [...formData.subordinateIds, emp.id]
                            : formData.subordinateIds.filter(id => id !== emp.id)
                          setFormData({ ...formData, subordinateIds: newIds })
                        }}
                      />
                      <label htmlFor={`sub-${emp.id}`} className="text-sm font-medium cursor-pointer flex-1">
                        {emp.name} <span className="text-xs text-muted-foreground ml-1">({emp.department || 'N/A'})</span>
                      </label>
                    </div>
                  ))}
                  {employees.filter(e => e.role === 'COLLABORATEUR').length === 0 && (
                    <p className="text-xs text-center py-2 text-muted-foreground">Aucun collaborateur disponible</p>
                  )}
                </div>
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeAllDialogs}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}>
                {isSubmitting ? 'Création...' : 'Créer le compte'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── CREATE SUCCESS ──────────────────────────────────── */}
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
              <Input value={editFormData.name} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Adresse email</Label>
              <Input type="email" value={editFormData.email} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select value={editFormData.role} onValueChange={v => setEditFormData({ ...editFormData, role: v })}>
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
                <Input value={editFormData.department} onChange={e => setEditFormData({ ...editFormData, department: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Poste</Label>
              <Input value={editFormData.position} onChange={e => setEditFormData({ ...editFormData, position: e.target.value })} />
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
              <KeyRound className="h-5 w-5" style={{ color: '#F5A623' }} />
              Mot de passe réinitialisé
            </DialogTitle>
            <DialogDescription>
              Nouveau mot de passe temporaire pour {resetInfo?.name} :
            </DialogDescription>
          </DialogHeader>
          {resetInfo && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded text-sm font-mono" style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}>
                  {resetInfo.tempPassword}
                </code>
                <Button size="sm" variant="outline" onClick={() => handleCopyPassword(resetInfo.tempPassword)} className="gap-1">
                  {copied ? <CheckCircle2 className="h-3 w-3" style={{ color: '#10B981' }} /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copié' : 'Copier'}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setResetInfo(null)} style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}>Terminé</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
