import nodemailer from 'nodemailer';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildSlaEmailHtml({
  type,
  requestId,
  requestType,
  employeeName,
  deadline,
  owner,
  sentAt,
  overdueDays,
  hoursRemaining,
  requestUrl,
}: {
  type: 'WARNING' | 'BREACH' | 'ESCALATION';
  requestId: string;
  requestType: string;
  employeeName: string;
  deadline: Date | string;
  owner: string;
  sentAt: Date | string;
  overdueDays?: number;
  hoursRemaining?: number;
  requestUrl?: string | null;
}) {
  const normalizedType = type === 'WARNING' ? 'WARNING' : type === 'ESCALATION' ? 'ESCALATION' : 'BREACH';
  const title =
    normalizedType === 'WARNING'
      ? 'Avertissement SLA'
      : normalizedType === 'ESCALATION'
        ? 'SLA Depasse - Escalade'
        : 'SLA Depasse - Action Requise';
  const intro =
    normalizedType === 'WARNING'
      ? "Cette demande approche de son echeance SLA et necessite une prise en charge rapide."
      : normalizedType === 'ESCALATION'
        ? "Cette demande reste en depassement SLA et vous est escaladee pour traitement prioritaire."
        : "Cette demande a depasse son delai SLA et doit etre traitee immediatement.";
  const cta =
    normalizedType === 'WARNING'
      ? 'Veuillez traiter cette demande rapidement afin de respecter le delai imparti.'
      : 'Veuillez traiter cette demande immediatement.';
  const timingLabel =
    normalizedType === 'WARNING' ? "Echeance SLA" : "Echeance SLA depassee";
  const timestampLabel =
    normalizedType === 'WARNING' ? "Horodatage de l'avertissement" : 'Horodatage de notification';
  const normalizedOverdueDays = Math.max(0, Math.floor(overdueDays ?? 0));
  const normalizedHoursRemaining = Math.max(0, Math.floor(hoursRemaining ?? 0));
  const requestReference = `#${requestId.slice(0, 8).toUpperCase()}`;

  return `<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; color: #212121">
  <div style="max-width: 600px; margin: auto">
    <div style="text-align: center; background-color: #1B3A6B; padding: 32px 16px; border-radius: 32px 32px 0 0;">
      <span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.04em;">
        ARAB<span style="color: #F5A623;">SOFT</span>
        <span style="font-size: 13px; color: rgba(255,255,255,0.5); border-left: 1px solid rgba(255,255,255,0.2); padding-left: 10px; margin-left: 4px; letter-spacing: 0.08em; font-weight: 400;">HR</span>
      </span>
    </div>
    <div style="background-color: #F5A623; height: 4px;"></div>
    <div style="padding: 32px 24px; background-color: #ffffff;">
      <h1 style="font-size: 24px; color: #1B3A6B; margin-bottom: 8px;">${escapeHtml(title)}</h1>
      <p style="color: #64748B; margin-top: 0; margin-bottom: 24px; font-size: 14px;">${escapeHtml(intro)}</p>
      <div style="background-color: #F4F6FA; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; border-left: 4px solid #F5A623;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #1B3A6B; font-size: 15px;">Details de la demande</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #64748B; width: 42%;">Reference de demande</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${escapeHtml(requestReference)}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Collaborateur</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${escapeHtml(employeeName)}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Type de demande</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${escapeHtml(requestType)}</td></tr>
          ${normalizedType === 'WARNING' ? `<tr><td style="padding: 6px 0; color: #64748B;">Temps restant</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">Expire dans ${escapeHtml(String(normalizedHoursRemaining))} heure(s)</td></tr>` : ''}
          <tr><td style="padding: 6px 0; color: #64748B;">${escapeHtml(timingLabel)}</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${escapeHtml(formatDateTime(deadline))}</td></tr>
          ${normalizedType === 'WARNING' ? '' : `<tr><td style="padding: 6px 0; color: #64748B;">Retard cumule</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${escapeHtml(String(normalizedOverdueDays))} jour(s)</td></tr>`}
          <tr><td style="padding: 6px 0; color: #64748B;">Responsable actuel</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${escapeHtml(owner)}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">${escapeHtml(timestampLabel)}</td><td style="padding: 6px 0; color: #1E293B; font-weight: 600;">${escapeHtml(formatDateTime(sentAt))}</td></tr>
        </table>
      </div>
      ${requestUrl ? `<div style="text-align: center; margin-bottom: 24px;"><a href="${escapeHtml(requestUrl)}" target="_blank" style="display: inline-block; background-color: #1B3A6B; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.02em;">Ouvrir la demande ${escapeHtml(requestReference)}</a></div>` : ''}
      <div style="background-color: #FFF7E8; border: 1px solid #F5D18A; border-radius: 12px; padding: 16px 18px; margin-bottom: 24px;">
        <p style="margin: 0; color: #7C4A03; font-size: 14px; line-height: 1.6; font-weight: 600;">${escapeHtml(cta)}</p>
      </div>
    </div>
    <div style="background-color: #F5A623; height: 4px;"></div>
    <div style="text-align: center; background-color: #1B3A6B; padding: 24px 16px; border-radius: 0 0 32px 32px;">
      <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 8px;">Pour toute question, contactez le service RH.</p>
      <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.4);">(c) 2026 ArabSoft. Tous droits reserves.</p>
    </div>
  </div>
</div>`;
}

function resolveEmailRecipient(to: string) {
  const demoEmailRedirect = process.env.DEMO_EMAIL_REDIRECT || "tn.spazio@gmail.com";
  const normalizedTo = to.trim().toLowerCase();
  const shouldRedirectDemoEmail = normalizedTo.endsWith("@demo.com");

  return {
    to: shouldRedirectDemoEmail ? demoEmailRedirect : to,
    originalTo: to,
    redirected: shouldRedirectDemoEmail,
  };
}

/**
 * Sends an email using Nodemailer with Gmail SMTP.
 * Falls back to console logging when SMTP_USER is not configured.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean }> {
  const recipient = resolveEmailRecipient(to);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const isConfigured =
    smtpUser &&
    smtpUser !== 'your_gmail@gmail.com' &&
    smtpPass &&
    smtpPass !== 'your_gmail_app_password';

  if (!isConfigured) {
    console.warn('\n\n--- [DEV EMAIL FALLBACK: SMTP not configured] ---');
    console.warn(`To: ${recipient.to}`);
    if (recipient.redirected) {
      console.warn(`Original recipient: ${recipient.originalTo}`);
    }
    console.warn(`Subject: ${subject}`);
    console.warn('HTML email would be sent here.');
    console.warn('-------------------------------------------------\n\n');
    return { success: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true for port 465, false for 587
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const from = process.env.SMTP_FROM || `ArabSoft RH <${smtpUser}>`;

  await transporter.sendMail({ from, to: recipient.to, subject, html });

  return { success: true };
}
