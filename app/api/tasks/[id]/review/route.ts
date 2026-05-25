import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== "CHEF") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const { id: taskId } = await params
  const body = await req.json()
  const { decision, reviewComment, taskScore } = body

  if (!decision || !["APPROVE", "REJECT"].includes(decision)) {
    return NextResponse.json({ error: "decision doit être APPROVE ou REJECT" }, { status: 400 })
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { managerId: true } },
      },
    })

    if (!task) {
      return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 })
    }

    // Check that the chef manages the assignee
    if (task.assignee?.managerId !== user.id) {
      return NextResponse.json({ error: "Vous ne pouvez réviser que les tâches de votre équipe" }, { status: 403 })
    }

    if (!task.submittedForReview) {
      return NextResponse.json({ error: "Cette tâche n'est pas soumise pour révision" }, { status: 400 })
    }

    let updateData: any = {}

    if (decision === "APPROVE") {
      const score = Number(taskScore)
      if (!taskScore || isNaN(score) || score < 1 || score > 10) {
        return NextResponse.json(
          { error: "Un score entre 1 et 10 est requis pour approuver une tâche" },
          { status: 400 }
        )
      }
      updateData = {
        status: "DONE",
        submittedForReview: false,
        reviewedById: user.id,
        reviewedAt: new Date(),
        taskScore: score,
      }
    } else {
      // REJECT
      updateData = {
        status: "IN_PROGRESS",
        submittedForReview: false,
        deliverableLink: null,
        deliverableNote: null,
        reviewComment: reviewComment || null,
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    })

    return NextResponse.json({ success: true, task: updatedTask })
  } catch (error) {
    console.error("Error reviewing task:", error)
    return NextResponse.json({ error: "Erreur lors de la révision" }, { status: 500 })
  }
}