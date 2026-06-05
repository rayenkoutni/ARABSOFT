import "dotenv/config"
import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import { createRequire } from "module"
import { initCron } from "./lib/cron"

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = Number.parseInt(process.env.PORT || "3000", 10)
const projectDir = process.cwd()
const require = createRequire(import.meta.url)

const next = require("next") as typeof import("next")["default"]

const app = next({
  dev,
  dir: projectDir,
  hostname,
  port,
  turbopack: dev,
})
const handle = app.getRequestHandler()

let kafkaEnabled = false

declare global {
  var io: SocketIOServer | undefined
}

async function startServer() {
  await app.prepare()

  const server = createServer((req, res) => {
    handle(req, res)
  })

  const io = new SocketIOServer(server, {
    cors: {
      origin: dev ? "http://localhost:3000" : process.env.NEXT_PUBLIC_APP_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  })

  global.io = io

  const { socketService } = await import("./lib/services/server/socket.service")
  socketService.init(io)

  const { chatService } = await import("./lib/services/server/chat.service")
  try {
    await chatService.init()
    kafkaEnabled = true
  } catch (error) {
    console.warn("[kafka] Initialization warning:", error instanceof Error ? error.message : String(error))
    kafkaEnabled = false
  }

  initCron()

  server.listen(port, () => {
    console.info(`> Ready on http://${hostname}:${port}`)
    console.info(`> Socket.io server running`)
    console.info(
      kafkaEnabled
        ? "> Kafka producer and consumer initialized"
        : "> Kafka unavailable, continuing without Kafka-backed chat"
    )

    if (dev) {
      console.info(`> Warming up critical routes (/ , /dashboard)...`)
      const warmupRoutes = ["/", "/dashboard"]

      const warmup = async () => {
        for (const route of warmupRoutes) {
          try {
            await fetch(`http://${hostname}:${port}${route}`)
          } catch {}
        }
      }

      warmup().then(() => {
        console.info(`> Core routes compiled and cached`)
      })
    }
  })
}

startServer().catch((err) => {
  console.error("[server] Startup error:", err instanceof Error ? err.message : String(err))
  process.exit(1)
})
