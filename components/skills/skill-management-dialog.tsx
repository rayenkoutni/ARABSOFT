'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  createEmptyTechnicalSkillRow,
  EmployeeSkillProfileItem,
  hasDuplicateTechnicalSkills,
  isArchivedAssignedSkill,
  skillLevelOptions,
  TechnicalSkillCatalogItem,
  TechnicalSkillFormRow,
} from '@/lib/skills/client'
import { MIN_TECHNICAL_SKILLS_PER_COLLABORATOR } from '@/lib/skills/constants'

type SkillManagementChange =
  | { action: 'ADD'; skillId: string; newLevel: number }
  | { action: 'LEVEL_UPDATE'; skillId: string; newLevel: number }
  | { action: 'REMOVE'; skillId: string }

type EditableSkillRow = {
  skillId: string
  level: number
  originalLevel: number
  skill: EmployeeSkillProfileItem['skill']
  markedForRemoval: boolean
}

interface SkillManagementDialogProps {
  open: boolean
  employeeName: string
  currentSkills: EmployeeSkillProfileItem[]
  technicalSkillsCatalog: TechnicalSkillCatalogItem[]
  isSubmitting: boolean
  error: string
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { changes: SkillManagementChange[] }) => Promise<void>
}

export function SkillManagementDialog({
  open,
  employeeName,
  currentSkills,
  technicalSkillsCatalog,
  isSubmitting,
  error,
  onOpenChange,
  onSubmit,
}: SkillManagementDialogProps) {
  const [editableSkills, setEditableSkills] = useState<EditableSkillRow[]>([])
  const [newTechnicalSkills, setNewTechnicalSkills] = useState<TechnicalSkillFormRow[]>([])
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!open) return

    setLocalError('')
    setEditableSkills(
      currentSkills.map((skill) => ({
        skillId: skill.skillId,
        level: skill.level,
        originalLevel: skill.level,
        skill: skill.skill,
        markedForRemoval: false,
      }))
    )
    setNewTechnicalSkills([createEmptyTechnicalSkillRow()])
  }, [open, currentSkills])

  const allExistingSkillIds = useMemo(
    () => editableSkills.map((skill) => skill.skillId),
    [editableSkills]
  )

  const existingTechnicalSkillIds = useMemo(
    () =>
      editableSkills
        .filter((skill) => skill.skill.type === 'TECHNICAL')
        .map((skill) => skill.skillId),
    [editableSkills]
  )

  const duplicateNewSelection = hasDuplicateTechnicalSkills(
    newTechnicalSkills.filter((skill) => skill.skillId)
  )

  const pendingNewTechnicalSkillIds = useMemo(() => {
    if (duplicateNewSelection) {
      return []
    }

    const selectedSkillIds = newTechnicalSkills
      .map((skill) => skill.skillId)
      .filter((skillId): skillId is string => Boolean(skillId))

    return Array.from(
      new Set(selectedSkillIds.filter((skillId) => !allExistingSkillIds.includes(skillId)))
    )
  }, [allExistingSkillIds, duplicateNewSelection, newTechnicalSkills])

  const plannedTechnicalSkillCount = useMemo(
    () =>
      editableSkills.filter(
        (skill) => skill.skill.type === 'TECHNICAL' && !skill.markedForRemoval
      ).length + pendingNewTechnicalSkillIds.length,
    [editableSkills, pendingNewTechnicalSkillIds]
  )

  const availableAdditionalSkills = useMemo(
    () =>
      technicalSkillsCatalog.filter((skill) => !existingTechnicalSkillIds.includes(skill.id)),
    [existingTechnicalSkillIds, technicalSkillsCatalog]
  )

  const canAddTechnicalSkill = availableAdditionalSkills.length > newTechnicalSkills.length
  const displayedError = error || localError

  const updateEditableSkillLevel = (skillId: string, level: number) => {
    setLocalError('')
    setEditableSkills((current) =>
      current.map((skill) => (skill.skillId === skillId ? { ...skill, level } : skill))
    )
  }

  const updateNewTechnicalSkill = (index: number, updates: Partial<TechnicalSkillFormRow>) => {
    setLocalError('')
    setNewTechnicalSkills((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row))
    )
  }

  const addTechnicalSkillRow = () => {
    setLocalError('')
    setNewTechnicalSkills((current) => [...current, createEmptyTechnicalSkillRow()])
  }

  const toggleSkillRemoval = (skillId: string) => {
    const targetSkill = editableSkills.find((skill) => skill.skillId === skillId)
    if (!targetSkill || targetSkill.skill.type !== 'TECHNICAL') {
      return
    }

    if (
      !targetSkill.markedForRemoval &&
      plannedTechnicalSkillCount - 1 < MIN_TECHNICAL_SKILLS_PER_COLLABORATOR
    ) {
      setLocalError(
        `Le collaborateur doit conserver au moins ${MIN_TECHNICAL_SKILLS_PER_COLLABORATOR} competences techniques.`
      )
      return
    }

    setLocalError('')
    setEditableSkills((current) =>
      current.map((skill) =>
        skill.skillId === skillId
          ? { ...skill, markedForRemoval: !skill.markedForRemoval }
          : skill
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (duplicateNewSelection) {
      setLocalError('Chaque competence technique ajoutee doit etre unique.')
      return
    }

    if (plannedTechnicalSkillCount < MIN_TECHNICAL_SKILLS_PER_COLLABORATOR) {
      setLocalError(
        `Le collaborateur doit conserver au moins ${MIN_TECHNICAL_SKILLS_PER_COLLABORATOR} competences techniques.`
      )
      return
    }

    const changes: SkillManagementChange[] = []

    editableSkills.forEach((skill) => {
      if (skill.markedForRemoval) {
        changes.push({
          action: 'REMOVE',
          skillId: skill.skillId,
        })
        return
      }

      if (skill.level !== skill.originalLevel) {
        changes.push({
          action: 'LEVEL_UPDATE',
          skillId: skill.skillId,
          newLevel: skill.level,
        })
      }
    })

    newTechnicalSkills
      .filter((skill) => skill.skillId)
      .forEach((skill) => {
        if (!allExistingSkillIds.includes(skill.skillId)) {
          changes.push({
            action: 'ADD',
            skillId: skill.skillId,
            newLevel: skill.level,
          })
        }
      })

    await onSubmit({ changes })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,56rem)] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Gerer les competences</DialogTitle>
          <DialogDescription>
            Mettez a jour directement le profil officiel de {employeeName}. Les changements
            seront enregistres dans l&apos;historique.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {displayedError && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
              >
                {displayedError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>
                  Competences actuelles
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Les competences comportementales restent obligatoires. Une competence technique
                  peut etre retiree seulement si le collaborateur conserve au moins{' '}
                  {MIN_TECHNICAL_SKILLS_PER_COLLABORATOR} competences techniques apres
                  enregistrement. Les competences archivees restent visibles mais deviennent en
                  lecture seule.
                </p>
              </div>

              <div className="space-y-3">
                {editableSkills.map((skill) => {
                  const isArchived = isArchivedAssignedSkill(skill.skill)
                  const isLevelDirty = skill.level !== skill.originalLevel
                  const showDirtyState = isLevelDirty && !skill.markedForRemoval && !isArchived

                  return (
                    <div
                      key={skill.skillId}
                      className="space-y-3 rounded-lg border p-3"
                      style={{
                        borderColor: skill.markedForRemoval
                          ? '#FED7AA'
                          : isArchived
                            ? '#CBD5E1'
                          : showDirtyState
                            ? '#93C5FD'
                            : 'var(--color-border)',
                        backgroundColor: skill.markedForRemoval
                          ? '#FFF7ED'
                          : isArchived
                            ? '#F8FAFC'
                          : showDirtyState
                            ? '#F8FBFF'
                            : 'transparent',
                      }}
                    >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_12rem] md:items-start">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Label>{skill.skill.name}</Label>
                          {isArchived && (
                            <Badge
                              variant="outline"
                              className="border-0"
                              style={{ backgroundColor: '#F4F6FA', color: '#475569' }}
                            >
                              Archivee
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          {skill.skill.type === 'SOFT'
                            ? 'Competence comportementale'
                            : 'Competence technique'}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Niveau</Label>
                        <Select
                          value={String(skill.level)}
                          disabled={skill.markedForRemoval || isArchived}
                          onValueChange={(value) =>
                            updateEditableSkillLevel(skill.skillId, Number(value))
                          }
                        >
                          <SelectTrigger
                            className="w-full"
                            style={
                              showDirtyState
                                ? {
                                    borderColor: '#93C5FD',
                                    backgroundColor: '#EFF6FF',
                                    boxShadow: '0 0 0 1px #BFDBFE',
                                  }
                                : undefined
                            }
                          >
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

                    {skill.markedForRemoval && (
                      <div
                        className="rounded-md border px-3 py-2 text-sm leading-5"
                        style={{
                          borderColor: '#FED7AA',
                          backgroundColor: '#FFF7ED',
                          color: '#9A3412',
                        }}
                      >
                        Cette competence technique sera supprimee lors de l&apos;enregistrement.
                      </div>
                    )}

                    {isArchived && (
                      <div
                        className="rounded-md border px-3 py-2 text-sm leading-5"
                        style={{
                          borderColor: '#CBD5E1',
                          backgroundColor: '#F8FAFC',
                          color: '#475569',
                        }}
                      >
                        Cette competence est archivee dans le catalogue. Elle reste visible sur le
                        profil mais ne peut plus etre modifiee depuis cette interface.
                      </div>
                    )}

                    {skill.skill.type === 'TECHNICAL' && !isArchived && (
                      <div className="flex justify-end border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 whitespace-nowrap"
                          onClick={() => toggleSkillRemoval(skill.skillId)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {skill.markedForRemoval ? 'Annuler la suppression' : 'Retirer'}
                        </Button>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>
                  Ajouter des competences techniques
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Ajoutez de nouvelles competences techniques sans dupliquer une competence deja
                  presente dans le profil.
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Total technique prevu apres enregistrement : {plannedTechnicalSkillCount}
                </p>
              </div>

              <div className="space-y-3">
                {newTechnicalSkills.map((row, index) => {
                  const unavailableSkillIds = [
                    ...allExistingSkillIds,
                    ...newTechnicalSkills
                      .map((skill) => skill.skillId)
                      .filter((skillId, skillIndex) => skillId && skillIndex !== index),
                  ]

                  const availableSkills = technicalSkillsCatalog.filter(
                    (skill) => !unavailableSkillIds.includes(skill.id) || skill.id === row.skillId
                  )

                  return (
                    <div
                      key={`new-skill-${index}`}
                      className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_13rem]"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="min-w-0 space-y-2">
                        <Label>Nouvelle competence {index + 1}</Label>
                        <Select
                          value={row.skillId}
                          onValueChange={(value) =>
                            updateNewTechnicalSkill(index, { skillId: value })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selectionner une competence technique" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="max-h-64" sideOffset={6}>
                            {availableSkills.map((skill) => (
                              <SelectItem key={skill.id} value={skill.id}>
                                {skill.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Niveau</Label>
                        <Select
                          value={String(row.level)}
                          onValueChange={(value) =>
                            updateNewTechnicalSkill(index, { level: Number(value) })
                          }
                        >
                          <SelectTrigger className="w-full">
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
                  )
                })}
              </div>

              {duplicateNewSelection && (
                <p className="text-sm" style={{ color: '#991B1B' }}>
                  Chaque competence technique ajoutee doit etre unique.
                </p>
              )}

              {canAddTechnicalSkill ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 md:w-fit"
                  onClick={addTechnicalSkillRow}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une autre competence
                </Button>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Aucune autre competence technique active n&apos;est disponible dans le catalogue.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 z-10 shrink-0 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
