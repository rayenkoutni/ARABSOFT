import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/services/server/auth.service";
import { signatureService } from "@/lib/services/server/signature.service";
import { removeBackground } from "@/lib/utils/remove-background";
import { handleApiError } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors";

function isPngFile(file: File) {
  return file.type === "image/png";
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req, [Role.RH]);
    const signatureUrl = await signatureService.getUserSignatureUrl(user.id);
    return NextResponse.json({ signatureUrl });
  } catch (error) {
    return handleApiError(error, "Echec du chargement de la signature");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req, [Role.RH]);
    const formData = await req.formData();
    const signature = formData.get("signature");

    if (!(signature instanceof File)) {
      throw new AppError("Fichier de signature introuvable", 400);
    }

    const inputBuffer = Buffer.from(await signature.arrayBuffer());
    let bufferToSave: Buffer<ArrayBufferLike> = inputBuffer;

    try {
      const cleanBuffer = await removeBackground(inputBuffer);
      if (cleanBuffer.length > 0) {
        bufferToSave = cleanBuffer;
      }
    } catch (error) {
      if (!isPngFile(signature)) {
        throw error;
      }
    }

    const signatureUrl = await signatureService.saveSignature(user.id, bufferToSave);

    return NextResponse.json({ signatureUrl });
  } catch (error) {
    return handleApiError(error, "Echec de l'enregistrement de la signature");
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAuth(req, [Role.RH]);
    await signatureService.deleteSignature(user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, "Echec de la suppression de la signature");
  }
}
