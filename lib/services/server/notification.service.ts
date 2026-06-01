import { prisma } from '@/lib/services/prisma.service';
import { socketService } from '@/lib/services/server/socket.service';
import { ROLE } from '@/lib/constants';
import type { Prisma, Notification } from '@prisma/client';
import type { PaginationParams, PaginatedResult } from '@/lib/types/pagination';

function buildNonChatNotificationWhere(employeeId: string): Prisma.NotificationWhereInput {
  return {
    employeeId,
    NOT: [
      { title: "Nouveau message" },
      { title: { startsWith: "[CHAT]" } },
    ],
  };
}

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

      return notification;
    } catch (error) {
      console.error('[notification]', error);
      throw error;
    }
  }

  async notifyHR(title: string, message: string) {
    const rhUsers = await prisma.employee.findMany({
      where: { role: ROLE.HR },
      select: { id: true },
    });

    if (rhUsers.length > 0) {
      await Promise.all(
        rhUsers.map((rh: { id: string }) => this.createNotification(rh.id, title, message))
      );
    }
  }

  async notifyManager(managerId: string, title: string, message: string) {
    if (!managerId) return;
    await this.createNotification(managerId, title, message);
  }

  async getUserNotifications(employeeId: string, pagination: PaginationParams = {}): Promise<PaginatedResult<Notification>> {
    const { page = 1, limit = 30 } = pagination;
    const where = buildNonChatNotificationWhere(employeeId);
    
    const [data, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit, hasMore: page * limit < total };
  }

  async clearUserNotifications(employeeId: string) {
    await prisma.notification.deleteMany({
      where: buildNonChatNotificationWhere(employeeId),
    });

    return { success: true };
  }

  async markAsRead(notificationId: string, employeeId: string) {
    const updated = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        employeeId,
      },
      data: {
        read: true,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return { success: true };
  }
}

export const notificationServerService = new NotificationServerService();

