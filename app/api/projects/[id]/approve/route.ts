import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { logAudit } from "@/lib/audit"
import { NextResponse } from "next/server"

// POST /api/projects/[id]/approve - Approve or reject a pending change
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Forbidden - RH only" }, { status: 403 })
  }

  const { id: projectId } = await params
  const body = await req.json()
  const { changeId, action, comment } = body // action: 'APPROVE' | 'REJECT'

  try {
    // Get the pending change
    const change = await prisma.projectChangeHistory.findUnique({
      where: { id: changeId },
      include: { project: true }
    })

    if (!change) {
      return NextResponse.json({ error: "Change not found" }, { status: 404 })
    }

    if (change.projectId !== projectId) {
      return NextResponse.json({ error: "Change does not belong to this project" }, { status: 400 })
    }

    if (action === "APPROVE") {
      // Apply the changes
      const newValues = JSON.parse(change.newValues || '{}')

      const updatedProject = await prisma.project.update({
        where: { id: projectId },
        data: {
          name: newValues.name,
          description: newValues.description,
          startDate: newValues.startDate ? new Date(newValues.startDate) : null,
          endDate: newValues.endDate ? new Date(newValues.endDate) : null,
          priority: newValues.priority,
          status: newValues.status
        },
        include: {
          tasks: true,
          team: { select: { id: true, name: true } }
        }
      })

      // Mark change as approved
      await prisma.projectChangeHistory.update({
        where: { id: changeId },
        data: { approved: true, approvedBy: user.id }
      })

      // Notify the CHEF that their change was approved
      await prisma.notification.create({
        data: {
          employeeId: change.actorId,
          title: "Modification approuvée",
          message: `Votre modification sur le projet "${change.project.name}" a été approuvée par ${user.name}.${comment ? ` Commentaire: ${comment}` : ''}`
        }
      })

      logAudit({
        actorId: user.id,
        actorName: user.name,
        action: "APPROVED",
        entity: "Project",
        entityId: projectId,
        details: { changeId, comment },
      })

      return NextResponse.json({ 
        message: "Modification approuvée",
        project: updatedProject 
      })
    } else if (action === "REJECT") {
      // Mark change as rejected (keep in history for reference)
      await prisma.projectChangeHistory.update({
        where: { id: changeId },
        data: { approvedBy: user.id } // We store approver even for rejection
      })

      // Notify the CHEF that their change was rejected
      await prisma.notification.create({
        data: {
          employeeId: change.actorId,
          title: "Modification rejetée",
          message: `Votre modification sur le projet "${change.project.name}" a été rejetée par ${user.name}.${comment ? ` Raison: ${comment}` : ''}`
        }
      })

      logAudit({
        actorId: user.id,
        actorName: user.name,
        action: "REJECTED",
        entity: "Project",
        entityId: projectId,
        details: { changeId, comment },
      })

      return NextResponse.json({ message: "Modification rejetée" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error processing approval:", error)
    return NextResponse.json({ error: "Failed to process approval" }, { status: 500 })
  }
}

// GET /api/projects/[id]/approve - Get pending changes for a project
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "RH") {
    return NextResponse.json({ error: "Forbidden - RH only" }, { status: 403 })
  }

  const { id: projectId } = await params

  try {
    const pendingChanges = await prisma.projectChangeHistory.findMany({
      where: { 
        projectId,
        approved: false
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(pendingChanges)
  } catch (error) {
    console.error("Error fetching pending changes:", error)
    return NextResponse.json({ error: "Failed to fetch pending changes" }, { status: 500 })
  }
}