import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { chatService } from "@/lib/services/server/chat.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const result = await chatService.listConversations(user);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to fetch conversations");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const result = await chatService.createConversation(user, await req.json());
    return NextResponse.json(result.conversation, { status: result.status });
  } catch (error) {
    return handleApiError(error, "Failed to create conversation");
  }
}
