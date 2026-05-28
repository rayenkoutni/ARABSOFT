import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }
  if (user.role !== "CHEF") {
    return NextResponse.json({ error: "Acces refuse: seul un chef peut reviser les taches" }, { status: 403 })
  }

  const { id: projectId } = await params

  try {
    const body = await req.json()
    const { taskId, action, comment, taskScore } = body

    if (!taskId || !action) {
      return NextResponse.json({ error: "taskId and action are required" }, { status: 400 })
    }

    if (action !== "accept" && action !== "request_revision") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { team: { select: { id: true } } },
    })

    if (!project) {
      return NextResponse.json({ error: "Projet introuvable" }, { status: 404 })
    }

    const teamMembers = await prisma.employee.findMany({
      where: { managerId: user.id },
      select: { id: true },
    })
    const teamIds = teamMembers.map((employee) => employee.id)
    const isAuthorized =
      project.createdById === user.id ||
      project.managerId === user.id ||
      project.team.some((member) => teamIds.includes(member.id))

    if (!isAuthorized) {
      return NextResponse.json({ error: "Acces refuse a ce projet" }, { status: 403 })
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { name: true } },
        project: { select: { name: true } },
      },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (!task.submittedForReview) {
      return NextResponse.json({ error: "Cette tache n'est pas soumise pour revision" }, { status: 400 })
    }

    if (!teamIds.includes(task.assigneeId)) {
      return NextResponse.json({ error: "Vous ne pouvez pas reviser les taches d'autres equipes" }, { status: 403 })
    }

    let updatedTask
    const projectName = task.project?.name || "Projet"

    if (action === "accept") {
      const score = Number(taskScore)
      if (Number.isNaN(score) || score < 1 || score > 10) {
        return NextResponse.json(
          { error: "Un score entre 1 et 10 est requis pour approuver une tache" },
          { status: 400 },
        )
      }

      updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "DONE",
          submittedForReview: false,
          reviewedById: user.id,
          reviewedAt: new Date(),
          taskScore: score,
        },
      })

      await prisma.notification.create({
        data: {
          employeeId: task.assigneeId,
          title: "Tache acceptee",
          message: `Votre tache "${task.title}" a ete acceptee dans le projet "${projectName}"`,
        },
      })
    } else {
      updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "IN_PROGRESS",
          submittedForReview: false,
          deliverableLink: null,
          deliverableNote: null,
          reviewComment: comment || null,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      })

      await prisma.notification.create({
        data: {
          employeeId: task.assigneeId,
          title: "Revision requise",
          message: comment
            ? `Revision requise pour votre tache "${task.title}". Commentaire: ${comment}`
            : `Revision requise pour votre tache "${task.title}" dans le projet "${projectName}"`,
        },
      })
    }

    const allTasks = await prisma.task.findMany({ where: { projectId } })
    const completedTasks = allTasks.filter((item) => item.status === "DONE").length
    const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0

    await prisma.project.update({
      where: { id: projectId },
      data: { progress },
    })

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: action === "accept" ? "Tache acceptee" : "Revision demandee",
    })
  } catch (error) {
    console.error("Error reviewing task:", error)
    return NextResponse.json({ error: "Failed to review task" }, { status: 500 })
  }
}
