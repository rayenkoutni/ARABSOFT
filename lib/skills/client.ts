export type SkillType = 'SOFT' | 'TECHNICAL'
export type EmployeeSkillHistoryAction = 'ADD' | 'LEVEL_UPDATE' | 'REMOVE'

export interface TechnicalSkillCatalogItem {
  id: string
  name: string
  type?: SkillType
  description?: string | null
  isActive?: boolean
}

export interface SkillCatalogItem {
  id: string
  name: string
  type: SkillType
  isMandatory?: boolean
  isActive?: boolean
  description?: string | null
  createdAt?: string
  updatedAt?: string
  usage?: {
    employeeCount: number
    historyCount: number
    positionCount: number
    isInUse: boolean
  }
}

export interface EmployeeSkillFormRow {
  id?: string
  skillId: string
  level: number
  skill?: SkillCatalogItem
}

export interface TechnicalSkillFormRow {
  skillId: string
  level: number
}

export interface EmployeeSkillProfileItem {
  id: string
  employeeId: string
  skillId: string
  level: number
  createdAt?: string
  updatedAt?: string
  skill: SkillCatalogItem
}

export interface EmployeeSkillHistoryEntry {
  id: string
  employeeId: string
  skillId: string | null
  skillName: string
  skillType: SkillType
  action: EmployeeSkillHistoryAction
  oldLevel: number | null
  newLevel: number | null
  comment?: string | null
  createdAt: string
  actor: {
    id: string
    name: string
    role: string
  }
}

export interface EmployeeSkillsProfileResponse {
  skills: EmployeeSkillProfileItem[]
  history: EmployeeSkillHistoryEntry[]
}

export interface EmployeeSkillsListItem {
  id: string
  name: string
  department: string | null
  position: string | null
  managerId: string | null
  manager?: {
    id: string
    name: string
  } | null
  skills: Array<{
    id: string
    level: number
    updatedAt?: string
      skill: {
        id: string
        name: string
        type: SkillType
        isMandatory: boolean
        isActive?: boolean
      }
    }>
}

export const skillLevelOptions = [
  { value: 1, label: 'Débutant' },
  { value: 2, label: 'Basique' },
  { value: 3, label: 'Intermédiaire' },
  { value: 4, label: 'Avancé' },
  { value: 5, label: 'Expert' },
] as const

export const skillTypeLabels: Record<SkillType, string> = {
  SOFT: 'Comportementale',
  TECHNICAL: 'Technique',
}

export const historyActionLabels: Record<EmployeeSkillHistoryAction, string> = {
  ADD: 'Ajout',
  LEVEL_UPDATE: 'Mise à jour',
  REMOVE: 'Suppression',
}

export const DEFAULT_TECHNICAL_SKILL_LEVEL = 3

export function createEmptyTechnicalSkillRow(): TechnicalSkillFormRow {
  return {
    skillId: '',
    level: DEFAULT_TECHNICAL_SKILL_LEVEL,
  }
}

export function createInitialTechnicalSkillRows(count = 2): TechnicalSkillFormRow[] {
  return Array.from({ length: count }, () => createEmptyTechnicalSkillRow())
}

export function getSelectedTechnicalSkillIds(rows: TechnicalSkillFormRow[]) {
  return rows
    .map((row) => row.skillId)
    .filter((skillId): skillId is string => Boolean(skillId))
}

export function hasDuplicateTechnicalSkills(rows: TechnicalSkillFormRow[]) {
  const selectedSkillIds = getSelectedTechnicalSkillIds(rows)
  return new Set(selectedSkillIds).size !== selectedSkillIds.length
}

export function mapTechnicalSkillCatalogItems(input: unknown): TechnicalSkillCatalogItem[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((item) => typeof item.id === 'string' && typeof item.name === 'string')
    .filter((item) => item.isActive !== false)
    .filter((item) => item.type === undefined || item.type === 'TECHNICAL')
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      type: item.type === 'TECHNICAL' ? ('TECHNICAL' as SkillType) : undefined,
      isActive: item.isActive === undefined ? true : Boolean(item.isActive),
      description: typeof item.description === 'string' ? item.description : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export function mapSkillCatalogItems(input: unknown): SkillCatalogItem[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter(
      (item) =>
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        (item.type === 'SOFT' || item.type === 'TECHNICAL')
    )
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      type: item.type as SkillType,
      isMandatory: item.type === 'SOFT' ? true : Boolean(item.isMandatory),
      isActive: item.isActive === undefined ? true : Boolean(item.isActive),
      description: typeof item.description === 'string' ? item.description : null,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
      usage:
        item._count &&
        typeof item._count === 'object' &&
        typeof (item._count as Record<string, unknown>).employees === 'number' &&
        typeof (item._count as Record<string, unknown>).history === 'number' &&
        typeof (item._count as Record<string, unknown>).positions === 'number'
          ? {
              employeeCount: (item._count as Record<string, number>).employees,
              historyCount: (item._count as Record<string, number>).history,
              positionCount: (item._count as Record<string, number>).positions,
              isInUse:
                (item._count as Record<string, number>).employees > 0 ||
                (item._count as Record<string, number>).history > 0 ||
                (item._count as Record<string, number>).positions > 0,
            }
          : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export function mapEmployeeSkillsListItems(input: unknown): EmployeeSkillsListItem[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((item) => typeof item.id === 'string' && typeof item.name === 'string')
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      department: typeof item.department === 'string' ? item.department : null,
      position: typeof item.position === 'string' ? item.position : null,
      managerId: typeof item.managerId === 'string' ? item.managerId : null,
      manager:
        item.manager &&
        typeof item.manager === 'object' &&
        typeof (item.manager as Record<string, unknown>).id === 'string'
          ? {
              id: (item.manager as Record<string, unknown>).id as string,
              name:
                typeof (item.manager as Record<string, unknown>).name === 'string'
                  ? ((item.manager as Record<string, unknown>).name as string)
                  : '',
            }
          : null,
      skills: Array.isArray(item.skills)
        ? (item.skills as Array<Record<string, unknown>>)
            .filter(
              (skill) =>
                typeof skill.id === 'string' &&
                typeof skill.level === 'number' &&
                skill.skill &&
                typeof skill.skill === 'object'
            )
            .map((skill) => ({
              id: skill.id as string,
              level: skill.level as number,
              updatedAt: typeof skill.updatedAt === 'string' ? skill.updatedAt : undefined,
              skill: {
                id: ((skill.skill as Record<string, unknown>).id as string) || '',
                name: ((skill.skill as Record<string, unknown>).name as string) || '',
                type: (skill.skill as Record<string, unknown>).type as SkillType,
                isMandatory:
                  (skill.skill as Record<string, unknown>).type === 'SOFT'
                    ? true
                    : Boolean((skill.skill as Record<string, unknown>).isMandatory),
                isActive:
                  (skill.skill as Record<string, unknown>).isActive === undefined
                    ? true
                    : Boolean((skill.skill as Record<string, unknown>).isActive),
              },
            }))
        : [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export function isArchivedAssignedSkill(skill: { isActive?: boolean }) {
  return skill.isActive === false
}

export function getSkillLevelLabel(level: number) {
  return skillLevelOptions.find((option) => option.value === level)?.label ?? `Niveau ${level}`
}

export function buildHistoryDescription(entry: EmployeeSkillHistoryEntry) {
  if (entry.action === 'ADD') {
    return `${historyActionLabels.ADD}: ${entry.skillName} -> ${getSkillLevelLabel(entry.newLevel ?? 0)}`
  }

  if (entry.action === 'REMOVE') {
    return `${historyActionLabels.REMOVE}: ${entry.skillName} (${getSkillLevelLabel(entry.oldLevel ?? 0)})`
  }

  return `${historyActionLabels.LEVEL_UPDATE}: ${entry.skillName} ${getSkillLevelLabel(entry.oldLevel ?? 0)} -> ${getSkillLevelLabel(entry.newLevel ?? 0)}`
}
