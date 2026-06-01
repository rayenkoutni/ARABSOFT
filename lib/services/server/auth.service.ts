import { cookies } from "next/headers";
import type { Employee, Role as PrismaRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  signPreAuthToken,
  signSessionToken,
  verifyToken,
  type PreAuthTokenPayload,
  type SessionTokenPayload,
  type TrustedDeviceTokenPayload,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, PRE_AUTH_COOKIE_NAME } from "@/lib/constants";
import { sendEmail } from "@/lib/mailer";
import { generateOTPEmail } from "@/lib/templates/otp-email";
import { AppError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";

const currentUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  managerId: true,
  department: true,
  avatar: true,
} satisfies Record<string, boolean>;

type CurrentUserRecord = Pick<
  Employee,
  "id" | "name" | "email" | "role" | "managerId" | "department" | "avatar"
>;

interface SessionTokenClaims {
  id: string;
  sub: string;
  role: PrismaRole;
  phase: "session";
}

interface PreAuthClaims {
  sub: string;
  phase: "pre-auth";
}

class ServerAuthService {
  private verifySessionToken(token: string): SessionTokenClaims {
    const payload = verifyToken(token) as Partial<SessionTokenPayload> & Partial<SessionTokenClaims>;

    if (payload.phase !== "session" || typeof payload.sub !== "string" || typeof payload.role !== "string") {
      throw new AppError("Unauthorized", 401);
    }

    return {
      id: typeof payload.id === "string" ? payload.id : payload.sub,
      sub: payload.sub,
      role: payload.role as PrismaRole,
      phase: "session",
    };
  }

  private verifyPreAuthToken(preAuthToken: string): PreAuthClaims {
    const payload = verifyToken(preAuthToken) as Partial<PreAuthTokenPayload> & Partial<PreAuthClaims>;

    if (payload.phase !== "pre-auth" || typeof payload.sub !== "string") {
      throw new AppError("Unauthorized", 401);
    }

    return {
      sub: payload.sub,
      phase: "pre-auth",
    };
  }

  private verifyTrustedDeviceToken(token: string): { sub: string } {
    const payload = verifyToken(token) as Partial<TrustedDeviceTokenPayload>;

    if (payload.phase !== "session" || payload.type !== "trusted-device" || typeof payload.sub !== "string") {
      throw new AppError("Unauthorized", 401);
    }

    return { sub: payload.sub };
  }

  async getCurrentUser(): Promise<CurrentUserRecord | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    try {
      const payload = this.verifySessionToken(token);

      return prisma.employee.findUnique({
        where: { id: payload.sub },
        select: currentUserSelect,
      });
    } catch {
      return null;
    }
  }

  async requireAuth(_request?: Request, allowedRoles?: PrismaRole[]): Promise<CurrentUserRecord> {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new AppError("Unauthorized", 401);
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      throw new AppError("Forbidden", 403);
    }

    return user;
  }

  verifySocketToken(token: string): SessionTokenClaims {
    return this.verifySessionToken(token);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: userId },
    });

    if (!employee) {
      throw new AppError("User not found", 404);
    }

    const isValid = await bcrypt.compare(currentPassword, employee.password);
    if (!isValid) {
      throw new AppError("Mot de passe actuel incorrect", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.employee.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: "Mot de passe mis a jour avec succes" };
  }

  async initiateLogin(email: string, password: string, trustedDeviceToken?: string) {
    if (typeof email !== "string" || typeof password !== "string") {
      throw new AppError("Identifiants invalides", 400);
    }

    const employee = await prisma.employee.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        avatar: true,
        phone: true,
        department: true,
      },
    });

    if (!employee) {
      throw new AppError("Email ou mot de passe invalide", 401);
    }

    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) {
      throw new AppError("Email ou mot de passe invalide", 401);
    }

    if (trustedDeviceToken) {
      try {
        const trustedPayload = this.verifyTrustedDeviceToken(trustedDeviceToken);
        if (trustedPayload.sub === employee.id) {
          await logAudit({
            actorId: employee.id,
            actorName: employee.name,
            action: "LOGIN",
            entity: "Auth",
            entityId: employee.id,
            details: { method: "trusted-device", email: employee.email },
          });

          return {
            nextStep: "session" as const,
            sessionToken: signSessionToken({ id: employee.id, role: employee.role }),
            user: {
              id: employee.id,
              name: employee.name,
              role: employee.role,
              email: employee.email,
              avatar: employee.avatar,
              phone: employee.phone,
              department: employee.department,
            },
          };
        }
      } catch {
      }
    }

    const preAuthToken = signPreAuthToken(employee.id);

    return {
      preAuthToken,
      nextStep: "otp" as const,
      user: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        email: employee.email,
        avatar: employee.avatar,
        phone: employee.phone,
        department: employee.department,
      },
    };
  }

  async getPreAuthUser(preAuthToken?: string) {
    const cookieStore = await cookies();
    const token = preAuthToken ?? cookieStore.get(PRE_AUTH_COOKIE_NAME)?.value;

    if (!token) {
      throw new AppError("Unauthorized", 401);
    }

    const payload = this.verifyPreAuthToken(token);
    const employee = await prisma.employee.findUnique({
      where: { id: payload.sub },
      select: currentUserSelect,
    });

    if (!employee) {
      throw new AppError("Unauthorized", 401);
    }

    return employee;
  }

  async sendOtp(preAuthToken?: string) {
    const preAuthUser = await this.getPreAuthUser(preAuthToken);
    const employee = await prisma.employee.findUnique({
      where: { id: preAuthUser.id },
    });

    if (!employee) {
      throw new AppError("User not found.", 404);
    }

    if (employee.otpExpiresAt) {
      const minutesLeft = (employee.otpExpiresAt.getTime() - Date.now()) / (1000 * 60);
      if (minutesLeft > 9) {
        return { message: "OTP sent successfully." };
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const hashedCode = await bcrypt.hash(code, 10);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { otpCode: hashedCode, otpExpiresAt: expiresAt },
    });

    try {
      await sendEmail({
        to: employee.email,
        subject: "Verification de votre identite - ArabSoft RH",
        html: generateOTPEmail(employee.name.split(" ")[0], code),
        text: `Votre code de verification ArabSoft est : ${code}. Il expire dans 10 minutes.`,
      });
    } catch {
    }

    return { message: "OTP sent successfully." };
  }

  async verifyOtp(preAuthToken: string, code: string) {
    if (!code) {
      throw new AppError("User ID and code are required.", 400);
    }

    const preAuthUser = await this.getPreAuthUser(preAuthToken);
    const employee = await prisma.employee.findUnique({ where: { id: preAuthUser.id } });

    if (!employee) {
      throw new AppError("User not found.", 404);
    }

    if (!employee.otpCode || !employee.otpExpiresAt) {
      throw new AppError("No OTP code requested or it has already expired.", 401);
    }

    if (new Date() > employee.otpExpiresAt) {
      throw new AppError("OTP code has expired.", 401);
    }

    const isValid = await bcrypt.compare(String(code), employee.otpCode);
    if (!isValid) {
      throw new AppError("Invalid OTP code.", 401);
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { otpCode: null, otpExpiresAt: null },
    });

    await logAudit({
      actorId: employee.id,
      actorName: employee.name,
      action: "LOGIN",
      entity: "Auth",
      entityId: employee.id,
      details: { method: "otp", email: employee.email },
    });

    const sessionToken = signSessionToken({ id: employee.id, role: employee.role });

    return { success: true, message: "OTP verified successfully.", sessionToken, userId: employee.id };
  }
}

export const serverAuthService = new ServerAuthService();
export const requireAuth = serverAuthService.requireAuth.bind(serverAuthService);
export type CurrentUser = CurrentUserRecord;
