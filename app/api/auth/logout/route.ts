import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, PRE_AUTH_COOKIE_NAME } from "@/lib/constants"

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME)
  cookieStore.delete(PRE_AUTH_COOKIE_NAME)
  return NextResponse.json({ success: true })
}
