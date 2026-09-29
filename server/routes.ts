import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { queryAll, queryOne, execute } from './db.js';
import { encryptClinicalText, decryptClinicalText, generateSHA256 } from './crypto.js';
import { isValidCPF } from './validators.js';
import {
  AuthRequest,
  generateToken,
  authenticateToken,
  requireRole,
  requireSuperAdmin,
  recordAuditLog,
} from './auth.js';
import {
  sendInvitationEmail,
  sendPasswordResetEmail,
  getLatestEmail,
  getAllRecentEmails,
} from './services/emailService.js';
import {
  getFiscalSettings,
  saveFiscalSettings,
  calculateCarneLeaoCompetence,
  generateRendimentosCsv,
  generateDespesasCsv,
  generateDossierData,
} from './fiscalService.js';
import {
  getClinicFiscalCredentials,
  saveClinicFiscalCredentials,
  testMunicipalConnection,
  emitNfseDirect,
  cancelNfseDirect,
} from './fiscalGatewayService.js';
import {
  getPublicGatewaySettings,
  saveGatewaySettings,
  testAsaasConnection,
  createAsaasCharge,
  handleAsaasWebhookEvent,
} from './services/asaasService.js';
import { importPsicoManagerCsv } from './services/psicoManagerImporter.js';
import { executeUniversalMigration } from './services/universalMigratorService.js';
import { patientRouter } from './patientRoutes.js';
import {
  askSynapsiCopilot,
  explainElementWithAi,
  formatClinicalNotes,
  ocrHandwrittenNotes,
  generateComparativeEvolution,
  generateSessionPrepInsights,
  transcribeSessionAudio,
} from './aiService.js';

export const router = Router();

// ==========================================
// 📲 MONTAGEM DO NAMESPACE SYNAPSIS PACIENTE (/api/patient/*)
// ==========================================
router.use('/patient', patientRouter);

// ==========================================
// 🏥 SYNAPSIS PACIENTE - CONFIGURAÇÕES DO TERAPEUTA & RECEPÇÃO
// ==========================================

// Configuração do canal clínico pelo próprio psicólogo
router.patch('/psychologist/chat-settings', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST']), (req: AuthRequest, res: Response): void => {
  const { chatEnabledDefault, chatWorkingHours } = req.body;
  const userId = req.user!.id;

  execute(
    `UPDATE users SET chat_enabled_default = ?, chat_working_hours = ? WHERE id = ?`,
    [chatEnabledDefault ? 1 : 0, JSON.stringify(chatWorkingHours || {}), userId]
  );

  res.json({ success: true, message: 'Configurações de atendimento via app atualizadas com sucesso.' });
});

// Override individual por paciente (habilitar/desabilitar para paciente específico)
router.patch('/patients/:id/chat-override', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST']), (req: AuthRequest, res: Response): void => {
  const { chatOverride } = req.body; // 'ENABLED' | 'DISABLED' | null
  const patientId = Number(req.params.id);

  execute(
    `UPDATE patients SET psychologist_chat_override = ? WHERE id = ?`,
    [chatOverride || null, patientId]
  );

  res.json({ success: true, message: 'Permissão de mensagens do paciente atualizada.' });
});

// Gerar link de convite personalizado para o Synapsis Paciente
router.post('/patients/:id/invite', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST', 'SECRETARY']), (req: AuthRequest, res: Response): void => {
  const patientId = Number(req.params.id);
  const patient = queryOne<any>("SELECT * FROM patients WHERE id = ?", [patientId]);
  if (!patient) {
    res.status(404).json({ error: 'Paciente não encontrado.' });
    return;
  }

  // Gerar token UUID seguro
  const inviteToken = crypto.randomUUID();

  execute(
    `UPDATE patients 
     SET portal_invite_token = ?, 
         portal_invite_sent_at = datetime('now'), 
         portal_invite_expires_at = datetime('now', '+7 days'),
         portal_access_enabled = 1
     WHERE id = ?`,
    [inviteToken, patientId]
  );

  // Determinar número de telefone de destino (roteamento WhatsApp inteligente)
  let targetPhone = patient.phone || '';
  let recipientName = patient.full_name.split(' ')[0];

  const isMinor = patient.group_type === 'Criança' || patient.group_type === 'Adolescente';
  if (patient.guardian_json) {
    try {
      const guardian = typeof patient.guardian_json === 'string' ? JSON.parse(patient.guardian_json) : patient.guardian_json;
      if (guardian && guardian.phone) {
        if (patient.whatsapp_routing_json) {
          const routing = typeof patient.whatsapp_routing_json === 'string' ? JSON.parse(patient.whatsapp_routing_json) : patient.whatsapp_routing_json;
          if (routing.appointmentChannel === 'GUARDIAN') {
            targetPhone = guardian.phone;
            if (guardian.name) recipientName = guardian.name.split(' ')[0];
          }
        } else if (isMinor) {
          targetPhone = guardian.phone;
          if (guardian.name) recipientName = guardian.name.split(' ')[0];
        }
      }
    } catch (e) {}
  }

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const inviteUrl = `${protocol}://${host}/paciente?invite=${inviteToken}`;

  const messageText = `Olá, *${recipientName}*! 👋\n\n` +
    `Sua clínica disponibilizou seu acesso exclusivo ao aplicativo *Synapsis Paciente*.\n\n` +
    `Por ele você pode consultar seus agendamentos, confirmar consultas, acessar recibos para IRPF e responder às suas atividades terapêuticas.\n\n` +
    `👉 Toque no link abaixo para ativar seu acesso:\n` +
    `${inviteUrl}\n\n` +
    `_(Link válido por 7 dias. No primeiro acesso, você criará um PIN de 4 dígitos para os próximos acessos rápidos.)_`;

  const cleanDigits = targetPhone.replace(/\D/g, '');
  const waNumber = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;
  const whatsappUrl = cleanDigits ? `https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}` : null;

  recordAuditLog(req, 'GENERATE_PATIENT_INVITE', 'PATIENTS', `Gerou link de convite do Synapsis Paciente para ${patient.full_name} (ID: ${patientId})`);

  res.json({
    success: true,
    inviteToken,
    inviteUrl,
    whatsappUrl,
    messageText,
    targetPhone,
    recipientName,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    sentAt: new Date().toISOString()
  });
});

// Habilitar / Desabilitar acesso ao Synapsis Paciente
router.patch('/patients/:id/portal-status', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST', 'SECRETARY']), (req: AuthRequest, res: Response): void => {
  const patientId = Number(req.params.id);
  const { enabled } = req.body;

  execute(
    `UPDATE patients SET portal_access_enabled = ? WHERE id = ?`,
    [enabled ? 1 : 0, patientId]
  );

  recordAuditLog(req, 'TOGGLE_PATIENT_PORTAL', 'PATIENTS', `Alterou status do Synapsis Paciente para ${enabled ? 'HABILITADO' : 'DESABILITADO'} (Paciente ID: ${patientId})`);

  res.json({ success: true, portal_access_enabled: !!enabled });
});

// Envio de convite por e-mail
router.post('/patients/:id/send-invite-email', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST', 'SECRETARY']), (req: AuthRequest, res: Response): void => {
  const patientId = Number(req.params.id);
  const patient = queryOne<any>("SELECT * FROM patients WHERE id = ?", [patientId]);
  if (!patient || !patient.email) {
    res.status(400).json({ error: 'Paciente não possui e-mail cadastrado.' });
    return;
  }

  // Gera ou reutiliza token existente se válido
  let token = patient.portal_invite_token;
  if (!token) {
    token = crypto.randomUUID();
    execute(
      `UPDATE patients 
       SET portal_invite_token = ?, 
           portal_invite_sent_at = datetime('now'), 
           portal_invite_expires_at = datetime('now', '+7 days'),
           portal_access_enabled = 1
       WHERE id = ?`,
      [token, patientId]
    );
  }

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const inviteUrl = `${protocol}://${host}/paciente?invite=${token}`;

  recordAuditLog(req, 'SEND_PATIENT_INVITE_EMAIL', 'PATIENTS', `Enviou convite de acesso por e-mail para ${patient.email} (Paciente ID: ${patientId})`);

  res.json({
    success: true,
    message: `Convite enviado com sucesso para ${patient.email}`,
    inviteUrl
  });
});


// Mensagens recebidas pela recepção (Canal Administrativo)
router.get('/reception/patient-messages', authenticateToken, requireRole(['ADMIN', 'SECRETARY']), (req: AuthRequest, res: Response): void => {
  const messages = queryAll<any>(
    `SELECT m.id, m.patient_id, m.channel_type, m.sender_type, m.sender_user_id, m.message_text, m.is_read, m.created_at,
            p.full_name as patient_name, p.phone as patient_phone
     FROM patient_messages m
     JOIN patients p ON p.id = m.patient_id
     WHERE m.channel_type = 'ADMINISTRATIVE'
     ORDER BY m.created_at DESC LIMIT 100`
  );
  res.json({ messages });
});

// Resposta da recepção ao paciente
router.post('/reception/patient-messages', authenticateToken, requireRole(['ADMIN', 'SECRETARY']), (req: AuthRequest, res: Response): void => {
  const { patientId, messageText } = req.body;
  if (!patientId || !messageText) {
    res.status(400).json({ error: 'Paciente e mensagem são obrigatórios.' });
    return;
  }

  const result = execute(
    `INSERT INTO patient_messages (patient_id, channel_type, sender_type, sender_user_id, message_text)
     VALUES (?, 'ADMINISTRATIVE', 'RECEPTION', ?, ?)`,
    [patientId, req.user!.id, messageText.trim()]
  );

  res.json({ success: true, messageId: result.lastInsertRowid });
});

// Mensagens recebidas pelo psicólogo (Canal Clínico)
router.get('/psychologist/patient-messages', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST']), (req: AuthRequest, res: Response): void => {
  const psychologistId = req.user!.id;
  const messages = queryAll<any>(
    `SELECT m.id, m.patient_id, m.channel_type, m.sender_type, m.sender_user_id, m.message_text, m.is_read, m.created_at,
            p.full_name as patient_name, p.phone as patient_phone
     FROM patient_messages m
     JOIN patients p ON p.id = m.patient_id
     WHERE m.channel_type = 'CLINICAL' AND p.psychologist_id = ?
     ORDER BY m.created_at DESC LIMIT 100`,
    [psychologistId]
  );
  res.json({ messages });
});

// Resposta do psicólogo ao paciente
router.post('/psychologist/patient-messages', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST']), (req: AuthRequest, res: Response): void => {
  const { patientId, messageText } = req.body;
  if (!patientId || !messageText) {
    res.status(400).json({ error: 'Paciente e mensagem são obrigatórios.' });
    return;
  }

  const result = execute(
    `INSERT INTO patient_messages (patient_id, channel_type, sender_type, sender_user_id, message_text)
     VALUES (?, 'CLINICAL', 'PSYCHOLOGIST', ?, ?)`,
    [patientId, req.user!.id, messageText.trim()]
  );

  res.json({ success: true, messageId: result.lastInsertRowid });
});

// ==========================================
// 🛡️ RATE LIMITING EM MEMÓRIA (ANTI-BRUTE-FORCE)
// ==========================================
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitRecord>();

function createRateLimiter(options: { windowMs: number; max: number; message: string }) {
  return (req: Request, res: Response, next: () => void): void => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.path}:${clientIp}`;
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || record.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (record.count >= options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSec);
      res.status(429).json({ error: options.message, retryAfter: retryAfterSec });
      return;
    }

    record.count++;
    next();
  };
}

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // Janela de 15 minutos
  max: 30,                  // Máximo de 30 requisições por IP
  message: 'Muitas tentativas a partir deste endereço IP. Aguarde alguns minutos antes de tentar novamente.',
});

// ==========================================
// 0. LISTA DE ESPERA — CLUBE DAS FUNDADORAS (LANDING PAGE)
// ==========================================
const waitlistSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  whatsapp: z.string().min(8, 'WhatsApp é obrigatório'),
  email: z.string().email('E-mail inválido'),
  profile: z.string().optional(),
  current_software: z.string().optional(),
  interested_plan: z.string().optional(),
});

router.post('/waitlist', async (req: Request, res: Response) => {
  try {
    const parseResult = waitlistSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' });
      return;
    }

    const { name, whatsapp, email, profile, current_software, interested_plan } = parseResult.data;

    execute(
      `INSERT INTO waitlist_leads (name, whatsapp, email, profile, current_software, interested_plan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, whatsapp, email, profile || 'Psicóloga Clínica', current_software || 'Outro', interested_plan || 'Parceria PJ']
    );

    console.log(`[Waitlist] Lead registrado no Clube das Fundadoras: ${name} (${whatsapp}) - Plano: ${interested_plan}`);

    res.json({
      success: true,
      message: 'Inscrição no Clube das Fundadoras confirmada com sucesso!',
      downloadUrl: '/landing/contrato-blindado-avaliacao-psicoterapia.html'
    });
  } catch (err: any) {
    console.error('[Waitlist] Erro ao registrar lead:', err);
    res.status(500).json({ error: 'Erro interno ao salvar inscrição na lista de espera' });
  }
});

// ==========================================
// 🌟 CLUBE DAS FUNDADORAS, SUPERADMIN & ONBOARDING MULTI-TENANT
// ==========================================

router.get('/waitlist', authenticateToken, requireSuperAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const leads = queryAll(`
      SELECT 
        w.*,
        ti.token as invite_token,
        ti.status as invite_status,
        ti.is_vip_exempt as invite_is_vip,
        ti.expires_at as invite_expires_at,
        ti.accepted_at as invite_accepted_at
      FROM waitlist_leads w
      LEFT JOIN tenant_invites ti ON ti.lead_id = w.id OR LOWER(ti.email) = LOWER(w.email)
      ORDER BY w.id DESC
    `);
    res.json({ success: true, count: leads.length, leads });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar leads da lista de espera' });
  }
});

router.get('/superadmin/leads', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const leads = queryAll(`
      SELECT 
        w.*,
        ti.token as invite_token,
        ti.status as invite_status,
        ti.is_vip_exempt as invite_is_vip,
        ti.expires_at as invite_expires_at,
        ti.accepted_at as invite_accepted_at
      FROM waitlist_leads w
      LEFT JOIN tenant_invites ti ON ti.lead_id = w.id OR LOWER(ti.email) = LOWER(w.email)
      ORDER BY w.id DESC
    `);
    res.json({ success: true, count: leads.length, leads });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar leads do SuperAdmin' });
  }
});

router.post('/superadmin/leads/:id/approve', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const leadId = Number(req.params.id);
    const lead = queryOne<any>('SELECT * FROM waitlist_leads WHERE id = ?', [leadId]);

    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado na lista de espera.' });
    }

    const isVipExempt = req.body.is_vip_exempt ? 1 : 0;
    const trialDays = Number(req.body.trial_days) || 90;
    const plan = req.body.plan || lead.interested_plan || 'Parceria PJ';

    // Gera token seguro de 48 caracteres hex
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Insere convite
    execute(
      `INSERT INTO tenant_invites (token, lead_id, email, name, whatsapp, plan, is_vip_exempt, trial_days, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [token, lead.id, lead.email, lead.name, lead.whatsapp, plan, isVipExempt, trialDays, expiresAt]
    );

    // Atualiza status do lead
    execute(`UPDATE waitlist_leads SET status = 'APPROVED' WHERE id = ?`, [leadId]);

    // Monta URL de ativação
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'] || 'localhost:3333';
    const baseUrl = `${proto}://${host}`;
    const inviteUrl = `${baseUrl}/ativar?token=${token}`;

    const firstName = lead.name.split(' ')[0] || lead.name;
    const vipText = isVipExempt === 1
      ? '👑 Como membro VIP Fundadora, seu acesso é vitalício e 100% gratuito!'
      : `🌟 Liberamos seu acesso exclusivo com ${trialDays} dias de cortesia para você experimentar todas as ferramentas no seu consultório.`;

    const whatsappMessage = `Olá, ${firstName}! 🌟 Aqui é da equipe do Synapsis Clínico.

Boas notícias: sua inscrição no Clube das Fundadoras foi aprovada!
${vipText}

👉 Para criar sua senha e ativar o ambiente exclusivo do seu consultório, basta clicar no link abaixo:
${inviteUrl}

Se tiver qualquer dúvida ou precisar de suporte no primeiro acesso, estamos à disposição!`;

    recordAuditLog(req, 'APPROVE_LEAD_INVITE', 'SUPERADMIN', `Lead #${leadId} (${lead.name}) aprovado com token ${token} (VIP: ${isVipExempt})`);

    res.json({
      success: true,
      token,
      inviteUrl,
      whatsappMessage,
      is_vip_exempt: isVipExempt === 1,
      trial_days: trialDays,
    });
  } catch (err: any) {
    console.error('[SuperAdmin] Erro ao aprovar lead:', err);
    res.status(500).json({ error: 'Erro ao aprovar lead e gerar convite' });
  }
});

router.post('/superadmin/leads/:id/cancel', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const leadId = Number(req.params.id);
    const lead = queryOne<any>('SELECT * FROM waitlist_leads WHERE id = ?', [leadId]);

    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado na lista de espera.' });
    }

    const reason = req.body?.reason || 'Desistência / Cancelamento informado pelo administrador';

    // Atualiza status do lead para CANCELLED
    execute(`UPDATE waitlist_leads SET status = 'CANCELLED' WHERE id = ?`, [leadId]);

    // Invalida convites pendentes associados a este lead
    execute(`UPDATE tenant_invites SET status = 'CANCELLED' WHERE lead_id = ? OR LOWER(email) = LOWER(?)`, [leadId, lead.email]);

    recordAuditLog(req, 'CANCEL_LEAD_ONBOARDING', 'SUPERADMIN', `Lead #${leadId} (${lead.name}) marcado como desistência/cancelado. Motivo: ${reason}`);

    res.json({
      success: true,
      message: `Processo de ${lead.name} marcado como desistência com sucesso. O link de convite foi invalidado.`,
      lead_id: leadId,
      status: 'CANCELLED'
    });
  } catch (err: any) {
    console.error('[SuperAdmin] Erro ao cancelar lead:', err);
    res.status(500).json({ error: 'Erro ao registrar desistência/cancelamento do lead' });
  }
});

router.post('/superadmin/leads/:id/reopen', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const leadId = Number(req.params.id);
    const lead = queryOne<any>('SELECT * FROM waitlist_leads WHERE id = ?', [leadId]);

    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado na lista de espera.' });
    }

    // Retorna status do lead para PENDING
    execute(`UPDATE waitlist_leads SET status = 'PENDING' WHERE id = ?`, [leadId]);

    // Remove convites antigos para permitir gerar um novo convite limpo
    execute(`DELETE FROM tenant_invites WHERE lead_id = ? OR LOWER(email) = LOWER(?)`, [leadId, lead.email]);

    recordAuditLog(req, 'REOPEN_LEAD_ONBOARDING', 'SUPERADMIN', `Lead #${leadId} (${lead.name}) reaberto para fila de espera.`);

    res.json({
      success: true,
      message: `Lead ${lead.name} reaberto com sucesso na lista de espera.`,
      lead_id: leadId,
      status: 'PENDING'
    });
  } catch (err: any) {
    console.error('[SuperAdmin] Erro ao reabrir lead:', err);
    res.status(500).json({ error: 'Erro ao reabrir lead' });
  }
});

router.get('/superadmin/clinics', authenticateToken, requireSuperAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const clinics = queryAll(`
      SELECT 
        c.id,
        c.clinic_name,
        c.cnpj,
        c.phone,
        c.email,
        c.plan,
        c.billing_cycle,
        c.subscription_status,
        c.trial_ends_at,
        c.is_vip_exempt,
        c.updated_at,
        (SELECT count(*) FROM patients p WHERE p.clinic_id = c.id) as patient_count,
        (SELECT count(*) FROM users u WHERE u.clinic_id = c.id) as user_count,
        (SELECT name FROM users u WHERE u.clinic_id = c.id AND (u.role = 'ADMIN' OR u.role_id = 1) LIMIT 1) as owner_name
      FROM clinic_settings c
      ORDER BY c.id ASC
    `);

    res.json({ success: true, count: clinics.length, clinics });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao listar clínicas multi-tenant' });
  }
});

router.patch('/superadmin/clinics/:id/toggle-vip', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = Number(req.params.id);
    const clinic = queryOne<any>('SELECT id, is_vip_exempt, clinic_name FROM clinic_settings WHERE id = ?', [clinicId]);

    if (!clinic) {
      return res.status(404).json({ error: 'Clínica não encontrada' });
    }

    const newVip = clinic.is_vip_exempt ? 0 : 1;
    execute('UPDATE clinic_settings SET is_vip_exempt = ? WHERE id = ?', [newVip, clinicId]);

    recordAuditLog(req, 'TOGGLE_CLINIC_VIP', 'SUPERADMIN', `Clínica #${clinicId} (${clinic.clinic_name}) VIP alterado para ${newVip}`);

    res.json({
      success: true,
      clinic_id: clinicId,
      is_vip_exempt: newVip === 1,
      message: newVip === 1 ? 'Clínica definida como VIP Isenta Vitalícia.' : 'Isenção VIP desativada.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao alterar isenção VIP da clínica' });
  }
});

// ==========================================
// 🔗 FLUXO DE ATIVAÇÃO PÚBLICA DE CONVITE (/ativar?token=...)
// ==========================================

router.get('/public/invite/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Token não fornecido' });
    }

    const invite = queryOne<any>(
      'SELECT id, token, lead_id, email, name, whatsapp, plan, status, is_vip_exempt, trial_days, expires_at FROM tenant_invites WHERE token = ?',
      [token]
    );

    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado ou link inválido.' });
    }

    if (invite.status === 'ACCEPTED') {
      return res.status(400).json({ error: 'Este convite já foi utilizado e ativado anteriormente. Faça login na sua conta.' });
    }

    if (invite.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Este convite foi cancelado por desistência ou solicitação administrativa.' });
    }

    const expTime = new Date(invite.expires_at).getTime();
    if (expTime < Date.now()) {
      return res.status(400).json({ error: 'Este convite expirou. Solicite um novo link de acesso ao suporte.' });
    }

    res.json({
      valid: true,
      name: invite.name,
      email: invite.email,
      whatsapp: invite.whatsapp,
      plan: invite.plan || 'Parceria PJ',
      is_vip_exempt: Boolean(invite.is_vip_exempt),
      trial_days: invite.trial_days || 90,
    });
  } catch (err: any) {
    console.error('[Public Invite] Erro ao validar convite:', err);
    res.status(500).json({ error: 'Erro ao validar link de convite' });
  }
});

const activateInviteSchema = z.object({
  password: z.string().min(6, 'A senha deve conter pelo menos 6 caracteres'),
  clinic_name: z.string().min(2, 'Informe o nome do seu consultório ou clínica'),
  crp_number: z.string().optional(),
  phone: z.string().optional(),
});

router.post('/public/invite/:token/activate', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim();
    const parse = activateInviteSchema.safeParse(req.body);

    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    }

    const invite = queryOne<any>('SELECT * FROM tenant_invites WHERE token = ?', [token]);
    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }
    if (invite.status === 'ACCEPTED') {
      return res.status(400).json({ error: 'Este convite já foi ativado anteriormente.' });
    }
    if (invite.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Este convite foi cancelado por desistência ou solicitação administrativa.' });
    }

    const { password, clinic_name, crp_number, phone } = parse.data;

    // Verifica se já existe usuário com este e-mail
    const existingUser = queryOne<any>('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [invite.email.toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já possui cadastro no sistema. Entre em contato com o suporte.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const trialDays = invite.trial_days || 90;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const isVip = invite.is_vip_exempt ? 1 : 0;
    const plan = invite.plan || 'PARCERIA';

    // 1. Cria nova linha em clinic_settings para este tenant isolado
    const clinicRes = execute(
      `INSERT INTO clinic_settings (
        clinic_name, email, phone, plan, billing_cycle, subscription_status, trial_ends_at, is_vip_exempt, operating_mode
      ) VALUES (?, ?, ?, ?, 'MONTHLY', 'TRIAL', ?, ?, 'ENTERPRISE_CLINIC')`,
      [clinic_name, invite.email, phone || invite.whatsapp || '', plan, trialEndsAt, isVip]
    );

    const newClinicId = clinicRes.lastInsertRowid;

    // 2. Cria usuário Administrador (Psicóloga Titular da nova clínica)
    const userRes = execute(
      `INSERT INTO users (
        name, email, password_hash, role, role_id, crp_number, clinic_id, status, is_superadmin
      ) VALUES (?, ?, ?, 'ADMIN', 1, ?, ?, 'ACTIVE', 0)`,
      [invite.name, invite.email.toLowerCase(), passwordHash, crp_number || null, newClinicId]
    );

    const newUserId = userRes.lastInsertRowid;

    // 3. Atualiza owner_user_id em clinic_settings
    execute('UPDATE clinic_settings SET owner_user_id = ? WHERE id = ?', [newUserId, newClinicId]);

    // 4. Copia modelos padrão de documentos CFP para o novo consultório
    const atestadoBlocks = JSON.stringify([
      { id: '1', title: 'Identificação', content: 'Atesto, para os devidos fins, que @paciente.nome (CPF: @paciente.cpf), encontra-se em acompanhamento psicológico neste consultório, sob meus cuidados profissionais.' },
      { id: '2', title: 'Recomendação', content: 'Sugere-se afastamento de suas atividades por X dias por motivos de saúde.' },
      { id: '3', title: 'Encerramento', content: 'Sem mais,\n\n@clinica.nome_profissional\nPsicólogo(a) - CRP: @clinica.crp' }
    ]);
    const declaracaoBlocks = JSON.stringify([
      { id: '1', title: 'Declaração', content: 'Declaro para os devidos fins que @paciente.nome compareceu a este consultório psicológico na data de @data.hoje, no período das ___ às ___ horas, para sessão de psicoterapia.' },
      { id: '2', title: 'Encerramento', content: 'Sem mais,\n\n@clinica.nome_profissional\nPsicólogo(a) - CRP: @clinica.crp' }
    ]);

    execute(`
      INSERT INTO document_templates (psychologist_id, title, document_type, content_json, clinic_id)
      VALUES 
      (?, 'Atestado Psicológico (Padrão CFP 06/2019)', 'ATESTADO', ?, ?),
      (?, 'Declaração de Comparecimento', 'DECLARACAO', ?, ?)
    `, [newUserId, atestadoBlocks, newClinicId, newUserId, declaracaoBlocks, newClinicId]);

    // 5. Marca convite como aceito
    execute('UPDATE tenant_invites SET status = \'ACCEPTED\', accepted_at = CURRENT_TIMESTAMP WHERE id = ?', [invite.id]);

    // 6. Gera token JWT para login imediato
    const userData = {
      id: newUserId,
      clinic_id: newClinicId,
      is_superadmin: false,
      name: invite.name,
      email: invite.email.toLowerCase(),
      role: 'ADMIN',
      role_id: 1,
      crp_number: crp_number || null,
      status: 'ACTIVE',
      token_version: 1,
      permissions: ['manage_users', 'view_financial', 'manage_settings', 'create_patients', 'full_clinical_access'],
    };

    const authToken = generateToken(userData);

    console.log(`🎉 [Onboarding] Novo consultório ativado com sucesso: "${clinic_name}" (#${newClinicId}) - Titular: ${invite.name}`);

    res.json({
      success: true,
      message: 'Consultório ativado com sucesso! Bem-vinda ao Synapsis Clínico.',
      token: authToken,
      user: userData,
      clinic_id: newClinicId,
    });
  } catch (err: any) {
    console.error('[Public Invite] Erro na ativação:', err);
    res.status(500).json({ error: 'Erro ao ativar consultório. Tente novamente.' });
  }
});

// ==========================================
// 💳 ÁREA DO ASSINANTE & STATUS DA ASSINATURA (/api/subscription/*)
// ==========================================

router.get('/subscription/status', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const clinic = queryOne<any>('SELECT * FROM clinic_settings WHERE id = ?', [clinicId]);

    if (!clinic) {
      return res.status(404).json({ error: 'Consultório não encontrado' });
    }

    const isVip = Boolean(clinic.is_vip_exempt);
    let daysRemaining = 9999;

    if (!isVip && clinic.trial_ends_at) {
      const exp = new Date(clinic.trial_ends_at).getTime();
      daysRemaining = Math.max(0, Math.ceil((exp - Date.now()) / (1000 * 60 * 60 * 24)));
    }

    res.json({
      success: true,
      clinic_id: clinicId,
      clinic_name: clinic.clinic_name,
      plan: clinic.plan || 'PARCERIA',
      billing_cycle: clinic.billing_cycle || 'MONTHLY',
      subscription_status: clinic.subscription_status || 'TRIAL',
      trial_ends_at: clinic.trial_ends_at,
      is_vip_exempt: isVip,
      days_remaining: daysRemaining,
      asaas_customer_id: clinic.asaas_customer_id,
      asaas_subscription_id: clinic.asaas_subscription_id,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao obter status da assinatura' });
  }
});

router.post('/subscription/checkout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const { plan, billing_cycle, payment_method } = req.body;

    const validPlans = ['SOLO', 'PARCERIA', 'CLINICA'];
    const chosenPlan = validPlans.includes(plan?.toUpperCase()) ? plan.toUpperCase() : 'PARCERIA';
    const chosenCycle = billing_cycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';

    execute(
      'UPDATE clinic_settings SET plan = ?, billing_cycle = ?, subscription_status = \'ACTIVE\' WHERE id = ?',
      [chosenPlan, chosenCycle, clinicId]
    );

    recordAuditLog(req, 'UPDATE_SUBSCRIPTION_PLAN', 'SUBSCRIPTION', `Plano atualizado para ${chosenPlan} (${chosenCycle}) via ${payment_method}`);

    res.json({
      success: true,
      message: 'Plano atualizado com sucesso!',
      plan: chosenPlan,
      billing_cycle: chosenCycle,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao processar assinatura' });
  }
});

// ==========================================
// 1. AUTENTICAÇÃO & GESTÃO DE CREDENCIAIS
// ==========================================
const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

router.post('/auth/login', authRateLimiter, async (req: AuthRequest, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  let { email, password } = parseResult.data;
  if (email.toLowerCase() === 'ana.secretaria@psicogestao.com.br') {
    email = 'ana@psicogestao.com.br';
  }

  const user = queryOne<any>(
    'SELECT id, clinic_id, is_superadmin, name, email, password_hash, role, role_id, crp_number, status, failed_login_attempts, locked_until, token_version FROM users WHERE LOWER(email) = ?',
    [email.toLowerCase()]
  );

  if (!user) {
    res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
    return;
  }

  // 1. Verifica se a conta está aguardando ativação de 1º acesso
  if (user.status === 'PENDING_ACTIVATION') {
    res.status(403).json({
      error: 'Esta conta ainda não definiu a senha de primeiro acesso. Verifique seu e-mail para ativar sua conta ou solicite o reenvio ao administrador.',
      isPendingActivation: true,
      email: user.email,
    });
    return;
  }

  // 2. Verifica se a conta foi suspensa pelo Administrador (Kill Switch)
  if (user.status === 'BLOCKED') {
    res.status(403).json({
      error: 'Acesso suspenso pela administração da clínica. Contate o suporte para mais informações.',
      isBlocked: true,
    });
    return;
  }

  // 3. Verifica bloqueio temporário por tentativas incorretas (Anti Brute-Force)
  if (user.locked_until) {
    const rawLock = String(user.locked_until).trim();
    const isoString = rawLock.includes('T')
      ? (rawLock.endsWith('Z') ? rawLock : rawLock + 'Z')
      : rawLock.replace(' ', 'T') + 'Z';
    const lockTime = new Date(isoString).getTime();
    if (lockTime > Date.now()) {
      const remainingMinutes = Math.max(1, Math.ceil((lockTime - Date.now()) / 60000));
      res.status(403).json({
        error: `Conta temporariamente bloqueada após 5 tentativas consecutivas incorretas. Tente novamente em ${remainingMinutes} minuto(s) ou solicite o desbloqueio ao administrador.`,
        isLocked: true,
        remainingMinutes,
      });
      return;
    }
  }

  // 4. Verificação da senha
  let isMatch = Boolean(user.password_hash && bcrypt.compareSync(password, user.password_hash));
  // Bypass de desenvolvimento estritamente bloqueado em ambiente de PRODUÇÃO
  if (
    process.env.NODE_ENV !== 'production' &&
    !isMatch &&
    password === 'senha123' &&
    ['admin@psicogestao.com.br', 'marcos@psicogestao.com.br', 'ana@psicogestao.com.br'].includes(email.toLowerCase())
  ) {
    isMatch = true;
  }
  if (!isMatch) {
    const currentAttempts = (Number(user.failed_login_attempts) || 0) + 1;
    let lockMessage = 'Credenciais inválidas. Verifique seu e-mail e senha.';

    if (currentAttempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      execute(
        'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
        [currentAttempts, lockUntil, user.id]
      );
      recordAuditLog(req, 'ACCOUNT_LOCKED_BRUTE_FORCE', 'AUTH', `Conta ${email} bloqueada por 15 min após 5 tentativas incorretas`);
      lockMessage = 'Conta bloqueada temporariamente por 15 minutos após 5 tentativas consecutivas incorretas. Aguarde ou solicite o desbloqueio ao administrador.';
    } else {
      execute('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [currentAttempts, user.id]);
      recordAuditLog(req, 'FAILED_LOGIN_ATTEMPT', 'AUTH', `Tentativa de login falha (${currentAttempts}/5) para ${email}`);
      const remaining = 5 - currentAttempts;
      lockMessage = `Credenciais inválidas. Atenção: mais ${remaining} tentativa(s) incorreta(s) bloquearão o acesso por 15 minutos.`;
    }

    res.status(401).json({ error: lockMessage });
    return;
  }

  // 5. Sucesso: zera o contador de erros e remove qualquer bloqueio anterior
  execute('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);

  let permissions: string[] = [];
  if (user.role_id) {
    const perms = queryAll<{name: string}>(
      `SELECT p.name FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [user.role_id]
    );
    permissions = perms.map(p => p.name);
  }

  const userData = {
    id: user.id,
    clinic_id: user.clinic_id || 1,
    is_superadmin: Boolean(user.is_superadmin || user.email === 'admin@psicogestao.com.br' || user.email === 'sergio@psicogestao.com.br'),
    name: user.name,
    email: user.email,
    role: user.role,
    role_id: user.role_id,
    crp_number: user.crp_number,
    status: user.status,
    token_version: user.token_version || 1,
    permissions,
  };

  const token = generateToken(userData);
  recordAuditLog(req, 'LOGIN', 'AUTH', `Login realizado com sucesso como ${user.role}`);

  res.json({
    token,
    user: userData,
  });
});

router.get('/auth/me', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// Demo accounts endpoint for rapid evaluation in preview (desabilitado em produção)
router.get('/auth/demo-users', (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint indisponível em ambiente de produção.' });
  }
  const users = queryAll<any>(
    'SELECT id, name, email, role, crp_number, status FROM users ORDER BY id ASC'
  );
  res.json({ users });
});

// Solicitação de redefinição de senha (Esqueci minha senha)
const forgotPasswordSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
});

router.post('/auth/forgot-password', authRateLimiter, async (req: AuthRequest, res: Response) => {
  const parse = forgotPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message || 'E-mail inválido' });
  }

  const { email } = parse.data;
  const genericSuccessMessage =
    'Se este e-mail estiver cadastrado em nossa clínica, as instruções e o link seguro para redefinir sua senha foram enviados.';

  try {
    const user = queryOne<any>(
      'SELECT id, name, email, status FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    let emailPreview = null;

    if (user && user.status !== 'BLOCKED') {
      // Invalida tokens de reset anteriores não utilizados
      execute(
        `DELETE FROM auth_tokens WHERE user_id = ? AND token_type = 'RESET' AND used_at IS NULL`,
        [user.id]
      );

      // Gera novo token criptográfico de 64 caracteres hex (32 bytes)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

      execute(
        `INSERT INTO auth_tokens (user_id, token, token_type, expires_at) VALUES (?, ?, 'RESET', ?)`,
        [user.id, token, expiresAt]
      );

      recordAuditLog(req, 'REQUEST_PASSWORD_RESET', `USER #${user.id}`, `Solicitação de redefinição de senha para ${user.email}`);

      // Dispara o e-mail (e grava no buffer de preview)
      emailPreview = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token,
      });
    }

    res.json({
      success: true,
      message: genericSuccessMessage,
      ...(process.env.NODE_ENV !== 'production' ? { emailPreview } : {}),
    });
  } catch (err) {
    console.error('Error in forgot-password:', err);
    res.json({ success: true, message: genericSuccessMessage });
  }
});

// Verificação de token de acesso (para 1º acesso ou redefinição)
router.get('/auth/verify-token', (req: AuthRequest, res: Response) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ valid: false, code: 'MISSING_TOKEN', error: 'Token de autenticação não fornecido' });
  }

  const tokenRow = queryOne<any>(
    `SELECT t.id, t.user_id, t.token, t.token_type, t.expires_at, t.used_at,
            u.name, u.email, u.status as user_status, r.name as role_name
     FROM auth_tokens t
     JOIN users u ON t.user_id = u.id
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE t.token = ?`,
    [token]
  );

  if (!tokenRow) {
    return res.status(404).json({
      valid: false,
      code: 'NOT_FOUND',
      error: 'Link de acesso não encontrado ou inválido. Verifique o link recebido por e-mail.',
    });
  }

  if (tokenRow.used_at) {
    return res.status(400).json({
      valid: false,
      code: 'ALREADY_USED',
      error: 'Este link de acesso já foi utilizado anteriormente para definir a senha.',
      tokenType: tokenRow.token_type,
    });
  }

  const expiresTime = new Date(tokenRow.expires_at).getTime();
  if (expiresTime < Date.now()) {
    return res.status(400).json({
      valid: false,
      code: 'EXPIRED',
      error: 'Este link de acesso expirou. Por motivos de segurança, solicite um novo link.',
      tokenType: tokenRow.token_type,
    });
  }

  if (tokenRow.user_status === 'BLOCKED') {
    return res.status(403).json({
      valid: false,
      code: 'BLOCKED',
      error: 'Esta conta de usuário está suspensa pela administração da clínica.',
    });
  }

  res.json({
    valid: true,
    tokenType: tokenRow.token_type,
    user: {
      name: tokenRow.name,
      email: tokenRow.email,
      role_name: tokenRow.role_name || 'Colaborador',
    },
  });
});

// Definição e gravação da senha (1º Acesso ou Redefinição)
const setPasswordSchema = z.object({
  token: z.string().min(10, 'Token inválido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'A confirmação de senha não confere',
  path: ['confirmPassword'],
});

router.post('/auth/set-password', authRateLimiter, async (req: AuthRequest, res: Response) => {
  const parse = setPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
  }

  const { token, password } = parse.data;

  // Validação estrita dos 4 critérios da política de segurança
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
    return res.status(400).json({
      error: 'A senha não atende aos requisitos de segurança: mínimo 8 dígitos, letra maiúscula, letra minúscula, número e caractere especial.',
    });
  }

  const tokenRow = queryOne<any>(
    `SELECT t.id, t.user_id, t.token_type, t.expires_at, t.used_at, u.name, u.email, u.token_version
     FROM auth_tokens t
     JOIN users u ON t.user_id = u.id
     WHERE t.token = ?`,
    [token]
  );

  if (!tokenRow) {
    return res.status(404).json({ error: 'Link de acesso inválido ou expirado.' });
  }

  if (tokenRow.used_at) {
    return res.status(400).json({ error: 'Este link já foi utilizado para definir a senha.' });
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Este link de acesso expirou. Solicite um novo link.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Atualiza usuário: define senha, ativa conta, reseta falhas e incrementa versão de token
    execute(
      `UPDATE users 
       SET password_hash = ?, status = 'ACTIVE', failed_login_attempts = 0, locked_until = NULL, token_version = token_version + 1 
       WHERE id = ?`,
      [passwordHash, tokenRow.user_id]
    );

    // Marca o token como consumido
    execute(
      `UPDATE auth_tokens SET used_at = ? WHERE id = ?`,
      [now, tokenRow.id]
    );

    recordAuditLog(
      req,
      tokenRow.token_type === 'INVITE' ? 'ACTIVATE_ACCOUNT_FIRST_ACCESS' : 'PASSWORD_RESET_SUCCESS',
      `USER #${tokenRow.user_id}`,
      `Senha ${tokenRow.token_type === 'INVITE' ? 'criada no 1º acesso' : 'redefinida com sucesso'} para ${tokenRow.email}`
    );

    res.json({
      success: true,
      message: tokenRow.token_type === 'INVITE' 
        ? 'Sua conta foi ativada e sua senha cadastrada com sucesso! Faça login para começar.'
        : 'Sua nova senha foi redefinida com sucesso! Você já pode entrar com suas credenciais.',
    });
  } catch (err) {
    console.error('Error setting password:', err);
    res.status(500).json({ error: 'Erro ao salvar nova senha' });
  }
});

// Endpoint para visualização do último e-mail transacional (simulador de desenvolvimento - desabilitado em produção)
router.get('/auth/latest-email-preview', (req: AuthRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint indisponível em ambiente de produção.' });
  }
  const email = req.query.email ? String(req.query.email) : undefined;
  const latest = getLatestEmail(email) || getAllRecentEmails()[0] || null;
  res.json({ emailPreview: latest });
});

// ==========================================
// 2. PACIENTES (RBAC: Todos autenticados podem ver dados cadastrais básicos)
// ==========================================

export function canUserViewFinancial(user: any): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || user.role_id === 1 || Boolean(user.permissions?.includes('view_financial'));
}

// Helper to parse patient row with JSON sub-structures
function parsePatientRow(p: any, canViewFinancial: boolean = true) {
  let address = undefined;
  if (p.address_json) {
    try {
      address = typeof p.address_json === 'string' ? JSON.parse(p.address_json) : p.address_json;
    } catch {
      address = undefined;
    }
  }

  let emergency_contacts = [];
  if (p.emergency_contacts_json) {
    try {
      emergency_contacts = typeof p.emergency_contacts_json === 'string'
        ? JSON.parse(p.emergency_contacts_json)
        : p.emergency_contacts_json;
    } catch {
      emergency_contacts = [];
    }
  }

  let guardian = undefined;
  if (p.guardian_json) {
    try {
      guardian = typeof p.guardian_json === 'string' ? JSON.parse(p.guardian_json) : p.guardian_json;
    } catch {
      guardian = undefined;
    }
  }

  let financial_responsible = undefined;
  if (p.financial_responsible_json) {
    try {
      financial_responsible = typeof p.financial_responsible_json === 'string'
        ? JSON.parse(p.financial_responsible_json)
        : p.financial_responsible_json;
    } catch {
      financial_responsible = undefined;
    }
  }

  let whatsapp_routing = undefined;
  if (p.whatsapp_routing_json) {
    try {
      whatsapp_routing = typeof p.whatsapp_routing_json === 'string'
        ? JSON.parse(p.whatsapp_routing_json)
        : p.whatsapp_routing_json;
    } catch {
      whatsapp_routing = undefined;
    }
  }

  // Fallback inteligente para pacientes antigos sem preferência explícita salva
  if (!whatsapp_routing) {
    const isMinor = p.group_type === 'Criança' || p.group_type === 'Adolescente';
    const hasGuardianPhone = Boolean(guardian && guardian.phone && guardian.phone.trim());
    whatsapp_routing = {
      appointmentChannel: isMinor && hasGuardianPhone ? 'GUARDIAN' : 'PATIENT',
      financialChannel: isMinor && hasGuardianPhone ? 'GUARDIAN' : 'PATIENT',
    };
  }

  return {
    id: p.id,
    psychologist_id: p.psychologist_id,
    full_name: p.full_name,
    cpf: p.cpf,
    phone: p.phone,
    status: p.status,
    lgpd_consent_at: p.lgpd_consent_at,
    birth_date: p.birth_date,
    email: p.email,
    notes_basic: p.notes_basic,
    created_at: p.created_at,
    psychologist_name: p.psychologist_name,
    // 1) Dados Cadastrais
    group: p.group_type || 'Adulto',
    rg: p.rg || '',
    gender: p.gender || '',
    // 2) Plano Financeiro (Mascarado/Blindado se !canViewFinancial)
    financial_plan_type: canViewFinancial ? (p.financial_plan_type || 'Por Sessão') : null,
    session_price: canViewFinancial
      ? (p.session_price !== null && p.session_price !== undefined ? Number(p.session_price) : 180)
      : null,
    financial_responsible: canViewFinancial ? financial_responsible : null,
    // 3) Endereço
    address,
    // 4) Contatos de Emergência
    emergency_contacts,
    // 5) Dados Adicionais
    birthplace: p.birthplace || '',
    education: p.education || '',
    race: p.race || '',
    profession: p.profession || '',
    // 6) Dados do Responsável
    guardian,
    // 7) Comunicação e Roteamento WhatsApp
    whatsapp_routing,
    // 8) Synapsis Paciente (Portal e Mensagens)
    psychologist_chat_override: p.psychologist_chat_override || null,
    portal_access_enabled: p.portal_access_enabled === undefined || p.portal_access_enabled === null || p.portal_access_enabled === 1,
    portal_invite_token: p.portal_invite_token || null,
    portal_invite_sent_at: p.portal_invite_sent_at || null,
    portal_invite_expires_at: p.portal_invite_expires_at || null,
    portal_first_access_at: p.portal_first_access_at || null,
    portal_last_login_at: p.portal_last_login_at || null,
  };
}

router.get('/patients', authenticateToken, (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinic_id || 1;
  const search = req.query.search ? String(req.query.search).trim() : '';
  const status = req.query.status ? String(req.query.status).trim() : '';
  const group = req.query.group ? String(req.query.group).trim() : '';

  let sql = `
    SELECT p.*, u.name as psychologist_name, c.last_login_at as portal_last_login_at
    FROM patients p
    LEFT JOIN users u ON p.psychologist_id = u.id
    LEFT JOIN patient_credentials c ON c.patient_id = p.id
    WHERE (p.clinic_id = ? OR (p.clinic_id IS NULL AND ? = 1))
  `;
  const params: any[] = [clinicId, clinicId];

  if (search) {
    sql += ` AND (p.full_name LIKE ? OR p.cpf LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status && status !== 'ALL') {
    sql += ` AND p.status = ?`;
    params.push(status);
  }

  if (group && group !== 'ALL') {
    sql += ` AND p.group_type = ?`;
    params.push(group);
  }

  sql += ` ORDER BY p.full_name ASC`;
  const canViewFin = canUserViewFinancial(req.user);
  const rows = queryAll(sql, params);
  const patients = rows.map((r: any) => parsePatientRow(r, canViewFin));

  recordAuditLog(req, 'READ_PATIENT_LIST', 'PATIENTS', `Busca de pacientes (Filtro: ${search || 'Nenhum'}, Status: ${status || 'Todos'}, Grupo: ${group || 'Todos'})`);
  res.json({ patients });
});

router.get('/patients/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const patientId = Number(req.params.id);
  const row = queryOne(
    `SELECT p.*, u.name as psychologist_name, c.last_login_at as portal_last_login_at
     FROM patients p
     LEFT JOIN users u ON p.psychologist_id = u.id
     LEFT JOIN patient_credentials c ON c.patient_id = p.id
     WHERE p.id = ?`,
    [patientId]
  );

  if (!row) {
    res.status(404).json({ error: 'Paciente não encontrado' });
    return;
  }

  const canViewFin = canUserViewFinancial(req.user);
  res.json({ patient: parsePatientRow(row, canViewFin) });
});

router.get('/patients/:id/indicators', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const patientId = Number(req.params.id);
    const patient = queryOne('SELECT * FROM patients WHERE id = ?', [patientId]);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    // 1. Attendance & Sessions KPIs
    const allSessions = queryAll<any>(
      `SELECT s.*, u.name as psychologist_name
       FROM sessions s
       LEFT JOIN users u ON s.psychologist_id = u.id
       WHERE s.patient_id = ?
       ORDER BY s.start_time DESC`,
      [patientId]
    );

    const now = new Date().toISOString();
    let completedCount = 0;
    let scheduledUpcomingCount = 0;
    let noShowCount = 0;
    let canceledCount = 0;
    let nextSession: any = null;

    for (const s of allSessions) {
      if (s.status === 'COMPLETED' || (s.status === 'CONFIRMED' && s.start_time < now)) {
        completedCount++;
      } else if (s.status === 'NO_SHOW') {
        noShowCount++;
      } else if (s.status === 'CANCELED') {
        canceledCount++;
      } else if (s.start_time >= now && s.status !== 'CANCELED') {
        scheduledUpcomingCount++;
        if (!nextSession || s.start_time < nextSession.start_time) {
          nextSession = s;
        }
      }
    }

    const totalSessionsHeld = completedCount + noShowCount;
    const attendanceRate = totalSessionsHeld > 0 
      ? Math.round((completedCount / totalSessionsHeld) * 100) 
      : 100;

    const recentSessions = allSessions.slice(0, 3).map(s => ({
      id: s.id,
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
      modality: s.modality,
      price: s.price,
      psychologist_name: s.psychologist_name
    }));

    // 2. Financial KPIs (Check user permissions)
    const canViewFinancial = req.user?.role === 'ADMIN' || 
                             req.user?.role === 'SECRETARY' || 
                             Boolean(req.user?.permissions?.includes('view_financial'));

    let financial: any = null;
    if (canViewFinancial) {
      const transactions = queryAll<any>(
        `SELECT * FROM financial_transactions WHERE patient_id = ?`,
        [patientId]
      );
      
      let totalPaid = 0;
      let totalPending = 0;
      let pendingCount = 0;

      for (const t of transactions) {
        const amt = Number(t.amount || 0);
        if (t.status === 'PAID') {
          totalPaid += amt;
        } else if (t.status === 'PENDING') {
          totalPending += amt;
          pendingCount++;
        }
      }

      const patientInvoices = queryAll<any>(
        `SELECT status, count(*) as count FROM invoices WHERE patient_id = ? GROUP BY status`,
        [patientId]
      );
      const invoiceStatusSummary = {
        total: patientInvoices.reduce((sum, r) => sum + Number(r.count), 0),
        issued: Number(patientInvoices.find(r => r.status === 'ISSUED')?.count || 0),
        requested: Number(patientInvoices.find(r => r.status === 'REQUESTED')?.count || 0),
        pending_dispatch: Number(patientInvoices.find(r => r.status === 'PENDING_DISPATCH')?.count || 0),
      };

      financial = {
        totalPaid,
        totalPending,
        pendingCount,
        invoiceStatusSummary,
      };
    }

    res.json({
      attendance: {
        totalCompleted: completedCount,
        totalScheduled: scheduledUpcomingCount,
        totalNoShow: noShowCount,
        totalCanceled: canceledCount,
        attendanceRate,
        nextSession: nextSession ? {
          id: nextSession.id,
          start_time: nextSession.start_time,
          end_time: nextSession.end_time,
          modality: nextSession.modality,
          status: nextSession.status,
          psychologist_name: nextSession.psychologist_name
        } : null,
        recentSessions
      },
      financial,
      canViewFinancial
    });
  } catch (err) {
    console.error('Error fetching patient indicators:', err);
    res.status(500).json({ error: 'Erro ao carregar indicadores do paciente' });
  }
});

const strOrEmpty = z.string().nullish().transform(v => (v ? String(v).trim() : ''));

const emergencyContactSchema = z.object({
  fullName: strOrEmpty,
  relationship: strOrEmpty,
  phone: strOrEmpty,
});

const addressSchema = z.object({
  cep: strOrEmpty,
  street: strOrEmpty,
  number: strOrEmpty,
  complement: strOrEmpty,
  neighborhood: strOrEmpty,
  city: strOrEmpty,
  state: strOrEmpty,
}).nullish();

const guardianSchema = z.object({
  fullName: strOrEmpty,
  relationship: strOrEmpty,
  email: strOrEmpty,
  phone: strOrEmpty,
  cpf: strOrEmpty,
  rg: strOrEmpty,
  birthDate: strOrEmpty,
}).nullish();

const financialResponsibleSchema = z.object({
  isSameAsGuardian: z.boolean().nullish(),
  fullName: strOrEmpty,
  relationship: strOrEmpty,
  phone: strOrEmpty,
  cpf: strOrEmpty,
  email: strOrEmpty,
  notes: strOrEmpty,
}).nullish();

const whatsappRoutingSchema = z.object({
  appointmentChannel: z.enum(['PATIENT', 'GUARDIAN']).nullish().transform(v => v || 'PATIENT'),
  financialChannel: z.enum(['PATIENT', 'GUARDIAN', 'FINANCIAL_RESPONSIBLE']).nullish().transform(v => v || 'PATIENT'),
}).nullish();

const patientPayloadSchema = z.object({
  // 1) Dados Cadastrais
  full_name: z.string().min(3, 'Nome Completo é obrigatório (mínimo 3 caracteres)'),
  group: z.enum(['Criança', 'Adolescente', 'Adulto', 'Idoso'], {
    message: 'Grupo é obrigatório (Criança, Adolescente, Adulto ou Idoso)',
  }),
  birth_date: strOrEmpty,
  email: strOrEmpty,
  phone: strOrEmpty,
  cpf: strOrEmpty,
  rg: strOrEmpty,
  gender: strOrEmpty,

  // 2) Plano Financeiro
  financial_plan_type: z.enum(['Por Sessão', 'Mensal', 'Convênio', 'Isento']).nullish().transform(v => v || 'Por Sessão'),
  session_price: z.number().nullish().transform(v => (v !== null && v !== undefined ? Number(v) : 180)),
  financial_responsible: financialResponsibleSchema,

  // 3) Endereço
  address: addressSchema,

  // 4) Contatos de Emergência
  emergency_contacts: z.array(emergencyContactSchema).nullish().transform(v => v || []),

  // 5) Dados Adicionais
  birthplace: strOrEmpty,
  education: strOrEmpty,
  race: strOrEmpty,
  profession: strOrEmpty,

  // 6) Dados do Responsável
  guardian: guardianSchema,

  // 7) Comunicação e Roteamento WhatsApp
  whatsapp_routing: whatsappRoutingSchema,

  // Outros
  notes_basic: strOrEmpty,
  psychologist_id: z.number().nullish(),
});

router.post('/patients', authenticateToken, (req: AuthRequest, res: Response) => {
  const canCreatePatients = req.user?.role === 'ADMIN' || req.user?.role_id === 1 || Boolean(req.user?.permissions?.includes('create_patients'));
  if (!canCreatePatients) {
    return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para cadastrar novos pacientes nesta clínica.' });
  }

  const parse = patientPayloadSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  const data = parse.data;

  // Validação estrita do CPF do Paciente somente se preenchido
  if (data.cpf && data.cpf.trim() && !isValidCPF(data.cpf)) {
    res.status(400).json({ error: 'O CPF informado do paciente é inválido. Verifique os dígitos.' });
    return;
  }

  // Se houver CPF do responsável preenchido, validar também
  if (data.guardian?.cpf && data.guardian.cpf.trim() && !isValidCPF(data.guardian.cpf)) {
    res.status(400).json({ error: 'O CPF informado para o responsável é inválido. Verifique os dígitos.' });
    return;
  }

  const psychId = data.psychologist_id || (req.user?.role === 'PSYCHOLOGIST' ? req.user.id : 1);
  const lgpdConsent = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const canViewFin = canUserViewFinancial(req.user);
  let effectiveSessionPrice = data.session_price;
  let effectivePlanType = data.financial_plan_type;
  let effectiveFinancialResp = data.financial_responsible;
  if (!canViewFin) {
    const clinicSettingsRow = queryOne<any>('SELECT default_session_price FROM clinic_settings WHERE id = 1');
    effectiveSessionPrice = clinicSettingsRow?.default_session_price !== null && clinicSettingsRow?.default_session_price !== undefined
      ? Number(clinicSettingsRow.default_session_price)
      : 180.00;
    effectivePlanType = 'Por Sessão';
    effectiveFinancialResp = null;
  }

  const clinicId = req.user?.clinic_id || 1;

  try {
    const result = execute(
      `INSERT INTO patients (
        clinic_id, psychologist_id, full_name, cpf, phone, status, lgpd_consent_at, birth_date, email, notes_basic,
        group_type, rg, gender, financial_plan_type, session_price, address_json, emergency_contacts_json,
        birthplace, education, race, profession, guardian_json, financial_responsible_json, whatsapp_routing_json
      ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clinicId,
        psychId,
        data.full_name.trim(),
        data.cpf?.trim() || null,
        data.phone?.trim() || null,
        lgpdConsent,
        data.birth_date || null,
        data.email?.trim() || null,
        data.notes_basic || '',
        data.group,
        data.rg?.trim() || null,
        data.gender || null,
        effectivePlanType,
        effectiveSessionPrice,
        data.address && Object.values(data.address).some(v => Boolean(v)) ? JSON.stringify(data.address) : null,
        data.emergency_contacts && data.emergency_contacts.length > 0 ? JSON.stringify(data.emergency_contacts) : null,
        data.birthplace?.trim() || null,
        data.education || null,
        data.race || null,
        data.profession?.trim() || null,
        data.guardian && (data.guardian.fullName || data.guardian.phone || data.guardian.cpf)
          ? JSON.stringify(data.guardian)
          : null,
        effectiveFinancialResp && (effectiveFinancialResp.fullName || effectiveFinancialResp.phone || effectiveFinancialResp.isSameAsGuardian)
          ? JSON.stringify(effectiveFinancialResp)
          : null,
        data.whatsapp_routing ? JSON.stringify(data.whatsapp_routing) : null,
      ]
    );

    const inserted = queryOne<any>(
      `SELECT p.*, u.name as psychologist_name
       FROM patients p
       LEFT JOIN users u ON p.psychologist_id = u.id
       WHERE p.id = ?`,
      [result.lastInsertRowid]
    );

    recordAuditLog(req, 'CREATE_PATIENT', `PATIENT #${result.lastInsertRowid}`, `Paciente ${data.full_name} (${data.group}) cadastrado com 6 estruturas completas e termo LGPD`);
    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Paciente cadastrado com sucesso',
      patient: parsePatientRow(inserted, canViewFin),
    });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Já existe um paciente cadastrado com este CPF.' });
      return;
    }
    console.error('Error creating patient:', err);
    res.status(500).json({ error: 'Erro ao cadastrar paciente' });
  }
});

router.post('/patients/bulk', authenticateToken, (req: AuthRequest, res: Response) => {
  const patients = req.body;
  if (!Array.isArray(patients)) {
    return res.status(400).json({ error: 'Formato inválido. Esperado um array de pacientes.' });
  }

  const psychId = req.user?.role === 'PSYCHOLOGIST' ? req.user.id : 1;
  const lgpdConsent = new Date().toISOString().replace('T', ' ').substring(0, 19);

  let successCount = 0;
  let errorCount = 0;
  let errors: string[] = [];

  for (const data of patients) {
    if (!data.full_name || !data.full_name.trim()) {
      errorCount++;
      errors.push(`Linha com paciente sem nome ignorada.`);
      continue;
    }

    try {
      execute(
        `INSERT INTO patients (
          psychologist_id, full_name, cpf, phone, status, lgpd_consent_at, birth_date, email,
          group_type, financial_plan_type, session_price
        ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 'Adulto', 'Por Sessão', 180.00)`,
        [
          psychId,
          data.full_name.trim(),
          data.cpf?.trim() || null,
          data.phone?.trim() || null,
          lgpdConsent,
          data.birth_date || null,
          data.email?.trim() || null
        ]
      );
      successCount++;
    } catch (err: any) {
      errorCount++;
      if (err.message && err.message.includes('UNIQUE')) {
        errors.push(`CPF ${data.cpf} já cadastrado (Paciente: ${data.full_name}).`);
      } else {
        errors.push(`Erro ao importar ${data.full_name}.`);
      }
    }
  }

  recordAuditLog(req, 'BULK_IMPORT_PATIENTS', 'MULTIPLE_PATIENTS', `Importou ${successCount} pacientes em lote`);
  res.json({ success: true, imported: successCount, failed: errorCount, errors });
});

// Cadastro rápido de paciente pelo Novo Agendamento (apenas Nome completo e Celular/WhatsApp e Valor)
const quickPatientSchema = z.object({
  full_name: z.string().min(3, 'Nome Completo é obrigatório (mínimo 3 caracteres)'),
  phone: z.string().min(8, 'Celular/WhatsApp é obrigatório'),
  session_price: z.number().optional().default(180.00)
});

router.post('/patients/quick', authenticateToken, (req: AuthRequest, res: Response) => {
  const canCreatePatients = req.user?.role === 'ADMIN' || req.user?.role_id === 1 || Boolean(req.user?.permissions?.includes('create_patients'));
  if (!canCreatePatients) {
    return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para cadastrar novos pacientes nesta clínica.' });
  }

  const parse = quickPatientSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  const { full_name, phone, session_price } = parse.data;
  const psychId = req.user?.role === 'PSYCHOLOGIST' ? req.user.id : 1;
  const lgpdConsent = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const canViewFin = canUserViewFinancial(req.user);
  let effectivePrice = session_price;
  if (!canViewFin) {
    const clinicSettingsRow = queryOne<any>('SELECT default_session_price FROM clinic_settings WHERE id = 1');
    effectivePrice = clinicSettingsRow?.default_session_price !== null && clinicSettingsRow?.default_session_price !== undefined
      ? Number(clinicSettingsRow.default_session_price)
      : 180.00;
  }

  try {
    const result = execute(
      `INSERT INTO patients (
        psychologist_id, full_name, cpf, phone, status, lgpd_consent_at, group_type,
        financial_plan_type, session_price
      ) VALUES (?, ?, NULL, ?, 'ACTIVE', ?, 'Adulto', 'Por Sessão', ?)`,
      [psychId, full_name.trim(), phone.trim(), lgpdConsent, effectivePrice]
    );

    const inserted = queryOne<any>(`SELECT * FROM patients WHERE id = ?`, [result.lastInsertRowid]);
    const parsedPatient = parsePatientRow(inserted, canViewFin);

    recordAuditLog(
      req,
      'CREATE_PATIENT_QUICK',
      `PATIENT #${result.lastInsertRowid}`,
      `Cadastro rápido de paciente "${full_name.trim()}" (Celular: ${phone.trim()}) criado via Novo Agendamento`
    );

    res.status(201).json({
      message: 'Novo paciente cadastrado com sucesso e incluído na lista geral.',
      patient: parsedPatient,
    });
  } catch (err: any) {
    console.error('Failed to quick-create patient:', err);
    res.status(500).json({ error: 'Erro interno ao realizar cadastro rápido do paciente' });
  }
});

router.put('/patients/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const patientId = Number(req.params.id);
  const existing = queryOne('SELECT id FROM patients WHERE id = ?', [patientId]);
  if (!existing) {
    res.status(404).json({ error: 'Paciente não encontrado' });
    return;
  }

  const parse = patientPayloadSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  const data = parse.data;

  // Validação estrita do CPF do Paciente somente se preenchido
  if (data.cpf && data.cpf.trim()) {
    if (!isValidCPF(data.cpf)) {
      res.status(400).json({ error: 'O CPF informado do paciente é inválido. Verifique os dígitos.' });
      return;
    }

    // Verifica se outro paciente já usa este CPF
    const dupCheck = queryOne('SELECT id FROM patients WHERE cpf = ? AND id != ?', [data.cpf.trim(), patientId]);
    if (dupCheck) {
      res.status(400).json({ error: 'Já existe outro paciente cadastrado com este CPF.' });
      return;
    }
  }

  // Se houver CPF do responsável preenchido, validar também
  if (data.guardian?.cpf && data.guardian.cpf.trim() && !isValidCPF(data.guardian.cpf)) {
    res.status(400).json({ error: 'O CPF informado para o responsável é inválido. Verifique os dígitos.' });
    return;
  }

  const canViewFin = canUserViewFinancial(req.user);
  let effectivePlanType = data.financial_plan_type;
  let effectiveSessionPrice = data.session_price;
  let effectiveFinancialResp = data.financial_responsible && (data.financial_responsible.fullName || data.financial_responsible.phone || data.financial_responsible.isSameAsGuardian)
    ? JSON.stringify(data.financial_responsible)
    : null;

  if (!canViewFin) {
    const existingFin = queryOne<any>('SELECT financial_plan_type, session_price, financial_responsible_json FROM patients WHERE id = ?', [patientId]);
    if (existingFin) {
      effectivePlanType = existingFin.financial_plan_type;
      effectiveSessionPrice = existingFin.session_price;
      effectiveFinancialResp = existingFin.financial_responsible_json;
    }
  }

  try {
    execute(
      `UPDATE patients SET
        full_name = ?,
        cpf = ?,
        phone = ?,
        birth_date = ?,
        email = ?,
        notes_basic = ?,
        group_type = ?,
        rg = ?,
        gender = ?,
        financial_plan_type = ?,
        session_price = ?,
        address_json = ?,
        emergency_contacts_json = ?,
        birthplace = ?,
        education = ?,
        race = ?,
        profession = ?,
        guardian_json = ?,
        financial_responsible_json = ?,
        whatsapp_routing_json = ?
      WHERE id = ?`,
      [
        data.full_name.trim(),
        data.cpf ? data.cpf.trim() : null,
        data.phone ? data.phone.trim() : null,
        data.birth_date || null,
        data.email ? data.email.trim() : null,
        data.notes_basic || '',
        data.group,
        data.rg ? data.rg.trim() : null,
        data.gender || null,
        effectivePlanType,
        effectiveSessionPrice,
        data.address && Object.values(data.address).some(v => Boolean(v)) ? JSON.stringify(data.address) : null,
        data.emergency_contacts && data.emergency_contacts.length > 0 ? JSON.stringify(data.emergency_contacts) : null,
        data.birthplace ? data.birthplace.trim() : null,
        data.education || null,
        data.race || null,
        data.profession ? data.profession.trim() : null,
        data.guardian && (data.guardian.fullName || data.guardian.phone || data.guardian.cpf)
          ? JSON.stringify(data.guardian)
          : null,
        effectiveFinancialResp,
        data.whatsapp_routing ? JSON.stringify(data.whatsapp_routing) : null,
        patientId,
      ]
    );

    const updated = queryOne<any>(
      `SELECT p.*, u.name as psychologist_name
       FROM patients p
       LEFT JOIN users u ON p.psychologist_id = u.id
       WHERE p.id = ?`,
      [patientId]
    );

    recordAuditLog(req, 'UPDATE_PATIENT', `PATIENT #${patientId}`, `Cadastro do paciente ${data.full_name} atualizado`);
    res.json({
      message: 'Dados cadastrais do paciente atualizados com sucesso',
      patient: parsePatientRow(updated, canViewFin),
    });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Já existe outro paciente cadastrado com este CPF.' });
      return;
    }
    console.error('Error updating patient:', err);
    res.status(500).json({ error: 'Erro ao atualizar dados do paciente' });
  }
});

// ==========================================
// 3. SESSÕES & AGENDA
// ==========================================
router.get('/sessions', authenticateToken, (req: AuthRequest, res: Response) => {
  const { date, psychologist_id, status, patient_id, start_date, end_date, room_id } = req.query;
  
  // ABAC logic
  const isPsychologist = req.user?.role_id === 2 || req.user?.role === 'PSICOLOGO';
  const hasManageUsers = req.user?.permissions?.includes('manage_users');
  
  let targetPsychologistId = psychologist_id;
  // Se for psicólogo (e não for admin com manage_users), fixa a busca apenas no próprio ID
  if (isPsychologist && !hasManageUsers) {
    targetPsychologistId = String(req.user?.id);
  }

  let sql = `
    SELECT s.id, s.psychologist_id, s.patient_id, s.start_time, s.end_time, 
           s.status, s.modality, s.price, s.notes,
           s.recurrence_group_id, s.recurrence_pattern,
           s.evaluation_id, s.session_type,
           s.room_id, COALESCE(r.name, s.room_name) as room_name, s.presence_status,
           r.color_code as room_color, r.room_type, r.initials as room_initials,
           s.video_provider, s.video_room_id, s.video_external_url, s.video_status,
           s.video_started_at, s.video_ended_at, s.patient_joined_at, s.patient_tcle_accepted_at,
           s.patient_access_token,
           p.full_name as patient_name, p.phone as patient_phone, p.cpf as patient_cpf,
           u.name as psychologist_name, u.crp_number as psychologist_crp, u.epsi_code as psychologist_epsi,
           COALESCE(ft.status, 'PENDING') as payment_status
    FROM sessions s
    JOIN patients p ON s.patient_id = p.id
    JOIN users u ON s.psychologist_id = u.id
    LEFT JOIN rooms r ON s.room_id = r.id
    LEFT JOIN financial_transactions ft ON ft.session_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (targetPsychologistId) {
    sql += ` AND s.psychologist_id = ?`;
    params.push(targetPsychologistId);
  }

  if (room_id && room_id !== 'ALL') {
    sql += ` AND s.room_id = ?`;
    params.push(Number(room_id));
  }

  if (date) {
    sql += ` AND s.start_time LIKE ?`;
    params.push(`${date}%`);
  } else if (start_date && end_date) {
    sql += ` AND s.start_time >= ? AND s.start_time <= ?`;
    params.push(`${start_date}T00:00:00`, `${end_date}T23:59:59`);
  }

  if (status && status !== 'ALL') {
    sql += ` AND s.status = ?`;
    params.push(status);
  }

  if (patient_id) {
    sql += ` AND s.patient_id = ?`;
    params.push(patient_id);
  }

  sql += ` ORDER BY s.start_time ASC`;
  const canViewFin = canUserViewFinancial(req.user);
  const rawSessions = queryAll<any>(sql, params);
  const sessions = rawSessions.map((s: any) => ({
    ...s,
    price: canViewFin ? (s.price !== null && s.price !== undefined ? Number(s.price) : 0) : null,
    payment_status: canViewFin ? s.payment_status : null,
  }));
  res.json({ sessions });
});

const sessionCreateSchema = z.object({
  patient_id: z.number(),
  psychologist_id: z.number().optional(),
  start_time: z.string(),
  end_time: z.string(),
  modality: z.enum(['ONLINE', 'PRESENTIAL']).default('PRESENTIAL'),
  price: z.number().default(180),
  notes: z.string().optional(),
  evaluation_id: z.number().nullable().optional(),
  session_type: z.enum(['PSYCHOTHERAPY', 'EVALUATION']).optional().default('PSYCHOTHERAPY'),
  room_id: z.number().nullable().optional(),
  room_name: z.string().nullable().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
  recurrence_end_type: z.enum(['NEVER', 'COUNT', 'DATE']).optional(),
  recurrence_count: z.number().min(1).max(52).optional(),
  recurrence_end_date: z.string().optional(),
  reallocate_from_session_id: z.number().nullable().optional(),
});

function computeRecurrenceDates(
  startTimeStr: string,
  endTimeStr: string,
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
  endType: 'NEVER' | 'COUNT' | 'DATE',
  countOpt?: number,
  endDateOpt?: string
): Array<{ start_time: string; end_time: string }> {
  const occurrences: Array<{ start_time: string; end_time: string }> = [];

  const firstStart = new Date(startTimeStr);
  const firstEnd = new Date(endTimeStr);
  const durationMs = firstEnd.getTime() - firstStart.getTime();

  let maxItems = 26; // Default safe cap for 'NEVER' (approx 6 months weekly)
  if (endType === 'COUNT') {
    maxItems = Math.min(countOpt || 8, 52);
  }

  let limitDate: Date | null = null;
  if (endType === 'DATE' && endDateOpt) {
    limitDate = new Date(`${endDateOpt}T23:59:59`);
  }

  let currStart = new Date(firstStart);

  while (occurrences.length < maxItems) {
    if (limitDate && currStart > limitDate) {
      break;
    }

    const currEnd = new Date(currStart.getTime() + durationMs);

    // Format ISO string YYYY-MM-DDTHH:mm:ss
    const pad = (n: number) => String(n).padStart(2, '0');
    const startStr = `${currStart.getFullYear()}-${pad(currStart.getMonth() + 1)}-${pad(currStart.getDate())}T${pad(currStart.getHours())}:${pad(currStart.getMinutes())}:00`;
    const endStr = `${currEnd.getFullYear()}-${pad(currEnd.getMonth() + 1)}-${pad(currEnd.getDate())}T${pad(currEnd.getHours())}:${pad(currEnd.getMinutes())}:00`;

    occurrences.push({ start_time: startStr, end_time: endStr });

    // Step to next occurrence
    const nextStart = new Date(currStart);
    if (frequency === 'WEEKLY') {
      nextStart.setDate(nextStart.getDate() + 7);
    } else if (frequency === 'BIWEEKLY') {
      nextStart.setDate(nextStart.getDate() + 14);
    } else if (frequency === 'MONTHLY') {
      nextStart.setMonth(nextStart.getMonth() + 1);
    }
    currStart = nextStart;
  }

  return occurrences;
}

// Endpoint to preview recurrence dates and detect schedule conflicts
router.post('/sessions/preview-recurrence', authenticateToken, (req: AuthRequest, res: Response) => {
  const { start_time, end_time, recurrence_frequency, recurrence_end_type, recurrence_count, recurrence_end_date } = req.body;
  if (!start_time || !end_time) {
    res.status(400).json({ error: 'Horários inicial e final são obrigatórios' });
    return;
  }

  const freq = recurrence_frequency || 'WEEKLY';
  const endT = recurrence_end_type || 'COUNT';
  const occurrences = computeRecurrenceDates(start_time, end_time, freq, endT, recurrence_count, recurrence_end_date);

  // Check conflicts with existing sessions or holidays
  const previews = occurrences.map((occ) => {
    const occDate = occ.start_time.split('T')[0];
    
    // Check if session already exists in this exact slot
    const existingSession = queryAll(
      `SELECT s.id, p.full_name FROM sessions s 
       JOIN patients p ON s.patient_id = p.id 
       WHERE s.start_time = ? AND s.status != 'CANCELED'`,
      [occ.start_time]
    );

    // Check if holiday
    const holidays = queryAll(
      `SELECT title FROM agenda_events WHERE date = ? AND event_type = 'HOLIDAY'`,
      [occDate]
    );

    let conflict_reason: string | undefined;
    if (existingSession.length > 0) {
      conflict_reason = `Já agendado: ${existingSession[0].full_name}`;
    } else if (holidays.length > 0) {
      conflict_reason = `Feriado: ${holidays[0].title}`;
    }

    return {
      start_time: occ.start_time,
      end_time: occ.end_time,
      date: occDate,
      has_conflict: !!conflict_reason,
      conflict_reason,
    };
  });

  res.json({
    total_occurrences: previews.length,
    occurrences: previews,
    conflicts_count: previews.filter((p) => p.has_conflict).length,
  });
});

// Endpoint para verificar créditos pré-pagos em sessões futuras elegíveis para realocação
router.get('/sessions/check-prepaid-credit', authenticateToken, (req: AuthRequest, res: Response) => {
  const patientId = Number(req.query.patient_id);
  const startTime = req.query.start_time as string;

  if (!patientId || !startTime) {
    res.status(400).json({ error: 'patient_id e start_time são obrigatórios' });
    return;
  }

  // Busca sessões futuras do paciente que já estão quitadas
  const futurePaidSessions = queryAll<any>(
    `SELECT s.id, s.start_time, s.end_time, s.price, s.modality, s.psychologist_id,
            u.name as psychologist_name,
            inv.id as invoice_id, inv.invoice_number, inv.status as invoice_status,
            ft.id as transaction_id, ft.amount, ft.payment_method, ft.paid_at
     FROM sessions s
     INNER JOIN financial_transactions ft ON ft.session_id = s.id AND ft.status = 'PAID'
     LEFT JOIN users u ON u.id = s.psychologist_id
     LEFT JOIN invoice_items ii ON ii.session_id = s.id
     LEFT JOIN invoices inv ON inv.id = ii.invoice_id AND inv.status != 'CANCELLED'
     WHERE s.patient_id = ?
       AND s.start_time > ?
       AND (s.session_type = 'PSYCHOTHERAPY' OR s.session_type IS NULL)
       AND s.status NOT IN ('CANCELED', 'CANCELED_BY_PATIENT', 'CANCELED_BY_PSYCHOLOGIST')
     ORDER BY s.start_time DESC`,
    [patientId, startTime]
  );

  if (!futurePaidSessions || futurePaidSessions.length === 0) {
    res.json({
      hasEligibleCredit: false,
      eligibleSessions: [],
      suggestedDonorSession: null,
      lockedSessions: [],
    });
    return;
  }

  // Separa as sessões que possuem NF emitida (bloqueadas) daquelas elegíveis (sem NF)
  const eligibleSessions = futurePaidSessions.filter((s) => !s.invoice_id);
  const lockedSessions = futurePaidSessions.filter((s) => !!s.invoice_id);

  // A sessão doadora recomendada é a mais distante no tempo (ordem cronológica de consumo de pacote)
  const suggestedDonorSession = eligibleSessions.length > 0 ? eligibleSessions[0] : null;

  res.json({
    hasEligibleCredit: eligibleSessions.length > 0,
    totalPaidFutureCount: futurePaidSessions.length,
    eligibleSessions,
    suggestedDonorSession,
    lockedSessions,
  });
});

router.post('/sessions', authenticateToken, (req: AuthRequest, res: Response) => {
  const parse = sessionCreateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  const {
    patient_id,
    psychologist_id,
    start_time,
    end_time,
    modality,
    price,
    notes,
    evaluation_id,
    session_type = 'PSYCHOTHERAPY',
    room_id,
    room_name,
    is_recurring,
    recurrence_frequency,
    recurrence_end_type,
    recurrence_count,
    recurrence_end_date,
    reallocate_from_session_id,
  } = parse.data;

  // ABAC / Psychologist ID resolution
  const isPsychologist = req.user?.role_id === 2 || req.user?.role === 'PSICOLOGO';
  const hasManageUsers = req.user?.permissions?.includes('manage_users');
  
  let psychId = req.user?.id;
  if (hasManageUsers && psychologist_id) {
    psychId = psychologist_id;
  } else if (!isPsychologist && !psychologist_id) {
    psychId = 1; // Fallback to admin if Secretary didn't select (or we could enforce selection)
  }

  const isEvaluation = session_type === 'EVALUATION';
  const canViewFin = canUserViewFinancial(req.user);
  let resolvedPrice = price;
  if (!canViewFin) {
    const pRow = queryOne<any>('SELECT session_price FROM patients WHERE id = ?', [patient_id]);
    const clinicRow = queryOne<any>('SELECT default_session_price FROM clinic_settings WHERE id = 1');
    resolvedPrice = pRow && pRow.session_price !== null && pRow.session_price !== undefined
      ? Number(pRow.session_price)
      : (clinicRow?.default_session_price ? Number(clinicRow.default_session_price) : 180.00);
  }
  const effectiveSessionPrice = isEvaluation ? 0 : resolvedPrice;
  const effectiveEvalId = isEvaluation && evaluation_id ? evaluation_id : null;

  let resolvedRoomId: number | null = room_id ? Number(room_id) : null;
  let resolvedRoomName: string | null = room_name || null;
  if (resolvedRoomId && !resolvedRoomName) {
    const rRow = queryOne<any>('SELECT name FROM rooms WHERE id = ?', [resolvedRoomId]);
    resolvedRoomName = rRow?.name || null;
  }

  if (is_recurring) {
    const freq = recurrence_frequency || 'WEEKLY';
    const endT = recurrence_end_type || 'COUNT';
    const dates = computeRecurrenceDates(start_time, end_time, freq, endT, recurrence_count, recurrence_end_date);

    const recurrenceGroupId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const patternLabel = freq === 'WEEKLY' ? 'Semanal' : freq === 'BIWEEKLY' ? 'Quinzenal' : 'Mensal';

    const insertedIds: number[] = [];

    for (const d of dates) {
      const result = execute(
        `INSERT INTO sessions (psychologist_id, patient_id, start_time, end_time, status, modality, price, notes, recurrence_group_id, recurrence_pattern, evaluation_id, session_type, room_id, room_name)
         VALUES (?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [psychId, patient_id, d.start_time, d.end_time, modality, effectiveSessionPrice, notes || '', recurrenceGroupId, patternLabel, effectiveEvalId, session_type, resolvedRoomId, resolvedRoomName]
      );

      const sessId = result.lastInsertRowid;
      insertedIds.push(sessId);

      // Cria lançamento financeiro pendente vinculado apenas se for psicoterapia regular (avulsa)
      if (!isEvaluation) {
        const transDate = d.start_time.split('T')[0];
        execute(
          `INSERT INTO financial_transactions (patient_id, session_id, amount, status, payment_method, transaction_date)
           VALUES (?, ?, ?, 'PENDING', 'PIX', ?)`,
          [patient_id, sessId, effectiveSessionPrice, transDate]
        );
      }
    }

    recordAuditLog(
      req,
      'CREATE_RECURRING_SESSIONS',
      `SERIES #${recurrenceGroupId}`,
      `${dates.length} sessões recorrentes (${patternLabel}) agendadas para paciente #${patient_id}`
    );

    res.status(201).json({
      message: `${dates.length} sessões recorrentes agendadas com sucesso!`,
      recurrence_group_id: recurrenceGroupId,
      count: dates.length,
      first_session_id: insertedIds[0],
    });
    return;
  }

  // Se foi solicitada a realocação de crédito pré-pago de uma sessão futura
  if (reallocate_from_session_id && !isEvaluation) {
    const donor = queryOne<any>(
      `SELECT * FROM sessions WHERE id = ? AND patient_id = ?`,
      [reallocate_from_session_id, patient_id]
    );

    const donorTx = queryOne<any>(
      `SELECT * FROM financial_transactions WHERE session_id = ? AND patient_id = ? AND status = 'PAID' ORDER BY id DESC LIMIT 1`,
      [reallocate_from_session_id, patient_id]
    );

    if (!donor || !donorTx) {
      res.status(400).json({ error: 'Sessão futura doadora de crédito não encontrada ou não está quitada.' });
      return;
    }

    const donorInvoice = queryOne<any>(
      `SELECT ii.invoice_id, inv.invoice_number, inv.status 
       FROM invoice_items ii 
       JOIN invoices inv ON inv.id = ii.invoice_id 
       WHERE ii.session_id = ? AND inv.status != 'CANCELLED' LIMIT 1`,
      [reallocate_from_session_id]
    );

    if (donorInvoice) {
      res.status(400).json({ error: 'A sessão futura já possui Nota Fiscal emitida e não pode ter seu pagamento realocado.' });
      return;
    }

    // Insere a nova sessão
    const result = execute(
      `INSERT INTO sessions (psychologist_id, patient_id, start_time, end_time, status, modality, price, notes, evaluation_id, session_type, room_id, room_name)
       VALUES (?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?)`,
      [psychId, patient_id, start_time, end_time, modality, effectiveSessionPrice, notes || '', effectiveEvalId, session_type, resolvedRoomId, resolvedRoomName]
    );
    const newSessionId = result.lastInsertRowid;

    const donorDateFormatted = new Date(donor.start_time).toLocaleDateString('pt-BR');
    const newDateFormatted = new Date(start_time).toLocaleDateString('pt-BR');
    const reallocationNote = `[Crédito pré-pago realocado da sessão de ${donorDateFormatted} para ${newDateFormatted}]`;

    if (donorTx) {
      execute(
        `UPDATE financial_transactions 
         SET session_id = ?, 
             notes = CASE 
               WHEN notes IS NULL OR notes = '' THEN ? 
               ELSE notes || ' ' || ? 
             END
         WHERE id = ?`,
        [newSessionId, reallocationNote, reallocationNote, donorTx.id]
      );
    }

    // Cria novo lançamento financeiro PENDING para a sessão doadora que retornou para pendente
    const donorTransDate = donor.start_time.split('T')[0];
    execute(
      `INSERT INTO financial_transactions (patient_id, session_id, amount, status, payment_method, transaction_date, notes)
       VALUES (?, ?, ?, 'PENDING', ?, ?, ?)`,
      [patient_id, reallocate_from_session_id, donor.price, donorTx?.payment_method || 'PIX', donorTransDate, `Sessão pendente após realocação de crédito para ${newDateFormatted}`]
    );

    recordAuditLog(
      req,
      'REALLOCATE_PREPAID_CREDIT',
      `SESSION #${newSessionId}`,
      `Crédito de R$ ${donor.price} transferido da sessão futura #${reallocate_from_session_id} (${donorDateFormatted}) para sessão antecipada #${newSessionId} (${newDateFormatted})`
    );

    res.status(201).json({
      id: newSessionId,
      message: 'Sessão agendada e crédito pré-pago realocado com sucesso!',
      reallocated_from_session_id: reallocate_from_session_id,
    });
    return;
  }

  // Single session creation
  const result = execute(
    `INSERT INTO sessions (psychologist_id, patient_id, start_time, end_time, status, modality, price, notes, evaluation_id, session_type, room_id, room_name)
     VALUES (?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?)`,
    [psychId, patient_id, start_time, end_time, modality, effectiveSessionPrice, notes || '', effectiveEvalId, session_type, resolvedRoomId, resolvedRoomName]
  );

  // Também cria transação financeira pendente vinculada à sessão apenas se for psicoterapia regular
  if (!isEvaluation) {
    const transDate = start_time.split('T')[0];
    execute(
      `INSERT INTO financial_transactions (patient_id, session_id, amount, status, payment_method, transaction_date)
       VALUES (?, ?, ?, 'PENDING', 'PIX', ?)`,
      [patient_id, result.lastInsertRowid, effectiveSessionPrice, transDate]
    );
  }

  recordAuditLog(
    req,
    'CREATE_SESSION',
    `SESSION #${result.lastInsertRowid}`,
    `Sessão ${isEvaluation ? 'de Avaliação Neuropsicológica' : 'de Psicoterapia'} agendada para paciente #${patient_id}`
  );
  res.status(201).json({ id: result.lastInsertRowid, message: 'Sessão agendada com sucesso' });
});

router.put('/sessions/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    start_time,
    end_time,
    modality,
    price,
    notes,
    status,
    cancellation_reason,
    patient_id,
    session_type,
    evaluation_id,
    room_id,
    room_name,
    scope = 'single', // 'single' | 'future' | 'all'
    detach_from_series,
    is_recurring,
    recurrence_frequency,
    recurrence_end_type,
    recurrence_count,
    recurrence_end_date,
  } = req.body;

  const currentSession = queryOne<any>(`SELECT * FROM sessions WHERE id = ?`, [id]);
  if (!currentSession) {
    res.status(404).json({ error: 'Sessão não encontrada' });
    return;
  }

  const effectiveRoomId = room_id !== undefined ? (room_id ? Number(room_id) : null) : currentSession.room_id;
  let effectiveRoomName = room_name !== undefined ? room_name : currentSession.room_name;
  if (room_id !== undefined && effectiveRoomId && !effectiveRoomName) {
    const rRow = queryOne<any>('SELECT name FROM rooms WHERE id = ?', [effectiveRoomId]);
    effectiveRoomName = rRow?.name || null;
  } else if (room_id !== undefined && !effectiveRoomId) {
    effectiveRoomName = null;
  }

  const canViewFin = canUserViewFinancial(req.user);
  const effectivePatientId = patient_id !== undefined ? Number(patient_id) : currentSession.patient_id;
  const effectivePrice = canViewFin
    ? (price !== undefined ? Number(price) : currentSession.price)
    : currentSession.price;
  const effectiveModality = modality || currentSession.modality;
  
  let effectiveStatus = status || currentSession.status;
  let effectiveCancellationReason = cancellation_reason !== undefined ? cancellation_reason : currentSession.cancellation_reason;

  if (effectiveStatus === 'CANCELED_BY_PATIENT') {
    effectiveStatus = 'CANCELED';
    effectiveCancellationReason = 'PATIENT';
  } else if (effectiveStatus === 'CANCELED_BY_PSYCHOLOGIST') {
    effectiveStatus = 'CANCELED';
    effectiveCancellationReason = 'PSYCHOLOGIST';
  } else if (effectiveStatus !== 'CANCELED') {
    effectiveCancellationReason = null;
  }

  const effectiveNotes = notes !== undefined ? notes : currentSession.notes;
  const effectiveStartTime = start_time || currentSession.start_time;
  const effectiveEndTime = end_time || currentSession.end_time;

  // 1. Desvincular da série recorrente (tornar avulsa)
  if (detach_from_series) {
    execute(
      `UPDATE sessions SET 
        patient_id = ?, start_time = ?, end_time = ?, modality = ?, price = ?, notes = ?, status = ?, cancellation_reason = ?,
        recurrence_group_id = NULL, recurrence_pattern = NULL
       WHERE id = ?`,
      [effectivePatientId, effectiveStartTime, effectiveEndTime, effectiveModality, effectivePrice, effectiveNotes, effectiveStatus, effectiveCancellationReason, id]
    );

    execute(
      `UPDATE financial_transactions SET amount = ?, patient_id = ?, transaction_date = ? WHERE session_id = ?`,
      [effectivePrice, effectivePatientId, effectiveStartTime.split('T')[0], id]
    );

    recordAuditLog(req, 'UPDATE_SESSION_DETACH', `SESSION #${id}`, `Sessão desvinculada da série e atualizada`);
    res.json({ message: 'Agendamento desvinculado da série e atualizado com sucesso!' });
    return;
  }

  // 2. Se a sessão é recorrente e o escopo selecionado for 'future' ou 'all'
  if (currentSession.recurrence_group_id && (scope === 'future' || scope === 'all')) {
    const groupId = currentSession.recurrence_group_id;
    const targetSessions = queryAll<any>(
      scope === 'future'
        ? `SELECT id, start_time, end_time FROM sessions WHERE recurrence_group_id = ? AND start_time >= ?`
        : `SELECT id, start_time, end_time FROM sessions WHERE recurrence_group_id = ?`,
      scope === 'future' ? [groupId, currentSession.start_time] : [groupId]
    );

    const newStartHms = effectiveStartTime.split('T')[1] || '';
    const newEndHms = effectiveEndTime.split('T')[1] || '';
    const oldStartHms = currentSession.start_time.split('T')[1] || '';
    const timeChanged = newStartHms && newStartHms !== oldStartHms;

    for (const s of targetSessions) {
      if (s.id === Number(id)) {
        execute(
          `UPDATE sessions SET 
            patient_id = ?, start_time = ?, end_time = ?, modality = ?, price = ?, notes = ?, status = ?, cancellation_reason = ?
           WHERE id = ?`,
          [effectivePatientId, effectiveStartTime, effectiveEndTime, effectiveModality, effectivePrice, effectiveNotes, effectiveStatus, effectiveCancellationReason, s.id]
        );
      } else {
        let updatedStart = s.start_time;
        let updatedEnd = s.end_time;
        if (timeChanged && newStartHms && newEndHms) {
          const sDate = s.start_time.split('T')[0];
          updatedStart = `${sDate}T${newStartHms}`;
          updatedEnd = `${sDate}T${newEndHms}`;
        }

        execute(
          `UPDATE sessions SET 
            patient_id = ?, start_time = ?, end_time = ?, modality = ?, price = ?, notes = ?
           WHERE id = ?`,
          [effectivePatientId, updatedStart, updatedEnd, effectiveModality, effectivePrice, effectiveNotes, s.id]
        );
      }

      // Atualiza lançamentos financeiros pendentes vinculados
      execute(
        `UPDATE financial_transactions 
         SET amount = ?, patient_id = ? 
         WHERE session_id = ? AND status = 'PENDING'`,
        [effectivePrice, effectivePatientId, s.id]
      );
    }

    recordAuditLog(
      req,
      'UPDATE_RECURRING_SERIES',
      `SERIES #${groupId}`,
      `Atualização aplicada a ${targetSessions.length} sessões da série (escopo: ${scope})`
    );

    res.json({
      message: `Série de ${targetSessions.length} sessões atualizada com sucesso!`,
      updated_count: targetSessions.length,
    });
    return;
  }

  // 3. Se era avulsa e o usuário agora ativou recorrência:
  if (!currentSession.recurrence_group_id && is_recurring) {
    const freq = recurrence_frequency || 'WEEKLY';
    const endT = recurrence_end_type || 'COUNT';
    const occurrences = computeRecurrenceDates(
      effectiveStartTime,
      effectiveEndTime,
      freq,
      endT,
      recurrence_count,
      recurrence_end_date
    );

    const recurrenceGroupId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const patternLabel = freq === 'WEEKLY' ? 'Semanal' : freq === 'BIWEEKLY' ? 'Quinzenal' : 'Mensal';

    execute(
      `UPDATE sessions SET 
        patient_id = ?, start_time = ?, end_time = ?, modality = ?, price = ?, notes = ?, status = ?,
        recurrence_group_id = ?, recurrence_pattern = ?
       WHERE id = ?`,
      [
        effectivePatientId,
        effectiveStartTime,
        effectiveEndTime,
        effectiveModality,
        effectivePrice,
        effectiveNotes,
        effectiveStatus,
        recurrenceGroupId,
        patternLabel,
        id,
      ]
    );

    execute(
      `UPDATE financial_transactions SET amount = ?, patient_id = ?, transaction_date = ? WHERE session_id = ?`,
      [effectivePrice, effectivePatientId, effectiveStartTime.split('T')[0], id]
    );

    const psychId = currentSession.psychologist_id || 1;
    for (let i = 1; i < occurrences.length; i++) {
      const occ = occurrences[i];
      const resOcc = execute(
        `INSERT INTO sessions (psychologist_id, patient_id, start_time, end_time, status, modality, price, notes, recurrence_group_id, recurrence_pattern)
         VALUES (?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?)`,
        [
          psychId,
          effectivePatientId,
          occ.start_time,
          occ.end_time,
          effectiveModality,
          effectivePrice,
          effectiveNotes,
          recurrenceGroupId,
          patternLabel,
        ]
      );
      const sessId = resOcc.lastInsertRowid;
      execute(
        `INSERT INTO financial_transactions (patient_id, session_id, amount, status, payment_method, transaction_date)
         VALUES (?, ?, ?, 'PENDING', 'PIX', ?)`,
        [effectivePatientId, sessId, effectivePrice, occ.start_time.split('T')[0]]
      );
    }

    recordAuditLog(
      req,
      'CONVERT_TO_RECURRING',
      `SESSION #${id}`,
      `Sessão convertida para série recorrente (${patternLabel}) com ${occurrences.length} sessões geradas.`
    );

    res.json({
      message: `Agendamento atualizado e transformado em série recorrente com ${occurrences.length} sessões!`,
      count: occurrences.length,
    });
    return;
  }

  // 4. Edição individual padrão (apenas este agendamento)
  const effectiveSessionType = session_type !== undefined ? session_type : (currentSession.session_type || 'PSYCHOTHERAPY');
  const effectiveEvalId = evaluation_id !== undefined ? evaluation_id : currentSession.evaluation_id;
  const isNowEvaluation = effectiveSessionType === 'EVALUATION';
  const finalPrice = isNowEvaluation ? 0 : effectivePrice;

  execute(
    `UPDATE sessions SET 
      patient_id = ?, start_time = ?, end_time = ?, modality = ?, price = ?, notes = ?, status = ?, cancellation_reason = ?, session_type = ?, evaluation_id = ?, room_id = ?, room_name = ?
     WHERE id = ?`,
    [effectivePatientId, effectiveStartTime, effectiveEndTime, effectiveModality, finalPrice, effectiveNotes, effectiveStatus, effectiveCancellationReason, effectiveSessionType, effectiveEvalId, effectiveRoomId, effectiveRoomName, id]
  );

  if (isNowEvaluation) {
    // Se tornou sessão de avaliação coberta pelo pacote, remove lançamento de cobrança avulsa pendente
    execute(`DELETE FROM financial_transactions WHERE session_id = ? AND status = 'PENDING'`, [id]);
  } else {
    execute(
      `UPDATE financial_transactions 
       SET amount = ?, patient_id = ?, transaction_date = ? 
       WHERE session_id = ?`,
      [finalPrice, effectivePatientId, effectiveStartTime.split('T')[0], id]
    );
  }

  recordAuditLog(req, 'UPDATE_SESSION', `SESSION #${id}`, `Dados da sessão #${id} atualizados`);
  res.json({ message: 'Agendamento atualizado com sucesso!' });
});

router.delete('/sessions/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const scope = (req.query.scope as string) || 'single'; // 'single' | 'future' | 'all'

  const sessionRows = queryAll(`SELECT recurrence_group_id, start_time FROM sessions WHERE id = ?`, [id]);
  const currentSess = sessionRows[0];

  if (currentSess?.recurrence_group_id && scope === 'future') {
    // Delete this and all future sessions of the series
    const futureSessions = queryAll(
      `SELECT id FROM sessions WHERE recurrence_group_id = ? AND start_time >= ?`,
      [currentSess.recurrence_group_id, currentSess.start_time]
    );
    const ids = futureSessions.map((s) => s.id);
    for (const fId of ids) {
      execute(`DELETE FROM financial_transactions WHERE session_id = ?`, [fId]);
      execute(`DELETE FROM sessions WHERE id = ?`, [fId]);
    }
    recordAuditLog(req, 'DELETE_RECURRING_FUTURE', `SERIES #${currentSess.recurrence_group_id}`, `${ids.length} sessões futuras removidas`);
    res.json({ message: `${ids.length} sessões da série removidas com sucesso` });
    return;
  }

  if (currentSess?.recurrence_group_id && scope === 'all') {
    // Delete all sessions of the series
    const allSeries = queryAll(
      `SELECT id FROM sessions WHERE recurrence_group_id = ?`,
      [currentSess.recurrence_group_id]
    );
    const ids = allSeries.map((s) => s.id);
    for (const fId of ids) {
      execute(`DELETE FROM financial_transactions WHERE session_id = ?`, [fId]);
      execute(`DELETE FROM sessions WHERE id = ?`, [fId]);
    }
    recordAuditLog(req, 'DELETE_RECURRING_ALL', `SERIES #${currentSess.recurrence_group_id}`, `Todas as ${ids.length} sessões da série removidas`);
    res.json({ message: `Todas as ${ids.length} sessões da série foram removidas` });
    return;
  }

  // Default: single session deletion
  execute(`DELETE FROM financial_transactions WHERE session_id = ?`, [id]);
  execute(`DELETE FROM sessions WHERE id = ?`, [id]);
  recordAuditLog(req, 'DELETE_SESSION', `SESSION #${id}`, `Sessão removida da agenda`);
  res.json({ message: 'Sessão excluída com sucesso' });
});

router.patch('/sessions/:id/status', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, cancellation_reason } = req.body;

  let finalStatus = status;
  let finalReason = cancellation_reason || null;

  if (status === 'CANCELED_BY_PATIENT') {
    finalStatus = 'CANCELED';
    finalReason = 'PATIENT';
  } else if (status === 'CANCELED_BY_PSYCHOLOGIST') {
    finalStatus = 'CANCELED';
    finalReason = 'PSYCHOLOGIST';
  }

  const validStatuses = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW'];
  if (!validStatuses.includes(finalStatus)) {
    res.status(400).json({ error: 'Status de sessão inválido' });
    return;
  }

  if (finalStatus !== 'CANCELED') {
    finalReason = null;
  }

  execute(`UPDATE sessions SET status = ?, cancellation_reason = ? WHERE id = ?`, [finalStatus, finalReason, id]);
  recordAuditLog(
    req, 
    'UPDATE_SESSION_STATUS', 
    `SESSION #${id}`, 
    `Status alterado para ${finalStatus}${finalReason ? ` (Motivo: ${finalReason})` : ''}`
  );
  res.json({ message: 'Status atualizado com sucesso', status: finalStatus, cancellation_reason: finalReason });
});

// Eventos de Dia Todo / Lembretes Administrativos & Despesas na Agenda (Dia Todo)
router.get('/agenda-events', authenticateToken, (req: AuthRequest, res: Response) => {
  const { date, start_date, end_date } = req.query;
  const canViewFinancial = canUserViewFinancial(req.user);
  let sql = `
    SELECT 
      a.id, a.date, a.title, a.event_type, a.created_at,
      COALESCE(a.expense_id, e.id) as expense_id,
      COALESCE(a.amount, e.amount) as amount,
      COALESCE(a.status, e.status, 'PENDING') as status,
      COALESCE(a.payment_date, e.payment_date) as payment_date,
      COALESCE(a.category, e.category) as category,
      e.payment_method as expense_payment_method,
      e.notes as expense_notes
    FROM agenda_events a
    LEFT JOIN expenses e ON a.expense_id = e.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (!canViewFinancial) {
    sql += ` AND a.event_type NOT IN ('FINANCIAL', 'EXPENSE') AND a.expense_id IS NULL`;
  }
  if (date) {
    sql += ` AND a.date = ?`;
    params.push(date);
  } else if (start_date && end_date) {
    sql += ` AND a.date >= ? AND a.date <= ?`;
    params.push(start_date, end_date);
  }
  sql += ` ORDER BY a.date ASC, a.id ASC`;
  const events = queryAll(sql, params);
  res.json({ events });
});

router.post('/agenda-events', authenticateToken, (req: AuthRequest, res: Response) => {
  const { date, title, event_type, amount, category, status, payment_date, payment_method } = req.body;
  if (!date || !title) {
    res.status(400).json({ error: 'Data e título são obrigatórios' });
    return;
  }

  const evType = event_type || 'REMINDER';
  if (evType === 'FINANCIAL' && !canUserViewFinancial(req.user)) {
    res.status(403).json({ error: 'Permissão negada para lançar eventos financeiros na agenda.' });
    return;
  }

  let createdExpenseId: number | null = null;

  // Se o tipo for FINANCEIRO, sincroniza criando a despesa correspondente
  if (evType === 'FINANCIAL') {
    const numAmount = Number(amount) || 0;
    const expStatus = status || 'PENDING';
    const cleanTitle = title.replace(/\s*💵\s*/g, '').trim();

    const expRes = execute(`
      INSERT INTO expenses (psychologist_id, title, category, amount, due_date, payment_date, status, payment_method, carne_leao_deductible)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      cleanTitle,
      category || 'OUTROS',
      numAmount,
      date,
      expStatus === 'PAID' ? (payment_date || date) : null,
      expStatus,
      payment_method || 'PIX'
    ]);
    createdExpenseId = expRes.lastInsertRowid;
  }

  const result = execute(
    `INSERT INTO agenda_events (date, title, event_type, expense_id, amount, status, payment_date, category) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      date,
      evType === 'FINANCIAL' && !title.includes('💵') ? `${title} 💵` : title,
      evType,
      createdExpenseId,
      amount ? Number(amount) : null,
      status || 'PENDING',
      status === 'PAID' ? (payment_date || date) : null,
      category || null
    ]
  );

  recordAuditLog(req, 'CREATE_AGENDA_EVENT', `AGENDA_EVENT #${result.lastInsertRowid}`, `Evento criado: ${title}`);
  res.status(201).json({ id: result.lastInsertRowid, expense_id: createdExpenseId, message: 'Evento criado com sucesso' });
});

router.patch('/agenda-events/:id/status', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, payment_date, payment_method } = req.body;

  const event = queryOne<any>(`SELECT * FROM agenda_events WHERE id = ?`, [id]);
  if (!event) {
    res.status(404).json({ error: 'Evento não encontrado' });
    return;
  }

  if ((event.event_type === 'FINANCIAL' || event.expense_id) && !canUserViewFinancial(req.user)) {
    res.status(403).json({ error: 'Permissão negada para alterar status financeiro na agenda.' });
    return;
  }

  const effectivePaymentDate = status === 'PAID' 
    ? (payment_date || new Date().toISOString().substring(0, 10)) 
    : null;

  execute(
    `UPDATE agenda_events SET status = ?, payment_date = ? WHERE id = ?`,
    [status, effectivePaymentDate, id]
  );

  if (event.expense_id) {
    execute(
      `UPDATE expenses 
       SET status = ?, payment_date = ?, payment_method = COALESCE(?, payment_method), updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [status, effectivePaymentDate, payment_method || null, event.expense_id]
    );
  }

  recordAuditLog(req, 'UPDATE_AGENDA_EVENT_STATUS', `AGENDA_EVENT #${id}`, `Status financeiro alterado para ${status}`);
  res.json({ message: 'Situação de pagamento atualizada com sucesso' });
});

router.delete('/agenda-events/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const event = queryOne<any>(`SELECT * FROM agenda_events WHERE id = ?`, [id]);
  if (event && (event.event_type === 'FINANCIAL' || event.expense_id) && !canUserViewFinancial(req.user)) {
    res.status(403).json({ error: 'Permissão negada para excluir eventos financeiros na agenda.' });
    return;
  }
  if (event && event.expense_id) {
    execute(`DELETE FROM expenses WHERE id = ?`, [event.expense_id]);
  }
  execute(`DELETE FROM agenda_events WHERE id = ?`, [id]);
  recordAuditLog(req, 'DELETE_AGENDA_EVENT', `AGENDA_EVENT #${id}`, 'Evento excluído da agenda');
  res.json({ message: 'Evento excluído com sucesso' });
});

/**
 * WhatsApp reminder: MUST be completely neutral, free from sensitive clinical data (LGPD compliance)
 */
router.post('/sessions/:id/whatsapp-reminder', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { recipientOverride } = req.body || {};

  const session = queryOne<any>(
    `SELECT s.id, s.start_time, s.modality, p.id as patient_id, p.full_name, p.phone, p.group_type, p.guardian_json, p.whatsapp_routing_json, u.name as psych_name
     FROM sessions s
     JOIN patients p ON s.patient_id = p.id
     JOIN users u ON s.psychologist_id = u.id
     WHERE s.id = ?`,
    [id]
  );

  if (!session) {
    res.status(404).json({ error: 'Sessão não encontrada' });
    return;
  }

  let guardian: any = undefined;
  if (session.guardian_json) {
    try {
      guardian = typeof session.guardian_json === 'string' ? JSON.parse(session.guardian_json) : session.guardian_json;
    } catch {
      guardian = undefined;
    }
  }

  let routing: any = undefined;
  if (session.whatsapp_routing_json) {
    try {
      routing = typeof session.whatsapp_routing_json === 'string' ? JSON.parse(session.whatsapp_routing_json) : session.whatsapp_routing_json;
    } catch {
      routing = undefined;
    }
  }

  // Determina o destinatário: override ou preferência salva ou fallback por idade
  let target: 'PATIENT' | 'GUARDIAN' = 'PATIENT';
  if (recipientOverride === 'GUARDIAN' || recipientOverride === 'PATIENT') {
    target = recipientOverride;
  } else if (routing?.appointmentChannel === 'GUARDIAN') {
    target = 'GUARDIAN';
  } else if (!routing && (session.group_type === 'Criança' || session.group_type === 'Adolescente') && guardian?.phone) {
    target = 'GUARDIAN';
  }

  const dateObj = new Date(session.start_time);
  const formattedDate = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const patientFirstName = session.full_name.split(' ')[0];
  const modalityLabel = session.modality === 'ONLINE' ? 'atendimento online' : 'atendimento presencial';

  let rawPhone = session.phone || '';
  let recipientName = session.full_name;
  let messageText = '';

  if (target === 'GUARDIAN' && guardian && guardian.phone && guardian.phone.trim()) {
    recipientName = guardian.fullName || 'Responsável';
    rawPhone = guardian.phone;
    const guardianFirstName = recipientName.split(' ')[0];
    messageText = `Olá, ${guardianFirstName}! Confirmando o horário agendado de atendimento de ${patientFirstName} com ${session.psych_name} para ${formattedDate}, às ${formattedTime} (${modalityLabel}). Por favor, responda com 1 para CONFIRMAR ou 2 para REMARCAR. Tenha um ótimo dia!`;
  } else {
    target = 'PATIENT';
    messageText = `Olá, ${patientFirstName}! Confirmando seu horário agendado com ${session.psych_name} para ${formattedDate}, às ${formattedTime} (${modalityLabel}). Por favor, responda com 1 para CONFIRMAR ou 2 para REMARCAR. Tenha um ótimo dia!`;
  }

  // Limpa caracteres do telefone e assegura DDI 55
  let cleanDigits = rawPhone.replace(/\D/g, '');
  if (cleanDigits.length === 10 || cleanDigits.length === 11) {
    cleanDigits = `55${cleanDigits}`;
  }
  const phoneWithCountry = cleanDigits;
  const whatsappUrl = phoneWithCountry
    ? `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(messageText)}`
    : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

  recordAuditLog(
    req,
    'GENERATE_WHATSAPP_REMINDER',
    `SESSION #${id}`,
    `Lembrete gerado para ${target === 'GUARDIAN' ? `responsável ${recipientName} do paciente` : 'paciente'} ${session.full_name}`
  );

  res.json({
    recipientPhone: phoneWithCountry,
    patientName: session.full_name,
    recipientName,
    recipientType: target,
    hasGuardian: Boolean(guardian && guardian.phone && guardian.phone.trim()),
    guardianName: guardian?.fullName || null,
    guardianPhone: guardian?.phone || null,
    messageText,
    whatsappUrl,
  });
});

// ==========================================
// 🎥 TELEATENDIMENTO PSICOLÓGICO (RESOLUÇÃO CFP Nº 11/2018)
// ==========================================

const activateVideoSchema = z.object({
  provider: z.enum(['NATIVE', 'EXTERNAL', 'WHATSAPP']).optional().default('NATIVE'),
  externalUrl: z.string().url().optional(),
});

/**
 * Ativar Sala de Vídeo para Sessão Online
 */
router.post(
  '/sessions/:id/activate-video',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response): void => {
    const sessionId = Number(req.params.id);
    const session = queryOne<any>(
      `SELECT s.*, p.full_name as patient_name, p.phone as patient_phone, u.name as psych_name, u.crp_number, u.epsi_code
       FROM sessions s
       JOIN patients p ON s.patient_id = p.id
       JOIN users u ON s.psychologist_id = u.id
       WHERE s.id = ?`,
      [sessionId]
    );

    if (!session) {
      res.status(404).json({ error: 'Sessão não encontrada' });
      return;
    }

    const parse = activateVideoSchema.safeParse(req.body);
    const provider = parse.success && parse.data.provider ? parse.data.provider : (session.video_provider || 'NATIVE');
    const externalUrl = parse.success && parse.data.externalUrl ? parse.data.externalUrl : session.video_external_url;

    // Gera ID único de sala criptograficamente seguro para sala nativa
    const roomId = session.video_room_id || `psico-${sessionId}-${crypto.randomBytes(8).toString('hex')}`;
    
    // Gera token de acesso temporário exclusivo do paciente (válido para este atendimento)
    const patientToken = session.patient_access_token || crypto.randomBytes(24).toString('hex');

    execute(
      `UPDATE sessions SET
        modality = 'ONLINE',
        video_provider = ?,
        video_room_id = ?,
        video_external_url = ?,
        video_status = 'OPEN',
        video_started_at = COALESCE(video_started_at, CURRENT_TIMESTAMP),
        patient_access_token = ?
       WHERE id = ?`,
      [provider, roomId, externalUrl || null, patientToken, sessionId]
    );

    try {
      recordAuditLog(
        req,
        'TELEATENDIMENTO_SALA_ATIVADA',
        `SESSION #${sessionId}`,
        `Sala de vídeo ativada via provedor ${provider} para o paciente ${session.patient_name}`
      );
    } catch (e) {
      console.warn('[Audit] Erro ao registrar log de teleatendimento:', e);
    }

    const host = req.get('host') || 'localhost:3333';
    const protocol = req.protocol || 'http';
    let appUrl = process.env.APP_URL || '';
    if (!appUrl || appUrl === 'MY_APP_URL' || appUrl.startsWith('MY_')) {
      appUrl = `${protocol}://${host}`;
    }
    const patientLink = `${appUrl}/teleconsulta/${patientToken}`;
    const patientFirstName = session.patient_name.split(' ')[0];
    const whatsappText = provider === 'WHATSAPP'
      ? `Olá, ${patientFirstName}! Sou ${session.psych_name}. Estou iniciando nossa sessão de teleatendimento por chamada de vídeo aqui pelo WhatsApp. Por favor, confirme quando puder atender para iniciarmos.`
      : `Olá, ${patientFirstName}! Sua sessão de atendimento psicológico online com ${session.psych_name} já está disponível. Acesse o link seguro para entrar na sala virtual: ${patientLink}`;
    
    let cleanPhone = (session.patient_phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = `55${cleanPhone}`;
    const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappText)}` : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

    res.json({
      sessionId,
      videoStatus: 'OPEN',
      video_status: 'OPEN',
      videoProvider: provider,
      video_provider: provider,
      videoRoomId: roomId,
      video_room_id: roomId,
      videoExternalUrl: externalUrl || null,
      video_external_url: externalUrl || null,
      patientToken,
      patient_access_token: patientToken,
      patientLink,
      whatsappUrl,
      whatsappText,
      psychologist: {
        name: session.psych_name,
        crp: session.crp_number,
        epsi: session.epsi_code,
      }
    });
  }
);

/**
 * Encerrar Sala de Vídeo da Sessão
 */
router.post(
  '/sessions/:id/end-video',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response): void => {
    const sessionId = Number(req.params.id);
    const session = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [sessionId]);

    if (!session) {
      res.status(404).json({ error: 'Sessão não encontrada' });
      return;
    }

    execute(
      `UPDATE sessions SET
        video_status = 'FINISHED',
        video_ended_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sessionId]
    );

    try {
      recordAuditLog(
        req,
        'TELEATENDIMENTO_SALA_ENCERRADA',
        `SESSION #${sessionId}`,
        `Sessão de teleatendimento online finalizada`
      );
    } catch (e) {
      console.warn('[Audit] Erro ao registrar encerramento de teleatendimento:', e);
    }

    res.json({ success: true, videoStatus: 'FINISHED' });
  }
);

/**
 * Iniciar Teleatendimento Imediato (On-Demand / Avulso) para qualquer paciente
 */
router.post(
  '/sessions/instant-video',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response): void => {
    const patientId = Number(req.body.patientId);
    if (!patientId) {
      res.status(400).json({ error: 'patientId é obrigatório' });
      return;
    }

    const patient = queryOne<any>('SELECT id, full_name, phone FROM patients WHERE id = ?', [patientId]);
    if (!patient) {
      res.status(404).json({ error: 'Paciente não encontrado' });
      return;
    }

    const psychId = req.user?.id || 1;
    const psych = queryOne<any>('SELECT name, crp_number, epsi_code FROM users WHERE id = ?', [psychId]);

    // Verifica se já tem uma sessão aberta/ativa hoje para este paciente
    let session = queryOne<any>(
      `SELECT s.*, u.name as psych_name, u.crp_number, u.epsi_code, p.full_name as patient_name, p.phone as patient_phone
       FROM sessions s
       JOIN users u ON s.psychologist_id = u.id
       JOIN patients p ON s.patient_id = p.id
       WHERE s.patient_id = ? AND s.status != 'CANCELED' AND (s.video_status IN ('OPEN', 'ACTIVE') OR date(s.start_time) = date('now'))
       ORDER BY s.id DESC LIMIT 1`,
      [patientId]
    );

    let sessionId = session ? session.id : null;
    const roomId = session?.video_room_id || `psico-${sessionId || 'inst'}-${crypto.randomBytes(8).toString('hex')}`;
    const patientToken = session?.patient_access_token || crypto.randomBytes(24).toString('hex');
    const provider = req.body.provider === 'WHATSAPP' ? 'WHATSAPP' : 'NATIVE';

    if (session) {
      execute(
        `UPDATE sessions SET
          modality = 'ONLINE',
          video_provider = ?,
          video_room_id = ?,
          video_status = 'OPEN',
          video_started_at = COALESCE(video_started_at, CURRENT_TIMESTAMP),
          patient_access_token = ?
         WHERE id = ?`,
        [provider, roomId, patientToken, session.id]
      );
    } else {
      const now = new Date();
      const startTime = now.toISOString().replace('T', ' ').substring(0, 19);
      const endTime = new Date(now.getTime() + 50 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

      const result = execute(
        `INSERT INTO sessions (
          psychologist_id, patient_id, start_time, end_time, status,
          modality, session_type, presence_status, video_provider,
          video_room_id, video_status, video_started_at, patient_access_token
        ) VALUES (?, ?, ?, ?, 'CONFIRMED', 'ONLINE', 'PSYCHOTHERAPY', 'SCHEDULED', ?, ?, 'OPEN', CURRENT_TIMESTAMP, ?)`,
        [psychId, patientId, startTime, endTime, provider, roomId, patientToken]
      );
      sessionId = result.lastInsertRowid;
    }

    session = queryOne<any>(
      `SELECT s.*, u.name as psych_name, u.crp_number, u.epsi_code, p.full_name as patient_name, p.phone as patient_phone
       FROM sessions s
       JOIN users u ON s.psychologist_id = u.id
       JOIN patients p ON s.patient_id = p.id
       WHERE s.id = ?`,
      [sessionId]
    );

    try {
      recordAuditLog(
        req,
        'TELEATENDIMENTO_IMEDIATO_CRIADO',
        `SESSION #${sessionId}`,
        `Sessão de teleatendimento imediata gerada via ${provider} para ${patient.full_name}`
      );
    } catch (e) {
      console.warn('[Audit] Erro log teleatendimento imediato:', e);
    }

    const host = req.get('host') || 'localhost:3333';
    const protocol = req.protocol || 'http';
    let appUrl = process.env.APP_URL || '';
    if (!appUrl || appUrl === 'MY_APP_URL' || appUrl.startsWith('MY_')) {
      appUrl = `${protocol}://${host}`;
    }
    const patientLink = `${appUrl}/teleconsulta/${patientToken}`;
    const patientFirstName = (patient.full_name || 'Paciente').split(' ')[0];
    const whatsappText = provider === 'WHATSAPP'
      ? `Olá, ${patientFirstName}! Sou ${psych?.name || 'seu terapeuta'}. Estou iniciando nossa sessão de teleatendimento por chamada de vídeo aqui pelo WhatsApp. Por favor, confirme quando puder atender para iniciarmos.`
      : `Olá, ${patientFirstName}! Sua sessão de atendimento psicológico online com ${psych?.name || 'seu terapeuta'} já está disponível. Acesse o link seguro para entrar na sala virtual: ${patientLink}`;

    let cleanPhone = (patient.phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = `55${cleanPhone}`;
    const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappText)}` : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

    const sessionWithProvider = {
      ...session,
      video_provider: provider,
      video_status: 'OPEN',
      modality: 'ONLINE',
    };

    res.json({
      session: sessionWithProvider,
      sessionId,
      videoStatus: 'OPEN',
      video_status: 'OPEN',
      videoProvider: provider,
      video_provider: provider,
      videoRoomId: roomId,
      video_room_id: roomId,
      patientToken,
      patient_access_token: patientToken,
      patientLink,
      whatsappText,
      whatsappUrl,
    });
  }
);

/**
 * Consulta Pública de Sessão de Vídeo (Paciente via Link Tokenizado)
 */
router.get('/public/video-session/:token', (req: Request, res: Response): void => {
  const token = req.params.token;
  if (!token || token.length < 16) {
    res.status(400).json({ error: 'Token de consulta inválido ou expirado' });
    return;
  }

  const session = queryOne<any>(
    `SELECT s.id, s.start_time, s.end_time, s.status, s.modality,
            s.video_status, s.video_provider, s.video_room_id, s.video_external_url,
            s.patient_tcle_accepted_at, s.patient_joined_at,
            p.full_name as patient_name,
            u.name as psych_name, u.crp_number, u.epsi_code,
            cs.clinic_name
     FROM sessions s
     JOIN patients p ON s.patient_id = p.id
     JOIN users u ON s.psychologist_id = u.id
     LEFT JOIN clinic_settings cs ON cs.id = 1
     WHERE s.patient_access_token = ?`,
    [token]
  );

  if (!session) {
    res.status(404).json({ error: 'Sala de atendimento não localizada ou link expirado.' });
    return;
  }

  res.json({
    valid: true,
    sessionId: session.id,
    startTime: session.start_time,
    endTime: session.end_time,
    modality: session.modality,
    videoStatus: session.video_status,
    videoProvider: session.video_provider,
    videoRoomId: session.video_room_id,
    videoExternalUrl: session.video_external_url,
    tcleAccepted: Boolean(session.patient_tcle_accepted_at),
    tcleAcceptedAt: session.patient_tcle_accepted_at,
    patientName: session.patient_name,
    psychologistName: session.psych_name,
    crpNumber: session.crp_number,
    epsiCode: session.epsi_code,
    clinicName: session.clinic_name || 'PsicoGestão',
  });
});

/**
 * Aceite Digital do TCLE de Teleatendimento pelo Paciente (Resolução CFP 11/2018)
 */
router.post('/public/video-session/:token/accept-tcle', (req: Request, res: Response): void => {
  const token = req.params.token;
  const session = queryOne<any>('SELECT id, patient_id FROM sessions WHERE patient_access_token = ?', [token]);

  if (!session) {
    res.status(404).json({ error: 'Sessão não encontrada' });
    return;
  }

  execute(
    `UPDATE sessions SET patient_tcle_accepted_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [session.id]
  );

  res.json({ success: true, acceptedAt: new Date().toISOString() });
});

/**
 * Registro de Entrada do Paciente na Sala Virtual
 */
router.post('/public/video-session/:token/join', (req: Request, res: Response): void => {
  const token = req.params.token;
  const session = queryOne<any>('SELECT id, video_status FROM sessions WHERE patient_access_token = ?', [token]);

  if (!session) {
    res.status(404).json({ error: 'Sessão não encontrada' });
    return;
  }

  execute(
    `UPDATE sessions SET
      patient_joined_at = COALESCE(patient_joined_at, CURRENT_TIMESTAMP),
      video_status = CASE WHEN video_status = 'OPEN' THEN 'ACTIVE' ELSE video_status END
     WHERE id = ?`,
    [session.id]
  );

  res.json({ success: true, joinedAt: new Date().toISOString() });
});

// ==========================================
// 4. PRONTUÁRIO CLÍNICO (RBAC: PROIBIDO PARA SECRETARY)
// ==========================================
router.get(
  '/medical-records',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { patient_id } = req.query;
    if (!patient_id) {
      res.status(400).json({ error: 'patient_id é obrigatório' });
      return;
    }

    const records = queryAll<any>(
      `SELECT r.id, r.patient_id, r.session_id, r.psychologist_id, r.record_type, 
              r.encrypted_content, r.encryption_iv, r.auth_tag, 
              r.is_signed, r.hash_sha256, r.signed_at, r.signed_by_user_id, r.created_at,
              u.name as psychologist_name, u.crp_number as psychologist_crp
       FROM medical_records r
       JOIN users u ON r.psychologist_id = u.id
       WHERE r.patient_id = ?
       ORDER BY r.created_at DESC`,
      [patient_id]
    );

    // Decripta os registros usando AES-256-GCM em memória para entrega segura ao profissional
    const decryptedRecords = records.map((record) => {
      const decrypted = decryptClinicalText({
        encryptedContent: record.encrypted_content,
        iv: record.encryption_iv,
        authTag: record.auth_tag,
      });

      let parsedContent: any = decrypted;
      try {
        parsedContent = JSON.parse(decrypted);
      } catch {
        parsedContent = { raw: decrypted };
      }

      return {
        id: record.id,
        patient_id: record.patient_id,
        session_id: record.session_id,
        record_type: record.record_type,
        content: parsedContent,
        is_signed: Boolean(record.is_signed),
        hash_sha256: record.hash_sha256,
        signed_at: record.signed_at,
        psychologist_name: record.psychologist_name,
        psychologist_crp: record.psychologist_crp,
        created_at: record.created_at,
      };
    });

    recordAuditLog(
      req,
      'ACCESS_MEDICAL_RECORDS',
      `PATIENT #${patient_id}`,
      `Acesso a ${records.length} evoluções do prontuário com decriptação AES-256-GCM`
    );

    res.json({ records: decryptedRecords });
  }
);

router.get(
  '/medical-records/:id',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const record = queryOne<any>(
      `SELECT r.id, r.patient_id, r.session_id, r.psychologist_id, r.record_type, 
              r.encrypted_content, r.encryption_iv, r.auth_tag, 
              r.is_signed, r.hash_sha256, r.signed_at, r.signed_by_user_id, r.created_at,
              u.name as psychologist_name, u.crp_number as psychologist_crp
       FROM medical_records r
       JOIN users u ON r.psychologist_id = u.id
       WHERE r.id = ?`,
      [id]
    );

    if (!record) {
      res.status(404).json({ error: 'Registro de prontuário não encontrado' });
      return;
    }

    const decrypted = decryptClinicalText({
      encryptedContent: record.encrypted_content,
      iv: record.encryption_iv,
      authTag: record.auth_tag,
    });

    let parsedContent: any = decrypted;
    try {
      parsedContent = JSON.parse(decrypted);
    } catch {
      parsedContent = { raw: decrypted };
    }

    res.json({
      record: {
        id: record.id,
        patient_id: record.patient_id,
        session_id: record.session_id,
        record_type: record.record_type,
        content: parsedContent,
        is_signed: Boolean(record.is_signed),
        hash_sha256: record.hash_sha256,
        signed_at: record.signed_at,
        psychologist_name: record.psychologist_name,
        psychologist_crp: record.psychologist_crp,
        created_at: record.created_at,
      },
    });
  }
);

router.post(
  '/medical-records',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { patient_id, session_id, record_type, content } = req.body;

    if (!patient_id || !record_type || !content) {
      res.status(400).json({ error: 'patient_id, record_type e content são obrigatórios' });
      return;
    }

    const psychId = req.user?.id || 1;
    const stringifiedContent = typeof content === 'string' ? content : JSON.stringify(content);

    // Criptografia AES-256-GCM antes de persistir no banco (At-Rest LGPD)
    const encrypted = encryptClinicalText(stringifiedContent);

    const result = execute(
      `INSERT INTO medical_records (patient_id, session_id, psychologist_id, record_type, encrypted_content, encryption_iv, auth_tag, is_signed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        patient_id,
        session_id || null,
        psychId,
        record_type,
        encrypted.encryptedContent,
        encrypted.iv,
        encrypted.authTag,
      ]
    );

    recordAuditLog(
      req,
      'CREATE_MEDICAL_RECORD',
      `MEDICAL_RECORD #${result.lastInsertRowid}`,
      `Evolução criada e criptografada com AES-256-GCM para paciente #${patient_id}`
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Evolução registrada e criptografada com sucesso.',
    });
  }
);

/**
 * Digital signature for medical record: generates SHA-256 hash and locks editing (CFP compliance)
 */
router.post(
  '/medical-records/:id/sign',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const record = queryOne<any>(
      `SELECT r.*, u.name as psych_name, u.crp_number as psych_crp
       FROM medical_records r
       JOIN users u ON r.psychologist_id = u.id
       WHERE r.id = ?`,
      [id]
    );

    if (!record) {
      res.status(404).json({ error: 'Registro clínico não encontrado' });
      return;
    }

    if (record.is_signed) {
      res.status(400).json({ error: 'Este registro já está assinado digitalmente e bloqueado para edições.' });
      return;
    }

    // Decripta para calcular o hash SHA-256 autêntico com identificação do terapeuta
    const plainText = decryptClinicalText({
      encryptedContent: record.encrypted_content,
      iv: record.encryption_iv,
      authTag: record.auth_tag,
    });

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const signaturePayload = `${plainText}|TERAPEUTA:${record.psych_name}|CRP:${record.psych_crp}|DATA:${now}`;
    const hash = generateSHA256(signaturePayload);

    execute(
      `UPDATE medical_records 
       SET is_signed = 1, hash_sha256 = ?, signed_at = ?, signed_by_user_id = ? 
       WHERE id = ?`,
      [hash, now, req.user?.id, id]
    );

    recordAuditLog(
      req,
      'SIGN_MEDICAL_RECORD',
      `MEDICAL_RECORD #${id}`,
      `Registro assinado digitalmente. Hash SHA-256: ${hash}`
    );

    res.json({
      message: 'Prontuário assinado digitalmente e imutável conforme CFP.',
      hash_sha256: hash,
      signed_at: now,
    });
  }
);

// ==========================================
// 5. ANOTAÇÕES CONFIDENCIAIS (CFP 01/2009 - Exclusivo Terapeuta)
// ==========================================
router.get(
  '/confidential-notes',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { patient_id } = req.query;
    if (!patient_id) {
      res.status(400).json({ error: 'patient_id é obrigatório' });
      return;
    }

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role_id === 1;
    const sql = isAdmin
      ? `SELECT id, patient_id, psychologist_id, encrypted_content, encryption_iv, auth_tag, created_at
         FROM confidential_notes
         WHERE patient_id = ?
         ORDER BY created_at DESC`
      : `SELECT id, patient_id, psychologist_id, encrypted_content, encryption_iv, auth_tag, created_at
         FROM confidential_notes
         WHERE patient_id = ? AND psychologist_id = ?
         ORDER BY created_at DESC`;
    const params = isAdmin ? [patient_id] : [patient_id, req.user?.id];

    const notes = queryAll<any>(sql, params);

    const decryptedNotes = notes.map((n) => ({
      id: n.id,
      patient_id: n.patient_id,
      content: decryptClinicalText({
        encryptedContent: n.encrypted_content,
        iv: n.encryption_iv,
        authTag: n.auth_tag,
      }),
      created_at: n.created_at,
    }));

    recordAuditLog(
      req,
      'ACCESS_CONFIDENTIAL_NOTES',
      `PATIENT #${patient_id}`,
      'Acesso a anotações confidenciais do terapeuta (Sigilo CFP 01/2009)'
    );

    res.json({ notes: decryptedNotes });
  }
);

router.post(
  '/confidential-notes',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { patient_id, content } = req.body;
    if (!patient_id || !content) {
      res.status(400).json({ error: 'patient_id e content são obrigatórios' });
      return;
    }

    const psychId = req.user?.id || 1;
    const encrypted = encryptClinicalText(content);

    const result = execute(
      `INSERT INTO confidential_notes (patient_id, psychologist_id, encrypted_content, encryption_iv, auth_tag)
       VALUES (?, ?, ?, ?, ?)`,
      [patient_id, psychId, encrypted.encryptedContent, encrypted.iv, encrypted.authTag]
    );

    recordAuditLog(
      req,
      'CREATE_CONFIDENTIAL_NOTE',
      `CONFIDENTIAL_NOTE #${result.lastInsertRowid}`,
      `Anotação confidencial criada e cifrada com AES-256 para paciente #${patient_id}`
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Anotação confidencial salva com sigilo rigoroso.' });
  }
);

// ==========================================
// 6. DOCUMENTOS CFP (Resolução CFP 06/2019)
// ==========================================
const cfpDocumentSchema = z.object({
  patient_id: z.number(),
  document_type: z.enum(['DECLARACAO', 'ATESTADO', 'RELATORIO', 'LAUDO', 'PARECER']),
  content_json: z.string().min(5, 'Conteúdo inválido'),
});

router.get('/document-templates', authenticateToken, (req: AuthRequest, res: Response) => {
  const psychId = req.user?.id || 1;
  const templates = queryAll<any>(
    `SELECT * FROM document_templates 
     WHERE psychologist_id IS NULL OR psychologist_id = ?
     ORDER BY psychologist_id ASC, title ASC`, 
    [psychId]
  );
  res.json({ templates });
});

router.post('/document-templates', authenticateToken, (req: AuthRequest, res: Response) => {
  const { title, document_type, content_json } = req.body;
  const psychId = req.user?.id || 1;
  const result = execute(
    `INSERT INTO document_templates (psychologist_id, title, document_type, content_json)
     VALUES (?, ?, ?, ?)`,
    [psychId, title, document_type, content_json]
  );
  res.status(201).json({ id: result.lastInsertRowid, message: 'Modelo salvo com sucesso.' });
});

router.delete('/document-templates/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const psychId = req.user?.id || 1;
  execute(
    `DELETE FROM document_templates WHERE id = ? AND psychologist_id = ?`,
    [req.params.id, psychId]
  );
  res.json({ success: true });
});

router.get(
  '/documents',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { patient_id } = req.query;
    let sql = `
      SELECT d.id, d.patient_id, d.psychologist_id, d.document_type, d.content_json, d.content_html, 
             d.hash_sha256, d.is_signed, d.created_at,
             p.full_name as patient_name, u.name as psychologist_name, u.crp_number
      FROM documents d
      JOIN patients p ON d.patient_id = p.id
      JOIN users u ON d.psychologist_id = u.id
    `;
    const params: any[] = [];
    if (patient_id) {
      sql += ` WHERE d.patient_id = ?`;
      params.push(patient_id);
    }
    sql += ` ORDER BY d.created_at DESC`;

    const docs = queryAll(sql, params).map((d) => {
      let parsed = {};
      try {
        parsed = JSON.parse(d.content_json);
      } catch {
        parsed = { text: d.content_json };
      }
      return {
        ...d,
        content: parsed,
      };
    });

    recordAuditLog(req, 'LIST_DOCUMENTS', 'DOCUMENTS_CFP', 'Consulta de documentos psicológicos');
    res.json({ documents: docs });
  }
);

router.post(
  '/documents',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const parse = cfpDocumentSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
      return;
    }

    const { patient_id, document_type, content_json } = parse.data;
    const psychId = req.user?.id || 1;

    const hash = generateSHA256(content_json + `|CRP:${req.user?.crp_number || 'N/A'}|DATA:${new Date().toISOString()}`);

    const result = execute(
      `INSERT INTO documents (patient_id, psychologist_id, document_type, content_json, hash_sha256, is_signed)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [patient_id, psychId, document_type, content_json, hash]
    );

    // Também sincroniza com a aba de documentos do paciente
    try {
      execute(
        `INSERT INTO patient_documents (patient_id, psychologist_id, title, category, document_type, content_json, hash_sha256, is_signed, signed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
        [patient_id, psychId, `${document_type} (Resolução CFP 06/2019)`, document_type, document_type, content_json, hash]
      );
    } catch (e) {
      console.warn('Sync to patient_documents skipped:', e);
    }

    recordAuditLog(
      req,
      'CREATE_CFP_DOCUMENT',
      `DOCUMENT #${result.lastInsertRowid}`,
      `Documento tipo ${document_type} gerado e assinado conforme CFP 06/2019. Hash: ${hash}`
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      hash_sha256: hash,
      message: 'Documento psicológico gerado e assinado digitalmente com sucesso.',
    });
  }
);

// ==========================================
// 6.1 DOCUMENTOS DO PACIENTE (ANAMNESE, LAUDOS, ENCAMINHAMENTOS E ANEXOS)
// ==========================================
const patientDocumentSchema = z.object({
  patient_id: z.number({ message: 'patient_id é obrigatório' }),
  title: z.string().min(3, 'Título é obrigatório (mínimo 3 caracteres)'),
  category: z.enum([
    'ANAMNESE',
    'LAUDO',
    'RELATORIO',
    'ENCAMINHAMENTO',
    'ATESTADO',
    'DECLARACAO',
    'PARECER',
    'ANEXO_EXTERNO',
    'OUTRO',
  ]),
  document_type: z.string().optional(),
  content: z.union([z.record(z.string(), z.any()), z.string()]),
  file_name: z.string().optional().nullable(),
  file_size: z.number().optional().nullable(),
  file_type: z.string().optional().nullable(),
  file_data: z.string().optional().nullable(),
});

router.get(
  '/patient-documents',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { patient_id, category } = req.query;
    let sql = `
      SELECT d.id, d.patient_id, d.psychologist_id, d.title, d.category, d.document_type,
             d.content_json, d.file_name, d.file_size, d.file_type, d.file_data,
             d.hash_sha256, d.is_signed, d.signed_at, d.created_at, d.updated_at,
             p.full_name as patient_name, u.name as psychologist_name, u.crp_number as psychologist_crp
      FROM patient_documents d
      JOIN patients p ON d.patient_id = p.id
      JOIN users u ON d.psychologist_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (patient_id) {
      sql += ` AND d.patient_id = ?`;
      params.push(patient_id);
    }
    if (category) {
      sql += ` AND d.category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY d.created_at DESC`;

    const docs = queryAll(sql, params).map((d) => {
      let parsed = {};
      try {
        parsed = JSON.parse(d.content_json);
      } catch {
        parsed = { raw: d.content_json };
      }
      return {
        ...d,
        content: parsed,
        is_signed: Boolean(d.is_signed),
      };
    });

    recordAuditLog(
      req,
      'LIST_PATIENT_DOCUMENTS',
      patient_id ? `PATIENT #${patient_id}` : 'ALL_DOCUMENTS',
      `Consulta de ${docs.length} documentos clínicos (Anamneses, Encaminhamentos, Laudos)`
    );

    res.json({ documents: docs });
  }
);

router.post(
  '/patient-documents',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const parse = patientDocumentSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados do documento inválidos' });
      return;
    }

    const { patient_id, title, category, document_type, content, file_name, file_size, file_type, file_data } = parse.data;
    const psychId = req.user?.id || 1;
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    const nowIso = new Date().toISOString();
    const hash = generateSHA256(
      contentString +
        `|TITULO:${title}|CAT:${category}|CRP:${req.user?.crp_number || 'N/A'}|DATA:${nowIso}`
    );

    const result = execute(
      `INSERT INTO patient_documents (
        patient_id, psychologist_id, title, category, document_type,
        content_json, file_name, file_size, file_type, file_data,
        hash_sha256, is_signed, signed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      [
        patient_id,
        psychId,
        title,
        category,
        document_type || category,
        contentString,
        file_name || null,
        file_size || null,
        file_type || null,
        file_data || null,
        hash,
      ]
    );

    recordAuditLog(
      req,
      'CREATE_PATIENT_DOCUMENT',
      `PATIENT_DOCUMENT #${result.lastInsertRowid}`,
      `Documento clínico "${title}" (${category}) criado e assinado com Hash SHA-256: ${hash}`
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      hash_sha256: hash,
      message: `Documento "${title}" salvo com sucesso e certificado digitalmente.`,
    });
  }
);

router.delete(
  '/patient-documents/:id',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const doc = queryOne<any>(
      `SELECT id, patient_id, psychologist_id, title, category FROM patient_documents WHERE id = ?`,
      [id]
    );
    if (!doc) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role_id === 1;
    const isAuthor = Number(doc.psychologist_id) === Number(req.user?.id);

    if (!isAdmin && !isAuthor) {
      recordAuditLog(
        req,
        'UNAUTHORIZED_DOCUMENT_DELETE_ATTEMPT',
        `PATIENT_DOCUMENT #${id}`,
        `Acesso negado: psicólogo #${req.user?.id} tentou excluir documento #${id} pertencente ao terapeuta #${doc.psychologist_id}`
      );
      res.status(403).json({
        error: 'Acesso Proibido: Você só tem permissão para excluir documentos clínicos elaborados por você mesmo (Resoluções CFP e LGPD).',
      });
      return;
    }

    execute(`DELETE FROM patient_documents WHERE id = ?`, [id]);

    recordAuditLog(
      req,
      'DELETE_PATIENT_DOCUMENT',
      `PATIENT_DOCUMENT #${id}`,
      `Exclusão do documento "${doc.title}" (${doc.category}) do paciente #${doc.patient_id}`
    );

    res.json({ message: 'Documento removido com sucesso.' });
  }
);

// ==========================================
// 7. ESCALAS PSICOLÓGICAS (PHQ-9 e GAD-7)
// ==========================================
router.get(
  '/scales',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { patient_id } = req.query;
    let sql = `
      SELECT s.id, s.patient_id, s.psychologist_id, s.scale_type, s.answers_json,
             s.total_score, s.severity, s.created_at,
             p.full_name as patient_name
      FROM psychological_scales s
      JOIN patients p ON s.patient_id = p.id
    `;
    const params: any[] = [];
    if (patient_id) {
      sql += ` WHERE s.patient_id = ?`;
      params.push(patient_id);
    }
    sql += ` ORDER BY s.created_at ASC`;

    const scales = queryAll(sql, params).map((s) => ({
      ...s,
      answers: JSON.parse(s.answers_json),
    }));

    recordAuditLog(req, 'READ_SCALES', 'PSYCHOLOGICAL_SCALES', `Consulta de escalas do paciente ${patient_id || 'todos'}`);
    res.json({ scales });
  }
);

router.post(
  '/scales',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { patient_id, scale_type, answers } = req.body;
    if (!patient_id || !scale_type || !answers) {
      res.status(400).json({ error: 'patient_id, scale_type e answers são obrigatórios' });
      return;
    }

    // Calcula escore total
    const values = Object.values(answers).map((v) => Number(v) || 0);
    const totalScore = values.reduce((sum, val) => sum + val, 0);

    let severity = 'Mínima';
    if (scale_type === 'PHQ9') {
      if (totalScore >= 20) severity = 'Grave';
      else if (totalScore >= 15) severity = 'Moderadamente Grave';
      else if (totalScore >= 10) severity = 'Moderada';
      else if (totalScore >= 5) severity = 'Leve';
      else severity = 'Mínima';
    } else if (scale_type === 'GAD7') {
      if (totalScore >= 15) severity = 'Grave';
      else if (totalScore >= 10) severity = 'Moderada';
      else if (totalScore >= 5) severity = 'Leve';
      else severity = 'Mínima';
    }

    const psychId = req.user?.id || 1;
    const result = execute(
      `INSERT INTO psychological_scales (patient_id, psychologist_id, scale_type, answers_json, total_score, severity)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patient_id, psychId, scale_type, JSON.stringify(answers), totalScore, severity]
    );

    recordAuditLog(
      req,
      'APPLY_SCALE',
      `SCALE #${result.lastInsertRowid}`,
      `Escala ${scale_type} aplicada ao paciente #${patient_id}. Escore: ${totalScore} (${severity})`
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      total_score: totalScore,
      severity,
      message: 'Escala registrada com sucesso',
    });
  }
);

// ==========================================
// 8. MÓDULO FINANCEIRO & CARNÊ-LEÃO
// ==========================================
router.get('/financial/summary', authenticateToken, (req: AuthRequest, res: Response) => {
  const totalPaidRow = queryOne<any>(`SELECT SUM(amount) as total FROM financial_transactions WHERE status = 'PAID'`);
  const totalPendingRow = queryOne<any>(`SELECT SUM(amount) as total FROM financial_transactions WHERE status = 'PENDING'`);
  const sessionStats = queryOne<any>(`
    SELECT 
      COUNT(*) as total_sessions,
      SUM(CASE WHEN status = 'COMPLETED' OR status = 'CONFIRMED' THEN 1 ELSE 0 END) as attended,
      SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END) as no_shows
    FROM sessions
  `);

  const revenuePaid = totalPaidRow?.total || 0;
  const revenuePending = totalPendingRow?.total || 0;
  const totalSessions = sessionStats?.total_sessions || 1;
  const attendedSessions = sessionStats?.attended || 0;
  const noShows = sessionStats?.no_shows || 0;

  const occupancyRate = Math.round((attendedSessions / (totalSessions || 1)) * 100);
  const noShowRate = Math.round((noShows / (totalSessions || 1)) * 100);

  // Receitas vs Despesas mensais simuladas para gráfico
  const monthlyData = [
    { mes: 'Mai', receitas: 6400, despesas: 1800 },
    { mes: 'Jun', receitas: 7200, despesas: 1950 },
    { mes: 'Jul', receitas: 8100, despesas: 2100 },
    { mes: 'Ago', receitas: 8900, despesas: 2050 },
    { mes: 'Set', receitas: revenuePaid + 1500, despesas: 2200 },
  ];

  recordAuditLog(req, 'ACCESS_FINANCIAL_SUMMARY', 'FINANCIAL', 'Acesso ao resumo financeiro');

  res.json({
    revenuePaid,
    revenuePending,
    occupancyRate,
    noShowRate,
    monthlyData,
  });
});

router.get('/financial/transactions', authenticateToken, (req: AuthRequest, res: Response) => {
  const transactions = queryAll<any>(`
    SELECT t.id, t.patient_id, t.session_id, t.evaluation_id, t.installment_number, t.total_installments, t.invoice_status,
           t.amount, t.status, t.payment_method, 
           t.transaction_date, t.paid_at, t.notes,
           p.full_name as patient_name, p.cpf as patient_cpf,
           ne.title as evaluation_title
    FROM financial_transactions t
    JOIN patients p ON t.patient_id = p.id
    LEFT JOIN neuropsych_evaluations ne ON t.evaluation_id = ne.id
    ORDER BY t.transaction_date DESC, t.id DESC
  `);

  res.json({ transactions });
});

router.patch('/financial/transactions/:id/status', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, payment_method } = req.body;

  const paidAt = status === 'PAID' ? new Date().toISOString().replace('T', ' ').substring(0, 19) : null;

  execute(
    `UPDATE financial_transactions 
     SET status = ?, payment_method = COALESCE(?, payment_method), paid_at = ? 
     WHERE id = ?`,
    [status, payment_method || null, paidAt, id]
  );

  recordAuditLog(req, 'UPDATE_TRANSACTION', `TRANSACTION #${id}`, `Status financeiro alterado para ${status}`);
  res.json({ message: 'Transação financeira atualizada com sucesso' });
});

/**
 * Busca todas as sessões pendentes de pagamento e futuras recorrentes de um paciente para baixa em lote
 */
router.get('/financial/patient-sessions/:patientId', authenticateToken, (req: AuthRequest, res: Response) => {
  const { patientId } = req.params;
  const patient = queryOne<any>(`SELECT id, full_name, cpf, phone, session_price FROM patients WHERE id = ?`, [patientId]);
  if (!patient) {
    res.status(404).json({ error: 'Paciente não encontrado' });
    return;
  }

  // Busca todas as sessões do paciente (com ou sem transação financeira, exceto avaliações neuropsicológicas)
  const sessions = queryAll<any>(
    `SELECT s.id, s.patient_id, s.start_time, s.end_time, s.status, s.modality, s.price,
            s.notes, s.recurrence_group_id, s.recurrence_pattern,
            t.id as transaction_id, t.amount as transaction_amount, t.status as payment_status,
            t.payment_method, t.paid_at, t.transaction_date, t.notes as transaction_notes
     FROM sessions s
     LEFT JOIN financial_transactions t ON t.session_id = s.id
     WHERE s.patient_id = ? 
       AND (s.evaluation_id IS NULL AND (s.session_type IS NULL OR s.session_type != 'NEUROPSYCH_EVALUATION'))
     ORDER BY s.start_time ASC`,
    [patientId]
  );

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Sessões elegíveis: Qualquer sessão NÃO quitada (PENDING ou sem transação)
  const eligibleSessions = sessions.filter((s) => {
    const isPaid = s.payment_status === 'PAID';
    if (isPaid) return false;

    // Se a sessão está cancelada e não possui cobrança pendente gerada, descarta
    if (s.status === 'CANCELED' && (!s.transaction_id || s.payment_status !== 'PENDING')) {
      return false;
    }

    return true;
  }).map((s) => {
    const sessionDate = new Date(s.start_time);
    const sessionDateStr = s.start_time.split('T')[0];
    const isFuture = sessionDateStr > todayStr || (sessionDateStr === todayStr && sessionDate >= now);
    const isRecurring = Boolean(s.recurrence_group_id);
    const effectiveAmount = s.transaction_amount !== null && s.transaction_amount !== undefined
      ? Number(s.transaction_amount)
      : (s.price !== null && s.price !== undefined ? Number(s.price) : Number(patient.session_price || 180));

    return {
      id: s.id,
      patient_id: s.patient_id,
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
      modality: s.modality,
      price: effectiveAmount,
      recurrence_group_id: s.recurrence_group_id,
      recurrence_pattern: s.recurrence_pattern,
      transaction_id: s.transaction_id,
      payment_status: s.payment_status || 'PENDING',
      is_future: isFuture,
      is_recurring: isRecurring,
      transaction_notes: s.transaction_notes || '',
    };
  });

  // Lançamentos financeiros avulsos pendentes para o paciente (sem sessão vinculada e não sendo de avaliação)
  const standaloneTxs = queryAll<any>(
    `SELECT id as transaction_id, patient_id, amount as transaction_amount, status as payment_status,
            payment_method, transaction_date, notes as transaction_notes
     FROM financial_transactions
     WHERE patient_id = ? AND session_id IS NULL AND evaluation_id IS NULL AND status = 'PENDING'`,
    [patientId]
  );

  for (const st of standaloneTxs) {
    eligibleSessions.push({
      id: -st.transaction_id,
      patient_id: st.patient_id,
      start_time: `${st.transaction_date}T12:00:00`,
      end_time: `${st.transaction_date}T12:50:00`,
      status: 'SCHEDULED',
      modality: 'PRESENTIAL',
      price: Number(st.transaction_amount),
      recurrence_group_id: null,
      recurrence_pattern: 'Lançamento Avulso',
      transaction_id: st.transaction_id,
      payment_status: 'PENDING',
      is_future: false,
      is_recurring: false,
      transaction_notes: st.transaction_notes || 'Lançamento Avulso',
    });
  }

  // Sessões já pagas (histórico para verificação)
  const paidSessions = sessions.filter((s) => s.payment_status === 'PAID').map((s) => ({
    id: s.id,
    start_time: s.start_time,
    status: s.status,
    price: Number(s.transaction_amount || s.price),
    payment_method: s.payment_method,
    paid_at: s.paid_at,
  }));

  res.json({
    patient: {
      id: patient.id,
      full_name: patient.full_name,
      cpf: patient.cpf || '',
      phone: patient.phone || '',
    },
    sessions: eligibleSessions,
    paid_sessions: paidSessions,
  });
});

/**
 * Dar baixa financeira em lote para sessões selecionadas (pendentes ou futuras)
 */
const settleSessionsSchema = z.object({
  patient_id: z.number(),
  payment_date: z.string().min(10, 'Data de pagamento é obrigatória'),
  payment_method: z.string().min(1, 'Forma de pagamento é obrigatória'),
  notes: z.string().optional().default(''),
  settlements: z.array(
    z.object({
      session_id: z.number(),
      amount: z.number().min(0, 'Valor da sessão deve ser positivo'),
    })
  ).min(1, 'Selecione pelo menos uma sessão para dar baixa'),
});

function normalizePaymentMethod(method: any): 'PIX' | 'CARTAO' | 'DINHEIRO' | 'BOLETO' {
  if (!method || typeof method !== 'string') return 'PIX';
  const clean = method.trim().toUpperCase();
  if (clean === 'PIX') return 'PIX';
  if (clean.includes('CART') || clean.includes('CREDIT') || clean.includes('DEBIT')) return 'CARTAO';
  if (clean.includes('DINHEIRO') || clean.includes('ESPECIE') || clean.includes('CASH')) return 'DINHEIRO';
  if (clean.includes('BOLETO') || clean.includes('CONVENIO')) return 'BOLETO';
  if (clean.includes('TRANSFER') || clean.includes('TED') || clean.includes('DOC') || clean.includes('BANC')) return 'PIX';
  return 'PIX';
}

router.post('/financial/settle-sessions', authenticateToken, (req: AuthRequest, res: Response) => {
  const parse = settleSessionsSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  const { patient_id, payment_date, payment_method, notes, settlements } = parse.data;
  const cleanPaymentMethod = normalizePaymentMethod(payment_method);

  const patient = queryOne<any>(`SELECT id, full_name, cpf FROM patients WHERE id = ?`, [patient_id]);
  if (!patient) {
    res.status(404).json({ error: 'Paciente não encontrado' });
    return;
  }

  let totalAmount = 0;
  const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

  for (const item of settlements) {
    totalAmount += item.amount;

    if (item.session_id > 0) {
      // 1. Atualiza o preço individual da sessão na tabela sessions
      execute(`UPDATE sessions SET price = ? WHERE id = ?`, [item.amount, item.session_id]);

      // 2. Cria ou atualiza a transação financeira correspondente como PAID
      const existingTx = queryOne<any>(`SELECT id FROM financial_transactions WHERE session_id = ?`, [item.session_id]);

      if (existingTx) {
        execute(
          `UPDATE financial_transactions
           SET amount = ?, status = 'PAID', payment_method = ?, transaction_date = ?, paid_at = ?, notes = ?
           WHERE id = ?`,
          [item.amount, cleanPaymentMethod, payment_date, nowIso, notes || null, existingTx.id]
        );
      } else {
        execute(
          `INSERT INTO financial_transactions (
            patient_id, session_id, amount, status, payment_method, transaction_date, paid_at, notes
          ) VALUES (?, ?, ?, 'PAID', ?, ?, ?, ?)`,
          [patient_id, item.session_id, item.amount, cleanPaymentMethod, payment_date, nowIso, notes || null]
        );
      }
    } else {
      // Transação avulsa (id negativo)
      const txId = Math.abs(item.session_id);
      execute(
        `UPDATE financial_transactions
         SET amount = ?, status = 'PAID', payment_method = ?, transaction_date = ?, paid_at = ?, notes = ?
         WHERE id = ?`,
        [item.amount, cleanPaymentMethod, payment_date, nowIso, notes || null, txId]
      );
    }
  }

  recordAuditLog(
    req,
    'SETTLE_SESSIONS_BATCH',
    `PATIENT #${patient_id}`,
    `Baixa de ${settlements.length} sessão(ões) para o paciente ${patient.full_name}. Total: R$ ${totalAmount.toFixed(2)} via ${payment_method} em ${payment_date}`
  );

  res.json({
    message: `Baixa de ${settlements.length} sessão(ões) realizada com sucesso!`,
    settled_count: settlements.length,
    total_amount: totalAmount,
  });
});

/**
 * Busca dados da avaliação e suas parcelas financeiras para o modal de baixa de avaliação
 */
router.get('/financial/evaluation-installments/:evaluationId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const evaluationId = Number(req.params.evaluationId);
    const evaluation = queryOne<any>(
      `SELECT e.*, p.full_name as patient_name, p.cpf as patient_cpf, p.phone as patient_phone
       FROM neuropsych_evaluations e
       JOIN patients p ON e.patient_id = p.id
       WHERE e.id = ?`,
      [evaluationId]
    );

    if (!evaluation) {
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }

    const installments = queryAll<any>(
      `SELECT t.*,
              COALESCE(active_inv.invoice_status, 'NONE') as fiscal_status,
              active_inv.invoice_id,
              active_inv.invoice_number
       FROM financial_transactions t
       LEFT JOIN (
         SELECT ii.transaction_id, inv.id as invoice_id, inv.status as invoice_status, inv.invoice_number
         FROM invoice_items ii
         JOIN invoices inv ON ii.invoice_id = inv.id
         WHERE inv.status != 'CANCELED' AND ii.transaction_id IS NOT NULL
       ) active_inv ON active_inv.transaction_id = t.id
       WHERE t.evaluation_id = ?
       ORDER BY t.installment_number ASC, t.id ASC`,
      [evaluationId]
    );

    const pendingInstallments = installments.filter((i) => i.status !== 'PAID');
    const paidInstallments = installments.filter((i) => i.status === 'PAID');

    const defaultPaymentMethod = normalizePaymentMethod(
      pendingInstallments[0]?.payment_method || installments[0]?.payment_method || 'PIX'
    );

    res.json({
      evaluation: {
        id: evaluation.id,
        title: evaluation.title,
        contract_value: evaluation.total_price,
        total_price: evaluation.total_price,
        status: evaluation.status,
        payment_method: defaultPaymentMethod,
        payment_mode: evaluation.payment_mode,
        installments_count: installments.length,
        estimated_sessions: evaluation.estimated_sessions,
        patient_id: evaluation.patient_id,
        patient_name: evaluation.patient_name,
        patient_cpf: evaluation.patient_cpf,
        patient_phone: evaluation.patient_phone,
      },
      patient: {
        id: evaluation.patient_id,
        full_name: evaluation.patient_name,
        cpf: evaluation.patient_cpf,
        phone: evaluation.patient_phone,
      },
      pending_installments: pendingInstallments,
      installments: pendingInstallments,
      paid_installments: paidInstallments,
    });
  } catch (err) {
    console.error('Error fetching evaluation installments:', err);
    res.status(500).json({ error: 'Erro ao buscar parcelas da avaliação' });
  }
});

/**
 * Dar baixa financeira em lote para parcelas de avaliação neuropsicológica selecionadas
 */
const settleEvalSchema = z.object({
  evaluation_id: z.number(),
  transaction_ids: z.array(z.number()).optional(),
  settlements: z.array(z.object({
    transaction_id: z.number(),
    amount: z.number().optional(),
  })).optional(),
  payment_date: z.string().min(10, 'Data de pagamento é obrigatória'),
  payment_method: z.string().min(1, 'Forma de pagamento é obrigatória'),
  notes: z.string().optional().default(''),
});

router.post('/financial/settle-evaluation-installments', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const parse = settleEvalSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    }

    const { evaluation_id, transaction_ids, settlements, payment_date, payment_method, notes } = parse.data;
    const cleanPaymentMethod = normalizePaymentMethod(payment_method);

    const txIds = transaction_ids && transaction_ids.length > 0 
      ? transaction_ids 
      : (settlements?.map(s => s.transaction_id) || []);

    if (txIds.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos uma parcela para quitação' });
    }

    const evaluation = queryOne<any>(
      `SELECT e.*, p.full_name as patient_name FROM neuropsych_evaluations e JOIN patients p ON e.patient_id = p.id WHERE e.id = ?`,
      [evaluation_id]
    );
    if (!evaluation) {
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }

    const paidAt = payment_date.includes(' ') ? payment_date : `${payment_date} 12:00:00`;

    for (const txId of txIds) {
      const settlementItem = settlements?.find(s => s.transaction_id === txId);
      if (settlementItem && typeof settlementItem.amount === 'number') {
        execute(
          `UPDATE financial_transactions 
           SET status = 'PAID', 
               amount = ?,
               paid_at = ?, 
               payment_method = ?, 
               notes = CASE WHEN ? != '' THEN ? ELSE notes END
           WHERE id = ? AND evaluation_id = ?`,
          [settlementItem.amount, paidAt, cleanPaymentMethod, notes, notes, txId, evaluation_id]
        );
      } else {
        execute(
          `UPDATE financial_transactions 
           SET status = 'PAID', 
               paid_at = ?, 
               payment_method = ?, 
               notes = CASE WHEN ? != '' THEN ? ELSE notes END
           WHERE id = ? AND evaluation_id = ?`,
          [paidAt, cleanPaymentMethod, notes, notes, txId, evaluation_id]
        );
      }
    }

    recordAuditLog(
      req,
      'SETTLE_EVALUATION_INSTALLMENTS',
      `EVALUATION #${evaluation_id}`,
      `Deu baixa em ${txIds.length} parcela(s) da avaliação de ${evaluation.patient_name} via ${cleanPaymentMethod} em ${payment_date}`
    );

    res.json({
      success: true,
      message: `${txIds.length} parcela(s) quitada(s) com sucesso!`,
      settled_transaction_ids: txIds,
    });
  } catch (err: any) {
    console.error('Error settling evaluation installments:', err);
    res.status(500).json({ error: err?.message || 'Erro ao quitar parcelas da avaliação' });
  }
});

/**
 * Exportar dados para Carnê-Leão (Receita Federal / Código de Ocupação 2251-05 Psicólogo)
 */
router.get('/financial/carne-leao', authenticateToken, (req: AuthRequest, res: Response) => {
  const records = queryAll<any>(`
    SELECT t.id, t.transaction_date as data_pagamento, t.amount as valor,
           p.full_name as titular_pagamento, p.cpf as cpf_titular,
           '2251-05' as codigo_ocupacao,
           'Honorários de Serviços Psicológicos / Psicoterapia' as historico
    FROM financial_transactions t
    JOIN patients p ON t.patient_id = p.id
    WHERE t.status = 'PAID'
    ORDER BY t.transaction_date ASC
  `);

  recordAuditLog(req, 'EXPORT_CARNE_LEAO', 'FINANCIAL', `Exportação de dados para Carnê-Leão (${records.length} registros)`);
  res.json({ carneLeaoRecords: records });
});

// ==========================================
// MÓDULO FISCAL & CARNÊ-LEÃO PREMIUM
// ==========================================

/**
 * Obter configurações fiscais do psicólogo
 */
router.get('/fiscal/settings/:userId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    if (req.user?.role === 'PSYCHOLOGIST' && req.user.id !== targetUserId) {
      return res.status(403).json({ error: 'Acesso não autorizado às configurações fiscais de outro profissional' });
    }

    const settings = getFiscalSettings(targetUserId);
    res.json({ settings });
  } catch (err: any) {
    console.error('Error fetching fiscal settings:', err);
    res.status(500).json({ error: 'Erro ao buscar configurações fiscais' });
  }
});

/**
 * Salvar / Atualizar configurações fiscais do psicólogo
 */
router.put('/fiscal/settings/:userId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    if (req.user?.role === 'PSYCHOLOGIST' && req.user.id !== targetUserId) {
      return res.status(403).json({ error: 'Acesso não autorizado às configurações fiscais de outro profissional' });
    }

    const updated = saveFiscalSettings(targetUserId, req.body);
    recordAuditLog(req, 'UPDATE_FISCAL_SETTINGS', `USER #${targetUserId}`, `Atualização de perfil tributário/fiscal`);
    res.json({ settings: updated, message: 'Configurações fiscais atualizadas com sucesso' });
  } catch (err: any) {
    console.error('Error saving fiscal settings:', err);
    res.status(500).json({ error: 'Erro ao salvar configurações fiscais' });
  }
});

/**
 * Obter sumário mensal completo do Carnê-Leão e Livro-Caixa
 */
router.get('/fiscal/carne-leao-summary', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const year = parseInt(req.query.year as string, 10) || today.getFullYear();
    const month = parseInt(req.query.month as string, 10) || (today.getMonth() + 1);

    let targetPsychologistId = req.user?.id || 1;
    if (req.query.psychologistId) {
      const requestedId = parseInt(req.query.psychologistId as string, 10);
      if (req.user?.role === 'PSYCHOLOGIST' && req.user.id !== requestedId) {
        return res.status(403).json({ error: 'Acesso negado: sigilo ético e fiscal do profissional' });
      }
      targetPsychologistId = requestedId;
    }

    const summary = calculateCarneLeaoCompetence(targetPsychologistId, year, month);
    res.json({ summary });
  } catch (err: any) {
    console.error('Error calculating carne-leao summary:', err);
    res.status(500).json({ error: 'Erro ao apurar demonstrativo do Carnê-Leão' });
  }
});

/**
 * Exportar CSV de Rendimentos oficial para e-CAC (Carnê-Leão Web)
 */
router.get('/fiscal/export-rendimentos-csv', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const year = parseInt(req.query.year as string, 10) || today.getFullYear();
    const month = parseInt(req.query.month as string, 10) || (today.getMonth() + 1);

    let targetPsychologistId = req.user?.id || 1;
    if (req.query.psychologistId) {
      const requestedId = parseInt(req.query.psychologistId as string, 10);
      if (req.user?.role === 'PSYCHOLOGIST' && req.user.id !== requestedId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      targetPsychologistId = requestedId;
    }

    const summary = calculateCarneLeaoCompetence(targetPsychologistId, year, month);
    const csvContent = generateRendimentosCsv(summary);

    recordAuditLog(req, 'EXPORT_CARNE_LEAO_CSV', 'REVENUE', `Exportação CSV de rendimentos e-CAC (${year}-${month})`);

    const monthStr = String(month).padStart(2, '0');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rendimentos_carne_leao_${year}_${monthStr}.csv"`);
    res.send('\uFEFF' + csvContent);
  } catch (err: any) {
    console.error('Error exporting rendimentos CSV:', err);
    res.status(500).json({ error: 'Erro ao gerar arquivo CSV de rendimentos' });
  }
});

/**
 * Exportar CSV de Despesas/Pagamentos oficial para e-CAC (Livro-Caixa Web)
 */
router.get('/fiscal/export-despesas-csv', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const year = parseInt(req.query.year as string, 10) || today.getFullYear();
    const month = parseInt(req.query.month as string, 10) || (today.getMonth() + 1);

    let targetPsychologistId = req.user?.id || 1;
    if (req.query.psychologistId) {
      const requestedId = parseInt(req.query.psychologistId as string, 10);
      if (req.user?.role === 'PSYCHOLOGIST' && req.user.id !== requestedId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      targetPsychologistId = requestedId;
    }

    const summary = calculateCarneLeaoCompetence(targetPsychologistId, year, month);
    const csvContent = generateDespesasCsv(summary);

    recordAuditLog(req, 'EXPORT_LIVRO_CAIXA_CSV', 'EXPENSE', `Exportação CSV de despesas e-CAC (${year}-${month})`);

    const monthStr = String(month).padStart(2, '0');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="despesas_livro_caixa_${year}_${monthStr}.csv"`);
    res.send('\uFEFF' + csvContent);
  } catch (err: any) {
    console.error('Error exporting despesas CSV:', err);
    res.status(500).json({ error: 'Erro ao gerar arquivo CSV de despesas' });
  }
});

/**
 * Obter dados completos para o Dossiê / DRE Fiscal em PDF Timbrado com Selo SHA-256
 */
router.get('/fiscal/dossier-data', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const year = parseInt(req.query.year as string, 10) || today.getFullYear();
    const month = parseInt(req.query.month as string, 10) || (today.getMonth() + 1);

    let targetPsychologistId = req.user?.id || 1;
    if (req.query.psychologistId) {
      const requestedId = parseInt(req.query.psychologistId as string, 10);
      if (req.user?.role === 'PSYCHOLOGIST' && req.user.id !== requestedId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      targetPsychologistId = requestedId;
    }

    const summary = calculateCarneLeaoCompetence(targetPsychologistId, year, month);
    const clinicSettings = queryOne<any>(`SELECT clinic_name, cnpj, address, phone, email, logo_base64 FROM clinic_settings WHERE id = 1`) || {};

    const dossier = generateDossierData(summary, clinicSettings);
    recordAuditLog(req, 'VIEW_FISCAL_DOSSIER', `COMPETENCE ${summary.competence.label}`, `Visualização do Dossiê Fiscal com SHA-256`);

    res.json({ dossier });
  } catch (err: any) {
    console.error('Error fetching fiscal dossier data:', err);
    res.status(500).json({ error: 'Erro ao gerar dados do dossiê fiscal' });
  }
});

/**
 * 8.2 COBRANÇAS & LEMBRETES VIA WHATSAPP
 * Busca consolidada de todos os pacientes com sessões em aberto (não pagas),
 * com contagem de sessões, relação de datas, valores individuais e total.
 * Suporta separação estrita entre Psicoterapia e Avaliações Neuropsicológicas,
 * régua de vencimento, histórico de contatos e chave PIX da clínica.
 */
router.get('/financial/billings-summary', authenticateToken, (req: AuthRequest, res: Response) => {
  const { search } = req.query;

  let patientsQuery = `SELECT id, full_name, cpf, phone, session_price, group_type, guardian_json, financial_responsible_json, whatsapp_routing_json FROM patients WHERE 1=1`;
  const params: any[] = [];
  if (search && typeof search === 'string') {
    patientsQuery += ` AND (full_name LIKE ? OR phone LIKE ? OR cpf LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  patientsQuery += ` ORDER BY full_name ASC`;
  const allPatients = queryAll<any>(patientsQuery, params);

  const clinicSettings = queryOne<any>(
    'SELECT clinic_name, phone, email, pix_key, pix_key_type, pix_beneficiary, bank_info FROM clinic_settings WHERE id = 1'
  ) || {};

  if (allPatients.length === 0) {
    return res.json({
      billings: [],
      psychotherapy_billings: [],
      evaluation_billings: [],
      summary: {
        total_pending_amount: 0,
        total_pending_sessions: 0,
        patients_with_pending_count: 0,
        evaluations_overdue_amount: 0,
        evaluations_overdue_count: 0,
        evaluations_preventive_amount: 0,
        evaluations_preventive_count: 0,
        evaluations_total_active_amount: 0,
        evaluations_with_pending_count: 0,
        global_active_amount: 0,
      },
      psychologist: {
        name: req.user?.name || 'Dr. Marcos Silveira',
        crp: req.user?.crp_number || 'CRP 06/128945-SP',
      },
      clinic_settings: clinicSettings,
    });
  }

  const allPatientIds = allPatients.map(p => p.id);
  const patientPlaceholders = allPatientIds.map(() => '?').join(',');

  const allSessions = queryAll<any>(
    `SELECT s.id, s.patient_id, s.start_time, s.end_time, s.status, s.modality, s.price,
            s.notes, s.recurrence_group_id, s.recurrence_pattern, s.session_type, s.evaluation_id,
            t.id as transaction_id, t.amount as transaction_amount, t.status as payment_status,
            t.payment_method, t.paid_at, t.transaction_date, t.notes as transaction_notes
     FROM sessions s
     LEFT JOIN financial_transactions t ON t.session_id = s.id
     WHERE s.patient_id IN (${patientPlaceholders})
     ORDER BY s.start_time ASC`,
    allPatientIds
  );

  const sessionsByPatientId = new Map<number, any[]>();
  for (const s of allSessions) {
    let list = sessionsByPatientId.get(s.patient_id);
    if (!list) {
      list = [];
      sessionsByPatientId.set(s.patient_id, list);
    }
    list.push(s);
  }

  // Standalone transactions that are NOT evaluations
  const allStandaloneTxs = queryAll<any>(
    `SELECT id as transaction_id, patient_id, amount as transaction_amount, status as payment_status,
            payment_method, transaction_date, notes as transaction_notes
     FROM financial_transactions
     WHERE patient_id IN (${patientPlaceholders}) AND session_id IS NULL AND evaluation_id IS NULL AND status = 'PENDING'`,
    allPatientIds
  );

  const standaloneByPatientId = new Map<number, any[]>();
  for (const st of allStandaloneTxs) {
    let list = standaloneByPatientId.get(st.patient_id);
    if (!list) {
      list = [];
      standaloneByPatientId.set(st.patient_id, list);
    }
    list.push(st);
  }

  // Billing contacts for all patients
  const allContacts = queryAll<any>(
    `SELECT bc.*, u.name as created_by_name
     FROM billing_contacts bc
     LEFT JOIN users u ON bc.created_by_user_id = u.id
     WHERE bc.patient_id IN (${patientPlaceholders})
     ORDER BY bc.created_at DESC, bc.id DESC`,
    allPatientIds
  );

  const contactsByPatientId = new Map<number, any[]>();
  const contactsByEvalId = new Map<number, any[]>();
  for (const c of allContacts) {
    let pList = contactsByPatientId.get(c.patient_id);
    if (!pList) {
      pList = [];
      contactsByPatientId.set(c.patient_id, pList);
    }
    pList.push(c);

    if (c.evaluation_id) {
      let eList = contactsByEvalId.get(c.evaluation_id);
      if (!eList) {
        eList = [];
        contactsByEvalId.set(c.evaluation_id, eList);
      }
      eList.push(c);
    }
  }

  const todayStr = new Date().toISOString().substring(0, 10);
  const todayDate = new Date(todayStr + 'T00:00:00Z');
  const preventiveLimitDate = new Date(todayDate.getTime() + 5 * 24 * 60 * 60 * 1000);
  const preventiveLimitStr = preventiveLimitDate.toISOString().substring(0, 10);

  // Helper for contact badge
  const computeContactBadge = (contact?: any) => {
    if (!contact) return { badge: 'NEVER_CONTACTED', label: 'Nunca contatado', color: 'gray' };
    if (contact.agreement_date) {
      if (contact.agreement_date >= todayStr) {
        return {
          badge: 'AGREEMENT_PENDING',
          label: `Acordo: prometeu para ${contact.agreement_date.split('-').reverse().join('/')}`,
          color: 'blue',
          agreement_date: contact.agreement_date,
          agreement_notes: contact.agreement_notes
        };
      } else {
        return {
          badge: 'AGREEMENT_OVERDUE',
          label: `Acordo Vencido (${contact.agreement_date.split('-').reverse().join('/')})`,
          color: 'red',
          agreement_date: contact.agreement_date,
          agreement_notes: contact.agreement_notes
        };
      }
    }
    const contactDate = new Date(contact.created_at);
    const daysSince = Math.max(0, Math.floor((Date.now() - contactDate.getTime()) / (24 * 3600 * 1000)));
    if (daysSince <= 7) {
      return {
        badge: 'RECENTLY_CONTACTED',
        label: daysSince === 0 ? 'Contatado hoje' : `Contatado há ${daysSince}d`,
        color: 'green',
        days_since: daysSince
      };
    } else {
      return {
        badge: 'OVERDUE_CONTACT',
        label: `Sem cobrança há ${daysSince}d`,
        color: 'amber',
        days_since: daysSince
      };
    }
  };

  // Build Psychotherapy Billings
  const psychotherapy_billings: any[] = [];
  let totalPendingAll = 0;
  let totalPendingSessionsCountAll = 0;
  let totalPsychOverdueAmount = 0;
  let totalPsychOverdueCount = 0;
  let totalPsychOverduePatientsCount = 0;
  let totalPsychPreventiveAmount = 0;
  let totalPsychPreventiveCount = 0;
  let totalPsychPreventivePatientsCount = 0;
  let totalPsychAgreementPatientsCount = 0;

  for (const patient of allPatients) {
    const sessions = sessionsByPatientId.get(patient.id) || [];
    const eligibleSessions: any[] = [];

    for (const s of sessions) {
      if (s.session_type === 'EVALUATION') continue; // Coberto por pacote de avaliação
      if (s.payment_status === 'PAID') continue;
      if (s.status === 'CANCELED' && (!s.transaction_id || s.payment_status !== 'PENDING')) continue;

      const effectivePrice = s.transaction_amount !== null && s.transaction_amount !== undefined
        ? Number(s.transaction_amount)
        : (s.price !== null && s.price !== undefined ? Number(s.price) : Number(patient.session_price || 180));

      eligibleSessions.push({
        id: s.id,
        start_time: s.start_time,
        end_time: s.end_time,
        price: effectivePrice,
        modality: s.modality || 'PRESENTIAL',
        status: s.status,
        recurrence_pattern: s.recurrence_pattern,
        is_recurring: Boolean(s.recurrence_group_id),
        notes: s.notes || '',
        transaction_id: s.transaction_id || null,
      });
    }

    const standaloneTxs = standaloneByPatientId.get(patient.id) || [];
    for (const st of standaloneTxs) {
      eligibleSessions.push({
        id: -st.transaction_id,
        start_time: `${st.transaction_date}T12:00:00`,
        end_time: `${st.transaction_date}T12:50:00`,
        price: Number(st.transaction_amount),
        modality: 'PRESENTIAL',
        status: 'SCHEDULED',
        recurrence_pattern: 'Lançamento Avulso',
        is_recurring: false,
        notes: st.transaction_notes || 'Lançamento Avulso',
        transaction_id: st.transaction_id,
      });
    }

    if (eligibleSessions.length > 0) {
      const patientTotal = eligibleSessions.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
      totalPendingAll += patientTotal;
      totalPendingSessionsCountAll += eligibleSessions.length;

      let patientOverdueCount = 0;
      let patientOverdueAmount = 0;
      let patientPreventiveCount = 0;
      let patientPreventiveAmount = 0;
      let patientFutureCount = 0;
      let patientFutureAmount = 0;

      for (const s of eligibleSessions) {
        const sDateStr = s.start_time ? s.start_time.split('T')[0] : todayStr;
        const sDate = new Date(sDateStr + 'T00:00:00Z');
        const diffDays = Math.round((todayDate.getTime() - sDate.getTime()) / (24 * 3600 * 1000));

        let dueStatus = 'OVERDUE';
        let daysOverdue = 0;
        let daysUntilDue = 0;
        let isEligible = false;

        if (diffDays > 0) {
          dueStatus = 'OVERDUE';
          daysOverdue = diffDays;
          isEligible = true;
          patientOverdueCount++;
          patientOverdueAmount += s.price;
        } else if (diffDays === 0) {
          dueStatus = 'DUE_TODAY';
          daysOverdue = 0;
          isEligible = true;
          patientOverdueCount++;
          patientOverdueAmount += s.price;
        } else if (sDateStr <= preventiveLimitStr) {
          dueStatus = 'PREVENTIVE';
          daysUntilDue = -diffDays;
          isEligible = true;
          patientPreventiveCount++;
          patientPreventiveAmount += s.price;
        } else {
          dueStatus = 'FUTURE';
          daysUntilDue = -diffDays;
          isEligible = false;
          patientFutureCount++;
          patientFutureAmount += s.price;
        }

        s.due_status = dueStatus;
        s.days_overdue = daysOverdue;
        s.days_until_due = daysUntilDue;
        s.is_overdue = diffDays >= 0;
        s.is_preventive = diffDays < 0 && sDateStr <= preventiveLimitStr;
        s.is_eligible_for_active_billing = isEligible;
      }

      if (patientOverdueCount > 0) {
        totalPsychOverduePatientsCount++;
      }
      if (patientPreventiveCount > 0) {
        totalPsychPreventivePatientsCount++;
      }
      totalPsychOverdueAmount += patientOverdueAmount;
      totalPsychOverdueCount += patientOverdueCount;
      totalPsychPreventiveAmount += patientPreventiveAmount;
      totalPsychPreventiveCount += patientPreventiveCount;

      let guardian: any = undefined;
      if (patient.guardian_json) {
        try {
          guardian = typeof patient.guardian_json === 'string' ? JSON.parse(patient.guardian_json) : patient.guardian_json;
        } catch { guardian = undefined; }
      }

      let financial_responsible: any = undefined;
      if (patient.financial_responsible_json) {
        try {
          financial_responsible = typeof patient.financial_responsible_json === 'string'
            ? JSON.parse(patient.financial_responsible_json)
            : patient.financial_responsible_json;
        } catch { financial_responsible = undefined; }
      }

      let whatsapp_routing: any = undefined;
      if (patient.whatsapp_routing_json) {
        try {
          whatsapp_routing = typeof patient.whatsapp_routing_json === 'string'
            ? JSON.parse(patient.whatsapp_routing_json)
            : patient.whatsapp_routing_json;
        } catch { whatsapp_routing = undefined; }
      }

      const pContacts = contactsByPatientId.get(patient.id) || [];
      const psychContact = pContacts.find(c => !c.evaluation_id) || pContacts[0];
      const contactInfo = computeContactBadge(psychContact);

      if (contactInfo.badge === 'AGREEMENT_PENDING' || contactInfo.badge === 'AGREEMENT_OVERDUE') {
        totalPsychAgreementPatientsCount++;
      }

      psychotherapy_billings.push({
        patient_id: patient.id,
        patient_name: patient.full_name,
        cpf: patient.cpf || '',
        phone: patient.phone || '',
        group: patient.group_type || 'Adulto',
        guardian,
        financial_responsible,
        whatsapp_routing,
        pending_count: eligibleSessions.length,
        total_pending_amount: patientTotal,
        overdue_sessions_count: patientOverdueCount,
        overdue_amount: patientOverdueAmount,
        preventive_sessions_count: patientPreventiveCount,
        preventive_amount: patientPreventiveAmount,
        future_sessions_count: patientFutureCount,
        future_amount: patientFutureAmount,
        has_overdue: patientOverdueCount > 0,
        has_preventive: patientPreventiveCount > 0,
        has_agreement: contactInfo.badge === 'AGREEMENT_PENDING' || contactInfo.badge === 'AGREEMENT_OVERDUE',
        sessions: eligibleSessions,
        oldest_date: eligibleSessions[0]?.start_time,
        latest_date: eligibleSessions[eligibleSessions.length - 1]?.start_time,
        last_contact: psychContact || null,
        contact_badge: contactInfo,
      });
    }
  }

  psychotherapy_billings.sort((a, b) => b.total_pending_amount - a.total_pending_amount);

  // Build Evaluation Billings
  const allEvaluations = queryAll<any>(
    `SELECT e.*, u.name as psychologist_name, p.full_name as patient_name, p.cpf as patient_cpf,
            p.phone as patient_phone, p.guardian_json, p.financial_responsible_json, p.whatsapp_routing_json
     FROM neuropsych_evaluations e
     JOIN users u ON e.psychologist_id = u.id
     JOIN patients p ON e.patient_id = p.id
     WHERE e.patient_id IN (${patientPlaceholders}) AND e.status != 'CANCELED'
     ORDER BY e.created_at DESC`,
    allPatientIds
  );

  const allEvalInstallments = queryAll<any>(
    `SELECT id as transaction_id, patient_id, amount, status, payment_method,
            transaction_date as due_date, paid_at, notes, installment_number, total_installments,
            evaluation_id
     FROM financial_transactions
     WHERE evaluation_id IS NOT NULL AND patient_id IN (${patientPlaceholders})
     ORDER BY installment_number ASC, transaction_date ASC`,
    allPatientIds
  );

  const installmentsByEvalId = new Map<number, any[]>();
  for (const inst of allEvalInstallments) {
    let list = installmentsByEvalId.get(inst.evaluation_id);
    if (!list) {
      list = [];
      installmentsByEvalId.set(inst.evaluation_id, list);
    }
    list.push(inst);
  }

  const evaluation_billings: any[] = [];
  let totalEvalOverdueAmount = 0;
  let totalEvalOverdueCount = 0;
  let totalEvalPreventiveAmount = 0;
  let totalEvalPreventiveCount = 0;

  for (const ev of allEvaluations) {
    const rawInstallments = installmentsByEvalId.get(ev.id) || [];
    if (rawInstallments.length === 0) continue;

    let evalPaidCount = 0;
    let evalPaidAmount = 0;
    let evalPendingCount = 0;
    let evalPendingAmount = 0;
    let evalOverdueCount = 0;
    let evalOverdueAmount = 0;
    let evalPreventiveCount = 0;
    let evalPreventiveAmount = 0;

    const parsedInstallments = rawInstallments.map((inst) => {
      const amount = Number(inst.amount) || 0;
      const isPaid = inst.status === 'PAID';
      let installmentStatus = isPaid ? 'PAID' : 'PENDING';
      let daysOverdue = 0;
      let daysUntilDue = 0;
      let isEligible = false;

      if (isPaid) {
        evalPaidCount++;
        evalPaidAmount += amount;
      } else {
        evalPendingCount++;
        evalPendingAmount += amount;

        const dueDate = inst.due_date;
        if (dueDate) {
          const instDate = new Date(dueDate + 'T00:00:00Z');
          const diffDays = Math.round((todayDate.getTime() - instDate.getTime()) / (24 * 3600 * 1000));
          
          if (diffDays > 0) {
            // Overdue
            installmentStatus = 'OVERDUE';
            daysOverdue = diffDays;
            isEligible = true;
            evalOverdueCount++;
            evalOverdueAmount += amount;
          } else if (diffDays === 0) {
            // Due today
            installmentStatus = 'DUE_TODAY';
            daysOverdue = 0;
            isEligible = true;
            evalOverdueCount++;
            evalOverdueAmount += amount;
          } else if (dueDate <= preventiveLimitStr) {
            // Due in 1-5 days (Preventive)
            installmentStatus = 'PREVENTIVE';
            daysUntilDue = -diffDays;
            isEligible = true;
            evalPreventiveCount++;
            evalPreventiveAmount += amount;
          } else {
            // Distant future (> 5 days)
            installmentStatus = 'FUTURE';
            daysUntilDue = -diffDays;
            isEligible = false;
          }
        }
      }

      return {
        transaction_id: inst.transaction_id,
        evaluation_id: ev.id,
        installment_number: inst.installment_number || 1,
        total_installments: inst.total_installments || rawInstallments.length,
        amount,
        due_date: inst.due_date,
        paid_at: inst.paid_at,
        payment_method: inst.payment_method,
        status: installmentStatus,
        raw_status: inst.status,
        days_overdue: daysOverdue,
        days_until_due: daysUntilDue,
        is_eligible_for_active_billing: isEligible,
        notes: inst.notes || '',
      };
    });

    // Only include if there are pending installments
    if (evalPendingCount > 0) {
      totalEvalOverdueAmount += evalOverdueAmount;
      totalEvalOverdueCount += evalOverdueCount;
      totalEvalPreventiveAmount += evalPreventiveAmount;
      totalEvalPreventiveCount += evalPreventiveCount;

      let guardian: any = undefined;
      if (ev.guardian_json) {
        try { guardian = typeof ev.guardian_json === 'string' ? JSON.parse(ev.guardian_json) : ev.guardian_json; }
        catch { guardian = undefined; }
      }

      let financial_responsible: any = undefined;
      if (ev.financial_responsible_json) {
        try {
          financial_responsible = typeof ev.financial_responsible_json === 'string'
            ? JSON.parse(ev.financial_responsible_json)
            : ev.financial_responsible_json;
        } catch { financial_responsible = undefined; }
      }

      let whatsapp_routing: any = undefined;
      if (ev.whatsapp_routing_json) {
        try {
          whatsapp_routing = typeof ev.whatsapp_routing_json === 'string'
            ? JSON.parse(ev.whatsapp_routing_json)
            : ev.whatsapp_routing_json;
        } catch { whatsapp_routing = undefined; }
      }

      // Latest contact for this evaluation (or fallback to patient)
      const eContacts = contactsByEvalId.get(ev.id) || [];
      const pContacts = contactsByPatientId.get(ev.patient_id) || [];
      const latestContact = eContacts[0] || pContacts[0] || null;
      const contactBadge = computeContactBadge(latestContact);

      evaluation_billings.push({
        evaluation_id: ev.id,
        patient_id: ev.patient_id,
        patient_name: ev.patient_name,
        patient_cpf: ev.patient_cpf || '',
        patient_phone: ev.patient_phone || '',
        psychologist_id: ev.psychologist_id,
        psychologist_name: ev.psychologist_name,
        title: ev.title,
        status: ev.status,
        total_price: Number(ev.total_price) || 0,
        total_installments: rawInstallments.length,
        paid_installments_count: evalPaidCount,
        paid_amount: evalPaidAmount,
        pending_installments_count: evalPendingCount,
        pending_amount: evalPendingAmount,
        overdue_installments_count: evalOverdueCount,
        overdue_amount: evalOverdueAmount,
        preventive_installments_count: evalPreventiveCount,
        preventive_amount: evalPreventiveAmount,
        active_amount: evalOverdueAmount + evalPreventiveAmount,
        active_count: evalOverdueCount + evalPreventiveCount,
        installments: parsedInstallments,
        guardian,
        financial_responsible,
        whatsapp_routing,
        last_contact: latestContact,
        contact_badge: contactBadge,
        created_at: ev.created_at,
      });
    }
  }

  // Sort evaluations by highest active overdue amount
  evaluation_billings.sort((a, b) => b.active_amount - a.active_amount);

  res.json({
    billings: psychotherapy_billings, // retro-compatible
    psychotherapy_billings,
    evaluation_billings,
    summary: {
      total_pending_amount: totalPendingAll,
      total_pending_sessions: totalPendingSessionsCountAll,
      patients_with_pending_count: psychotherapy_billings.length,
      psychotherapy_overdue_amount: totalPsychOverdueAmount,
      psychotherapy_overdue_count: totalPsychOverdueCount,
      psychotherapy_overdue_patients_count: totalPsychOverduePatientsCount,
      psychotherapy_preventive_amount: totalPsychPreventiveAmount,
      psychotherapy_preventive_count: totalPsychPreventiveCount,
      psychotherapy_preventive_patients_count: totalPsychPreventivePatientsCount,
      psychotherapy_agreement_patients_count: totalPsychAgreementPatientsCount,
      evaluations_overdue_amount: totalEvalOverdueAmount,
      evaluations_overdue_count: totalEvalOverdueCount,
      evaluations_preventive_amount: totalEvalPreventiveAmount,
      evaluations_preventive_count: totalEvalPreventiveCount,
      evaluations_total_active_amount: totalEvalOverdueAmount + totalEvalPreventiveAmount,
      evaluations_with_pending_count: evaluation_billings.length,
      global_active_amount: totalPendingAll + totalEvalOverdueAmount + totalEvalPreventiveAmount,
    },
    psychologist: {
      name: req.user?.name || 'Dr. Marcos Silveira',
      crp: req.user?.crp_number || 'CRP 06/128945-SP',
    },
    clinic_settings: clinicSettings,
  });
});

/**
 * 8.2.1 AUDITORIA & REGISTRO DE CONTATOS DE COBRANÇA
 * Registra o disparo de mensagens, cópia de texto ou acordo de pagamento.
 */
router.post('/financial/billings/contact-log', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const {
      patient_id,
      evaluation_id,
      contact_channel = 'WHATSAPP',
      recipient_type = 'PATIENT',
      recipient_name,
      recipient_phone,
      template_type,
      message_preview,
      agreement_date,
      agreement_notes,
    } = req.body;

    if (!patient_id) {
      return res.status(400).json({ error: 'patient_id é obrigatório.' });
    }

    const result = execute(
      `INSERT INTO billing_contacts (
        patient_id, evaluation_id, contact_channel, recipient_type,
        recipient_name, recipient_phone, template_type, message_preview,
        agreement_date, agreement_notes, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        evaluation_id || null,
        contact_channel,
        recipient_type,
        recipient_name || null,
        recipient_phone || null,
        template_type || null,
        message_preview || null,
        agreement_date || null,
        agreement_notes || null,
        req.user?.id || 1,
      ]
    );

    recordAuditLog(
      req,
      'BILLING_CONTACT_LOG',
      `/financial/billings/contact-log`,
      `Registro de contato (${contact_channel}) para paciente #${patient_id}${agreement_date ? ` com promessa para ${agreement_date}` : ''}`
    );

    res.status(201).json({
      success: true,
      contact_id: result.lastInsertRowid,
      message: 'Contato registrado com sucesso.',
    });
  } catch (err) {
    console.error('Error logging billing contact:', err);
    res.status(500).json({ error: 'Erro ao registrar contato de cobrança.' });
  }
});

/**
 * 8.2.2 HISTÓRICO DE CONTATOS DE COBRANÇA
 * Retorna todos os registros de acionamento para um paciente ou avaliação.
 */
router.get('/financial/billings/contact-history', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { patient_id, evaluation_id } = req.query;
    let query = `
      SELECT bc.*, u.name as created_by_name
      FROM billing_contacts bc
      LEFT JOIN users u ON bc.created_by_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (patient_id) {
      query += ` AND bc.patient_id = ?`;
      params.push(Number(patient_id));
    }
    if (evaluation_id) {
      query += ` AND bc.evaluation_id = ?`;
      params.push(Number(evaluation_id));
    }
    query += ` ORDER BY bc.created_at DESC, bc.id DESC LIMIT 50`;
    const contacts = queryAll<any>(query, params);
    res.json({ contacts });
  } catch (err) {
    console.error('Error fetching billing contacts history:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico de cobranças.' });
  }
});

// ==========================================
// 8.1 GESTÃO DE DESPESAS (CONTAS A PAGAR & LIVRO-CAIXA)
// ==========================================

const createExpenseSchema = z.object({
  psychologist_id: z.number().optional(),
  title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres'),
  category: z.string().default('OUTROS'),
  amount: z.number().positive('Valor da despesa deve ser maior que zero'),
  due_date: z.string().min(10, 'Data de vencimento é obrigatória'),
  payment_date: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELED']).default('PENDING'),
  payment_method: z.enum(['PIX', 'BOLETO', 'CARTAO', 'TRANSFERENCIA', 'DINHEIRO', 'DEBITO_AUTOMATICO']).nullable().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_period: z.enum(['MONTHLY', 'BIMONTHLY', 'SEMIANNUAL', 'YEARLY']).default('MONTHLY'),
  installments_total: z.number().min(1).max(60).default(1),
  carne_leao_deductible: z.boolean().default(true),
  is_shared: z.boolean().default(false),
  scope: z.enum(['CLINIC', 'INDIVIDUAL', 'SHARED']).default('CLINIC'),
  payer_user_id: z.number().nullable().optional(),
  shared_splits_json: z.string().nullable().optional(),
  rfb_account_code: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * Listar todas as despesas com filtros, ABAC de privacidade e sumário dinâmico
 */
router.get('/financial/expenses', authenticateToken, (req: AuthRequest, res: Response) => {
  const { month, status, category, search, scope } = req.query;
  const todayStr = new Date().toISOString().substring(0, 10);

  const userRole = req.user?.role;
  const userId = req.user?.id;
  const isAdminOrSecretary = userRole === 'ADMIN' || userRole === 'SECRETARY' || req.user?.role_id === 1 || req.user?.role_id === 3;

  let sql = `SELECT e.*, 
                    u.name as psychologist_name, 
                    p.name as payer_name
             FROM expenses e
             LEFT JOIN users u ON u.id = e.psychologist_id
             LEFT JOIN users p ON p.id = e.payer_user_id
             WHERE 1=1`;
  const params: any[] = [];

  // ABAC Privacy Check:
  // Psicólogos comuns não-administradores veem:
  // 1. Todas as despesas de escopo CLINIC (contas gerais da clínica)
  // 2. Suas próprias despesas INDIVIDUAL (psychologist_id = userId)
  // 3. Despesas SHARED onde são o pagador ou fazem parte do rateio (shared_splits_json)
  if (!isAdminOrSecretary && userId) {
    sql += ` AND (
      e.scope = 'CLINIC' 
      OR (e.scope = 'INDIVIDUAL' AND e.psychologist_id = ?)
      OR ((e.scope = 'SHARED' OR e.is_shared = 1) AND (e.payer_user_id = ? OR e.shared_splits_json LIKE ? OR e.shared_splits_json LIKE ?))
    )`;
    params.push(userId, userId, `%"userId":${userId}%`, `%"${userId}":%`);
  }

  if (month) {
    sql += ` AND e.due_date LIKE ?`;
    params.push(`${month}%`);
  }
  if (scope && scope !== 'ALL') {
    sql += ` AND e.scope = ?`;
    params.push(scope);
  }
  if (status && status !== 'ALL') {
    if (status === 'OVERDUE') {
      sql += ` AND e.status = 'PENDING' AND e.due_date < ?`;
      params.push(todayStr);
    } else {
      sql += ` AND e.status = ?`;
      params.push(status);
    }
  }
  if (category && category !== 'ALL') {
    sql += ` AND e.category = ?`;
    params.push(category);
  }
  if (search) {
    sql += ` AND (e.title LIKE ? OR e.notes LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY e.due_date ASC, e.id ASC`;
  const rawExpenses = queryAll<any>(sql, params);

  // Mapear status dinâmico para overdue se vencido e pendente
  const expenses = rawExpenses.map((exp) => {
    let effectiveStatus = exp.status;
    if (exp.status === 'PENDING' && exp.due_date < todayStr) {
      effectiveStatus = 'OVERDUE';
    }
    return {
      ...exp,
      scope: exp.scope || (exp.is_shared ? 'SHARED' : 'CLINIC'),
      payer_user_id: exp.payer_user_id || null,
      payer_name: exp.payer_name || null,
      psychologist_name: exp.psychologist_name || null,
      is_recurring: Boolean(exp.is_recurring),
      carne_leao_deductible: Boolean(exp.carne_leao_deductible),
      is_shared: Boolean(exp.is_shared) || exp.scope === 'SHARED',
      shared_splits_json: exp.shared_splits_json,
      rfb_account_code: exp.rfb_account_code,
      computed_status: effectiveStatus,
    };
  });

  // Sumário consolidado do mês ou período com o mesmo filtro de privacidade
  let sumSql = `SELECT e.* FROM expenses e WHERE 1=1`;
  const sumParams: any[] = [];
  if (!isAdminOrSecretary && userId) {
    sumSql += ` AND (
      e.scope = 'CLINIC' 
      OR (e.scope = 'INDIVIDUAL' AND e.psychologist_id = ?)
      OR ((e.scope = 'SHARED' OR e.is_shared = 1) AND (e.payer_user_id = ? OR e.shared_splits_json LIKE ? OR e.shared_splits_json LIKE ?))
    )`;
    sumParams.push(userId, userId, `%"userId":${userId}%`, `%"${userId}":%`);
  }
  if (month) {
    sumSql += ` AND e.due_date LIKE ?`;
    sumParams.push(`${month}%`);
  }
  const allPeriodExpenses = queryAll<any>(sumSql, sumParams);

  let totalAmount = 0;
  let paidAmount = 0;
  let pendingAmount = 0;
  let overdueAmount = 0;
  let deductibleAmount = 0;

  for (const exp of allPeriodExpenses) {
    const val = Number(exp.amount) || 0;
    totalAmount += val;
    if (exp.status === 'PAID') {
      paidAmount += val;
    } else if (exp.status === 'PENDING') {
      if (exp.due_date < todayStr) {
        overdueAmount += val;
      } else {
        pendingAmount += val;
      }
    }
    if (exp.carne_leao_deductible && exp.status === 'PAID') {
      deductibleAmount += val;
    }
  }

  res.json({
    expenses,
    summary: {
      total: totalAmount,
      paid: paidAmount,
      pending: pendingAmount,
      overdue: overdueAmount,
      deductible: deductibleAmount,
    },
  });
});

// ==========================================
// 8.1.1 ACERTO DE CONTAS & REEMBOLSOS ENTRE PSICÓLOGOS
// ==========================================

const settlementCreateSchema = z.object({
  from_user_id: z.number(),
  to_user_id: z.number(),
  amount: z.number().positive('Valor deve ser maior que zero'),
  payment_date: z.string().min(10, 'Data de pagamento é obrigatória'),
  payment_method: z.string().default('PIX'),
  competence_month: z.string().min(7, 'Mês de competência (YYYY-MM) é obrigatório'),
  notes: z.string().nullable().optional(),
});

/**
 * Retorna o balanço de compensação líquida de despesas compartilhadas no mês
 */
router.get('/financial/expenses/settlement-balance', authenticateToken, (req: AuthRequest, res: Response) => {
  const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);

  // Busca todos os usuários psicólogos/admins ativos para mapear nomes
  const users = queryAll<any>(`SELECT id, name, email FROM users WHERE role IN ('PSYCHOLOGIST', 'ADMIN')`);
  const userMap = new Map<number, string>();
  users.forEach((u) => userMap.set(u.id, u.name));

  // Busca despesas compartilhadas do mês
  const sharedExpenses = queryAll<any>(`
    SELECT id, title, amount, due_date, payment_date, status, payer_user_id, psychologist_id, shared_splits_json
    FROM expenses
    WHERE (scope = 'SHARED' OR is_shared = 1)
      AND (due_date LIKE ? OR (payment_date IS NOT NULL AND payment_date LIKE ?))
  `, [`${month}%`, `${month}%`]);

  // Mapa de dívidas brutas: key = \`\${fromId}->\${toId}\`, val = total
  const grossDebts = new Map<string, number>();

  for (const exp of sharedExpenses) {
    const totalAmount = Number(exp.amount) || 0;
    // Payer: se definido usa payer_user_id, senão usa psychologist_id
    const payerId = exp.payer_user_id || exp.psychologist_id;
    if (!payerId) continue;

    if (exp.shared_splits_json) {
      try {
        const splits = typeof exp.shared_splits_json === 'string'
          ? JSON.parse(exp.shared_splits_json)
          : exp.shared_splits_json;

        if (Array.isArray(splits)) {
          for (const s of splits) {
            const uid = Number(s.userId || s.user_id);
            const pct = Number(s.percent || s.percentage) || 0;
            if (uid && uid !== payerId && pct > 0) {
              const part = (totalAmount * pct) / 100;
              const key = `${uid}->${payerId}`;
              grossDebts.set(key, (grossDebts.get(key) || 0) + part);
            }
          }
        } else if (typeof splits === 'object' && splits !== null) {
          for (const [uidStr, pctVal] of Object.entries(splits)) {
            const uid = Number(uidStr);
            const pct = Number(pctVal) || 0;
            if (uid && uid !== payerId && pct > 0) {
              const part = (totalAmount * pct) / 100;
              const key = `${uid}->${payerId}`;
              grossDebts.set(key, (grossDebts.get(key) || 0) + part);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing shared_splits_json in settlement-balance:', e);
      }
    }
  }

  // Busca liquidações / pagamentos de acerto já efetuados naquele mês
  const settlements = queryAll<any>(`
    SELECT s.*, uf.name as from_user_name, ut.name as to_user_name
    FROM expense_settlements s
    JOIN users uf ON uf.id = s.from_user_id
    JOIN users ut ON ut.id = s.to_user_id
    WHERE s.competence_month = ?
    ORDER BY s.payment_date ASC, s.id ASC
  `, [month]);

  const settledAmounts = new Map<string, number>();
  for (const st of settlements) {
    const key = `${st.from_user_id}->${st.to_user_id}`;
    settledAmounts.set(key, (settledAmounts.get(key) || 0) + Number(st.amount || 0));
  }

  // Coleta todas as chaves únicas de par (from -> to)
  const allPairKeys = new Set<string>([...grossDebts.keys(), ...settledAmounts.keys()]);
  const balances: any[] = [];

  for (const pairKey of allPairKeys) {
    const [fromStr, toStr] = pairKey.split('->');
    const fromId = Number(fromStr);
    const toId = Number(toStr);
    const gross = grossDebts.get(pairKey) || 0;
    const settled = settledAmounts.get(pairKey) || 0;
    const netPending = Math.max(0, gross - settled);

    balances.push({
      fromUserId: fromId,
      fromName: userMap.get(fromId) || `Psicólogo #${fromId}`,
      toUserId: toId,
      toName: userMap.get(toId) || `Psicólogo #${toId}`,
      grossOwed: Math.round(gross * 100) / 100,
      settledAmount: Math.round(settled * 100) / 100,
      netPending: Math.round(netPending * 100) / 100,
    });
  }

  res.json({
    month,
    balances,
    settlements,
    sharedExpensesCount: sharedExpenses.length,
  });
});

/**
 * Registrar um acerto / reembolso de despesa compartilhada
 */
router.post('/financial/expenses/settlements', authenticateToken, (req: AuthRequest, res: Response) => {
  const parse = settlementCreateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  const data = parse.data;
  const result = execute(`
    INSERT INTO expense_settlements (
      from_user_id, to_user_id, amount, payment_date, payment_method, competence_month, notes, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.from_user_id,
    data.to_user_id,
    data.amount,
    data.payment_date,
    data.payment_method,
    data.competence_month,
    data.notes || null,
    req.user?.id || null,
  ]);

  recordAuditLog(
    req,
    'SETTLE_SHARED_EXPENSES',
    `SETTLEMENT #${result.lastInsertRowid}`,
    `Acerto de contas de R$ ${data.amount.toFixed(2)} registrado de usuário #${data.from_user_id} para #${data.to_user_id} (Competência: ${data.competence_month})`
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    message: 'Acerto de contas registrado com sucesso!',
  });
});

/**
 * Excluir um registro de acerto
 */
router.delete('/financial/expenses/settlements/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = queryOne<any>(`SELECT * FROM expense_settlements WHERE id = ?`, [id]);
  if (!existing) {
    res.status(404).json({ error: 'Registro de acerto não encontrado' });
    return;
  }

  execute(`DELETE FROM expense_settlements WHERE id = ?`, [id]);
  recordAuditLog(req, 'DELETE_EXPENSE_SETTLEMENT', `SETTLEMENT #${id}`, `Excluiu registro de acerto de R$ ${existing.amount}`);
  res.json({ success: true, message: 'Registro de acerto excluído com sucesso' });
});

/**
 * Obter detalhe de uma despesa específica
 */
router.get('/financial/expenses/:id', authenticateToken, (req: AuthRequest, res: Response, next: any) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    return next();
  }
  const expense = queryOne<any>(`SELECT * FROM expenses WHERE id = ?`, [id]);
  if (!expense) {
    res.status(404).json({ error: 'Despesa não encontrada' });
    return;
  }
  res.json({
    expense: {
      ...expense,
      is_recurring: Boolean(expense.is_recurring),
      carne_leao_deductible: Boolean(expense.carne_leao_deductible),
    },
  });
});

/**
 * Criar nova despesa (Individual ou Recorrente) e sincronizar com a Agenda
 */
router.post('/financial/expenses', authenticateToken, (req: AuthRequest, res: Response) => {
  const parse = createExpenseSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  const data = parse.data;
  const psychologistId = (req as any).user?.id || 1;
  const effectiveScope = data.scope || (data.is_shared ? 'SHARED' : 'CLINIC');
  const isShared = effectiveScope === 'SHARED' || data.is_shared ? 1 : 0;
  const effectivePayerId = data.payer_user_id || null;
  const effectivePsychId = (effectiveScope === 'INDIVIDUAL' && data.psychologist_id) ? data.psychologist_id : psychologistId;

  if (data.is_recurring && data.installments_total > 1) {
    // Criação em série recorrente
    const groupId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseDate = new Date(data.due_date + 'T12:00:00');
    const createdIds: number[] = [];

    for (let i = 0; i < data.installments_total; i++) {
      const instDueDate = new Date(baseDate);
      if (data.recurrence_period === 'MONTHLY') {
        instDueDate.setMonth(baseDate.getMonth() + i);
      } else if (data.recurrence_period === 'BIMONTHLY') {
        instDueDate.setMonth(baseDate.getMonth() + i * 2);
      } else if (data.recurrence_period === 'SEMIANNUAL') {
        instDueDate.setMonth(baseDate.getMonth() + i * 6);
      } else if (data.recurrence_period === 'YEARLY') {
        instDueDate.setFullYear(baseDate.getFullYear() + i);
      }
      const dueDateStr = instDueDate.toISOString().substring(0, 10);

      // Apenas a primeira parcela herda status pago se marcado pelo usuário
      const instStatus = i === 0 ? data.status : 'PENDING';
      const instPaidDate = i === 0 && data.status === 'PAID' ? (data.payment_date || dueDateStr) : null;
      const instPaymentMethod = i === 0 && data.status === 'PAID' ? data.payment_method : null;

      const expRes = execute(`
        INSERT INTO expenses (
          psychologist_id, title, category, amount, due_date, payment_date, 
          status, payment_method, is_recurring, recurrence_period, recurrence_group_id, 
          installment_number, installments_total, carne_leao_deductible,
          is_shared, shared_splits_json, scope, payer_user_id, rfb_account_code, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        effectivePsychId,
        data.title,
        data.category,
        data.amount,
        dueDateStr,
        instPaidDate,
        instStatus,
        instPaymentMethod,
        data.recurrence_period,
        groupId,
        i + 1,
        data.installments_total,
        data.carne_leao_deductible ? 1 : 0,
        isShared,
        data.shared_splits_json || null,
        effectiveScope,
        effectivePayerId,
        data.rfb_account_code || null,
        data.notes || null,
      ]);

      const expId = expRes.lastInsertRowid;
      createdIds.push(expId);

      // Sincronizar na Agenda como evento de Dia Todo (FINANCIAL)
      execute(`
        INSERT INTO agenda_events (date, title, event_type, expense_id, amount, status, payment_date, category)
        VALUES (?, ?, 'FINANCIAL', ?, ?, ?, ?, ?)
      `, [
        dueDateStr,
        `${data.title} 💵`,
        expId,
        data.amount,
        instStatus,
        instPaidDate,
        data.category,
      ]);
    }

    recordAuditLog(
      req,
      'CREATE_RECURRING_EXPENSE',
      `EXPENSE_SERIES #${groupId}`,
      `Cadastro de despesa recorrente: "${data.title}" em ${data.installments_total} parcelas de R$ ${data.amount.toFixed(2)}`
    );

    res.status(201).json({
      message: `Despesa recorrente criada com sucesso (${data.installments_total} parcelas programadas)`,
      recurrence_group_id: groupId,
      created_count: data.installments_total,
    });
  } else {
    // Despesa Individual única
    const expRes = execute(`
      INSERT INTO expenses (
        psychologist_id, title, category, amount, due_date, payment_date, 
        status, payment_method, is_recurring, carne_leao_deductible,
        is_shared, shared_splits_json, scope, payer_user_id, rfb_account_code, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
    `, [
      effectivePsychId,
      data.title,
      data.category,
      data.amount,
      data.due_date,
      data.status === 'PAID' ? (data.payment_date || data.due_date) : null,
      data.status,
      data.payment_method || null,
      data.carne_leao_deductible ? 1 : 0,
      isShared,
      data.shared_splits_json || null,
      effectiveScope,
      effectivePayerId,
      data.rfb_account_code || null,
      data.notes || null,
    ]);

    const expId = expRes.lastInsertRowid;

    // Sincronizar na Agenda
    execute(`
      INSERT INTO agenda_events (date, title, event_type, expense_id, amount, status, payment_date, category)
      VALUES (?, ?, 'FINANCIAL', ?, ?, ?, ?, ?)
    `, [
      data.due_date,
      `${data.title} 💵`,
      expId,
      data.amount,
      data.status,
      data.status === 'PAID' ? (data.payment_date || data.due_date) : null,
      data.category,
    ]);

    recordAuditLog(
      req,
      'CREATE_EXPENSE',
      `EXPENSE #${expId}`,
      `Cadastro de despesa: "${data.title}" no valor de R$ ${data.amount.toFixed(2)} para ${data.due_date}`
    );

    res.status(201).json({
      message: 'Despesa cadastrada com sucesso e sincronizada com a agenda',
      id: expId,
    });
  }
});

/**
 * Atualizar / Editar uma despesa existente
 */
router.put('/financial/expenses/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const parse = createExpenseSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  const existing = queryOne<any>(`SELECT * FROM expenses WHERE id = ?`, [id]);
  if (!existing) {
    res.status(404).json({ error: 'Despesa não encontrada' });
    return;
  }

  const data = parse.data;
  const effectivePaidDate = data.status === 'PAID' ? (data.payment_date || data.due_date) : null;
  const effectiveScope = data.scope || (data.is_shared ? 'SHARED' : 'CLINIC');
  const isShared = effectiveScope === 'SHARED' || data.is_shared ? 1 : 0;
  const effectivePayerId = data.payer_user_id || null;
  const effectivePsychId = (effectiveScope === 'INDIVIDUAL' && data.psychologist_id) ? data.psychologist_id : existing.psychologist_id;

  execute(`
    UPDATE expenses SET
      title = ?,
      category = ?,
      amount = ?,
      due_date = ?,
      payment_date = ?,
      status = ?,
      payment_method = ?,
      carne_leao_deductible = ?,
      is_shared = ?,
      shared_splits_json = ?,
      scope = ?,
      payer_user_id = ?,
      psychologist_id = ?,
      rfb_account_code = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    data.title,
    data.category,
    data.amount,
    data.due_date,
    effectivePaidDate,
    data.status,
    data.payment_method || null,
    data.carne_leao_deductible ? 1 : 0,
    isShared,
    data.shared_splits_json || null,
    effectiveScope,
    effectivePayerId,
    effectivePsychId,
    data.rfb_account_code || null,
    data.notes || null,
    id,
  ]);

  // Sincroniza evento na agenda
  execute(`
    UPDATE agenda_events SET
      date = ?,
      title = ?,
      amount = ?,
      status = ?,
      payment_date = ?,
      category = ?
    WHERE expense_id = ?
  `, [
    data.due_date,
    `${data.title} 💵`,
    data.amount,
    data.status,
    effectivePaidDate,
    data.category,
    id,
  ]);

  recordAuditLog(req, 'UPDATE_EXPENSE', `EXPENSE #${id}`, `Despesa "${data.title}" atualizada`);
  res.json({ message: 'Despesa atualizada com sucesso' });
});

/**
 * Registrar pagamento / alteração rápida de status de uma despesa
 */
router.patch('/financial/expenses/:id/status', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, payment_date, payment_method } = req.body;

  const expense = queryOne<any>(`SELECT * FROM expenses WHERE id = ?`, [id]);
  if (!expense) {
    res.status(404).json({ error: 'Despesa não encontrada' });
    return;
  }

  const effectivePaidDate = status === 'PAID' 
    ? (payment_date || new Date().toISOString().substring(0, 10)) 
    : null;

  execute(`
    UPDATE expenses SET
      status = ?,
      payment_date = ?,
      payment_method = COALESCE(?, payment_method),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [status, effectivePaidDate, payment_method || null, id]);

  // Sincroniza evento da agenda
  execute(`
    UPDATE agenda_events SET
      status = ?,
      payment_date = ?
    WHERE expense_id = ?
  `, [status, effectivePaidDate, id]);

  recordAuditLog(
    req,
    'UPDATE_EXPENSE_STATUS',
    `EXPENSE #${id}`,
    `Despesa "${expense.title}" marcada como ${status}`
  );

  res.json({ message: 'Situação de pagamento atualizada com sucesso' });
});

/**
 * Excluir despesa (com opção de excluir série inteira ou apenas atual)
 */
router.delete('/financial/expenses/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { scope } = req.query; // 'single' | 'all' | 'future'

  const expense = queryOne<any>(`SELECT * FROM expenses WHERE id = ?`, [id]);
  if (!expense) {
    res.status(404).json({ error: 'Despesa não encontrada' });
    return;
  }

  if (expense.is_recurring && expense.recurrence_group_id && (scope === 'all' || scope === 'future')) {
    if (scope === 'all') {
      // Exclui todas da série
      const seriesExpenses = queryAll<any>(
        `SELECT id FROM expenses WHERE recurrence_group_id = ?`,
        [expense.recurrence_group_id]
      );
      const ids = seriesExpenses.map((e) => e.id);
      for (const expId of ids) {
        execute(`DELETE FROM agenda_events WHERE expense_id = ?`, [expId]);
      }
      execute(`DELETE FROM expenses WHERE recurrence_group_id = ?`, [expense.recurrence_group_id]);
      recordAuditLog(req, 'DELETE_EXPENSE_SERIES', `EXPENSE_SERIES #${expense.recurrence_group_id}`, `Série excluída (${ids.length} parcelas)`);
      res.json({ message: `Série de ${ids.length} parcelas excluída com sucesso` });
      return;
    } else if (scope === 'future') {
      // Exclui esta e as futuras
      const futureExpenses = queryAll<any>(
        `SELECT id FROM expenses WHERE recurrence_group_id = ? AND installment_number >= ?`,
        [expense.recurrence_group_id, expense.installment_number || 1]
      );
      const ids = futureExpenses.map((e) => e.id);
      for (const expId of ids) {
        execute(`DELETE FROM agenda_events WHERE expense_id = ?`, [expId]);
      }
      execute(
        `DELETE FROM expenses WHERE recurrence_group_id = ? AND installment_number >= ?`,
        [expense.recurrence_group_id, expense.installment_number || 1]
      );
      recordAuditLog(req, 'DELETE_EXPENSE_FUTURE', `EXPENSE_SERIES #${expense.recurrence_group_id}`, `Parcelas futuras excluídas (${ids.length} parcelas)`);
      res.json({ message: `Esta e as ${ids.length - 1} parcelas futuras foram excluídas com sucesso` });
      return;
    }
  }

  // Exclusão individual
  execute(`DELETE FROM agenda_events WHERE expense_id = ?`, [id]);
  execute(`DELETE FROM expenses WHERE id = ?`, [id]);
  recordAuditLog(req, 'DELETE_EXPENSE', `EXPENSE #${id}`, `Despesa "${expense.title}" excluída`);
  res.json({ message: 'Despesa excluída com sucesso' });
});

/**
 * Obter Livro-Caixa Consolidado do Carnê-Leão (Receitas - Despesas Dedutíveis = Base Tributável)
 */
router.get('/financial/carne-leao-book', authenticateToken, (req: AuthRequest, res: Response) => {
  const { year, month } = req.query;
  const filterPrefix = year && month ? `${year}-${month}` : (year ? `${year}` : '');

  let revenuesSql = `
    SELECT t.id, t.transaction_date as data, t.amount as valor,
           p.full_name as descricao, p.cpf as documento,
           'RECEITA' as tipo,
           '2251-05' as codigo_ocupacao,
           'Honorários de Serviços Psicológicos / Psicoterapia' as historico
    FROM financial_transactions t
    JOIN patients p ON t.patient_id = p.id
    WHERE t.status = 'PAID'
  `;
  const revParams: any[] = [];
  if (filterPrefix) {
    revenuesSql += ` AND t.transaction_date LIKE ?`;
    revParams.push(`${filterPrefix}%`);
  }
  revenuesSql += ` ORDER BY t.transaction_date ASC`;
  const revenues = queryAll<any>(revenuesSql, revParams);

  let expensesSql = `
    SELECT e.id, COALESCE(e.payment_date, e.due_date) as data, e.amount as valor,
           e.title as descricao, e.category,
           'DESPESA' as tipo,
           'LIVRO_CAIXA_DEDUTIVEL' as codigo_ocupacao,
           e.notes as historico
    FROM expenses e
    WHERE e.status = 'PAID' AND e.carne_leao_deductible = 1
  `;
  const expParams: any[] = [];
  if (filterPrefix) {
    expensesSql += ` AND (e.payment_date LIKE ? OR (e.payment_date IS NULL AND e.due_date LIKE ?))`;
    expParams.push(`${filterPrefix}%`, `${filterPrefix}%`);
  }
  expensesSql += ` ORDER BY data ASC`;
  const expenses = queryAll<any>(expensesSql, expParams);

  let totalReceitas = 0;
  for (const r of revenues) {
    totalReceitas += Number(r.valor) || 0;
  }

  let totalDespesas = 0;
  for (const e of expenses) {
    totalDespesas += Number(e.valor) || 0;
  }

  const saldoLiquido = totalReceitas - totalDespesas;

  res.json({
    total_receitas: totalReceitas,
    total_despesas_dedutiveis: totalDespesas,
    rendimento_tributavel: Math.max(0, saldoLiquido),
    receitas: revenues,
    despesas: expenses,
  });
});

// ==========================================
// 8.2 RELATÓRIOS FINANCEIROS
// ==========================================

router.get('/reports/financial', authenticateToken, (req: AuthRequest, res: Response) => {
  const { 
    startDate, 
    endDate, 
    dateFilterType, // 'SESSION_DATE' | 'TRANSACTION_DATE'
    status, 
    patientId, 
    psychologistId,
    paymentMethod
  } = req.query;

  const whereClauses: string[] = [];
  const params: any[] = [];

  // Data filter logic
  if (startDate && endDate) {
    if (dateFilterType === 'TRANSACTION_DATE') {
      whereClauses.push(`(t.transaction_date >= ? AND t.transaction_date <= ? OR DATE(t.paid_at) >= ? AND DATE(t.paid_at) <= ?)`);
      params.push(startDate, endDate, startDate, endDate);
    } else {
      // SESSION_DATE (default)
      whereClauses.push(`DATE(s.start_time) >= ? AND DATE(s.start_time) <= ?`);
      params.push(startDate, endDate);
    }
  }

  if (status && status !== 'ALL') {
    whereClauses.push(`COALESCE(t.status, 'PENDING') = ?`);
    params.push(status);
  }

  if (patientId && patientId !== 'ALL') {
    whereClauses.push(`s.patient_id = ?`);
    params.push(parseInt(patientId as string, 10));
  }

  if (psychologistId && psychologistId !== 'ALL') {
    whereClauses.push(`s.psychologist_id = ?`);
    params.push(parseInt(psychologistId as string, 10));
  }

  if (paymentMethod && paymentMethod !== 'ALL') {
    whereClauses.push(`t.payment_method = ?`);
    params.push(paymentMethod);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ` + whereClauses.join(' AND ') : '';

  const sql = `
    SELECT 
      s.id as session_id,
      s.start_time,
      s.price as session_price,
      s.status as session_status,
      p.id as patient_id,
      p.full_name as patient_name,
      p.cpf as patient_cpf,
      u.id as psych_id,
      u.name as psych_name,
      t.id as transaction_id,
      t.amount as transaction_amount,
      t.status as payment_status,
      t.payment_method,
      t.paid_at,
      t.transaction_date,
      t.notes as transaction_notes
    FROM sessions s
    JOIN patients p ON s.patient_id = p.id
    JOIN users u ON s.psychologist_id = u.id
    LEFT JOIN financial_transactions t ON t.session_id = s.id
    ${whereString}
    ORDER BY s.start_time DESC
  `;

  try {
    const records = queryAll<any>(sql, params);

    let totalPaid = 0;
    let totalPending = 0;

    const formattedRecords = records.map(r => {
      const amount = r.transaction_amount !== null ? r.transaction_amount : r.session_price;
      const status = r.payment_status || 'PENDING';
      
      if (status === 'PAID') {
        totalPaid += amount;
      } else {
        totalPending += amount;
      }

      return {
        ...r,
        amount,
        final_status: status
      };
    });

    res.json({
      summary: {
        totalPaid,
        totalPending,
        totalGeneral: totalPaid + totalPending
      },
      transactions: formattedRecords
    });
  } catch (err) {
    console.error('Error fetching financial report:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório financeiro.' });
  }
});

// ==========================================
router.get(
  '/audit-logs',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  (req: AuthRequest, res: Response) => {
    const { page = '1', limit = '50', search = '', startDate = '', endDate = '', userId = '', actionType = '', isExport = 'false' } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    let whereClauses: string[] = [];
    let queryParams: any[] = [];

    if (search) {
      whereClauses.push(`(a.action LIKE ? OR a.resource LIKE ? OR a.details LIKE ?)`);
      const searchStr = `%${search}%`;
      queryParams.push(searchStr, searchStr, searchStr);
    }

    if (startDate) {
      whereClauses.push(`DATE(a.timestamp) >= ?`);
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClauses.push(`DATE(a.timestamp) <= ?`);
      queryParams.push(endDate);
    }

    if (userId) {
      if (userId === 'SYSTEM') {
        whereClauses.push(`a.user_id IS NULL`);
      } else {
        whereClauses.push(`a.user_id = ?`);
        queryParams.push(parseInt(userId as string, 10));
      }
    }

    if (actionType) {
      whereClauses.push(`a.action LIKE ?`);
      queryParams.push(`%${actionType}%`);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ` + whereClauses.join(' AND ') : '';

    if (isExport === 'true') {
      const logs = queryAll<any>(`
        SELECT a.id, a.user_id, a.action, a.resource, a.ip_address, a.timestamp, a.details,
               u.name as user_name, u.role as user_role
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ${whereString}
        ORDER BY a.id DESC
      `, queryParams);
      res.json({ logs });
      return;
    }

    const countQuery = queryOne<{total: number}>(`
      SELECT COUNT(*) as total 
      FROM audit_logs a
      ${whereString}
    `, queryParams);
    
    const total = countQuery ? countQuery.total : 0;

    const logs = queryAll<any>(`
      SELECT a.id, a.user_id, a.action, a.resource, a.ip_address, a.timestamp, a.details,
             u.name as user_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereString}
      ORDER BY a.id DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limitNum, offset]);

    res.json({ 
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  }
);

// ==========================================
// 10. RBAC / COLABORADORES
// ==========================================

// Get all collaborators (users)
router.get('/collaborators', authenticateToken, (req: AuthRequest, res: Response) => {
  const users = queryAll<any>(`
    SELECT u.id, u.name, u.email, u.crp_number, u.status, u.failed_login_attempts, u.locked_until, u.token_version,
           u.repasse_mode, u.repasse_percentage, u.repasse_eval_percentage, u.repasse_fixed_amount,
           u.pix_key, u.pix_key_type, u.bank_info,
           r.name as role_name, r.id as role_id 
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    ORDER BY u.name ASC
  `);

  let academyProgressByUser: Record<number, any[]> = {};
  try {
    const progressRows = queryAll<any>(`
      SELECT user_id, tour_id, category, completed_count, status, last_completed_at
      FROM user_academy_progress
    `);
    progressRows.forEach((row: any) => {
      if (!academyProgressByUser[row.user_id]) {
        academyProgressByUser[row.user_id] = [];
      }
      academyProgressByUser[row.user_id].push(row);
    });
  } catch (e) {
    // Table may not have any rows or error safely handled
  }

  const currentUserId = req.user?.id;
  const isAdmin = req.user?.role === 'ADMIN' || req.user?.role_id === 1;

  const enrichedUsers = users.map((u: any) => {
    const isSelfOrAdmin = isAdmin || u.id === currentUserId;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      crp_number: u.crp_number,
      status: u.status,
      failed_login_attempts: isAdmin ? u.failed_login_attempts : undefined,
      locked_until: isAdmin ? u.locked_until : undefined,
      token_version: isAdmin ? u.token_version : undefined,
      role_name: u.role_name,
      role_id: u.role_id,
      // Sigilo Financeiro & LGPD: Visível apenas para Administrador ou o próprio profissional
      repasse_mode: isSelfOrAdmin ? u.repasse_mode : undefined,
      repasse_percentage: isSelfOrAdmin ? u.repasse_percentage : undefined,
      repasse_eval_percentage: isSelfOrAdmin ? u.repasse_eval_percentage : undefined,
      repasse_fixed_amount: isSelfOrAdmin ? u.repasse_fixed_amount : undefined,
      pix_key: isSelfOrAdmin ? u.pix_key : undefined,
      pix_key_type: isSelfOrAdmin ? u.pix_key_type : undefined,
      bank_info: isSelfOrAdmin ? u.bank_info : undefined,
      academy_progress: academyProgressByUser[u.id] || [],
    };
  });

  res.json({ users: enrichedUsers });
});

// Get all roles
router.get('/roles', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const rows = queryAll<any>(`
      SELECT r.id, r.name, r.is_system, GROUP_CONCAT(p.name) as permissions_str
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      GROUP BY r.id, r.name, r.is_system
      ORDER BY r.name ASC
    `);
    const roles = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      is_system: r.is_system,
      permissions: r.permissions_str ? r.permissions_str.split(',') : []
    }));
    res.json({ roles });
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

router.put('/roles/:id/permissions', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role_id !== 1) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem modificar permissões.' });
  }

  const roleId = Number(req.params.id);
  const { permissions } = req.body;

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Formato inválido. permissions deve ser um array de strings.' });
  }

  try {
    execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    for (const permName of permissions) {
      const perm = queryOne<{id: number}>(`SELECT id FROM permissions WHERE name = ?`, [permName]);
      if (perm) {
        execute('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, perm.id]);
      }
    }
    recordAuditLog(req, 'UPDATE_ROLE_PERMISSIONS', `/roles/${roleId}/permissions`, `Atualizou permissões do role ${roleId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating permissions:', err);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Get all permissions
router.get('/permissions', authenticateToken, (req: AuthRequest, res: Response) => {
  const perms = queryAll<{id: number, name: string}>('SELECT id, name FROM permissions ORDER BY name ASC');
  res.json({ permissions: perms });
});

// Assign role to collaborator (Apenas ADMIN)
router.post('/collaborators/:id/role', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role_id !== 1) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem alterar perfis de colaboradores.' });
  }

  const userId = Number(req.params.id);
  const { role_id } = req.body;
  if (!userId || !role_id) return res.status(400).json({ error: 'Faltando role_id' });
  execute('UPDATE users SET role_id = ? WHERE id = ?', [role_id, userId]);
  recordAuditLog(req, 'UPDATE_USER_ROLE', `/collaborators/${userId}`, `Atribuiu role_id ${role_id}`);
  res.json({ success: true });
});

// Create new collaborator via Secure Invitation (DEC-01)
const inviteCollaboratorSchema = z.object({
  name: z.string().min(2, 'Nome do colaborador é obrigatório'),
  email: z.string().email('E-mail profissional inválido'),
  role_id: z.number({ message: 'Selecione o perfil do colaborador' }),
  crp_number: z.string().nullish().transform(v => (v ? String(v).trim() : null)),
});

router.post('/collaborators/invite', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role_id !== 1) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem convidar colaboradores.' });
  }

  const parse = inviteCollaboratorSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
  }

  const { name, email, role_id, crp_number } = parse.data;

  try {
    const existing = queryOne<{id: number}>('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um colaborador cadastrado com este e-mail.' });
    }

    const role = queryOne<{name: string}>('SELECT name FROM roles WHERE id = ?', [role_id]);
    const roleName = role ? role.name : 'Colaborador';

    // Cria o usuário com status PENDING_ACTIVATION e hash não-autenticável temporário
    const pendingHash = 'PENDING_ACTIVATION_' + crypto.randomBytes(24).toString('hex');
    const insertRes = execute(
      `INSERT INTO users (name, email, password_hash, role_id, crp_number, status, failed_login_attempts, token_version)
       VALUES (?, ?, ?, ?, ?, 'PENDING_ACTIVATION', 0, 1)`,
      [name.trim(), email.trim().toLowerCase(), pendingHash, role_id, crp_number]
    );
    const newUserId = insertRes.lastInsertRowid;

    // Gera token de convite seguro de 64 caracteres com validade de 24 horas
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    execute(
      `INSERT INTO auth_tokens (user_id, token, token_type, expires_at) VALUES (?, ?, 'INVITE', ?)`,
      [newUserId, token, expiresAt]
    );

    recordAuditLog(req, 'INVITE_COLLABORATOR', `/collaborators/${newUserId}`, `Convidou novo colaborador: ${email} (${roleName})`);

    // Dispara e-mail de convite
    const emailPreview = await sendInvitationEmail({
      to: email.trim().toLowerCase(),
      name: name.trim(),
      token,
      roleName,
    });

    res.status(201).json({
      success: true,
      message: `Convite de acesso enviado com sucesso para ${email}!`,
      userId: newUserId,
      ...(process.env.NODE_ENV !== 'production' ? { emailPreview } : {}),
    });
  } catch (err) {
    console.error('Error inviting collaborator:', err);
    res.status(500).json({ error: 'Erro interno ao convidar colaborador.' });
  }
});

// Reenviar convite de 1º acesso
router.post('/collaborators/:id/resend-invite', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role_id !== 1) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }

  const userId = Number(req.params.id);
  const user = queryOne<any>(
    `SELECT u.id, u.name, u.email, u.status, r.name as role_name 
     FROM users u 
     LEFT JOIN roles r ON u.role_id = r.id 
     WHERE u.id = ?`,
    [userId]
  );

  if (!user) {
    return res.status(404).json({ error: 'Colaborador não encontrado.' });
  }

  try {
    // Invalida convites pendentes anteriores
    execute(`DELETE FROM auth_tokens WHERE user_id = ? AND token_type = 'INVITE' AND used_at IS NULL`, [userId]);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    execute(
      `INSERT INTO auth_tokens (user_id, token, token_type, expires_at) VALUES (?, ?, 'INVITE', ?)`,
      [userId, token, expiresAt]
    );

    recordAuditLog(req, 'RESEND_INVITE', `/collaborators/${userId}`, `Reenviou convite para ${user.email}`);

    const emailPreview = await sendInvitationEmail({
      to: user.email,
      name: user.name,
      token,
      roleName: user.role_name || 'Colaborador',
    });

    res.json({
      success: true,
      message: `Novo convite de acesso enviado para ${user.email}!`,
      ...(process.env.NODE_ENV !== 'production' ? { emailPreview } : {}),
    });
  } catch (err) {
    console.error('Error resending invite:', err);
    res.status(500).json({ error: 'Erro ao reenviar convite.' });
  }
});

// Disparar redefinição assistida de senha pelo Administrador
router.post('/collaborators/:id/trigger-reset', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role_id !== 1) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }

  const userId = Number(req.params.id);
  const user = queryOne<any>('SELECT id, name, email FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).json({ error: 'Colaborador não encontrado.' });
  }

  try {
    // Invalida resets pendentes anteriores
    execute(`DELETE FROM auth_tokens WHERE user_id = ? AND token_type = 'RESET' AND used_at IS NULL`, [userId]);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    execute(
      `INSERT INTO auth_tokens (user_id, token, token_type, expires_at) VALUES (?, ?, 'RESET', ?)`,
      [userId, token, expiresAt]
    );

    recordAuditLog(req, 'ADMIN_TRIGGER_RESET', `/collaborators/${userId}`, `Administrador disparou link de redefinição para ${user.email}`);

    const emailPreview = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token,
    });

    res.json({
      success: true,
      message: `Link de redefinição de senha enviado para ${user.email}!`,
      ...(process.env.NODE_ENV !== 'production' ? { emailPreview } : {}),
    });
  } catch (err) {
    console.error('Error triggering password reset:', err);
    res.status(500).json({ error: 'Erro ao disparar redefinição de senha.' });
  }
});

// Derrubar Credenciais / Revogar Acesso Imediatamente (Kill Switch - DEC-06)
router.post('/collaborators/:id/revoke-access', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role_id !== 1) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }

  const userId = Number(req.params.id);
  const user = queryOne<any>('SELECT id, name, email FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).json({ error: 'Colaborador não encontrado.' });
  }

  // Não permite que o próprio admin derrube a si mesmo acidentalmente
  if (req.user.id === userId) {
    return res.status(400).json({ error: 'Você não pode suspender sua própria conta de Administrador.' });
  }

  try {
    // 1. Marca status como BLOCKED e incrementa token_version (expulsa JWTs ativos)
    execute(
      `UPDATE users 
       SET status = 'BLOCKED', token_version = token_version + 1, failed_login_attempts = 0, locked_until = NULL 
       WHERE id = ?`,
      [userId]
    );

    // 2. Anula quaisquer tokens de convite ou redefinição pendentes
    execute(`DELETE FROM auth_tokens WHERE user_id = ? AND used_at IS NULL`, [userId]);

    recordAuditLog(req, 'REVOKE_COLLABORATOR_ACCESS', `/collaborators/${userId}`, `Credenciais revogadas e acesso suspenso para ${user.email}`);

    res.json({
      success: true,
      message: `Acesso do colaborador ${user.name} foi suspenso e todas as sessões ativas foram encerradas imediatamente.`,
    });
  } catch (err) {
    console.error('Error revoking access:', err);
    res.status(500).json({ error: 'Erro ao revogar acesso do colaborador.' });
  }
});

// Desbloquear / Reativar Colaborador
router.post('/collaborators/:id/unlock', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role_id !== 1) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }

  const userId = Number(req.params.id);
  const user = queryOne<any>('SELECT id, name, email, status, password_hash FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).json({ error: 'Colaborador não encontrado.' });
  }

  try {
    // Se não tinha senha cadastrada (apenas hash provisório de ativação), volta para PENDING_ACTIVATION; caso contrário, ACTIVE
    const hasRealPassword = user.password_hash && !user.password_hash.startsWith('PENDING_ACTIVATION');
    const newStatus = hasRealPassword ? 'ACTIVE' : 'PENDING_ACTIVATION';
    execute(
      `UPDATE users 
       SET status = ?, failed_login_attempts = 0, locked_until = NULL 
       WHERE id = ?`,
      [newStatus, userId]
    );

    recordAuditLog(req, 'UNLOCK_COLLABORATOR', `/collaborators/${userId}`, `Desbloqueou conta de ${user.email}`);

    res.json({
      success: true,
      message: `Conta do colaborador ${user.name} desbloqueada com sucesso.`,
    });
  } catch (err) {
    console.error('Error unlocking user:', err);
    res.status(500).json({ error: 'Erro ao desbloquear colaborador.' });
  }
});

// Update collaborator basic info
router.put('/collaborators/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role_id !== 1) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
  
  const userId = Number(req.params.id);
  const {
    name,
    email,
    role_id,
    crp_number,
    repasse_mode,
    repasse_percentage,
    repasse_eval_percentage,
    repasse_fixed_amount,
    pix_key,
    pix_key_type,
    bank_info,
  } = req.body;
  if (!name || !email || !role_id) {
    return res.status(400).json({ error: 'Nome, E-mail e Perfil são obrigatórios.' });
  }

  try {
    const existing = queryOne<{id: number}>('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (existing) {
      return res.status(400).json({ error: 'Este e-mail já está sendo usado por outro colaborador.' });
    }

    const mode = repasse_mode === 'FIXED_PER_SESSION' ? 'FIXED_PER_SESSION' : 'PERCENTAGE';
    const repPerc = repasse_percentage !== undefined && repasse_percentage !== null ? Number(repasse_percentage) : 50.0;
    const repEvalPerc = repasse_eval_percentage !== undefined && repasse_eval_percentage !== null ? Number(repasse_eval_percentage) : 60.0;
    const repFixed = repasse_fixed_amount !== undefined && repasse_fixed_amount !== null ? Number(repasse_fixed_amount) : null;

    execute(
      `UPDATE users SET 
        name = ?, email = ?, role_id = ?, crp_number = ?,
        repasse_mode = ?, repasse_percentage = ?, repasse_eval_percentage = ?, repasse_fixed_amount = ?,
        pix_key = ?, pix_key_type = ?, bank_info = ?
       WHERE id = ?`,
      [
        name,
        email,
        role_id,
        crp_number || null,
        mode,
        repPerc,
        repEvalPerc,
        repFixed,
        pix_key || null,
        pix_key_type || null,
        bank_info || null,
        userId
      ]
    );

    recordAuditLog(req, 'UPDATE_USER', `/collaborators/${userId}`, `Atualizou dados e parâmetros de repasse do colaborador ID ${userId}`);
    res.json({ success: true, message: 'Dados do colaborador atualizados com sucesso.' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Erro ao atualizar colaborador.' });
  }
});

// ==========================================
// 14. CONFIGURAÇÕES DA CLÍNICA
// ==========================================
router.get('/clinic-settings', authenticateToken, (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinic_id || 1;
  const settings = queryOne<any>('SELECT * FROM clinic_settings WHERE id = ?', [clinicId]);
  const canViewFin = canUserViewFinancial(req.user);
  if (settings && !canViewFin) {
    settings.default_session_price = null;
    settings.default_evaluation_price = null;
  }
  if (settings) {
    settings.repasse_enabled = Boolean(settings.repasse_enabled ?? 1);
    settings.operating_mode = settings.operating_mode || 'ENTERPRISE_CLINIC';
    settings.reception_tower_enabled = Boolean(settings.reception_tower_enabled ?? 1);
    settings.rooms_enabled = Boolean(settings.rooms_enabled ?? 1);
    settings.collaborators_enabled = Boolean(settings.collaborators_enabled ?? 1);
    settings.waiting_tv_enabled = Boolean(settings.waiting_tv_enabled ?? 1);
  }
  res.json({ settings });
});

router.put('/clinic-settings', authenticateToken, (req: AuthRequest, res: Response) => {
  const isAdmin = req.user?.role === 'ADMIN' || req.user?.role_id === 1 || Boolean(req.user?.permissions?.includes('manage_users'));
  if (!isAdmin) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }

  const {
    clinic_name,
    cnpj,
    phone,
    email,
    address,
    logo_base64,
    default_session_price,
    default_evaluation_price,
    pix_key,
    pix_key_type,
    pix_beneficiary,
    bank_info,
    repasse_enabled,
    operating_mode,
    reception_tower_enabled,
    rooms_enabled,
    collaborators_enabled,
    waiting_tv_enabled,
  } = req.body;
  
  if (!clinic_name) {
    return res.status(400).json({ error: 'Nome da Clínica é obrigatório' });
  }

  const sessPrice = default_session_price !== undefined && default_session_price !== null
    ? Number(default_session_price)
    : 180.00;
  const evalPrice = default_evaluation_price !== undefined && default_evaluation_price !== null
    ? Number(default_evaluation_price)
    : 2400.00;

  const clinicId = req.user?.clinic_id || 1;
  const currentSettings = queryOne<any>('SELECT * FROM clinic_settings WHERE id = ?', [clinicId]);
  
  let repEnabledVal = repasse_enabled !== undefined ? (repasse_enabled ? 1 : 0) : (currentSettings?.repasse_enabled ?? 1);
  let recTowerVal = reception_tower_enabled !== undefined ? (reception_tower_enabled ? 1 : 0) : (currentSettings?.reception_tower_enabled ?? 1);
  let roomsVal = rooms_enabled !== undefined ? (rooms_enabled ? 1 : 0) : (currentSettings?.rooms_enabled ?? 1);
  let collabVal = collaborators_enabled !== undefined ? (collaborators_enabled ? 1 : 0) : (currentSettings?.collaborators_enabled ?? 1);
  let tvVal = waiting_tv_enabled !== undefined ? (waiting_tv_enabled ? 1 : 0) : (currentSettings?.waiting_tv_enabled ?? 1);
  let modeVal = operating_mode || currentSettings?.operating_mode || 'ENTERPRISE_CLINIC';

  // Se o operating_mode mudou e flags específicas não foram enviadas explicitamente
  if (operating_mode && operating_mode !== currentSettings?.operating_mode) {
    if (operating_mode === 'SOLO') {
      if (repasse_enabled === undefined) repEnabledVal = 0;
      if (reception_tower_enabled === undefined) recTowerVal = 0;
      if (rooms_enabled === undefined) roomsVal = 0;
      if (collaborators_enabled === undefined) collabVal = 0;
      if (waiting_tv_enabled === undefined) tvVal = 0;
    } else if (operating_mode === 'SMALL_CLINIC') {
      if (repasse_enabled === undefined) repEnabledVal = 1;
      if (reception_tower_enabled === undefined) recTowerVal = 0;
      if (rooms_enabled === undefined) roomsVal = 0;
      if (collaborators_enabled === undefined) collabVal = 1;
      if (waiting_tv_enabled === undefined) tvVal = 0;
    } else if (operating_mode === 'ENTERPRISE_CLINIC') {
      if (repasse_enabled === undefined) repEnabledVal = 1;
      if (reception_tower_enabled === undefined) recTowerVal = 1;
      if (rooms_enabled === undefined) roomsVal = 1;
      if (collaborators_enabled === undefined) collabVal = 1;
      if (waiting_tv_enabled === undefined) tvVal = 1;
    }
  }

  execute(
    `UPDATE clinic_settings 
     SET clinic_name = ?, cnpj = ?, phone = ?, email = ?, address = ?, logo_base64 = ?,
         default_session_price = ?, default_evaluation_price = ?,
         pix_key = ?, pix_key_type = ?, pix_beneficiary = ?, bank_info = ?,
         repasse_enabled = ?, operating_mode = ?, reception_tower_enabled = ?,
         rooms_enabled = ?, collaborators_enabled = ?, waiting_tv_enabled = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      clinic_name,
      cnpj || null,
      phone || null,
      email || null,
      address || null,
      logo_base64 || null,
      sessPrice,
      evalPrice,
      pix_key || null,
      pix_key_type || 'CPF',
      pix_beneficiary || null,
      bank_info || null,
      repEnabledVal,
      modeVal,
      recTowerVal,
      roomsVal,
      collabVal,
      tvVal,
      clinicId
    ]
  );
  
  recordAuditLog(req, 'UPDATE_CLINIC_SETTINGS', '/clinic-settings', `Atualizou configurações da clínica (modo: ${modeVal})`);
  res.json({
    success: true,
    settings: {
      clinic_name,
      operating_mode: modeVal,
      repasse_enabled: repEnabledVal === 1,
      reception_tower_enabled: recTowerVal === 1,
      rooms_enabled: roomsVal === 1,
      collaborators_enabled: collabVal === 1,
      waiting_tv_enabled: tvVal === 1,
    }
  });
});

// ==========================================
// 15. CONTABILIDADE & NOTAS FISCAIS
// ==========================================

// Configurações Contábeis
router.get('/settings/accounting', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinic_id || 1;
    const settings = queryOne<any>('SELECT accounting_info_json FROM clinic_settings WHERE id = ?', [clinicId]);
    let accounting = null;
    if (settings && settings.accounting_info_json) {
      try {
        const parsed = JSON.parse(settings.accounting_info_json);
        accounting = {
          ...parsed,
          serviceCode: parsed.serviceCode || '',
          serviceCodeSessions: parsed.serviceCodeSessions || parsed.serviceCode || '',
          serviceCodeEvaluation: parsed.serviceCodeEvaluation || '',
          messageTemplate: parsed.messageTemplate || '',
          messageTemplateSessions: parsed.messageTemplateSessions || parsed.messageTemplate || '',
          messageTemplateEvaluation: parsed.messageTemplateEvaluation || '',
        };
      } catch (e) {
        console.error('Failed to parse accounting_info_json', e);
      }
    }
    res.json({ accounting });
  } catch (err) {
    console.error('Error fetching accounting settings:', err);
    res.status(500).json({ error: 'Erro ao carregar configurações contábeis' });
  }
});

router.put('/settings/accounting', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role_id !== 1) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem atualizar configurações contábeis.' });
  }

  try {
    const {
      officeName,
      contactName,
      phone,
      email,
      cnpj,
      municipalRegistration,
      serviceCode,
      serviceCodeSessions,
      serviceCodeEvaluation,
      messageTemplate,
      messageTemplateSessions,
      messageTemplateEvaluation,
    } = req.body;

    const accountingData = {
      officeName: officeName || '',
      contactName: contactName || '',
      phone: phone || '',
      email: email || '',
      cnpj: cnpj || '',
      municipalRegistration: municipalRegistration || '',
      serviceCode: serviceCodeSessions || serviceCode || '',
      serviceCodeSessions: serviceCodeSessions || serviceCode || '',
      serviceCodeEvaluation: serviceCodeEvaluation || '',
      messageTemplate: messageTemplateSessions || messageTemplate || '',
      messageTemplateSessions: messageTemplateSessions || messageTemplate || '',
      messageTemplateEvaluation: messageTemplateEvaluation || '',
      updatedAt: new Date().toISOString(),
    };

    execute(
      `UPDATE clinic_settings 
       SET accounting_info_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [JSON.stringify(accountingData)]
    );

    recordAuditLog(req, 'UPDATE_ACCOUNTING_SETTINGS', '/settings/accounting', 'Atualizou as configurações contábeis e fiscais');
    res.json({ success: true, accounting: accountingData });
  } catch (err) {
    console.error('Error updating accounting settings:', err);
    res.status(500).json({ error: 'Erro ao salvar configurações contábeis' });
  }
});

// Listar NFs
router.get('/invoices', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { status, month, date, start_date, end_date, patient_id } = req.query;

    let sql = `
      SELECT 
        i.*,
        p.full_name as patient_name,
        p.cpf as patient_cpf,
        p.phone as patient_phone,
        u.name as psychologist_name
      FROM invoices i
      JOIN patients p ON i.patient_id = p.id
      JOIN users u ON i.psychologist_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    const canManageAll = req.user?.role === 'ADMIN' || req.user?.permissions?.includes('manage_users');
    if (!canManageAll && req.user?.id) {
      sql += ` AND i.psychologist_id = ? `;
      params.push(req.user.id);
    }

    if (status && status !== 'ALL') {
      sql += ` AND i.status = ? `;
      params.push(status);
    }

    if (date) {
      sql += ` AND (DATE(i.requested_at) = ? OR DATE(i.issued_at) = ?) `;
      params.push(date, date);
    } else if (start_date && end_date) {
      sql += ` AND (DATE(i.requested_at) BETWEEN ? AND ? OR DATE(i.issued_at) BETWEEN ? AND ?) `;
      params.push(start_date, end_date, start_date, end_date);
    } else if (start_date) {
      sql += ` AND (DATE(i.requested_at) >= ? OR DATE(i.issued_at) >= ?) `;
      params.push(start_date, start_date);
    } else if (end_date) {
      sql += ` AND (DATE(i.requested_at) <= ? OR DATE(i.issued_at) <= ?) `;
      params.push(end_date, end_date);
    } else if (month) {
      sql += ` AND (i.requested_at LIKE ? OR i.issued_at LIKE ?) `;
      params.push(`${month}%`, `${month}%`);
    }

    if (patient_id) {
      sql += ` AND i.patient_id = ? `;
      params.push(patient_id);
    }

    sql += ` ORDER BY i.id DESC`;

    const invoices = queryAll<any>(sql, params);

    let invoicesWithItems = invoices;
    if (invoices.length > 0) {
      const invoiceIds = invoices.map(i => i.id);
      const placeholders = invoiceIds.map(() => '?').join(',');
      const allItems = queryAll<any>(
        `SELECT ii.*, s.modality, s.start_time, s.end_time, ne.title as evaluation_title
         FROM invoice_items ii
         LEFT JOIN sessions s ON ii.session_id = s.id
         LEFT JOIN neuropsych_evaluations ne ON ii.evaluation_id = ne.id
         WHERE ii.invoice_id IN (${placeholders})
         ORDER BY ii.session_date ASC`,
        invoiceIds
      );

      const itemsByInvoiceId = new Map<number, any[]>();
      for (const item of allItems) {
        let list = itemsByInvoiceId.get(item.invoice_id);
        if (!list) {
          list = [];
          itemsByInvoiceId.set(item.invoice_id, list);
        }
        list.push(item);
      }

      invoicesWithItems = invoices.map(inv => ({
        ...inv,
        items: itemsByInvoiceId.get(inv.id) || []
      }));
    }

    res.json({ invoices: invoicesWithItems });
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ error: 'Erro ao carregar notas fiscais' });
  }
});

// Visão Geral de Sessões da Clínica & Pendências de NF
router.get('/invoices/sessions-overview', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { month, date, start_date, end_date, fiscal_status, payment_status, payment_method, search, patient_id } = req.query;

    let sql = `
      SELECT 
        s.id as session_id,
        s.start_time,
        s.end_time,
        s.modality,
        s.price,
        s.status as session_status,
        s.patient_id,
        p.full_name as patient_name,
        p.cpf as patient_cpf,
        p.phone as patient_phone,
        u.name as psychologist_name,
        CASE WHEN datetime(s.start_time) > datetime('now') THEN 1 ELSE 0 END as is_future,
        COALESCE(ft.status, 'PENDING') as payment_status,
        ft.payment_method,
        ft.paid_at,
        COALESCE(active_inv.invoice_status, 'NONE') as fiscal_status,
        active_inv.invoice_id,
        active_inv.invoice_number,
        active_inv.issued_at as invoice_issued_at,
        active_inv.requested_at as invoice_requested_at
      FROM sessions s
      JOIN patients p ON s.patient_id = p.id
      JOIN users u ON s.psychologist_id = u.id
      LEFT JOIN financial_transactions ft ON ft.session_id = s.id
      LEFT JOIN (
        SELECT ii.session_id, inv.id as invoice_id, inv.status as invoice_status, inv.invoice_number, inv.issued_at, inv.requested_at
        FROM invoice_items ii
        JOIN invoices inv ON ii.invoice_id = inv.id
        WHERE inv.status != 'CANCELED' AND ii.session_id IS NOT NULL
      ) active_inv ON active_inv.session_id = s.id
      WHERE s.status != 'CANCELED'
    `;
    const params: any[] = [];

    const canManageAll = req.user?.role === 'ADMIN' || req.user?.permissions?.includes('manage_users');
    if (!canManageAll && req.user?.id) {
      sql += ` AND s.psychologist_id = ? `;
      params.push(req.user.id);
    }

    if (patient_id) {
      sql += ` AND s.patient_id = ? `;
      params.push(patient_id);
    }

    if (date) {
      sql += ` AND DATE(s.start_time) = ? `;
      params.push(date);
    } else if (start_date && end_date) {
      sql += ` AND DATE(s.start_time) BETWEEN ? AND ? `;
      params.push(start_date, end_date);
    } else if (start_date) {
      sql += ` AND DATE(s.start_time) >= ? `;
      params.push(start_date);
    } else if (end_date) {
      sql += ` AND DATE(s.start_time) <= ? `;
      params.push(end_date);
    } else if (month) {
      sql += ` AND s.start_time LIKE ? `;
      params.push(`${month}%`);
    }

    if (payment_status && payment_status !== 'ALL') {
      if (payment_status === 'PAID') {
        sql += ` AND ft.status = 'PAID' `;
      } else if (payment_status === 'PENDING') {
        sql += ` AND (ft.status IS NULL OR ft.status != 'PAID') `;
      }
    }

    if (payment_method && payment_method !== 'ALL') {
      sql += ` AND ft.status = 'PAID' AND (
        ft.payment_method = ? 
        OR (? LIKE 'Cartão%' AND ft.payment_method = 'CARTAO')
        OR (? = 'CARTAO' AND ft.payment_method LIKE 'Cartão%')
        OR (UPPER(ft.payment_method) = UPPER(?))
      ) `;
      params.push(payment_method, payment_method, payment_method, payment_method);
    }

    if (fiscal_status && fiscal_status !== 'ALL') {
      if (fiscal_status === 'NONE') {
        sql += ` AND active_inv.invoice_status IS NULL `;
      } else {
        sql += ` AND active_inv.invoice_status = ? `;
        params.push(fiscal_status);
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(p.full_name) LIKE ? OR p.cpf LIKE ?) `;
      params.push(q, q);
    }

    sql += ` ORDER BY s.start_time DESC`;

    const sessions = queryAll<any>(sql, params);
    res.json({ sessions });
  } catch (err) {
    console.error('Error fetching sessions overview for invoices:', err);
    res.status(500).json({ error: 'Erro ao carregar visão geral de sessões' });
  }
});

// Visão Geral de Avaliações Neuropsicológicas da Clínica & Pendências de NF
router.get('/invoices/evaluations-overview', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { month, date, start_date, end_date, fiscal_status, payment_status, payment_method, search, patient_id } = req.query;

    let sql = `
      SELECT 
        ft.id as transaction_id,
        ft.evaluation_id,
        ft.patient_id,
        p.full_name as patient_name,
        p.cpf as patient_cpf,
        p.phone as patient_phone,
        ne.title as evaluation_title,
        ne.status as evaluation_status,
        u.name as psychologist_name,
        ft.installment_number,
        ft.total_installments,
        ft.amount as price,
        ft.status as payment_status,
        ft.payment_method,
        ft.transaction_date,
        ft.paid_at,
        COALESCE(active_inv.invoice_status, 'NONE') as fiscal_status,
        active_inv.invoice_id,
        active_inv.invoice_number,
        active_inv.issued_at as invoice_issued_at,
        active_inv.requested_at as invoice_requested_at
      FROM financial_transactions ft
      JOIN patients p ON ft.patient_id = p.id
      JOIN neuropsych_evaluations ne ON ft.evaluation_id = ne.id
      JOIN users u ON ne.psychologist_id = u.id
      LEFT JOIN (
        SELECT ii.transaction_id, inv.id as invoice_id, inv.status as invoice_status, inv.invoice_number, inv.issued_at, inv.requested_at
        FROM invoice_items ii
        JOIN invoices inv ON ii.invoice_id = inv.id
        WHERE inv.status != 'CANCELED' AND ii.transaction_id IS NOT NULL
      ) active_inv ON active_inv.transaction_id = ft.id
      WHERE ft.evaluation_id IS NOT NULL
    `;
    const params: any[] = [];

    const canManageAll = req.user?.role === 'ADMIN' || req.user?.permissions?.includes('manage_users');
    if (!canManageAll && req.user?.id) {
      sql += ` AND ne.psychologist_id = ? `;
      params.push(req.user.id);
    }

    if (patient_id) {
      sql += ` AND ft.patient_id = ? `;
      params.push(patient_id);
    }

    if (date) {
      sql += ` AND DATE(COALESCE(ft.paid_at, ft.transaction_date)) = ? `;
      params.push(date);
    } else if (start_date && end_date) {
      sql += ` AND DATE(COALESCE(ft.paid_at, ft.transaction_date)) BETWEEN ? AND ? `;
      params.push(start_date, end_date);
    } else if (start_date) {
      sql += ` AND DATE(COALESCE(ft.paid_at, ft.transaction_date)) >= ? `;
      params.push(start_date);
    } else if (end_date) {
      sql += ` AND DATE(COALESCE(ft.paid_at, ft.transaction_date)) <= ? `;
      params.push(end_date);
    } else if (month) {
      sql += ` AND COALESCE(ft.paid_at, ft.transaction_date) LIKE ? `;
      params.push(`${month}%`);
    }

    if (payment_status && payment_status !== 'ALL') {
      sql += ` AND ft.status = ? `;
      params.push(payment_status);
    }

    if (payment_method && payment_method !== 'ALL') {
      sql += ` AND ft.payment_method = ? `;
      params.push(payment_method);
    }

    if (fiscal_status && fiscal_status !== 'ALL') {
      if (fiscal_status === 'NONE') {
        sql += ` AND (active_inv.invoice_status IS NULL OR active_inv.invoice_status = 'NONE') `;
      } else if (fiscal_status === 'REQUESTED') {
        sql += ` AND active_inv.invoice_status IN ('PENDING_DISPATCH', 'REQUESTED') `;
      } else if (fiscal_status === 'ISSUED') {
        sql += ` AND active_inv.invoice_status = 'ISSUED' `;
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(p.full_name) LIKE ? OR p.cpf LIKE ? OR LOWER(ne.title) LIKE ?) `;
      params.push(q, q, q);
    }

    sql += ` ORDER BY COALESCE(ft.paid_at, ft.transaction_date) DESC, ft.id DESC`;

    const evaluations = queryAll<any>(sql, params);
    res.json({ evaluations });
  } catch (err) {
    console.error('Error fetching evaluations overview for invoices:', err);
    res.status(500).json({ error: 'Erro ao carregar visão geral de avaliações' });
  }
});

// Sessões elegíveis do paciente para compor NF
router.get('/invoices/available-sessions/:patientId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    if (!patientId) {
      return res.status(400).json({ error: 'ID do paciente inválido' });
    }

    // 1. Sessões pagas sem NF ativa vinculada
    const paidSessions = queryAll<any>(`
      SELECT 
        s.id,
        s.start_time,
        s.end_time,
        s.modality,
        s.price,
        s.status,
        ft.payment_method,
        ft.paid_at,
        1 as is_paid
      FROM sessions s
      JOIN financial_transactions ft ON ft.session_id = s.id
      WHERE s.patient_id = ?
        AND ft.status = 'PAID'
        AND s.id NOT IN (
          SELECT ii.session_id 
          FROM invoice_items ii
          JOIN invoices inv ON ii.invoice_id = inv.id
          WHERE inv.status != 'CANCELED' AND ii.session_id IS NOT NULL
        )
      ORDER BY s.start_time DESC
    `, [patientId]);

    // 2. Sessões pendentes ou futuras sem NF ativa
    const futureOrPendingSessions = queryAll<any>(`
      SELECT 
        s.id,
        s.start_time,
        s.end_time,
        s.modality,
        s.price,
        s.status,
        'PENDING' as payment_status,
        0 as is_paid
      FROM sessions s
      LEFT JOIN financial_transactions ft ON ft.session_id = s.id
      WHERE s.patient_id = ?
        AND s.status != 'CANCELED'
        AND (ft.status IS NULL OR ft.status = 'PENDING')
        AND s.id NOT IN (
          SELECT ii.session_id 
          FROM invoice_items ii
          JOIN invoices inv ON ii.invoice_id = inv.id
          WHERE inv.status != 'CANCELED' AND ii.session_id IS NOT NULL
        )
      ORDER BY s.start_time ASC
    `, [patientId]);

    // 3. Parcelas de Avaliação Neuropsicológica quitadas sem NF ativa vinculada
    const paidEvaluations = queryAll<any>(`
      SELECT 
        ft.id as transaction_id,
        ft.evaluation_id,
        ft.amount as price,
        ft.payment_method,
        ft.paid_at,
        ft.transaction_date,
        ft.installment_number,
        ft.total_installments,
        ne.title as evaluation_title,
        ne.status as evaluation_status,
        1 as is_paid
      FROM financial_transactions ft
      JOIN neuropsych_evaluations ne ON ft.evaluation_id = ne.id
      WHERE ft.patient_id = ?
        AND ft.status = 'PAID'
        AND ft.id NOT IN (
          SELECT ii.transaction_id
          FROM invoice_items ii
          JOIN invoices inv ON ii.invoice_id = inv.id
          WHERE inv.status != 'CANCELED' AND ii.transaction_id IS NOT NULL
        )
      ORDER BY ft.transaction_date DESC, ft.id DESC
    `, [patientId]);

    res.json({ paidSessions, futureOrPendingSessions, paidEvaluations });
  } catch (err) {
    console.error('Error fetching available sessions for invoice:', err);
    res.status(500).json({ error: 'Erro ao buscar sessões disponíveis' });
  }
});

// Criar Solicitação de NF (aceita sessões de psicoterapia e/ou parcelas de avaliação neuropsicológica)
router.post('/invoices', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { patient_id, session_ids, evaluation_transaction_ids, items: customItems, notes, status } = req.body;

    const sessionIds: number[] = Array.isArray(session_ids) ? [...session_ids] : [];
    const evalTxIds: number[] = Array.isArray(evaluation_transaction_ids) ? [...evaluation_transaction_ids] : [];

    if (Array.isArray(customItems)) {
      for (const item of customItems) {
        if (item.type === 'SESSION' && !sessionIds.includes(item.id)) {
          sessionIds.push(item.id);
        } else if (item.type === 'EVALUATION' && !evalTxIds.includes(item.id)) {
          evalTxIds.push(item.id);
        }
      }
    }

    if (!patient_id || (sessionIds.length === 0 && evalTxIds.length === 0)) {
      return res.status(400).json({ error: 'Paciente e ao menos uma sessão ou parcela de avaliação são obrigatórios' });
    }

    const patient = queryOne<any>('SELECT * FROM patients WHERE id = ?', [patient_id]);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    const psychologistId = req.user?.id || patient.psychologist_id || 1;

    // Buscar sessões selecionadas
    let sessions: any[] = [];
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map(() => '?').join(',');
      sessions = queryAll<any>(
        `SELECT s.*, ft.status as payment_status 
         FROM sessions s 
         LEFT JOIN financial_transactions ft ON ft.session_id = s.id
         WHERE s.id IN (${placeholders}) AND s.patient_id = ?`,
        [...sessionIds, patient_id]
      );
    }

    // Buscar parcelas de avaliação neuropsicológica selecionadas
    let evalTransactions: any[] = [];
    if (evalTxIds.length > 0) {
      const placeholders = evalTxIds.map(() => '?').join(',');
      evalTransactions = queryAll<any>(
        `SELECT ft.*, ne.title as evaluation_title
         FROM financial_transactions ft
         JOIN neuropsych_evaluations ne ON ft.evaluation_id = ne.id
         WHERE ft.id IN (${placeholders}) AND ft.patient_id = ?`,
        [...evalTxIds, patient_id]
      );
    }

    if (sessions.length === 0 && evalTransactions.length === 0) {
      return res.status(400).json({ error: 'Nenhum item válido encontrado para faturamento' });
    }

    const sessionsTotal = sessions.reduce((sum, s) => sum + Number(s.price || 0), 0);
    const evalsTotal = evalTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const totalAmount = sessionsTotal + evalsTotal;
    const invoiceStatus = status || 'PENDING_DISPATCH';

    const invRes = execute(`
      INSERT INTO invoices (
        patient_id, psychologist_id, status, total_amount, notes, requested_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [patient_id, psychologistId, invoiceStatus, totalAmount, notes || null]);

    const invoiceId = invRes.lastInsertRowid;

    for (const s of sessions) {
      const isFuture = s.payment_status !== 'PAID' ? 1 : 0;
      execute(`
        INSERT INTO invoice_items (
          invoice_id, session_id, item_type, item_description, session_date, session_price, is_future_reimbursement
        ) VALUES (?, ?, 'SESSION', ?, ?, ?, ?)
      `, [
        invoiceId,
        s.id,
        `Sessão de Psicoterapia (${s.modality === 'ONLINE' ? 'Online' : 'Presencial'})`,
        s.start_time,
        Number(s.price || 0),
        isFuture,
      ]);
    }

    for (const tx of evalTransactions) {
      const desc = `Avaliação Neuropsicológica: Parcela ${tx.installment_number || 1}/${tx.total_installments || 1} - ${tx.evaluation_title || 'Laudo'}`;
      const itemDate = tx.paid_at || tx.transaction_date || new Date().toISOString();
      execute(`
        INSERT INTO invoice_items (
          invoice_id, evaluation_id, transaction_id, item_type, item_description, session_date, session_price, is_future_reimbursement
        ) VALUES (?, ?, ?, 'EVALUATION', ?, ?, ?, 0)
      `, [
        invoiceId,
        tx.evaluation_id,
        tx.id,
        desc,
        itemDate,
        Number(tx.amount || 0),
      ]);

      execute(`UPDATE financial_transactions SET invoice_status = 'REQUESTED' WHERE id = ?`, [tx.id]);
    }

    recordAuditLog(
      req,
      'CREATE_INVOICE_REQUEST',
      `/invoices/${invoiceId}`,
      `Criou solicitação de NF nº ${invoiceId} para paciente ${patient.full_name} (${sessions.length} sessões, ${evalTransactions.length} parcelas de avaliação - R$ ${totalAmount.toFixed(2)})`
    );

    // Se solicitado emissão direta 1-clique via Gateway (Nuvem Fiscal)
    if (req.body.auto_emit_direct) {
      try {
        const emitRes = await emitNfseDirect(invoiceId, {
          use_guardian_as_tomador: Boolean(req.body.use_guardian_as_tomador),
          clinicId: 1,
          psychologistId,
        });
        recordAuditLog(
          req,
          'EMIT_DIRECT_INVOICE',
          `/invoices/${invoiceId}`,
          `Emissão Direta 1-Clique autorizada para NF nº ${emitRes.invoice?.invoice_number} (ID ${invoiceId})`
        );
      } catch (emitErr: any) {
        console.error('Falha na emissão direta imediata da NF:', emitErr);
        execute(
          `UPDATE invoices SET status = 'REJECTED', error_details = ? WHERE id = ?`,
          [emitErr.message || 'Erro ao comunicar com a prefeitura', invoiceId]
        );
      }
    }

    const createdInvoice = queryOne<any>(`
      SELECT i.*, p.full_name as patient_name, p.cpf as patient_cpf, p.phone as patient_phone
      FROM invoices i
      JOIN patients p ON i.patient_id = p.id
      WHERE i.id = ?
    `, [invoiceId]);

    const createdItems = queryAll<any>(
      `SELECT ii.*, s.modality, s.start_time, s.end_time, ne.title as evaluation_title
       FROM invoice_items ii
       LEFT JOIN sessions s ON ii.session_id = s.id
       LEFT JOIN neuropsych_evaluations ne ON ii.evaluation_id = ne.id
       WHERE ii.invoice_id = ?
       ORDER BY ii.session_date ASC`,
      [invoiceId]
    );

    res.status(201).json({
      success: true,
      invoice: {
        ...createdInvoice,
        items: createdItems,
      },
      message: req.body.auto_emit_direct
        ? (createdInvoice.status === 'ISSUED' ? 'NFS-e autorizada e emitida com sucesso!' : 'NFS-e registrada com pendência.')
        : 'Solicitação de NF registrada com sucesso!'
    });
  } catch (err) {
    console.error('Error creating invoice request:', err);
    res.status(500).json({ error: 'Erro ao criar solicitação de NF' });
  }
});

// Atualizar Status da NF (ex: PENDING_DISPATCH -> REQUESTED após envio no WhatsApp)
router.put('/invoices/:id/status', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const validStatuses = ['PENDING_DISPATCH', 'REQUESTED', 'PROCESSING_GATEWAY', 'ISSUED', 'REJECTED', 'CANCELED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status de NF inválido' });
    }

    execute('UPDATE invoices SET status = ? WHERE id = ?', [status, id]);

    if (status === 'CANCELED') {
      execute(`
        UPDATE financial_transactions 
        SET invoice_status = 'NOT_ISSUED' 
        WHERE id IN (
          SELECT transaction_id FROM invoice_items WHERE invoice_id = ? AND transaction_id IS NOT NULL
        )
      `, [id]);
    } else if (status === 'ISSUED') {
      execute(`
        UPDATE financial_transactions 
        SET invoice_status = 'ISSUED' 
        WHERE id IN (
          SELECT transaction_id FROM invoice_items WHERE invoice_id = ? AND transaction_id IS NOT NULL
        )
      `, [id]);
    }

    recordAuditLog(req, 'UPDATE_INVOICE_STATUS', `/invoices/${id}`, `Alterou status da NF ID ${id} para ${status}`);

    res.json({ success: true, status });
  } catch (err) {
    console.error('Error updating invoice status:', err);
    res.status(500).json({ error: 'Erro ao atualizar status da NF' });
  }
});

// Concluir NF emitida (anotação de número, data e anexo do PDF)
router.post('/invoices/:id/complete', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { invoice_number, issued_at, file_name, file_size, file_type, file_data, notes } = req.body;

    if (!invoice_number || !issued_at) {
      return res.status(400).json({ error: 'Número da NF e Data de Emissão são obrigatórios' });
    }

    const inv = queryOne<any>('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!inv) {
      return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }

    let hash_sha256 = null;
    if (file_data) {
      hash_sha256 = generateSHA256(file_data);
    }

    execute(`
      UPDATE invoices 
      SET status = 'ISSUED',
          invoice_number = ?,
          issued_at = ?,
          file_name = ?,
          file_size = ?,
          file_type = ?,
          file_data = ?,
          hash_sha256 = ?,
          notes = COALESCE(?, notes)
      WHERE id = ?
    `, [
      invoice_number,
      issued_at,
      file_name || null,
      file_size || null,
      file_type || null,
      file_data || null,
      hash_sha256,
      notes || null,
      id
    ]);

    // Vincular automaticamente como documento clínico/fiscal na ficha do paciente
    if (file_data) {
      const docTitle = `Nota Fiscal Eletrônica nº ${invoice_number}`;
      const docContent = JSON.stringify({
        invoice_id: id,
        invoice_number,
        issued_at,
        total_amount: inv.total_amount,
        attached_at: new Date().toISOString()
      });

      execute(`
        INSERT INTO patient_documents (
          patient_id, psychologist_id, title, category, document_type,
          content_json, file_name, file_size, file_type, file_data, hash_sha256, is_signed, signed_at
        ) VALUES (?, ?, ?, 'OUTROS', 'NOTA_FISCAL', ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `, [
        inv.patient_id,
        inv.psychologist_id,
        docTitle,
        docContent,
        file_name || `NF_${invoice_number}.pdf`,
        file_size || 0,
        file_type || 'application/pdf',
        file_data,
        hash_sha256
      ]);
    }

    // Atualizar status fiscal das transações vinculadas
    execute(`
      UPDATE financial_transactions 
      SET invoice_status = 'ISSUED' 
      WHERE id IN (
        SELECT transaction_id FROM invoice_items WHERE invoice_id = ? AND transaction_id IS NOT NULL
      )
    `, [id]);

    recordAuditLog(req, 'COMPLETE_INVOICE', `/invoices/${id}`, `Concluiu a emissão da NF nº ${invoice_number} (ID ${id})`);

    res.json({ success: true, message: 'Nota fiscal emitida e vinculada com sucesso!' });
  } catch (err) {
    console.error('Error completing invoice:', err);
    res.status(500).json({ error: 'Erro ao concluir nota fiscal' });
  }
});

// Emissão Direta de NFS-e (1 Clique via Gateway)
router.post('/invoices/:id/emit-direct', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { use_guardian_as_tomador } = req.body;

    const inv = queryOne<any>('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!inv) {
      return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }

    const emitRes = await emitNfseDirect(id, {
      use_guardian_as_tomador: Boolean(use_guardian_as_tomador),
      clinicId: 1,
      psychologistId: req.user?.id,
    });

    recordAuditLog(req, 'EMIT_DIRECT_INVOICE', `/invoices/${id}`, `Emissão Direta 1-Clique autorizada para NF nº ${emitRes.invoice?.invoice_number}`);
    res.json({ success: true, invoice: emitRes.invoice, message: 'NFS-e emitida e autorizada com sucesso!' });
  } catch (err: any) {
    console.error('Error emitting direct invoice:', err);
    execute(
      `UPDATE invoices SET status = 'REJECTED', error_details = ? WHERE id = ?`,
      [err.message || 'Erro ao comunicar com a prefeitura', Number(req.params.id)]
    );
    res.status(500).json({ error: err.message || 'Erro ao emitir NFS-e na prefeitura' });
  }
});

// Cancelamento Formal de NFS-e na Prefeitura
router.post('/invoices/:id/cancel-direct', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { justification } = req.body;

    if (!justification || justification.trim().length < 10) {
      return res.status(400).json({ error: 'A justificativa de cancelamento deve ter ao menos 10 caracteres' });
    }

    const cancelRes = await cancelNfseDirect(id, justification);
    recordAuditLog(req, 'CANCEL_DIRECT_INVOICE', `/invoices/${id}`, `Cancelamento de NFS-e ID ${id}: ${justification}`);
    res.json(cancelRes);
  } catch (err: any) {
    console.error('Error canceling invoice:', err);
    res.status(500).json({ error: err.message || 'Erro ao cancelar NFS-e na prefeitura' });
  }
});

// Download do XML Oficial da NFS-e
router.get('/invoices/:id/xml', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const inv = queryOne<any>('SELECT invoice_number, xml_data FROM invoices WHERE id = ?', [id]);
    if (!inv || !inv.xml_data) {
      return res.status(404).json({ error: 'XML oficial da NFS-e não disponível para esta nota' });
    }

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="NFSe_${inv.invoice_number || id}.xml"`);
    res.send(inv.xml_data);
  } catch (err) {
    console.error('Error downloading XML:', err);
    res.status(500).json({ error: 'Erro ao obter XML da nota fiscal' });
  }
});

// Obter credenciais fiscais da clínica (Públicas/Mascaradas)
router.get('/fiscal/credentials', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const creds = getClinicFiscalCredentials(1);
    res.json({ credentials: creds });
  } catch (err) {
    console.error('Error fetching fiscal credentials:', err);
    res.status(500).json({ error: 'Erro ao buscar credenciais fiscais' });
  }
});

// Salvar credenciais fiscais da clínica e certificado A1
router.post('/fiscal/credentials', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const updated = saveClinicFiscalCredentials(1, req.body);
    recordAuditLog(req, 'UPDATE_FISCAL_CREDENTIALS', '/fiscal/credentials', 'Atualizou credenciais fiscais e certificado digital A1');
    res.json({ success: true, credentials: updated, message: 'Configurações fiscais salvas com sucesso!' });
  } catch (err: any) {
    console.error('Error saving fiscal credentials:', err);
    res.status(500).json({ error: err.message || 'Erro ao salvar credenciais fiscais' });
  }
});

// Testar comunicação com a prefeitura
router.post('/fiscal/test-connection', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const testRes = await testMunicipalConnection(1);
    res.json(testRes);
  } catch (err: any) {
    console.error('Error testing fiscal connection:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao testar comunicação municipal' });
  }
});

// Webhook assíncrono do Gateway (Nuvem Fiscal)
router.post('/fiscal/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    console.log('Recebido webhook fiscal:', event?.tipo || event?.event);
    res.json({ received: true });
  } catch (err) {
    console.error('Error in fiscal webhook:', err);
    res.status(500).json({ error: 'Erro no processamento do webhook' });
  }
});

// ==========================================
// 15.1. INTEGRAÇÃO GATEWAY ASAAS & COBRANÇA
// ==========================================

// Obter configurações públicas/mascaradas do Asaas
router.get('/settings/gateway', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const config = getPublicGatewaySettings(1, req.headers.host);
    res.json({ settings: config });
  } catch (err: any) {
    console.error('Error fetching gateway settings:', err);
    res.status(500).json({ error: 'Erro ao buscar configurações do gateway' });
  }
});

// Salvar credenciais e preferências do Asaas
router.post('/settings/gateway', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const result = saveGatewaySettings(1, req.body);
    recordAuditLog(req, 'UPDATE_GATEWAY_SETTINGS', '/settings/gateway', 'Atualizou configurações da integração Asaas');
    res.json(result);
  } catch (err: any) {
    console.error('Error saving gateway settings:', err);
    res.status(500).json({ error: err.message || 'Erro ao salvar configurações do gateway' });
  }
});

// Testar autenticação e conectividade com a API do Asaas
router.post('/settings/gateway/test', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { apiKey, environment } = req.body;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Chave de API do Asaas não informada.' });
    }
    const result = await testAsaasConnection(apiKey, environment || 'SANDBOX');
    res.json(result);
  } catch (err: any) {
    console.error('Error testing Asaas connection:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao testar conexão com o Asaas' });
  }
});

// Criar cobrança via Asaas (PIX Dinâmico + Cartão de Crédito)
router.post('/financial/asaas/charge', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, amount, dueDate, description, billingType, installments, transactionId, sessionId, evaluationId } = req.body;
    if (!patientId || !amount) {
      return res.status(400).json({ success: false, error: 'Paciente e valor são obrigatórios para emitir cobrança.' });
    }

    const result = await createAsaasCharge({
      clinicId: 1,
      patientId: Number(patientId),
      transactionId: transactionId ? Number(transactionId) : undefined,
      sessionId: sessionId ? Number(sessionId) : undefined,
      evaluationId: evaluationId ? Number(evaluationId) : undefined,
      amount: Number(amount),
      dueDate,
      description,
      billingType: billingType || 'UNDEFINED',
      installments: installments ? Number(installments) : undefined,
    });

    if (result.success) {
      recordAuditLog(
        req,
        'CREATE_ASAAS_CHARGE',
        '/financial/asaas/charge',
        `Gerou cobrança Asaas (${result.paymentId}) de R$ ${result.amount} para paciente #${patientId}`
      );
    }

    res.json(result);
  } catch (err: any) {
    console.error('Error generating Asaas charge:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao emitir cobrança no Asaas' });
  }
});

// Webhook assíncrono do Asaas (público, autenticado por token exclusivo)
router.post('/webhooks/asaas', (req: Request, res: Response) => {
  try {
    const token =
      (req.headers['asaas-access-token'] as string) ||
      (req.headers['authorization'] as string)?.replace('Bearer ', '') ||
      (req.query.token as string);

    const result = handleAsaasWebhookEvent(req.body, token);
    if (!result.success && result.message.includes('Token')) {
      return res.status(401).json(result);
    }
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error handling Asaas webhook:', err);
    res.status(500).json({ success: false, error: 'Erro interno no processamento do webhook Asaas' });
  }
});

// Migrador Universal v2.4: Importação atômica multi-sistemas (CSV / XLSX)
router.post('/patients/universal-import', authenticateToken, requireRole(['ADMIN']), (req: AuthRequest, res: Response) => {
  try {
    const { patients, sourceSystem } = req.body;
    if (!patients || !Array.isArray(patients)) {
      return res.status(400).json({ success: false, error: 'Lista de pacientes estruturada é obrigatória.' });
    }

    const result = executeUniversalMigration(patients, sourceSystem || 'Personalizado', req.user?.id || 1);
    
    recordAuditLog(
      req,
      'UNIVERSAL_PATIENTS_MIGRATION',
      '/patients/universal-import',
      `Migrador Universal (${result.sourceSystem}): ${result.imported} criados, ${result.updated} enriquecidos, ${result.pendingDocsCount} pendências (${result.totalRows} linhas)`
    );

    res.json(result);
  } catch (err: any) {
    console.error('Error in Universal Migrator route:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao processar migração dos pacientes' });
  }
});

// Importação em lote de pacientes do PsicoManager (CSV - Legado Mantido)
router.post('/patients/import-psicomanager', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { csvContent } = req.body;
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'Conteúdo do arquivo CSV é obrigatório.' });
    }

    const result = importPsicoManagerCsv(csvContent, req.user?.id || 1);
    recordAuditLog(
      req,
      'IMPORT_PSICOMANAGER_CSV',
      '/patients/import-psicomanager',
      `Importou planilha PsicoManager: ${result.imported} criados, ${result.updated} atualizados (${result.totalRows} linhas)`
    );

    res.json(result);
  } catch (err: any) {
    console.error('Error in PsicoManager import route:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao processar importação da planilha' });
  }
});

// ==========================================
// 16. AVALIAÇÕES NEUROPSICOLÓGICAS & LAUDOS
// ==========================================

const evaluationCreateSchema = z.object({
  patient_id: z.number(),
  psychologist_id: z.number().optional(),
  title: z.string().min(3, 'Título da avaliação/demanda é obrigatório'),
  estimated_sessions: z.number().min(1).default(6),
  total_price: z.number().min(0).optional(),
  payment_mode: z.enum(['A_VISTA', 'PARCELADO']).default('PARCELADO'),
  hypothesis_diagnosis: z.string().optional(),
  notes: z.string().optional(),
  installments: z.array(
    z.object({
      installment_number: z.number(),
      amount: z.number().min(0.01),
      due_date: z.string(),
      payment_method: z.enum(['PIX', 'CARTAO', 'DINHEIRO', 'BOLETO']).default('PIX'),
      notes: z.string().optional(),
    })
  ).optional(),
});

// ==========================================
// 6.6 AVALIAÇÕES NEUROPSICOLÓGICAS (HUB CENTRAL & PRONTUÁRIO)
// ==========================================

// Listar todas as avaliações neuropsicológicas (Hub Central) com controle de acesso ABAC e estatísticas
router.get('/evaluations', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST']), (req: AuthRequest, res: Response) => {
  try {
    const { status, psychologist_id, search } = req.query;

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.permissions?.includes('manage_users');
    const canViewFinancial = isAdmin || Boolean(req.user?.permissions?.includes('view_financial'));

    let sql = `
      SELECT e.*,
             p.full_name as patient_name, p.cpf as patient_cpf, p.phone as patient_phone,
             u.name as psychologist_name, u.crp_number as psychologist_crp
      FROM neuropsych_evaluations e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.psychologist_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // ABAC: se não for admin, força ver apenas as avaliações que ele é o responsável técnico
    if (!isAdmin) {
      sql += ` AND e.psychologist_id = ?`;
      params.push(req.user?.id);
    } else if (psychologist_id && psychologist_id !== 'ALL') {
      sql += ` AND e.psychologist_id = ?`;
      params.push(Number(psychologist_id));
    }

    if (status && status !== 'ALL') {
      sql += ` AND e.status = ?`;
      params.push(status);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const s = `%${search.trim()}%`;
      sql += ` AND (p.full_name LIKE ? OR p.cpf LIKE ? OR e.title LIKE ? OR e.hypothesis_diagnosis LIKE ?)`;
      params.push(s, s, s, s);
    }

    sql += ` ORDER BY e.created_at DESC`;

    const evaluations = queryAll<any>(sql, params);

    // Calcular KPIs globais respeitando o escopo do usuário
    let statsSql = `SELECT status, total_price, id FROM neuropsych_evaluations WHERE 1=1`;
    const statsParams: any[] = [];
    if (!isAdmin) {
      statsSql += ` AND psychologist_id = ?`;
      statsParams.push(req.user?.id);
    }
    const allForStats = queryAll<any>(statsSql, statsParams);

    let inProgressCount = 0;
    let awaitingDevolutivaCount = 0;
    let completedCount = 0;
    let totalContracted = 0;

    for (const item of allForStats) {
      if (item.status === 'IN_PROGRESS') inProgressCount++;
      else if (item.status === 'AWAITING_DEVOLUTIVA') awaitingDevolutivaCount++;
      else if (item.status === 'COMPLETED') completedCount++;
      totalContracted += Number(item.total_price) || 0;
    }

    // Buscar pagamentos consolidados das parcelas
    let totalPaidGlobal = 0;
    let totalPendingGlobal = 0;
    if (canViewFinancial) {
      let finSql = `
        SELECT t.status, t.amount 
        FROM financial_transactions t
        JOIN neuropsych_evaluations e ON t.evaluation_id = e.id
        WHERE t.evaluation_id IS NOT NULL
      `;
      const finParams: any[] = [];
      if (!isAdmin) {
        finSql += ` AND e.psychologist_id = ?`;
        finParams.push(req.user?.id);
      }
      const finRows = queryAll<any>(finSql, finParams);
      for (const f of finRows) {
        if (f.status === 'PAID') totalPaidGlobal += Number(f.amount) || 0;
        else if (f.status === 'PENDING') totalPendingGlobal += Number(f.amount) || 0;
      }
    }

    // Enriquecer cada avaliação com contagem de sessões e parcelas
    let fullEvaluations: any[] = [];
    if (evaluations.length > 0) {
      const evalIds = evaluations.map((e: any) => e.id);
      const evalPlaceholders = evalIds.map(() => '?').join(',');

      const sessionStatsRows = queryAll<any>(
        `SELECT evaluation_id,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count
         FROM sessions
         WHERE evaluation_id IN (${evalPlaceholders})
         GROUP BY evaluation_id`,
        evalIds
      );
      const sessionStatsByEval = new Map<number, { count: number; completed_count: number }>();
      for (const row of sessionStatsRows) {
        sessionStatsByEval.set(row.evaluation_id, {
          count: Number(row.count) || 0,
          completed_count: Number(row.completed_count) || 0,
        });
      }

      const allInstallments = queryAll<any>(
        `SELECT id, evaluation_id, amount, status, installment_number, total_installments, payment_method, transaction_date, paid_at
         FROM financial_transactions 
         WHERE evaluation_id IN (${evalPlaceholders})
         ORDER BY installment_number ASC`,
        evalIds
      );
      const installmentsByEval = new Map<number, any[]>();
      for (const inst of allInstallments) {
        let list = installmentsByEval.get(inst.evaluation_id);
        if (!list) {
          list = [];
          installmentsByEval.set(inst.evaluation_id, list);
        }
        list.push(inst);
      }

      fullEvaluations = evaluations.map((ev) => {
        const stats = sessionStatsByEval.get(ev.id);
        const installments = installmentsByEval.get(ev.id) || [];

        const totalPaid = installments
          .filter((i) => i.status === 'PAID')
          .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

        const totalPending = installments
          .filter((i) => i.status === 'PENDING')
          .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

        return {
          ...ev,
          sessions_count: stats?.count || 0,
          completed_sessions_count: stats?.completed_count || 0,
          // Mascara dados financeiros se !canViewFinancial
          total_price: canViewFinancial ? ev.total_price : null,
          total_paid: canViewFinancial ? totalPaid : null,
          total_pending: canViewFinancial ? totalPending : null,
          payment_mode: canViewFinancial ? ev.payment_mode : null,
          installments: canViewFinancial ? installments : [],
        };
      });
    }

    res.json({
      evaluations: fullEvaluations,
      stats: {
        in_progress: inProgressCount,
        awaiting_devolutiva: awaitingDevolutivaCount,
        completed: completedCount,
        financial_summary: canViewFinancial
          ? {
              total_contracted: totalContracted,
              total_received: totalPaidGlobal,
              total_pending: totalPendingGlobal,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('Error fetching evaluations hub:', err);
    res.status(500).json({ error: 'Erro ao buscar dados do hub de avaliações' });
  }
});

// Listar avaliações de um paciente
router.get('/evaluations/patient/:patientId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.permissions?.includes('manage_users');
    const canViewFinancial = isAdmin || Boolean(req.user?.permissions?.includes('view_financial'));

    const evaluations = queryAll<any>(
      `SELECT e.*, 
              p.full_name as patient_name, p.cpf as patient_cpf, p.phone as patient_phone,
              u.name as psychologist_name, u.crp_number as psychologist_crp
       FROM neuropsych_evaluations e
       JOIN patients p ON e.patient_id = p.id
       JOIN users u ON e.psychologist_id = u.id
       WHERE e.patient_id = ?
       ORDER BY e.created_at DESC`,
      [patientId]
    );

    let fullEvaluations: any[] = [];
    if (evaluations.length > 0) {
      const evalIds = evaluations.map((e: any) => e.id);
      const evalPlaceholders = evalIds.map(() => '?').join(',');

      const allLinkedSessions = queryAll<any>(
        `SELECT s.id, s.evaluation_id, s.start_time, s.end_time, s.status, s.modality, s.price, s.notes, s.session_type
         FROM sessions s
         WHERE s.evaluation_id IN (${evalPlaceholders})
         ORDER BY s.start_time ASC`,
        evalIds
      );
      const sessionsByEval = new Map<number, any[]>();
      for (const s of allLinkedSessions) {
        let list = sessionsByEval.get(s.evaluation_id);
        if (!list) {
          list = [];
          sessionsByEval.set(s.evaluation_id, list);
        }
        list.push(s);
      }

      const allInstallments = queryAll<any>(
        `SELECT t.id, t.patient_id, t.evaluation_id, t.installment_number, t.total_installments,
                t.amount, t.status, t.payment_method, t.transaction_date, t.paid_at, t.notes, t.invoice_status
         FROM financial_transactions t
         WHERE t.evaluation_id IN (${evalPlaceholders})
         ORDER BY t.installment_number ASC, t.id ASC`,
        evalIds
      );
      const installmentsByEval = new Map<number, any[]>();
      for (const inst of allInstallments) {
        let list = installmentsByEval.get(inst.evaluation_id);
        if (!list) {
          list = [];
          installmentsByEval.set(inst.evaluation_id, list);
        }
        list.push(inst);
      }

      const allDocs = queryAll<any>(
        `SELECT d.id, d.evaluation_id, d.title, d.category, d.document_type, d.content_json, d.hash_sha256,
                d.is_signed, d.signed_at, d.created_at, d.updated_at
         FROM patient_documents d
         WHERE d.evaluation_id IN (${evalPlaceholders})
         ORDER BY d.id DESC`,
        evalIds
      );
      const docByEval = new Map<number, any>();
      for (const doc of allDocs) {
        if (!docByEval.has(doc.evaluation_id)) {
          docByEval.set(doc.evaluation_id, doc);
        }
      }

      fullEvaluations = evaluations.map((ev) => {
        const linkedSessions = sessionsByEval.get(ev.id) || [];
        const installments = installmentsByEval.get(ev.id) || [];
        const draftDoc = docByEval.get(ev.id) || null;

        let draftContent: any = null;
        if (draftDoc && draftDoc.content_json) {
          try {
            draftContent = JSON.parse(draftDoc.content_json);
          } catch {
            draftContent = { raw: draftDoc.content_json };
          }
        }

        const totalPaid = installments
          .filter((i) => i.status === 'PAID')
          .reduce((sum, i) => sum + Number(i.amount), 0);

        const totalPending = installments
          .filter((i) => i.status === 'PENDING')
          .reduce((sum, i) => sum + Number(i.amount), 0);

        return {
          ...ev,
          sessions: linkedSessions,
          sessions_count: linkedSessions.length,
          completed_sessions_count: linkedSessions.filter((s) => s.status === 'COMPLETED').length,
          draft_document: draftDoc
            ? {
                ...draftDoc,
                content: draftContent,
                is_signed: Boolean(draftDoc.is_signed),
              }
            : null,
          total_price: canViewFinancial ? ev.total_price : null,
          total_paid: canViewFinancial ? totalPaid : null,
          total_pending: canViewFinancial ? totalPending : null,
          payment_mode: canViewFinancial ? ev.payment_mode : null,
          installments: canViewFinancial ? installments : [],
        };
      });
    }

    res.json({ evaluations: fullEvaluations });
  } catch (err) {
    console.error('Error fetching patient evaluations:', err);
    res.status(500).json({ error: 'Erro ao buscar avaliações do paciente' });
  }
});

// Buscar detalhes de uma avaliação
router.get('/evaluations/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ev = queryOne<any>(
      `SELECT e.*, 
              p.full_name as patient_name, p.cpf as patient_cpf, p.phone as patient_phone,
              p.birth_date as patient_birth_date, p.group_type as patient_group,
              p.guardian_json, p.financial_responsible_json,
              u.name as psychologist_name, u.crp_number as psychologist_crp
       FROM neuropsych_evaluations e
       JOIN patients p ON e.patient_id = p.id
       JOIN users u ON e.psychologist_id = u.id
       WHERE e.id = ?`,
      [id]
    );

    if (!ev) {
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.permissions?.includes('manage_users');
    const canViewFinancial = isAdmin || Boolean(req.user?.permissions?.includes('view_financial'));

    // ABAC: se psicólogo, impede acessar avaliação de outro colega
    if (!isAdmin && ev.psychologist_id !== req.user?.id) {
      return res.status(403).json({ error: 'Acesso negado. Esta avaliação pertence a outro profissional responsável.' });
    }

    let patientGuardian: any = null;
    if (ev.guardian_json) {
      try {
        patientGuardian = typeof ev.guardian_json === 'string' ? JSON.parse(ev.guardian_json) : ev.guardian_json;
      } catch {}
    }

    let patientFinancialResponsible: any = null;
    if (ev.financial_responsible_json) {
      try {
        patientFinancialResponsible = typeof ev.financial_responsible_json === 'string' ? JSON.parse(ev.financial_responsible_json) : ev.financial_responsible_json;
      } catch {}
    }

    const linkedSessions = queryAll<any>(
      `SELECT s.id, s.start_time, s.end_time, s.status, s.modality, s.price, s.notes, s.session_type
       FROM sessions s
       WHERE s.evaluation_id = ?
       ORDER BY s.start_time ASC`,
      [ev.id]
    );

    const installments = queryAll<any>(
      `SELECT t.id, t.patient_id, t.evaluation_id, t.installment_number, t.total_installments,
              t.amount, t.status, t.payment_method, t.transaction_date, t.paid_at, t.notes, t.invoice_status
       FROM financial_transactions t
       WHERE t.evaluation_id = ?
       ORDER BY t.installment_number ASC, t.id ASC`,
      [ev.id]
    );

    const draftDoc = queryOne<any>(
      `SELECT d.id, d.title, d.category, d.document_type, d.content_json, d.hash_sha256,
              d.is_signed, d.signed_at, d.created_at, d.updated_at
       FROM patient_documents d
       WHERE d.evaluation_id = ?
       ORDER BY d.id DESC LIMIT 1`,
      [ev.id]
    );

    let draftContent: any = null;
    if (draftDoc && draftDoc.content_json) {
      try {
        draftContent = JSON.parse(draftDoc.content_json);
      } catch {
        draftContent = { raw: draftDoc.content_json };
      }
    }

    const totalPaid = installments
      .filter((i) => i.status === 'PAID')
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const totalPending = installments
      .filter((i) => i.status === 'PENDING')
      .reduce((sum, i) => sum + Number(i.amount), 0);

    res.json({
      evaluation: {
        ...ev,
        patient_guardian: patientGuardian,
        patient_financial_responsible: patientFinancialResponsible,
        sessions: linkedSessions,
        sessions_count: linkedSessions.length,
        total_price: canViewFinancial ? ev.total_price : null,
        total_paid: canViewFinancial ? totalPaid : null,
        total_pending: canViewFinancial ? totalPending : null,
        payment_mode: canViewFinancial ? ev.payment_mode : null,
        installments: canViewFinancial ? installments : [],
        draft_document: draftDoc
          ? {
              ...draftDoc,
              content: draftContent,
              is_signed: Boolean(draftDoc.is_signed),
            }
          : null,
      },
    });
  } catch (err) {
    console.error('Error fetching evaluation:', err);
    res.status(500).json({ error: 'Erro ao buscar avaliação' });
  }
});

// Criar nova avaliação neuropsicológica + plano financeiro em parcelas + rascunho de Laudo
router.post('/evaluations', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST']), (req: AuthRequest, res: Response) => {
  try {
    const parse = evaluationCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    }

    const {
      patient_id,
      psychologist_id,
      title,
      estimated_sessions,
      total_price,
      payment_mode,
      hypothesis_diagnosis,
      notes,
      installments,
    } = parse.data;

    const psychId = psychologist_id || req.user?.id || 1;

    const patient = queryOne<any>('SELECT id, full_name, cpf, birth_date, guardian_json FROM patients WHERE id = ?', [patient_id]);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    const psych = queryOne<any>('SELECT id, name, crp_number FROM users WHERE id = ?', [psychId]);

    const canViewFin = canUserViewFinancial(req.user);
    let effectiveTotalPrice = total_price;
    let effectivePaymentMode = payment_mode;
    let effectiveInstallments = installments || [];

    if (!canViewFin) {
      const clinicSettingsRow = queryOne<any>('SELECT default_evaluation_price FROM clinic_settings WHERE id = 1');
      effectiveTotalPrice = clinicSettingsRow?.default_evaluation_price !== null && clinicSettingsRow?.default_evaluation_price !== undefined
        ? Number(clinicSettingsRow.default_evaluation_price)
        : 2400.00;
      effectivePaymentMode = 'A_VISTA';
      effectiveInstallments = [
        {
          installment_number: 1,
          amount: effectiveTotalPrice,
          due_date: new Date().toISOString().split('T')[0],
          payment_method: 'PIX',
          notes: `Avaliação Neuropsicológica: ${title}`,
        }
      ];
    } else if (!effectiveInstallments || effectiveInstallments.length === 0) {
      effectiveInstallments = [
        {
          installment_number: 1,
          amount: Number(effectiveTotalPrice) || 0,
          due_date: new Date().toISOString().split('T')[0],
          payment_method: 'PIX',
          notes: `Avaliação Neuropsicológica: ${title}`,
        }
      ];
    }

    // 1. Criar registro principal de avaliação
    const evalRes = execute(
      `INSERT INTO neuropsych_evaluations (
        patient_id, psychologist_id, title, status, estimated_sessions,
        total_price, payment_mode, hypothesis_diagnosis, notes
      ) VALUES (?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?, ?)`,
      [
        patient_id,
        psychId,
        title,
        estimated_sessions,
        effectiveTotalPrice,
        effectivePaymentMode,
        hypothesis_diagnosis || null,
        notes || null,
      ]
    );

    const evaluationId = evalRes.lastInsertRowid;

    // 2. Gerar parcelas individuais em financial_transactions
    const totalInstallmentsCount = effectiveInstallments.length;
    for (const inst of effectiveInstallments) {
      const installmentLabel = inst.notes || `Avaliação Neuropsicológica: ${title} (Parcela ${inst.installment_number}/${totalInstallmentsCount})`;
      execute(
        `INSERT INTO financial_transactions (
          patient_id, evaluation_id, amount, status, payment_method,
          transaction_date, installment_number, total_installments, invoice_status, notes
        ) VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, 'NOT_ISSUED', ?)`,
        [
          patient_id,
          evaluationId,
          inst.amount,
          inst.payment_method,
          inst.due_date,
          inst.installment_number,
          totalInstallmentsCount,
          installmentLabel,
        ]
      );
    }

    // 3. Criar rascunho estruturado do Laudo Neuropsicológico (CFP 06/2019)
    let guardianName = '';
    if (patient.guardian_json) {
      try {
        const g = typeof patient.guardian_json === 'string' ? JSON.parse(patient.guardian_json) : patient.guardian_json;
        if (g && g.fullName) {
          const rel = g.relationship ? ` (${g.relationship})` : ' (Responsável Legal)';
          const cpfPart = g.cpf ? ` - CPF: ${g.cpf}` : '';
          guardianName = `${g.fullName}${rel}${cpfPart}`;
        }
      } catch {}
    }

    const initialLaudoContent = {
      identificacao: {
        paciente: patient.full_name,
        cpf: patient.cpf || 'Não informado',
        nascimento: patient.birth_date || 'Não informado',
        responsavel: guardianName || 'O próprio',
        solicitante: 'Encaminhamento Clínico / Demanda Espontânea',
        finalidade: 'Avaliação do perfil cognitivo, atencional e das funções executivas para subsídio diagnóstico e terapêutico.',
        psicologo: psych ? `${psych.name} - ${psych.crp_number || 'CRP Ativo'}` : 'Psicólogo Responsável',
      },
      demanda: `Investigação neuropsicológica solicitada para compreensão de queixas de: ${title}. ${hypothesis_diagnosis ? `Hipótese diagnóstica inicial em investigação: ${hypothesis_diagnosis}.` : ''}`,
      procedimento: `O processo avaliativo prevê aproximadamente ${estimated_sessions} sessões de avaliação presencial e/ou remota, abrangendo:\n1. Entrevista de Anamnese e histórico neuropsicossocial;\n2. Aplicação de baterias neuropsicológicas padronizadas e instrumentos validados (SATEPSI/CFP);\n3. Observação clínica do comportamento, tolerância à frustração e autorregulação;\n4. Devolutiva aos familiares/paciente com entrega do laudo conclusivo.`,
      analise: `Resultados dos domínios neuropsicológicos investigados:\n- Eficiência Intelectual e Raciocínio Geral: [Pendente de aplicação]\n- Atenção Sustentada, Alternada e Concentrada: [Pendente de aplicação]\n- Funções Executivas, Planejamento e Flexibilidade Cognitiva: [Pendente de aplicação]\n- Memória de Trabalho e Memória de Longo Prazo: [Pendente de aplicação]\n- Aspectos Afetivos e Emocionais: [Pendente de aplicação]`,
      conclusao: hypothesis_diagnosis
        ? `Síntese integrativa correlacionando os dados com a queixa inicial. Hipótese diagnóstica: ${hypothesis_diagnosis}.`
        : `Síntese integrativa dos resultados quantitativos e qualitativos obtidos durante o processo avaliativo.`,
      recomendacoes: `1. Recomendações de suporte escolar e adaptação pedagógica (se aplicável);\n2. Orientações aos familiares para manejo comportamental em rotinas diárias;\n3. Sugestões de acompanhamento multidisciplinar (Psicoterapia, Neurologia/Psiquiatria, Fonoaudiologia).`,
    };

    const laudoJsonStr = JSON.stringify(initialLaudoContent);
    const laudoTitle = `Laudo Neuropsicológico - ${title}`;

    execute(
      `INSERT INTO patient_documents (
        patient_id, psychologist_id, evaluation_id, title, category, document_type,
        content_json, is_signed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'LAUDO', 'LAUDO_NEUROPSICOLOGICO', ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [patient_id, psychId, evaluationId, laudoTitle, laudoJsonStr]
    );

    recordAuditLog(
      req,
      'CREATE_NEUROPSYCH_EVALUATION',
      `EVALUATION #${evaluationId}`,
      `Nova avaliação neuropsicológica aberta para paciente #${patient_id} no valor de R$ ${Number(effectiveTotalPrice || 0).toFixed(2)} em ${totalInstallmentsCount} parcela(s)`
    );

    res.status(201).json({
      success: true,
      evaluation_id: evaluationId,
      message: 'Avaliação Neuropsicológica e plano de parcelas gerados com sucesso!',
    });
  } catch (err) {
    console.error('Error creating evaluation:', err);
    res.status(500).json({ error: 'Erro ao criar avaliação neuropsicológica' });
  }
});

// Atualizar dados da avaliação / plano financeiro / rascunho do laudo
router.put('/evaluations/:id', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST']), (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ev = queryOne<any>('SELECT * FROM neuropsych_evaluations WHERE id = ?', [id]);
    if (!ev) {
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }

    const isAdmin = req.user?.role === 'ADMIN' || Boolean(req.user?.permissions?.includes('manage_users'));
    const canViewFinancial = isAdmin || Boolean(req.user?.permissions?.includes('view_financial'));

    // ABAC: se psicólogo, impede alterar avaliação de outro profissional
    if (!isAdmin && ev.psychologist_id !== req.user?.id) {
      return res.status(403).json({ error: 'Acesso negado. Esta avaliação pertence a outro profissional responsável.' });
    }

    const {
      title,
      estimated_sessions,
      hypothesis_diagnosis,
      notes,
      status,
      total_price,
      installments,
      draft_report_content,
    } = req.body;

    const newTitle = title !== undefined ? title : ev.title;
    const newEstimatedSessions = estimated_sessions !== undefined ? Number(estimated_sessions) : ev.estimated_sessions;
    const newHypothesis = hypothesis_diagnosis !== undefined ? hypothesis_diagnosis : ev.hypothesis_diagnosis;
    const newNotes = notes !== undefined ? notes : ev.notes;
    const newStatus = status !== undefined ? status : ev.status;

    execute(
      `UPDATE neuropsych_evaluations SET
        title = ?, estimated_sessions = ?, hypothesis_diagnosis = ?, notes = ?, status = ?
       WHERE id = ?`,
      [newTitle, newEstimatedSessions, newHypothesis, newNotes, newStatus, id]
    );

    // Se houve alteração de plano financeiro
    if ((total_price !== undefined || installments !== undefined) && canViewFinancial) {
      const currentTransactions = queryAll<any>(
        'SELECT * FROM financial_transactions WHERE evaluation_id = ? ORDER BY installment_number ASC, id ASC',
        [id]
      );
      const paidTransactions = currentTransactions.filter((t: any) => t.status === 'PAID');
      const paidTotal = paidTransactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0);

      const newTotalPrice = total_price !== undefined ? Number(total_price) : Number(ev.total_price);
      if (newTotalPrice < paidTotal - 0.01) {
        return res.status(400).json({
          error: `O novo valor total (R$ ${newTotalPrice.toFixed(2)}) não pode ser inferior ao valor já recebido/quitado (R$ ${paidTotal.toFixed(2)}).`
        });
      }

      if (Array.isArray(installments)) {
        // As parcelas pagas são protegidas e preservadas intactas
        const pendingSent = installments.filter((inst: any) => inst.status !== 'PAID');

        // Remove transações pendentes antigas desta avaliação
        execute('DELETE FROM financial_transactions WHERE evaluation_id = ? AND status = "PENDING"', [id]);

        const totalInstallmentsCount = paidTransactions.length + pendingSent.length;

        // Atualiza a contagem total_installments nas parcelas já quitadas
        execute('UPDATE financial_transactions SET total_installments = ? WHERE evaluation_id = ? AND status = "PAID"', [totalInstallmentsCount, id]);

        // Insere as novas parcelas pendentes recalculadas
        for (let i = 0; i < pendingSent.length; i++) {
          const inst = pendingSent[i];
          const instNumber = inst.installment_number || (paidTransactions.length + i + 1);
          const installmentLabel = inst.notes || `Avaliação Neuropsicológica: ${newTitle} (Parcela ${instNumber}/${totalInstallmentsCount})`;
          execute(
            `INSERT INTO financial_transactions (
              patient_id, evaluation_id, amount, status, payment_method,
              transaction_date, installment_number, total_installments, invoice_status, notes
            ) VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, 'NOT_ISSUED', ?)`,
            [
              ev.patient_id,
              id,
              Number(inst.amount),
              inst.payment_method || 'PIX',
              inst.due_date,
              instNumber,
              totalInstallmentsCount,
              installmentLabel,
            ]
          );
        }
      }

      execute('UPDATE neuropsych_evaluations SET total_price = ? WHERE id = ?', [newTotalPrice, id]);

      recordAuditLog(
        req,
        'UPDATE_EVALUATION_FINANCIAL_PLAN',
        `EVALUATION #${id}`,
        `Plano financeiro da avaliação #${id} atualizado para total R$ ${newTotalPrice.toFixed(2)}`
      );
    }

    // Se veio conteúdo atualizado do laudo, salva no documento vinculado
    if (draft_report_content) {
      const contentStr = typeof draft_report_content === 'string' ? draft_report_content : JSON.stringify(draft_report_content);
      execute(
        `UPDATE patient_documents SET content_json = ?, updated_at = CURRENT_TIMESTAMP WHERE evaluation_id = ?`,
        [contentStr, id]
      );
    }

    recordAuditLog(req, 'UPDATE_EVALUATION', `EVALUATION #${id}`, `Avaliação neuropsicológica #${id} atualizada`);
    res.json({ success: true, message: 'Avaliação atualizada com sucesso!' });
  } catch (err) {
    console.error('Error updating evaluation:', err);
    res.status(500).json({ error: 'Erro ao atualizar avaliação' });
  }
});

// Concluir avaliação e assinar Laudo Oficial (CFP 06/2019)
router.post('/evaluations/:id/complete', authenticateToken, requireRole(['ADMIN', 'PSYCHOLOGIST']), (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status = 'COMPLETED', final_report_content } = req.body;

    const ev = queryOne<any>('SELECT * FROM neuropsych_evaluations WHERE id = ?', [id]);
    if (!ev) {
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }

    const doc = queryOne<any>('SELECT * FROM patient_documents WHERE evaluation_id = ? ORDER BY id DESC LIMIT 1', [id]);
    const psych = queryOne<any>('SELECT id, name, crp_number FROM users WHERE id = ?', [req.user?.id || ev.psychologist_id]);

    let contentToSign = final_report_content
      ? (typeof final_report_content === 'string' ? final_report_content : JSON.stringify(final_report_content))
      : (doc ? doc.content_json : '{}');

    const nowIso = new Date().toISOString();
    const hash = generateSHA256(
      contentToSign + `|EVAL:${id}|CRP:${psych?.crp_number || 'N/A'}|DATA:${nowIso}`
    );

    if (doc) {
      execute(
        `UPDATE patient_documents SET 
          content_json = ?, is_signed = 1, signed_at = CURRENT_TIMESTAMP, hash_sha256 = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [contentToSign, hash, doc.id]
      );
    }

    const completedAt = status === 'COMPLETED' ? new Date().toISOString().replace('T', ' ').substring(0, 19) : null;
    execute(
      `UPDATE neuropsych_evaluations SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?`,
      [status, completedAt, id]
    );

    recordAuditLog(
      req,
      'COMPLETE_NEUROPSYCH_EVALUATION',
      `EVALUATION #${id}`,
      `Avaliação neuropsicológica finalizada com status ${status}. Laudo assinado com hash SHA-256: ${hash}`
    );

    res.json({
      success: true,
      status,
      hash_sha256: hash,
      message: status === 'COMPLETED' 
        ? 'Avaliação concluída e Laudo Oficial assinado com sucesso!' 
        : 'Avaliação atualizada para aguardando devolutiva!',
    });
  } catch (err) {
    console.error('Error completing evaluation:', err);
    res.status(500).json({ error: 'Erro ao concluir avaliação' });
  }
});

// Emissão de dados para Recibo Timbrado (por parcela ou consolidado)
router.get('/evaluations/:id/receipt-data', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { transaction_id } = req.query;

    const ev = queryOne<any>(
      `SELECT e.*, 
              p.full_name as patient_name, p.cpf as patient_cpf, p.birth_date as patient_birth_date,
              p.address_json as patient_address_json, p.guardian_json, p.financial_responsible_json,
              u.name as psychologist_name, u.crp_number as psychologist_crp
       FROM neuropsych_evaluations e
       JOIN patients p ON e.patient_id = p.id
       JOIN users u ON e.psychologist_id = u.id
       WHERE e.id = ?`,
      [id]
    );

    if (!ev) {
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }

    const clinic = queryOne<any>('SELECT clinic_name, cnpj, phone, email, address, logo_base64 FROM clinic_settings WHERE id = 1') || {
      clinic_name: 'PsicoGestão Clínica Integrada',
      cnpj: '00.000.000/0001-00',
      phone: '(11) 99999-9999',
      email: 'contato@psicogestao.com.br',
      address: 'São Paulo - SP',
    };

    let receiptType: 'INSTALLMENT' | 'CONSOLIDATED' = 'CONSOLIDATED';
    let transaction: any = null;
    let amount = ev.total_price;
    let installmentText = 'Valor Total Fechado';
    let paymentDate = ev.completed_at ? ev.completed_at.split(' ')[0] : new Date().toISOString().split('T')[0];
    let paymentMethod = 'TRANSFERÊNCIA / PIX';

    if (transaction_id) {
      transaction = queryOne<any>(
        'SELECT * FROM financial_transactions WHERE id = ? AND evaluation_id = ?',
        [transaction_id, id]
      );

      if (transaction) {
        receiptType = 'INSTALLMENT';
        amount = Number(transaction.amount);
        installmentText = `Parcela ${transaction.installment_number || 1} de ${transaction.total_installments || 1}`;
        paymentDate = transaction.paid_at ? transaction.paid_at.split(' ')[0] : transaction.transaction_date;
        paymentMethod = transaction.payment_method || 'PIX';
      }
    }

    // Payer details (responsável financeiro se houver ou o próprio paciente)
    let payerName = ev.patient_name;
    let payerCpf = ev.patient_cpf || 'Não cadastrado';

    if (ev.financial_responsible_json) {
      try {
        const finResp = typeof ev.financial_responsible_json === 'string' ? JSON.parse(ev.financial_responsible_json) : ev.financial_responsible_json;
        if (finResp.fullName) {
          payerName = finResp.fullName;
          payerCpf = finResp.cpf || payerCpf;
        }
      } catch {}
    } else if (ev.guardian_json) {
      try {
        const guard = typeof ev.guardian_json === 'string' ? JSON.parse(ev.guardian_json) : ev.guardian_json;
        if (guard.fullName) {
          payerName = guard.fullName;
          payerCpf = guard.cpf || payerCpf;
        }
      } catch {}
    }

    const receiptNumber = transaction
      ? `REC-EVAL-${ev.id}-P${transaction.installment_number || 1}`
      : `REC-EVAL-${ev.id}-TOTAL`;

    const description = receiptType === 'INSTALLMENT'
      ? `Recebemos de ${payerName} (CPF: ${payerCpf}) o valor de R$ ${amount.toFixed(2)} referente à ${installmentText} dos serviços profissionais de Avaliação Neuropsicológica e Investigação Diagnóstica prestados a ${ev.patient_name} (Demanda: ${ev.title}).`
      : `Recebemos de ${payerName} (CPF: ${payerCpf}) o valor total de R$ ${amount.toFixed(2)} referente à quitação integral do pacote de serviços profissionais de Avaliação Neuropsicológica, Testagem Cognitiva e Emissão de Laudo Clínico Especializado (Resoluções CFP nº 01/2009 e 06/2019) prestados a ${ev.patient_name} (Demanda: ${ev.title}).`;

    const hashRaw = `${receiptNumber}|${amount}|${payerCpf}|${ev.psychologist_crp}|${paymentDate}`;
    const hash = generateSHA256(hashRaw);

    recordAuditLog(req, 'GENERATE_EVALUATION_RECEIPT', `EVALUATION #${id}`, `Emissão de recibo ${receiptNumber} para ${payerName}`);

    res.json({
      receipt: {
        receipt_number: receiptNumber,
        receipt_type: receiptType,
        clinic,
        psychologist: {
          name: ev.psychologist_name,
          crp: ev.psychologist_crp,
        },
        patient: {
          id: ev.patient_id,
          name: ev.patient_name,
          cpf: ev.patient_cpf,
        },
        payer: {
          name: payerName,
          cpf: payerCpf,
        },
        evaluation: {
          id: ev.id,
          title: ev.title,
          status: ev.status,
          total_price: ev.total_price,
        },
        installment_info: installmentText,
        amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        description,
        hash_sha256: hash,
        issued_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Error generating receipt data:', err);
    res.status(500).json({ error: 'Erro ao gerar dados do recibo' });
  }
});

// Emissão de dados para Recibo Timbrado por Transação Financeira (Psicoterapia individual ou Parcela de Avaliação)
router.get('/receipts/transaction/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const txId = Number(req.params.id);

    const tx = queryOne<any>(
      `SELECT t.*, 
              p.full_name as patient_name, p.cpf as patient_cpf, p.birth_date as patient_birth_date,
              p.address_json as patient_address_json, p.guardian_json, p.financial_responsible_json,
              p.psychologist_id as patient_psychologist_id,
              s.modality as session_modality, s.start_time as session_start_time, s.psychologist_id as session_psychologist_id,
              ne.title as evaluation_title, ne.status as evaluation_status, ne.total_price as evaluation_total_price,
              ne.psychologist_id as eval_psychologist_id
       FROM financial_transactions t
       JOIN patients p ON t.patient_id = p.id
       LEFT JOIN sessions s ON t.session_id = s.id
       LEFT JOIN neuropsych_evaluations ne ON t.evaluation_id = ne.id
       WHERE t.id = ?`,
      [txId]
    );

    if (!tx) {
      return res.status(404).json({ error: 'Transação financeira não encontrada' });
    }

    const psychologistId = tx.session_psychologist_id || tx.eval_psychologist_id || tx.patient_psychologist_id || req.user?.id || 1;
    const psychologist = queryOne<any>(
      `SELECT id, name, crp_number FROM users WHERE id = ?`,
      [psychologistId]
    ) || { name: 'Psicólogo Responsável', crp_number: 'CRP 06/000000' };

    const clinic = queryOne<any>('SELECT clinic_name, cnpj, phone, email, address, logo_base64 FROM clinic_settings WHERE id = 1') || {
      clinic_name: 'PsicoGestão Clínica Integrada',
      cnpj: '00.000.000/0001-00',
      phone: '(11) 99999-9999',
      email: 'contato@psicogestao.com.br',
      address: 'São Paulo - SP',
    };

    // Payer details (responsável financeiro se houver ou o próprio paciente)
    let payerName = tx.patient_name;
    let payerCpf = tx.patient_cpf || 'Não cadastrado';

    if (tx.financial_responsible_json) {
      try {
        const finResp = typeof tx.financial_responsible_json === 'string' ? JSON.parse(tx.financial_responsible_json) : tx.financial_responsible_json;
        if (finResp.fullName) {
          payerName = finResp.fullName;
          payerCpf = finResp.cpf || payerCpf;
        }
      } catch {}
    } else if (tx.guardian_json) {
      try {
        const guard = typeof tx.guardian_json === 'string' ? JSON.parse(tx.guardian_json) : tx.guardian_json;
        if (guard.fullName) {
          payerName = guard.fullName;
          payerCpf = guard.cpf || payerCpf;
        }
      } catch {}
    }

    const amount = Number(tx.amount);
    const paymentDate = tx.paid_at ? tx.paid_at.split(' ')[0] : tx.transaction_date;
    const paymentMethod = tx.payment_method || 'PIX';

    let receiptNumber = '';
    let receiptType: 'SESSION' | 'EVALUATION' = 'SESSION';
    let installmentText = 'Sessão de Psicoterapia';
    let description = '';
    let documentTitle = 'Recibo de Prestação de Serviços de Psicoterapia Clínica';

    if (tx.evaluation_id) {
      receiptType = 'EVALUATION';
      receiptNumber = `REC-EVAL-${tx.evaluation_id}-P${tx.installment_number || 1}`;
      installmentText = `Parcela ${tx.installment_number || 1} de ${tx.total_installments || 1}`;
      documentTitle = 'Recibo de Prestação de Serviços Psicológicos / Neuropsicológicos';
      description = `Recebemos de ${payerName} (CPF: ${payerCpf}) o valor de R$ ${amount.toFixed(2)} referente à ${installmentText} dos serviços profissionais de Avaliação Neuropsicológica e Investigação Diagnóstica prestados a ${tx.patient_name} (Demanda: ${tx.evaluation_title || 'Avaliação Especializada'}). Resoluções CFP nº 01/2009 e 06/2019.`;
    } else {
      receiptType = 'SESSION';
      receiptNumber = `REC-SESS-${tx.id}`;
      installmentText = 'Sessão Individual';
      const formattedDate = new Date(tx.session_start_time || paymentDate).toLocaleDateString('pt-BR');
      const modalityStr = tx.session_modality === 'ONLINE' ? 'online' : 'presencial';
      description = `Recebemos de ${payerName} (CPF: ${payerCpf}) o valor de R$ ${amount.toFixed(2)} referente à prestação de serviços profissionais de psicoterapia clínica realizada em ${formattedDate} (modalidade ${modalityStr}) para o(a) paciente ${tx.patient_name}. Conforme Resoluções CFP nº 01/2009 e 06/2019 e regulamentação da Receita Federal para fins de dedução e reembolso junto a convênios de saúde.`;
    }

    const hashRaw = `${receiptNumber}|${amount}|${payerCpf}|${psychologist.crp_number}|${paymentDate}`;
    const hash = generateSHA256(hashRaw);

    recordAuditLog(req, 'GENERATE_TRANSACTION_RECEIPT', `TRANSACTION #${tx.id}`, `Emissão de recibo ${receiptNumber} para ${payerName}`);

    res.json({
      receipt: {
        receipt_number: receiptNumber,
        receipt_type: receiptType,
        document_title: documentTitle,
        clinic,
        psychologist: {
          name: psychologist.name,
          crp: psychologist.crp_number,
          specialty: tx.evaluation_id ? 'Especialista em Neuropsicologia Clínica' : 'Psicologia Clínica',
        },
        patient: {
          id: tx.patient_id,
          name: tx.patient_name,
          cpf: tx.patient_cpf,
        },
        payer: {
          name: payerName,
          cpf: payerCpf,
        },
        evaluation: tx.evaluation_id ? {
          id: tx.evaluation_id,
          title: tx.evaluation_title,
          status: tx.evaluation_status,
          total_price: tx.evaluation_total_price,
        } : null,
        installment_info: installmentText,
        amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        description,
        hash_sha256: hash,
        issued_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Error generating transaction receipt data:', err);
    res.status(500).json({ error: 'Erro ao gerar dados do recibo da transação' });
  }
});

// ==========================================
// 20. GESTÃO DE REPASSES E COMISSÕES A PROFISSIONAIS
// ==========================================

function canManageRepasses(user: any): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || user.role_id === 1 || Boolean(user.permissions?.includes('view_financial') || user.permissions?.includes('manage_users'));
}

// 20.1 Prévia / Simulação de Repasses Elegíveis
router.get('/repasse/preview', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    if (!canManageRepasses(req.user)) {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores e gestores financeiros podem apurar repasses.' });
    }

    const psychologist_id = req.query.psychologist_id;
    const period_start = req.query.period_start || req.query.start_date;
    const period_end = req.query.period_end || req.query.end_date;
    if (!psychologist_id || !period_start || !period_end) {
      return res.status(400).json({ error: 'psychologist_id, period_start e period_end são obrigatórios.' });
    }

    const psychId = Number(psychologist_id);
    const psych = queryOne<any>(
      `SELECT id, name, email, crp_number, repasse_mode, repasse_percentage, repasse_eval_percentage, repasse_fixed_amount, pix_key, pix_key_type, bank_info
       FROM users WHERE id = ?`,
      [psychId]
    );

    if (!psych) {
      return res.status(404).json({ error: 'Profissional não encontrado.' });
    }

    const repMode = psych.repasse_mode || 'PERCENTAGE';
    const psychRate = psych.repasse_percentage !== null && psych.repasse_percentage !== undefined ? Number(psych.repasse_percentage) : 50.0;
    const evalRate = psych.repasse_eval_percentage !== null && psych.repasse_eval_percentage !== undefined ? Number(psych.repasse_eval_percentage) : 60.0;
    const fixedAmount = psych.repasse_fixed_amount !== null && psych.repasse_fixed_amount !== undefined ? Number(psych.repasse_fixed_amount) : null;

    // 1. Sessões de psicoterapia elegíveis (concluídas e pagas pelo paciente no período em regime de caixa)
    const psychotherapySessions = queryAll<any>(
      `SELECT s.id as session_id, s.patient_id, p.full_name as patient_name, s.start_time, s.price, s.modality, s.session_type,
              ft.id as transaction_id, ft.amount as paid_amount, ft.payment_method, ft.paid_at, ft.transaction_date
       FROM sessions s
       JOIN patients p ON s.patient_id = p.id
       JOIN financial_transactions ft ON ft.session_id = s.id AND ft.status = 'PAID'
       WHERE s.psychologist_id = ? AND s.status = 'COMPLETED'
         AND (s.evaluation_id IS NULL AND (s.session_type IS NULL OR s.session_type != 'EVALUATION'))
         AND date(COALESCE(ft.paid_at, ft.transaction_date)) BETWEEN ? AND ?
         AND s.id NOT IN (
           SELECT rbi.session_id 
           FROM repasse_batch_items rbi 
           JOIN repasse_batches rb ON rbi.batch_id = rb.id 
           WHERE rb.status IN ('CLOSED', 'PAID') AND rbi.session_id IS NOT NULL
         )
       ORDER BY s.start_time ASC`,
      [psychId, String(period_start), String(period_end)]
    );

    // 2. Parcelas de avaliação neuropsicológica quitadas pelo paciente no período
    const evaluationInstallments = queryAll<any>(
      `SELECT ne.id as evaluation_id, ne.patient_id, p.full_name as patient_name, ne.title as evaluation_title,
              ft.id as transaction_id, ft.amount as paid_amount, ft.payment_method, ft.paid_at, ft.transaction_date,
              ft.installment_number, ft.total_installments
       FROM financial_transactions ft
       JOIN neuropsych_evaluations ne ON ft.evaluation_id = ne.id
       JOIN patients p ON ne.patient_id = p.id
       WHERE ne.psychologist_id = ? AND ft.status = 'PAID'
         AND date(COALESCE(ft.paid_at, ft.transaction_date)) BETWEEN ? AND ?
         AND ft.id NOT IN (
           SELECT rbi.evaluation_id 
           FROM repasse_batch_items rbi 
           JOIN repasse_batches rb ON rbi.batch_id = rb.id 
           WHERE rb.status IN ('CLOSED', 'PAID') AND rbi.evaluation_id IS NOT NULL
         )
       ORDER BY ft.paid_at ASC, ft.transaction_date ASC`,
      [psychId, String(period_start), String(period_end)]
    );

    const items: any[] = [];

    // Mapeia sessões de psicoterapia
    for (const s of psychotherapySessions) {
      const gross = Number(s.paid_amount || s.price || 0);
      const isFixed = repMode === 'FIXED_PER_SESSION' && fixedAmount !== null;
      const rate = isFixed ? fixedAmount! : psychRate;
      const repAmount = isFixed ? fixedAmount! : Math.round(gross * (psychRate / 100) * 100) / 100;

      items.push({
        session_id: s.session_id,
        evaluation_id: null,
        patient_id: s.patient_id,
        patient_name: s.patient_name,
        service_type: 'PSYCHOTHERAPY',
        service_label: 'Psicoterapia',
        service_date: (s.start_time ? s.start_time.split('T')[0] : s.paid_at?.split('T')[0]),
        gross_amount: gross,
        repasse_rate: rate,
        repasse_amount: repAmount,
        payment_method: s.payment_method || 'PIX',
        paid_at: s.paid_at || s.transaction_date,
      });
    }

    // Mapeia parcelas de avaliação neuropsicológica
    for (const ev of evaluationInstallments) {
      const gross = Number(ev.paid_amount || 0);
      const rate = evalRate;
      const repAmount = Math.round(gross * (evalRate / 100) * 100) / 100;

      items.push({
        session_id: null,
        evaluation_id: ev.transaction_id,
        patient_id: ev.patient_id,
        patient_name: ev.patient_name,
        service_type: 'NEUROPSYCH_EVALUATION',
        service_label: `Avaliação Neuropsicológica (Parc. ${ev.installment_number || 1}/${ev.total_installments || 1})`,
        service_date: (ev.paid_at ? ev.paid_at.split('T')[0] : ev.transaction_date),
        gross_amount: gross,
        repasse_rate: rate,
        repasse_amount: repAmount,
        payment_method: ev.payment_method || 'PIX',
        paid_at: ev.paid_at || ev.transaction_date,
      });
    }

    const grossTotal = items.reduce((acc, i) => acc + i.gross_amount, 0);
    const repasseSubtotal = items.reduce((acc, i) => acc + i.repasse_amount, 0);

    res.json({
      psychologist: {
        id: psych.id,
        name: psych.name,
        email: psych.email,
        crp_number: psych.crp_number,
        repasse_mode: repMode,
        repasse_percentage: psychRate,
        repasse_eval_percentage: evalRate,
        repasse_fixed_amount: fixedAmount,
        pix_key: psych.pix_key,
        pix_key_type: psych.pix_key_type,
        bank_info: psych.bank_info,
      },
      period_start,
      period_end,
      items,
      summary: {
        total_sessions_count: items.length,
        gross_total_amount: Math.round(grossTotal * 100) / 100,
        repasse_subtotal: Math.round(repasseSubtotal * 100) / 100,
        deductions_amount: 0,
        additions_amount: 0,
        net_repasse_amount: Math.round(repasseSubtotal * 100) / 100,
      }
    });
  } catch (err) {
    console.error('Error in repasse preview:', err);
    res.status(500).json({ error: 'Erro ao apurar prévia de repasses.' });
  }
});

// 20.2 Listar Lotes de Fechamento de Repasse
router.get('/repasse/batches', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    if (!canManageRepasses(req.user)) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const { psychologist_id, status } = req.query;
    let sql = `
      SELECT rb.*, 
             u.name as psychologist_name, u.crp_number as psychologist_crp, u.pix_key as psychologist_pix_key, u.pix_key_type as psychologist_pix_key_type,
             c.name as closed_by_name, p.name as paid_by_name
      FROM repasse_batches rb
      JOIN users u ON rb.psychologist_id = u.id
      LEFT JOIN users c ON rb.closed_by_user_id = c.id
      LEFT JOIN users p ON rb.paid_by_user_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (psychologist_id) {
      sql += ' AND rb.psychologist_id = ?';
      params.push(Number(psychologist_id));
    }
    if (status) {
      sql += ' AND rb.status = ?';
      params.push(String(status));
    }

    sql += ' ORDER BY rb.id DESC';
    const batches = queryAll<any>(sql, params);
    res.json({ batches });
  } catch (err) {
    console.error('Error listing repasse batches:', err);
    res.status(500).json({ error: 'Erro ao listar lotes de repasse.' });
  }
});

// 20.3 Criar e Fechar Lote de Repasse (Snapshot Imutável)
const createRepasseBatchSchema = z.object({
  psychologist_id: z.number(),
  period_start: z.string(),
  period_end: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({
    session_id: z.number().nullable().optional(),
    evaluation_id: z.number().nullable().optional(),
    patient_id: z.number(),
    service_type: z.string(),
    service_date: z.string(),
    gross_amount: z.number(),
    repasse_rate: z.number(),
    repasse_amount: z.number(),
  })),
  adjustments: z.array(z.object({
    adjustment_type: z.enum(['DEDUCTION', 'ADDITION']),
    description: z.string().min(2, 'Descrição do ajuste é obrigatória'),
    amount: z.number().min(0.01, 'Valor do ajuste deve ser maior que zero'),
  })).optional().default([]),
});

router.post('/repasse/batches', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    if (!canManageRepasses(req.user)) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const parse = createRepasseBatchSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos.' });
    }

    const { psychologist_id, period_start, period_end, notes, items, adjustments } = parse.data;

    if (items.length === 0) {
      return res.status(400).json({ error: 'Não é possível fechar um lote sem nenhum atendimento elegível.' });
    }

    const psych = queryOne<any>('SELECT id, name FROM users WHERE id = ?', [psychologist_id]);
    if (!psych) {
      return res.status(404).json({ error: 'Profissional não encontrado.' });
    }

    // Calcula os totais com precisão de 2 casas decimais
    const grossTotal = items.reduce((acc, i) => acc + (Number(i.gross_amount) || 0), 0);
    const repasseSubtotal = items.reduce((acc, i) => acc + (Number(i.repasse_amount) || 0), 0);
    
    const deductionsTotal = adjustments
      .filter(a => a.adjustment_type === 'DEDUCTION')
      .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

    const additionsTotal = adjustments
      .filter(a => a.adjustment_type === 'ADDITION')
      .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

    const netRepasse = Math.round((repasseSubtotal - deductionsTotal + additionsTotal) * 100) / 100;

    // Gera o número sequencial do lote (ex: REP-202609-001)
    const yymm = period_start.replace(/-/g, '').slice(0, 6);
    const existingCount = queryOne<any>(
      "SELECT COUNT(*) as count FROM repasse_batches WHERE batch_number LIKE ?",
      [`%REP-${yymm}-%`]
    )?.count || 0;
    const batchNumber = `REP-${yymm}-${String(existingCount + 1).padStart(3, '0')}`;

    // Insere o lote principal
    const batchRes = execute(
      `INSERT INTO repasse_batches (
        batch_number, psychologist_id, period_start, period_end, status,
        total_sessions_count, gross_total_amount, repasse_subtotal, deductions_amount, additions_amount, net_repasse_amount,
        notes, closed_at, closed_by_user_id
      ) VALUES (?, ?, ?, ?, 'CLOSED', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [
        batchNumber,
        psychologist_id,
        period_start,
        period_end,
        items.length,
        Math.round(grossTotal * 100) / 100,
        Math.round(repasseSubtotal * 100) / 100,
        Math.round(deductionsTotal * 100) / 100,
        Math.round(additionsTotal * 100) / 100,
        netRepasse,
        notes || null,
        req.user?.id || 1,
      ]
    );
    const batchId = batchRes.lastInsertRowid;

    // Insere os itens congelados
    for (const item of items) {
      execute(
        `INSERT INTO repasse_batch_items (
          batch_id, session_id, evaluation_id, patient_id, service_type, service_date, gross_amount, repasse_rate, repasse_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          item.session_id || null,
          item.evaluation_id || null,
          item.patient_id,
          item.service_type,
          item.service_date,
          item.gross_amount,
          item.repasse_rate,
          item.repasse_amount,
        ]
      );
    }

    // Insere os ajustes
    for (const adj of adjustments) {
      execute(
        `INSERT INTO repasse_adjustments (batch_id, adjustment_type, description, amount) VALUES (?, ?, ?, ?)`,
        [batchId, adj.adjustment_type, adj.description, adj.amount]
      );
    }

    recordAuditLog(
      req,
      'CREATE_REPASSE_BATCH',
      `/repasse/batches/${batchId}`,
      `Fechamento de Lote ${batchNumber} para ${psych.name}: ${items.length} atendimentos, Líquido R$ ${netRepasse.toFixed(2)}`
    );

    res.status(201).json({
      success: true,
      batch_id: batchId,
      batch_number: batchNumber,
      net_repasse_amount: netRepasse,
      message: `Lote ${batchNumber} fechado com sucesso!`,
    });
  } catch (err) {
    console.error('Error creating repasse batch:', err);
    res.status(500).json({ error: 'Erro ao criar lote de repasse.' });
  }
});

// 20.4 Detalhes do Lote (Para Conferência, Visualização e PDF)
router.get('/repasse/batches/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const batch = queryOne<any>(
      `SELECT rb.*, 
              u.name as psychologist_name, u.email as psychologist_email, u.crp_number as psychologist_crp,
              u.pix_key as psychologist_pix_key, u.pix_key_type as psychologist_pix_key_type, u.bank_info as psychologist_bank_info,
              c.name as closed_by_name, p.name as paid_by_name
       FROM repasse_batches rb
       JOIN users u ON rb.psychologist_id = u.id
       LEFT JOIN users c ON rb.closed_by_user_id = c.id
       LEFT JOIN users p ON rb.paid_by_user_id = p.id
       WHERE rb.id = ?`,
      [id]
    );

    if (!batch) {
      return res.status(404).json({ error: 'Lote de repasse não encontrado.' });
    }

    const isAdmin = canManageRepasses(req.user);
    const isOwner = req.user?.id === batch.psychologist_id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Acesso negado a este lote de repasse.' });
    }

    const items = queryAll<any>(
      `SELECT rbi.*, p.full_name as patient_name
       FROM repasse_batch_items rbi
       JOIN patients p ON rbi.patient_id = p.id
       WHERE rbi.batch_id = ?
       ORDER BY rbi.service_date ASC, rbi.id ASC`,
      [id]
    );

    const adjustments = queryAll<any>(
      `SELECT * FROM repasse_adjustments WHERE batch_id = ? ORDER BY id ASC`,
      [id]
    );

    const clinicSettings = queryOne<any>('SELECT * FROM clinic_settings WHERE id = 1');

    // Se o usuário logado for psicólogo sem permissão financeira global, aplica sigilo estrito
    const canViewFin = canUserViewFinancial(req.user);
    const sanitizedBatch = {
      ...batch,
      gross_total_amount: canViewFin ? batch.gross_total_amount : null,
    };

    const sanitizedItems = items.map(item => ({
      ...item,
      gross_amount: canViewFin ? item.gross_amount : null,
    }));

    res.json({
      batch: sanitizedBatch,
      items: sanitizedItems,
      adjustments,
      clinic_settings: {
        clinic_name: clinicSettings?.clinic_name || 'PsicoGestão',
        cnpj: clinicSettings?.cnpj,
        phone: clinicSettings?.phone,
        email: clinicSettings?.email,
        address: clinicSettings?.address,
        logo_base64: clinicSettings?.logo_base64,
      },
    });
  } catch (err) {
    console.error('Error fetching repasse batch details:', err);
    res.status(500).json({ error: 'Erro ao carregar detalhes do lote de repasse.' });
  }
});

// 20.5 Quitar Lote de Repasse (Status = PAID + Integração com Despesas)
router.patch('/repasse/batches/:id/pay', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    if (!canManageRepasses(req.user)) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const id = Number(req.params.id);
    const batch = queryOne<any>(
      `SELECT rb.*, u.name as psychologist_name FROM repasse_batches rb JOIN users u ON rb.psychologist_id = u.id WHERE rb.id = ?`,
      [id]
    );

    if (!batch) {
      return res.status(404).json({ error: 'Lote de repasse não encontrado.' });
    }

    const { payment_date, payment_method, notes, create_expense = true } = req.body;
    const effectivePaymentDate = payment_date || new Date().toISOString().substring(0, 10);
    const effectiveMethod = payment_method || 'PIX';

    let createdExpenseId: number | null = null;

    if (create_expense) {
      const expenseDesc = `Repasse de Honorários - ${batch.psychologist_name} (${batch.batch_number})`;
      const expRes = execute(
        `INSERT INTO expenses (
          psychologist_id, title, category, amount, due_date, payment_date, status, payment_method, notes
        ) VALUES (?, ?, 'REPASSE_PROFISSIONAL', ?, ?, ?, 'PAID', ?, ?)`,
        [
          batch.psychologist_id || 1,
          expenseDesc,
          batch.net_repasse_amount,
          effectivePaymentDate,
          effectivePaymentDate,
          effectiveMethod,
          notes ? `Lote ${batch.batch_number}: ${notes}` : `Lote ${batch.batch_number}`
        ]
      );
      createdExpenseId = expRes.lastInsertRowid;
    }

    execute(
      `UPDATE repasse_batches SET
        status = 'PAID',
        paid_at = CURRENT_TIMESTAMP,
        paid_by_user_id = ?,
        payment_date = ?,
        payment_method = ?,
        expense_id = ?,
        notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        req.user?.id || 1,
        effectivePaymentDate,
        effectiveMethod,
        createdExpenseId || batch.expense_id,
        notes || null,
        id
      ]
    );

    recordAuditLog(
      req,
      'PAY_REPASSE_BATCH',
      `/repasse/batches/${id}`,
      `Quitação de Repasse ${batch.batch_number} para ${batch.psychologist_name} no valor de R$ ${batch.net_repasse_amount.toFixed(2)} via ${effectiveMethod}`
    );

    res.json({
      success: true,
      message: `Lote ${batch.batch_number} marcado como PAGO com sucesso!`,
      expense_id: createdExpenseId,
    });
  } catch (err) {
    console.error('Error paying repasse batch:', err);
    res.status(500).json({ error: 'Erro ao quitar lote de repasse.' });
  }
});

// 20.6 Excluir / Cancelar Lote em Aberto ou Rascunho
router.delete('/repasse/batches/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    if (!canManageRepasses(req.user)) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const id = Number(req.params.id);
    const batch = queryOne<any>('SELECT * FROM repasse_batches WHERE id = ?', [id]);
    if (!batch) {
      return res.status(404).json({ error: 'Lote não encontrado.' });
    }

    if (batch.status === 'PAID') {
      return res.status(400).json({ error: 'Não é permitido excluir um lote que já foi pago e liquidado contabilmente.' });
    }

    execute('DELETE FROM repasse_adjustments WHERE batch_id = ?', [id]);
    execute('DELETE FROM repasse_batch_items WHERE batch_id = ?', [id]);
    execute('DELETE FROM repasse_batches WHERE id = ?', [id]);

    recordAuditLog(req, 'DELETE_REPASSE_BATCH', `/repasse/batches/${id}`, `Excluiu lote de repasse ${batch.batch_number}`);
    res.json({ success: true, message: `Lote ${batch.batch_number} removido com sucesso.` });
  } catch (err) {
    console.error('Error deleting repasse batch:', err);
    res.status(500).json({ error: 'Erro ao excluir lote de repasse.' });
  }
});

// 20.7 Portal de Produtividade & Repasse de Honorários (Zero-Knowledge com suporte a Gestão)
router.get('/repasse/my-summary', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role_id === 1;
    const isSecretary = req.user?.role === 'SECRETARY' || req.user?.role_id === 3;
    const canManageRepasse = isAdmin || isSecretary || canUserViewFinancial(req.user) || Boolean(req.user?.permissions?.includes('manage_repasses'));

    let psychId = req.user?.id;
    if (!psychId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (canManageRepasse && req.query.psychologist_id) {
      const requestedId = Number(req.query.psychologist_id);
      if (!isNaN(requestedId) && requestedId > 0) {
        psychId = requestedId;
      }
    } else if (canManageRepasse && !req.query.psychologist_id) {
      // Se gestor chamou sem especificar psicólogo (ex: Dra. Helena ou Ana), seleciona o primeiro psicólogo ativo
      const isLoggedPsychologist = req.user?.role === 'PSYCHOLOGIST' || req.user?.role_id === 2;
      if (!isLoggedPsychologist) {
        const firstPsych = queryOne<any>(
          `SELECT id FROM users 
           WHERE (role = 'PSYCHOLOGIST' OR role_id = 2) AND status = 'ACTIVE' 
           ORDER BY id ASC LIMIT 1`
        );
        if (firstPsych) {
          psychId = firstPsych.id;
        }
      }
    }

    const psych = queryOne<any>(
      `SELECT id, name, repasse_mode, repasse_percentage, repasse_eval_percentage, repasse_fixed_amount, pix_key, pix_key_type
       FROM users WHERE id = ?`,
      [psychId]
    );

    if (!psych) {
      return res.status(404).json({ error: 'Profissional não encontrado.' });
    }

    const repMode = psych.repasse_mode || 'PERCENTAGE';
    const psychRate = psych.repasse_percentage !== null && psych.repasse_percentage !== undefined ? Number(psych.repasse_percentage) : 50.0;
    const evalRate = psych.repasse_eval_percentage !== null && psych.repasse_eval_percentage !== undefined ? Number(psych.repasse_eval_percentage) : 60.0;
    const fixedAmount = psych.repasse_fixed_amount !== null && psych.repasse_fixed_amount !== undefined ? Number(psych.repasse_fixed_amount) : null;

    // 1. Sessões realizadas pelo psicólogo que ainda não foram fechadas em lotes pagos/fechados
    const unbatchedSessions = queryAll<any>(
      `SELECT s.id, s.patient_id, p.full_name as patient_name, s.start_time, s.status as session_status, s.modality, s.session_type,
              ft.id as transaction_id, ft.amount, ft.status as payment_status, ft.paid_at, ft.transaction_date
       FROM sessions s
       JOIN patients p ON s.patient_id = p.id
       LEFT JOIN financial_transactions ft ON ft.session_id = s.id
       WHERE s.psychologist_id = ? AND s.status = 'COMPLETED'
         AND s.id NOT IN (
           SELECT rbi.session_id FROM repasse_batch_items rbi
           JOIN repasse_batches rb ON rbi.batch_id = rb.id
           WHERE rb.status IN ('CLOSED', 'PAID') AND rbi.session_id IS NOT NULL
         )
       ORDER BY s.start_time DESC LIMIT 100`,
      [psychId]
    );

    let readyToReceiveAmount = 0;
    let readyToReceiveCount = 0;
    let pendingPaymentAmount = 0;
    let pendingPaymentCount = 0;

    const mappedUnbatched = unbatchedSessions.map(s => {
      const gross = Number(s.amount || 0);
      const isFixed = repMode === 'FIXED_PER_SESSION' && fixedAmount !== null;
      const rate = isFixed ? fixedAmount! : psychRate;
      const myRepasse = isFixed ? fixedAmount! : Math.round(gross * (psychRate / 100) * 100) / 100;
      const isPaid = s.payment_status === 'PAID';

      if (isPaid) {
        readyToReceiveAmount += myRepasse;
        readyToReceiveCount++;
      } else {
        pendingPaymentAmount += myRepasse;
        pendingPaymentCount++;
      }

      return {
        session_id: s.id,
        patient_name: s.patient_name,
        date: s.start_time ? s.start_time.split('T')[0] : s.transaction_date,
        time: s.start_time ? s.start_time.split('T')[1]?.substring(0, 5) : null,
        modality: s.modality,
        service_label: s.session_type === 'EVALUATION' ? 'Avaliação Neuropsicológica' : 'Psicoterapia',
        payment_status: s.payment_status || 'PENDING',
        my_repasse_rate: rate,
        my_repasse_amount: myRepasse,
      };
    });

    // 2. Histórico de lotes deste psicólogo
    const pastBatches = queryAll<any>(
      `SELECT id, batch_number, period_start, period_end, status, total_sessions_count,
              repasse_subtotal, deductions_amount, additions_amount, net_repasse_amount,
              payment_date, paid_at, payment_method, notes
       FROM repasse_batches
       WHERE psychologist_id = ?
       ORDER BY id DESC`,
      [psychId]
    );

    // 3. Total acumulado já pago ao psicólogo no ano corrente
    const currentYear = new Date().getFullYear().toString();
    const totalPaidYearRow = queryOne<any>(
      `SELECT SUM(net_repasse_amount) as total 
       FROM repasse_batches 
       WHERE psychologist_id = ? AND status = 'PAID' AND period_start LIKE ?`,
      [psychId, `${currentYear}%`]
    );
    const totalPaidYear = totalPaidYearRow?.total || 0;

    res.json({
      psychologist: {
        id: psych.id,
        name: psych.name,
        crp_number: psych.crp_number,
        repasse_mode: repMode,
        repasse_percentage: psychRate,
        repasse_eval_percentage: evalRate,
        repasse_fixed_amount: fixedAmount,
        pix_key: psych.pix_key,
        pix_key_type: psych.pix_key_type,
      },
      stats: {
        total_sessions_month: readyToReceiveCount + pendingPaymentCount,
        total_paid_sessions_month: readyToReceiveCount,
        pending_patient_payment_sessions: pendingPaymentCount,
        accrued_repasse_month: Math.round(readyToReceiveAmount * 100) / 100,
        total_received_year: Math.round(totalPaidYear * 100) / 100,
      },
      eligible_sessions: mappedUnbatched,
      batches: pastBatches,
    });
  } catch (err) {
    console.error('Error fetching psychologist repasse summary:', err);
    res.status(500).json({ error: 'Erro ao carregar resumo de produtividade.' });
  }
});

// ==========================================
// 21. TORRE DE RECEPÇÃO AO VIVO & GESTÃO DE SALAS
// ==========================================

function formatAnonymizedName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${first} ${lastInitial}.`;
}

/**
 * GET /api/reception/live-board - Visão em tempo real das sessões do dia e status de presença
 */
router.get('/reception/live-board', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const todayStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const sessions = queryAll<any>(
      `SELECT 
         s.id, s.psychologist_id, s.patient_id, s.start_time, s.end_time,
         s.status, s.modality, s.price, s.notes, s.session_type,
         s.room_id, s.room_name, s.arrival_time, s.called_at,
         s.session_started_at, s.session_ended_at, s.presence_status, s.waiting_notes,
         p.full_name as patient_name, p.phone as patient_phone, p.cpf as patient_cpf,
         u.name as psychologist_name,
         r.name as registered_room_name, r.color_code as room_color, r.status as room_status,
         ft.status as payment_status, ft.id as transaction_id
       FROM sessions s
       JOIN patients p ON s.patient_id = p.id
       JOIN users u ON s.psychologist_id = u.id
       LEFT JOIN rooms r ON s.room_id = r.id
       LEFT JOIN financial_transactions ft ON ft.session_id = s.id
       WHERE s.start_time LIKE ?
       ORDER BY s.start_time ASC`,
      [`${todayStr}%`]
    );

    const rooms = queryAll<any>(
      `SELECT id, name, room_type, color_code, status, active FROM rooms WHERE active = 1 ORDER BY id ASC`
    );

    let totalWaitSeconds = 0;
    let waitCount = 0;

    const mappedSessions = sessions.map((s) => {
      let waitMinutes = 0;
      if (s.arrival_time) {
        const arrivalMs = new Date(s.arrival_time).getTime();
        const endWaitMs = s.session_started_at ? new Date(s.session_started_at).getTime() : Date.now();
        waitMinutes = Math.max(0, Math.floor((endWaitMs - arrivalMs) / 60000));
        if (s.session_started_at || s.presence_status === 'WAITING' || s.presence_status === 'CALLED') {
          totalWaitSeconds += waitMinutes * 60;
          waitCount++;
        }
      }

      let sessionMinutes = 0;
      if (s.session_started_at) {
        const startMs = new Date(s.session_started_at).getTime();
        const endMs = s.session_ended_at ? new Date(s.session_ended_at).getTime() : Date.now();
        sessionMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000));
      }

      return {
        ...s,
        display_room_name: s.registered_room_name || s.room_name || 'A definir',
        wait_minutes: waitMinutes,
        session_minutes: sessionMinutes,
        anonymized_name: formatAnonymizedName(s.patient_name),
        payment_status: s.payment_status || 'PENDING',
      };
    });

    const waiting = mappedSessions.filter((s) => s.presence_status === 'WAITING' || s.presence_status === 'CALLED');
    const in_session = mappedSessions.filter((s) => s.presence_status === 'IN_SESSION');
    const completed = mappedSessions.filter((s) => s.presence_status === 'FINISHED' || s.status === 'COMPLETED');
    const scheduled = mappedSessions.filter((s) => 
      ['SCHEDULED', 'CONFIRMED'].includes(s.presence_status || 'SCHEDULED') &&
      s.status !== 'COMPLETED' &&
      s.status !== 'CANCELED' &&
      s.status !== 'NO_SHOW'
    );
    const canceled = mappedSessions.filter((s) => s.status === 'CANCELED' || s.status === 'NO_SHOW');

    // Rooms with their active session if any
    const enrichedRooms = rooms.map((room) => {
      const activeSess = in_session.find((s) => s.room_id === room.id);
      return {
        ...room,
        current_session: activeSess ? {
          id: activeSess.id,
          patient_name: activeSess.patient_name,
          psychologist_name: activeSess.psychologist_name,
          session_minutes: activeSess.session_minutes,
        } : null,
      };
    });

    res.json({
      date: todayStr,
      stats: {
        total_today: mappedSessions.length,
        waiting_count: waiting.length,
        in_session_count: in_session.length,
        completed_count: completed.length,
        scheduled_count: scheduled.length,
        canceled_count: canceled.length,
        avg_wait_minutes: waitCount > 0 ? Math.round((totalWaitSeconds / waitCount / 60) * 10) / 10 : 0,
      },
      board: {
        scheduled,
        waiting,
        in_session,
        completed,
        canceled,
      },
      rooms: enrichedRooms,
    });
  } catch (err) {
    console.error('Error fetching live board:', err);
    res.status(500).json({ error: 'Erro ao carregar Torre de Recepção ao Vivo' });
  }
});

/**
 * POST /api/reception/check-in - Registra a chegada do paciente na recepção
 */
router.post('/reception/check-in', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { session_id, room_id, room_name, waiting_notes } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id é obrigatório' });
    }

    const session = queryOne<any>('SELECT id, patient_id, psychologist_id FROM sessions WHERE id = ?', [session_id]);
    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    execute(
      `UPDATE sessions 
       SET presence_status = 'WAITING',
           arrival_time = COALESCE(arrival_time, ?),
           status = CASE WHEN status = 'SCHEDULED' THEN 'CONFIRMED' ELSE status END,
           room_id = COALESCE(?, room_id),
           room_name = COALESCE(?, room_name),
           waiting_notes = COALESCE(?, waiting_notes)
       WHERE id = ?`,
      [now, room_id || null, room_name || null, waiting_notes || null, session_id]
    );

    recordAuditLog(req, 'RECEPTION_CHECK_IN', `SESSION #${session_id}`, `Paciente deu entrada na recepção às ${now}`);
    res.json({ success: true, arrival_time: now, presence_status: 'WAITING' });
  } catch (err) {
    console.error('Error on check-in:', err);
    res.status(500).json({ error: 'Erro ao registrar check-in do paciente' });
  }
});

/**
 * POST /api/reception/call-patient - Chama o paciente da sala de espera para o consultório
 */
router.post('/reception/call-patient', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { session_id, room_id, room_name } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id é obrigatório' });
    }

    const session = queryOne<any>(
      `SELECT s.id, p.full_name as patient_name, u.name as psychologist_name, s.room_id, s.room_name, r.name as registered_room_name
       FROM sessions s
       JOIN patients p ON s.patient_id = p.id
       JOIN users u ON s.psychologist_id = u.id
       LEFT JOIN rooms r ON s.room_id = r.id
       WHERE s.id = ?`,
      [session_id]
    );

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const finalRoomName = room_name || session.registered_room_name || session.room_name || 'Consultório Principal';
    const anonymizedName = formatAnonymizedName(session.patient_name);

    execute(
      `UPDATE sessions 
       SET presence_status = 'CALLED',
           called_at = ?,
           room_id = COALESCE(?, room_id),
           room_name = ?
       WHERE id = ?`,
      [now, room_id || session.room_id || null, finalRoomName, session_id]
    );

    // Insere chamada na fila da TV e expira chamadas anteriores ativas
    execute(`UPDATE waiting_room_calls SET status = 'EXPIRED' WHERE session_id = ?`, [session_id]);
    execute(
      `INSERT INTO waiting_room_calls (session_id, patient_display_name, room_name, psychologist_name, called_at, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [session_id, anonymizedName, finalRoomName, session.psychologist_name, now]
    );

    recordAuditLog(req, 'RECEPTION_CALL_PATIENT', `SESSION #${session_id}`, `Paciente ${anonymizedName} chamado para ${finalRoomName}`);
    res.json({
      success: true,
      called_at: now,
      presence_status: 'CALLED',
      patient_display_name: anonymizedName,
      room_name: finalRoomName,
    });
  } catch (err) {
    console.error('Error on call-patient:', err);
    res.status(500).json({ error: 'Erro ao acionar chamada de paciente' });
  }
});

/**
 * POST /api/reception/start-session - Inicia o atendimento na sala com o psicólogo
 */
router.post('/reception/start-session', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { session_id, room_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id é obrigatório' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    execute(
      `UPDATE sessions 
       SET presence_status = 'IN_SESSION',
           session_started_at = COALESCE(session_started_at, ?),
           room_id = COALESCE(?, room_id)
       WHERE id = ?`,
      [now, room_id || null, session_id]
    );

    // Atualiza status do consultório para OCCUPIED se vinculado
    const session = queryOne<any>('SELECT room_id FROM sessions WHERE id = ?', [session_id]);
    const finalRoomId = room_id || session?.room_id;
    if (finalRoomId) {
      execute(`UPDATE rooms SET status = 'OCCUPIED' WHERE id = ?`, [finalRoomId]);
    }

    // Expira chamada de TV
    execute(`UPDATE waiting_room_calls SET status = 'EXPIRED' WHERE session_id = ?`, [session_id]);

    recordAuditLog(req, 'START_SESSION_CONSULTATION', `SESSION #${session_id}`, `Atendimento em sala iniciado`);
    res.json({ success: true, session_started_at: now, presence_status: 'IN_SESSION' });
  } catch (err) {
    console.error('Error starting session:', err);
    res.status(500).json({ error: 'Erro ao iniciar atendimento' });
  }
});

/**
 * POST /api/reception/finish-session - Encerra o atendimento e libera a sala
 */
router.post('/reception/finish-session', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { session_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id é obrigatório' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const session = queryOne<any>('SELECT room_id FROM sessions WHERE id = ?', [session_id]);
    
    execute(
      `UPDATE sessions 
       SET presence_status = 'FINISHED',
           status = 'COMPLETED',
           session_ended_at = COALESCE(session_ended_at, ?)
       WHERE id = ?`,
      [now, session_id]
    );

    if (session?.room_id) {
      execute(`UPDATE rooms SET status = 'AVAILABLE' WHERE id = ?`, [session.room_id]);
    }

    recordAuditLog(req, 'FINISH_SESSION_CONSULTATION', `SESSION #${session_id}`, `Atendimento concluído e sala liberada`);
    res.json({ success: true, session_ended_at: now, presence_status: 'FINISHED' });
  } catch (err) {
    console.error('Error finishing session:', err);
    res.status(500).json({ error: 'Erro ao finalizar atendimento' });
  }
});

/**
 * GET /api/reception/rooms & POST /api/reception/rooms - Gestão de Consultórios Físicos
 */
router.get('/reception/rooms', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const rooms = queryAll<any>('SELECT * FROM rooms WHERE active = 1 ORDER BY id ASC');
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar consultórios' });
  }
});

router.post('/reception/rooms', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { name, initials, room_type, color_code, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do consultório é obrigatório' });

    let finalType = room_type;
    if (finalType === 'CHILD') finalType = 'PLAY_THERAPY';
    if (!['CLINICAL', 'NEURO', 'PLAY_THERAPY', 'ONLINE'].includes(finalType)) {
      finalType = 'CLINICAL';
    }

    let finalStatus = status || 'AVAILABLE';
    if (!['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'].includes(finalStatus)) {
      finalStatus = 'AVAILABLE';
    }

    const cleanInitials = initials ? String(initials).trim().toUpperCase().slice(0, 8) : null;

    const result = execute(
      `INSERT INTO rooms (name, initials, room_type, color_code, status, active) VALUES (?, ?, ?, ?, ?, 1)`,
      [name, cleanInitials, finalType, color_code || '#0d9488', finalStatus]
    );

    recordAuditLog(req, 'CREATE_ROOM', `ROOM #${result.lastInsertRowid}`, `Criou consultório: ${name}`);
    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      room: {
        id: result.lastInsertRowid,
        name,
        initials: cleanInitials,
        room_type: finalType,
        color_code: color_code || '#0d9488',
        status: finalStatus,
        active: 1,
      },
    });
  } catch (err: any) {
    console.error('Error in POST /reception/rooms:', err);
    res.status(500).json({ error: 'Erro ao criar consultório', details: err?.message });
  }
});

router.put('/reception/rooms/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, initials, room_type, color_code, status, active } = req.body;

    let finalType = room_type;
    if (finalType === 'CHILD') finalType = 'PLAY_THERAPY';
    if (finalType && !['CLINICAL', 'NEURO', 'PLAY_THERAPY', 'ONLINE'].includes(finalType)) {
      finalType = 'CLINICAL';
    }

    let finalStatus = status;
    if (finalStatus && !['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'].includes(finalStatus)) {
      finalStatus = 'AVAILABLE';
    }

    const cleanInitials = initials !== undefined ? (initials ? String(initials).trim().toUpperCase().slice(0, 8) : '') : null;
    
    execute(
      `UPDATE rooms 
       SET name = COALESCE(?, name),
           initials = COALESCE(?, initials),
           room_type = COALESCE(?, room_type),
           color_code = COALESCE(?, color_code),
           status = COALESCE(?, status),
           active = COALESCE(?, active)
       WHERE id = ?`,
      [name, cleanInitials, finalType, color_code, finalStatus, active !== undefined ? (active ? 1 : 0) : null, id]
    );

    recordAuditLog(req, 'UPDATE_ROOM', `ROOM #${id}`, `Atualizou consultório`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in PUT /reception/rooms/:id:', err);
    res.status(500).json({ error: 'Erro ao atualizar consultório', details: err?.message });
  }
});

router.delete('/reception/rooms/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // Soft delete do consultório físico
    execute('UPDATE rooms SET active = 0 WHERE id = ?', [id]);
    recordAuditLog(req, 'DELETE_ROOM', `ROOM #${id}`, `Inativou consultório físico`);
    res.json({ success: true, message: 'Consultório inativado com sucesso' });
  } catch (err) {
    console.error('Error deleting room:', err);
    res.status(500).json({ error: 'Erro ao inativar consultório' });
  }
});

/**
 * GET /api/reception/rooms-availability
 * Parâmetros: date (YYYY-MM-DD), start_time (HH:mm ou ISO), end_time (HH:mm ou ISO), exclude_session_id (opcional)
 * Retorna lista de salas com flag is_available e dados de conflito se ocupada
 */
router.get('/reception/rooms-availability', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { date, start_time, end_time, exclude_session_id } = req.query;
    if (!date || !start_time || !end_time) {
      return res.status(400).json({ error: 'date, start_time e end_time são obrigatórios' });
    }

    const startIso = String(start_time).includes('T') ? String(start_time) : `${date}T${start_time}:00`;
    const endIso = String(end_time).includes('T') ? String(end_time) : `${date}T${end_time}:00`;

    const rooms = queryAll<any>('SELECT * FROM rooms WHERE active = 1 ORDER BY id ASC');

    let conflictSql = `
      SELECT s.id, s.room_id, s.start_time, s.end_time, s.modality,
             p.full_name as patient_name, u.name as psychologist_name
      FROM sessions s
      JOIN patients p ON s.patient_id = p.id
      JOIN users u ON s.psychologist_id = u.id
      WHERE s.room_id IS NOT NULL
        AND s.status NOT IN ('CANCELED')
        AND s.start_time < ? AND s.end_time > ?
    `;
    const conflictParams: any[] = [endIso, startIso];
    if (exclude_session_id) {
      conflictSql += ' AND s.id != ?';
      conflictParams.push(Number(exclude_session_id));
    }

    const conflicts = queryAll<any>(conflictSql, conflictParams);
    const conflictMap = new Map<number, any>();
    for (const c of conflicts) {
      conflictMap.set(c.room_id, {
        session_id: c.id,
        start_time: c.start_time,
        end_time: c.end_time,
        psychologist_name: c.psychologist_name,
        patient_name: formatAnonymizedName(c.patient_name),
      });
    }

    const availability = rooms.map((room) => {
      const conflict = conflictMap.get(room.id);
      return {
        ...room,
        is_available: !conflict,
        conflict_session: conflict || null,
      };
    });

    res.json({ availability });
  } catch (err) {
    console.error('Error checking room availability:', err);
    res.status(500).json({ error: 'Erro ao verificar disponibilidade de salas' });
  }
});

/**
 * GET /api/reception/rooms-timeline
 * Parâmetro: date (YYYY-MM-DD, padrão hoje)
 * Retorna matriz de salas e sessões alocadas no dia para visualização matricial
 */
router.get('/reception/rooms-timeline', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const queryDate = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const rooms = queryAll<any>('SELECT * FROM rooms WHERE active = 1 ORDER BY id ASC');

    const sessions = queryAll<any>(
      `SELECT s.id, s.room_id, s.room_name, s.start_time, s.end_time, s.status, s.presence_status,
              s.modality, s.session_type,
              p.full_name as patient_name, u.name as psychologist_name,
              r.color_code as room_color
       FROM sessions s
       JOIN patients p ON s.patient_id = p.id
       JOIN users u ON s.psychologist_id = u.id
       LEFT JOIN rooms r ON s.room_id = r.id
       WHERE s.start_time LIKE ?
         AND s.status NOT IN ('CANCELED')
       ORDER BY s.start_time ASC`,
      [`${queryDate}%`]
    );

    const formattedSessions = sessions.map((s) => ({
      ...s,
      patient_display_name: formatAnonymizedName(s.patient_name),
    }));

    res.json({
      date: queryDate,
      rooms,
      sessions: formattedSessions,
    });
  } catch (err) {
    console.error('Error fetching rooms timeline:', err);
    res.status(500).json({ error: 'Erro ao obter timeline de salas' });
  }
});

/**
 * GET /api/reception/tv-display - Rota pública/leve para exibição na TV da sala de espera (CFP 06/2019 & LGPD)
 */
router.get('/reception/tv-display', (req: Request, res: Response) => {
  try {
    const activeCall = queryOne<any>(
      `SELECT id, session_id, patient_display_name, room_name, psychologist_name, called_at, status
       FROM waiting_room_calls
       WHERE status = 'ACTIVE'
       ORDER BY called_at DESC
       LIMIT 1`
    );

    const recentCalls = queryAll<any>(
      `SELECT id, patient_display_name, room_name, psychologist_name, called_at
       FROM waiting_room_calls
       ORDER BY called_at DESC
       LIMIT 5`
    );

    const clinic = queryOne<any>(
      'SELECT clinic_name, logo_base64, waiting_tv_enabled FROM clinic_settings WHERE id = 1'
    );

    res.json({
      active_call: activeCall || null,
      recent_calls: recentCalls || [],
      clinic_name: clinic?.clinic_name || 'Synapsis Clínico',
      logo_base64: clinic?.logo_base64 || null,
      waiting_tv_enabled: Boolean(clinic?.waiting_tv_enabled ?? 1),
      server_time: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error fetching tv display data:', err);
    res.status(500).json({ error: 'Erro ao obter dados da TV' });
  }
});

// ==========================================
// 🎓 SYNAPSIS ACADEMY: TREINAMENTO & PROGRESSO
// ==========================================

router.get('/academy/progress', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const progress = queryAll<any>(
      `SELECT id, tour_id, category, completed_count, status, last_completed_at
       FROM user_academy_progress
       WHERE user_id = ?
       ORDER BY last_completed_at DESC`,
      [userId]
    );

    res.json({ progress: progress || [] });
  } catch (err) {
    console.error('Error fetching academy progress:', err);
    res.status(500).json({ error: 'Erro ao buscar progresso na Academy' });
  }
});

router.post('/academy/progress', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { tour_id, category } = req.body;
  if (!tour_id || !category) {
    return res.status(400).json({ error: 'tour_id e category são obrigatórios' });
  }

  try {
    const existing = queryOne<any>(
      'SELECT id, completed_count FROM user_academy_progress WHERE user_id = ? AND tour_id = ?',
      [userId, tour_id]
    );

    if (existing) {
      execute(
        `UPDATE user_academy_progress 
         SET completed_count = completed_count + 1,
             last_completed_at = CURRENT_TIMESTAMP,
             status = 'COMPLETED'
         WHERE id = ?`,
        [existing.id]
      );
    } else {
      execute(
        `INSERT INTO user_academy_progress (user_id, tour_id, category, completed_count, status, last_completed_at)
         VALUES (?, ?, ?, 1, 'COMPLETED', CURRENT_TIMESTAMP)`,
        [userId, tour_id, category]
      );
    }

    const updated = queryOne<any>(
      'SELECT id, tour_id, category, completed_count, status, last_completed_at FROM user_academy_progress WHERE user_id = ? AND tour_id = ?',
      [userId, tour_id]
    );

    recordAuditLog(req, 'ACADEMY_PROCEDURE_COMPLETED', `/academy/progress/${tour_id}`, `Concluiu procedimento da Academy: ${tour_id}`);

    res.json({ success: true, progress: updated });
  } catch (err) {
    console.error('Error updating academy progress:', err);
    res.status(500).json({ error: 'Erro ao registrar progresso na Academy' });
  }
});

// ==========================================
// CENTRAL DE AJUDA INTELIGENTE & COPILOTO SYNAPSI (IA)
// ==========================================

const copilotQuerySchema = z.object({
  question: z.string().min(2, 'Pergunta muito curta'),
  currentScreen: z.string().optional().default('Geral'),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    text: z.string(),
  })).optional().default([]),
});

router.post('/ai/copilot', authenticateToken, async (req: AuthRequest, res: Response) => {
  const parse = copilotQuerySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  const { question, currentScreen, history } = parse.data;
  const userRole = (req as any).user?.role || 'PSYCHOLOGIST';

  try {
    const result = await askSynapsiCopilot(question, userRole, currentScreen, history);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /ai/copilot:', err);
    res.status(500).json({ error: 'Erro ao consultar o Copiloto Clínico' });
  }
});

const explainElementSchema = z.object({
  tagName: z.string().default('BUTTON'),
  innerText: z.string().optional(),
  ariaLabel: z.string().optional(),
  title: z.string().optional(),
  module: z.string().optional(),
  subTab: z.string().optional(),
});

router.post('/ai/explain-element', authenticateToken, async (req: AuthRequest, res: Response) => {
  const parse = explainElementSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || 'Dados inválidos' });
    return;
  }

  const userRole = (req as any).user?.role || 'PSYCHOLOGIST';
  try {
    const result = await explainElementWithAi({
      ...parse.data,
      userRole,
    });
    res.json(result);
  } catch (err: any) {
    console.error('Error in /ai/explain-element:', err);
    res.status(500).json({ error: 'Erro ao explicar elemento com IA' });
  }
});

// ==========================================
// 🧠 SUÍTE CLÍNICA INTELIGENTE (SYNAPSIS IA)
// ==========================================

const formatNotesSchema = z.object({
  text: z.string().min(2, 'Texto muito curto para formatação'),
  mode: z.enum(['SPELLING_ONLY', 'CLINICAL_POLISH']).default('SPELLING_ONLY'),
  patientId: z.number().optional(),
});

router.post(
  '/ai/format-notes',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  async (req: AuthRequest, res: Response) => {
    const parse = formatNotesSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Parâmetros inválidos' });
      return;
    }

    const { text, mode, patientId } = parse.data;
    let patientName: string | undefined;
    let cpf: string | undefined;

    if (patientId) {
      const patient = queryOne<any>('SELECT full_name, cpf FROM patients WHERE id = ?', [patientId]);
      if (patient) {
        patientName = patient.full_name;
        cpf = patient.cpf;
      }
    }

    try {
      const result = await formatClinicalNotes(text, mode, patientName, cpf);
      try {
        recordAuditLog(
          req,
          'AI_FORMAT_CLINICAL_NOTES',
          patientId ? `PATIENT #${patientId}` : 'CLINICAL_FORM',
          `Formatação clínica via IA realizada no modo ${mode}`
        );
      } catch (auditErr) {
        console.warn('[Audit] Falha ao registrar log de formatação:', auditErr);
      }
      res.json({
        ...result,
        formattedText: result.formatted,
      });
    } catch (err: any) {
      console.error('Error in /ai/format-notes:', err);
      res.status(500).json({ error: 'Falha ao formatar texto com IA' });
    }
  }
);

const ocrNotesSchema = z.object({
  imageBase64: z.string().min(10, 'Imagem base64 inválida'),
  mimeType: z.string().optional().default('image/jpeg'),
  organizeClinically: z.boolean().optional().default(true),
  patientId: z.number().optional(),
});

router.post(
  '/ai/ocr-notes',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  async (req: AuthRequest, res: Response) => {
    const parse = ocrNotesSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Parâmetros inválidos' });
      return;
    }

    const { imageBase64, mimeType, organizeClinically, patientId } = parse.data;

    try {
      const result = await ocrHandwrittenNotes(imageBase64, mimeType, organizeClinically);
      try {
        recordAuditLog(
          req,
          'AI_OCR_HANDWRITTEN_NOTES',
          patientId ? `PATIENT #${patientId}` : 'OCR_SCAN',
          `Digitalização OCR de anotação manuscrita realizada via IA`
        );
      } catch (auditErr) {
        console.warn('[Audit] Falha ao registrar log de OCR:', auditErr);
      }
      res.json(result);
    } catch (err: any) {
      console.error('Error in /ai/ocr-notes:', err);
      res.status(500).json({ error: 'Falha ao digitalizar anotação com IA' });
    }
  }
);

const generateEvolutionSchema = z.object({
  patientId: z.number().int().positive('ID do paciente obrigatório'),
  currentNotes: z.string().optional(),
  modelType: z.enum(['DAP', 'SOAP', 'FREE']).default('DAP'),
});

router.post(
  '/ai/generate-evolution',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  async (req: AuthRequest, res: Response) => {
    const parse = generateEvolutionSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Parâmetros inválidos' });
      return;
    }

    const { patientId, currentNotes, modelType } = parse.data;

    const patient = queryOne<any>('SELECT id, full_name, cpf FROM patients WHERE id = ?', [patientId]);
    if (!patient) {
      res.status(404).json({ error: 'Paciente não encontrado' });
      return;
    }

    // Busca as evoluções clínicas anteriores do paciente (para comparar N com N-1)
    const records = queryAll<any>(
      `SELECT id, record_type, encrypted_content, encryption_iv, auth_tag, created_at
       FROM medical_records
       WHERE patient_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [patientId]
    );

    const decrypted = records.map((r) => {
      try {
        const raw = decryptClinicalText({
          encryptedContent: r.encrypted_content,
          iv: r.encryption_iv,
          authTag: r.auth_tag,
        });

        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { raw };
        }

        let noteText = '';
        if (parsed.dados || parsed.avaliacao || parsed.plano) {
          noteText = `[Dados]: ${parsed.dados || ''}\n[Avaliação]: ${parsed.avaliacao || ''}\n[Plano]: ${parsed.plano || ''}`;
        } else if (parsed.subjetivo || parsed.objetivo || parsed.avaliacao || parsed.plano) {
          noteText = `[Subjetivo]: ${parsed.subjetivo || ''}\n[Objetivo]: ${parsed.objetivo || ''}\n[Avaliação]: ${parsed.avaliacao || ''}\n[Plano]: ${parsed.plano || ''}`;
        } else if (parsed.behavior || parsed.intervention) {
          noteText = `[Comportamento]: ${parsed.behavior || ''}\n[Intervenção]: ${parsed.intervention || ''}\n[Resposta]: ${parsed.response || ''}\n[Plano]: ${parsed.plano || ''}`;
        } else if (parsed.raw) {
          noteText = parsed.raw;
        }

        return {
          date: r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : undefined,
          notes: noteText,
        };
      } catch {
        return { date: undefined, notes: '' };
      }
    });

    let currentSession: { date?: string; notes: string };
    let previousSession: { date?: string; notes: string };

    if (currentNotes && currentNotes.trim().length > 0) {
      currentSession = {
        date: new Date().toLocaleDateString('pt-BR'),
        notes: currentNotes.trim(),
      };
      previousSession = decrypted[0] || {
        date: undefined,
        notes: '',
      };
    } else {
      currentSession = decrypted[0] || {
        date: new Date().toLocaleDateString('pt-BR'),
        notes: 'Sessão atual sem anotações prévias registradas.',
      };
      previousSession = decrypted[1] || {
        date: undefined,
        notes: '',
      };
    }

    try {
      const result = await generateComparativeEvolution({
        previousSession,
        currentSession,
        modelType,
        patientName: patient.full_name,
        cpf: patient.cpf,
      });

      try {
        recordAuditLog(
          req,
          'AI_GENERATE_COMPARATIVE_EVOLUTION',
          `PATIENT #${patientId}`,
          `Evolução clínica comparativa gerada com modelo ${modelType}`
        );
      } catch (auditErr) {
        console.warn('[Audit] Falha ao registrar log de evolução:', auditErr);
      }

      res.json({
        ...result,
        previousSessionDate: previousSession.date,
        currentSessionDate: currentSession.date,
      });
    } catch (err: any) {
      console.error('Error in /ai/generate-evolution:', err);
      res.status(500).json({ error: 'Falha ao gerar evolução comparativa com IA' });
    }
  }
);

// -------------------------------------------------------------
// FASE 2: PREPARAÇÃO DA PRÓXIMA SESSÃO & TRANSCRIÇÃO ZERO-RETENTION
// -------------------------------------------------------------

const sessionPrepSchema = z.object({
  patientId: z.number().int().positive('ID do paciente obrigatório'),
});

router.post(
  '/ai/session-prep-insights',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  async (req: AuthRequest, res: Response) => {
    const parse = sessionPrepSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Parâmetros inválidos' });
      return;
    }

    const { patientId } = parse.data;

    const patient = queryOne<any>('SELECT id, full_name, cpf FROM patients WHERE id = ?', [patientId]);
    if (!patient) {
      res.status(404).json({ error: 'Paciente não encontrado' });
      return;
    }

    // Busca as últimas 5 evoluções para análise longitudinal de padrões
    const records = queryAll<any>(
      `SELECT id, record_type, encrypted_content, encryption_iv, auth_tag, created_at
       FROM medical_records
       WHERE patient_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [patientId]
    );

    const history = records.map((r) => {
      try {
        const raw = decryptClinicalText({
          encryptedContent: r.encrypted_content,
          iv: r.encryption_iv,
          authTag: r.auth_tag,
        });

        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { raw };
        }

        let noteText = '';
        if (parsed.dados || parsed.avaliacao || parsed.plano) {
          noteText = `[Dados]: ${parsed.dados || ''}\n[Avaliação]: ${parsed.avaliacao || ''}\n[Plano]: ${parsed.plano || ''}`;
        } else if (parsed.subjetivo || parsed.objetivo || parsed.avaliacao || parsed.plano) {
          noteText = `[Subjetivo]: ${parsed.subjetivo || ''}\n[Objetivo]: ${parsed.objetivo || ''}\n[Avaliação]: ${parsed.avaliacao || ''}\n[Plano]: ${parsed.plano || ''}`;
        } else {
          noteText = parsed.notes || parsed.text || parsed.raw || '';
        }

        return {
          date: r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : undefined,
          type: r.record_type,
          notes: noteText,
        };
      } catch {
        return { date: undefined, type: r.record_type, notes: '' };
      }
    });

    try {
      const insights = await generateSessionPrepInsights({
        patientId,
        patientName: patient.full_name,
        cpf: patient.cpf,
        history,
      });

      try {
        recordAuditLog(
          req,
          'AI_GENERATE_SESSION_PREP',
          `PATIENT #${patientId}`,
          `Geração de insights de preparação de sessão com análise longitudinal`
        );
      } catch (auditErr) {
        console.warn('[Audit] Falha ao registrar log de preparação:', auditErr);
      }

      res.json(insights);
    } catch (err: any) {
      console.error('Error in /ai/session-prep-insights:', err);
      res.status(500).json({ error: 'Falha ao gerar insights de preparação da sessão' });
    }
  }
);

const transcribeSessionSchema = z.object({
  audioBase64: z.string().min(10, 'Áudio base64 obrigatório'),
  mimeType: z.string().optional().default('audio/webm'),
  sessionType: z.enum(['PRESENCIAL', 'ONLINE']).default('PRESENCIAL'),
  tcleConfirmed: z.boolean().refine((val) => val === true, {
    message: 'A confirmação de consentimento ético do paciente (TCLE) é obrigatória para transcrição de sessão.',
  }),
  patientId: z.number().optional(),
});

router.post(
  '/ai/transcribe-session',
  authenticateToken,
  requireRole(['ADMIN', 'PSYCHOLOGIST']),
  async (req: AuthRequest, res: Response) => {
    const parse = transcribeSessionSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Parâmetros inválidos' });
      return;
    }

    const { audioBase64, mimeType, sessionType, patientId } = parse.data;

    let patientName: string | undefined;
    let cpf: string | undefined;

    if (patientId) {
      const patient = queryOne<any>('SELECT full_name, cpf FROM patients WHERE id = ?', [patientId]);
      if (patient) {
        patientName = patient.full_name;
        cpf = patient.cpf;
      }
    }

    try {
      const result = await transcribeSessionAudio({
        audioBase64,
        mimeType,
        sessionType,
        patientName,
        cpf,
      });

      try {
        recordAuditLog(
          req,
          'AI_SESSION_AUDIO_TRANSCRIBE_ZERO_RETENTION',
          patientId ? `PATIENT #${patientId}` : 'CLINICAL_SESSION',
          `Transcrição clínica de áudio realizada no modo ${sessionType} com política Zero-Retention (áudio expurgado da memória)`
        );
      } catch (auditErr) {
        console.warn('[Audit] Falha ao registrar log de transcrição de áudio:', auditErr);
      }

      res.json(result);
    } catch (err: any) {
      console.error('Error in /ai/transcribe-session:', err);
      res.status(500).json({ error: 'Falha ao processar transcrição da sessão com IA' });
    }
  }
);

export default router;
