import crypto from 'crypto';

export interface SentEmailPreview {
  id: string;
  to: string;
  name: string;
  subject: string;
  token: string;
  tokenType: 'INVITE' | 'RESET';
  actionUrl: string;
  expiresInText: string;
  sentAt: string;
  html: string;
  text: string;
}

// In-memory queue for dev/preview inspection
const sentEmailsBuffer: SentEmailPreview[] = [];

/**
 * Builds standard HTML email template for PsicoGestão communications
 */
function buildHtmlTemplate(params: {
  title: string;
  recipientName: string;
  mainMessage: string;
  buttonText: string;
  actionUrl: string;
  securityNotice: string;
  expiresInText: string;
}): string {
  const { title, recipientName, mainMessage, buttonText, actionUrl, securityNotice, expiresInText } = params;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #334155;">
              <div style="display: inline-block; background-color: #0d9488; color: #ffffff; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; font-weight: bold; font-size: 22px; margin-bottom: 12px;">Ψ</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">PsicoGestão</h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">Gestão Clínica • Criptografia AES-256 (LGPD) • Padrão CFP</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 16px 0; color: #f1f5f9; font-size: 18px; font-weight: 600;">${title}</h2>
              <p style="margin: 0 0 14px 0; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                Olá, <strong>${recipientName}</strong>!
              </p>
              <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                ${mainMessage}
              </p>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #0d9488; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiration Alert -->
              <div style="background-color: #0f172a; border-left: 4px solid #0d9488; border-radius: 6px; padding: 12px 16px; margin: 24px 0;">
                <p style="margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.5;">
                  ⏳ <strong>Validade do Link:</strong> ${expiresInText}. Após este período, será necessário solicitar um novo acesso.
                </p>
              </div>

              <!-- Fallback Direct Link -->
              <p style="margin: 20px 0 6px 0; color: #64748b; font-size: 11px;">
                Caso o botão não funcione, copie e cole o endereço abaixo no seu navegador:
              </p>
              <p style="margin: 0; word-break: break-all; font-family: monospace; font-size: 11px; color: #2dd4bf; background-color: #0f172a; padding: 8px 12px; border-radius: 6px; border: 1px solid #334155;">
                ${actionUrl}
              </p>

              <!-- Security Notice -->
              <p style="margin: 24px 0 0 0; color: #64748b; font-size: 12px; line-height: 1.5; border-top: 1px solid #334155; padding-top: 20px;">
                🔒 ${securityNotice}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px; text-align: center; background-color: #0f172a; border-top: 1px solid #334155;">
              <p style="margin: 0; color: #64748b; font-size: 11px;">
                Esta é uma mensagem automática de segurança da plataforma clínica PsicoGestão.<br>
                Por favor, não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Sends or simulates sending an invitation email for first access
 */
export async function sendInvitationEmail(params: {
  to: string;
  name: string;
  token: string;
  roleName: string;
  appBaseUrl?: string;
}): Promise<SentEmailPreview> {
  const { to, name, token, roleName, appBaseUrl = 'http://localhost:3000' } = params;
  const actionUrl = `${appBaseUrl}/?action=set-password&token=${token}&type=INVITE`;
  const subject = 'Bem-vindo(a) ao PsicoGestão - Ative seu acesso profissional';
  const expiresInText = 'Este convite é válido por 24 horas';

  const html = buildHtmlTemplate({
    title: 'Seu acesso ao PsicoGestão foi liberado!',
    recipientName: name,
    mainMessage: `Você foi cadastrado(a) como <strong>${roleName}</strong> na plataforma clínica do consultório. Para começar a utilizar o sistema e acessar prontuários com segurança, clique no botão abaixo para definir sua senha de acesso pessoal.`,
    buttonText: 'Cadastrar Minha Senha de Acesso',
    actionUrl,
    securityNotice: 'Se você não reconhece este cadastro ou não atua neste consultório, por favor desconsidere este e-mail. Nunca compartilhe este link.',
    expiresInText,
  });

  const text = `Olá, ${name}!\n\nVocê foi cadastrado(a) como ${roleName} no PsicoGestão.\nPara ativar sua conta e definir sua senha, acesse o link abaixo:\n${actionUrl}\n\nEste link é válido por 24 horas.`;

  const emailPreview: SentEmailPreview = {
    id: crypto.randomUUID(),
    to,
    name,
    subject,
    token,
    tokenType: 'INVITE',
    actionUrl,
    expiresInText,
    sentAt: new Date().toISOString(),
    html,
    text,
  };

  sentEmailsBuffer.unshift(emailPreview);
  if (sentEmailsBuffer.length > 30) sentEmailsBuffer.pop();

  console.log(`[EmailService] Convite enviado para ${to} (Token: ${token.slice(0, 8)}...)`);
  return emailPreview;
}

/**
 * Sends or simulates sending a password reset email
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  token: string;
  appBaseUrl?: string;
}): Promise<SentEmailPreview> {
  const { to, name, token, appBaseUrl = 'http://localhost:3000' } = params;
  const actionUrl = `${appBaseUrl}/?action=set-password&token=${token}&type=RESET`;
  const subject = 'PsicoGestão - Redefinição de Senha de Acesso';
  const expiresInText = 'Este link é válido por 1 hora';

  const html = buildHtmlTemplate({
    title: 'Solicitação de Redefinição de Senha',
    recipientName: name,
    mainMessage: 'Recebemos uma solicitação para redefinir a senha de acesso da sua conta no PsicoGestão. Clique no botão abaixo para criar uma nova senha forte.',
    buttonText: 'Redefinir Minha Senha',
    actionUrl,
    securityNotice: 'Se você não solicitou a redefinição de senha, nenhuma ação é necessária. Sua senha atual permanecerá segura.',
    expiresInText,
  });

  const text = `Olá, ${name}!\n\nRecebemos uma solicitação de redefinição de senha para sua conta no PsicoGestão.\nPara criar uma nova senha, acesse o link:\n${actionUrl}\n\nEste link é de uso único e expira em 1 hora.`;

  const emailPreview: SentEmailPreview = {
    id: crypto.randomUUID(),
    to,
    name,
    subject,
    token,
    tokenType: 'RESET',
    actionUrl,
    expiresInText,
    sentAt: new Date().toISOString(),
    html,
    text,
  };

  sentEmailsBuffer.unshift(emailPreview);
  if (sentEmailsBuffer.length > 30) sentEmailsBuffer.pop();

  console.log(`[EmailService] Redefinição de senha enviada para ${to} (Token: ${token.slice(0, 8)}...)`);
  return emailPreview;
}

/**
 * Retrieves the latest sent email preview (filtered by recipient or overall)
 */
export function getLatestEmail(recipientEmail?: string): SentEmailPreview | null {
  if (recipientEmail) {
    const found = sentEmailsBuffer.find(
      e => e.to.toLowerCase().trim() === recipientEmail.toLowerCase().trim()
    );
    return found || null;
  }
  return sentEmailsBuffer[0] || null;
}

/**
 * Returns all recent sent email previews
 */
export function getAllRecentEmails(): SentEmailPreview[] {
  return [...sentEmailsBuffer];
}

/**
 * Clears memory buffer of sent emails
 */
export function clearSentEmails(): void {
  sentEmailsBuffer.length = 0;
}
