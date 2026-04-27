import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const configs = await prisma.slaConfig.findMany()
  return NextResponse.json(configs)
}