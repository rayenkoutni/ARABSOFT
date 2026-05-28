import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { sendEmail } from "@/lib/mailer"
import { generateOTPEmail } from "@/lib/templates/otp-email"

export async function POST(_req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
    })

    if (!employee) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    if (employee.otpExpiresAt) {
      const minutesLeft = (employee.otpExpiresAt.getTime() - Date.now()) / (1000 * 60)
      if (minutesLeft > 9) {
        return NextResponse.json({ message: "OTP sent successfully." })
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString().padStart(6, "0")
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const hashedCode = await bcrypt.hash(code, 10)

    await prisma.employee.update({
      where: { id: employee.id },
      data: { otpCode: hashedCode, otpExpiresAt: expiresAt },
    })

    try {
      await sendEmail({
        to: employee.email,
        subject: "Verification de votre identite - ArabSoft RH",
        html: generateOTPEmail(employee.name.split(" ")[0], code),
        text: `Votre code de verification ArabSoft est : ${code}. Il expire dans 10 minutes.`,
      })
    } catch (err) {
      console.error("Failed to send OTP email:", err)
    }

    return NextResponse.json({ message: "OTP sent successfully." })
  } catch (error) {
    console.error("Error sending OTP:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
