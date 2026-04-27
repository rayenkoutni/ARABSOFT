'use client'

import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  buildHistoryDescription,
  EmployeeSkillHistoryEntry,
  getSkillLevelLabel,
  historyActionLabels,
  skillTypeLabels,
} from '@/lib/skills/client'

interface SkillHistoryDialogProps {
  open: boolean
  employeeName: string
  history: EmployeeSkillHistoryEntry[]
  onOpenChange: (open: boolean) => void
}

export function SkillHistoryDialog({
  open,
  employeeName,
  history,
  onOpenChange,
}: SkillHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[min(90vh,52rem)] overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Historique des competences</DialogTitle>
          <DialogDescription>
            Consultez uniquement l'historique de {employeeName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {history.length === 0 ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Aucun changement de competence enregistre pour ce collaborateur.
            </div>
          ) : (
            history.map((entry, index) => (
              <div key={entry.id} className="space-y-3">
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-0" style={{ backgroundColor: '#F4F6FA', color: '#1E293B' }}>
                          {historyActionLabels[entry.action]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-0"
                          style={entry.skillType === 'SOFT'
                            ? { backgroundColor: '#DBEAFE', color: '#1E40AF' }
                            : { backgroundColor: '#D1FAE5', color: '#065F46' }}
                        >
                          {skillTypeLabels[entry.skillType]}
                        </Badge>
                      </div>
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {buildHistoryDescription(entry)}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        <span>Competence: {entry.skillName}</span>
                        <span>Par: {entry.actor.name}</span>
                        {entry.oldLevel !== null && <span>Ancien niveau: {getSkillLevelLabel(entry.oldLevel)}</span>}
                        {entry.newLevel !== null && <span>Nouveau niveau: {getSkillLevelLabel(entry.newLevel)}</span>}
                      </div>
                      {entry.comment && (
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          {entry.comment}
                        </p>
                      )}
                    </div>
                    <span className="text-sm shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                      {format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </span>
                  </div>
                </div>
                {index < history.length - 1 && <Separator />}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
