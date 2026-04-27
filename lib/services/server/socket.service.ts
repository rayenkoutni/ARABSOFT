import { Server as SocketIOServer, Socket } from 'socket.io';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { ROLE } from '@/lib';

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
    // These will be expanded as needed, or moved to a ChatService
    socket.on('typing', (data) => {
      const { conversationId, recipientId } = data;
      this.emitToUser(recipientId, 'user_typing', {
        userId: user.id,
        conversationId,
      });
    });

    socket.on('stop_typing', (data) => {
      const { conversationId, recipientId } = data;
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

