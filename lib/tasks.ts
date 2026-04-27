import { Prisma, PrismaClient, SkillType } from "@prisma/client"
import { z } from "zod"
import { skillLevelSchema } from "./skills"

type TaskDbClient = PrismaClient | Prisma.TransactionClient

const taskPriorities = ["LOW", "MEDIUM", "HIGH"] as const

export class TaskInputError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = "TaskInputError"
  }
}

const trimmedOptionalString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) {
      return null
    }

    return value.length > 0 ? value : null
  })

export const taskRequiredSkillInputSchema = z.object({
  skillId: z.string().uuid("La competence requise selectionnee est invalide."),
  minimumLevel: skillLevelSchema,
})

export const taskCreateInputSchema = z.object({
  title: z.string().trim().min(1, "Le titre de la tache est obligatoire.").max(160),
  description: trimmedOptionalString,
  priority: z.enum(taskPriorities).optional().default("MEDIUM"),
  assigneeId: z.string().uuid("Le collaborateur assigne est invalide."),
  dueDate: trimmedOptionalString,
  requiredSkills: z.array(taskRequiredSkillInputSchema).optional().default([]),
}).superRefine((value, ctx) => {
  const seen = new Set<string>()

  value.requiredSkills.forEach((skill, index) => {
    if (seen.has(skill.skillId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requiredSkills", index, "skillId"],
        message: "Chaque competence technique requise doit etre unique.",
      })
      return
    }

    seen.add(skill.skillId)
  })
})

export type TaskCreateInput = z.infer<typeof taskCreateInputSchema>

export const taskWithRelationsInclude = {
  assignee: {
    select: {
      id: true,
      name: true,
    },
  },
  requiredSkills: {
    orderBy: [
      { minimumLevel: "desc" as const },
      { skill: { name: "asc" as const } },
    ],
    include: {
      skill: {
        select: {
          id: true,
          name: true,
          type: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.TaskInclude

export async function validateTaskRequiredSkills(
  db: TaskDbClient,
  requiredSkills: TaskCreateInput["requiredSkills"]
) {
  if (requiredSkills.length === 0) {
    return []
  }

  const catalogSkills = await db.skill.findMany({
    where: {
      id: {
        in: requiredSkills.map((skill) => skill.skillId),
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true,
    },
  })

  if (catalogSkills.length !== requiredSkills.length) {
    throw new TaskInputError("Certaines competences requises sont introuvables.", 400)
  }

  const catalogById = new Map(catalogSkills.map((skill) => [skill.id, skill]))

  return requiredSkills.map((requiredSkill) => {
    const catalogSkill = catalogById.get(requiredSkill.skillId)
    if (!catalogSkill) {
      throw new TaskInputError("Certaines competences requises sont introuvables.", 400)
    }

    if (catalogSkill.type !== SkillType.TECHNICAL) {
      throw new TaskInputError(
        `La competence ${catalogSkill.name} n'est pas technique et ne peut pas etre requise pour une tache.`,
        400
      )
    }

    if (!catalogSkill.isActive) {
      throw new TaskInputError(
        `La competence ${catalogSkill.name} est archivee dans le catalogue et ne peut pas etre requise pour une tache.`,
        400
      )
    }

    return {
      skillId: requiredSkill.skillId,
      minimumLevel: requiredSkill.minimumLevel,
    }
  })
}
