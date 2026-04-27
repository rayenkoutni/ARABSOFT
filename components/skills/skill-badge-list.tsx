'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  EmployeeSkillsListItem,
  getSkillLevelLabel,
  isArchivedAssignedSkill,
} from '@/lib/skills/client'

interface SkillBadgeListProps {
  skills: EmployeeSkillsListItem['skills']
  className?: string
}

export function SkillBadgeList({ skills, className }: SkillBadgeListProps) {
  if (skills.length === 0) {
    return <span className="text-sm text-muted-foreground">Aucune competence</span>
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {skills.map((employeeSkill) => (
        <div key={employeeSkill.id} className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="border-0"
            style={
              employeeSkill.skill.type === 'SOFT'
                ? { backgroundColor: '#DBEAFE', color: '#1E40AF' }
                : { backgroundColor: '#D1FAE5', color: '#065F46' }
            }
          >
            {employeeSkill.skill.name} · {getSkillLevelLabel(employeeSkill.level)}
          </Badge>
          {isArchivedAssignedSkill(employeeSkill.skill) && (
            <Badge
              variant="outline"
              className="border-0"
              style={{ backgroundColor: '#F4F6FA', color: '#475569' }}
            >
              Archivee
            </Badge>
          )}
        </div>
      ))}
    </div>
  )
}
