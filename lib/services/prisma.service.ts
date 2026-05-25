/**
 * Canonical Prisma singleton re-export.
 * All service-layer code imports from here; this module itself
 * delegates to lib/prisma to guarantee a single PrismaClient instance
 * across the entire application (prevents connection-pool exhaustion).
 */
export { prisma } from "@/lib/prisma";
