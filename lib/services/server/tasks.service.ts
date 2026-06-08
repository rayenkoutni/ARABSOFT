import { logAudit } from "@/lib/audit";
import { Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/services/server/auth.service";
import { assertProjectAccess } from "@/lib/services/server/shared.service";
import {
  TaskInputError,
  type TaskCreateInput,
  taskWithRelationsInclude,
  validateTaskDueDateWithinProjectSchedule,
  validateTaskRequiredSkills,
} from "@/lib/tasks";
import { bonusService } from "@/lib/services/server/bonus.service";
import { notificationServerService } from "@/lib/services/server/notification.service";
import { apiError } from "@/lib/utils/api-response";
import { getTodayDateOnly, toDateOnlyValue } from "@/lib/leave-request";
import { hasProjectReachedPlannedEndDate, isProjectSlaBreached } from "@/lib/project-sla";
import type { PaginationParams, PaginatedResult } from "@/lib/types/pagination";

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
type TaskDbClient = Prisma.TransactionClient | typeof prisma;

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

interface CreateTasksInProjectArgs {
  db: TaskDbClient
  user: CurrentUser
  project: {
    id: string
    name: string
    startDate?: Date | null
    endDate?: Date | null
  }
  tasks: TaskCreateInput[]
  skipSelfNotification?: boolean
}

export async function createTasksInProject(
  args: CreateTasksInProjectArgs
) {
  const taskPayloads = await Promise.all(
    args.tasks.map(async (task) => {
      const requiredSkills = await validateTaskRequiredSkills(args.db, task.requiredSkills)
      const dueDate = task.dueDate
        ? validateTaskDueDateWithinProjectSchedule(task.dueDate, args.project)
        : null

      return {
        input: task,
        requiredSkills,
        dueDate,
      }
    })
  )

  const createdTasks = []

  for (const taskPayload of taskPayloads) {
    const createdTask = await args.db.task.create({
      data: {
        title: taskPayload.input.title,
        description: taskPayload.input.description,
        priority: taskPayload.input.priority,
        assigneeId: taskPayload.input.assigneeId,
        projectId: args.project.id,
        dueDate: taskPayload.dueDate,
        status: "TODO",
        requiredSkills: taskPayload.requiredSkills.length > 0
          ? {
              create: taskPayload.requiredSkills.map((requiredSkill) => ({
                skillId: requiredSkill.skillId,
                minimumLevel: requiredSkill.minimumLevel,
              })),
            }
          : undefined,
      },
      include: taskWithRelationsInclude,
    })

    createdTasks.push(createdTask)

    await args.db.auditLog.create({
      data: {
        actorId: args.user.id,
        actorName: args.user.name,
        action: "CREATED",
        entity: "Task",
        entityId: createdTask.id,
        details: JSON.stringify({
          title: createdTask.title,
          status: createdTask.status,
          projectId: args.project.id,
        }),
      },
    })

    if (!(args.skipSelfNotification && taskPayload.input.assigneeId === args.user.id)) {
      await args.db.notification.create({
        data: {
          employeeId: taskPayload.input.assigneeId,
          title: "Nouvelle tache assignee",
          message: `Une nouvelle tache "${taskPayload.input.title}" vous a ete assignee dans le projet "${args.project.name}".${taskPayload.input.dueDate ? ` Echeance: ${new Date(taskPayload.input.dueDate).toLocaleDateString()}` : ""}`,
        },
      })
    }

    if (taskPayload.input.dueDate) {
      const dueDateObj = new Date(taskPayload.input.dueDate)
      const now = new Date()
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

      if (dueDateObj <= twoDaysFromNow && dueDateObj > now) {
        await args.db.notification.create({
          data: {
            employeeId: taskPayload.input.assigneeId,
            title: "Echeance proche",
            message: `La tache "${taskPayload.input.title}" arrive a echeance le ${dueDateObj.toLocaleDateString()} dans le projet "${args.project.name}"`,
          },
        })
      }
    }
  }

  return createdTasks
}

class TasksService {
  private getManagerProjectScope(userId: string) {
    return {
      OR: [{ createdById: userId }, { managerId: userId }],
    } satisfies Prisma.ProjectWhereInput;
  }

  private getRequiredSkillScore(
    requiredSkills: Array<{ skillId: string; minimumLevel: number }>,
    employeeSkills: Array<{ skillId: string; level: number }>,
  ) {
    if (requiredSkills.length === 0) {
      return 0;
    }

    const skillMap = new Map(employeeSkills.map((skill) => [skill.skillId, skill.level]));
    return requiredSkills.reduce((score, requiredSkill) => {
      const level = skillMap.get(requiredSkill.skillId);
      if (!level) {
        return score;
      }

      return score + (level >= requiredSkill.minimumLevel ? 3 : 1);
    }, 0);
  }

  private async recalculateProjectProgress(projectId: string, db: TaskDbClient = prisma) {
    const [project, allTasks] = await Promise.all([
      db.project.findUnique({
        where: { id: projectId },
        select: { endDate: true, status: true, slaBreached: true },
      }),
      db.task.findMany({ where: { projectId } }),
    ]);
    const completedTasks = allTasks.filter((task) => task.status === "DONE").length;
    const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;
    const status =
      allTasks.length > 0 && completedTasks === allTasks.length
        ? "TERMINE"
        : "EN_COURS";
    const slaBreached = Boolean(
      project &&
        (project.slaBreached ||
          isProjectSlaBreached(project) ||
          (status === "TERMINE" && hasProjectReachedPlannedEndDate(project.endDate))),
    );

    await db.project.update({
      where: { id: projectId },
      data: { progress, status, slaBreached },
    });
  }

  async listTasks(
    user: CurrentUser, 
    filters: { assigneeId: string | null; excludeStatus: string | null },
    pagination: PaginationParams = {}
  ) {
    const { page = 1, limit = 50 } = pagination;
    const where: Prisma.TaskWhereInput = {};

    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }

    if (filters.excludeStatus) {
      where.status = { not: filters.excludeStatus as TaskStatus };
    }

    if (user.role === "RH") {
      // HR has full access
    } else if (user.role === "CHEF") {
      where.project = this.getManagerProjectScope(user.id);
    } else {
      if (filters.assigneeId && filters.assigneeId !== user.id) {
        throw apiError("Acces refuse", 403);
      }
      where.assigneeId = user.id;
    }

    const [data, total] = await prisma.$transaction([
      prisma.task.findMany({
        where,
        include: taskWithRelationsInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prisma.task.count({ where })
    ]);
    
    return { data, total, page, limit, hasMore: page * limit < total };
  }

  async createTask(user: CurrentUser, projectId: string, input: TaskCreateInput) {
    const { project, teamIds } = await assertProjectAccess(user, projectId);

    if (user.role === "CHEF" && !teamIds.includes(input.assigneeId)) {
      throw apiError("Vous ne pouvez assigner qu'aux membres du projet", 400);
    }

    if (user.role === "COLLABORATEUR") {
      if (input.assigneeId !== user.id) {
        throw apiError("Vous ne pouvez assigner des taches qu'a vous-meme", 400);
      }

      if (input.requiredSkills.length > 0) {
        throw apiError("Seul un chef peut definir des competences requises pour une tache.", 403);
      }
    }

    return prisma.$transaction(async (tx) => {
      const [task] = await createTasksInProject({
        db: tx,
        user,
        project,
        tasks: [input],
        skipSelfNotification: true,
      })

      return task
    });
  }

  async updateProjectTaskStatus(user: CurrentUser, projectId: string, taskId: string, status: string) {
    await assertProjectAccess(user, projectId);

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw apiError("Tache introuvable", 404);
    }
    if (task.projectId !== projectId) {
      throw apiError("Tache introuvable dans ce projet", 404);
    }

    if (user.role === "COLLABORATEUR" && task.assigneeId !== user.id) {
      throw apiError("Vous ne pouvez pas modifier les taches d'autres utilisateurs", 403);
    }

    const taskActorRole = user.role as TaskStatusActorRole;
    if (!allowedTransitions[taskActorRole][task.status]?.includes(status)) {
      throw apiError("Transition de statut non autorisee", 403);
    }

    const updateData: Record<string, unknown> = { status };

    return prisma.$transaction(async (tx) => {
      if (status === "IN_REVIEW") {
        updateData.submittedForReview = true;

        const [project, assignee] = await Promise.all([
          tx.project.findUnique({
            where: { id: projectId },
            select: { name: true, managerId: true, createdById: true },
          }),
          tx.employee.findUnique({
            where: { id: task.assigneeId },
            select: { name: true },
          }),
        ]);

        const reviewRecipientId = project?.managerId ?? project?.createdById ?? null;

        if (reviewRecipientId && assignee) {
          await tx.notification.create({
            data: {
              employeeId: reviewRecipientId,
              title: "Tache soumise pour revision",
              message: `"${assignee.name}" a soumis la tache "${task.title}" pour revision dans le projet "${project?.name}"`,
            },
          });
        }
      }

      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: updateData,
        include: taskWithRelationsInclude,
      });

      await this.recalculateProjectProgress(projectId, tx);
      return updatedTask;
    });
  }

  async deleteProjectTask(user: CurrentUser, taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw apiError("Task not found", 404);
    }

    if (user.role !== "CHEF") {
      throw apiError("Acces refuse", 403);
    }

    if (!task.projectId || !task.project) {
      throw apiError("Projet de la tache introuvable", 404);
    }

    await assertProjectAccess(user, task.projectId);

    if (!(task.project.createdById === user.id || task.project.managerId === user.id)) {
      throw apiError("Vous ne pouvez pas supprimer les taches d'autres projets", 403);
    }

    if (task.status === "DONE") {
      throw apiError("Une tache terminee ne peut pas etre supprimee", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id: taskId } });

      if (task.projectId) {
        await this.recalculateProjectProgress(task.projectId, tx);
      }
    });

    return { success: true };
  }

  async reassignProjectTask(
    user: CurrentUser,
    projectId: string,
    taskId: string,
    input: { assigneeId?: string | null; useAi?: boolean },
  ) {
    const { project, teamIds } = await assertProjectAccess(user, projectId);

    if (user.role !== "CHEF") {
      throw apiError("Acces refuse a ce projet", 403);
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        requiredSkills: {
          select: {
            skillId: true,
            minimumLevel: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!task || task.projectId !== projectId) {
      throw apiError("Tache introuvable", 404);
    }

    let nextAssigneeId = input.assigneeId ?? null;

    if (input.useAi) {
      const today = getTodayDateOnly();
      const candidates = await prisma.employee.findMany({
        where: {
          id: { in: teamIds.filter((teamId) => teamId !== task.assigneeId) },
        },
        select: {
          id: true,
          name: true,
          skills: {
            select: {
              skillId: true,
              level: true,
            },
          },
          requests: {
            where: { type: "CONGE", status: "APPROUVE" },
            select: { startDate: true, endDate: true },
          },
          assignedTasks: {
            where: { projectId },
            select: { id: true },
          },
        },
      });

      const bestCandidate = candidates
        .map((candidate) => {
          const onLeave = candidate.requests.some((request) => {
            const startDate = toDateOnlyValue(request.startDate);
            const endDate = toDateOnlyValue(request.endDate);
            return !!startDate && !!endDate && startDate <= today && today <= endDate;
          });

          return {
            candidate,
            onLeave,
            skillScore: this.getRequiredSkillScore(task.requiredSkills, candidate.skills),
            taskLoad: candidate.assignedTasks.length,
          };
        })
        .sort((left, right) => {
          if (left.onLeave !== right.onLeave) {
            return left.onLeave ? 1 : -1;
          }
          if (left.skillScore !== right.skillScore) {
            return right.skillScore - left.skillScore;
          }
          if (left.taskLoad !== right.taskLoad) {
            return left.taskLoad - right.taskLoad;
          }
          return left.candidate.name.localeCompare(right.candidate.name);
        })[0];

      nextAssigneeId = bestCandidate?.candidate.id ?? null;
    }

    if (!nextAssigneeId) {
      throw apiError("Selectionnez un collaborateur pour la reassignment", 400);
    }

    if (!teamIds.includes(nextAssigneeId)) {
      throw apiError("Vous ne pouvez reassigner qu'aux membres de votre equipe", 400);
    }

    if (nextAssigneeId === task.assigneeId) {
      throw apiError("Cette tache est deja assignee a ce collaborateur", 400);
    }

    const nextAssignee = await prisma.employee.findUnique({
      where: { id: nextAssigneeId },
      select: { id: true, name: true },
    });

    if (!nextAssignee) {
      throw apiError("Le collaborateur selectionne est introuvable", 404);
    }

    return prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: { assigneeId: nextAssigneeId },
        include: taskWithRelationsInclude,
      });

      await tx.notification.create({
        data: {
          employeeId: nextAssigneeId,
          title: "Tache reaffectee",
          message: `La tache "${task.title}" vous a ete reaffectee dans le projet "${task.project?.name ?? project.name}".`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          action: "REASSIGNED",
          entity: "Task",
          entityId: task.id,
          details: JSON.stringify({
            previousAssigneeId: task.assigneeId,
            previousAssigneeName: task.assignee?.name ?? null,
            nextAssigneeId,
            nextAssigneeName: nextAssignee.name,
            projectId,
            usedAi: Boolean(input.useAi),
          }),
        },
      });

      return updatedTask;
    });
  }

  async submitTaskForReview(user: CurrentUser, taskId: string, input: SubmitReviewInput) {
    if (!input.deliverableLink && !input.deliverableNote) {
      throw apiError("Veuillez fournir au moins un lien ou une note pour le livrable", 400);
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { managerId: true, name: true } },
        project: { select: { name: true } },
      },
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

    const updatedTask = await prisma.$transaction(async (tx) => {
      const nextTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: "IN_REVIEW",
          submittedForReview: true,
          deliverableLink: input.deliverableLink || null,
          deliverableNote: input.deliverableNote || null,
        },
      });

      if (task.assignee?.managerId) {
        await tx.notification.create({
          data: {
            employeeId: task.assignee.managerId,
            title: "Tache soumise pour revision",
            message: `"${task.assignee.name}" a soumis la tache "${task.title}" pour revision dans le projet "${task.project?.name ?? "Projet"}"`,
          },
        });
      }

      return nextTask;
    });

    return { success: true, task: updatedTask };
  }

  async reviewTaskDecision(user: CurrentUser, taskId: string, input: ReviewDecisionInput) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { managerId: true } },
        project: { select: { id: true, managerId: true, createdById: true } },
      },
    });

    if (!task) {
      throw apiError("Tache introuvable", 404);
    }

    const canReview =
      user.role === "RH" ||
      task.project?.managerId === user.id ||
      task.project?.createdById === user.id;

    if (!canReview) {
      throw apiError("Vous ne pouvez reviser que les taches de vos projets", 403);
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
        reviewComment: input.reviewComment || null,
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

    const updatedTask = await prisma.$transaction(async (tx) => {
      const nextTask = await tx.task.update({
        where: { id: taskId },
        data: updateData,
      });

      if (task.projectId) {
        await this.recalculateProjectProgress(task.projectId, tx);
      }

      if (input.decision === "APPROVE") {
        await bonusService.createOrUpdateTaskPerformanceBonus(nextTask.id, tx);
      }

      return nextTask;
    });

    return { success: true, task: updatedTask };
  }

  async reviewTaskBatch(user: CurrentUser, projectId: string, decisions: ProjectTaskReviewInput[]) {
    const { project, teamIds } = await assertProjectAccess(user, projectId);

    if (user.role !== "CHEF") {
      throw apiError("Acces refuse a ce projet", 403);
    }

    const results = await prisma.$transaction(async (tx) => {
      const nextResults = [];

      for (const decision of decisions) {
        const task = await tx.task.findUnique({
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

          updatedTask = await tx.task.update({
            where: { id: decision.taskId },
            data: {
              status: "DONE",
              submittedForReview: false,
              reviewedById: user.id,
              reviewedAt: new Date(),
              taskScore: score,
              reviewComment: decision.comment || null,
            },
          });

          await bonusService.createOrUpdateTaskPerformanceBonus(updatedTask.id, tx);

          await tx.notification.create({
            data: {
              employeeId: task.assigneeId,
              title: "Tache acceptee",
              message: `Votre tache "${task.title}" a ete acceptee dans le projet "${projectName}"`,
            },
          });
        } else {
          updatedTask = await tx.task.update({
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

          await tx.notification.create({
            data: {
              employeeId: task.assigneeId,
              title: "Revision requise",
              message: decision.comment
                ? `Revision requise pour votre tache "${task.title}". Commentaire: ${decision.comment}`
                : `Revision requise pour votre tache "${task.title}" dans le projet "${projectName}"`,
            },
          });
        }

        nextResults.push(updatedTask);
      }

      await this.recalculateProjectProgress(projectId, tx);
      return nextResults;
    });

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
