import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { chatService } from "@/lib/services/server/chat.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const url = new URL(req.url);
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Number.parseInt(url.searchParams.get("limit") || "30", 10);
    const result = await chatService.getConversationMessages(user, id, page, limit);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to fetch messages");
  }
}
