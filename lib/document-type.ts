import { Request, RequestDocumentType } from '@/lib/types'

export const documentTypeOptions: Array<{
  value: RequestDocumentType
  label: string
}> = [
  {
    value: 'ATTESTATION_TRAVAIL',
    label: 'Attestation de travail',
  },
]

export const documentTypeLabels: Record<RequestDocumentType, string> = {
  ATTESTATION_TRAVAIL: 'Attestation de travail',
}

export function getDocumentTypeLabel(documentType?: string | null) {
  if (!documentType) {
    return null
  }

  return documentTypeLabels[documentType as RequestDocumentType] ?? documentType
}

export function isDocumentRequest(request: Pick<Request, 'type'>) {
  return request.type === 'DOCUMENT'
}
