import { prisma } from '@/lib/prisma'
import { notificationServerService } from '@/lib/services/server/notification.service'
import { RequestType } from '@prisma/client'

export async function getSlaDeadline(requestType: string): Promise<Date | null> {
  const config = await prisma.slaConfig.findUnique({
    where: { requestType: requestType as RequestType },
  })
  if (!config) return null
  return new Date(Date.now() + config.maxHours * 60 * 60 * 1000)
}

export async function checkAndBreachSla(requestId: string): Promise<void> {
  const request = await prisma.request.findUnique({ where: { id: requestId } })
  if (!request || request.slaBreached || request.slaDeadline === null) return
  if (new Date() > request.slaDeadline) {
    await prisma.request.update({
      where: { id: requestId },
      data: { slaBreached: true },
    })
    await notificationServerService.notifyHR(
      'SLA dépassé',
      `La demande ${request.type} (#${request.id.slice(0, 8)}) a dépassé son délai SLA`
    )
  }
}