import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const GENERATED_DOCUMENTS_ROOT = path.join(process.cwd(), 'storage', 'generated-documents')

interface PersistGeneratedDocumentFileInput {
  requestId: string
  fileName: string
  buffer: Buffer
}

function sanitizeFileSegment(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export function buildGeneratedDocumentReference(requestId: string, generatedAt: Date) {
  return `ATS-${generatedAt.getFullYear()}-${requestId.slice(0, 8).toUpperCase()}`
}

export function buildGeneratedDocumentFileName(employeeName: string, reference: string) {
  const employeeSlug = sanitizeFileSegment(employeeName) || 'collaborateur'
  return `attestation-travail-${employeeSlug}-${reference.toLowerCase()}.pdf`
}

export function resolveGeneratedDocumentAbsolutePath(relativePath: string) {
  return path.join(GENERATED_DOCUMENTS_ROOT, ...relativePath.split('/'))
}

export async function persistGeneratedDocumentFile({
  requestId,
  fileName,
  buffer,
}: PersistGeneratedDocumentFileInput) {
  const relativePath = ['requests', requestId, fileName].join('/')
  const absolutePath = resolveGeneratedDocumentAbsolutePath(relativePath)

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, buffer)

  return {
    fileName,
    filePath: relativePath,
  }
}

export async function readGeneratedDocumentFile(relativePath: string) {
  return readFile(resolveGeneratedDocumentAbsolutePath(relativePath))
}

export async function removeGeneratedDocumentFile(relativePath: string) {
  await rm(resolveGeneratedDocumentAbsolutePath(relativePath), { force: true })
}
