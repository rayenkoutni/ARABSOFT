import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { NextResponse } from "next/server"

// GET /api/conversations - Get all conversations for the logged-in user
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get all conversations where the user is a participant
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: user.id }
        }
      },
      include: {
        participants: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true
          }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    })

    // Get unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conversation) => {
        // Count messages not read by current user (via MessageRead table)
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: user.id },
            reads: {
              none: {
                employeeId: user.id
              }
            }
          }
        })

        const lastMessage = conversation.messages[0] || null

        return {
          id: conversation.id,
          type: conversation.type,
          name: conversation.name,
          participants: conversation.participants,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            senderName: lastMessage.sender.name,
            createdAt: lastMessage.createdAt
          } : null,
          unreadCount,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt
        }
      })
    )

    return NextResponse.json(conversationsWithUnread)
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    )
  }
}

// POST /api/conversations - Create or find a conversation
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { type, name, participantIds } = body

    if (!type || !participantIds || !Array.isArray(participantIds)) {
      return NextResponse.json(
        { error: "Missing required fields: type, participantIds" },
        { status: 400 }
      )
    }

    // For PRIVATE conversations
    if (type === "PRIVATE") {
      if (participantIds.length !== 1) {
        return NextResponse.json(
          { error: "Private conversations must have exactly one other participant" },
          { status: 400 }
        )
      }

      const otherUserId = participantIds[0]

      // Check if the other user exists
      const otherUser = await prisma.employee.findUnique({
        where: { id: otherUserId },
        select: { id: true, name: true, email: true, role: true }
      })

      if (!otherUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        )
      }

      // Find existing private conversation between the two users
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          type: "PRIVATE",
          AND: [
            { participants: { some: { id: user.id } } },
            { participants: { some: { id: otherUserId } } }
          ]
        },
        include: {
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      })

      if (existingConversation) {
        return NextResponse.json(existingConversation)
      }

      // Create new private conversation
      const newConversation = await prisma.conversation.create({
        data: {
          type: "PRIVATE",
          participants: {
            connect: [{ id: user.id }, { id: otherUserId }]
          }
        },
        include: {
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      })

      return NextResponse.json(newConversation, { status: 201 })
    }

    // For GROUP conversations
    if (type === "GROUP") {
      if (!name) {
        return NextResponse.json(
          { error: "Group conversations must have a name" },
          { status: 400 }
        )
      }

      if (participantIds.length < 1) {
        return NextResponse.json(
          { error: "Group conversations must have at least one participant" },
          { status: 400 }
        )
      }

      // Validate all participant IDs exist
      const participants = await prisma.employee.findMany({
        where: { id: { in: participantIds } },
        select: { id: true }
      })

      if (participants.length !== participantIds.length) {
        return NextResponse.json(
          { error: "One or more participant IDs are invalid" },
          { status: 400 }
        )
      }

      // Create group conversation
      const newConversation = await prisma.conversation.create({
        data: {
          type: "GROUP",
          name,
          participants: {
            connect: [{ id: user.id }, ...participantIds.map((id: string) => ({ id }))]
          }
        },
        include: {
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      })

      return NextResponse.json(newConversation, { status: 201 })
    }

    return NextResponse.json(
      { error: "Invalid conversation type" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error creating conversation:", error)
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    )
  }
}
