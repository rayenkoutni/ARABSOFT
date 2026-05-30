import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { buildAuditLogWhere, generateAuditLogsExcelXml } from "@/lib/audit-export";
import type { CurrentUser } from "@/lib/services/server/auth.service";

function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

class AuditService {
  async getLogs(input: { page: number; limit: number; entity: string | null; search: string | null }) {
    const where = buildAuditLogWhere({ entity: input.entity, search: input.search });
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page: input.page,
      totalPages: Math.ceil(total / input.limit),
    };
  }

  async exportLogs(user: CurrentUser, filters: { mode: "all" | "filtered"; entity: string | null; search: string | null }) {
    const appliedFilters = filters.mode === "filtered"
      ? { entity: filters.entity, search: filters.search }
      : { entity: null, search: null };
    const where = buildAuditLogWhere(appliedFilters);
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const workbook = generateAuditLogsExcelXml(logs);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `journal-audit-${sanitizeFileSegment(filters.mode)}-${timestamp}.xls`;

    await logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "EXPORT_EXCEL",
      entity: "AuditLog",
      entityId: randomUUID(),
      details: {
        format: "excel",
        scope: filters.mode,
        filters: appliedFilters,
        exportedCount: logs.length,
        fileName: filename,
      },
    });

    return { workbook, filename };
  }
}

export const auditService = new AuditService();
