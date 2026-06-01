import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { sendEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/services/server/auth.service";
import { signatureService } from "@/lib/services/server/signature.service";
import { deletePrivateConversationsForUser } from "@/lib/services/server/shared.service";

const rhTransferInputSchema = z.object({
  newEmail: z.string().email("Adresse e-mail invalide"),
  newName: z.string().trim().min(2, "Le nom du nouveau RH est obligatoire").max(80, "Le nom du nouveau RH est trop long"),
  newPhone: z.string().trim().min(6, "Le numero de telephone est obligatoire").max(30, "Le numero de telephone est trop long"),
  currentPassword: z.string().min(1, "Le mot de passe actuel est obligatoire"),
});

function buildRhTransferEmailHtml(data: { email: string; tempPassword: string; loginUrl: string }) {
  return `<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; color: #212121">
  <div style="max-width: 600px; margin: auto">
    <div style="text-align: center; background-color: #1B3A6B; padding: 32px 16px; border-radius: 32px 32px 0 0;">
      <span style="font-size: 22px; font-weight: 700; color: #ffffff;">ARABSOFT RH</span>
    </div>
    <div style="padding: 32px 24px; background-color: #ffffff;">
      <h1 style="font-size: 24px; color: #1B3A6B; margin-bottom: 8px;">Transfert d'acces RH</h1>
      <p style="color: #64748B; margin-top: 0; margin-bottom: 24px;">L'acces RH vous a ete transfere. Connectez-vous avec les identifiants temporaires ci-dessous puis mettez a jour votre profil.</p>
      <div style="background-color: #F4F6FA; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; border-left: 4px solid #F5A623;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #1B3A6B; font-size: 15px;">Vos informations de connexion</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #64748B; width: 40%;">Email</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${data.email}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Mot de passe temporaire</td><td style="padding: 6px 0;"><span style="background-color: #1B3A6B; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 15px; letter-spacing: 0.1em;">${data.tempPassword}</span></td></tr>
        </table>
      </div>
      <div style="text-align: center;">
        <a href="${data.loginUrl}" target="_blank" style="display: inline-block; background-color: #1B3A6B; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600;">Acceder au portail</a>
      </div>
    </div>
  </div>
</div>`;
}

function getPortalUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return appUrl.replace(/\/+$/, "");
}

class RhSettingsService {
  parseTransferInput(body: unknown) {
    return rhTransferInputSchema.parse(body);
  }

  async transferRhAccount(actor: CurrentUser, input: z.infer<typeof rhTransferInputSchema>) {
    if (actor.role !== Role.RH) {
      throw new AppError("Acces refuse", 403);
    }

    const currentRh = await prisma.employee.findUnique({
      where: { id: actor.id },
    });

    if (!currentRh) {
      throw new AppError("Compte RH introuvable", 404);
    }

    const passwordMatches = await bcrypt.compare(input.currentPassword, currentRh.password);
    if (!passwordMatches) {
      throw new AppError("Mot de passe actuel incorrect", 400);
    }

    if (input.newEmail === currentRh.email) {
      throw new AppError("Le nouvel email doit etre different de l'email actuel", 400);
    }

    const existingEmailOwner = await prisma.employee.findUnique({
      where: { email: input.newEmail },
      select: { id: true },
    });

    if (existingEmailOwner) {
      throw new AppError("Un compte avec cet email existe deja", 409);
    }

    const tempPassword = crypto.randomBytes(12).toString("base64url");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const loginUrl = getPortalUrl();

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const sentMessages = await tx.message.findMany({
        where: { senderId: actor.id },
        select: { id: true },
      });
      const sentMessageIds = sentMessages.map((message) => message.id);

      if (sentMessageIds.length > 0) {
        await tx.messageRead.deleteMany({
          where: { messageId: { in: sentMessageIds } },
        });
        await tx.message.deleteMany({
          where: { id: { in: sentMessageIds } },
        });
      }

      await deletePrivateConversationsForUser(actor.id, tx);

      await tx.messageRead.deleteMany({ where: { employeeId: actor.id } });
      await tx.notification.deleteMany({ where: { employeeId: actor.id } });
      await tx.payslip.deleteMany({ where: { employeeId: actor.id } });
      await tx.generatedDocument.deleteMany({ where: { employeeId: actor.id } });
      await signatureService.clearSignatureReference(tx, actor.id);
      await tx.employee.update({
        where: { id: actor.id },
        data: {
          email: input.newEmail,
          password: hashedPassword,
          name: input.newName,
          phone: input.newPhone,
          avatar: null,
          department: currentRh.department || "RH",
          position: currentRh.position || "Responsable RH",
          managerId: null,
          otpCode: null,
          otpExpiresAt: null,
          conversations: {
            set: [],
          },
        },
      });

      await sendEmail({
        to: input.newEmail,
        subject: "Acces RH ArabSoft - identifiants temporaires",
        html: buildRhTransferEmailHtml({
          email: input.newEmail,
          tempPassword,
          loginUrl,
        }),
      });
    });

    await signatureService.removeSignatureFile(actor.id);

    return { success: true };
  }
}

export const rhSettingsService = new RhSettingsService();
