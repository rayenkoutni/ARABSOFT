import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { chatService } from "@/lib/services/server/chat.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const result = await chatService.markConversationAsRead(user, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to mark messages as read");
  }
}
