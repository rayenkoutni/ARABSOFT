export const SKILL_LEVEL_MIN = 1
export const SKILL_LEVEL_MAX = 5
export const DEFAULT_MANDATORY_SOFT_SKILL_LEVEL = 3
export const DEFAULT_INITIAL_TECHNICAL_SKILL_LEVEL = 3
export const MIN_TECHNICAL_SKILLS_PER_COLLABORATOR = 2
export const MIN_TECHNICAL_SKILLS_ON_COLLABORATOR_CREATION = MIN_TECHNICAL_SKILLS_PER_COLLABORATOR

export const SKILL_ERRORS = {
  missingMandatorySoftSkills:
    "Aucune compétence comportementale active n'est configurée dans le catalogue RH.",
  collaboratorTechnicalSkillsRequired:
    `Chaque collaborateur doit avoir au moins ${MIN_TECHNICAL_SKILLS_ON_COLLABORATOR_CREATION} compétences techniques à la création.`,
  collaboratorTechnicalSkillsMinimum:
    `Chaque collaborateur doit conserver au moins ${MIN_TECHNICAL_SKILLS_PER_COLLABORATOR} compétences techniques.`,
  collaboratorOnly:
    "Le module de compétences est réservé aux collaborateurs.",
  managerOnly:
    "Seul le chef du collaborateur peut modifier ses compétences.",
  rhOnly:
    "Seul RH peut gérer le catalogue global des compétences.",
} as const
