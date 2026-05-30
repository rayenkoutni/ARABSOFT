import { SIGNATURE_PLACEHOLDER } from "@/lib/constants";
import { signatureService } from "@/lib/services/server/signature.service";

interface RhSignatureOptions {
  userId?: string | null;
}

export async function getRhSignatureForDocument(
  options?: RhSignatureOptions,
): Promise<{
  url: string | null;
  placeholder: string;
}> {
  const signatureUrl = options?.userId
    ? await signatureService.getUserSignatureUrl(options.userId)
    : await signatureService.getRhSignatureUrl();

  if (!signatureUrl) {
    return { url: null, placeholder: SIGNATURE_PLACEHOLDER };
  }

  const url = signatureUrl.startsWith("/")
    ? await signatureService.getSignatureDataUrl(signatureUrl)
    : signatureUrl;

  return { url, placeholder: SIGNATURE_PLACEHOLDER };
}
