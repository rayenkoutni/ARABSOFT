import { NextResponse } from "next/server"
import { apiError, handleApiError } from "@/lib/api-response"
import { serverAuthService } from "@/lib/services/server/auth.service"
import { notificationServerService } from "@/lib/services/server/notification.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await serverAuthService.requireAuth(req)
    const { id } = await params
    const result = await notificationServerService.markAsRead(id, user.id)

    if (!result) {
      throw apiError("Notification not found or unauthorized", 404)
    }

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, "Failed to mark as read")
  }
}
