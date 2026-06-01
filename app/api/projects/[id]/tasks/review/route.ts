import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { tasksService } from "@/lib/services/server/tasks.service";
import { handleApiError } from "@/lib/utils/api-response";
import { optionalNumber, optionalString, requireEnum, requireUuid } from "@/lib/utils/validate";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["CHEF"]);
    const { id } = await params;
    const body = await req.json();
    const result = await tasksService.reviewTaskBatch(user, id, [{
      taskId: requireUuid(body?.taskId, "taskId"),
      action: requireEnum(body?.action, "action", ["accept", "request_revision"] as const),
      comment: optionalString(body?.comment) ?? null,
      taskScore: optionalNumber(body?.taskScore, "taskScore"),
    }]);
    return NextResponse.json({
      success: result.success,
      task: result.tasks[0] ?? null,
      message: result.message,
    });
  } catch (error) {
    return handleApiError(error, "Failed to review task");
  }
}
