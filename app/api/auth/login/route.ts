import { NextResponse } from "next/server"
import { serialize } from "cookie"
import { prisma } from "@/lib/prisma"
import { comparePassword, signToken } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Identifiants invalides" },
        { status: 400 }
      )
    }

    const employee = await prisma.employee.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        avatar: true,
        phone: true,
        department: true,
      },
    })
    if (!employee) {
      return NextResponse.json(
        { error: "Email ou mot de passe invalide" },
        { status: 401 }
      )
    }

    const valid = await comparePassword(password, employee.password)
    if (!valid) {
      return NextResponse.json(
        { error: "Email ou mot de passe invalide" },
        { status: 401 }
      )
    }

    const token = signToken({ id: employee.id, role: employee.role })

    const response = NextResponse.json({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      email: employee.email,
      avatar: employee.avatar,
      phone: employee.phone,
      department: employee.department,
    })

    response.headers.set(
      "Set-Cookie",
      serialize("token", token, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
        sameSite: "lax",
      })
    )

    return response
  } catch (error) {
    console.error("Erreur lors de la connexion :", error)
    return NextResponse.json(
      { error: "Erreur interne lors de la connexion" },
      { status: 500 }
    )
  }
}
