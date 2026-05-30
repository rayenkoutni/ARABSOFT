import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/utils/api-response";
import { serverAuthService } from "@/lib/services/server/auth.service";

export async function POST(req: Request) {
  try {
    const result = await serverAuthService.sendOtp();
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Internal server error");
  }
}
