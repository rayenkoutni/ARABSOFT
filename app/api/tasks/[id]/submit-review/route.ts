import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== "COLLABORATEUR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const { id: taskId } = await params
  const body = await req.json()
  const { deliverableLink, deliverableNote } = body

  if (!deliverableLink && !deliverableNote) {
    return NextResponse.json(
      { error: "Veuillez fournir au moins un lien ou une note pour le livrable" },
      { status: 400 }
    )
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: { select: { managerId: true } } },
    })

    if (!task) {
      return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 })
    }

    if (task.assigneeId !== user.id) {
      return NextResponse.json({ error: "Vous n'êtes pas assigné à cette tâche" }, { status: 403 })
    }

    if (task.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Seules les tâches en cours peuvent être soumises pour révision" }, { status: 400 })
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "IN_REVIEW",
        submittedForReview: true,
        deliverableLink: deliverableLink || null,
        deliverableNote: deliverableNote || null,
      },
    })

    return NextResponse.json({ success: true, task: updatedTask })
  } catch (error) {
    console.error("Error submitting task for review:", error)
    return NextResponse.json({ error: "Erreur lors de la soumission" }, { status: 500 })
  }
}