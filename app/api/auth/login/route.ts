import { AUTH_COOKIE_NAME, PRE_AUTH_COOKIE_NAME, TRUSTED_DEVICE_COOKIE_NAME } from "@/lib/constants";
import { serverAuthService } from "@/lib/services/server/auth.service";
import { handleApiError } from "@/lib/utils/api-response";
import { requireEmail, requireString } from "@/lib/utils/validate";
import { serialize } from "cookie";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = requireEmail(body?.email, "email");
    const password = requireString(body?.password, "password");
    const cookieStore = await cookies();
    const trustedDeviceToken = cookieStore.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;
    const result = await serverAuthService.initiateLogin(email, password, trustedDeviceToken);
    const response = NextResponse.json({ nextStep: result.nextStep, user: result.user });

    if (result.nextStep === "otp") {
      response.headers.append(
        "Set-Cookie",
        serialize(PRE_AUTH_COOKIE_NAME, result.preAuthToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 5,
          path: "/",
          sameSite: "strict",
        }),
      );
    } else {
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
        serialize(PRE_AUTH_COOKIE_NAME, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 0,
          path: "/",
          sameSite: "strict",
        }),
      );
    }

    if (result.nextStep === "otp") {
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
    }
    return response;
  } catch (error) {
    return handleApiError(error, "Erreur interne lors de la connexion");
  }
}
