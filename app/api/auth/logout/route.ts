import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, PRE_AUTH_COOKIE_NAME } from "@/lib/constants"

export async function POST() {
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
  }

  cookieStore.set(AUTH_COOKIE_NAME, "", cookieOptions)
  cookieStore.set(PRE_AUTH_COOKIE_NAME, "", cookieOptions)
  return NextResponse.json({ success: true })
}
