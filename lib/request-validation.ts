import { z } from "zod"
import { getLeaveRequestValidationMessage } from "@/lib/leave-request"

const requestTypes = ["CONGE", "AUTORISATION", "DOCUMENT", "PRET"] as const

const optionalDateStringSchema = z
  .string()
  .trim()
  .optional()
  .nullable()

const requestBaseSchema = z.object({
  type: z.enum(requestTypes),
  comment: z.string().trim().min(1, "Tous les champs sont obligatoires"),
  isDraft: z.boolean().optional().default(false),
  startDate: optionalDateStringSchema,
  endDate: optionalDateStringSchema,
})

export const requestInputSchema = requestBaseSchema.superRefine((value, ctx) => {
  const leaveValidationMessage = getLeaveRequestValidationMessage({
    type: value.type,
    startDate: value.startDate,
    endDate: value.endDate,
  })

  if (leaveValidationMessage) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startDate"],
      message: leaveValidationMessage,
    })
  }
})

export type RequestInput = z.infer<typeof requestInputSchema>
