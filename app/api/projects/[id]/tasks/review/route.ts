import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { tasksService } from "@/lib/services/server/tasks.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["CHEF"]);
    const { id } = await params;
    const { taskId, action, comment, taskScore } = await req.json();
    const result = await tasksService.reviewTaskBatch(user, id, [{ taskId, action, comment, taskScore }]);
    return NextResponse.json({
      success: result.success,
      task: result.tasks[0] ?? null,
      message: result.message,
    });
  } catch (error) {
    return handleApiError(error, "Failed to review task");
  }
}
