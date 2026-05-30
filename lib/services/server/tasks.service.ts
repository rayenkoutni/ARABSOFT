import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/services/server/auth.service";
import {
  TaskInputError,
  type TaskCreateInput,
  taskWithRelationsInclude,
  validateTaskRequiredSkills,
} from "@/lib/tasks";
import { apiError } from "@/lib/utils/api-response";

interface SubmitReviewInput {
  deliverableLink?: string | null;
  deliverableNote?: string | null;
}

interface ReviewDecisionInput {
  decision: "APPROVE" | "REJECT";
  reviewComment?: string | null;
  taskScore?: number | null;
}

interface ProjectTaskReviewInput {
  taskId: string;
  action: "accept" | "request_revision";
  comment?: string | null;
  taskScore?: number | null;
}

type TaskStatusActorRole = "COLLABORATEUR" | "CHEF";

const allowedTransitions: Record<TaskStatusActorRole, Record<string, string[]>> = {
  COLLABORATEUR: {
    TODO: ["IN_PROGRESS"],
    IN_PROGRESS: ["IN_REVIEW"],
    IN_REVIEW: [],
    DONE: [],
  },
  CHEF: {
    TODO: ["IN_PROGRESS"],
    IN_PROGRESS: ["IN_REVIEW"],
    IN_REVIEW: ["DONE"],
    DONE: [],
  },
};

class TasksService {
  private async getManagerTeamIds(managerId: string) {
    const teamMembers = await prisma.employee.findMany({
      where: { managerId },
      select: { id: true },
    });

    return teamMembers.map((employee) => employee.id);
  }

  private async assertProjectAccess(user: CurrentUser, projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { team: { select: { id: true } } },
    });

    if (!project) {
      throw apiError("Projet introuvable", 404);
    }

    if (user.role === "RH") {
      return { project, teamIds: [] as string[] };
    }

    if (user.role === "CHEF") {
      const teamIds = await this.getManagerTeamIds(user.id);
      const isAuthorized =
        project.createdById === user.id ||
        project.managerId === user.id ||
        project.team.some((member) => teamIds.includes(member.id));

      if (!isAuthorized) {
        throw apiError("Acces refuse a ce projet", 403);
      }

      return { project, teamIds };
    }

    const isProjectMember = project.team.some((member) => member.id === user.id);
    if (!isProjectMember) {
      throw apiError("Acces refuse a ce projet", 403);
    }

    return { project, teamIds: [] as string[] };
  }

  private async recalculateProjectProgress(projectId: string) {
    const allTasks = await prisma.task.findMany({ where: { projectId } });
    const completedTasks = allTasks.filter((task) => task.status === "DONE").length;
    const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;

    await prisma.project.update({
      where: { id: projectId },
      data: { progress },
    });
  }

  async listTasks(user: CurrentUser, filters: { assigneeId: string | null; excludeStatus: string | null }) {
    const where: Record<string, unknown> = {};

    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }

    if (filters.excludeStatus) {
      where.status = { not: filters.excludeStatus };
    }

    if (user.role === "RH") {
      return prisma.task.findMany({ where, include: taskWithRelationsInclude });
    }

    if (user.role === "CHEF") {
      const teamIds = await this.getManagerTeamIds(user.id);

      if (filters.assigneeId && !teamIds.includes(filters.assigneeId)) {
        throw apiError("Acces refuse", 403);
      }

      if (!filters.assigneeId) {
        where.assigneeId = { in: teamIds };
      }

      return prisma.task.findMany({ where, include: taskWithRelationsInclude });
    }

    if (filters.assigneeId && filters.assigneeId !== user.id) {
      throw apiError("Acces refuse", 403);
    }

    where.assigneeId = user.id;
    return prisma.task.findMany({ where, include: taskWithRelationsInclude });
  }

  async createTask(user: CurrentUser, projectId: string, input: TaskCreateInput) {
    const { project, teamIds } = await this.assertProjectAccess(user, projectId);

    if (user.role === "CHEF" && !teamIds.includes(input.assigneeId)) {
      throw apiError("Vous ne pouvez assigner qu'aux membres de votre equipe", 400);
    }

    if (user.role === "COLLABORATEUR") {
      if (input.assigneeId !== user.id) {
        throw apiError("Vous ne pouvez assigner des taches qu'a vous-meme", 400);
      }

      if (input.requiredSkills.length > 0) {
        throw apiError("Seul un chef peut definir des competences requises pour une tache.", 403);
      }
    }

    const requiredSkills = await validateTaskRequiredSkills(prisma, input.requiredSkills);
    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        assigneeId: input.assigneeId,
        projectId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: "TODO",
        requiredSkills: requiredSkills.length > 0
          ? {
              create: requiredSkills.map((requiredSkill) => ({
                skillId: requiredSkill.skillId,
                minimumLevel: requiredSkill.minimumLevel,
              })),
            }
          : undefined,
      },
      include: taskWithRelationsInclude,
    });

    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "CREATED",
      entity: "Task",
      entityId: task.id,
      details: { title: task.title, status: task.status, projectId },
    });

    if (input.assigneeId !== user.id) {
      await prisma.notification.create({
        data: {
          employeeId: input.assigneeId,
          title: "Nouvelle tache assignee",
          message: `Une nouvelle tache "${input.title}" vous a ete assignee dans le projet "${project.name}".${input.dueDate ? ` Echeance: ${new Date(input.dueDate).toLocaleDateString()}` : ""}`,
        },
      });
    }

    if (input.dueDate) {
      const dueDateObj = new Date(input.dueDate);
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

      if (dueDateObj <= twoDaysFromNow && dueDateObj > now) {
        await prisma.notification.create({
          data: {
            employeeId: input.assigneeId,
            title: "Echeance proche",
            message: `La tache "${input.title}" arrive a echeance le ${dueDateObj.toLocaleDateString()} dans le projet "${project.name}"`,
          },
        });
      }
    }

    return task;
  }

  async updateProjectTaskStatus(user: CurrentUser, projectId: string, taskId: string, status: string) {
    await this.assertProjectAccess(user, projectId);

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw apiError("Tache introuvable", 404);
    }

    if (user.role === "COLLABORATEUR" && task.assigneeId !== user.id) {
      throw apiError("Vous ne pouvez pas modifier les taches d'autres utilisateurs", 403);
    }

    const taskActorRole = user.role as TaskStatusActorRole;
    if (!allowedTransitions[taskActorRole][task.status]?.includes(status)) {
      throw apiError("Transition de statut non autorisee", 403);
    }

    if (user.role === "CHEF") {
      const teamIds = await this.getManagerTeamIds(user.id);
      if (!teamIds.includes(task.assigneeId)) {
        throw apiError("Vous ne pouvez pas modifier les taches d'autres equipes", 403);
      }
    }

    const updateData: Record<string, unknown> = { status };

    if (status === "IN_REVIEW") {
      updateData.submittedForReview = true;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });

      const managers = await prisma.employee.findMany({
        where: { role: "CHEF" },
        select: { id: true },
      });

      const assignee = await prisma.employee.findUnique({
        where: { id: task.assigneeId },
        select: { name: true },
      });

      if (managers.length > 0 && assignee) {
        await prisma.notification.createMany({
          data: managers.map((manager) => ({
            employeeId: manager.id,
            title: "Tache soumise pour revision",
            message: `"${assignee.name}" a soumis la tache "${task.title}" pour revision dans le projet "${project?.name}"`,
          })),
        });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: taskWithRelationsInclude,
    });

    await this.recalculateProjectProgress(projectId);
    return updatedTask;
  }

  async deleteProjectTask(user: CurrentUser, taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw apiError("Task not found", 404);
    }

    const teamIds = await this.getManagerTeamIds(user.id);
    if (!teamIds.includes(task.assigneeId)) {
      throw apiError("Vous ne pouvez pas supprimer les taches d'autres equipes", 403);
    }

    await prisma.task.delete({ where: { id: taskId } });

    if (task.projectId) {
      await this.recalculateProjectProgress(task.projectId);
    }

    return { success: true };
  }

  async submitTaskForReview(user: CurrentUser, taskId: string, input: SubmitReviewInput) {
    if (!input.deliverableLink && !input.deliverableNote) {
      throw apiError("Veuillez fournir au moins un lien ou une note pour le livrable", 400);
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: { select: { managerId: true } } },
    });

    if (!task) {
      throw apiError("Tache introuvable", 404);
    }

    if (task.assigneeId !== user.id) {
      throw apiError("Vous n'etes pas assigne a cette tache", 403);
    }

    if (task.status !== "IN_PROGRESS") {
      throw apiError("Seules les taches en cours peuvent etre soumises pour revision", 400);
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "IN_REVIEW",
        submittedForReview: true,
        deliverableLink: input.deliverableLink || null,
        deliverableNote: input.deliverableNote || null,
      },
    });

    return { success: true, task: updatedTask };
  }

  async reviewTaskDecision(user: CurrentUser, taskId: string, input: ReviewDecisionInput) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: { select: { managerId: true } } },
    });

    if (!task) {
      throw apiError("Tache introuvable", 404);
    }

    if (task.assignee?.managerId !== user.id) {
      throw apiError("Vous ne pouvez reviser que les taches de votre equipe", 403);
    }

    if (!task.submittedForReview) {
      throw apiError("Cette tache n'est pas soumise pour revision", 400);
    }

    let updateData: Record<string, unknown>;
    if (input.decision === "APPROVE") {
      const score = Number(input.taskScore);
      if (!input.taskScore || Number.isNaN(score) || score < 1 || score > 10) {
        throw apiError("Un score entre 1 et 10 est requis pour approuver une tache", 400);
      }

      updateData = {
        status: "DONE",
        submittedForReview: false,
        reviewedById: user.id,
        reviewedAt: new Date(),
        taskScore: score,
      };
    } else {
      updateData = {
        status: "IN_PROGRESS",
        submittedForReview: false,
        deliverableLink: null,
        deliverableNote: null,
        reviewComment: input.reviewComment || null,
      };
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    if (task.projectId) {
      await this.recalculateProjectProgress(task.projectId);
    }

    return { success: true, task: updatedTask };
  }

  async reviewTaskBatch(user: CurrentUser, projectId: string, decisions: ProjectTaskReviewInput[]) {
    const { project, teamIds } = await this.assertProjectAccess(user, projectId);

    if (user.role !== "CHEF") {
      throw apiError("Acces refuse a ce projet", 403);
    }

    const results = [];

    for (const decision of decisions) {
      const task = await prisma.task.findUnique({
        where: { id: decision.taskId },
        include: {
          assignee: { select: { name: true } },
          project: { select: { name: true } },
        },
      });

      if (!task) {
        throw apiError("Task not found", 404);
      }

      if (!task.submittedForReview) {
        throw apiError("Cette tache n'est pas soumise pour revision", 400);
      }

      if (!teamIds.includes(task.assigneeId)) {
        throw apiError("Vous ne pouvez pas reviser les taches d'autres equipes", 403);
      }

      let updatedTask;
      const projectName = task.project?.name || project.name || "Projet";

      if (decision.action === "accept") {
        const score = Number(decision.taskScore);
        if (Number.isNaN(score) || score < 1 || score > 10) {
          throw apiError("Un score entre 1 et 10 est requis pour approuver une tache", 400);
        }

        updatedTask = await prisma.task.update({
          where: { id: decision.taskId },
          data: {
            status: "DONE",
            submittedForReview: false,
            reviewedById: user.id,
            reviewedAt: new Date(),
            taskScore: score,
          },
        });

        await prisma.notification.create({
          data: {
            employeeId: task.assigneeId,
            title: "Tache acceptee",
            message: `Votre tache "${task.title}" a ete acceptee dans le projet "${projectName}"`,
          },
        });
      } else {
        updatedTask = await prisma.task.update({
          where: { id: decision.taskId },
          data: {
            status: "IN_PROGRESS",
            submittedForReview: false,
            deliverableLink: null,
            deliverableNote: null,
            reviewComment: decision.comment || null,
            reviewedById: user.id,
            reviewedAt: new Date(),
          },
        });

        await prisma.notification.create({
          data: {
            employeeId: task.assigneeId,
            title: "Revision requise",
            message: decision.comment
              ? `Revision requise pour votre tache "${task.title}". Commentaire: ${decision.comment}`
              : `Revision requise pour votre tache "${task.title}" dans le projet "${projectName}"`,
          },
        });
      }

      results.push(updatedTask);
    }

    await this.recalculateProjectProgress(projectId);
    return {
      success: true,
      tasks: results,
      message: decisions.length === 1
        ? decisions[0]?.action === "accept" ? "Tache acceptee" : "Revision demandee"
        : "Revision de lot terminee",
    };
  }
}

export const tasksService = new TasksService();
export { TaskInputError };
