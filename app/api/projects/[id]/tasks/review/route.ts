import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

// PATCH /api/projects/[id]/tasks/review - Review a task (accept or request revision) (CHEF only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "CHEF") {
    return NextResponse.json({ error: "Accès refusé: seul un chef peut réviser les tâches" }, { status: 403 })
  }

  const { id: projectId } = await params
  const body = await req.json()
  const { taskId, action, comment } = body

  if (!taskId || !action) {
    return NextResponse.json({ error: "taskId and action are required" }, { status: 400 })
  }

  if (action !== "accept" && action !== "request_revision") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  // Check if CHEF has access to this project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { select: { id: true } } }
  })
  if (project) {
    const teamMembers = await prisma.employee.findMany({
      where: { managerId: user.id },
      select: { id: true }
    })
    const teamIds = teamMembers.map(e => e.id)
    const isAuthorized = 
      project.createdById === user.id ||
      project.managerId === user.id ||
      project.team.some((member: { id: string }) => teamIds.includes(member.id))
    if (!isAuthorized) {
      return NextResponse.json({ error: "Accès refusé à ce projet" }, { status: 403 })
    }
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { name: true } },
        project: { select: { name: true } }
      }
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Verify the task is submitted for review
    const taskAny = task as any
    if (!taskAny.submittedForReview) {
      return NextResponse.json({ error: "Cette tâche n'est pas soumise pour révision" }, { status: 400 })
    }

    // For CHEF, verify the task belongs to their team
    if (user.role === "CHEF") {
      const teamMembers = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true }
      })
      const teamIds = teamMembers.map(e => e.id)
      
      if (!teamIds.includes(task.assigneeId)) {
        return NextResponse.json({ error: "Vous ne pouvez pas réviser les tâches d'autres équipes" }, { status: 403 })
      }
    }

    let updatedTask
    const projectName = task.project?.name || "Projet"

    if (action === "accept") {
      // Accept the task - mark as DONE
      updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "DONE",
          submittedForReview: false,
          reviewedById: user.id,
          reviewedAt: new Date()
        } as any
      })

      // Notify the collaborateur that their task was accepted
      await prisma.notification.create({
        data: {
          employeeId: task.assigneeId,
          title: "Tâche acceptée ✅",
          message: `Votre tâche "${task.title}" a été acceptée dans le projet "${projectName}"`
        }
      })
    } else {
      // Request revision - send back to IN_PROGRESS
      updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "IN_PROGRESS",
          submittedForReview: false,
          reviewComment: comment || null,
          reviewedById: user.id,
          reviewedAt: new Date()
        } as any
      })

      // Notify the collaborateur that revision is requested
      await prisma.notification.create({
        data: {
          employeeId: task.assigneeId,
          title: "Révision requise 🔄",
          message: comment 
            ? `Révision requise pour votre tâche "${task.title}". Commentaire: ${comment}`
            : `Révision requise pour votre tâche "${task.title}" dans le projet "${projectName}"`
        }
      })
    }

    // Update project progress
    const allTasks = await prisma.task.findMany({ where: { projectId } })
    const completedTasks = allTasks.filter(t => t.status === "DONE").length
    const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0

    await prisma.project.update({
      where: { id: projectId },
      data: { progress }
    })

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: action === "accept" ? "Tâche acceptée" : "Révision demandée"
    })

  } catch (error) {
    console.error("Error reviewing task:", error)
    return NextResponse.json({ error: "Failed to review task" }, { status: 500 })
  }
}