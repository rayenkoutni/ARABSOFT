import { Prisma, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"

interface SalaryHistoryChangeInput {
  employeeId: string
  previousSalaryGradeId?: string | null
  previousSalaryOverride?: number | null
  nextSalaryGradeId?: string | null
  nextSalaryOverride?: number | null
  fallbackRole: Role
  validFrom: Date
}

interface SalaryHistorySeedInput {
  employeeId: string
  salaryGradeId?: string | null
  salaryOverride?: number | null
  fallbackRole: Role
  validFrom: Date
}

type PrismaClientLike = Prisma.TransactionClient | typeof prisma

function normalizeNullableNumber(value?: number | null) {
  return typeof value === "number" ? value : null
}

function hasSalaryConfiguration(input: {
  salaryGradeId?: string | null
  salaryOverride?: number | null
}) {
  return Boolean(input.salaryGradeId) || normalizeNullableNumber(input.salaryOverride) !== null
}

async function createSalaryHistoryRecord(
  tx: PrismaClientLike,
  input: SalaryHistorySeedInput,
) {
  if (!hasSalaryConfiguration(input)) {
    return null
  }

  const grade = input.salaryGradeId
    ? await tx.salaryGrade.findUnique({
        where: { id: input.salaryGradeId },
        select: { id: true, role: true, level: true, baseSalary: true },
      })
    : null

  const salaryOverride = normalizeNullableNumber(input.salaryOverride)
  const baseSalary = grade?.baseSalary ?? 0
  const resolvedSalary = salaryOverride ?? baseSalary

  return tx.salaryHistory.create({
    data: {
      employeeId: input.employeeId,
      gradeId: grade?.id ?? null,
      role: grade?.role ?? input.fallbackRole,
      level: grade?.level ?? 0,
      baseSalary,
      salaryOverride,
      resolvedSalary,
      validFrom: input.validFrom,
      validTo: null,
    },
  })
}

export async function closeOpenSalaryHistory(
  tx: PrismaClientLike,
  employeeId: string,
  validTo: Date,
) {
  const openHistory = await tx.salaryHistory.findFirst({
    where: {
      employeeId,
      validTo: null,
    },
    orderBy: {
      validFrom: "desc",
    },
    select: {
      id: true,
    },
  })

  if (!openHistory) {
    return null
  }

  return tx.salaryHistory.update({
    where: { id: openHistory.id },
    data: { validTo },
  })
}

export async function syncSalaryHistoryOnCompensationChange(
  tx: PrismaClientLike,
  input: SalaryHistoryChangeInput,
) {
  const previousSalaryOverride = normalizeNullableNumber(input.previousSalaryOverride)
  const nextSalaryOverride = normalizeNullableNumber(input.nextSalaryOverride)
  const didChange =
    (input.previousSalaryGradeId ?? null) !== (input.nextSalaryGradeId ?? null) ||
    previousSalaryOverride !== nextSalaryOverride

  if (!didChange) {
    return null
  }

  await closeOpenSalaryHistory(tx, input.employeeId, input.validFrom)

  return createSalaryHistoryRecord(tx, {
    employeeId: input.employeeId,
    salaryGradeId: input.nextSalaryGradeId ?? null,
    salaryOverride: nextSalaryOverride,
    fallbackRole: input.fallbackRole,
    validFrom: input.validFrom,
  })
}

export async function createInitialSalaryHistory(
  tx: PrismaClientLike,
  input: SalaryHistorySeedInput,
) {
  return createSalaryHistoryRecord(tx, input)
}
