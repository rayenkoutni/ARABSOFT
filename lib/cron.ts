import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { checkAndBreachSla } from '@/lib/sla'

let isRunning = false

export function initCron() {
  cron.schedule('0 * * * *', async () => {
    if (isRunning) return
    isRunning = true
    try {
      const pendingStatuses = ['EN_ATTENTE_CHEF', 'EN_ATTENTE_RH']
      const requests = await prisma.request.findMany({
        where: {
          slaDeadline: { lt: new Date() },
          slaBreached: false,
          status: { notIn: pendingStatuses },
        },
      })
      await Promise.all(requests.map((r) => checkAndBreachSla(r.id)))
    } catch (e) {
      console.error('SLA cron error:', e)
    } finally {
      isRunning = false
    }
  })
  console.log('SLA cron initialized')
}