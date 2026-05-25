import { prisma } from '@/lib/prisma'
import { buildSlaEmailHtml } from '@/lib/mailer'
import { notificationServerService } from '@/lib/services/server/notification.service'
import { SlaStatus, RequestStatus, RequestType } from '@prisma/client'

interface NotificationContent {
  title: string
  message: string
}

export class SlaService {
  calculateDeadline(startDate: Date, hours: number): Date {
    return this.addBusinessHours(startDate, hours)
  }

  addBusinessHours(startDate: Date, hours: number): Date {
    const result = new Date(startDate)
    let remainingHours = hours

    while (remainingHours > 0) {
      result.setHours(result.getHours() + 1)
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        remainingHours--
      }
    }

    return result
  }

  async initializeSla(requestId: string, requestType: string) {
    const config = await prisma.slaConfig.findUnique({
      where: { requestType: requestType as RequestType },
    })

    if (!config) {
      throw new Error(`No SLA config found for request type: ${requestType}`)
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { employee: { select: { managerId: true } } },
    })

    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }

    const currentOwner = request.approvalType === 'DIRECT_RH' ? 'RH' : 'CHEF'
    const deadline = this.calculateDeadline(request.createdAt, config.maxHours)

    await prisma.request.update({
      where: { id: requestId },
      data: {
        currentOwner,
        slaDeadline: deadline,
        slaStatus: SlaStatus.MET,
        slaBreached: false,
        slaNearingNotified: false,
        slaLastNotifiedAt: null,
      },
    })

    return { currentOwner, deadline }
  }

  async transitionSla(requestId: string, newStatus: RequestStatus) {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { employee: { select: { managerId: true } } },
    })

    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }

    let newOwner = request.currentOwner

    if (newStatus === 'EN_ATTENTE_CHEF') {
      newOwner = 'CHEF'
    } else if (newStatus === 'EN_ATTENTE_RH') {
      newOwner = 'RH'
    }

    let newDeadline = request.slaDeadline
    if (newOwner !== request.currentOwner) {
      const config = await prisma.slaConfig.findUnique({
        where: { requestType: request.type },
      })
      if (config) {
        newDeadline = this.calculateDeadline(new Date(), config.maxHours)
      }
    }

    await prisma.request.update({
      where: { id: requestId },
      data: {
        currentOwner: newOwner,
        slaDeadline: newDeadline,
        slaStatus: SlaStatus.MET,
        slaBreached: false,
        slaNearingNotified: false,
        slaLastNotifiedAt: null,
      },
    })

    return { newOwner, newDeadline }
  }

  async evaluateSlaStatus(requestId: string): Promise<{
    status: SlaStatus
    breached: boolean
    needsWarning: boolean
    needsBreach: boolean
  }> {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
    })

    if (!request || !request.slaDeadline) {
      return { status: SlaStatus.MET, breached: false, needsWarning: false, needsBreach: false }
    }

    const now = new Date()
    const deadline = new Date(request.slaDeadline)
    const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

    let newStatus: SlaStatus = SlaStatus.MET
    let breached = false
    let needsWarning = false
    let needsBreach = false

    if (now > deadline) {
      newStatus = SlaStatus.BREACHED
      breached = true
      if (!request.slaBreached) {
        needsBreach = true
      }
    } else if (hoursRemaining <= 6) {
      newStatus = SlaStatus.WARNING
      if (!request.slaNearingNotified) {
        needsWarning = true
      }
    }

    if (newStatus !== request.slaStatus || breached !== request.slaBreached) {
      await prisma.request.update({
        where: { id: requestId },
        data: {
          slaStatus: newStatus,
          slaBreached: breached,
        },
      })
    }

    return { status: newStatus, breached, needsWarning, needsBreach }
  }

  async sendSlaNotification(
    requestId: string,
    type: 'WARNING' | 'BREACH' | 'ESCALATION',
    recipient: string,
  ) {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { employee: { select: { name: true, managerId: true } } },
    })

    if (!request) return

    const hoursLeft = request.slaDeadline
      ? Math.floor((new Date(request.slaDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60))
      : 0

    await prisma.slaEvent.create({
      data: {
        requestId,
        eventType: type,
        recipient,
      },
    })

    const { title, message } = this.buildNotificationContent({
      type,
      requestType: request.type,
      employeeName: request.employee.name,
      hoursLeft,
    })
    const sentAt = new Date()
    const emailHtml = buildSlaEmailHtml({
      type,
      requestId,
      requestType: request.type,
      deadline: request.slaDeadline ?? sentAt,
      owner: recipient,
      sentAt,
    })

    if (recipient === 'RH') {
      await notificationServerService.notifyHR(title, message)
    } else if (recipient === 'CHEF' && request.employee.managerId) {
      await notificationServerService.notifyManager(request.employee.managerId, title, message)
    }

    try {
      const { sendEmail } = await import('@/lib/mailer')

      if (recipient === 'RH') {
        const rhUsers = await prisma.employee.findMany({
          where: { role: 'RH' },
          select: { email: true },
        })

        for (const rh of rhUsers) {
          await sendEmail({
            to: rh.email,
            subject: `[SLA] ${title}`,
            html: emailHtml,
          })
        }
      } else if (recipient === 'CHEF' && request.employee.managerId) {
        const manager = await prisma.employee.findUnique({
          where: { id: request.employee.managerId },
          select: { email: true },
        })

        if (manager) {
          await sendEmail({
            to: manager.email,
            subject: `[SLA] ${title}`,
            html: emailHtml,
          })
        }
      }
    } catch (error) {
      console.error('Failed to send SLA email notification:', error)
    }

    await prisma.request.update({
      where: { id: requestId },
      data: {
        slaLastNotifiedAt: sentAt,
        ...(type === 'WARNING' ? { slaNearingNotified: true } : {}),
      },
    })
  }

  async handleEscalation(requestId: string, currentOwner: string) {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
    })

    if (!request) return

    const otherRole = currentOwner === 'CHEF' ? 'RH' : 'CHEF'
    await this.sendSlaNotification(requestId, 'ESCALATION', otherRole)
  }

  shouldSendReminder(request: { slaLastNotifiedAt?: Date | null; slaBreached?: boolean | null }): boolean {
    if (!request.slaLastNotifiedAt || !request.slaBreached) return false

    const hoursSinceLastNotification =
      (new Date().getTime() - new Date(request.slaLastNotifiedAt).getTime()) / (1000 * 60 * 60)

    return hoursSinceLastNotification >= 4
  }

  private buildNotificationContent(input: {
    type: 'WARNING' | 'BREACH' | 'ESCALATION'
    requestType: string
    employeeName: string
    hoursLeft: number
  }): NotificationContent {
    if (input.type === 'WARNING') {
      return {
        title: "SLA proche de l'echeance",
        message: `La demande ${input.requestType} de ${input.employeeName} expire dans ${Math.max(input.hoursLeft, 0)}h`,
      }
    }

    if (input.type === 'BREACH') {
      return {
        title: 'SLA depasse - action requise',
        message: `La demande ${input.requestType} de ${input.employeeName} a depasse son delai SLA.`,
      }
    }

    return {
      title: 'SLA depasse - escalade',
      message: `Escalade SLA : la demande ${input.requestType} de ${input.employeeName} reste en depassement et requiert votre attention.`,
    }
  }
}

export const slaService = new SlaService()
