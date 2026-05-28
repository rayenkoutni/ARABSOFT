import cron from 'node-cron'
import { RequestStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { slaService } from '@/lib/services/server/sla.service'

let isRunning = false

export function initCron() {
  // Change from hourly to every 5 minutes for better reactivity
  cron.schedule('*/5 * * * *', async () => {
    if (isRunning) return
    isRunning = true

    try {
      const pendingStatuses: RequestStatus[] = ['EN_ATTENTE_CHEF', 'EN_ATTENTE_RH']

      // Get all pending requests that need SLA evaluation
      const pendingRequests = await prisma.request.findMany({
        where: {
          status: { in: pendingStatuses },
          slaDeadline: { not: null },
        },
      })

      for (const request of pendingRequests) {
        const slaResult = await slaService.evaluateSlaStatus(request.id)

        // Handle warnings
        if (slaResult.needsWarning) {
          const recipient = request.currentOwner || 'RH'
          await slaService.sendSlaNotification(request.id, 'WARNING', recipient)
        }

        // Handle breaches
        if (slaResult.needsBreach) {
          const recipient = request.currentOwner || 'RH'
          await slaService.sendSlaNotification(request.id, 'BREACH', recipient)

          // Handle escalation (notify both roles)
          await slaService.handleEscalation(request.id, recipient)
        }

        // Handle reminder loop for ongoing breaches
        if (slaResult.breached && slaService.shouldSendReminder(request)) {
          const recipient = request.currentOwner || 'RH'
          await slaService.sendSlaNotification(request.id, 'ESCALATION', recipient)
        }
      }

      console.info(`SLA cron processed ${pendingRequests.length} requests`)
    } catch (e) {
      console.error('SLA cron error:', e)
    } finally {
      isRunning = false
    }
  })

  console.info('Enhanced SLA cron initialized (5-minute intervals)')
}

