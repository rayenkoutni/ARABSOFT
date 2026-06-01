import { ROLE } from "@/lib/constants";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/services/server/auth.service";
import { apiError } from "@/lib/utils/api-response";

export async function getManagerTeamMemberIds(managerId: string): Promise<string[]> {
  const members = await prisma.employee.findMany({
    where: { managerId },
    select: { id: true },
  });

  return members.map((member) => member.id);
}

export async function assertProjectAccess(user: CurrentUser, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { select: { id: true } } },
  });

  if (!project) {
    throw apiError("Projet non trouve", 404);
  }

  if (user.role === ROLE.HR) {
    return { project, teamIds: project.team.map((member) => member.id) };
  }

  if (user.role === ROLE.MANAGER) {
    const isAuthorized = project.createdById === user.id;

    if (!isAuthorized) {
      throw apiError("Acces refuse a ce projet", 403);
    }

    return { project, teamIds: project.team.map((member) => member.id) };
  }

  const isAssigned = project.team.some((member) => member.id === user.id);
  if (!isAssigned) {
    throw apiError("Acces refuse a ce projet", 403);
  }

  return { project, teamIds: project.team.map((member) => member.id) };
}

export async function deletePrivateConversationsForUser(
  userId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  const relatedPrivateConversations = await tx.conversation.findMany({
    where: {
      type: "PRIVATE",
      participants: {
        some: { id: userId },
      },
    },
    select: { id: true },
  });

  const privateConversationIds = relatedPrivateConversations.map((conversation) => conversation.id);
  if (privateConversationIds.length === 0) {
    return;
  }

  const privateConversationMessages = await tx.message.findMany({
    where: { conversationId: { in: privateConversationIds } },
    select: { id: true },
  });
  const privateConversationMessageIds = privateConversationMessages.map((message) => message.id);

  if (privateConversationMessageIds.length > 0) {
    await tx.messageRead.deleteMany({
      where: { messageId: { in: privateConversationMessageIds } },
    });
  }

  await tx.message.deleteMany({
    where: { conversationId: { in: privateConversationIds } },
  });
  await tx.conversation.deleteMany({
    where: { id: { in: privateConversationIds } },
  });
}
