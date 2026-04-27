/**
 * Generates the HTML content for the OTP verification email.
 * Design follows the ArabSoft design system.
 */
export function generateOTPEmail(firstName: string, code: string): string {
  const primaryNavy = '#1B3A6B';
  const accentAmber = '#F5A623';
  const bodyGray = '#64748B';
  const bgLight = '#F4F6FA';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vérification de votre identité</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f0f2f5;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f0f2f5;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 32px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      background-color: ${primaryNavy};
      padding: 32px 16px;
      text-align: center;
      color: #ffffff;
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .logo-soft {
      color: ${accentAmber};
    }
    .divider {
      display: inline-block;
      width: 1px;
      height: 20px;
      background-color: rgba(255, 255, 255, 0.2);
      margin: 0 12px;
      vertical-align: middle;
    }
    .hr-label {
      font-size: 14px;
      font-weight: 400;
      color: rgba(255, 255, 255, 0.7);
      vertical-align: middle;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .accent-bar {
      height: 4px;
      background-color: ${accentAmber};
    }
    .body {
      padding: 32px 24px;
      text-align: center;
    }
    h1 {
      color: ${primaryNavy};
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .subtitle {
      color: ${bodyGray};
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 32px;
      max-width: 480px;
      margin-left: auto;
      margin-right: auto;
    }
    .code-card {
      background-color: ${bgLight};
      border-radius: 12px;
      padding: 32px 16px;
      border-left: 4px solid ${accentAmber};
      margin-bottom: 32px;
    }
    .code {
      background-color: ${primaryNavy};
      color: #ffffff;
      font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Monaco, Consolas, monospace;
      font-size: 32px;
      font-weight: 700;
      padding: 12px 24px;
      border-radius: 8px;
      letter-spacing: 0.2em;
      display: inline-block;
    }
    .warning {
      color: ${bodyGray};
      font-size: 13px;
      line-height: 1.4;
    }
    .footer {
      background-color: ${primaryNavy};
      padding: 24px;
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      font-size: 13px;
    }
    .copyright {
      color: rgba(255, 255, 255, 0.4);
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <span class="logo">ARAB<span class="logo-soft">SOFT</span></span>
        <span class="divider"></span>
        <span class="hr-label">HR</span>
      </div>
      
      <div class="accent-bar"></div>

      <!-- Body -->
      <div class="body">
        <h1>Vérification de votre identité</h1>
        <p class="subtitle">
          Bonjour ${firstName}, utilisez le code ci-dessous pour accéder à votre portail RH. 
          Ce code expire dans 10 minutes.
        </p>
        
        <div class="code-card">
          <span class="code">${code}</span>
        </div>

        <p class="warning">
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et contactez le service RH.
        </p>
      </div>

      <div class="accent-bar"></div>

      <!-- Footer -->
      <div class="footer">
        <div>Vous recevez cet e-mail dans le cadre d'une procédure de connexion sécurisée.</div>
        <div class="copyright">© 2026 ArabSoft. Tous droits réservés.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
