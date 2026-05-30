import { NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-response"
import { serverAuthService } from "@/lib/services/server/auth.service"
import { notificationServerService } from "@/lib/services/server/notification.service"

export async function GET() {
  try {
    const user = await serverAuthService.requireAuth()
    const notifications = await notificationServerService.getUserNotifications(user.id)
    return NextResponse.json(notifications)
  } catch (error) {
    return handleApiError(error, "Failed to fetch notifications")
  }
}

export async function DELETE() {
  try {
    const user = await serverAuthService.requireAuth()
    const result = await notificationServerService.clearUserNotifications(user.id)
    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, "Failed to clear notifications")
  }
}
