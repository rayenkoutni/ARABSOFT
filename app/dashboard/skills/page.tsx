'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { History, Pencil, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib'
import { BrandedLoading } from '@/components/ui/spinner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SkillBadgeList } from '@/components/skills/skill-badge-list'
import { SkillHistoryDialog } from '@/components/skills/skill-history-dialog'
import { SkillManagementDialog } from '@/components/skills/skill-management-dialog'
import {
  getDefaultSkillCatalogFormData,
  SkillCatalogDialog,
  SkillCatalogFormData,
} from '@/components/skills/skill-catalog-dialog'
import {
  EmployeeSkillsListItem,
  EmployeeSkillsProfileResponse,
  getSkillLevelLabel,
  isArchivedAssignedSkill,
  mapEmployeeSkillsListItems,
  mapSkillCatalogItems,
  mapTechnicalSkillCatalogItems,
  SkillCatalogItem,
  skillTypeLabels,
  TechnicalSkillCatalogItem,
} from '@/lib/skills/client'

type ManagerSubmitPayload = {
  changes: Array<
    | { action: 'ADD'; skillId: string; newLevel: number }
    | { action: 'LEVEL_UPDATE'; skillId: string; newLevel: number }
    | { action: 'REMOVE'; skillId: string }
  >
}

function getCatalogSkillDeleteState(skill: SkillCatalogItem) {
  const employeeCount = skill.usage?.employeeCount ?? 0
  const historyCount = skill.usage?.historyCount ?? 0

  if (skill.type === 'TECHNICAL') {
    return {
      canDelete: employeeCount === 0,
      disabledReason:
        employeeCount > 0
          ? 'Cette competence technique est encore attribuee a des collaborateurs.'
          : 'Supprimer cette competence technique',
    }
  }

  return {
    canDelete: historyCount === 0,
    disabledReason:
      historyCount > 0
        ? 'Cette competence comportementale possede deja un historique collaborateur.'
        : 'Supprimer cette competence comportementale',
  }
}

function getDeleteSkillDialogDescription(skill: SkillCatalogItem) {
  if (skill.type === 'TECHNICAL') {
    return (
      <>
        La competence <strong>{skill.name}</strong> sera supprimee definitivement du catalogue.
        Cette action est irreversible et reste disponible uniquement tant que cette competence
        technique n&apos;est attribuee a aucun collaborateur.
      </>
    )
  }

  return (
    <>
      La competence <strong>{skill.name}</strong> sera supprimee definitivement du catalogue.
      Cette action est irreversible. Comme cette competence comportementale ne possede encore
      aucun historique collaborateur, ses rattachements actuels seront aussi retires des profils
      concernes.
    </>
  )
}

export default function SkillsPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<EmployeeSkillsListItem[]>([])
  const [technicalSkillsCatalog, setTechnicalSkillsCatalog] = useState<TechnicalSkillCatalogItem[]>([])
  const [catalogSkills, setCatalogSkills] = useState<SkillCatalogItem[]>([])
  const [selfProfile, setSelfProfile] = useState<EmployeeSkillsProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<EmployeeSkillsProfileResponse | null>(null)
  const [historyEmployee, setHistoryEmployee] = useState<EmployeeSkillsListItem | null>(null)
  const [managerEmployee, setManagerEmployee] = useState<EmployeeSkillsListItem | null>(null)
  const [selfHistoryOpen, setSelfHistoryOpen] = useState(false)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [pageError, setPageError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false)
  const [catalogDialogMode, setCatalogDialogMode] = useState<'create' | 'edit'>('create')
  const [catalogError, setCatalogError] = useState('')
  const [catalogSubmitting, setCatalogSubmitting] = useState(false)
  const [editingSkill, setEditingSkill] = useState<SkillCatalogItem | null>(null)
  const [deleteSkill, setDeleteSkill] = useState<SkillCatalogItem | null>(null)
  const [isDeletingSkill, setIsDeletingSkill] = useState(false)
  const [catalogFormData, setCatalogFormData] = useState<SkillCatalogFormData>(
    getDefaultSkillCatalogFormData()
  )

  const isRH = user?.role === 'RH'
  const isChef = user?.role === 'CHEF'
  const isCollaborateur = user?.role === 'COLLABORATEUR'

  const fetchEmployeeProfile = async (employeeId: string) => {
    const res = await fetch(`/api/employees/${employeeId}/skills`, { cache: 'no-store' })
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Erreur lors du chargement des competences')
    }

    return data as EmployeeSkillsProfileResponse
  }

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      setPageError('')
      const res = await fetch('/api/skills/employees', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setPageError(data.error || 'Erreur lors du chargement des collaborateurs')
        return
      }
      setEmployees(mapEmployeeSkillsListItems(data))
    } catch {
      setPageError('Erreur lors du chargement des collaborateurs')
    } finally {
      setLoading(false)
    }
  }

  const fetchSelfProfile = async () => {
    if (!user) return

    try {
      setLoading(true)
      setPageError('')
      const profile = await fetchEmployeeProfile(user.id)
      setSelfProfile(profile)
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : 'Erreur lors du chargement de vos competences'
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchTechnicalCatalog = async () => {
    try {
      setIsCatalogLoading(true)
      const res = await fetch('/api/skills?type=TECHNICAL', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setPageError(data.error || 'Erreur lors du chargement des competences techniques')
        return
      }
      setTechnicalSkillsCatalog(mapTechnicalSkillCatalogItems(data))
    } catch {
      setPageError('Erreur lors du chargement des competences techniques')
    } finally {
      setIsCatalogLoading(false)
    }
  }

  const fetchCatalogSkills = async () => {
    if (!isRH) return

    try {
      const res = await fetch('/api/skills?includeInactive=true', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setPageError(data.error || 'Erreur lors du chargement du catalogue')
        return
      }
      setCatalogSkills(mapSkillCatalogItems(data))
    } catch {
      setPageError('Erreur lors du chargement du catalogue')
    }
  }

  useEffect(() => {
    if (!user) return

    if (isCollaborateur) {
      void fetchSelfProfile()
      return
    }

    if (!isRH && !isChef) return

    void fetchEmployees()
    void fetchTechnicalCatalog()
    void fetchCatalogSkills()
  }, [user, isRH, isChef, isCollaborateur])

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return employees

    return employees.filter((employee) => {
      const haystack = [
        employee.name,
        employee.department || '',
        employee.position || '',
        ...employee.skills.map((skill) => skill.skill.name),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [employees, searchTerm])

  const filteredCatalogSkills = useMemo(() => {
    const normalizedSearch = catalogSearchTerm.trim().toLowerCase()
    if (!normalizedSearch) return catalogSkills

    return catalogSkills.filter((skill) =>
      [skill.name, skill.description || '', skill.type].join(' ').toLowerCase().includes(normalizedSearch)
    )
  }, [catalogSkills, catalogSearchTerm])

  const selfTechnicalSkills = useMemo(
    () => (selfProfile?.skills ?? []).filter((skill) => skill.skill.type === 'TECHNICAL'),
    [selfProfile]
  )

  const selfSoftSkills = useMemo(
    () => (selfProfile?.skills ?? []).filter((skill) => skill.skill.type === 'SOFT'),
    [selfProfile]
  )

  const openEmployeeProfile = async (
    employee: EmployeeSkillsListItem,
    mode: 'history' | 'manage'
  ) => {
    try {
      setDialogError('')
      setDialogLoading(true)

      const profile = await fetchEmployeeProfile(employee.id)
      setSelectedProfile(profile)

      if (mode === 'history') {
        setHistoryEmployee(employee)
      } else {
        setManagerEmployee(employee)
      }
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : 'Erreur lors du chargement des competences'
      )
    } finally {
      setDialogLoading(false)
    }
  }

  const closeDialogs = () => {
    setSelectedProfile(null)
    setHistoryEmployee(null)
    setManagerEmployee(null)
    setDialogError('')
  }

  const openCatalogCreateDialog = () => {
    setCatalogDialogMode('create')
    setEditingSkill(null)
    setCatalogError('')
    setCatalogFormData(getDefaultSkillCatalogFormData())
    setCatalogDialogOpen(true)
  }

  const openCatalogEditDialog = (skill: SkillCatalogItem) => {
    setCatalogDialogMode('edit')
    setEditingSkill(skill)
    setCatalogError('')
    setCatalogFormData({
      name: skill.name,
      type: skill.type,
      isMandatory: skill.type === 'SOFT',
      isActive: skill.isActive !== false,
      description: skill.description || '',
    })
    setCatalogDialogOpen(true)
  }

  const closeCatalogDialog = () => {
    setCatalogDialogOpen(false)
    setEditingSkill(null)
    setCatalogError('')
    setCatalogFormData(getDefaultSkillCatalogFormData())
  }

  const closeDeleteSkillDialog = () => {
    setDeleteSkill(null)
  }

  const handleCatalogSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setCatalogSubmitting(true)
      setCatalogError('')

      const payload =
        catalogDialogMode === 'create'
          ? {
              name: catalogFormData.name,
              type: catalogFormData.type,
              isMandatory: catalogFormData.type === 'SOFT',
              isActive: catalogFormData.isActive,
              description: catalogFormData.description.trim() || null,
            }
          : {
              name: catalogFormData.name,
              isActive: catalogFormData.isActive,
              description: catalogFormData.description.trim() || null,
            }

      const res = await fetch(
        catalogDialogMode === 'create' ? '/api/skills' : `/api/skills/${editingSkill?.id}`,
        {
          method: catalogDialogMode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setCatalogError(data.error || "Erreur lors de l'enregistrement de la competence")
        return
      }

      closeCatalogDialog()
      await fetchCatalogSkills()
      await fetchTechnicalCatalog()
    } finally {
      setCatalogSubmitting(false)
    }
  }

  const handleCatalogToggleActive = async (skill: SkillCatalogItem, isActive: boolean) => {
    try {
      setPageError('')
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: skill.name,
          isActive,
          description: skill.description || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPageError(data.error || 'Erreur lors de la mise a jour du statut de la competence')
        return
      }

      await fetchCatalogSkills()
      await fetchTechnicalCatalog()
    } catch {
      setPageError('Erreur lors de la mise a jour du statut de la competence')
    }
  }

  const handleCatalogDelete = async () => {
    if (!deleteSkill) return

    try {
      setIsDeletingSkill(true)
      setPageError('')
      const res = await fetch(`/api/skills/${deleteSkill.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        setPageError(data.error || 'Erreur lors de la suppression de la competence')
        return
      }

      closeDeleteSkillDialog()
      await fetchCatalogSkills()
      await fetchTechnicalCatalog()
    } catch {
      setPageError('Erreur lors de la suppression de la competence')
    } finally {
      setIsDeletingSkill(false)
    }
  }

  const handleManagerSubmit = async (payload: ManagerSubmitPayload) => {
    if (!managerEmployee) return

    if (payload.changes.length === 0) {
      setDialogError('Aucun changement detecte')
      return
    }

    try {
      setDialogError('')
      setIsSaving(true)
      const res = await fetch(`/api/employees/${managerEmployee.id}/skills`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setDialogError(data.error || 'Erreur lors de la mise a jour des competences')
        return
      }

      setSelectedProfile(data)
      await fetchEmployees()
      setManagerEmployee(null)
    } finally {
      setIsSaving(false)
    }
  }

  const formatSkillDate = (value?: string) => {
    if (!value) return 'Niveau enregistre'

    return `Mis a jour le ${format(new Date(value), 'dd MMM yyyy', { locale: fr })}`
  }

  const renderReadOnlySkillSection = (
    title: string,
    description: string,
    emptyLabel: string,
    skills: EmployeeSkillsProfileResponse['skills'],
    tone: 'SOFT' | 'TECHNICAL'
  ) => (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {skills.length === 0 ? (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.id}
              className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {skill.skill.name}
                  </p>
                  <Badge
                    variant="outline"
                    className="border-0"
                    style={
                      tone === 'SOFT'
                        ? { backgroundColor: '#DBEAFE', color: '#1E40AF' }
                        : { backgroundColor: '#D1FAE5', color: '#065F46' }
                    }
                  >
                    {skillTypeLabels[skill.skill.type]}
                  </Badge>
                  {isArchivedAssignedSkill(skill.skill) && (
                    <Badge
                      variant="outline"
                      className="border-0"
                      style={{ backgroundColor: '#F4F6FA', color: '#475569' }}
                    >
                      Archivee
                    </Badge>
                  )}
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Niveau actuel : {getSkillLevelLabel(skill.level)}
                </p>
              </div>
              <p className="text-sm sm:text-right" style={{ color: 'var(--color-text-muted)' }}>
                {formatSkillDate(skill.updatedAt)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )

  if (!user || (!isRH && !isChef && !isCollaborateur)) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          Cette page est reservee aux RH, aux managers et aux collaborateurs.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <BrandedLoading />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            className="text-3xl font-bold"
            style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}
          >
            Competences
          </h1>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {isRH
              ? 'Les RH pilotent le catalogue global et consultent les historiques des competences.'
              : isChef
                ? 'Gerez directement les competences officielles de votre equipe et consultez leur historique.'
                : 'Consultez vos competences actuelles et leur historique, en lecture seule.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCollaborateur ? (
            <>
              <Badge className="border-0" style={{ backgroundColor: '#F4F6FA', color: '#1E293B' }}>
                {selfTechnicalSkills.length} competence
                {selfTechnicalSkills.length > 1 ? 's' : ''} technique
                {selfTechnicalSkills.length > 1 ? 's' : ''}
              </Badge>
              <Badge className="border-0" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                {selfSoftSkills.length} competence
                {selfSoftSkills.length > 1 ? 's' : ''} comportementale
                {selfSoftSkills.length > 1 ? 's' : ''}
              </Badge>
              <Badge className="border-0" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                Vue collaborateur
              </Badge>
            </>
          ) : (
            <>
              <Badge className="border-0" style={{ backgroundColor: '#F4F6FA', color: '#1E293B' }}>
                {filteredEmployees.length} collaborateur{filteredEmployees.length > 1 ? 's' : ''}
              </Badge>
              <Badge
                className="border-0"
                style={{
                  backgroundColor: isRH ? '#DBEAFE' : '#D1FAE5',
                  color: isRH ? '#1E40AF' : '#065F46',
                }}
              >
                {isRH ? 'Vue RH' : 'Vue manager'}
              </Badge>
            </>
          )}
        </div>
      </div>

      {pageError && (
        <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
          {pageError}
        </div>
      )}

      {isCollaborateur ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
          <div className="space-y-4">
            {renderReadOnlySkillSection(
              'Competences techniques',
              'Retrouvez vos competences techniques actuelles et leur niveau officiel.',
              'Aucune competence technique enregistree.',
              selfTechnicalSkills,
              'TECHNICAL'
            )}

            {renderReadOnlySkillSection(
              'Competences comportementales',
              'Consultez les competences comportementales obligatoires rattachees a votre profil.',
              'Aucune competence comportementale enregistree.',
              selfSoftSkills,
              'SOFT'
            )}
          </div>

          <Card className="h-fit">
            <CardHeader className="border-b">
              <CardTitle>Historique des competences</CardTitle>
              <CardDescription>
                Consultez les ajouts, mises a jour et suppressions enregistres sur votre profil.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {selfProfile?.history.length
                    ? `${selfProfile.history.length} evenement${selfProfile.history.length > 1 ? 's' : ''} disponible${selfProfile.history.length > 1 ? 's' : ''}.`
                    : 'Aucun changement enregistre pour le moment.'}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setSelfHistoryOpen(true)}
              >
                <History className="h-4 w-4" />
                Voir l'historique des competences
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Tabs defaultValue="employees" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger className="h-9 flex-none px-4" value="employees">
              Collaborateurs
            </TabsTrigger>
            {isRH && (
              <TabsTrigger className="h-9 flex-none px-4" value="catalog">
                Catalogue RH
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="employees" className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Sparkles
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <Input
                  className="pl-10"
                  placeholder="Rechercher un collaborateur, un departement ou une competence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collaborateur</TableHead>
                    <TableHead>Departement</TableHead>
                    <TableHead>Competences actuelles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{employee.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {employee.position || 'Poste non renseigne'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>{employee.department || 'Non renseigne'}</p>
                          {employee.manager?.name && (
                            <p className="text-sm text-muted-foreground">Chef : {employee.manager.name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xl">
                        <SkillBadgeList skills={employee.skills} />
                      </TableCell>
                      <TableCell className="text-right">
                        {isRH ? (
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => openEmployeeProfile(employee, 'history')}
                          >
                            <History className="h-4 w-4" />
                            Voir l'historique des competences
                          </Button>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              className="gap-2"
                              onClick={() => openEmployeeProfile(employee, 'history')}
                            >
                              <History className="h-4 w-4" />
                              Historique
                            </Button>
                            <Button
                              className="gap-2"
                              style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}
                              onClick={() => openEmployeeProfile(employee, 'manage')}
                            >
                              <Settings2 className="h-4 w-4" />
                              Gerer les competences
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                        Aucun collaborateur ne correspond a votre recherche.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {isRH && (
            <TabsContent value="catalog" className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                  <Sparkles
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: 'var(--color-text-muted)' }}
                  />
                  <Input
                    className="pl-10"
                    placeholder="Rechercher une competence du catalogue..."
                    value={catalogSearchTerm}
                    onChange={(e) => setCatalogSearchTerm(e.target.value)}
                  />
                </div>
                <Button
                  className="gap-2"
                  style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}
                  onClick={openCatalogCreateDialog}
                >
                  <Plus className="h-4 w-4" />
                  Nouvelle competence
                </Button>
              </div>

              <Card>
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[18%]">Nom</TableHead>
                      <TableHead className="w-[12%]">Type</TableHead>
                      <TableHead className="w-[12%]">Statut</TableHead>
                      <TableHead className="w-[28%]">Description</TableHead>
                      <TableHead className="w-[12%]">Mise a jour</TableHead>
                      <TableHead className="w-[18%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCatalogSkills.map((skill) => {
                      const deleteState = getCatalogSkillDeleteState(skill)
                      const isInactive = skill.isActive === false
                      const toggleLabel = isInactive ? 'Reactiver' : 'Desactiver'
                      const toggleButtonStyle = isInactive
                        ? { borderColor: '#BBF7D0', color: '#166534' }
                        : { borderColor: '#FDE68A', color: '#92400E' }

                      return (
                        <TableRow key={skill.id}>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              <p className="break-words font-medium">{skill.name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge
                              className="border-0"
                              style={
                                skill.type === 'SOFT'
                                  ? { backgroundColor: '#DBEAFE', color: '#1E40AF' }
                                  : { backgroundColor: '#D1FAE5', color: '#065F46' }
                              }
                            >
                              {skillTypeLabels[skill.type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge
                              className="border-0"
                              style={
                                skill.isActive === false
                                  ? { backgroundColor: '#FEE2E2', color: '#991B1B' }
                                  : { backgroundColor: '#D1FAE5', color: '#065F46' }
                              }
                            >
                              {skill.isActive === false ? 'Inactive' : 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md align-top">
                            <span className="block whitespace-normal break-words text-sm leading-5 text-muted-foreground">
                              {skill.description || 'Aucune description'}
                            </span>
                          </TableCell>
                          <TableCell className="align-top text-sm text-muted-foreground">
                            {format(new Date(skill.updatedAt || new Date()), 'dd MMM yyyy', {
                              locale: fr,
                            })}
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                variant="outline"
                                className="gap-2 whitespace-nowrap"
                                onClick={() => openCatalogEditDialog(skill)}
                              >
                                <Pencil className="h-4 w-4" />
                                Modifier
                              </Button>
                              <Button
                                variant="outline"
                                className="gap-2 whitespace-nowrap"
                                disabled={!deleteState.canDelete}
                                title={deleteState.disabledReason}
                                onClick={() => setDeleteSkill(skill)}
                                style={
                                  deleteState.canDelete
                                    ? { borderColor: '#FECACA', color: '#B91C1C' }
                                    : undefined
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                                Supprimer
                              </Button>
                              <Button
                                variant="outline"
                                className="whitespace-nowrap"
                                title={
                                  isInactive
                                    ? 'Reactiver cette competence dans le catalogue'
                                    : 'Desactiver cette competence dans le catalogue'
                                }
                                onClick={() =>
                                  handleCatalogToggleActive(skill, isInactive ? true : false)
                                }
                                style={toggleButtonStyle}
                              >
                                {toggleLabel}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {filteredCatalogSkills.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          Aucune competence ne correspond a votre recherche.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}

      {historyEmployee && selectedProfile && (
        <SkillHistoryDialog
          open={!!historyEmployee}
          employeeName={historyEmployee.name}
          history={selectedProfile.history}
          onOpenChange={(open) => {
            if (!open) closeDialogs()
          }}
        />
      )}

      {managerEmployee && selectedProfile && (
        <SkillManagementDialog
          open={!!managerEmployee}
          employeeName={managerEmployee.name}
          currentSkills={selectedProfile.skills}
          technicalSkillsCatalog={technicalSkillsCatalog}
          isSubmitting={isSaving || isCatalogLoading || dialogLoading}
          error={dialogError}
          onOpenChange={(open) => {
            if (!open) closeDialogs()
          }}
          onSubmit={handleManagerSubmit}
        />
      )}

      {selfProfile && (
        <SkillHistoryDialog
          open={selfHistoryOpen}
          employeeName={user.name}
          history={selfProfile.history}
          onOpenChange={setSelfHistoryOpen}
        />
      )}

      {isRH && (
        <SkillCatalogDialog
          open={catalogDialogOpen}
          mode={catalogDialogMode}
          formData={catalogFormData}
          error={catalogError}
          isSubmitting={catalogSubmitting}
          editingSkill={editingSkill}
          onOpenChange={(open) => {
            if (!open) closeCatalogDialog()
          }}
          onFormDataChange={setCatalogFormData}
          onSubmit={handleCatalogSubmit}
        />
      )}

      {isRH && deleteSkill && (
        <AlertDialog
          open={!!deleteSkill}
          onOpenChange={(open) => {
            if (!open) closeDeleteSkillDialog()
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la competence</AlertDialogTitle>
              <AlertDialogDescription>{getDeleteSkillDialogDescription(deleteSkill)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingSkill}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeletingSkill}
                onClick={handleCatalogDelete}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isDeletingSkill ? 'Suppression...' : 'Confirmer la suppression'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {dialogLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <BrandedLoading />
          </div>
        </div>
      )}
    </div>
  )
}
