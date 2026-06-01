import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/mailer";
import { apiError } from "@/lib/utils/api-response";
import { resolveSalary } from "@/lib/utils/salary";
import { getTodayDateOnly, isDateOnlyWithinRange, toDateOnlyValue } from "@/lib/leave-request";
import { findNearestLeavePeriodInWindow } from "@/lib/leave-request";
import { createInitialSalaryHistory, syncSalaryHistoryOnCompensationChange } from "@/lib/services/server/salary-history.service";
import { deletePrivateConversationsForUser } from "@/lib/services/server/shared.service";
import type { CurrentUser } from "@/lib/services/server/auth.service";
import type { PaginatedResult, PaginationParams } from "@/lib/types/pagination";
import {
  applyManagerSkillChanges,
  employeeCreateInputSchema,
  employeeSkillChangeBatchSchema,
  employeeUpdateInputSchema,
  getEmployeeSkillProfile,
  initializeCollaboratorSkillProfile,
} from "@/lib/skills";

type EmployeeCreateInput = z.infer<typeof employeeCreateInputSchema>;
type EmployeeFormInput = z.infer<typeof employeeUpdateInputSchema>;
type EmployeeSkillChangeBatchInput = z.infer<typeof employeeSkillChangeBatchSchema>;

const employeeListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  role: true,
  department: true,
  position: true,
  managerId: true,
  hireDate: true,
  leaveBalance: true,
  salaryGradeId: true,
  salaryOverride: true,
  requests: {
    where: { type: "CONGE", status: "APPROUVE" },
    select: { id: true, startDate: true, endDate: true },
  },
} satisfies Prisma.EmployeeSelect;

const chatEmployeeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  position: true,
  avatar: true,
} satisfies Prisma.EmployeeSelect;

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  role: true,
  department: true,
  position: true,
  hireDate: true,
  leaveBalance: true,
} satisfies Prisma.EmployeeSelect;

const profileUpdateSchema = z.object({
  avatar: z.string().url("Avatar must be a valid URL").startsWith("https://", "Avatar must use HTTPS").optional().nullable(),
  name: z.string().min(2, "Name too short").max(50, "Name too long").optional(),
  phone: z.string().regex(/^[0-9+\s]+$/, "Invalid phone format").optional(),
});

type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

function buildAccountEmailHtml(data: { name: string; email: string; role: string; department: string; tempPassword: string; loginUrl: string }) {
  return `<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; color: #212121">
  <div style="max-width: 600px; margin: auto">
    <div style="text-align: center; background-color: #1B3A6B; padding: 32px 16px; border-radius: 32px 32px 0 0;">
      <span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.04em;">
        ARAB<span style="color: #F5A623;">SOFT</span>
        <span style="font-size: 13px; color: rgba(255,255,255,0.5); border-left: 1px solid rgba(255,255,255,0.2); padding-left: 10px; margin-left: 4px; letter-spacing: 0.08em; font-weight: 400;">HR</span>
      </span>
    </div>
    <div style="background-color: #F5A623; height: 4px;"></div>
    <div style="padding: 32px 24px; background-color: #ffffff;">
      <h1 style="font-size: 24px; color: #1B3A6B; margin-bottom: 8px;">Bienvenue sur ArabSoft HR</h1>
      <p style="color: #64748B; margin-top: 0; margin-bottom: 24px; font-size: 14px;">Votre compte a ete cree avec succes par le service RH.</p>
      <div style="background-color: #F4F6FA; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; border-left: 4px solid #F5A623;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #1B3A6B; font-size: 15px;">Vos informations de connexion</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #64748B; width: 40%;">Nom complet</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.name}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Email</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.email}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Role</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.role}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Departement</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.department}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Mot de passe temporaire</td><td style="padding: 6px 0;"><span style="background-color: #1B3A6B; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 15px; letter-spacing: 0.1em;">${data.tempPassword}</span></td></tr>
        </table>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${data.loginUrl}" target="_blank" style="display: inline-block; background-color: #1B3A6B; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.02em;">Acceder au portail</a>
      </div>
    </div>
    <div style="background-color: #F5A623; height: 4px;"></div>
    <div style="text-align: center; background-color: #1B3A6B; padding: 24px 16px; border-radius: 0 0 32px 32px;">
      <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 8px;">Pour toute question, regardez vos notifications a la connexion.</p>
      <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.4);">(c) 2026 ArabSoft. Tous droits reserves.</p>
    </div>
  </div>
</div>`;
}

function buildPasswordResetEmailHtml(data: { name: string; email: string; tempPassword: string; loginUrl: string }) {
  return `<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; color: #212121">
  <div style="max-width: 600px; margin: auto">
    <div style="text-align: center; background-color: #1B3A6B; padding: 32px 16px; border-radius: 32px 32px 0 0;">
      <span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.04em;">
        ARAB<span style="color: #F5A623;">SOFT</span>
        <span style="font-size: 13px; color: rgba(255,255,255,0.5); border-left: 1px solid rgba(255,255,255,0.2); padding-left: 10px; margin-left: 4px; letter-spacing: 0.08em; font-weight: 400;">HR</span>
      </span>
    </div>
    <div style="background-color: #F5A623; height: 4px;"></div>
    <div style="padding: 32px 24px; background-color: #ffffff;">
      <h1 style="font-size: 24px; color: #1B3A6B; margin-bottom: 8px;">Reinitialisation du mot de passe</h1>
      <p style="color: #64748B; margin-top: 0; margin-bottom: 24px; font-size: 14px;">Un administrateur a reinitialise votre mot de passe. Voici vos nouvelles informations de connexion.</p>
      <div style="background-color: #F4F6FA; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; border-left: 4px solid #F5A623;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #1B3A6B; font-size: 15px;">Vos nouvelles informations de connexion</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #64748B; width: 40%;">Nom complet</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.name}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Email</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.email}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Nouveau mot de passe</td><td style="padding: 6px 0;"><span style="background-color: #1B3A6B; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 15px; letter-spacing: 0.1em;">${data.tempPassword}</span></td></tr>
        </table>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${data.loginUrl}" target="_blank" style="display: inline-block; background-color: #1B3A6B; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.02em;">Acceder au portail</a>
      </div>
    </div>
    <div style="background-color: #F5A623; height: 4px;"></div>
    <div style="text-align: center; background-color: #1B3A6B; padding: 24px 16px; border-radius: 0 0 32px 32px;">
      <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 8px;">Pour toute question, contactez le service RH.</p>
      <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.4);">(c) 2026 ArabSoft. Tous droits reserves.</p>
    </div>
  </div>
</div>`;
}

function mapEmployeeListItem(employee: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: Role;
  department: string | null;
  position: string | null;
  managerId: string | null;
  hireDate: Date | null;
  leaveBalance: number | null;
  salaryGradeId: string | null;
  salaryOverride: number | null;
  requests: Array<{ id: string; startDate: Date | null; endDate: Date | null }>;
}) {
  const todayDate = getTodayDateOnly();
  const onLeave = employee.requests.some((request) => {
    const startDate = toDateOnlyValue(request.startDate);
    const endDate = toDateOnlyValue(request.endDate);
    return !!startDate && !!endDate && isDateOnlyWithinRange(todayDate, startDate, endDate);
  });

  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    avatar: employee.avatar,
    role: employee.role,
    department: employee.department,
    position: employee.position,
    managerId: employee.managerId,
    hireDate: employee.hireDate ? employee.hireDate.toISOString() : null,
    leaveBalance: typeof employee.leaveBalance === "number" ? employee.leaveBalance : 0,
    salaryGradeId: employee.salaryGradeId,
    salaryOverride: employee.salaryOverride,
    onLeave,
  };
}

class EmployeesService {
  profileUpdateSchema = profileUpdateSchema;

  private async assertAccessibleEmployee(actor: CurrentUser, employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, managerId: true },
    });

    if (!employee) {
      throw apiError("Employe introuvable", 404);
    }

    if (actor.role === Role.RH) {
      return employee;
    }

    if (actor.role === Role.CHEF) {
      if (employee.managerId !== actor.id) {
        throw apiError("Acces refuse", 403);
      }
      return employee;
    }

    if (actor.id !== employeeId) {
      throw apiError("Acces refuse", 403);
    }

    return employee;
  }

  async listEmployees(
    actor: CurrentUser,
    pagination: PaginationParams = {},
  ): Promise<
    PaginatedResult<ReturnType<typeof mapEmployeeListItem>> |
    (Prisma.EmployeeGetPayload<{ include: { manager: { select: { id: true; name: true } } } }> | null)
  > {
    const { page = 1, limit = 50 } = pagination;

    if (actor.role === Role.RH) {
      const [employees, total] = await prisma.$transaction([
        prisma.employee.findMany({
          select: employeeListSelect,
          orderBy: [{ role: "asc" }, { department: "asc" }, { name: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.employee.count(),
      ]);

      return {
        data: employees.map(mapEmployeeListItem),
        total,
        page,
        limit,
        hasMore: page * limit < total,
      };
    }

    if (actor.role === Role.CHEF) {
      const where = { managerId: actor.id };
      const [team, total] = await prisma.$transaction([
        prisma.employee.findMany({
          where,
          select: employeeListSelect,
          orderBy: { name: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.employee.count({ where }),
      ]);

      return {
        data: team.map(mapEmployeeListItem),
        total,
        page,
        limit,
        hasMore: page * limit < total,
      };
    }

    return prisma.employee.findUnique({
      where: { id: actor.id },
      include: { manager: { select: { id: true, name: true } } },
    });
  }

  async createEmployee(actor: CurrentUser, input: EmployeeCreateInput) {
    const { name, email, phone, role, department, position, managerId, hireDate, subordinateIds, technicalSkills, salaryGradeId, salaryOverride } = input;

    if (role === Role.RH) {
      throw apiError("La creation d'un second compte RH est interdite", 400);
    }

    if (!salaryGradeId) {
      throw apiError("Le grade salarial est obligatoire", 400);
    }

    const grade = await prisma.salaryGrade.findUnique({ where: { id: salaryGradeId } });
    if (!grade) {
      throw apiError("Grade salarial introuvable", 404);
    }
    if (grade.role !== role) {
      throw apiError("Le grade salarial selectionne ne correspond pas au role choisi", 400);
    }

    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) {
      throw apiError("Un compte avec cet email existe deja", 409);
    }

    const tempPassword = crypto.randomBytes(6).toString("hex").toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newEmployee = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const employee = await tx.employee.create({
        data: {
          name,
          email,
          phone: phone || null,
          password: hashedPassword,
          role,
          department: department || null,
          position: position || null,
          managerId: managerId || null,
          hireDate,
          leaveBalance: 0,
          salaryGradeId,
          salaryOverride: salaryOverride ?? null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          department: true,
          position: true,
          managerId: true,
          hireDate: true,
          leaveBalance: true,
          salaryGradeId: true,
          salaryOverride: true,
        },
      });

      await createInitialSalaryHistory(tx, {
        employeeId: employee.id,
        salaryGradeId: employee.salaryGradeId,
        salaryOverride: employee.salaryOverride,
        fallbackRole: employee.role,
        validFrom: employee.hireDate,
      });

      if (role === Role.COLLABORATEUR) {
        await initializeCollaboratorSkillProfile(tx, {
          employeeId: employee.id,
          technicalSkills,
          actor: {
            id: actor.id,
            role: actor.role as Role,
            name: actor.name,
          },
        });
      }

      if (role === Role.CHEF && subordinateIds && subordinateIds.length > 0) {
        await tx.employee.updateMany({
          where: { id: { in: subordinateIds } },
          data: { managerId: employee.id },
        });
      }

      return employee;
    });

    await sendEmail({
      to: email,
      subject: "Bienvenue sur ArabSoft HR - Vos informations de connexion",
      html: buildAccountEmailHtml({
        name,
        email,
        role,
        department: department || "Non specifie",
        tempPassword,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`,
      }),
    });

    logAudit({
      actorId: actor.id,
      actorName: actor.name,
      action: "CREATED",
      entity: "Employee",
      entityId: newEmployee.id,
      details: { name, email, role, department, hireDate: hireDate.toISOString() },
    });

    return {
      ...newEmployee,
      message: `Le compte de ${name} a ete cree avec succes. Les informations de connexion ont ete envoyees a ${email}.`,
    };
  }

  async getEmployeeById(actor: CurrentUser, employeeId: string) {
    await this.assertAccessibleEmployee(actor, employeeId);
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        manager: { select: { id: true, name: true } },
        salaryGrade: true,
      },
    });

    if (!employee) {
      throw apiError("Employe introuvable", 404);
    }

    return employee;
  }

  async updateEmployee(actor: CurrentUser, employeeId: string, input: EmployeeFormInput) {
    const existing = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!existing) {
      throw apiError("Employe introuvable", 404);
    }

    if (existing.role === Role.RH) {
      throw apiError("Le compte RH principal est en lecture seule depuis cette page", 403);
    }

    const resultingSalaryGradeId = input.salaryGradeId !== undefined ? input.salaryGradeId : existing.salaryGradeId;
    if (!input.resetPassword && !resultingSalaryGradeId) {
      throw apiError("Le grade salarial est obligatoire", 400);
    }

    const targetRole = input.role ?? existing.role;
    if (input.salaryGradeId) {
      const grade = await prisma.salaryGrade.findUnique({ where: { id: input.salaryGradeId } });
      if (!grade) {
        throw apiError("Grade salarial introuvable", 404);
      }
      if (grade.role !== targetRole) {
        throw apiError("Le grade salarial selectionne ne correspond pas au role du collaborateur", 400);
      }
    }

    if (input.email && input.email !== existing.email) {
      const emailTaken = await prisma.employee.findUnique({ where: { email: input.email } });
      if (emailTaken) {
        throw apiError("Un compte avec cet email existe deja", 409);
      }
    }

    if (input.role && input.role !== existing.role) {
      if (input.role === Role.COLLABORATEUR && !input.managerId && !existing.managerId) {
        throw apiError("Un collaborateur doit obligatoirement avoir un manager.", 400);
      }
      if (input.role === Role.COLLABORATEUR || existing.role === Role.COLLABORATEUR) {
        throw apiError("La migration automatique des competences lors d'un changement de role n'est pas encore supportee.", 400);
      }
    }

    const updateData: Prisma.EmployeeUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone || null;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.department !== undefined) updateData.department = input.department || null;
    if (input.position !== undefined) updateData.position = input.position || null;
    if (input.managerId !== undefined) {
      updateData.manager = input.managerId
        ? { connect: { id: input.managerId } }
        : { disconnect: true };
    }
    if (input.hireDate !== undefined) updateData.hireDate = input.hireDate;
    if (input.salaryGradeId !== undefined) {
      updateData.salaryGrade = input.salaryGradeId
        ? { connect: { id: input.salaryGradeId } }
        : { disconnect: true };
    }
    if (input.salaryOverride !== undefined) updateData.salaryOverride = input.salaryOverride ?? null;

    let tempPassword: string | null = null;
    if (input.resetPassword) {
      tempPassword = crypto.randomBytes(6).toString("hex").toUpperCase();
      updateData.password = await bcrypt.hash(tempPassword, 10);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id: employeeId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          role: true,
          department: true,
          position: true,
          managerId: true,
          hireDate: true,
          leaveBalance: true,
          salaryGradeId: true,
          salaryOverride: true,
        },
      });

      await syncSalaryHistoryOnCompensationChange(tx, {
        employeeId: employee.id,
        previousSalaryGradeId: existing.salaryGradeId,
        previousSalaryOverride: existing.salaryOverride,
        nextSalaryGradeId: employee.salaryGradeId,
        nextSalaryOverride: employee.salaryOverride,
        fallbackRole: employee.role,
        validFrom: new Date(),
      });

      return employee;
    });

    if (tempPassword) {
      await sendEmail({
        to: updated.email,
        subject: "Votre mot de passe a ete reinitialise - ArabSoft HR",
        html: buildPasswordResetEmailHtml({
          name: updated.name,
          email: updated.email,
          tempPassword,
          loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`,
        }),
      });
    }

    logAudit({
      actorId: actor.id,
      actorName: actor.name,
      action: "UPDATED",
      entity: "Employee",
      entityId: employeeId,
      details: {
        name: input.name,
        email: input.email,
        role: input.role,
        department: input.department,
        position: input.position,
        hireDate: input.hireDate?.toISOString(),
      },
    });

    return {
      ...updated,
      message: tempPassword
        ? `Le mot de passe a ete reinitialise et un email a ete envoye a ${updated.email}`
        : "Collaborateur mis a jour avec succes",
    };
  }

  async getDeleteImpact(actor: CurrentUser, employeeId: string) {
    if (actor.role !== Role.RH) {
      throw apiError("Acces refuse", 403);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, role: true },
    });

    if (!employee) {
      throw apiError("Employe introuvable", 404);
    }

    const [managedProjects, availableManagers, activeAssignedTasks] = await prisma.$transaction([
      prisma.project.findMany({
        where: {
          OR: [{ managerId: employeeId }, { createdById: employeeId }],
          status: { not: "TERMINE" },
        },
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.employee.findMany({
        where: {
          id: { not: employeeId },
          role: Role.CHEF,
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.task.findMany({
        where: {
          assigneeId: employeeId,
          status: { not: "DONE" },
        },
        select: {
          id: true,
          title: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      managedProjects,
      availableManagers,
      activeAssignedTasks,
    };
  }

  async deleteEmployee(
    actor: CurrentUser,
    employeeId: string,
    options: { replacementManagerId?: string | null } = {},
  ) {
    if (employeeId === actor.id) {
      throw apiError("Vous ne pouvez pas supprimer votre propre compte", 400);
    }

    const existing = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!existing) {
      throw apiError("Employe introuvable", 404);
    }

    if (existing.role === Role.RH) {
      throw apiError("Le compte RH principal ne peut pas etre supprime", 403);
    }

    let replacementManager: { id: string; name: string; role: Role } | null = null;
    if (options.replacementManagerId) {
      replacementManager = await prisma.employee.findUnique({
        where: { id: options.replacementManagerId },
        select: { id: true, name: true, role: true },
      });

      if (!replacementManager || replacementManager.role !== Role.CHEF) {
        throw apiError("Le chef de remplacement est introuvable", 404);
      }
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ownedProjects = await tx.project.findMany({
        where: {
          OR: [{ managerId: employeeId }, { createdById: employeeId }],
        },
        select: { id: true },
      });

      if (ownedProjects.length > 0 && !replacementManager) {
        throw apiError("Un chef de remplacement est obligatoire pour reaffecter les projets", 400);
      }

      if (replacementManager) {
        await tx.project.updateMany({
          where: { managerId: employeeId },
          data: { managerId: replacementManager.id },
        });
        await tx.project.updateMany({
          where: { createdById: employeeId },
          data: {
            createdById: replacementManager.id,
            createdByRole: replacementManager.role,
          },
        });
      }

      const assignedTasks = await tx.task.findMany({
        where: { assigneeId: employeeId },
        select: {
          id: true,
          title: true,
          project: {
            select: {
              name: true,
              managerId: true,
            },
          },
        },
      });

      if (assignedTasks.length > 0) {
        for (const task of assignedTasks) {
          if (!task.project?.managerId) {
            throw apiError("Certaines taches ne peuvent pas etre reaffectees automatiquement", 400);
          }

          await tx.task.update({
            where: { id: task.id },
            data: { assigneeId: task.project.managerId },
          });
        }

        const managerNotifications = new Map<string, string[]>();
        for (const task of assignedTasks) {
          const managerId = task.project!.managerId!;
          const taskLabel = `${task.title} (${task.project?.name ?? "Projet"})`;
          managerNotifications.set(managerId, [...(managerNotifications.get(managerId) ?? []), taskLabel]);
        }

        if (managerNotifications.size > 0) {
          await tx.notification.createMany({
            data: Array.from(managerNotifications.entries()).map(([managerId, taskLabels]) => ({
              employeeId: managerId,
              title: "Taches a reaffecter",
              message: `Les taches suivantes ont ete transferees apres suppression d'un collaborateur: ${taskLabels.join(", ")}.`,
            })),
          });
        }
      }

      await tx.task.updateMany({
        where: { reviewedById: employeeId },
        data: { reviewedById: null },
      });
      await tx.messageRead.deleteMany({ where: { employeeId } });
      await tx.notification.deleteMany({ where: { employeeId } });
      await tx.requestHistory.deleteMany({ where: { actorId: employeeId } });
      await tx.employeeSkillHistory.deleteMany({ where: { actorId: employeeId } });
      await tx.employeeSkillHistory.deleteMany({ where: { employeeId } });
      await tx.employeeSkill.deleteMany({ where: { employeeId } });
      await deletePrivateConversationsForUser(employeeId, tx);

      const employeeRequests = await tx.request.findMany({ where: { employeeId }, select: { id: true } });
      const requestIds = employeeRequests.map((request) => request.id);
      await tx.payslip.deleteMany({ where: { employeeId } });
      if (requestIds.length > 0) {
        await tx.payslip.deleteMany({ where: { requestId: { in: requestIds } } });
      }
      if (requestIds.length > 0) {
        await tx.slaEvent.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.requestHistory.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.request.deleteMany({ where: { employeeId } });
      }

      const relatedEvaluations = await tx.evaluation.findMany({
        where: {
          OR: [
            { employeeId },
            { evaluatorId: employeeId },
            { validatedById: employeeId },
          ],
        },
        select: { id: true },
      });
      const relatedEvaluationIds = relatedEvaluations.map((evaluation) => evaluation.id);
      if (relatedEvaluationIds.length > 0) {
        await tx.bonus.deleteMany({
          where: {
            OR: [
              { evaluationId: { in: relatedEvaluationIds } },
              { employeeId },
            ],
          },
        });
        await tx.evaluationObjective.deleteMany({
          where: { evaluationId: { in: relatedEvaluationIds } },
        });
        await tx.evaluation.deleteMany({
          where: { id: { in: relatedEvaluationIds } },
        });
      } else {
        await tx.bonus.deleteMany({ where: { employeeId } });
      }

      await tx.salaryHistory.deleteMany({ where: { employeeId } });

      await tx.employee.updateMany({
        where: { managerId: employeeId },
        data: { managerId: replacementManager?.id ?? null },
      });
      await tx.employee.delete({ where: { id: employeeId } });
    });

    logAudit({
      actorId: actor.id,
      actorName: actor.name,
      action: "DELETED",
      entity: "Employee",
      entityId: employeeId,
      details: { deletedName: existing.name, deletedEmail: existing.email },
    });

    return { success: true, message: "Employe supprime avec succes" };
  }

  async getProfile(actor: CurrentUser) {
    return prisma.employee.findUnique({ where: { id: actor.id }, select: profileSelect });
  }

  parseProfileUpdateInput(body: unknown) {
    return this.profileUpdateSchema.parse(body);
  }

  async updateProfile(actor: CurrentUser, input: ProfileUpdateInput) {
    const updateData: Prisma.EmployeeUpdateInput = {};
    if (input.avatar !== undefined) updateData.avatar = input.avatar;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.phone !== undefined) updateData.phone = input.phone;

    if (Object.keys(updateData).length === 0) {
      throw apiError("No data to update", 400);
    }

    return prisma.employee.update({
      where: { id: actor.id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, avatar: true, role: true },
    });
  }

  async getChatEmployees(actor: CurrentUser) {
    return prisma.employee.findMany({
      where: { id: { not: actor.id } },
      select: chatEmployeeSelect,
      orderBy: { name: "asc" },
    });
  }

  async getManagerTeam(actor: CurrentUser) {
    const teamMembers = await prisma.employee.findMany({
      where: { managerId: actor.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        position: true,
        managerId: true,
        requests: {
          where: {
            type: "CONGE",
            status: "APPROUVE",
            startDate: { not: null },
            endDate: { not: null },
          },
          select: {
            startDate: true,
            endDate: true,
          },
          orderBy: {
            startDate: "asc",
          },
        },
      },
    });

    return teamMembers.map((teamMember) => {
      const { requests, ...member } = teamMember;
      return {
        ...member,
        upcomingApprovedLeave: findNearestLeavePeriodInWindow(requests),
      };
    });
  }

  async getEmployeeSalary(actor: CurrentUser, employeeId: string) {
    await this.assertAccessibleEmployee(actor, employeeId);
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { salaryGrade: true },
    });

    if (!employee) {
      throw apiError("Employe introuvable", 404);
    }

    return {
      grade: employee.salaryGrade,
      baseSalary: employee.salaryGrade?.baseSalary ?? 0,
      salaryOverride: employee.salaryOverride,
      resolvedSalary: resolveSalary(employee),
    };
  }

  async getEmployeeBonuses(actor: CurrentUser, employeeId: string) {
    await this.assertAccessibleEmployee(actor, employeeId);
    return prisma.bonus.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" } });
  }

  async getEmployeePayslips(actor: CurrentUser, employeeId: string) {
    await this.assertAccessibleEmployee(actor, employeeId);
    return prisma.payslip.findMany({
      where: { employeeId },
      include: { employee: { select: { name: true } } },
      orderBy: { generatedAt: "desc" },
    });
  }

  async assignSalaryGrade(employeeId: string, body: { salaryGradeId?: string | null; salaryOverride?: number | null }) {
    const effectiveAt = new Date();

    return prisma.$transaction(async (tx) => {
      const existing = await tx.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, role: true, salaryGradeId: true, salaryOverride: true },
      });

      if (!existing) {
        throw apiError("Employe introuvable", 404);
      }

      if (body.salaryGradeId) {
        const grade = await tx.salaryGrade.findUnique({
          where: { id: body.salaryGradeId },
          select: { id: true, role: true },
        });
        if (!grade) {
          throw apiError("Grade salarial introuvable", 404);
        }
        if (grade.role !== existing.role) {
          throw apiError("Le grade salarial selectionne ne correspond pas au role du collaborateur", 400);
        }
      }

      const employee = await tx.employee.update({
        where: { id: employeeId },
        data: {
          salaryGradeId: body.salaryGradeId ?? existing.salaryGradeId,
          salaryOverride: body.salaryOverride ?? null,
        },
        include: { salaryGrade: true },
      });

      await syncSalaryHistoryOnCompensationChange(tx, {
        employeeId: employee.id,
        previousSalaryGradeId: existing.salaryGradeId,
        previousSalaryOverride: existing.salaryOverride,
        nextSalaryGradeId: employee.salaryGradeId,
        nextSalaryOverride: employee.salaryOverride,
        fallbackRole: employee.role,
        validFrom: effectiveAt,
      });

      return employee;
    });
  }

  async getEmployeeSkills(actor: CurrentUser, employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, managerId: true },
    });

    if (!employee) {
      throw apiError("Collaborateur introuvable", 404);
    }

    const canRead =
      actor.role === Role.RH ||
      actor.id === employeeId ||
      (actor.role === Role.CHEF && employee.managerId === actor.id);

    if (!canRead) {
      throw apiError("Acces interdit", 403);
    }

    return getEmployeeSkillProfile(prisma, employeeId);
  }

  parseEmployeeSkillChanges(body: unknown) {
    return employeeSkillChangeBatchSchema.parse(body);
  }

  async updateEmployeeSkills(actor: CurrentUser, employeeId: string, input: EmployeeSkillChangeBatchInput) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, managerId: true },
    });

    if (!employee) {
      throw apiError("Collaborateur introuvable", 404);
    }

    const canUpdate =
      actor.role === Role.RH ||
      (actor.role === Role.CHEF && employee.managerId === actor.id);

    if (!canUpdate) {
      throw apiError("Acces interdit", 403);
    }

    const profile = await prisma.$transaction((tx: Prisma.TransactionClient) =>
      applyManagerSkillChanges(tx, {
        employeeId,
        actor: {
          id: actor.id,
          role: actor.role as Role,
          name: actor.name,
        },
        changes: input.changes,
      }),
    );

    logAudit({
      actorId: actor.id,
      actorName: actor.name,
      action: "UPDATED",
      entity: "EmployeeSkill",
      entityId: employeeId,
      details: {
        changeCount: input.changes.length,
        changes: input.changes,
      },
    });

    return profile;
  }
}

export const employeesService = new EmployeesService();
