import {
  EmployeeSkillHistoryAction,
  Prisma,
  PrismaClient,
  Role,
  SkillType,
} from "@prisma/client"
import {
  DEFAULT_MANDATORY_SOFT_SKILL_LEVEL,
  MIN_TECHNICAL_SKILLS_PER_COLLABORATOR,
  MIN_TECHNICAL_SKILLS_ON_COLLABORATOR_CREATION,
  SKILL_ERRORS,
} from "./constants"
import {
  EmployeeSkillChangeBatchInput,
  isNullableSkillLevel,
  isSkillLevel,
  SkillCatalogInput,
  SkillCatalogUpdateInput,
} from "./validation"

type SkillDbClient = PrismaClient | Prisma.TransactionClient

export class SkillDomainError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = "SkillDomainError"
  }
}

type SkillActor = {
  id: string
  role: Role
  name?: string
}

type SkillUsageSummary = {
  employeeCount: number
  historyCount: number
  positionCount: number
}

function buildSkillUsageSummary(counts: {
  employees: number
  history: number
  positions: number
}): SkillUsageSummary {
  return {
    employeeCount: counts.employees,
    historyCount: counts.history,
    positionCount: counts.positions,
  }
}

export async function listScopedEmployeeSkills(
  db: SkillDbClient,
  actor: SkillActor
) {
  if (actor.role !== Role.RH && actor.role !== Role.CHEF) {
    throw new SkillDomainError("Forbidden", 403)
  }

  const where =
    actor.role === Role.CHEF
      ? { role: Role.COLLABORATEUR, managerId: actor.id }
      : { role: Role.COLLABORATEUR }

  return db.employee.findMany({
    where,
    orderBy: [{ department: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      department: true,
      position: true,
      managerId: true,
      manager: {
        select: {
          id: true,
          name: true,
        },
      },
      skills: {
        orderBy: [{ skill: { type: "asc" } }, { skill: { name: "asc" } }],
        select: {
          id: true,
          level: true,
          updatedAt: true,
          skill: {
            select: {
              id: true,
              name: true,
              type: true,
              isMandatory: true,
              isActive: true,
            },
          },
        },
      },
    },
  })
}

function ensureUniqueSkillIds(skillIds: string[], message: string) {
  if (new Set(skillIds).size !== skillIds.length) {
    throw new SkillDomainError(message, 400)
  }
}

function ensureSkillLevelOrThrow(level: number, label = "niveau") {
  if (!isSkillLevel(level)) {
    throw new SkillDomainError(`Le ${label} doit etre un entier compris entre 1 et 5.`, 400)
  }
}

function ensureNullableSkillLevelOrThrow(level: number | null | undefined, label = "niveau") {
  if (!isNullableSkillLevel(level)) {
    throw new SkillDomainError(`Le ${label} doit etre null ou un entier compris entre 1 et 5.`, 400)
  }
}

function getDerivedMandatoryFlag(type: SkillType) {
  return type === SkillType.SOFT
}

function buildDeleteBlockedReason(skill: {
  type: SkillType
  name: string
  employeeCount: number
  historyCount: number
}) {
  if (skill.type === SkillType.TECHNICAL) {
    return `La competence technique ${skill.name} est encore attribuee a des collaborateurs et ne peut pas etre supprimee.`
  }

  return `La competence comportementale ${skill.name} possede deja un historique collaborateur et ne peut plus etre supprimee.`
}

function ensureSkillIsActiveForAssignment(skill: {
  name: string
  isActive: boolean
}) {
  if (!skill.isActive) {
    throw new SkillDomainError(
      `La competence ${skill.name} est archivee dans le catalogue et ne peut plus etre attribuee.`,
      400
    )
  }
}

async function listActiveSoftSkillsOrThrow(
  db: SkillDbClient,
  options?: {
    skillIds?: string[]
  }
) {
  const softSkills = await db.skill.findMany({
    where: {
      type: SkillType.SOFT,
      isActive: true,
      ...(options?.skillIds ? { id: { in: options.skillIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  if (!options?.skillIds && softSkills.length === 0) {
    throw new SkillDomainError(SKILL_ERRORS.missingMandatorySoftSkills, 400)
  }

  return softSkills
}

async function backfillSoftSkillsForCollaborators(
  db: SkillDbClient,
  args: {
    collaboratorIds?: string[]
    softSkillIds?: string[]
  }
) {
  const softSkills = await listActiveSoftSkillsOrThrow(db, {
    skillIds: args.softSkillIds,
  })

  if (softSkills.length === 0) {
    return
  }

  const collaborators = await db.employee.findMany({
    where: {
      role: Role.COLLABORATEUR,
      ...(args.collaboratorIds ? { id: { in: args.collaboratorIds } } : {}),
    },
    select: { id: true },
  })

  if (collaborators.length === 0) {
    return
  }

  await db.employeeSkill.createMany({
    data: collaborators.flatMap((collaborator) =>
      softSkills.map((skill) => ({
        employeeId: collaborator.id,
        skillId: skill.id,
        level: DEFAULT_MANDATORY_SOFT_SKILL_LEVEL,
        acquiredAt: null,
      }))
    ),
    skipDuplicates: true,
  })
}

export async function createSkillCatalogEntry(
  db: SkillDbClient,
  actor: SkillActor,
  input: SkillCatalogInput
) {
  if (actor.role !== Role.RH) {
    throw new SkillDomainError(SKILL_ERRORS.rhOnly, 403)
  }

  const existing = await db.skill.findUnique({
    where: { name: input.name },
    select: { id: true },
  })

  if (existing) {
    throw new SkillDomainError("Une competence avec ce nom existe deja.", 409)
  }

  const skill = await db.skill.create({
    data: {
      name: input.name,
      type: input.type,
      isMandatory: getDerivedMandatoryFlag(input.type),
      isActive: true,
      description: input.description ?? null,
    },
  })

  if (skill.type === SkillType.SOFT) {
    await backfillSoftSkillsForCollaborators(db, {
      softSkillIds: [skill.id],
    })
  }

  return skill
}

export async function listSkillCatalog(
  db: SkillDbClient,
  actor: SkillActor,
  options?: {
    type?: SkillType
    includeInactive?: boolean
  }
) {
  if (actor.role !== Role.RH && actor.role !== Role.CHEF) {
    throw new SkillDomainError("Forbidden", 403)
  }

  return db.skill.findMany({
    where: {
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          employees: true,
          history: true,
          positions: true,
        },
      },
    },
  })
}

export async function updateSkillCatalogEntry(
  db: SkillDbClient,
  actor: SkillActor,
  skillId: string,
  input: SkillCatalogUpdateInput
) {
  if (actor.role !== Role.RH) {
    throw new SkillDomainError(SKILL_ERRORS.rhOnly, 403)
  }

  const existing = await db.skill.findUnique({
    where: { id: skillId },
    select: {
      id: true,
      name: true,
      type: true,
      isMandatory: true,
      isActive: true,
    },
  })

  if (!existing) {
    throw new SkillDomainError("Competence introuvable.", 404)
  }

  if (input.name !== existing.name) {
    const duplicate = await db.skill.findUnique({
      where: { name: input.name },
      select: { id: true },
    })

    if (duplicate) {
      throw new SkillDomainError("Une competence avec ce nom existe deja.", 409)
    }
  }

  const skill = await db.skill.update({
    where: { id: skillId },
    data: {
      name: input.name,
      type: existing.type,
      isMandatory: getDerivedMandatoryFlag(existing.type),
      isActive: input.isActive,
      description: input.description ?? null,
    },
  })

  if (skill.type === SkillType.SOFT && skill.isActive) {
    await backfillSoftSkillsForCollaborators(db, {
      softSkillIds: [skill.id],
    })
  }

  return skill
}

export async function deleteSkillCatalogEntry(
  db: SkillDbClient,
  actor: SkillActor,
  skillId: string
) {
  if (actor.role !== Role.RH) {
    throw new SkillDomainError(SKILL_ERRORS.rhOnly, 403)
  }

  const skill = await db.skill.findUnique({
    where: { id: skillId },
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true,
      _count: {
        select: {
          employees: true,
          history: true,
          positions: true,
        },
      },
    },
  })

  if (!skill) {
    throw new SkillDomainError("Competence introuvable.", 404)
  }

  const usage = buildSkillUsageSummary(skill._count)
  const canDelete =
    skill.type === SkillType.TECHNICAL
      ? usage.employeeCount === 0
      : usage.historyCount === 0

  if (!canDelete) {
    throw new SkillDomainError(
      buildDeleteBlockedReason({
        type: skill.type,
        name: skill.name,
        employeeCount: usage.employeeCount,
        historyCount: usage.historyCount,
      }),
      409
    )
  }

  if (skill.type === SkillType.SOFT) {
    await db.employeeSkill.deleteMany({
      where: { skillId: skill.id },
    })
  }

  await db.positionSkill.deleteMany({
    where: { skillId: skill.id },
  })

  await db.skill.delete({
    where: { id: skill.id },
  })

  return {
    id: skill.id,
    name: skill.name,
    type: skill.type,
    isActive: skill.isActive,
    usage,
  }
}

async function getCollaboratorOrThrow(db: SkillDbClient, employeeId: string) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, role: true, managerId: true, name: true },
  })

  if (!employee) {
    throw new SkillDomainError("Collaborateur introuvable.", 404)
  }

  if (employee.role !== Role.COLLABORATEUR) {
    throw new SkillDomainError(SKILL_ERRORS.collaboratorOnly, 400)
  }

  return employee
}

export async function initializeCollaboratorSkillProfile(
  db: SkillDbClient,
  args: {
    employeeId: string
    technicalSkills: Array<{ skillId: string; level: number }>
    actor: SkillActor
  }
) {
  const employee = await getCollaboratorOrThrow(db, args.employeeId)
  ensureSkillLevelOrThrow(DEFAULT_MANDATORY_SOFT_SKILL_LEVEL, "niveau par defaut des competences comportementales")
  args.technicalSkills.forEach((skill, index) => {
    ensureSkillLevelOrThrow(skill.level, `niveau technique initial ${index + 1}`)
  })

  const technicalSkillIds = args.technicalSkills.map((skill) => skill.skillId)
  ensureUniqueSkillIds(
    technicalSkillIds,
    "Les competences techniques initiales ne peuvent pas contenir de doublons."
  )

  if (technicalSkillIds.length < MIN_TECHNICAL_SKILLS_ON_COLLABORATOR_CREATION) {
    throw new SkillDomainError(SKILL_ERRORS.collaboratorTechnicalSkillsRequired, 400)
  }

  const mandatorySoftSkills = await listActiveSoftSkillsOrThrow(db)

  const technicalCatalogSkills = await db.skill.findMany({
    where: { id: { in: technicalSkillIds } },
    select: { id: true, type: true, name: true, isActive: true },
  })

  if (technicalCatalogSkills.length !== technicalSkillIds.length) {
    throw new SkillDomainError("Certaines competences techniques sont introuvables.", 400)
  }

  const invalidSkill = technicalCatalogSkills.find((skill) => skill.type !== SkillType.TECHNICAL)
  if (invalidSkill) {
    throw new SkillDomainError(
      `La competence ${invalidSkill.name} n'est pas technique et ne peut pas etre selectionnee ici.`,
      400
    )
  }

  const inactiveSkill = technicalCatalogSkills.find((skill) => !skill.isActive)
  if (inactiveSkill) {
    ensureSkillIsActiveForAssignment(inactiveSkill)
  }

  const currentProfileEntries = [
    ...mandatorySoftSkills.map((skill) => ({
      employeeId: employee.id,
      skillId: skill.id,
      level: DEFAULT_MANDATORY_SOFT_SKILL_LEVEL,
      acquiredAt: null,
    })),
    ...args.technicalSkills.map((skill) => ({
      employeeId: employee.id,
      skillId: skill.skillId,
      level: skill.level,
      acquiredAt: null,
    })),
  ]

  await db.employeeSkill.createMany({
    data: currentProfileEntries,
  })

  return getEmployeeSkillProfile(db, employee.id)
}

export async function getEmployeeSkillProfile(db: SkillDbClient, employeeId: string) {
  await getCollaboratorOrThrow(db, employeeId)

  const [skills, history] = await Promise.all([
    db.employeeSkill.findMany({
      where: { employeeId },
      orderBy: [{ skill: { type: "asc" } }, { skill: { name: "asc" } }],
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            type: true,
            isMandatory: true,
            isActive: true,
            description: true,
          },
        },
      },
    }),
    db.employeeSkillHistory.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, name: true, role: true } },
      },
    }),
  ])

  return { skills, history }
}

export async function applyManagerSkillChanges(
  db: SkillDbClient,
  args: {
    employeeId: string
    actor: SkillActor
    changes: EmployeeSkillChangeBatchInput["changes"]
  }
) {
  if (args.actor.role !== Role.CHEF) {
    throw new SkillDomainError(SKILL_ERRORS.managerOnly, 403)
  }

  const employee = await getCollaboratorOrThrow(db, args.employeeId)
  if (employee.managerId !== args.actor.id) {
    throw new SkillDomainError(SKILL_ERRORS.managerOnly, 403)
  }

  const uniqueSkillIds = args.changes.map((change) => change.skillId)
  ensureUniqueSkillIds(
    uniqueSkillIds,
    "Une meme competence ne peut apparaitre qu'une seule fois par requete de modification."
  )

  const catalogSkills = await db.skill.findMany({
    where: { id: { in: uniqueSkillIds } },
    select: { id: true, type: true, name: true, isMandatory: true, isActive: true },
  })

  if (catalogSkills.length !== uniqueSkillIds.length) {
    throw new SkillDomainError("Certaines competences sont introuvables dans le catalogue.", 400)
  }

  const catalogById = new Map(catalogSkills.map((skill) => [skill.id, skill]))
  const employeeSkills = await db.employeeSkill.findMany({
    where: { employeeId: employee.id },
        select: {
          id: true,
          skillId: true,
          level: true,
          skill: {
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
            },
          },
        },
  })
  const currentBySkillId = new Map(employeeSkills.map((skill) => [skill.skillId, skill]))

  for (const change of args.changes) {
    const catalogSkill = catalogById.get(change.skillId)
    if (!catalogSkill) {
      throw new SkillDomainError("Competence introuvable.", 400)
    }

    ensureNullableSkillLevelOrThrow(currentBySkillId.get(change.skillId)?.level, "niveau actuel")

    const currentSkill = currentBySkillId.get(change.skillId)

    if (change.action === EmployeeSkillHistoryAction.ADD) {
      ensureSkillLevelOrThrow(change.newLevel, "nouveau niveau")
      if (currentSkill) {
        throw new SkillDomainError(
          `La competence ${catalogSkill.name} est deja presente dans le profil du collaborateur.`,
          409
        )
      }

      if (catalogSkill.type !== SkillType.TECHNICAL) {
        throw new SkillDomainError(
          `La competence ${catalogSkill.name} n'est pas technique et ne peut pas etre ajoutee depuis cette interface.`,
          400
        )
      }

      ensureSkillIsActiveForAssignment(catalogSkill)
    }

    if (change.action === EmployeeSkillHistoryAction.LEVEL_UPDATE) {
      ensureSkillLevelOrThrow(change.newLevel, "nouveau niveau")
      if (!currentSkill) {
        throw new SkillDomainError(
          `La competence ${catalogSkill.name} doit d'abord etre ajoutee avant une mise a jour.`,
          400
        )
      }

      if (!catalogSkill.isActive) {
        throw new SkillDomainError(
          `La competence ${catalogSkill.name} est archivee dans le catalogue et reste en lecture seule sur le profil.`,
          400
        )
      }
    }

    if (change.action === EmployeeSkillHistoryAction.REMOVE) {
      if (!currentSkill) {
        throw new SkillDomainError(
          `La competence ${catalogSkill.name} n'existe pas dans le profil actuel.`,
          400
        )
      }

      if (catalogSkill.type === SkillType.SOFT) {
        throw new SkillDomainError(
          `La competence ${catalogSkill.name} est une competence comportementale et ne peut pas etre retiree.`,
          400
        )
      }

      if (!catalogSkill.isActive) {
        throw new SkillDomainError(
          `La competence ${catalogSkill.name} est archivee dans le catalogue et reste en lecture seule sur le profil.`,
          400
        )
      }
    }
  }

  const technicalSkillCount = employeeSkills.filter(
    (skill) => skill.skill.type === SkillType.TECHNICAL
  ).length
  const technicalAdds = args.changes.filter((change) => {
    const catalogSkill = catalogById.get(change.skillId)
    return change.action === EmployeeSkillHistoryAction.ADD && catalogSkill?.type === SkillType.TECHNICAL
  }).length
  const technicalRemovals = args.changes.filter((change) => {
    const catalogSkill = catalogById.get(change.skillId)
    return change.action === EmployeeSkillHistoryAction.REMOVE && catalogSkill?.type === SkillType.TECHNICAL
  }).length
  const resultingTechnicalSkillCount = technicalSkillCount + technicalAdds - technicalRemovals

  if (resultingTechnicalSkillCount < MIN_TECHNICAL_SKILLS_PER_COLLABORATOR) {
    throw new SkillDomainError(SKILL_ERRORS.collaboratorTechnicalSkillsMinimum, 400)
  }

  for (const change of args.changes) {
    const currentSkill = currentBySkillId.get(change.skillId)
    const catalogSkill = catalogById.get(change.skillId)!

    if (change.action === EmployeeSkillHistoryAction.ADD) {
      await db.employeeSkill.create({
        data: {
          employeeId: employee.id,
          skillId: change.skillId,
          level: change.newLevel,
        },
      })
      await db.employeeSkillHistory.create({
        data: {
          employeeId: employee.id,
          skillId: change.skillId,
          skillName: catalogSkill.name,
          skillType: catalogSkill.type,
          action: EmployeeSkillHistoryAction.ADD,
          oldLevel: null,
          newLevel: change.newLevel,
          comment: `Competence ${catalogSkill.name} ajoutee au profil.`,
          actorId: args.actor.id,
        },
      })
      continue
    }

    if (change.action === EmployeeSkillHistoryAction.LEVEL_UPDATE) {
      if (currentSkill?.level === change.newLevel) {
        continue
      }

      await db.employeeSkill.update({
        where: { id: currentSkill!.id },
        data: { level: change.newLevel },
      })
      await db.employeeSkillHistory.create({
        data: {
          employeeId: employee.id,
          skillId: change.skillId,
          skillName: catalogSkill.name,
          skillType: catalogSkill.type,
          action: EmployeeSkillHistoryAction.LEVEL_UPDATE,
          oldLevel: currentSkill!.level,
          newLevel: change.newLevel,
          comment: `Niveau de ${catalogSkill.name} mis a jour.`,
          actorId: args.actor.id,
        },
      })
      continue
    }

    await db.employeeSkill.delete({
      where: { id: currentSkill!.id },
    })
    await db.employeeSkillHistory.create({
      data: {
        employeeId: employee.id,
        skillId: change.skillId,
        skillName: catalogSkill.name,
        skillType: catalogSkill.type,
        action: EmployeeSkillHistoryAction.REMOVE,
        oldLevel: currentSkill!.level,
        newLevel: null,
        comment: `Competence technique ${catalogSkill.name} retiree du profil.`,
        actorId: args.actor.id,
      },
    })
  }

  return getEmployeeSkillProfile(db, employee.id)
}
