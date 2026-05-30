import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/utils/api-response";
import { requireAuth, serverAuthService } from "@/lib/services/server/auth.service";

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req);
    const { current, new: newPassword } = await req.json();
    const result = await serverAuthService.changePassword(user.id, current, newPassword);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors du changement de mot de passe");
  }
}
