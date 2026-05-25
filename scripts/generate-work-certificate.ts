import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { generateWorkCertificatePdf } from '../lib/documents'

async function main() {
  const outputDirectory = path.join(process.cwd(), 'tmp')
  const outputPath = path.join(outputDirectory, 'attestation-travail-test.pdf')

  await mkdir(outputDirectory, { recursive: true })

  const pdfBuffer = await generateWorkCertificatePdf({
    employeeName: 'Sarra Ben Youssef',
    employeePosition: 'Ingenieure logiciel',
    employeeDepartment: 'Ingenierie logicielle',
    employeeSalutation: 'Madame',
    hireDate: '2022-03-14',
    companyName: 'ARAB SOFT',
    companyAddress: 'Centre Urbain Nord, Tunis, Tunisie',
    companyCity: 'Tunis',
    generatedAt: new Date(),
    documentReference: 'ATS-TEST-2026-001',
    validatedByName: 'Nadia Khelifi',
    validatedByRole: 'Responsable Ressources Humaines',
  })

  await writeFile(outputPath, pdfBuffer)
  console.log(`PDF de test genere : ${outputPath}`)
}

void main().catch((error) => {
  console.error('Echec de la generation du PDF de test :', error)
  process.exitCode = 1
})
