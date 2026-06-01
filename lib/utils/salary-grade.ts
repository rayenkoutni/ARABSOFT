export function getSalaryGradeLevelLabel(level: number, description?: string | null) {
  const normalizedDescription = description?.trim()
  if (normalizedDescription) {
    return normalizedDescription
  }

  const fallbackLabels: Record<number, string> = {
    1: "Junior",
    2: "Confirme",
    3: "Senior",
    4: "Lead",
  }

  return fallbackLabels[level] ?? `Niveau ${level}`
}

export function formatSalaryGradeLabel(input: {
  role: string
  level: number
  baseSalary?: number | null
  description?: string | null
}) {
  const levelLabel = getSalaryGradeLevelLabel(input.level, input.description)
  const amountSuffix =
    typeof input.baseSalary === "number" ? ` (${input.baseSalary} TND)` : ""

  return `${input.role} - ${levelLabel}${amountSuffix}`
}
