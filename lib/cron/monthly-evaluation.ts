import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { bonusService } from '@/lib/services/server/bonus.service'
import { startOfMonth, endOfMonth, format } from 'date-fns'

/**
 * Monthly Evaluation Cron Job
 * Runs at 23:59 on the last day of every month (28-31)
 * Calculates weighted task score average for each employee
 * Creates Evaluation + EvaluationObjective (VALIDATED)
 * Triggers performance bonus generation
 */

async function runMonthlyEvaluations() {
  console.info('[Cron] Starting monthly evaluation job...')

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const period = format(now, 'yyyy-MM')

  try {
    // 1. Fetch all employees
    const employees = await prisma.employee.findMany({
      select: { id: true, managerId: true },
    })

    // 2. Pre-fetch existing evaluations for this period to avoid N+1 query
    const existingEvals = await prisma.evaluation.findMany({
      where: { period },
      select: { employeeId: true }
    })
    const existingEmployeeIds = new Set(existingEvals.map((e: { employeeId: string }) => e.employeeId))

    // 3. Pre-fetch all DONE tasks for this month with scores, grouped by assignee
    const allTasks = await prisma.task.findMany({
      where: {
        status: 'DONE',
        reviewedAt: { gte: monthStart, lte: monthEnd },
        taskScore: { not: null },
      },
      select: { assigneeId: true, taskScore: true, priority: true },
    })
    
    // Group tasks by employeeId
    const tasksByEmployee = new Map<string, typeof allTasks>()
    for (const t of allTasks) {
      if (!t.assigneeId) continue
      if (!tasksByEmployee.has(t.assigneeId)) tasksByEmployee.set(t.assigneeId, [])
      tasksByEmployee.get(t.assigneeId)!.push(t)
    }

    let createdCount = 0
    let skippedCount = 0

    // 4. Process each employee using in-memory data
    for (const employee of employees) {
      if (existingEmployeeIds.has(employee.id)) {
        skippedCount++
        continue
      }

      try {
        const tasks = tasksByEmployee.get(employee.id) || []
        let finalScore = 0

        if (tasks.length > 0) {
          let weightedSum = 0
          let totalWeight = 0

          for (const task of tasks) {
            const weight = task.priority === 'HIGH' ? 3 : task.priority === 'LOW' ? 1 : 2
            const score = task.taskScore ?? 0
            weightedSum += score * weight
            totalWeight += weight
          }

          if (totalWeight > 0) {
            finalScore = Math.round((weightedSum / totalWeight) * 100) / 100
          }
        }

        const evaluatorId = employee.managerId || employee.id

        // Because we need the ID to trigger the bonus, we still do this sequentially 
        // but we saved ~100 queries by prefetching the tasks and existing evals.
        const evaluation = await prisma.evaluation.create({
          data: {
            employeeId: employee.id,
            evaluatorId,
            period,
            status: 'VALIDATED',
            comments: `Évaluation automatique générée le ${now.toLocaleDateString('fr-FR')}`,
            objectives: {
              create: {
                title: 'Score mensuel des tâches',
                target: '10',
                result: finalScore.toString(),
                score: finalScore,
              }
            }
          },
        })

        // Generate bonus if applicable
        await bonusService.createPerformanceBonus(evaluation.id)

        createdCount++
      } catch (err) {
        console.error(`Failed for employee ${employee.id}:`, err)
      }
    }

    console.info(`[Cron] Monthly evaluations completed. Created: ${createdCount}, Skipped: ${skippedCount}`)
  } catch (error) {
    console.error('[Cron] Error during monthly evaluation job:', error)
  }
}

const CRON_EXPRESSION = '59 23 28-31 * *'

if (process.env.NODE_ENV !== 'test') {
  if (typeof globalThis !== 'undefined' && !(globalThis as any).__monthlyEvalCronStarted) {
    ;(globalThis as any).__monthlyEvalCronStarted = true

    cron.schedule(CRON_EXPRESSION, async () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + 1)

      if (tomorrow.getDate() === 1) {
        await runMonthlyEvaluations()
      }
    })

    console.info('[Cron] Monthly evaluation job registered')
  }
}

export { runMonthlyEvaluations }

