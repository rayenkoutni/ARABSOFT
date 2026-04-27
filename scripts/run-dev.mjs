import fs from "fs/promises"
import path from "path"
import net from "net"
import { spawn } from "child_process"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")
const port = Number.parseInt(process.env.PORT || "3000", 10)
const lockPath = path.join(projectRoot, ".next", "dev", "lock")
const pidPath = path.join(projectRoot, ".next", "dev-server.pid")

function isPortInUse(portToCheck) {
  return new Promise((resolve) => {
    const socket = net.createConnection(
      { host: "127.0.0.1", port: portToCheck },
      () => {
        socket.destroy()
        resolve(true)
      }
    )

    socket.setTimeout(1000)

    socket.on("error", () => resolve(false))
    socket.on("timeout", () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function readTrackedPid() {
  try {
    const raw = await fs.readFile(pidPath, "utf8")
    const pid = Number.parseInt(raw.trim(), 10)
    return Number.isNaN(pid) ? null : pid
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null
    }

    throw error
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function clearTrackedPid() {
  try {
    await fs.rm(pidPath, { force: true })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
      throw error
    }
  }
}

async function stopTrackedProcessIfAny() {
  const pid = await readTrackedPid()
  if (!pid) {
    return false
  }

  if (!isProcessAlive(pid)) {
    await clearTrackedPid()
    return false
  }

  console.log(`Stopping the previous ArabSoft dev server on port ${port}...`)
  process.kill(pid)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isProcessAlive(pid) && !(await isPortInUse(port))) {
      await clearTrackedPid()
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Port ${port} is still in use after stopping the previous ArabSoft process.`)
}

async function ensurePortIsAvailable() {
  if (!(await isPortInUse(port))) {
    await clearTrackedPid()
    return
  }

  const stoppedTrackedProcess = await stopTrackedProcessIfAny()
  if (stoppedTrackedProcess) {
    return
  }

  console.log(
    `Port ${port} is already in use by another process. Stop that process or choose a different PORT, then run npm run dev again.`
  )
  process.exit(1)
}

async function removeStaleLock() {
  try {
    await fs.rm(lockPath, { force: true })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
      throw error
    }
  }
}

async function main() {
  await ensurePortIsAvailable()
  await removeStaleLock()

  const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
    cwd: projectRoot,
    stdio: "inherit",
  })

  await fs.mkdir(path.dirname(pidPath), { recursive: true })
  await fs.writeFile(pidPath, `${child.pid}\n`, "utf8")

  child.on("exit", (code, signal) => {
    void clearTrackedPid()

    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })

  child.on("error", (error) => {
    console.error("Failed to start the dev server:", error)
    process.exit(1)
  })
}

main().catch((error) => {
  console.error("Failed to prepare the dev server:", error)
  process.exit(1)
})
