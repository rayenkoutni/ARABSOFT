import { z } from "zod"
import {
  DEFAULT_INITIAL_TECHNICAL_SKILL_LEVEL,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
} from "./constants"

const skillTypes = ["SOFT", "TECHNICAL"] as const
const employeeSkillHistoryActions = ["ADD", "LEVEL_UPDATE", "REMOVE"] as const
const roles = ["RH", "CHEF", "COLLABORATEUR"] as const
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

const trimmedOptionalString = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .optional()
  .nullable()

function isValidDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function getTodayDateOnly() {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function isPastOrTodayDateOnly(value: string) {
  return value <= getTodayDateOnly()
}

const hireDateSchema = z
  .string({
    required_error: "La date d'embauche est obligatoire",
  })
  .trim()
  .regex(dateOnlyPattern, "La date d'embauche est invalide")
  .refine(isValidDateOnly, "La date d'embauche est invalide")
  .refine(isPastOrTodayDateOnly, "La date d'embauche ne peut pas être dans le futur")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))

export const skillLevelSchema = z
  .number()
  .int()
  .min(SKILL_LEVEL_MIN)
  .max(SKILL_LEVEL_MAX)

export function isSkillLevel(value: number) {
  return Number.isInteger(value) && value >= SKILL_LEVEL_MIN && value <= SKILL_LEVEL_MAX
}

export function isNullableSkillLevel(value: number | null | undefined) {
  return value == null || isSkillLevel(value)
}

const skillCatalogBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(skillTypes),
  isMandatory: z.boolean().optional().default(false),
  description: trimmedOptionalString,
})

export const skillCatalogInputSchema = skillCatalogBaseSchema.transform((value) => ({
  ...value,
  isMandatory: value.type === "SOFT",
}))

export const skillCatalogUpdateSchema = skillCatalogBaseSchema
  .pick({
    name: true,
    description: true,
  })
  .extend({
    isActive: z.boolean().optional(),
  })

export const employeeTechnicalSkillInputSchema = z.object({
  skillId: z.string().uuid(),
  level: skillLevelSchema.optional().default(DEFAULT_INITIAL_TECHNICAL_SKILL_LEVEL),
})

export const collaboratorSkillInitializationSchema = z.object({
  technicalSkills: z.array(employeeTechnicalSkillInputSchema).optional().default([]),
})

const addSkillChangeSchema = z.object({
  action: z.literal(employeeSkillHistoryActions[0]),
  skillId: z.string().uuid(),
  newLevel: skillLevelSchema,
})

const updateSkillChangeSchema = z.object({
  action: z.literal(employeeSkillHistoryActions[1]),
  skillId: z.string().uuid(),
  newLevel: skillLevelSchema,
})

const removeSkillChangeSchema = z.object({
  action: z.literal(employeeSkillHistoryActions[2]),
  skillId: z.string().uuid(),
})

export const employeeSkillChangeSchema = z.discriminatedUnion("action", [
  addSkillChangeSchema,
  updateSkillChangeSchema,
  removeSkillChangeSchema,
])

export const employeeSkillChangeBatchSchema = z.object({
  changes: z.array(employeeSkillChangeSchema).min(1),
})

export const employeeCreateInputSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(roles),
  department: z.string().trim().optional().nullable(),
  position: z.string().trim().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  hireDate: hireDateSchema,
  subordinateIds: z.array(z.string().uuid()).optional(),
  technicalSkills: z.array(employeeTechnicalSkillInputSchema).optional().default([]),
})

export const employeeUpdateInputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(roles).optional(),
  department: z.string().trim().optional().nullable(),
  position: z.string().trim().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  hireDate: hireDateSchema.optional(),
  resetPassword: z.boolean().optional(),
})

export type SkillCatalogInput = z.infer<typeof skillCatalogInputSchema>
export type SkillCatalogUpdateInput = z.infer<typeof skillCatalogUpdateSchema>
export type CollaboratorSkillInitializationInput = z.infer<typeof collaboratorSkillInitializationSchema>
export type EmployeeSkillChangeBatchInput = z.infer<typeof employeeSkillChangeBatchSchema>
export type EmployeeCreateInput = z.infer<typeof employeeCreateInputSchema>
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateInputSchema>
