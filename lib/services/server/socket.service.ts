import { Server as SocketIOServer, Socket } from 'socket.io';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { ROLE } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

interface AuthenticatedUser {
  id: string;
  role: string;
}

class SocketService {
  private io: SocketIOServer | null = null;
  private userSockets = new Map<string, Set<string>>();

  init(io: SocketIOServer) {
    this.io = io;
    this.setupHandlers();
    return this.io;
  }

  get IO() {
    if (!this.io) throw new Error('Socket.io not initialized');
    return this.io;
  }

  private async authenticateSocket(socket: Socket): Promise<AuthenticatedUser | null> {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) return null;

      const cookies = parse(cookieHeader);
      const token = cookies.token;
      if (!token) return null;

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthenticatedUser;
      return decoded;
    } catch (error) {
      console.error('❌ Socket authentication failed:', error);
      return null;
    }
  }

  private setupHandlers() {
    this.IO.on('connection', async (socket: Socket) => {
      const user = await this.authenticateSocket(socket);

      if (!user) {
        console.log('⚠️ Unauthenticated socket connection, disconnecting');
        socket.disconnect();
        return;
      }

      console.log(`👤 User ${user.id} (${user.role}) connected (Socket: ${socket.id})`);

      // Join user's personal room
      socket.join(user.id);

      // Track socket ID for this user
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(socket.id);

      // Register custom handlers
      this.registerChatHandlers(socket, user);

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`🔌 User ${user.id} disconnected (Socket: ${socket.id})`);
        const sockets = this.userSockets.get(user.id);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.userSockets.delete(user.id);
          }
        }
      });
    });
  }

  private registerChatHandlers(socket: Socket, user: AuthenticatedUser) {
    socket.on('send_message', async (data: { conversationId?: string; recipientId?: string; content?: string }) => {
      try {
        const { conversationId, recipientId, content } = data;
        if (!conversationId || !content || !recipientId) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }

        // Verify participant
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { participants: { select: { id: true } } },
        });

        if (!conversation || !conversation.participants.some((p: { id: string }) => p.id === user.id)) {
          socket.emit('error', { message: 'Not a participant in this conversation' });
          return;
        }

        const { chatService } = await import('@/lib/services/server/chat.service');
        try {
          await chatService.sendMessage(user.id, recipientId, conversationId, content);
        } catch (error) {
          console.warn('Kafka send failed, falling back to direct save', error);
          // Fallback direct save if Kafka is down
          const savedMessage = await prisma.message.create({
            data: { content, senderId: user.id, conversationId },
            include: { sender: { select: { id: true, name: true, email: true, avatar: true } } },
          });

          this.emitToUser(recipientId, 'new_message', savedMessage);
          this.emitToUser(user.id, 'message_sent', savedMessage);

          const { notificationServerService } = await import('@/lib/services/server/notification.service');
          await notificationServerService.createNotification(
            recipientId,
            'Nouveau message',
            `${savedMessage.sender.name}: ${savedMessage.content.substring(0, 100)}`
          );
        }
      } catch (error) {
        console.error('Error in send_message handler:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing', (data: { conversationId?: string; recipientId?: string }) => {
      const { conversationId, recipientId } = data;
      if (!recipientId) return;
      this.emitToUser(recipientId, 'user_typing', {
        userId: user.id,
        conversationId,
      });
    });

    socket.on('stop_typing', (data: { conversationId?: string; recipientId?: string }) => {
      const { conversationId, recipientId } = data;
      if (!recipientId) return;
      this.emitToUser(recipientId, 'user_stop_typing', {
        userId: user.id,
        conversationId,
      });
    });
  }

  emitToUser(userId: string, event: string, data: any) {
    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      socketIds.forEach((id) => {
        this.IO.to(id).emit(event, data);
      });
    }
  }

  emitToAll(event: string, data: any) {
    this.IO.emit(event, data);
  }

  emitToRole(role: string, event: string, data: any) {
    // Future implementation: broadcast to all users with a specific role
    // Requires tracking roles in userSockets or another map
  }
}

export const socketService = new SocketService();

