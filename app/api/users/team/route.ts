import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"
import { findNearestLeavePeriodInWindow } from "@/lib/leave-request"

// GET /api/users/team - Get the team members for the current CHEF
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Only CHEF can access this endpoint to get their team
  if (user.role !== "CHEF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const teamMembers = await prisma.employee.findMany({
      where: { managerId: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        position: true,
        managerId: true,
        requests: {
          where: {
            type: "CONGE",
            status: "APPROUVE",
            startDate: { not: null },
            endDate: { not: null },
          },
          select: {
            startDate: true,
            endDate: true,
          },
          orderBy: {
            startDate: "asc",
          },
        },
      }
    })

    return NextResponse.json(
      teamMembers.map((teamMember: (typeof teamMembers)[number]) => {
        const { requests, ...member } = teamMember

        return {
          ...member,
          upcomingApprovedLeave: findNearestLeavePeriodInWindow(requests),
        }
      })
    )
  } catch (error) {
    console.error("Error fetching team members:", error)
    return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 })
  }
}
