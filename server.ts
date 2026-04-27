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

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = parseInt(process.env.PORT || "3000", 10)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const kafkaBroker = process.env.KAFKA_BROKER || "localhost:9092"
const kafkaStartupAttempts = 15
const kafkaStartupDelayMs = 1000

if (dev) {
  process.env.IS_WEBPACK_TEST = "1"
}

const next = require("next") as typeof import("next")["default"]

// Initialize Next.js app
const app = next({
  dev,
  dir: __dirname,
  hostname,
  port,
  ...(dev ? { webpack: true } : {}),
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
  console.log("Kafka producer connected")
}

// Initialize Kafka consumer
async function initConsumer() {
  consumer = kafka.consumer({ groupId: "chat-group" })
  await consumer.connect()
  await consumer.subscribe({ topic: "chat-messages", fromBeginning: false })
  console.log("Kafka consumer connected and subscribed")

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const payload = JSON.parse(message.value?.toString() || "{}")
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
          console.log(`📢 Notification created for recipient ${recipientId}`)
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

        console.log(`Message saved and emitted: ${savedMessage.id}`)
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

  // Socket.io connection handler
  io.on("connection", async (socket) => {
    // Authenticate the socket connection
    const user = await authenticateSocket(socket.handshake)

    if (!user) {
      console.log("Unauthenticated socket connection, disconnecting")
      socket.disconnect()
      return
    }

    console.log(`User ${user.id} connected with socket ${socket.id}`)

    // Join user's personal room
    socket.join(user.id)

    // Track socket ID for this user
    if (!userSockets.has(user.id)) {
      userSockets.set(user.id, new Set())
    }
    userSockets.get(user.id)!.add(socket.id)

    // Handle send_message event
    socket.on("send_message", async (data) => {
      try {
        const { conversationId, content, recipientId } = data

        if (!conversationId || !content || !recipientId) {
          socket.emit("error", { message: "Missing required fields" })
          return
        }

        // Verify user is a participant in the conversation
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { participants: { select: { id: true } } },
        })

        if (!conversation) {
          socket.emit("error", { message: "Conversation not found" })
          return
        }

        const isParticipant = conversation.participants.some(
          (p) => p.id === user.id
        )
        if (!isParticipant) {
          socket.emit("error", { message: "Not a participant in this conversation" })
          return
        }

        if (!kafkaEnabled || !producer) {
          socket.emit("error", {
            message: "Chat service is temporarily unavailable because Kafka is offline.",
          })
          return
        }

        // Publish message to Kafka
        await producer.send({
          topic: "chat-messages",
          messages: [
            {
              value: JSON.stringify({
                senderId: user.id,
                conversationId,
                content,
                recipientId,
                timestamp: new Date().toISOString(),
              }),
            },
          ],
        })

        console.log(`Message published to Kafka by user ${user.id}`)
      } catch (error) {
        console.error("Error sending message:", error)
        socket.emit("error", { message: "Failed to send message" })
      }
    })

    // Handle typing indicator
    socket.on("typing", (data) => {
      const { conversationId, recipientId } = data
      const recipientSockets = userSockets.get(recipientId)
      if (recipientSockets) {
        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("user_typing", {
            userId: user.id,
            conversationId,
          })
        })
      }
    })

    // Handle stop typing indicator
    socket.on("stop_typing", (data) => {
      const { conversationId, recipientId } = data
      const recipientSockets = userSockets.get(recipientId)
      if (recipientSockets) {
        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("user_stop_typing", {
            userId: user.id,
            conversationId,
          })
        })
      }
    })

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`User ${user.id} disconnected socket ${socket.id}`)

      // Remove socket from user's set
      const sockets = userSockets.get(user.id)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size === 0) {
          userSockets.delete(user.id)
        }
      }
    })
  })

  // Initialize Kafka producer and consumer
  await initKafkaIfAvailable()

  initCron()

  // Start the server
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Socket.io server running`)
    console.log(
      kafkaEnabled
        ? "> Kafka producer and consumer initialized"
        : "> Kafka unavailable, continuing without Kafka-backed chat"
    )
  })
}

startServer().catch((err) => {
  console.error("Error starting server:", err)
  process.exit(1)
})
