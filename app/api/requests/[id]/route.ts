import { NextResponse } from "next/server"
import { requestInputSchema } from "@/lib/request-validation"
import { ApiError, handleApiError } from "@/lib/api-response"
import { serverAuthService } from "@/lib/services/server/auth.service"
import { requestServerService } from "@/lib/services/server/request.service"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await serverAuthService.requireAuth(req)
    const { id } = await params
    const request = await requestServerService.getRequestByIdForUser(id, user)
    return NextResponse.json(request)
  } catch (error) {
    return handleApiError(error, "Failed to fetch request")
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await serverAuthService.requireAuth(req)
    const { id } = await params
    const rawBody = await req.json()
    const parsedBody = requestInputSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      throw new ApiError(parsedBody.error.issues[0]?.message ?? "Requete invalide", 400)
    }

    const updatedRequest = await requestServerService.updateRequestForUser(id, parsedBody.data, user)
    return NextResponse.json(updatedRequest)
  } catch (error) {
    return handleApiError(error, "Failed to update request")
  }
}
