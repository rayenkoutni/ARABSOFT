import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { tasksService } from "@/lib/services/server/tasks.service";
import { handleApiError } from "@/lib/utils/api-response";
import { optionalNumber, optionalString, requireEnum } from "@/lib/utils/validate";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req, ["CHEF"]);
    const { id } = await params;
    const body = await req.json();
    const taskScore = optionalNumber(body?.taskScore, "taskScore");
    const result = await tasksService.reviewTaskDecision(user, id, {
      decision: requireEnum(body?.decision, "decision", ["APPROVE", "REJECT"] as const),
      reviewComment: optionalString(body?.reviewComment),
      taskScore,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors de la revision");
  }
}
