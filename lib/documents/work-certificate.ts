import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export interface GenerateWorkCertificatePdfInput {
  employeeName: string
  employeePosition?: string | null
  employeeDepartment?: string | null
  employeeSalutation?: string | null
  hireDate: Date | string
  companyName: string
  companyAddress?: string | null
  companyCity?: string | null
  generatedAt: Date | string
  documentReference: string
  validatedByName?: string | null
  validatedByRole?: string | null
}

const LOGO_LEFT_PATH = path.join(process.cwd(), 'public', 'logo.png')
const LOGO_CENTER_PATH = path.join(process.cwd(), 'public', 'arabsoft.png')
const DEFAULT_CITY = 'Tunis'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeLabel(value?: string | null) {
  return value?.trim() || ''
}

function formatFrenchDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error("Date invalide pour la generation de l'attestation de travail.")
  }

  return format(date, 'dd MMMM yyyy', { locale: fr })
}

function toEmploymentText(input: GenerateWorkCertificatePdfInput) {
  const employeePosition = normalizeLabel(input.employeePosition)
  const employeeDepartment = normalizeLabel(input.employeeDepartment)
  const hireDate = formatFrenchDate(input.hireDate)

  if (employeePosition && employeeDepartment) {
    return `occupe le poste de <strong>${escapeHtml(employeePosition)}</strong> au sein du département <strong>${escapeHtml(employeeDepartment)}</strong> depuis le <strong>${escapeHtml(hireDate)}</strong>.`
  }

  if (employeePosition) {
    return `occupe le poste de <strong>${escapeHtml(employeePosition)}</strong> au sein de notre société depuis le <strong>${escapeHtml(hireDate)}</strong>.`
  }

  if (employeeDepartment) {
    return `travaille au sein du département <strong>${escapeHtml(employeeDepartment)}</strong> depuis le <strong>${escapeHtml(hireDate)}</strong>.`
  }

  return `travaille au sein de notre société depuis le <strong>${escapeHtml(hireDate)}</strong>.`
}

async function fileToDataUrl(filePath: string, mimeType: string) {
  const buffer = await readFile(filePath)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

async function loadCompanyAssets() {
  const [leftLogoDataUrl, centeredLogoDataUrl] = await Promise.all([
    fileToDataUrl(LOGO_LEFT_PATH, 'image/png'),
    fileToDataUrl(LOGO_CENTER_PATH, 'image/png'),
  ])

  return { leftLogoDataUrl, centeredLogoDataUrl }
}

async function buildWorkCertificateHtml(input: GenerateWorkCertificatePdfInput) {
  const assets = await loadCompanyAssets()
  const employeeName = normalizeLabel(input.employeeName)

  if (!employeeName) {
    throw new Error("Le nom de l'employe est obligatoire pour generer l'attestation de travail.")
  }

  const companyName = normalizeLabel(input.companyName)
  if (!companyName) {
    throw new Error("Le nom de l'entreprise est obligatoire pour generer l'attestation de travail.")
  }

  const generatedAt = formatFrenchDate(input.generatedAt)
  const companyAddress = normalizeLabel(input.companyAddress)
  const companyCity = normalizeLabel(input.companyCity) || DEFAULT_CITY
  const employeeSalutation = normalizeLabel(input.employeeSalutation) || 'Madame/Monsieur'
  const validatedByName = normalizeLabel(input.validatedByName) || 'Nom du valideur RH'
  const validatedByRole = normalizeLabel(input.validatedByRole) || 'Responsable Ressources Humaines'
  const employmentText = toEmploymentText(input)

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Attestation de travail</title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Times New Roman", Georgia, serif;
        background: #ffffff;
        color: #111827;
      }

      .page {
        position: relative;
        width: 210mm;
        height: 297mm;
        padding: 18mm 22mm 14mm;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .logo-left {
        position: absolute;
        top: 9mm;
        left: 10mm;
        width: 16mm;
        height: auto;
      }

      .header {
        min-height: 22mm;
        margin-bottom: 14mm;
        display: flex;
        justify-content: center;
      }

      .brand-block {
        width: fit-content;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        padding-top: 1.5mm;
        text-align: center;
      }

      .brand-logo {
        width: 54mm;
        height: auto;
        display: block;
        margin-bottom: -13mm;
        margin-left: 10mm;
      }

      .brand-address {
        margin-top: 0;
        font-size: 12pt;
        line-height: 1.2;
        color: #4b5563;
      }

      .title {
        margin: 0 0 13mm;
        text-align: center;
        font-size: 18pt;
        font-weight: 700;
        text-transform: uppercase;
        text-decoration: underline;
        text-underline-offset: 4px;
        letter-spacing: 0.04em;
        color: #111111;
      }

      .content {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .content p {
        margin: 0 0 7mm;
        font-size: 12.6pt;
        line-height: 1.8;
        text-align: justify;
      }

      .content strong {
        font-weight: 700;
      }

      .footer {
        margin-top: auto;
        padding-top: 8mm;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .issue-block {
        text-align: right;
        font-size: 11.5pt;
      }

      .signature-area {
        width: 66mm;
        margin-top: 12mm;
        margin-left: auto;
        text-align: center;
      }

      .signature-title {
        font-size: 11pt;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .signature-line {
        margin: 15mm 0 4mm;
        border-top: 1px solid #9ca3af;
      }

      .signature-name,
      .signature-role {
        margin: 0;
        font-size: 10.5pt;
        color: #374151;
      }

      .reference {
        margin-top: 8mm;
        padding-top: 3mm;
        border-top: 1px solid #e5e7eb;
        font-size: 9pt;
        color: #6b7280;
        page-break-inside: avoid;
        break-inside: avoid;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <img class="logo-left" src="${assets.leftLogoDataUrl}" alt="Logo ArabSoft" />

      <header class="header">
        <div class="brand-block">
          <img class="brand-logo" src="${assets.centeredLogoDataUrl}" alt="ArabSoft" />
          ${companyAddress ? `<div class="brand-address">${escapeHtml(companyAddress)}</div>` : ''}
        </div>
      </header>

      <main class="content">
        <h1 class="title">ATTESTATION DE TRAVAIL</h1>

        <p>
          Je soussigné(e), représentant(e) du service des Ressources Humaines de la société
          <strong>${escapeHtml(companyName)}</strong>, atteste par la présente que
          <strong>${escapeHtml(employeeSalutation)} ${escapeHtml(employeeName)}</strong>
          ${employmentText}
        </p>

        <p>
          Cette attestation est délivrée à l’intéressé(e) pour servir et valoir ce que de droit.
        </p>
      </main>

      <footer class="footer">
        <div class="issue-block">
          Fait à ${escapeHtml(companyCity)}, le ${escapeHtml(generatedAt)}
        </div>

        <div class="signature-area">
          <div class="signature-title">Visa RH</div>
          <div class="signature-line"></div>
          <p class="signature-name">${escapeHtml(validatedByName)}</p>
          <p class="signature-role">${escapeHtml(validatedByRole)}</p>
        </div>

        <div class="reference">Référence document : ${escapeHtml(input.documentReference)}</div>
      </footer>
    </div>
  </body>
</html>`
}

export async function generateWorkCertificatePdf(
  input: GenerateWorkCertificatePdfInput,
): Promise<Buffer> {
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  })

  try {
    const page = await browser.newPage()
    const html = await buildWorkCertificateHtml(input)

    await page.setContent(html, { waitUntil: 'load' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
