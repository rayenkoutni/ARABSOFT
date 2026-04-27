import { prisma } from '@/lib/services/prisma.service';
import { kafkaService } from '@/lib/services/server/kafka.service';
import { socketService } from '@/lib/services/server/socket.service';
import { notificationServerService } from '@/lib/services/server/notification.service';
import { KAFKA } from '@/lib';

class ChatService {
  async init() {
    await kafkaService.initProducer();
    await kafkaService.subscribe(KAFKA.TOPICS.CHAT_MESSAGES, this.handleIncomingMessage.bind(this));
    console.log('💬 Chat service initialized (Kafka + Socket)');
  }

  private async handleIncomingMessage(payload: any) {
    const { senderId, conversationId, content, recipientId } = payload;

    try {
      // Validate sender exists
      const sender = await prisma.employee.findUnique({ where: { id: senderId } });
      if (!sender) {
        console.error(`❌ Sender not found: ${senderId}`);
        return;
      }

      // Validate conversation exists
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation) {
        console.error(`❌ Conversation not found: ${conversationId}`);
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

      // Create notification for recipient
      await notificationServerService.createNotification(
        recipientId,
        '[CHAT] Nouveau message',
        `${savedMessage.sender.name}: ${savedMessage.content.substring(0, 100)}${savedMessage.content.length > 100 ? '...' : ''}`
      );

      console.log(`✅ Message processed: ${savedMessage.id}`);
    } catch (error) {
      console.error('❌ Error in ChatService.handleIncomingMessage:', error);
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
}

export const chatService = new ChatService();

