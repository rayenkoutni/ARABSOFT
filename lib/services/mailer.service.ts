import nodemailer from 'nodemailer';

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
