import { cookies } from "next/headers"
import { verifyToken } from "./auth"
import { prisma } from "./prisma"

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value
  if (!token) return null
  try {
    const payload = verifyToken(token) as { id: string; role: string }
    return await prisma.employee.findUnique({
      where: { id: payload.id },
      select: { id: true, name: true, email: true, 
                role: true, managerId: true, department: true }
    })
  } catch {
    return null
  }
}
