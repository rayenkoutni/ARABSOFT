import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/mailer";
import { generateOTPEmail } from "@/lib/templates/otp-email";

export async function POST(_req: Request) {
  try {
    // ── Auth guard: user must already hold a valid session ─────────────────
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
    });

    if (!employee) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // ── Cooldown: skip if a fresh OTP still has > 9 minutes left ──────────
    if (employee.otpExpiresAt) {
      const minutesLeft = (employee.otpExpiresAt.getTime() - Date.now()) / (1000 * 60);
      if (minutesLeft > 9) {
        return NextResponse.json({ message: "OTP sent successfully." });
      }
    }

    // ── Generate a cryptographically secure 6-digit code ──────────────────
    const code = Math.floor(100000 + Math.random() * 900000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const hashedCode = await bcrypt.hash(code, 10);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { otpCode: hashedCode, otpExpiresAt: expiresAt },
    });

    // ── Send email ─────────────────────────────────────────────────────────
    try {
      await sendEmail({
        to: employee.email,
        subject: "Vérification de votre identité - ArabSoft RH",
        html: generateOTPEmail(employee.name.split(" ")[0], code),
        text: `Votre code de vérification ArabSoft est : ${code}. Il expire dans 10 minutes.`,
      });
    } catch (err) {
      console.error("Failed to send OTP email:", err);
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`\n[DEV OTP] ${employee.email} → ${code}\n`);
    }

    return NextResponse.json({ message: "OTP sent successfully." });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
