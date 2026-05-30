import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/lib/errors";
import { SIGNATURES_PUBLIC_DIR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

function getSignatureDirectory() {
  return path.join(process.cwd(), "public", SIGNATURES_PUBLIC_DIR);
}

function getSignatureFilePath(userId: string) {
  return path.join(getSignatureDirectory(), `${userId}.png`);
}

function getSignaturePublicUrl(userId: string) {
  return `/${SIGNATURES_PUBLIC_DIR}/${userId}.png`;
}

function buildCacheBustedSignatureUrl(signatureUrl: string, updatedAt?: Date | null) {
  const version = updatedAt?.getTime() ?? Date.now();
  return `${signatureUrl}?v=${version}`;
}

class SignatureService {
  async removeSignatureFile(userId: string): Promise<void> {
    await rm(getSignatureFilePath(userId), { force: true });
  }

  async saveSignature(userId: string, pngBuffer: Buffer): Promise<string> {
    if (!pngBuffer.length) {
      throw new AppError("Signature vide", 400);
    }

    await mkdir(getSignatureDirectory(), { recursive: true });
    const signatureUrl = getSignaturePublicUrl(userId);
    await writeFile(getSignatureFilePath(userId), pngBuffer);

    const employee = await prisma.employee.update({
      where: { id: userId },
      data: { signatureUrl },
      select: {
        signatureUrl: true,
        updatedAt: true,
      },
    });

    return buildCacheBustedSignatureUrl(employee.signatureUrl ?? signatureUrl, employee.updatedAt);
  }

  async deleteSignature(userId: string): Promise<void> {
    await this.removeSignatureFile(userId);
    await prisma.employee.update({
      where: { id: userId },
      data: { signatureUrl: null },
    });
  }

  async getRhSignatureUrl(): Promise<string | null> {
    const rhUser = await prisma.employee.findFirst({
      where: { role: Role.RH },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      select: { signatureUrl: true },
    });

    return rhUser?.signatureUrl ?? null;
  }

  async getUserSignatureUrl(userId: string): Promise<string | null> {
    const employee = await prisma.employee.findUnique({
      where: { id: userId },
      select: {
        signatureUrl: true,
        updatedAt: true,
      },
    });

    if (!employee?.signatureUrl) {
      return null;
    }

    return buildCacheBustedSignatureUrl(employee.signatureUrl, employee.updatedAt);
  }

  async clearSignatureReference(tx: PrismaLike, userId: string): Promise<void> {
    await tx.employee.update({
      where: { id: userId },
      data: { signatureUrl: null },
    });
  }

  async getSignatureDataUrl(signatureUrl: string): Promise<string> {
    const relativePath = signatureUrl
      .split("?")[0]
      .replace(/^\/+/, "");
    const buffer = await readFile(path.join(process.cwd(), "public", relativePath));
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }
}

type PrismaLike = {
  employee: {
    update(args: {
      where: { id: string };
      data: { signatureUrl: null };
    }): Promise<unknown>;
  };
};

export const signatureService = new SignatureService();
export const saveSignature = signatureService.saveSignature.bind(signatureService);
export const deleteSignature = signatureService.deleteSignature.bind(signatureService);
export const getRhSignatureUrl = signatureService.getRhSignatureUrl.bind(signatureService);
