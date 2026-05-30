import {
  buildGeneratedDocumentFileName,
  buildGeneratedDocumentReference,
  generateWorkCertificatePdf,
  persistGeneratedDocumentFile,
  readGeneratedDocumentFile,
} from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/services/server/auth.service";
import { apiError } from "@/lib/utils/api-response";

interface PreparedGeneratedDocument {
  documentType: string;
  reference: string;
  fileName: string;
  filePath: string;
  generatedAt: Date;
}

class DocumentsService {
  async getRequestDocumentDownload(requestId: string, user: CurrentUser) {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        generatedDocument: true,
      },
    });

    if (!request) {
      throw apiError("Demande introuvable.", 404);
    }

    const canDownload =
      user.role === "RH" || (user.role === "COLLABORATEUR" && request.employeeId === user.id);

    if (!canDownload) {
      throw apiError("Vous n'etes pas autorise a telecharger ce document.", 403);
    }

    if (request.status !== "APPROUVE" || request.type !== "DOCUMENT") {
      throw apiError("Ce document n'est pas disponible.", 404);
    }

    if (!request.generatedDocument) {
      throw apiError("Aucun document genere n'est disponible pour cette demande.", 404);
    }

    const fileBuffer = await readGeneratedDocumentFile(request.generatedDocument.filePath);

    return {
      fileBuffer,
      fileName: request.generatedDocument.fileName,
    };
  }

  async prepareWorkCertificateDocument(requestId: string, user: CurrentUser): Promise<PreparedGeneratedDocument> {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        employee: {
          select: {
            name: true,
            department: true,
            position: true,
            hireDate: true,
          },
        },
        generatedDocument: {
          select: { id: true },
        },
      },
    });

    if (!request) {
      throw apiError("Demande introuvable.", 404);
    }

    if (
      request.status !== "EN_ATTENTE_RH" ||
      request.type !== "DOCUMENT" ||
      request.documentType !== "ATTESTATION_TRAVAIL"
    ) {
      throw apiError("Ce document ne peut pas etre genere pour cette demande.", 400);
    }

    if (request.generatedDocument) {
      throw apiError("Un document existe deja pour cette demande.", 409);
    }

    const actorProfile = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { position: true },
    });

    const generatedAt = new Date();
    const reference = buildGeneratedDocumentReference(requestId, generatedAt);
    const fileName = buildGeneratedDocumentFileName(request.employee.name, reference);
    const pdfBuffer = await generateWorkCertificatePdf({
      employeeName: request.employee.name,
      employeePosition: request.employee.position ?? null,
      employeeDepartment: request.employee.department ?? null,
      hireDate: request.employee.hireDate,
      companyName: "ARAB SOFT",
      companyAddress: "Centre Urbain Nord, Tunis, Tunisie",
      companyCity: "Tunis",
      generatedAt,
      documentReference: reference,
      validatedByName: user.name,
      validatedByRole: actorProfile?.position || "Responsable Ressources Humaines",
      rhSignatureUserId: user.id,
    });

    const storedFile = await persistGeneratedDocumentFile({
      requestId,
      fileName,
      buffer: pdfBuffer,
    });

    return {
      documentType: request.documentType ?? "ATTESTATION_TRAVAIL",
      reference,
      fileName: storedFile.fileName,
      filePath: storedFile.filePath,
      generatedAt,
    };
  }
}

export const documentsService = new DocumentsService();
export type { PreparedGeneratedDocument };
