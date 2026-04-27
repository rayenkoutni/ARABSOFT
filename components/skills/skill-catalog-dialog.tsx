'use client'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SkillCatalogItem, skillTypeLabels } from '@/lib/skills/client'

export interface SkillCatalogFormData {
  name: string
  type: 'SOFT' | 'TECHNICAL'
  isMandatory: boolean
  isActive: boolean
  description: string
}

interface SkillCatalogDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  formData: SkillCatalogFormData
  error: string
  isSubmitting: boolean
  editingSkill?: SkillCatalogItem | null
  onOpenChange: (open: boolean) => void
  onFormDataChange: (value: SkillCatalogFormData) => void
  onSubmit: (e: React.FormEvent) => void
}

export function getDefaultSkillCatalogFormData(): SkillCatalogFormData {
  return {
    name: '',
    type: 'TECHNICAL',
    isMandatory: false,
    isActive: true,
    description: '',
  }
}

export function SkillCatalogDialog({
  open,
  mode,
  formData,
  error,
  isSubmitting,
  editingSkill,
  onOpenChange,
  onFormDataChange,
  onSubmit,
}: SkillCatalogDialogProps) {
  const setField = <K extends keyof SkillCatalogFormData>(key: K, value: SkillCatalogFormData[K]) => {
    onFormDataChange({ ...formData, [key]: value })
  }

  const handleTypeChange = (value: 'SOFT' | 'TECHNICAL') => {
    onFormDataChange({
      ...formData,
      type: value,
      isMandatory: value === 'SOFT',
    })
  }

  const isSoftSkill = formData.type === 'SOFT'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nouvelle compétence' : 'Modifier la compétence'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Les RH gèrent le catalogue global des compétences.'
              : `Mettez à jour ${editingSkill?.name ?? 'la compétence'} sans changer les profils déjà rattachés.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Nom</Label>
            <Input value={formData.name} onChange={(e) => setField('name', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              {mode === 'create' ? (
                <Select value={formData.type} onValueChange={(value: 'SOFT' | 'TECHNICAL') => handleTypeChange(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOFT">{skillTypeLabels.SOFT}</SelectItem>
                    <SelectItem value="TECHNICAL">{skillTypeLabels.TECHNICAL}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div
                  className="flex min-h-10 items-center rounded-md border px-3"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                >
                  <Badge
                    className="border-0"
                    style={
                      formData.type === 'SOFT'
                        ? { backgroundColor: '#DBEAFE', color: '#1E40AF' }
                        : { backgroundColor: '#D1FAE5', color: '#065F46' }
                    }
                  >
                    {skillTypeLabels[formData.type]}
                  </Badge>
                </div>
              )}
              {mode === 'edit' && (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Le type est fige apres la creation. Pour changer de type, supprimez la competence
                  si autorise puis creez-en une nouvelle.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Statut</Label>
              <Select
                value={formData.isActive ? 'ACTIVE' : 'INACTIVE'}
                onValueChange={(value) => setField('isActive', value === 'ACTIVE')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">
                    Inactive
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={4} value={formData.description} onChange={(e) => setField('description', e.target.value)} />
          </div>

          {isSoftSkill && (
            <div className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              Toute compétence comportementale active est obligatoire par définition et sera automatiquement ajoutée aux nouveaux collaborateurs au niveau Intermédiaire. Si elle devient inactive, elle est archivée dans le catalogue et ne peut plus être attribuée dans les nouveaux parcours.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}>
              {isSubmitting ? 'Enregistrement...' : mode === 'create' ? 'Créer la compétence' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
