import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

// GET /api/employees/chat - Get employees available for chat based on role
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    let employees

    // RH can chat with everyone
    if (user.role === "RH") {
      employees = await prisma.employee.findMany({
        where: { id: { not: user.id } }, // Exclude current user
        select: { 
          id: true, 
          name: true, 
          email: true, 
          role: true, 
          department: true, 
          position: true,
          avatar: true
        },
        orderBy: { name: "asc" }
      })
    }
    // CHEF can chat with their team members and RH
    else if (user.role === "CHEF") {
      employees = await prisma.employee.findMany({
        where: {
          id: { not: user.id }, // Exclude current user
          OR: [
            { managerId: user.id }, // Team members
            { role: "RH" } // RH employees
          ]
        },
        select: { 
          id: true, 
          name: true, 
          email: true, 
          role: true, 
          department: true, 
          position: true,
          avatar: true
        },
        orderBy: { name: "asc" }
      })
    }
    // COLLABORATEUR can chat with their chef and RH
    else {
      const whereClause: any = {
        id: { not: user.id }, // Exclude current user
        role: "RH" // RH employees
      }
      
      // Add manager if exists
      if (user.managerId) {
        whereClause.OR = [
          { id: user.managerId }, // Their chef
          { role: "RH" } // RH employees
        ]
        delete whereClause.role
      }
      
      employees = await prisma.employee.findMany({
        where: whereClause,
        select: { 
          id: true, 
          name: true, 
          email: true, 
          role: true, 
          department: true, 
          position: true,
          avatar: true
        },
        orderBy: { name: "asc" }
      })
    }

    return NextResponse.json(employees)
  } catch (error) {
    console.error("Error fetching employees for chat:", error)
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    )
  }
}
