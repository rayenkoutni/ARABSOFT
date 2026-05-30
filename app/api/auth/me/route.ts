import { NextResponse } from "next/server"
import { ApiError, handleApiError } from "@/lib/api-response"
import { serverAuthService } from "@/lib/services/server/auth.service"

export const runtime = "nodejs"

export async function GET() {
  try {
    const user = await serverAuthService.requireAuth()
    return NextResponse.json({ authenticated: true, user })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return handleApiError(error, "Failed to resolve current user")
  }
}
