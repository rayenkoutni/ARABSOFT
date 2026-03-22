import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (user.role === "RH") {
    return NextResponse.json(await prisma.task.findMany({
      include: { assignee: { select: { name: true } } }
    }))
  }

  if (user.role === "CHEF") {
    const teamIds = await prisma.employee.findMany({
      where: { managerId: user.id }, select: { id: true }
    })
    return NextResponse.json(await prisma.task.findMany({
      where: { assigneeId: { in: teamIds.map((e: { id: string }) => e.id) } },
      include: { assignee: { select: { name: true } } }
    }))
  }

  return NextResponse.json(await prisma.task.findMany({
    where: { assigneeId: user.id }
  }))
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role === "COLLABORATEUR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const task = await prisma.task.create({ data: body })
  return NextResponse.json(task)
}
