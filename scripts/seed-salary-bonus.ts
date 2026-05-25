import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function seedSalaryAndBonus() {
  console.log('Seeding SalaryGrades and BonusRules...')

  // Clear existing for idempotency in dev
  await prisma.bonusRule.deleteMany()
  await prisma.salaryGrade.deleteMany()

  // Salary Grades
  const grades = [
    { role: 'COLLABORATEUR' as Role, level: 1, baseSalary: 2500, description: 'Junior Collaborateur' },
    { role: 'COLLABORATEUR' as Role, level: 2, baseSalary: 3200, description: 'Collaborateur' },
    { role: 'COLLABORATEUR' as Role, level: 3, baseSalary: 4000, description: 'Senior Collaborateur' },
    { role: 'CHEF' as Role, level: 1, baseSalary: 4500, description: 'Chef d\'équipe' },
    { role: 'CHEF' as Role, level: 2, baseSalary: 5500, description: 'Chef Senior' },
    { role: 'RH' as Role, level: 1, baseSalary: 5000, description: 'RH' },
    { role: 'RH' as Role, level: 2, baseSalary: 6500, description: 'RH Senior' },
  ]

  for (const g of grades) {
    await prisma.salaryGrade.create({ data: g })
  }

  // Bonus Rules (score 0-10)
  const rules = [
    { minScore: 0, maxScore: 5, percentage: 0 },
    { minScore: 5, maxScore: 7, percentage: 5 },
    { minScore: 7, maxScore: 9, percentage: 10 },
    { minScore: 9, maxScore: 10, percentage: 15 },
  ]

  for (const r of rules) {
    await prisma.bonusRule.create({ data: r })
  }

  console.log('Salary & Bonus seed data created successfully.')
}

seedSalaryAndBonus()
  .catch(console.error)
  .finally(() => prisma.$disconnect())