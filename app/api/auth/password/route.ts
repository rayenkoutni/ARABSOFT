import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/utils/api-response";
import { requireAuth, serverAuthService } from "@/lib/services/server/auth.service";
import { requireString } from "@/lib/utils/validate";

export async function PATCH(req: Request) {
  try {
    // All authenticated roles may change their own password
    const user = await requireAuth(req);
    const body = await req.json();
    const current = requireString(body?.current, "current password");
    const newPassword = requireString(body?.new, "new password");
    const result = await serverAuthService.changePassword(user.id, current, newPassword);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors du changement de mot de passe");
  }
}
