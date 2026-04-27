import nodemailer from 'nodemailer';

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
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const isConfigured =
    smtpUser &&
    smtpUser !== 'your_gmail@gmail.com' &&
    smtpPass &&
    smtpPass !== 'your_gmail_app_password';

  if (!isConfigured) {
    console.warn('\n\n--- [DEV EMAIL FALLBACK: SMTP not configured] ---');
    console.warn(`To: ${to}`);
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

  await transporter.sendMail({ from, to, subject, html });

  return { success: true };
}
