import { NextResponse } from "next/server"
import { ApiError, handleApiError } from "@/lib/api-response"
import { serverAuthService } from "@/lib/services/server/auth.service"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    // All authenticated roles may access their own profile — no role restriction needed
    const user = await serverAuthService.requireAuth(req) // intentionally role-agnostic
    return NextResponse.json({ authenticated: true, user })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return handleApiError(error, "Failed to resolve current user")
  }
}
