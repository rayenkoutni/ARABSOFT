import { prisma } from "./prisma"

export async function logAudit({
  actorId,
  actorName,
  action,
  entity,
  entityId,
  details,
}: {
  actorId: string
  actorName: string
  action: string
  entity: string
  entityId: string
  details?: Record<string, unknown>
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorName,
        action,
        entity,
        entityId,
        details: details ? JSON.stringify(details) : null,
      },
    })
  } catch (error) {
    console.error("Audit logging failed:", error)
  }
}