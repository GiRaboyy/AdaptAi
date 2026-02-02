import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

let transporter: Transporter | null = null;

function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || `ADAPT <${user}>`;

  // Email service is optional - if not configured, skip email sending
  if (!host || !port || !user || !pass) {
    console.log('[Email] SMTP not configured - email sending disabled');
    return null;
  }

  return {
    host,
    port: parseInt(port, 10),
    secure: parseInt(port, 10) === 465, // true for 465, false for other ports
    auth: { user, pass },
    from,
  };
}

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const config = getEmailConfig();
  if (!config) return null;

  // Port 465: Direct SSL connection (secure: true)
  // Port 587: STARTTLS upgrade (secure: false + requireTLS: true)
  const transportOptions: any = {
    host: config.host,
    port: config.port,
    secure: config.secure, // true for 465, false for 587
    auth: config.auth,
  };

  // Add requireTLS for port 587 (STARTTLS)
  if (config.port === 587) {
    transportOptions.requireTLS = true;
  }

  // Fix: Use createTransport (not createTransporter)
  transporter = nodemailer.createTransport(transportOptions);

  console.log(`[Email] Transporter initialized: ${config.host}:${config.port} (${config.secure ? 'SSL' : 'STARTTLS'})`);
  return transporter;
}

export interface VerificationEmailParams {
  to: string;
  name: string;
  token: string;
}

export async function sendVerificationEmail(params: VerificationEmailParams): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(`[Email] Cannot send verification email - SMTP not configured`);
    return false; // Gracefully fail
  }

  // APP_URL is required for email links - use environment variable only
  const appUrl = process.env.APP_URL;
  
  // Validate APP_URL in production
  if (!appUrl) {
    console.error('[Email] ERROR: APP_URL environment variable is not set. Email links will not work.');
    if (process.env.NODE_ENV === 'production') {
      return false; // Don't send emails with broken links in production
    }
  }
  
  // Warn if using localhost in production
  if (process.env.NODE_ENV === 'production' && appUrl?.includes('localhost')) {
    console.error('[Email] ERROR: APP_URL contains localhost in production mode! Email links will not work.');
    return false; // Don't send emails with broken links
  }
  
  // Fallback for development only
  const finalAppUrl = appUrl || 'http://localhost:5000';
  
  const verificationUrl = `${finalAppUrl}/auth/verify-email?token=${params.token}`;
  
  const config = getEmailConfig();
  if (!config) return false;

  // Brand colors
  const SIDEBAR_COLOR = '#1A1A2E';
  const LIME_ACCENT = '#C8F65D';
  
  const mailOptions = {
    from: config.from,
    to: params.to,
    replyTo: config.auth.user, // Reply-To header for deliverability
    subject: 'Подтвердите ваш email — ADAPT', // Neutral subject, no spam words
    // Plain text version (required for deliverability)
    text: `Привет, ${params.name}!

Пожалуйста, подтвердите ваш email, перейдя по ссылке:

${verificationUrl}

Ссылка действительна 24 часа.

Если вы не регистрировались в ADAPT, проигнорируйте это письмо.

С уважением,
Команда ADAPT`,
    // HTML version with brand colors
    html: `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Подтверждение email</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f4f4f8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f8;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header with brand colors -->
          <tr>
            <td style="background-color: ${SIDEBAR_COLOR}; padding: 32px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background-color: ${LIME_ACCENT}; width: 40px; height: 40px; border-radius: 10px; text-align: center; vertical-align: middle;">
                          <span style="color: #000000; font-size: 18px; font-weight: bold;">A</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <span style="color: #ffffff; font-size: 20px; font-weight: 600;">ADAPT</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px;">
              <h1 style="margin: 0 0 16px 0; color: ${SIDEBAR_COLOR}; font-size: 24px; font-weight: 700;">
                Подтвердите email
              </h1>
              <p style="margin: 0 0 32px 0; color: #64748b; font-size: 16px; line-height: 1.6;">
                Привет, ${params.name}! Пожалуйста, подтвердите ваш email-адрес, нажав на кнопку ниже:
              </p>
              
              <!-- Button -->
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background-color: ${LIME_ACCENT}; border-radius: 12px;">
                    <a href="${verificationUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; color: #000000; font-size: 16px; font-weight: 600; text-decoration: none;">
                      Подтвердить email
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 32px 0 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                Ссылка действительна 24 часа. Если кнопка не работает, скопируйте эту ссылку в браузер:
              </p>
              <p style="margin: 8px 0 0 0; word-break: break-all;">
                <a href="${verificationUrl}" style="color: #64748b; font-size: 14px;">${verificationUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                Если вы не регистрировались в ADAPT, проигнорируйте это письмо.<br>
                © 2026 ADAPT. Все права защищены.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`[Email] Verification email sent to ${params.to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send verification email to ${params.to}:`, error);
    return false;
  }
}

export async function testEmailConnection(): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.log('[Email] SMTP not configured - skipping connection test');
    return false;
  }

  try {
    await transport.verify();
    console.log('[Email] SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('[Email] SMTP connection failed:', error);
    return false;
  }
}
