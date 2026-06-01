import { prisma } from '@/lib/services/prisma.service';
import { kafkaService } from '@/lib/services/server/kafka.service';
import { socketService } from '@/lib/services/server/socket.service';
import { KAFKA } from '@/lib/constants';
import type { CurrentUser } from '@/lib/services/server/auth.service';
import { AppError } from '@/lib/errors';

class ChatService {
  async init() {
    await kafkaService.initProducer();
    await kafkaService.subscribe(KAFKA.TOPICS.CHAT_MESSAGES, this.handleIncomingMessage.bind(this));
  }

  private async handleIncomingMessage(payload: any) {
    const { senderId, conversationId, content, recipientId } = payload;

    try {
      // Validate sender exists
      const sender = await prisma.employee.findUnique({ where: { id: senderId } });
      if (!sender) {
        return;
      }

      // Validate conversation exists
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation) {
        return;
      }

      // Save message to database
      const savedMessage = await prisma.message.create({
        data: {
          content,
          senderId,
          conversationId,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      // Emit to recipient
      socketService.emitToUser(recipientId, 'new_message', savedMessage);
      
      // Emit to sender's other sockets
      socketService.emitToUser(senderId, 'message_sent', savedMessage);

    } catch (error) {
      throw error;
    }
  }

  async sendMessage(senderId: string, recipientId: string, conversationId: string, content: string) {
    // Publish to Kafka
    await kafkaService.send(KAFKA.TOPICS.CHAT_MESSAGES, {
      senderId,
      conversationId,
      content,
      recipientId,
      timestamp: new Date().toISOString(),
    });
  }

  async listConversations(user: CurrentUser) {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: user.id },
        },
      },
      include: {
        participants: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const unreadCounts = await prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: conversations.map((conversation) => conversation.id) },
        senderId: { not: user.id },
        reads: {
          none: {
            employeeId: user.id,
          },
        },
      },
      _count: {
        _all: true,
      },
    });
    const unreadCountsByConversation = new Map<string, number>();
    for (const item of unreadCounts) {
      unreadCountsByConversation.set(item.conversationId, item._count._all);
    }

    const mappedConversations = await Promise.all(
      conversations.map(async (conversation) => {
        if (conversation.type === "PRIVATE" && !conversation.participants.some((participant) => participant.id !== user.id)) {
          return null;
        }

        const lastMessage = conversation.messages[0] || null;
        return {
          id: conversation.id,
          type: conversation.type,
          name: conversation.name,
          participants: conversation.participants,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                senderId: lastMessage.senderId,
                senderName: lastMessage.sender.name,
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount: unreadCountsByConversation.get(conversation.id) ?? 0,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        };
      }),
    );

    return mappedConversations.filter((conversation): conversation is NonNullable<typeof conversation> => Boolean(conversation));
  }

  async createConversation(user: CurrentUser, body: { type: string; name?: string; participantIds?: string[] }) {
    const { type, name, participantIds } = body;

    if (!type || !participantIds || !Array.isArray(participantIds)) {
      throw new AppError('Missing required fields: type, participantIds', 400);
    }

    if (type === 'PRIVATE') {
      if (participantIds.length !== 1) {
        throw new AppError('Private conversations must have exactly one other participant', 400);
      }

      const otherUserId = participantIds[0];
      const otherUser = await prisma.employee.findUnique({
        where: { id: otherUserId },
        select: { id: true, name: true, email: true, role: true },
      });

      if (!otherUser) {
        throw new AppError('User not found', 404);
      }

      const existingConversation = await prisma.conversation.findFirst({
        where: {
          type: 'PRIVATE',
          AND: [
            { participants: { some: { id: user.id } } },
            { participants: { some: { id: otherUserId } } },
          ],
        },
        include: {
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (existingConversation) {
        return { conversation: existingConversation, status: 200 };
      }

      const newConversation = await prisma.conversation.create({
        data: {
          type: 'PRIVATE',
          participants: {
            connect: [{ id: user.id }, { id: otherUserId }],
          },
        },
        include: {
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return { conversation: newConversation, status: 201 };
    }

    if (type === 'GROUP') {
      if (!name) {
        throw new AppError('Group conversations must have a name', 400);
      }

      if (participantIds.length < 1) {
        throw new AppError('Group conversations must have at least one participant', 400);
      }

      const participants = await prisma.employee.findMany({
        where: { id: { in: participantIds } },
        select: { id: true },
      });

      if (participants.length !== participantIds.length) {
        throw new AppError('One or more participant IDs are invalid', 400);
      }

      const newConversation = await prisma.conversation.create({
        data: {
          type: 'GROUP',
          name,
          participants: {
            connect: [{ id: user.id }, ...participantIds.map((id) => ({ id }))],
          },
        },
        include: {
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return { conversation: newConversation, status: 201 };
    }

    throw new AppError('Invalid conversation type', 400);
  }

  async getConversationMessages(user: CurrentUser, conversationId: string, page: number, limit: number) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          select: { id: true },
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const isParticipant = conversation.participants.some((participant) => participant.id === user.id);
    if (!isParticipant) {
      throw new AppError('Access denied', 403);
    }

    const skip = (page - 1) * limit;
    const [messages, totalCountResult] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.message.aggregate({
        where: { conversationId },
        _count: true,
      }),
    ]);
    const totalCount = totalCountResult._count;

    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        reads: {
          none: {
            employeeId: user.id,
          },
        },
      },
      select: { id: true },
    });

    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map((message) => ({
          messageId: message.id,
          employeeId: user.id,
        })),
        skipDuplicates: true,
      });
    }

    const totalPages = Math.ceil(totalCount / limit);
    return {
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async markConversationAsRead(user: CurrentUser, conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          select: { id: true },
        },
      },
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const isParticipant = conversation.participants.some((participant) => participant.id === user.id);
    if (!isParticipant) {
      throw new AppError('Access denied', 403);
    }

    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        NOT: {
          reads: {
            some: { employeeId: user.id },
          },
        },
      },
      select: { id: true },
    });

    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map((message) => ({
          messageId: message.id,
          employeeId: user.id,
        })),
        skipDuplicates: true,
      });
    }

    return {
      success: true,
      markedCount: unreadMessages.length,
    };
  }
}

export const chatService = new ChatService();


