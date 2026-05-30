import { ZodError } from "zod";
import { serialize } from "cookie";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { requireAuth } from "@/lib/services/server/auth.service";
import { rhSettingsService } from "@/lib/services/server/rh-settings.service";
import { apiError, handleApiError } from "@/lib/utils/api-response";

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req, ["RH"]);
    const input = rhSettingsService.parseTransferInput(await req.json());
    await rhSettingsService.transferRhAccount(user, input);

    const response = NextResponse.json({ success: true });
    response.headers.append(
      "Set-Cookie",
      serialize(AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
        path: "/",
        sameSite: "strict",
      }),
    );
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return handleApiError(apiError(error.issues[0]?.message ?? "Payload invalide", 400));
    }

    return handleApiError(error, "Echec du transfert RH");
  }
}
