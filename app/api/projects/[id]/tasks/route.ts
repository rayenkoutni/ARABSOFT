import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"
import { ZodError } from "zod"
import {
  TaskInputError,
  taskCreateInputSchema,
  taskWithRelationsInclude,
  validateTaskRequiredSkills,
} from "@/lib/tasks"

// PATCH /api/projects/[id]/tasks - Update task status (or create task) with notifications
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  if (user.role === "RH") {
    return NextResponse.json({ error: "Acces refuse: les RH ne peuvent pas modifier les taches" }, { status: 403 })
  }

  const { id: projectId } = await params
  const body = await req.json()

  if (user.role === "CHEF") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { team: { select: { id: true } } }
    })
    if (!project) {
      return NextResponse.json({ error: "Projet introuvable" }, { status: 404 })
    }

    const teamMembers = await prisma.employee.findMany({
      where: { managerId: user.id },
      select: { id: true }
    })
    const teamIds = teamMembers.map((employee: { id: string }) => employee.id)
    const isAuthorized =
      project.createdById === user.id ||
      project.managerId === user.id ||
      project.team.some((member: { id: string }) => teamIds.includes(member.id))

    if (!isAuthorized) {
      return NextResponse.json({ error: "Acces refuse a ce projet" }, { status: 403 })
    }
  }

  if (body.taskId) {
    const { taskId, status } = body

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) {
      return NextResponse.json({ error: "Tache introuvable" }, { status: 404 })
    }

    if (user.role === "COLLABORATEUR") {
      if (task.assigneeId !== user.id) {
        return NextResponse.json({ error: "Vous ne pouvez pas modifier les taches d'autres utilisateurs" }, { status: 403 })
      }

      const allowedTransitions: Record<string, string[]> = {
        TODO: ["IN_PROGRESS"],
        IN_PROGRESS: ["IN_REVIEW"],
        IN_REVIEW: [],
        DONE: [],
      }

      if (!allowedTransitions[task.status]?.includes(status)) {
        return NextResponse.json(
          { error: "Vous ne pouvez pas effectuer cette transition de statut" },
          { status: 403 }
        )
      }
    }

    if (user.role === "CHEF") {
      const teamMembers = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true }
      })
      const teamIds = teamMembers.map((employee: { id: string }) => employee.id)

      if (!teamIds.includes(task.assigneeId)) {
        return NextResponse.json({ error: "Vous ne pouvez pas modifier les taches d'autres equipes" }, { status: 403 })
      }
    }

    const updateData: Record<string, unknown> = { status }

    if (status === "IN_REVIEW") {
      updateData.submittedForReview = true

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true }
      })

      const managers = await prisma.employee.findMany({
        where: { role: "CHEF" },
        select: { id: true }
      })

      const assignee = await prisma.employee.findUnique({
        where: { id: task.assigneeId },
        select: { name: true }
      })

      if (managers.length > 0 && assignee) {
        await prisma.notification.createMany({
          data: managers.map((manager: { id: string }) => ({
            employeeId: manager.id,
            title: "Tache soumise pour revision",
            message: `"${assignee.name}" a soumis la tache "${task.title}" pour revision dans le projet "${project?.name}"`,
          }))
        })
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: taskWithRelationsInclude,
    })

    const allTasks = await prisma.task.findMany({ where: { projectId } })
    const completedTasks = allTasks.filter((projectTask: { status: string }) => projectTask.status === "DONE").length
    const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0

    await prisma.project.update({
      where: { id: projectId },
      data: { progress }
    })

    return NextResponse.json(updatedTask)
  }

  if (user.role !== "CHEF" && user.role !== "COLLABORATEUR") {
    return NextResponse.json({ error: "Acces refuse: seuls les chefs et collaborateurs peuvent creer des taches" }, { status: 403 })
  }

  try {
    const input = taskCreateInputSchema.parse(body)

    if (user.role === "CHEF") {
      const teamMembers = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true }
      })
      const teamIds = teamMembers.map((employee: { id: string }) => employee.id)

      if (!teamIds.includes(input.assigneeId)) {
        return NextResponse.json(
          { error: "Vous ne pouvez assigner qu'aux membres de votre equipe" },
          { status: 400 }
        )
      }
    }

    if (user.role === "COLLABORATEUR" && input.assigneeId !== user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez assigner des taches qu'a vous-meme" },
        { status: 400 }
      )
    }

    if (user.role === "COLLABORATEUR" && input.requiredSkills.length > 0) {
      return NextResponse.json(
        { error: "Seul un chef peut definir des competences requises pour une tache." },
        { status: 403 }
      )
    }

    const requiredSkills = await validateTaskRequiredSkills(prisma, input.requiredSkills)
    const project = await prisma.project.findUnique({ where: { id: projectId } })

    const newTask = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdTask = await tx.task.create({
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority || "MEDIUM",
          status: "TODO",
          assigneeId: input.assigneeId,
          projectId,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          requiredSkills: requiredSkills.length > 0
            ? {
                create: requiredSkills.map((requiredSkill: { skillId: string; minimumLevel: number }) => ({
                  skillId: requiredSkill.skillId,
                  minimumLevel: requiredSkill.minimumLevel,
                })),
              }
            : undefined,
        },
        include: taskWithRelationsInclude,
      })

      const allTasks = await tx.task.findMany({ where: { projectId } })
      const completedTasks = allTasks.filter((projectTask: { status: string }) => projectTask.status === "DONE").length
      const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0

      await tx.project.update({
        where: { id: projectId },
        data: { progress }
      })

      return createdTask
    })

    if (input.assigneeId !== user.id) {
      await prisma.notification.create({
        data: {
          employeeId: input.assigneeId,
          title: "Nouvelle tache assignee",
          message: `Une nouvelle tache "${input.title}" vous a ete assignee dans le projet "${project?.name}".${input.dueDate ? ` Echeance: ${new Date(input.dueDate).toLocaleDateString()}` : ""}`,
        }
      })
    }

    if (input.dueDate) {
      const dueDateObj = new Date(input.dueDate)
      const now = new Date()
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

      if (dueDateObj <= twoDaysFromNow && dueDateObj > now) {
        await prisma.notification.create({
          data: {
            employeeId: input.assigneeId,
            title: "Echeance proche",
            message: `La tache "${input.title}" arrive a echeance le ${dueDateObj.toLocaleDateString()} dans le projet "${project?.name}"`,
          }
        })
      }
    }

    return NextResponse.json(newTask)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Charge utile de creation de tache invalide." },
        { status: 400 }
      )
    }

    if (error instanceof TaskInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Error creating task:", error)
    return NextResponse.json({ error: "Erreur lors de la creation de la tache" }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/tasks - Delete a task
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  if (user.role === "RH") {
    return NextResponse.json({ error: "Acces refuse: les RH ne peuvent pas supprimer des taches" }, { status: 403 })
  }

  const url = new URL(req.url)
  const taskId = url.searchParams.get("taskId")

  if (!taskId) {
    return NextResponse.json({ error: "Task ID required" }, { status: 400 })
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true }
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (user.role === "CHEF") {
      const teamMembers = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true }
      })
      const teamIds = teamMembers.map((employee: { id: string }) => employee.id)

      if (!teamIds.includes(task.assigneeId)) {
        return NextResponse.json({ error: "Vous ne pouvez pas supprimer les taches d'autres equipes" }, { status: 403 })
      }
    }

    if (user.role === "COLLABORATEUR" && task.assigneeId !== user.id) {
      return NextResponse.json({ error: "Vous ne pouvez pas supprimer les taches d'autres utilisateurs" }, { status: 403 })
    }

    await prisma.task.delete({ where: { id: taskId } })

    if (task.projectId) {
      const allTasks = await prisma.task.findMany({ where: { projectId: task.projectId } })
      const completedTasks = allTasks.filter((projectTask: { status: string }) => projectTask.status === "DONE").length
      const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0

      await prisma.project.update({
        where: { id: task.projectId },
        data: { progress }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
  }
}
