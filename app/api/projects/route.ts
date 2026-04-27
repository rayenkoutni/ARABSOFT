import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { requireAuth, checkProjectAccess, getManagerTeamIds } from "@/lib/api-middleware"
import { logAudit } from "@/lib/audit"
import { ROLE, HTTP_STATUS } from "@/lib/constants"
import { taskWithRelationsInclude } from "@/lib/tasks"

// GET /api/projects - List all projects (role-based)
export async function GET(req: Request) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { user } = auth

  const url = new URL(req.url)
  const projectId = url.searchParams.get("projectId")

  // Get single project with details
  if (projectId) {
    const accessCheck = await checkProjectAccess(user.id, user.role, projectId)
    if (!accessCheck.access) {
      return NextResponse.json({ error: accessCheck.error }, { 
        status: accessCheck.project ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.NOT_FOUND 
      })
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: { include: taskWithRelationsInclude },
        team: { select: { id: true, name: true, avatar: true } },
        changeHistory: { orderBy: { createdAt: "desc" }, take: 20 }
      }
    })

    return NextResponse.json(project)
  }

  // Get projects list based on role
  let whereClause = {}
  
  if (user.role === ROLE.EMPLOYEE) {
    whereClause = { team: { some: { id: user.id } } }
  } else if (user.role === ROLE.MANAGER) {
    const teamIds = await getManagerTeamIds(user.id)
    whereClause = {
      OR: [
        { createdById: user.id },
        { managerId: user.id },
        { team: { some: { id: { in: teamIds } } } }
      ]
    }
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      tasks: { include: taskWithRelationsInclude },
      team: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  })

  return NextResponse.json(projects)
}

// POST /api/projects - Create a new project (CHEF only)
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { user } = auth

  if (user.role !== ROLE.MANAGER) {
    return NextResponse.json(
      { error: "Accès refusé: seul un chef peut créer un projet" }, 
      { status: HTTP_STATUS.FORBIDDEN }
    )
  }

  try {
    const body = await req.json()
    const { name, description, startDate, endDate, priority, teamMemberIds } = body

    // Validate team members are in manager's team
    if (teamMemberIds?.length > 0) {
      const validTeamIds = await getManagerTeamIds(user.id)
      const invalidMembers = teamMemberIds.filter((id: string) => !validTeamIds.includes(id))
      
      if (invalidMembers.length > 0) {
        return NextResponse.json(
          { error: "Vous ne pouvez assigner que des membres de votre équipe" },
          { status: HTTP_STATUS.BAD_REQUEST }
        )
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        priority: priority || "MEDIUM",
        managerId: user.id,
        createdById: user.id,
        createdByRole: user.role,
        status: "EN_COURS",
        team: teamMemberIds?.length > 0 
          ? { connect: teamMemberIds.map((id: string) => ({ id })) }
          : undefined
      },
      include: {
        tasks: { include: taskWithRelationsInclude },
        team: { select: { id: true, name: true } }
      }
    })

    // Create notifications for assigned team members
    if (teamMemberIds?.length > 0) {
      await prisma.notification.createMany({
        data: teamMemberIds.map((memberId: string) => ({
          employeeId: memberId,
          title: "Nouveau projet assigné",
          message: `Vous avez été assigné au projet "${name}"`
        }))
      })
    }

    logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CREATED",
    entity: "Project",
    entityId: project.id,
    details: { name: project.name, status: project.status },
  })

  return NextResponse.json(project)
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json(
      { error: "Failed to create project" }, 
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}
