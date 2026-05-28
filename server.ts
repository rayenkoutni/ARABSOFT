import "dotenv/config"
import { createServer } from "http"
import net from "net"
import path from "path"
import { Server as SocketIOServer } from "socket.io"
import { Kafka, Producer, Consumer, Partitioners, logLevel } from "kafkajs"
import { parse } from "cookie"
import jwt from "jsonwebtoken"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import { prisma } from "./lib/prisma"
import { initCron } from "./lib/cron"

function sanitize(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = parseInt(process.env.PORT || "3000", 10)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectDir = process.cwd()
const require = createRequire(import.meta.url)
const kafkaBroker = process.env.KAFKA_BROKER || "localhost:9092"
const kafkaStartupAttempts = 15
const kafkaStartupDelayMs = 1000

const next = require("next") as typeof import("next")["default"]

// Initialize Next.js app
const app = next({
  dev,
  dir: projectDir,
  hostname,
  port,
  turbopack: dev, // Enable turbopack natively in dev mode
})
const handle = app.getRequestHandler()

// Initialize Kafka
const kafka = new Kafka({
  clientId: "arabsoft-chat",
  brokers: [kafkaBroker],
  logLevel: logLevel.NOTHING,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
})

let producer: Producer
let consumer: Consumer
let kafkaEnabled = false

// Store for mapping employeeId to socket IDs
const userSockets = new Map<string, Set<string>>()

// Authenticate socket connection using JWT from cookies
async function authenticateSocket(
  handshake: { headers: { cookie?: string } }
): Promise<{ id: string; role: string } | null> {
  try {
    const cookieHeader = handshake.headers.cookie
    if (!cookieHeader) return null

    const cookies = parse(cookieHeader)
    const token = cookies.token
    if (!token) return null

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string
      role: string
    }

    return decoded
  } catch (error) {
    console.error("Socket authentication failed:", error)
    return null
  }
}

function parseBrokerAddress(broker: string) {
  const [host, rawPort] = broker.split(":")
  return {
    host: host || "localhost",
    port: Number.parseInt(rawPort || "9092", 10),
  }
}

function canReachKafkaBroker(broker: string): Promise<boolean> {
  const { host, port: brokerPort } = parseBrokerAddress(broker)

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: brokerPort }, () => {
      socket.end()
      resolve(true)
    })

    socket.setTimeout(1500)

    socket.on("error", () => resolve(false))
    socket.on("timeout", () => {
      socket.destroy()
      resolve(false)
    })
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForKafkaReady() {
  for (let attempt = 1; attempt <= kafkaStartupAttempts; attempt += 1) {
    const admin = kafka.admin()

    try {
      await admin.connect()
      await admin.listTopics()
      await admin.disconnect()
      return true
    } catch {
      try {
        await admin.disconnect()
      } catch {}

      if (attempt < kafkaStartupAttempts) {
        await sleep(kafkaStartupDelayMs)
      }
    }
  }

  return false
}

// Initialize Kafka producer
async function initProducer() {
  producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
  })
  await producer.connect()
  console.info("Kafka producer connected")
}

// Initialize Kafka consumer
async function initConsumer() {
  consumer = kafka.consumer({ groupId: "chat-group" })
  await consumer.connect()
  await consumer.subscribe({ topic: "chat-messages", fromBeginning: false })
  console.info("Kafka consumer connected and subscribed")

  await consumer.run({
    eachMessage: async ({ message, topic, partition }) => {
      console.info(`📥 [Kafka Consumer] Received message from topic ${topic} partition ${partition}`)
      try {
        const payload = JSON.parse(message.value?.toString() || "{}")
        console.info(`📥 [Kafka Payload]:`, payload)
        const { senderId, conversationId, content, recipientId } = payload

        // Save message to PostgreSQL via Prisma
        const savedMessage = await prisma.message.create({
          data: {
            content,
            senderId,
            conversationId,
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        })

        // Emit to recipient's socket room
        const recipientSockets = userSockets.get(recipientId)
        if (recipientSockets) {
          recipientSockets.forEach((socketId) => {
            global.io?.to(socketId).emit("new_message", savedMessage)
          })
        }

        // Also create a notification for the recipient
        try {
          await prisma.notification.create({
            data: {
              employeeId: recipientId,
              title: "Nouveau message",
              message: `${savedMessage.sender.name}: ${savedMessage.content.substring(0, 100)}${savedMessage.content.length > 100 ? '...' : ''}`,
              read: false
            }
          })
          console.info(`📢 Notification created for recipient ${recipientId}`)
        } catch (notifError) {
          console.error('Failed to create notification:', notifError)
        }

        // Also emit to sender's other sockets (for multi-device support)
        const senderSockets = userSockets.get(senderId)
        if (senderSockets) {
          senderSockets.forEach((socketId) => {
            global.io?.to(socketId).emit("message_sent", savedMessage)
          })
        }

        console.info(`Message saved and emitted: ${savedMessage.id}`)
      } catch (error) {
        console.error("Error processing Kafka message:", error)
      }
    },
  })
}

async function initKafkaIfAvailable() {
  if (!(await canReachKafkaBroker(kafkaBroker))) {
    console.warn(
      `Kafka is not reachable at ${kafkaBroker}. Continuing without Kafka-backed chat processing in dev.`
    )
    kafkaEnabled = false
    return
  }

  if (!(await waitForKafkaReady())) {
    console.warn(
      `Kafka at ${kafkaBroker} did not become ready in time. Continuing without Kafka-backed chat processing in dev.`
    )
    kafkaEnabled = false
    return
  }

  try {
    await initProducer()
    await initConsumer()
    kafkaEnabled = true
  } catch (error) {
    kafkaEnabled = false
    console.warn(
      `Kafka initialization failed at ${kafkaBroker}. Continuing without Kafka-backed chat processing.`,
      error
    )

    try {
      await producer?.disconnect()
    } catch {}

    try {
      await consumer?.disconnect()
    } catch {}
  }
}

// Store io globally for access in consumer
declare global {
  var io: SocketIOServer | undefined
}

async function startServer() {
  await app.prepare()

  const server = createServer((req, res) => {
    handle(req, res)
  })

  // Initialize Socket.io
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
    console.warn("Kafka initialization failed. Chat will fall back to direct DB inserts.", error)
    kafkaEnabled = false
  }

  initCron()

  // Start the server
  server.listen(port, () => {
    console.info(`> Ready on http://${hostname}:${port}`)
    console.info(`> Socket.io server running`)
    console.info(
      kafkaEnabled
        ? "> Kafka producer and consumer initialized"
        : "> Kafka unavailable, continuing without Kafka-backed chat"
    )

    // Warm up critical routes to eliminate cold start compilation delays
    if (dev) {
      console.info(`> Warming up critical routes (/ , /login, /dashboard)...`)
      const warmupRoutes = ['/', '/login', '/dashboard'];
      
      const warmup = async () => {
        for (const route of warmupRoutes) {
          try {
            await fetch(`http://${hostname}:${port}${route}`);
          } catch (e) {}
        }
      };

      warmup().then(() => {
        console.info(`> ✨ Core routes compiled and cached!`);
      });
    }
  })
}

startServer().catch((err) => {
  console.error("Error starting server:", err)
  process.exit(1)
})
