'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2 } from 'lucide-react'
import {
  createInitialTechnicalSkillRows,
  hasDuplicateTechnicalSkills,
  skillLevelOptions,
  TechnicalSkillCatalogItem,
  TechnicalSkillFormRow,
} from '@/lib/skills/client'

interface EmployeeOption {
  id: string
  name: string
  role: string
  department: string | null
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

export interface EmployeeCreateFormData {
  name: string
  email: string
  phone: string
  role: string
  department: string
  position: string
  managerId: string
  hireDate: string
  subordinateIds: string[]
  technicalSkills: TechnicalSkillFormRow[]
}

interface EmployeeCreateDialogProps {
  open: boolean
  error: string
  isSubmitting: boolean
  isSkillsLoading: boolean
  formData: EmployeeCreateFormData
  chefs: EmployeeOption[]
  collaborators: EmployeeOption[]
  technicalSkillsCatalog: TechnicalSkillCatalogItem[]
  onOpenChange: (open: boolean) => void
  onSubmit: (e: React.FormEvent) => void
  onFormDataChange: (value: EmployeeCreateFormData) => void
  onAddTechnicalSkill: () => void
  onRemoveTechnicalSkill: (index: number) => void
}

export function getDefaultEmployeeCreateFormData(): EmployeeCreateFormData {
  return {
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    position: '',
    managerId: '',
    hireDate: '',
    subordinateIds: [],
    technicalSkills: createInitialTechnicalSkillRows(),
  }
}

export function EmployeeCreateDialog({
  open,
  error,
  isSubmitting,
  isSkillsLoading,
  formData,
  chefs,
  collaborators,
  technicalSkillsCatalog,
  onOpenChange,
  onSubmit,
  onFormDataChange,
  onAddTechnicalSkill,
  onRemoveTechnicalSkill,
}: EmployeeCreateDialogProps) {
  const selectedTechnicalSkillCount = formData.technicalSkills.filter((skill) => skill.skillId).length
  const hasTechnicalSkillOptions = technicalSkillsCatalog.length > 0
  const maxTechnicalSkillRows = technicalSkillsCatalog.length
  const canAddTechnicalSkill =
    hasTechnicalSkillOptions && formData.technicalSkills.length < maxTechnicalSkillRows
  const hireDateMax = getTodayDateInputMax()
  const hasFutureHireDate = isFutureDateInputValue(formData.hireDate)

  const updateFormData = (updates: Partial<EmployeeCreateFormData>) => {
    onFormDataChange({ ...formData, ...updates })
  }

  const updateTechnicalSkillRow = (index: number, updates: Partial<TechnicalSkillFormRow>) => {
    onFormDataChange({
      ...formData,
      technicalSkills: formData.technicalSkills.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...updates } : row
      ),
    })
  }

  const changeRole = (role: string) => {
    onFormDataChange({
      ...formData,
      role,
      managerId: role === 'COLLABORATEUR' ? formData.managerId : '',
      subordinateIds: role === 'CHEF' ? formData.subordinateIds : [],
      technicalSkills: role === 'COLLABORATEUR' ? formData.technicalSkills : createInitialTechnicalSkillRows(),
    })
  }

  const hasDuplicateSelection =
    formData.role === 'COLLABORATEUR' &&
    hasDuplicateTechnicalSkills(formData.technicalSkills.filter((skill) => skill.skillId))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,56rem)] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Ajouter un collaborateur</DialogTitle>
          <DialogDescription>
            Remplissez les informations pour créer un nouveau compte. Un mot de passe temporaire sera généré automatiquement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input
                placeholder="ex : Jean Dupont"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Adresse e-mail *</Label>
              <Input
                type="email"
                placeholder="ex : jean.dupont@company.com"
                value={formData.email}
                onChange={(e) => updateFormData({ email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Numéro de téléphone</Label>
              <Input
                placeholder="ex : +216 XX XXX XXX"
                value={formData.phone}
                onChange={(e) => updateFormData({ phone: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Rôle *</Label>
                <Select value={formData.role} onValueChange={changeRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COLLABORATEUR">Collaborateur</SelectItem>
                    <SelectItem value="CHEF">Chef</SelectItem>
                    <SelectItem value="RH">RH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Département</Label>
                <Input
                  placeholder="ex : Engineering"
                  value={formData.department}
                  onChange={(e) => updateFormData({ department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date d&apos;embauche *</Label>
                <Input
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => updateFormData({ hireDate: e.target.value })}
                  max={hireDateMax}
                  required
                />
                {hasFutureHireDate && (
                  <p className="text-sm" style={{ color: '#991B1B' }}>
                    La date d&apos;embauche ne peut pas être dans le futur.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Poste</Label>
              <Input
                placeholder="ex : Développeur Full-Stack"
                value={formData.position}
                onChange={(e) => updateFormData({ position: e.target.value })}
              />
            </div>

            {(formData.role === 'COLLABORATEUR' || formData.role === '') && (
              <div className="space-y-2">
                <Label>Chef (manager)</Label>
                <Select value={formData.managerId} onValueChange={(value) => updateFormData({ managerId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un chef" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {chefs.map((chef) => (
                      <SelectItem key={chef.id} value={chef.id}>
                        {chef.name} - {chef.department || 'N/A'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.role === 'COLLABORATEUR' && (
              <div
                className="space-y-4 rounded-xl border p-4"
                style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Compétences techniques</Label>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Sélectionnez au moins 2 compétences techniques. Toutes les compétences comportementales actives seront ajoutées automatiquement par le backend.
                    </p>
                  </div>
                  <Badge
                    className="shrink-0 border-0"
                    style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
                  >
                    {selectedTechnicalSkillCount}/2 minimum
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-3">
                  {formData.technicalSkills.map((row, index) => {
                    const selectedSkillIds = formData.technicalSkills
                      .map((skill) => skill.skillId)
                      .filter((skillId, skillIndex) => skillId && skillIndex !== index)

                    const availableSkills = technicalSkillsCatalog.filter(
                      (skill) => !selectedSkillIds.includes(skill.id) || skill.id === row.skillId
                    )

                    return (
                      <div
                        key={`technical-skill-row-${index}`}
                        className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)_auto] md:items-end"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <div className="min-w-0 space-y-2">
                          <Label>Compétence {index + 1}</Label>
                          <Select
                            value={row.skillId}
                            onValueChange={(value) => updateTechnicalSkillRow(index, { skillId: value })}
                          >
                            <SelectTrigger className="w-full min-w-0">
                              <SelectValue
                                placeholder={
                                  isSkillsLoading
                                    ? 'Chargement des compétences...'
                                    : hasTechnicalSkillOptions
                                      ? 'Sélectionner une compétence'
                                      : 'Aucune compétence technique disponible'
                                }
                              />
                            </SelectTrigger>
                            <SelectContent position="popper" className="max-h-64" sideOffset={6}>
                              {availableSkills.length > 0 ? (
                                availableSkills.map((skill) => (
                                  <SelectItem key={skill.id} value={skill.id}>
                                    {skill.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-2 text-sm text-muted-foreground">
                                  Aucune autre compétence disponible
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="min-w-0 space-y-2">
                          <Label>Niveau</Label>
                          <Select
                            value={String(row.level)}
                            onValueChange={(value) => updateTechnicalSkillRow(index, { level: Number(value) })}
                          >
                            <SelectTrigger className="w-full min-w-0">
                              <SelectValue placeholder="Sélectionner un niveau" />
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

                        <div className="flex justify-end md:pb-0.5">
                          {index >= 2 ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={`Supprimer la compétence ${index + 1}`}
                              onClick={() => onRemoveTechnicalSkill(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <div className="hidden h-9 w-9 md:block" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {hasDuplicateSelection && (
                  <p className="text-sm" style={{ color: '#991B1B' }}>
                    Chaque compétence technique doit être unique dans le formulaire.
                  </p>
                )}

                {!isSkillsLoading && !hasTechnicalSkillOptions && (
                  <p className="text-sm" style={{ color: '#991B1B' }}>
                    Aucune compétence technique active n&apos;est disponible dans le catalogue RH.
                  </p>
                )}

                {canAddTechnicalSkill ? (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 md:w-fit"
                      onClick={onAddTechnicalSkill}
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter une autre compétence
                    </Button>
                  </div>
                ) : hasTechnicalSkillOptions ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Toutes les compétences techniques disponibles sont déjà représentées dans le formulaire.
                  </p>
                ) : null}
              </div>
            )}

            {formData.role === 'CHEF' && (
              <div className="space-y-2">
                <Label>Affecter des collaborateurs (subordonnés)</Label>
                <div
                  className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2"
                  style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                >
                  {collaborators.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center space-x-2 rounded p-1 transition-colors hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`sub-${employee.id}`}
                        checked={formData.subordinateIds.includes(employee.id)}
                        onCheckedChange={(checked: boolean) => {
                          const subordinateIds = checked
                            ? [...formData.subordinateIds, employee.id]
                            : formData.subordinateIds.filter((id) => id !== employee.id)
                          updateFormData({ subordinateIds })
                        }}
                      />
                      <label htmlFor={`sub-${employee.id}`} className="flex-1 cursor-pointer text-sm font-medium">
                        {employee.name}{' '}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({employee.department || 'N/A'})
                        </span>
                      </label>
                    </div>
                  ))}
                  {collaborators.length === 0 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">
                      Aucun collaborateur disponible
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}
            >
              {isSubmitting ? 'Création...' : 'Créer le compte'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
