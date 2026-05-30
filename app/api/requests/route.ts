import { NextResponse } from "next/server"
import { requestInputSchema } from "@/lib/request-validation"
import { ApiError, handleApiError } from "@/lib/api-response"
import { serverAuthService } from "@/lib/services/server/auth.service"
import { requestServerService } from "@/lib/services/server/request.service"

export async function GET(req: Request) {
  try {
    const user = await serverAuthService.requireAuth(req)
    const url = new URL(req.url)
    const view = url.searchParams.get("view")
    const requests = await requestServerService.getRequestsForUser(user, view)
    return NextResponse.json(requests)
  } catch (error) {
    return handleApiError(error, "Failed to fetch requests")
  }
}

export async function POST(req: Request) {
  try {
    const user = await serverAuthService.requireAuth(req)
    const rawBody = await req.json()
    const parsedBody = requestInputSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      throw new ApiError(parsedBody.error.issues[0]?.message ?? "Requete invalide", 400)
    }

    const request = await requestServerService.createRequestForUser(parsedBody.data, user)
    return NextResponse.json(request)
  } catch (error) {
    return handleApiError(error, "Failed to create request")
  }
}
