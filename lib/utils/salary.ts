export function resolveSalary(employee: {
  salaryOverride?: number | null
  salaryGrade?: { baseSalary: number } | null
}): number {
  return employee.salaryOverride ?? employee.salaryGrade?.baseSalary ?? 0
}
