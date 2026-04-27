import "dotenv/config"
import { createRequire } from "module"

process.env.PRISMA_CLIENT_ENGINE_TYPE = "library"

const require = createRequire(import.meta.url)
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client")

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    __internal: {
      // This project was generated with copyEngine=false, which makes Prisma
      // pick the remote/Accelerate engine path and reject a normal postgres:// URL.
      configOverride: (config) => ({
        ...config,
        copyEngine: true,
      }),
    },
  })

if (process.env.NODE_ENV !== "production")
  globalForPrisma.prisma = prisma
