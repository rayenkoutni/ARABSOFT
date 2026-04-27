import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

// PATCH /api/conversations/[id]/read - Mark all messages in a conversation as read
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: conversationId } = await params

  try {
    // Check if user is a participant in the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          select: { id: true }
        }
      }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      )
    }

    const isParticipant = conversation.participants.some(
      (p) => p.id === user.id
    )

    if (!isParticipant) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // Find messages in the conversation not sent by me and not already read by me
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        NOT: {
          reads: {
            some: { employeeId: user.id }
          }
        }
      },
      select: { id: true }
    })

    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map(m => ({
          messageId: m.id,
          employeeId: user.id
        })),
        skipDuplicates: true
      })
    }

    return NextResponse.json({
      success: true,
      markedCount: unreadMessages.length
    })
  } catch (error) {
    console.error("Error marking messages as read:", error)
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    )
  }
}
