import { ApiError } from "@/lib/api-response";
import { signTrustedDeviceToken } from "@/lib/auth";
import { AUTH_COOKIE_NAME, PRE_AUTH_COOKIE_NAME, TRUSTED_DEVICE_COOKIE_NAME } from "@/lib/constants";
import { serverAuthService } from "@/lib/services/server/auth.service";
import { handleApiError } from "@/lib/utils/api-response";
import { requireString } from "@/lib/utils/validate";
import { cookies } from "next/headers";
import { serialize } from "cookie";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = requireString(body?.code, "code");
    const rememberDevice = typeof body?.rememberDevice === "boolean" ? body.rememberDevice : false;
    const cookieStore = await cookies();
    const preAuthToken = cookieStore.get(PRE_AUTH_COOKIE_NAME)?.value;

    if (!preAuthToken) {
      throw new ApiError("Unauthorized", 401);
    }

    const result = await serverAuthService.verifyOtp(preAuthToken, code);
    const response = NextResponse.json({ success: result.success });
    response.headers.append(
      "Set-Cookie",
      serialize(PRE_AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
        path: "/",
        sameSite: "strict",
      }),
    );
    response.headers.append(
      "Set-Cookie",
      serialize(AUTH_COOKIE_NAME, result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
        sameSite: "strict",
      }),
    );
    response.headers.append(
      "Set-Cookie",
      serialize(TRUSTED_DEVICE_COOKIE_NAME, rememberDevice ? signTrustedDeviceToken(result.userId) : "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: rememberDevice ? 60 * 60 * 24 * 30 : 0,
        path: "/",
        sameSite: "strict",
      }),
    );
    return response;
  } catch (error) {
    return handleApiError(error, "Internal server error");
  }
}
