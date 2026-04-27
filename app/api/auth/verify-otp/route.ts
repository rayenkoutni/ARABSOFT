import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json({ error: "User ID and code are required." }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: userId },
    });

    if (!employee) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (!employee.otpCode || !employee.otpExpiresAt) {
      // Bypass OTP for RH role or users without OTP configured
      if (employee.role === "RH") {
        return NextResponse.json({ success: true, message: "OTP bypassed for RH user." });
      }
      return NextResponse.json({ error: "No OTP code requested or it has already expired." }, { status: 400 });
    }

    // Check expiration
    if (new Date() > employee.otpExpiresAt) {
      return NextResponse.json({ error: "OTP code has expired." }, { status: 400 });
    }

    // Verify hash
    const isValid = await bcrypt.compare(code, employee.otpCode);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid OTP code." }, { status: 400 });
    }

    // Clear the code upon successful verification
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    return NextResponse.json({ success: true, message: "OTP verified successfully." });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
