import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

// GET /api/conversations/[id]/messages - Get paginated messages for a conversation
export async function GET(
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

    // Parse pagination parameters
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get("page") || "1", 10)
    const limit = parseInt(url.searchParams.get("limit") || "30", 10)
    const skip = (page - 1) * limit

    // Get messages with pagination
    const [messages, totalCount] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        include: {
           sender: {
             select: {
               id: true,
               name: true,
               email: true,
               role: true,
               avatar: true
             }
           }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.message.count({
        where: { conversationId }
      })
    ])

    // Mark messages as read for the current user (via MessageRead table)
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        reads: {
          none: {
            employeeId: user.id
          }
        }
      },
      select: { id: true }
    })

    // Create MessageRead records for all unread messages
    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map(msg => ({
          messageId: msg.id,
          employeeId: user.id
        }))
      })
    }

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    )
  }
}
