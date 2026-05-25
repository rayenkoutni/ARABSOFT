import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// OTP brute-force protection — in-memory attempt tracker.
// Entries are short-lived (OTPs expire in 10 min) so memory stays bounded.
// ---------------------------------------------------------------------------
interface AttemptEntry { count: number; lockedUntil: number }
const otpAttempts = new Map<string, AttemptEntry>();

const MAX_ATTEMPTS   = 5;
const LOCKOUT_MS     = 15 * 60 * 1000; // 15-minute lockout after 5 failures

function getAttemptEntry(userId: string): AttemptEntry {
  return otpAttempts.get(userId) ?? { count: 0, lockedUntil: 0 };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json(
        { error: "User ID and code are required." },
        { status: 400 }
      );
    }

    // ── Brute-force lockout check ──────────────────────────────────────────
    const attempt = getAttemptEntry(userId);
    if (attempt.lockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((attempt.lockedUntil - Date.now()) / 60_000);
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` },
        { status: 429 }
      );
    }

    const employee = await prisma.employee.findUnique({ where: { id: userId } });

    if (!employee) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (!employee.otpCode || !employee.otpExpiresAt) {
      return NextResponse.json(
        { error: "No OTP code requested or it has already expired." },
        { status: 400 }
      );
    }

    // ── Expiry check ───────────────────────────────────────────────────────
    if (new Date() > employee.otpExpiresAt) {
      otpAttempts.delete(userId); // expired code resets attempts
      return NextResponse.json({ error: "OTP code has expired." }, { status: 400 });
    }

    // ── Hash verification ──────────────────────────────────────────────────
    const isValid = await bcrypt.compare(String(code), employee.otpCode);

    if (!isValid) {
      attempt.count += 1;
      if (attempt.count >= MAX_ATTEMPTS) {
        attempt.lockedUntil = Date.now() + LOCKOUT_MS;
      }
      otpAttempts.set(userId, attempt);

      const remaining = MAX_ATTEMPTS - attempt.count;
      return NextResponse.json(
        {
          error:
            remaining > 0
              ? `Invalid OTP code. ${remaining} attempt(s) remaining.`
              : "Account locked. Request a new OTP after 15 minutes.",
        },
        { status: 400 }
      );
    }

    // ── Success: clear OTP and reset attempt counter ───────────────────────
    otpAttempts.delete(userId);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { otpCode: null, otpExpiresAt: null },
    });

    return NextResponse.json({ success: true, message: "OTP verified successfully." });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
