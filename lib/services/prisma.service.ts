import "dotenv/config"
import { createRequire } from "module"

process.env.PRISMA_CLIENT_ENGINE_TYPE = "library"

const require = createRequire(import.meta.url)
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client")

const globalForPrisma = global as unknown as {
  prisma: import("@prisma/client").PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    __internal: {
      // Keep service-layer Prisma aligned with the main singleton so local
      // postgres URLs don't get treated like Accelerate URLs in dev.
      configOverride: (config) => ({
        ...config,
        copyEngine: true,
      }),
    },
  })

if (process.env.NODE_ENV !== "production")
  globalForPrisma.prisma = prisma
