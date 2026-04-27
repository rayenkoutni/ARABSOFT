import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/mailer";
import { generateOTPEmail } from "@/lib/templates/otp-email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: userId },
    });

    if (!employee) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (!employee.email) {
      return NextResponse.json(
        { error: "User has no email address on file. Cannot send OTP." },
        { status: 400 }
      );
    }

    // Generate a secure random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Hash the code
    const hashedCode = await bcrypt.hash(code, 10);

    // Save to database
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        otpCode: hashedCode,
        otpExpiresAt: expiresAt,
      },
    });

     // Send OTP via Email
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

    // Always log to console for development convenience
    console.log(`\n\n[DEV OTP LOG] User: ${employee.name} (${employee.email}) | Code: ${code}\n\n`);

    return NextResponse.json({ message: "OTP sent successfully." });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
