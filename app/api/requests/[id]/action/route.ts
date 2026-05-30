import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/services/server/auth.service";
import { requestService } from "@/lib/services/server/request.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(req, ["CHEF", "RH"]);
    const { action, comment } = await req.json();
    const { id } = await params;
    const result = await requestService.processRequestAction(user, id, action, comment);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Echec du traitement de l'action.");
  }
}
