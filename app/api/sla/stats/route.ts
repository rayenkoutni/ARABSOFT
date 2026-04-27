import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const breachedCount = await prisma.request.count({
    where: {
      slaBreached: true,
      createdAt: { gte: startOfMonth },
    },
  })

  const breachByType = await prisma.request.groupBy({
    by: ['type'],
    where: {
      slaBreached: true,
      createdAt: { gte: startOfMonth },
    },
    _count: { type: true },
  })

  return NextResponse.json({ breachedThisMonth: breachedCount, breachByType })
}