import cron from 'node-cron'
import { format } from 'date-fns'
import { bonusService } from '@/lib/services/server/bonus.service'

async function runAnnualBonuses() {
  const now = new Date()
  const period = format(now, 'yyyy')

  try {
    const created = await bonusService.createAnnualBonuses(period)
    console.info(`[Cron] Annual bonus job completed for ${period}. Created: ${created.length}`)
  } catch (error) {
    console.error(`[Cron] Annual bonus job failed for ${period}:`, error)
  }
}

const CRON_EXPRESSION = '59 23 31 12 *'

if (process.env.NODE_ENV !== 'test') {
  if (typeof globalThis !== 'undefined' && !(globalThis as any).__annualBonusCronStarted) {
    ;(globalThis as any).__annualBonusCronStarted = true

    cron.schedule(CRON_EXPRESSION, async () => {
      await runAnnualBonuses()
    })

    console.info('[Cron] Annual bonus job registered')
  }
}

export { runAnnualBonuses }
