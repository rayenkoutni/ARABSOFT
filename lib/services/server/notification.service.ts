import { prisma } from '@/lib/services/prisma.service';
import { socketService } from '@/lib/services/server/socket.service';

class NotificationServerService {
  async createNotification(employeeId: string, title: string, message: string) {
    try {
      const notification = await prisma.notification.create({
        data: {
          employeeId,
          title,
          message,
          read: false,
        },
      });

      // Also emit via Socket.io for real-time notification
      socketService.emitToUser(employeeId, 'new_notification', notification);

      console.log(`📢 Notification created for employee ${employeeId}: ${title}`);
      return notification;
    } catch (error) {
      console.error('❌ Failed to create notification:', error);
      throw error;
    }
  }

  async notifyHR(title: string, message: string) {
    const rhUsers = await prisma.employee.findMany({
      where: { role: 'RH' },
      select: { id: true },
    });

    if (rhUsers.length > 0) {
      await Promise.all(
        rhUsers.map((rh) => this.createNotification(rh.id, title, message))
      );
    }
  }

  async notifyManager(managerId: string, title: string, message: string) {
    if (!managerId) return;
    await this.createNotification(managerId, title, message);
  }
}

export const notificationServerService = new NotificationServerService();
