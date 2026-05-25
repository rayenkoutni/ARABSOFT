import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user || (user.role !== "RH" && user.role !== "CHEF")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  // Build base where clause
  const baseWhere: any = {
    createdAt: { gte: startOfYear },
    status: { notIn: ["BROUILLON"] },
  }

  // If CHEF, filter by their team (requests from employees they manage)
  if (user.role === "CHEF") {
    baseWhere.employee = { managerId: user.id }
  }

  // Current SLA status distribution (pie chart)
  const slaStatusDistribution = await prisma.request.groupBy({
    by: ["slaStatus"],
    where: baseWhere,
    _count: { slaStatus: true },
  })

  // Monthly breached count
  const breachedCount = await prisma.request.count({
    where: {
      ...baseWhere,
      slaStatus: "BREACHED",
      createdAt: { gte: startOfMonth },
    },
  })

  // Breach by type (for the current year to ensure data visibility)
  const breachByType = await prisma.request.groupBy({
    by: ["type"],
    where: {
      ...baseWhere,
      slaStatus: "BREACHED",
    },
    _count: { type: true },
  })

  // All requests for compliance rate & by-type stats
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

  allRequests.forEach((req) => {
    if (!typeStats[req.type]) {
      typeStats[req.type] = { total: 0, breached: 0, met: 0, totalHours: 0 }
    }
    typeStats[req.type].total++
    if (req.slaStatus === "BREACHED") typeStats[req.type].breached++
    if (req.slaStatus === "MET") typeStats[req.type].met++
    if (req.status !== "BROUILLON") {
      const hours = (new Date(req.updatedAt).getTime() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60)
      typeStats[req.type].totalHours += hours
    }
  })

  const byType = Object.entries(typeStats).map(([type, stats]) => ({
    type,
    total: stats.total,
    breached: stats.breached,
    met: stats.met,
    complianceRate: stats.total > 0 ? (stats.met / stats.total * 100) : 0,
    avgHours: stats.total > 0 ? stats.totalHours / stats.total : 0,
  }))

  const metCount = await prisma.request.count({
    where: {
      ...baseWhere,
      slaStatus: "MET",
    },
  })

  const complianceRate = allRequests.length > 0 ? (metCount / allRequests.length * 100) : 0

  // Breach trend: Daily breach counts for last 30 days
  const breachTrend = []
  for (let i = 29; i >= 0; i--) {
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

  // Total requests
  const totalRequests = await prisma.request.count({ where: baseWhere })

  // Resolved requests for avg resolution
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

  const totalResolutionHours = resolvedRequests.reduce((total: number, req) => {
    return total + (new Date(req.updatedAt).getTime() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60)
  }, 0)

  const averageResolutionHours = resolvedRequests.length > 0
    ? totalResolutionHours / resolvedRequests.length
    : 0

  return NextResponse.json({
    breachedThisMonth: breachedCount,
    breachByType,
    complianceRate,
    metCount,
    byType,
    breachTrend,
    slaStatusDistribution,
    totalRequests,
    averageResolutionHours,
  })
}
