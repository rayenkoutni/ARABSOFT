import { Prisma, Role, SkillType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/services/server/auth.service";
import {
  createSkillCatalogEntry,
  deleteSkillCatalogEntry,
  listScopedEmployeeSkills,
  listSkillCatalog,
  updateSkillCatalogEntry,
  type SkillCatalogInput,
  type SkillCatalogUpdateInput,
} from "@/lib/skills";

class SkillsService {
  async listCatalog(user: CurrentUser, options: { type?: SkillType; includeInactive: boolean }) {
    return listSkillCatalog(
      prisma,
      { id: user.id, role: user.role as Role, name: user.name },
      options,
    );
  }

  async createCatalogEntry(user: CurrentUser, input: SkillCatalogInput) {
    return prisma.$transaction((tx: Prisma.TransactionClient) =>
      createSkillCatalogEntry(tx, { id: user.id, role: user.role as Role, name: user.name }, input),
    );
  }

  async updateCatalogEntry(user: CurrentUser, skillId: string, input: SkillCatalogUpdateInput) {
    return prisma.$transaction((tx: Prisma.TransactionClient) =>
      updateSkillCatalogEntry(tx, { id: user.id, role: user.role as Role, name: user.name }, skillId, input),
    );
  }

  async deleteCatalogEntry(user: CurrentUser, skillId: string) {
    return prisma.$transaction((tx: Prisma.TransactionClient) =>
      deleteSkillCatalogEntry(tx, { id: user.id, role: user.role as Role, name: user.name }, skillId),
    );
  }

  async listEmployeeSkills(user: CurrentUser) {
    return listScopedEmployeeSkills(prisma, {
      id: user.id,
      role: user.role as Role,
      name: user.name,
    });
  }
}

export const skillsService = new SkillsService();
