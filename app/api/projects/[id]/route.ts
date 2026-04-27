import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { requireAuth, checkProjectAccess, getManagerTeamIds, errorResponse } from "@/lib/api-middleware"
import { logAudit } from "@/lib/audit"
import { ROLE, HTTP_STATUS } from "@/lib/constants"
import { taskWithRelationsInclude } from "@/lib/tasks"

// PATCH /api/projects/[id] - Update project (CHEF only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { user } = auth

  const { id } = await params

  try {
    const body = await req.json()
    const { name, description, startDate, endDate, priority, status, teamMemberIds } = body

    // Check access to project
    const accessCheck = await checkProjectAccess(user.id, user.role, id)
    if (!accessCheck.access) {
      return errorResponse((accessCheck as any).error || '', accessCheck.project ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.NOT_FOUND)
    }
    
    const project = accessCheck.project!

    // Only managers can update projects
    if (user.role !== ROLE.MANAGER && user.role !== ROLE.HR) {
      return errorResponse("Accès refusé: seul un chef peut modifier un projet", HTTP_STATUS.FORBIDDEN)
    }

    // Check permissions:
    // - RH can edit any project
    // - CHEF can edit their own projects freely
    // - CHEF trying to edit RH project → requires approval
    
    const isRHProject = project.createdByRole === "RH"
    const isOwnProject = project.createdById === user.id

    if (user.role === "CHEF" && isRHProject && !isOwnProject) {
      // CHEF editing RH project - create a change request instead of applying directly
      const oldValues = JSON.stringify({
        name: project.name,
        description: project.description,
        startDate: project.startDate?.toISOString(),
        endDate: project.endDate?.toISOString(),
        priority: project.priority,
        status: project.status
      })
      
      const newValues = JSON.stringify({
        name,
        description,
        startDate,
        endDate,
        priority,
        status
      })

      // Create change history entry
      const changeHistory = await prisma.projectChangeHistory.create({
        data: {
          projectId: id,
          actorId: user.id,
          actorName: user.name,
          action: "MODIFICATION",
          oldValues,
          newValues,
          approved: false
        }
      })

      // Notify RH about the pending change
      const rhUsers = await prisma.employee.findMany({ where: { role: "RH" } })
      if (rhUsers.length > 0) {
        await prisma.notification.createMany({
          data: rhUsers.map((rh: { id: string }) => ({
            employeeId: rh.id,
            title: "Modification en attente d'approbation",
            message: `${user.name} a demandé une modification sur le projet "${project.name}". Veuillez approuver ou rejeter.`
          }))
        })
      }

      return NextResponse.json({ 
        message: "Modification soumise pour approbation",
        changeHistory,
        requiresApproval: true 
      })
    }

    // For RH or own CHEF projects - apply changes directly
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(priority && { priority }),
        ...(status && { status }),
        ...(teamMemberIds && {
          team: {
            set: teamMemberIds.map((teamMemberId: string) => ({ id: teamMemberId }))
          }
        })
      },
      include: {
        tasks: { include: taskWithRelationsInclude },
         team: { select: { id: true, name: true, avatar: true } }
      }
    })

    // Log the change in history
    await prisma.projectChangeHistory.create({
      data: {
        projectId: id,
        actorId: user.id,
        actorName: user.name,
        action: "MODIFICATION",
        approved: true
      }
    })

    logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATED",
    entity: "Project",
    entityId: id,
    details: { name: updatedProject.name },
  })

  return NextResponse.json(updatedProject)
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - Delete project (CHEF only)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { user } = auth

  const { id } = await params

  try {
    // Check access to project
    const accessCheck = await checkProjectAccess(user.id, user.role, id)
    if (!accessCheck.access) {
      return errorResponse((accessCheck as any).error || '', accessCheck.project ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.NOT_FOUND)
    }
    
    const project = accessCheck.project!

    // Only managers can delete projects
    if (user.role !== ROLE.MANAGER && user.role !== ROLE.HR) {
      return errorResponse("Accès refusé: seul un chef peut supprimer un projet", HTTP_STATUS.FORBIDDEN)
    }

    // CHEF can only delete their own projects
    if (user.role === ROLE.MANAGER && project.createdById !== user.id) {
      return errorResponse("Vous ne pouvez pas supprimer ce projet", HTTP_STATUS.FORBIDDEN)
    }

    // Delete associated tasks and history first
    await prisma.task.deleteMany({ where: { projectId: id } })
    await prisma.projectChangeHistory.deleteMany({ where: { projectId: id } })
    
    // Delete project
    await prisma.project.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
