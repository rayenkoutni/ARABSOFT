import { logAudit } from "@/lib/audit";
import { ROLE } from "@/lib/constants";
import { Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/services/server/auth.service";
import { assertProjectAccess, getManagerTeamMemberIds } from "@/lib/services/server/shared.service";
import type { PreviewTask } from "@/lib/services/server/types";
import { taskWithRelationsInclude } from "@/lib/tasks";
import { apiError } from "@/lib/utils/api-response";
import Groq from "groq-sdk";
import { promises as fs } from "fs";
import { cache } from "react";
import type { PaginationParams, PaginatedResult } from "@/lib/types/pagination";
import path from "path";
import { parse as parseEnv } from "dotenv";
import { getTodayDateOnly, parseDateOnlyToUtcDate, toDateOnlyValue } from "@/lib/leave-request";
import { hasProjectReachedPlannedEndDate, isProjectSlaBreached } from "@/lib/project-sla";

interface TeamSkill {
  level: number;
  skill: { name: string };
}

interface TeamLeaveRequest {
  startDate: Date | null;
  endDate: Date | null;
}

interface ProcessedTeamMember {
  id: string;
  name: string;
  jobTitle: string;
  status: "active" | "en_conge";
  skills: Array<{ name: string; level: number }>;
}

interface TaskTemplate {
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

type PartialPreviewTask = Partial<PreviewTask>;
type ProjectDbClient = Prisma.TransactionClient | typeof prisma;
const allowedProjectStatuses = ["EN_COURS", "TERMINE"] as const;

function parseProjectStatus(status: string): ProjectStatus {
  if (!allowedProjectStatuses.includes(status as (typeof allowedProjectStatuses)[number])) {
    throw apiError("Statut de projet invalide", 400);
  }

  return status as ProjectStatus;
}

async function resolveGroqApiKey() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const envContents = await fs.readFile(envPath, "utf8");
    const parsedEnv = parseEnv(envContents);
    const fileKey = parsedEnv.GROQ_API_KEY?.trim();
    if (fileKey) {
      return fileKey;
    }
  } catch {
    // Fall back to process.env if the file is unavailable.
  }

  return process.env.GROQ_API_KEY?.trim() || "";
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function buildDueDate(startDate: Date | null, endDate: Date | null, index: number, totalTasks: number) {
  const today = parseDateOnlyToUtcDate(getTodayDateOnly()) ?? new Date();
  const start = startDate && startDate > today ? startDate : today;
  const fallbackEnd = addDays(start, 14);
  const end = endDate && endDate > start ? endDate : fallbackEnd;
  const rangeMs = Math.max(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
  const step = rangeMs / Math.max(totalTasks, 1);
  const dueDate = new Date(start.getTime() + step * (index + 1));
  return (dueDate > end ? end : dueDate).toISOString();
}

function isGeneratedDueDateUsable(value: string | null | undefined, startDate: Date | null, endDate: Date | null) {
  const normalizedDueDate = toDateOnlyValue(value);
  if (!normalizedDueDate) {
    return false;
  }

  const today = getTodayDateOnly();
  if (normalizedDueDate <= today) {
    return false;
  }

  const projectStartDate = toDateOnlyValue(startDate);
  if (projectStartDate && projectStartDate > today && normalizedDueDate < projectStartDate) {
    return false;
  }

  const projectEndDate = toDateOnlyValue(endDate);
  if (projectEndDate && projectEndDate > today && normalizedDueDate > projectEndDate) {
    return false;
  }

  return true;
}

function getPhaseTemplates(projectName: string, phase: string): TaskTemplate[] {
  if (phase.startsWith("foundation")) {
    return [
      {
        title: `Structurer l'architecture de ${projectName}`,
        description: `Definir la structure technique, les modules principaux et les conventions de travail pour le projet ${projectName}.`,
        priority: "HIGH",
      },
      {
        title: `Mettre en place le socle de donnees de ${projectName}`,
        description: `Preparer les modeles, les validations et les flux de donnees indispensables au demarrage du projet ${projectName}.`,
        priority: "HIGH",
      },
      {
        title: `Poser les bases UI de ${projectName}`,
        description: `Construire les ecrans de base, les composants reutilisables et les premiers parcours utilisateur pour ${projectName}.`,
        priority: "MEDIUM",
      },
      {
        title: `Documenter le workflow de lancement de ${projectName}`,
        description: `Formaliser les etapes de livraison, les dependances et les points de controle pour faciliter l'execution de ${projectName}.`,
        priority: "MEDIUM",
      },
    ];
  }

  if (phase.startsWith("mid")) {
    return [
      {
        title: `Developper une fonctionnalite cle de ${projectName}`,
        description: `Livrer une fonctionnalite metier prioritaire avec ses validations et ses cas limites pour le projet ${projectName}.`,
        priority: "HIGH",
      },
      {
        title: `Finaliser une integration critique de ${projectName}`,
        description: `Connecter les services, fiabiliser les echanges de donnees et traiter les erreurs majeures du projet ${projectName}.`,
        priority: "HIGH",
      },
      {
        title: `Renforcer la qualite fonctionnelle de ${projectName}`,
        description: `Couvrir les parcours sensibles avec des tests, des verifications manuelles guidees et des corrections ciblees sur ${projectName}.`,
        priority: "MEDIUM",
      },
      {
        title: `Ameliorer l'experience utilisateur de ${projectName}`,
        description: `Fluidifier les interactions, clarifier les retours visuels et reduire les points de friction sur ${projectName}.`,
        priority: "MEDIUM",
      },
    ];
  }

  return [
    {
      title: `Stabiliser ${projectName} avant livraison`,
      description: `Traiter les anomalies restantes, verifier les cas critiques et consolider la fiabilite globale du projet ${projectName}.`,
      priority: "HIGH",
    },
    {
      title: `Executer la campagne de tests finale de ${projectName}`,
      description: `Valider les parcours prioritaires, documenter les resultats et remonter rapidement les blocages pour ${projectName}.`,
      priority: "HIGH",
    },
    {
      title: `Optimiser les performances de ${projectName}`,
      description: `Identifier les goulots d'etranglement et appliquer des ameliorations ciblant la reactivite et la stabilite de ${projectName}.`,
      priority: "MEDIUM",
    },
    {
      title: `Preparer la mise en production de ${projectName}`,
      description: `Verifier les prerequis de deploiement, la documentation et le plan de suivi post-livraison pour ${projectName}.`,
      priority: "MEDIUM",
    },
  ];
}

function normalizeTaskTitle(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function extractJsonArrayPayload(text: string) {
  const clean = text.replace(/```json|```/g, "").trim();
  const firstBracket = clean.indexOf("[");
  const lastBracket = clean.lastIndexOf("]");

  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return clean.slice(firstBracket, lastBracket + 1);
  }

  return clean;
}

function parseAiTasks(text: string): PartialPreviewTask[] {
  const payload = extractJsonArrayPayload(text);
  const parsed = JSON.parse(payload);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { tasks?: unknown[] }).tasks)) {
    return (parsed as { tasks: PartialPreviewTask[] }).tasks;
  }

  throw apiError("Format de reponse invalide pour les taches generees", 422);
}

function countEnglishSignals(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const normalized = value.toLowerCase();
  const englishSignals = [
    "implement",
    "build",
    "create",
    "update",
    "improve",
    "optimize",
    "review",
    "testing",
    "deploy",
    "dashboard",
    "feature",
    "task",
    "flow",
    "bug",
    "backend",
    "frontend",
    "best match",
    "better fit",
    "on leave",
    "current workload",
  ];

  return englishSignals.reduce((count, signal) => (normalized.includes(signal) ? count + 1 : count), 0);
}

function hasTooMuchEnglishInGeneratedTasks(tasks: PartialPreviewTask[]) {
  const signalCount = tasks.reduce(
    (total, task) =>
      total +
      countEnglishSignals(task.title) +
      countEnglishSignals(task.description) +
      countEnglishSignals(task.comment),
    0,
  );

  return signalCount >= 3;
}

function findBestAssigneeForTask(
  task: PartialPreviewTask,
  activeMembers: ProcessedTeamMember[],
  counts: Map<string, number>,
  maxPerPerson: number,
) {
  const content = `${task.title ?? ""} ${task.description ?? ""} ${task.comment ?? ""}`.toLowerCase();
  const preferredAssigneeId = task.assignedUserId ?? "";

  const rankedMembers = [...activeMembers].sort((a, b) => {
    const aCount = counts.get(a.id) ?? 0;
    const bCount = counts.get(b.id) ?? 0;
    const aSkillScore = a.skills.reduce(
      (score, skill) => content.includes(skill.name.toLowerCase()) ? score + Math.max(skill.level, 1) : score,
      0,
    );
    const bSkillScore = b.skills.reduce(
      (score, skill) => content.includes(skill.name.toLowerCase()) ? score + Math.max(skill.level, 1) : score,
      0,
    );
    const aPreferenceBonus = a.id === preferredAssigneeId ? 3 : 0;
    const bPreferenceBonus = b.id === preferredAssigneeId ? 3 : 0;
    const aTotal = aSkillScore + aPreferenceBonus;
    const bTotal = bSkillScore + bPreferenceBonus;

    if (aCount !== bCount) return aCount - bCount;
    if (aTotal !== bTotal) return bTotal - aTotal;
    return a.name.localeCompare(b.name);
  });

  const underCap = rankedMembers.find((member) => (counts.get(member.id) ?? 0) < maxPerPerson);
  return underCap ?? rankedMembers[0];
}

function rebalanceTasksAcrossMembers(
  tasks: PartialPreviewTask[],
  activeMembers: ProcessedTeamMember[],
  maxPerPerson: number,
) {
  const counts = new Map(activeMembers.map((member) => [member.id, 0]));

  const balancedTasks = tasks.map((task) => {
    const assignee = findBestAssigneeForTask(task, activeMembers, counts, maxPerPerson);
    counts.set(assignee.id, (counts.get(assignee.id) ?? 0) + 1);

    const bestMatchedSkill = assignee.skills.find((skill) => {
      const content = `${task.title ?? ""} ${task.description ?? ""} ${task.comment ?? ""}`.toLowerCase();
      return content.includes(skill.name.toLowerCase());
    });

    const balanceNote = bestMatchedSkill
      ? `Affectation equilibree pour ${assignee.name} sur la base de ${bestMatchedSkill.name} niveau ${bestMatchedSkill.level}/5.`
      : `Affectation equilibree pour ${assignee.name} selon la charge courante de l'equipe.`;

    return {
      ...task,
      assignedUserId: assignee.id,
      comment: task.comment ? `${task.comment} ${balanceNote}` : balanceNote,
    };
  });

  for (const member of activeMembers) {
    if ((counts.get(member.id) ?? 0) > 0) continue;

    const donorTaskIndex = balancedTasks.findIndex((task) => {
      const taskAssigneeId = task.assignedUserId;
      return taskAssigneeId ? (counts.get(taskAssigneeId) ?? 0) > 1 : false;
    });

    if (donorTaskIndex === -1) break;

    const donorTask = balancedTasks[donorTaskIndex];
    const donorId = donorTask.assignedUserId!;
    counts.set(donorId, Math.max((counts.get(donorId) ?? 1) - 1, 0));
    counts.set(member.id, (counts.get(member.id) ?? 0) + 1);
    balancedTasks[donorTaskIndex] = {
      ...donorTask,
      assignedUserId: member.id,
      comment: donorTask.comment
        ? `${donorTask.comment} Reaffectee a ${member.name} pour garantir une repartition complete.`
        : `Reaffectee a ${member.name} pour garantir une repartition complete.`,
    };
  }

  return balancedTasks;
}

function completeGeneratedTasks(args: {
  generatedTasks: PartialPreviewTask[];
  fallbackTasks: PreviewTask[];
  activeMembers: ProcessedTeamMember[];
  maxPerPerson: number;
  startDate: Date | null;
  endDate: Date | null;
  existingTitles: Set<string>;
}) {
  const seenTitles = new Set(args.existingTitles);
  const merged = [...args.generatedTasks];

  for (const fallbackTask of args.fallbackTasks) {
    if (merged.length >= args.fallbackTasks.length) break;

    const fallbackTitleKey = normalizeTaskTitle(fallbackTask.title);
    const hasDuplicate = merged.some((task) => normalizeTaskTitle(task.title || "") === fallbackTitleKey);
    if (hasDuplicate || seenTitles.has(fallbackTitleKey)) continue;

    merged.push(fallbackTask);
    seenTitles.add(fallbackTitleKey);
  }

  const balanced = rebalanceTasksAcrossMembers(
    merged.slice(0, args.fallbackTasks.length),
    args.activeMembers,
    args.maxPerPerson,
  );
  const generatedTitleKeys = new Set<string>();

  return balanced.map((task, index) => {
    let title = (task.title ?? "").trim();
    if (!title) {
      title = args.fallbackTasks[index]?.title ?? `Tache projet ${index + 1}`;
    }

    const baseTitle = title;
    let suffix = 2;
    while (seenTitles.has(normalizeTaskTitle(title)) || generatedTitleKeys.has(normalizeTaskTitle(title))) {
      title = `${baseTitle} ${suffix}`;
      suffix += 1;
    }
    seenTitles.add(normalizeTaskTitle(title));
    generatedTitleKeys.add(normalizeTaskTitle(title));

    return {
      title,
      description: (task.description ?? "").trim() || args.fallbackTasks[index]?.description || `Contribution planifiee pour ${title}.`,
      assignedUserId: task.assignedUserId ?? args.activeMembers[index % args.activeMembers.length].id,
      dueDate:
        isGeneratedDueDateUsable(task.dueDate, args.startDate, args.endDate)
          ? new Date(task.dueDate as string).toISOString()
          : buildDueDate(args.startDate, args.endDate, index, args.fallbackTasks.length),
      priority:
        task.priority === "HIGH" || task.priority === "MEDIUM" || task.priority === "LOW"
          ? task.priority
          : args.fallbackTasks[index]?.priority || "MEDIUM",
      comment: task.comment?.trim() || args.fallbackTasks[index]?.comment || null,
    };
  });
}

function buildFallbackTasks(args: {
  project: { name: string; tasks: Array<{ title: string }> };
  activeMembers: ProcessedTeamMember[];
  unavailableMembers: ProcessedTeamMember[];
  phase: string;
  totalTasks: number;
  startDate: Date | null;
  endDate: Date | null;
}): PreviewTask[] {
  const templates = getPhaseTemplates(args.project.name, args.phase);
  const existingTitles = new Set(args.project.tasks.map((task) => task.title.trim().toLowerCase()));
  const generatedTitles = new Set<string>();

  return Array.from({ length: args.totalTasks }, (_, index) => {
    const assignee = args.activeMembers[index % args.activeMembers.length];
    const template = templates[index % templates.length];
    let title = template.title;
    const baseTitle = title;
    let suffix = 2;

    while (existingTitles.has(title.toLowerCase()) || generatedTitles.has(title.toLowerCase())) {
      title = `${baseTitle} ${suffix}`;
      suffix += 1;
    }
    generatedTitles.add(title.toLowerCase());

    const bestUnavailableMatch = args.unavailableMembers.find((member) =>
      member.skills.some((skill) => assignee.skills.some((assigneeSkill) => assigneeSkill.name === skill.name)),
    );

    return {
      title,
      description: `${template.description} Responsable suggere: ${assignee.name}${assignee.skills.length > 0 ? ` (${assignee.skills.map((skill) => `${skill.name} ${skill.level}/5`).join(", ")})` : ""}.`,
      assignedUserId: assignee.id,
      dueDate: buildDueDate(args.startDate, args.endDate, index, args.totalTasks),
      priority: template.priority,
      comment: bestUnavailableMatch
        ? `Suggestion locale: ${bestUnavailableMatch.name} presente aussi un bon profil mais est actuellement en conge.`
        : "Suggestion locale generee sans assistance IA.",
    };
  });
}

export function validateTaskDueDateForProject(
  dueDateInput: string,
  projectSchedule: { startDate?: Date | null; endDate?: Date | null },
) {
  const normalizedDueDate = toDateOnlyValue(dueDateInput);
  const parsedDueDate = normalizedDueDate ? parseDateOnlyToUtcDate(normalizedDueDate) : null;
  if (!parsedDueDate || !normalizedDueDate) {
    throw apiError("La date d'echeance d'une tache est invalide", 400);
  }

  const today = getTodayDateOnly();
  if (normalizedDueDate <= today) {
    throw apiError("La date d'echeance d'une tache doit etre au moins un jour apres aujourd'hui", 400);
  }

  const projectStartDate = toDateOnlyValue(projectSchedule.startDate);
  if (projectStartDate && normalizedDueDate < projectStartDate) {
    throw apiError("La date d'echeance d'une tache doit etre posterieure ou egale a la date de debut du projet", 400);
  }

  const projectEndDate = toDateOnlyValue(projectSchedule.endDate);
  if (projectEndDate && projectEndDate > today && normalizedDueDate > projectEndDate) {
    throw apiError("La date d'echeance d'une tache doit etre anterieure ou egale a la date de fin du projet", 400);
  }

  return parsedDueDate;
}

class ProjectsService {
  private validateProjectDates(
    startDateInput?: string | null,
    endDateInput?: string | null,
    options?: { allowPastStartDate?: boolean; allowPastEndDate?: boolean },
  ) {
    const today = getTodayDateOnly();
    const startDate = startDateInput ? parseDateOnlyToUtcDate(startDateInput) : null;
    const endDate = endDateInput ? parseDateOnlyToUtcDate(endDateInput) : null;

    if (startDateInput && !startDate) {
      throw apiError("La date de debut du projet est invalide", 400);
    }

    if (endDateInput && !endDate) {
      throw apiError("La date de fin du projet est invalide", 400);
    }

    if (startDateInput && startDateInput < today && !options?.allowPastStartDate) {
      throw apiError("La date de debut du projet ne peut pas etre dans le passe", 400);
    }

    if (endDateInput && endDateInput < today && !options?.allowPastEndDate) {
      throw apiError("La date de fin du projet ne peut pas etre dans le passe", 400);
    }

    if (startDateInput && endDateInput && endDateInput <= startDateInput) {
      throw apiError("La date de fin du projet doit etre au moins un jour apres la date de debut", 400);
    }

    return { startDate, endDate };
  }

  async listProjects(user: CurrentUser, pagination: PaginationParams = {}) {
    const { page = 1, limit = 20 } = pagination;
    let whereClause = {};

    if (user.role === ROLE.EMPLOYEE) {
      whereClause = { team: { some: { id: user.id } } };
    } else if (user.role === ROLE.MANAGER) {
      whereClause = { createdById: user.id };
    }

    const [data, total] = await prisma.$transaction([
      prisma.project.findMany({
        where: whereClause,
        include: {
          tasks: { include: taskWithRelationsInclude },
          team: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
          changeHistory: {
            where: { action: "TRANSFERRED" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where: whereClause })
    ]);

    return { data, total, page, limit, hasMore: page * limit < total };
  }

  async getProjectById(user: CurrentUser, projectId: string) {
    await assertProjectAccess(user, projectId);
    return prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: { include: taskWithRelationsInclude },
        team: { select: { id: true, name: true, avatar: true } },
        manager: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        changeHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
  }

  async createProject(user: CurrentUser, body: {
    name: string;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    priority?: string | null;
    teamMemberIds?: string[];
  }) {
    if (user.role !== ROLE.MANAGER) {
      throw apiError("Acces refuse: seul un chef peut creer un projet", 403);
    }

    if (body.teamMemberIds?.length) {
      const validTeamIds = await getManagerTeamMemberIds(user.id);
      const invalidMembers = body.teamMemberIds.filter((id) => !validTeamIds.includes(id));
      if (invalidMembers.length > 0) {
        throw apiError("Vous ne pouvez assigner que des membres de votre equipe", 400);
      }
    }

    const { startDate, endDate } = this.validateProjectDates(body.startDate, body.endDate);

    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: body.name,
          description: body.description,
          startDate,
          endDate,
          priority: body.priority || "MEDIUM",
          managerId: user.id,
          createdById: user.id,
          createdByRole: user.role,
          status: "EN_COURS",
          team: body.teamMemberIds?.length
            ? { connect: body.teamMemberIds.map((id) => ({ id })) }
            : undefined,
        },
        include: {
          tasks: { include: taskWithRelationsInclude },
          team: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          changeHistory: {
            where: { action: "TRANSFERRED" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (body.teamMemberIds?.length) {
        await tx.notification.createMany({
          data: body.teamMemberIds.map((memberId) => ({
            employeeId: memberId,
            title: "Nouveau projet assigne",
            message: `Vous avez ete assigne au projet "${body.name}"`,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          action: "CREATED",
          entity: "Project",
          entityId: project.id,
          details: JSON.stringify({ name: project.name, status: project.status }),
        },
      });

      return project;
    });
  }

  async updateProject(user: CurrentUser, projectId: string, body: Record<string, unknown>) {
    const { project } = await assertProjectAccess(user, projectId);

    if (user.role !== ROLE.MANAGER && user.role !== ROLE.HR) {
      throw apiError("Acces refuse: seul un chef peut modifier un projet", 403);
    }

    const isRHProject = project.createdByRole === "RH";
    const isOwnProject = project.createdById === user.id;
    const nextStartDateInput =
      body.startDate === undefined
        ? toDateOnlyValue(project.startDate) || null
        : typeof body.startDate === "string" && body.startDate
          ? body.startDate
          : null;
    const nextEndDateInput =
      body.endDate === undefined
        ? toDateOnlyValue(project.endDate) || null
        : typeof body.endDate === "string" && body.endDate
          ? body.endDate
          : null;
    const currentStartDateInput = toDateOnlyValue(project.startDate) || null;
    const currentEndDateInput = toDateOnlyValue(project.endDate) || null;
    const validatedProjectDates = this.validateProjectDates(nextStartDateInput, nextEndDateInput, {
      allowPastStartDate: nextStartDateInput === currentStartDateInput,
      allowPastEndDate: nextEndDateInput === currentEndDateInput,
    });

    if (user.role === ROLE.MANAGER && isRHProject && !isOwnProject) {
      const oldValues = JSON.stringify({
        name: project.name,
        description: project.description,
        startDate: project.startDate?.toISOString(),
        endDate: project.endDate?.toISOString(),
        priority: project.priority,
        status: project.status,
      });
      const newValues = JSON.stringify({
        name: body.name,
        description: body.description,
        startDate: body.startDate,
        endDate: body.endDate,
        priority: body.priority,
        status: body.status,
      });

      return prisma.$transaction(async (tx) => {
        const changeHistory = await tx.projectChangeHistory.create({
          data: {
            projectId,
            actorId: user.id,
            actorName: user.name,
            action: "MODIFICATION",
            oldValues,
            newValues,
            approved: false,
          },
        });

        const rhUsers = await tx.employee.findMany({ where: { role: "RH" } });
        if (rhUsers.length > 0) {
          await tx.notification.createMany({
            data: rhUsers.map((rh) => ({
              employeeId: rh.id,
              title: "Modification en attente d'approbation",
              message: `${user.name} a demande une modification sur le projet "${project.name}". Veuillez approuver ou rejeter.`,
            })),
          });
        }

        return {
          message: "Modification soumise pour approbation",
          changeHistory,
          requiresApproval: true,
        };
      });
    }

    const updateData: {
      name?: string;
      description?: string | null;
      startDate?: Date | null;
      endDate?: Date | null;
      priority?: string;
      status?: ProjectStatus;
      slaBreached?: boolean;
      team?: { set: Array<{ id: string }> };
    } = {};

    if (typeof body.name === "string" && body.name.length > 0) {
      updateData.name = body.name;
    }
    if (body.description !== undefined) {
      updateData.description = typeof body.description === "string" ? body.description : null;
    }
    if (body.startDate !== undefined) {
      updateData.startDate = typeof body.startDate === "string" && body.startDate ? validatedProjectDates.startDate : null;
    }
    if (body.endDate !== undefined) {
      updateData.endDate = typeof body.endDate === "string" && body.endDate ? validatedProjectDates.endDate : null;
    }
    if (body.priority !== undefined) {
      updateData.priority = String(body.priority);
    }
    if (body.status && typeof body.status === "string") {
      updateData.status = parseProjectStatus(body.status);
    }
    const nextProjectStatus = updateData.status ?? project.status;
    const nextProjectEndDate = body.endDate !== undefined ? updateData.endDate ?? null : project.endDate;
    if (
      isProjectSlaBreached({
        status: project.status,
        endDate: project.endDate,
        slaBreached: project.slaBreached,
      }) ||
      (nextProjectStatus === "TERMINE" && hasProjectReachedPlannedEndDate(nextProjectEndDate))
    ) {
      updateData.slaBreached = true;
    }
    if (Array.isArray(body.teamMemberIds)) {
      updateData.team = {
        set: body.teamMemberIds.map((teamMemberId) => ({ id: String(teamMemberId) })),
      };
    }

    return prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: updateData,
        include: {
          tasks: { include: taskWithRelationsInclude },
          team: { select: { id: true, name: true, avatar: true } },
        },
      });

      await tx.projectChangeHistory.create({
        data: {
          projectId,
          actorId: user.id,
          actorName: user.name,
          action: "MODIFICATION",
          approved: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          action: "UPDATED",
          entity: "Project",
          entityId: projectId,
          details: JSON.stringify({ name: updatedProject.name }),
        },
      });

      return updatedProject;
    });
  }

  async deleteProject(user: CurrentUser, projectId: string) {
    const { project } = await assertProjectAccess(user, projectId);

    if (user.role !== ROLE.MANAGER && user.role !== ROLE.HR) {
      throw apiError("Acces refuse: seul un chef peut supprimer un projet", 403);
    }

    if (user.role === ROLE.MANAGER && project.createdById !== user.id) {
      throw apiError("Vous ne pouvez pas supprimer ce projet", 403);
    }

    const completedTaskCount = await prisma.task.count({
      where: { projectId, status: "DONE" },
    });
    if (completedTaskCount > 0) {
      throw apiError("Un projet contenant une tache terminee ne peut pas etre supprime", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { projectId } });
      await tx.projectChangeHistory.deleteMany({ where: { projectId } });
      await tx.project.delete({ where: { id: projectId } });
    });

    return { success: true };
  }

  async listPendingChanges(_user: CurrentUser, projectId: string) {
    return prisma.projectChangeHistory.findMany({
      where: {
        projectId,
        approved: false,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async reviewProjectChange(user: CurrentUser, projectId: string, body: { changeId: string; action: string; comment?: string | null }) {
    const change = await prisma.projectChangeHistory.findUnique({
      where: { id: body.changeId },
      include: { project: true },
    });

    if (!change) {
      throw apiError("Change not found", 404);
    }

    if (change.projectId !== projectId) {
      throw apiError("Change does not belong to this project", 400);
    }

    if (body.action === "APPROVE") {
      const newValues = JSON.parse(change.newValues || "{}") as Record<string, string | null>;
      const nextStartDateInput = newValues.startDate ?? toDateOnlyValue(change.project.startDate) ?? null;
      const nextEndDateInput = newValues.endDate ?? toDateOnlyValue(change.project.endDate) ?? null;
      const validatedProjectDates = this.validateProjectDates(nextStartDateInput, nextEndDateInput, {
        allowPastStartDate: nextStartDateInput === (toDateOnlyValue(change.project.startDate) || null),
        allowPastEndDate: nextEndDateInput === (toDateOnlyValue(change.project.endDate) || null),
      });
      const nextStatus = newValues.status ? parseProjectStatus(newValues.status) : change.project.status;
      const nextEndDate = newValues.endDate ? validatedProjectDates.endDate : change.project.endDate;
      return prisma.$transaction(async (tx) => {
        const updatedProject = await tx.project.update({
          where: { id: projectId },
          data: {
            name: newValues.name ?? change.project.name,
            description: newValues.description ?? change.project.description,
            startDate: newValues.startDate ? validatedProjectDates.startDate : null,
            endDate: newValues.endDate ? validatedProjectDates.endDate : null,
            priority: newValues.priority ?? change.project.priority,
            status: nextStatus,
            slaBreached:
              change.project.slaBreached ||
              isProjectSlaBreached(change.project) ||
              (nextStatus === "TERMINE" && hasProjectReachedPlannedEndDate(nextEndDate)),
          },
          include: {
            tasks: true,
            team: { select: { id: true, name: true } },
          },
        });

        await tx.projectChangeHistory.update({
          where: { id: body.changeId },
          data: { approved: true, approvedBy: user.id },
        });

        await tx.notification.create({
          data: {
            employeeId: change.actorId,
            title: "Modification approuvee",
            message: `Votre modification sur le projet "${change.project.name}" a ete approuvee par ${user.name}.${body.comment ? ` Commentaire: ${body.comment}` : ""}`,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            actorName: user.name,
            action: "APPROVED",
            entity: "Project",
            entityId: projectId,
            details: JSON.stringify({ changeId: body.changeId, comment: body.comment }),
          },
        });

        return {
          message: "Modification approuvee",
          project: updatedProject,
        };
      });
    }

    if (body.action === "REJECT") {
      return prisma.$transaction(async (tx) => {
        await tx.projectChangeHistory.update({
          where: { id: body.changeId },
          data: { approvedBy: user.id },
        });

        await tx.notification.create({
          data: {
            employeeId: change.actorId,
            title: "Modification rejetee",
            message: `Votre modification sur le projet "${change.project.name}" a ete rejetee par ${user.name}.${body.comment ? ` Raison: ${body.comment}` : ""}`,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            actorName: user.name,
            action: "REJECTED",
            entity: "Project",
            entityId: projectId,
            details: JSON.stringify({ changeId: body.changeId, comment: body.comment }),
          },
        });

        return { message: "Modification rejetee" };
      });
    }

    throw apiError("Invalid action", 400);
  }

  async generateTasksForProject(user: CurrentUser, projectId: string) {
    const apiKey = await resolveGroqApiKey();
    const { project } = await assertProjectAccess(user, projectId);

    if (user.role !== ROLE.MANAGER) {
      throw apiError("Acces refuse a ce projet", 403);
    }

    const detailedProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            position: true,
            role: true,
            skills: {
              select: {
                level: true,
                skill: {
                  select: { name: true },
                },
              },
            },
            requests: {
              where: { type: "CONGE", status: "APPROUVE" },
              select: { startDate: true, endDate: true },
            },
          },
        },
        tasks: {
          select: {
            title: true,
            status: true,
          },
        },
      },
    });

    if (!detailedProject) {
      throw apiError("Projet non trouve", 404);
    }

    if (
      !(
        detailedProject.createdById === user.id ||
        detailedProject.managerId === user.id
      )
    ) {
      throw apiError("Acces refuse a ce projet", 403);
    }

    if (detailedProject.team.length === 0) {
      throw apiError("Aucun membre dans l'equipe. Veuillez d'abord assigner des membres au projet.", 400);
    }

    const progress = detailedProject.progress ?? 0;
    const phase =
      progress < 30
        ? "demarrage (socle technique, architecture, modeles coeur)"
        : progress < 70
          ? "milieu (fonctionnalites, integrations, interface)"
          : "finalisation (tests, corrections, optimisation, mise en production)";

    const today = new Date();
    const processedTeamMembers: ProcessedTeamMember[] = detailedProject.team.map((member) => {
      const isOnLeave = member.requests.some((request: TeamLeaveRequest) => {
        const start = request.startDate ? new Date(request.startDate) : null;
        const end = request.endDate ? new Date(request.endDate) : null;
        if (!start || !end) return false;
        return today >= start && today <= end;
      });

      return {
        id: member.id,
        name: member.name,
        jobTitle: member.position || member.role,
        status: isOnLeave ? "en_conge" : "active",
        skills: member.skills.map((skill: TeamSkill) => ({ name: skill.skill.name, level: skill.level })) || [],
      };
    });

    const unavailableMembers = processedTeamMembers.filter((member) => member.status === "en_conge");
    const activeMembers = processedTeamMembers.filter((member) => member.status === "active");

    if (activeMembers.length === 0) {
      throw apiError("Aucun membre actif n'est disponible pour recevoir des taches actuellement.", 400);
    }

    const maxPerPerson = Math.max(1, Math.ceil(Math.min(activeMembers.length * 2, 10) * 0.4));
    const totalTasks = Math.max(activeMembers.length, Math.min(activeMembers.length * 2, 10));

    const systemPrompt = `Tu es un moteur de generation et d'affectation de taches projet.
Tu dois repondre UNIQUEMENT en FRANCAIS.
Retourne UNIQUEMENT un tableau JSON valide, sans markdown, sans explication et sans bloc de code.

REGLES STRICTES :
1. Ne repete jamais et ne reformule jamais les taches existantes.
2. Tous les membres actifs doivent recevoir au moins 1 tache.
3. Nombre maximum de taches par personne : ${maxPerPerson}. Ne jamais depasser cette limite.
4. Pour chaque tache, cherche le meilleur match de competences. Si cette personne est ACTIVE, assigne-lui la tache. Si elle est en_conge, assigne la tache au meilleur profil actif suivant et indique-le clairement en francais dans le commentaire.
5. Si aucun profil actif n'est evident, assigne la tache a la personne active la moins chargee et explique-le en francais dans le commentaire.
6. Chaque generation doit adopter un angle different. Si les taches existantes couvrent deja un domaine, propose autre chose utile au projet.
7. Respecte strictement la phase du projet.
8. Genere un vrai plan de charge d'equipe, pas une seule tache.
9. Dans chaque commentaire, mentionne la competence principale et le niveau qui justifient l'affectation.
10. Tout le contenu retourne doit etre en francais : titres, descriptions, commentaires et formulations.
11. N'utilise pas d'anglais sauf pour des noms techniques indispensables comme React, Node.js ou PostgreSQL.`;

    const userPrompt = `Projet : ${detailedProject.name}
Description : ${detailedProject.description}
Debut : ${detailedProject.startDate ? new Date(detailedProject.startDate).toISOString() : "Non definie"} | Fin : ${detailedProject.endDate ? new Date(detailedProject.endDate).toISOString() : "Non definie"}
Progression : ${progress}% - Phase : ${phase}

TACHES EXISTANTES - ne pas les repeter ni les reformuler :
${detailedProject.tasks.map((task) => `- [${task.status}] ${task.title}`).join("\n") || "aucune pour le moment"}

MEMBRES ACTIFS (les taches doivent etre assignees a ces personnes) :
${activeMembers.map((member) => `- id: ${member.id} | nom: ${member.name} | poste: ${member.jobTitle} | competences: ${member.skills.map((skill) => `${skill.name}(${skill.level}/5)`).join(", ") || "generaliste"}`).join("\n")}

MEMBRES INDISPONIBLES (ne pas leur assigner de tache, les mentionner seulement dans les commentaires si utile) :
${unavailableMembers.map((member) => `- nom: ${member.name} | competences: ${member.skills.map((skill) => `${skill.name}(${skill.level}/5)`).join(", ") || "generaliste"} | statut: ${member.status}`).join("\n") || "aucun"}

Genere exactement ${totalTasks} taches. Maximum ${maxPerPerson} taches par personne. Chaque membre actif doit recevoir au moins 1 tache.
Les taches doivent etre reparties de facon equilibree selon la charge actuelle et le niveau de competences.

Retourne UNIQUEMENT ce tableau JSON :
[
  {
    "title": string,
    "description": string,
    "assignedUserId": string,
    "dueDate": string,
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "comment": string | null
  }
]`;

    let generatedTasks: PreviewTask[];
    let generationMode: "ai" | "fallback" = "ai";
    let warning: string | null = null;

    if (!apiKey) {
      generationMode = "fallback";
      warning = "GROQ_API_KEY est absente. Une suggestion locale a ete utilisee.";
      generatedTasks = buildFallbackTasks({
        project: detailedProject,
        activeMembers,
        unavailableMembers,
        phase,
        totalTasks,
        startDate: detailedProject.startDate ? new Date(detailedProject.startDate) : null,
        endDate: detailedProject.endDate ? new Date(detailedProject.endDate) : null,
      });
    } else {
      try {
        const groq = new Groq({ apiKey });
        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) {
          throw apiError("Le service IA est indisponible. Une suggestion locale a ete utilisee.", 500);
        }

        generatedTasks = parseAiTasks(text) as PreviewTask[];

        if (hasTooMuchEnglishInGeneratedTasks(generatedTasks)) {
          throw apiError("La reponse IA contient trop d'anglais. Une suggestion locale a ete utilisee.", 422);
        }
      } catch (error) {
        const groqError = error as { status?: number; code?: string; message?: string };
        generationMode = "fallback";
        warning =
          groqError.status === 401 ||
          groqError.code === "invalid_api_key" ||
          groqError.message?.includes("Invalid API Key")
            ? "La cle API Groq est invalide. Une suggestion locale a ete utilisee."
            : groqError.message?.includes("contient trop d'anglais")
              ? "La reponse IA etait majoritairement en anglais. Une suggestion locale en francais a ete utilisee."
            : "Le service IA est indisponible. Une suggestion locale a ete utilisee.";
        generatedTasks = buildFallbackTasks({
          project: detailedProject,
          activeMembers,
          unavailableMembers,
          phase,
          totalTasks,
          startDate: detailedProject.startDate ? new Date(detailedProject.startDate) : null,
          endDate: detailedProject.endDate ? new Date(detailedProject.endDate) : null,
        });
      }
    }

    const fallbackTasks = buildFallbackTasks({
      project: detailedProject,
      activeMembers,
      unavailableMembers,
      phase,
      totalTasks,
      startDate: detailedProject.startDate ? new Date(detailedProject.startDate) : null,
      endDate: detailedProject.endDate ? new Date(detailedProject.endDate) : null,
    });

    const existingTitles = new Set(detailedProject.tasks.map((task) => normalizeTaskTitle(task.title)));
    generatedTasks = completeGeneratedTasks({
      generatedTasks,
      fallbackTasks,
      activeMembers,
      maxPerPerson,
      startDate: detailedProject.startDate ? new Date(detailedProject.startDate) : null,
      endDate: detailedProject.endDate ? new Date(detailedProject.endDate) : null,
      existingTitles,
    });

    for (const task of generatedTasks) {
      if (!task.title || !task.description || !task.assignedUserId || !task.dueDate || !task.priority) {
        throw apiError("Les taches generees sont incompletes", 422);
      }

      const validUser = activeMembers.find((member) => member.id === task.assignedUserId);
      if (!validUser) {
        throw apiError(`Utilisateur invalide assigne: ${task.assignedUserId}`, 422);
      }

      validateTaskDueDateForProject(task.dueDate, detailedProject);
    }

    return {
      tasks: generatedTasks,
      projectName: detailedProject.name,
      teamMembers: activeMembers,
      generationMode,
      warning,
    };
  }

  async saveGeneratedTasks(user: CurrentUser, projectId: string, tasks: PreviewTask[]) {
    if (!tasks.length) {
      throw apiError("Aucune tache a sauvegarder", 400);
    }

    const { project } = await assertProjectAccess(user, projectId);
    if (
      user.role !== ROLE.MANAGER ||
      !(
        project.createdById === user.id ||
        project.managerId === user.id
      )
    ) {
      throw apiError("Acces refuse a ce projet", 403);
    }

    const taskData = tasks.map((task) => ({
      title: task.title,
      description: task.description,
      assigneeId: task.assignedUserId,
      projectId,
      dueDate: validateTaskDueDateForProject(task.dueDate, project),
      priority: task.priority,
      status: "TODO" as const,
    }));

    return prisma.$transaction(async (tx) => {
      await tx.task.createMany({
        data: taskData,
      });

      const notificationsByAssignee = [...new Set(tasks.map((task) => task.assignedUserId))].map((assigneeId) => {
        const assigneeTasks = tasks.filter((task) => task.assignedUserId === assigneeId);
        const taskTitles = assigneeTasks.map((task) => `"${task.title}"`).join(", ");

        return {
          employeeId: assigneeId,
          title: "Nouvelles taches assignees",
          message: `${user.name} vous a assigne ${assigneeTasks.length} tache(s) dans le projet "${project.name}" : ${taskTitles}`,
        };
      });

      if (notificationsByAssignee.length > 0) {
        await tx.notification.createMany({
          data: notificationsByAssignee,
        });
      }

      const allTasks = await tx.task.findMany({ where: { projectId } });
      const completedTasks = allTasks.filter((task) => task.status === "DONE").length;
      const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;
      const status =
        allTasks.length > 0 && completedTasks === allTasks.length
          ? "TERMINE"
          : "EN_COURS";
      const slaBreached =
        project.slaBreached ||
        isProjectSlaBreached(project) ||
        (status === "TERMINE" && hasProjectReachedPlannedEndDate(project.endDate));

      await tx.project.update({
        where: { id: projectId },
        data: { progress, status, slaBreached },
      });

      const createdTasks = await tx.task.findMany({
        where: {
          projectId,
          OR: taskData.map((task) => ({
            title: task.title,
            assigneeId: task.assigneeId,
          })),
        },
        orderBy: { createdAt: "desc" },
        take: taskData.length,
      });

      return {
        success: true,
        tasks: createdTasks,
        message: `${createdTasks.length} tache(s) creee(s) avec succes`,
      };
    });
  }
}

export const projectsService = new ProjectsService();
