import { prisma } from '@/lib/prisma'
import { buildSlaEmailHtml } from '@/lib/mailer'
import { notificationServerService } from '@/lib/services/server/notification.service'
import { SlaStatus, RequestStatus, RequestType } from '@prisma/client'
import type { CurrentUser } from '@/lib/services/server/auth.service'
import { AppError } from '@/lib/errors'

interface NotificationContent {
  title: string
  message: string
}

export class SlaService {
  private static readonly WARNING_THRESHOLD_HOURS = 24

  async getConfigs() {
    return prisma.slaConfig.findMany()
  }

  async updateConfig(id: string, maxHours: number) {
    return prisma.slaConfig.update({
      where: { id },
      data: { maxHours },
    })
  }

  async getStats(user: CurrentUser) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const baseWhere: Record<string, unknown> = {
      createdAt: { gte: startOfYear },
      status: { notIn: ["BROUILLON"] },
    }

    if (user.role === "CHEF") {
      baseWhere.employee = { managerId: user.id }
    }

    const slaStatusDistribution = await prisma.request.groupBy({
      by: ["slaStatus"],
      where: baseWhere,
      _count: { slaStatus: true },
    })

    const breachedCount = await prisma.request.count({
      where: {
        ...baseWhere,
        slaStatus: "BREACHED",
        createdAt: { gte: startOfMonth },
      },
    })

    const breachByType = await prisma.request.groupBy({
      by: ["type"],
      where: {
        ...baseWhere,
        slaStatus: "BREACHED",
      },
      _count: { type: true },
    })

    const allRequests = await prisma.request.findMany({
      where: baseWhere,
      select: {
        type: true,
        slaStatus: true,
        createdAt: true,
        updatedAt: true,
        status: true,
      },
    })

    const typeStats: Record<string, { total: number; breached: number; met: number; totalHours: number }> = {}
    allRequests.forEach((request) => {
      if (!typeStats[request.type]) {
        typeStats[request.type] = { total: 0, breached: 0, met: 0, totalHours: 0 }
      }
      typeStats[request.type].total += 1
      if (request.slaStatus === "BREACHED") typeStats[request.type].breached += 1
      if (request.slaStatus === "MET") typeStats[request.type].met += 1
      if (request.status !== "BROUILLON") {
        typeStats[request.type].totalHours +=
          (new Date(request.updatedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60)
      }
    })

    const byType = Object.entries(typeStats).map(([type, stats]) => ({
      type,
      total: stats.total,
      breached: stats.breached,
      met: stats.met,
      complianceRate: stats.total > 0 ? (stats.met / stats.total) * 100 : 0,
      avgHours: stats.total > 0 ? stats.totalHours / stats.total : 0,
    }))

    const metCount = await prisma.request.count({
      where: {
        ...baseWhere,
        slaStatus: "MET",
      },
    })

    const complianceRate = allRequests.length > 0 ? (metCount / allRequests.length) * 100 : 0
    const breachTrend = []

    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date(now)
      date.setDate(now.getDate() - i)
      const startOfDay = new Date(date.setHours(0, 0, 0, 0))
      const endOfDay = new Date(date.setHours(23, 59, 59, 999))
      const count = await prisma.request.count({
        where: {
          ...baseWhere,
          slaStatus: "BREACHED",
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      })

      breachTrend.push({
        date: startOfDay.toISOString().split("T")[0],
        count,
      })
    }

    const totalRequests = await prisma.request.count({ where: baseWhere })
    const resolvedRequests = await prisma.request.findMany({
      where: {
        ...baseWhere,
        status: { in: ["APPROUVE", "REJETE"] },
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    })

    const totalResolutionHours = resolvedRequests.reduce((total, request) => {
      return total + (new Date(request.updatedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60)
    }, 0)

    return {
      breachedThisMonth: breachedCount,
      breachByType,
      complianceRate,
      metCount,
      byType,
      breachTrend,
      slaStatusDistribution,
      totalRequests,
      averageResolutionHours: resolvedRequests.length > 0 ? totalResolutionHours / resolvedRequests.length : 0,
    }
  }

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
      throw new AppError(`No SLA config found for request type: ${requestType}`, 404)
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { employee: { select: { managerId: true } } },
    })

    if (!request) {
      throw new AppError(`Request not found: ${requestId}`, 404)
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
      throw new AppError(`Request not found: ${requestId}`, 404)
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
    } else if (hoursRemaining <= SlaService.WARNING_THRESHOLD_HOURS) {
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
    const overdueDays = request.slaDeadline
      ? Math.max(0, Math.floor((sentAt.getTime() - new Date(request.slaDeadline).getTime()) / (1000 * 60 * 60 * 24)))
      : 0
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const requestPath = recipient === 'RH'
      ? `/dashboard/approvals?requestId=${requestId}`
      : `/dashboard/my-approvals?requestId=${requestId}`
    const emailHtml = buildSlaEmailHtml({
      type,
      requestId,
      requestType: request.type,
      employeeName: request.employee.name,
      deadline: request.slaDeadline ?? sentAt,
      owner: recipient,
      sentAt,
      overdueDays,
      hoursRemaining: Math.max(0, hoursLeft),
      requestUrl: `${appUrl}${requestPath}`,
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
