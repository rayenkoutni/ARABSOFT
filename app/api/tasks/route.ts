import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { logAudit } from "@/lib/audit"
import { NextResponse } from "next/server"
import { ZodError } from "zod"
import {
  TaskInputError,
  taskCreateInputSchema,
  taskWithRelationsInclude,
  validateTaskRequiredSkills,
} from "@/lib/tasks"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Non autorise" }, { status: 401 })

  if (user.role === "RH") {
    return NextResponse.json(await prisma.task.findMany({
      include: taskWithRelationsInclude,
    }))
  }

  if (user.role === "CHEF") {
    const teamIds = await prisma.employee.findMany({
      where: { managerId: user.id }, select: { id: true }
    })
    return NextResponse.json(await prisma.task.findMany({
      where: { assigneeId: { in: teamIds.map((e: { id: string }) => e.id) } },
      include: taskWithRelationsInclude,
    }))
  }

  return NextResponse.json(await prisma.task.findMany({
    where: { assigneeId: user.id },
    include: taskWithRelationsInclude,
  }))
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role === "RH")
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 })

  try {
    const body = await req.json()
    const projectId = typeof body?.projectId === "string" ? body.projectId : ""

    if (!projectId) {
      return NextResponse.json({ error: "Le projet cible est obligatoire." }, { status: 400 })
    }

    const input = taskCreateInputSchema.parse(body)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { team: { select: { id: true } } },
    })

    if (!project) {
      return NextResponse.json({ error: "Projet introuvable" }, { status: 404 })
    }

    if (user.role === "CHEF") {
      const teamMembers = await prisma.employee.findMany({
        where: { managerId: user.id },
        select: { id: true },
      })
      const teamIds = teamMembers.map((employee: { id: string }) => employee.id)
      const isAuthorized =
        project.createdById === user.id ||
        project.managerId === user.id ||
        project.team.some((member: { id: string }) => teamIds.includes(member.id))

      if (!isAuthorized) {
        return NextResponse.json({ error: "Acces refuse a ce projet" }, { status: 403 })
      }

      if (!teamIds.includes(input.assigneeId)) {
        return NextResponse.json(
          { error: "Vous ne pouvez assigner qu'aux membres de votre equipe" },
          { status: 400 }
        )
      }
    }

    if (user.role === "COLLABORATEUR") {
      const isProjectMember = project.team.some((member: { id: string }) => member.id === user.id)

      if (!isProjectMember) {
        return NextResponse.json({ error: "Acces refuse a ce projet" }, { status: 403 })
      }

      if (input.assigneeId !== user.id) {
        return NextResponse.json(
          { error: "Vous ne pouvez assigner des taches qu'a vous-meme" },
          { status: 400 }
        )
      }

      if (input.requiredSkills.length > 0) {
        return NextResponse.json(
          { error: "Seul un chef peut definir des competences requises pour une tache." },
          { status: 403 }
        )
      }
    }

    const requiredSkills = await validateTaskRequiredSkills(prisma, input.requiredSkills)
    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        assigneeId: input.assigneeId,
        projectId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: "TODO",
        requiredSkills: requiredSkills.length > 0
          ? {
              create: requiredSkills.map((requiredSkill) => ({
                skillId: requiredSkill.skillId,
                minimumLevel: requiredSkill.minimumLevel,
              })),
            }
          : undefined,
      },
      include: taskWithRelationsInclude,
    })

    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "CREATED",
      entity: "Task",
      entityId: task.id,
      details: { title: task.title, status: task.status, projectId },
    })

    return NextResponse.json(task)
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
