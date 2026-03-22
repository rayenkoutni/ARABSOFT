import { prisma } from "@/lib/prisma"
import { comparePassword, signToken } from "@/lib/auth"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const { email, password } = await req.json()

  const employee = await prisma.employee.findUnique({ where: { email } })
  if (!employee) return NextResponse.json(
    { error: "Invalid credentials" }, { status: 401 }
  )

  const valid = await comparePassword(password, employee.password)
  if (!valid) return NextResponse.json(
    { error: "Invalid credentials" }, { status: 401 }
  )

  const token = signToken({ id: employee.id, role: employee.role })
  const cookieStore = await cookies();
  cookieStore.set("token", token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 })

  return NextResponse.json({
    id: employee.id,
    name: employee.name,
    role: employee.role,
    email: employee.email
  })
}
