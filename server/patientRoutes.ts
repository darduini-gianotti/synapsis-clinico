import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, execute } from './db.js';
import {
  authenticatePatientToken,
  generatePatientToken,
  recordPatientAuditLog,
  PatientAuthRequest,
  AuthenticatedPatient
} from './patientAuth.js';

export const patientRouter = Router();

// ==========================================
// 1. AUTENTICAÇÃO E PERFIL DO PACIENTE
// ==========================================

function normalizeCpf(cpfRaw: string): string {
  return (cpfRaw || '').replace(/\D/g, '');
}

/**
 * Solicitar código OTP via WhatsApp / SMS
 */
patientRouter.post('/auth/request-otp', (req: Request, res: Response): void => {
  const { cpf } = req.body;
  if (!cpf) {
    res.status(400).json({ error: 'Por favor, informe seu CPF.' });
    return;
  }

  const cleanCpf = normalizeCpf(cpf);
  if (cleanCpf.length !== 11) {
    res.status(400).json({ error: 'CPF inválido. Certifique-se de digitar os 11 dígitos.' });
    return;
  }

  // 1. Busca como paciente titular
  const titularPatients = queryAll<any>(
    "SELECT id, full_name, cpf, phone, status FROM patients WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?",
    [cleanCpf]
  );

  // 2. Busca como responsável de dependentes menores (guardian_json ou financial_responsible_json)
  const allPatientsWithGuardians = queryAll<any>(
    "SELECT id, full_name, cpf, phone, status, guardian_json, financial_responsible_json, group_type FROM patients WHERE guardian_json IS NOT NULL OR financial_responsible_json IS NOT NULL"
  );

  const dependentMatches: any[] = [];
  let guardianPhone = '';
  let guardianName = '';

  for (const p of allPatientsWithGuardians) {
    try {
      if (p.guardian_json) {
        const g = JSON.parse(p.guardian_json);
        if (g.cpf && normalizeCpf(g.cpf) === cleanCpf) {
          dependentMatches.push(p);
          if (g.phone && !guardianPhone) guardianPhone = g.phone;
          if (g.fullName && !guardianName) guardianName = g.fullName;
        }
      }
      if (p.financial_responsible_json) {
        const f = JSON.parse(p.financial_responsible_json);
        if (f.cpf && normalizeCpf(f.cpf) === cleanCpf && !dependentMatches.some(x => x.id === p.id)) {
          dependentMatches.push(p);
          if (f.phone && !guardianPhone) guardianPhone = f.phone;
          if (f.fullName && !guardianName) guardianName = f.fullName;
        }
      }
    } catch (e) {}
  }

  if (titularPatients.length === 0 && dependentMatches.length === 0) {
    res.status(404).json({
      error: 'CPF não localizado na base de pacientes ou responsáveis. Verifique os dados com a recepção da sua clínica.'
    });
    return;
  }

  // Determinar paciente principal para vinculação do token OTP
  const primaryPatient = titularPatients[0] || dependentMatches[0];
  const targetPhone = titularPatients[0]?.phone || guardianPhone || primaryPatient.phone || '(11) 99999-9999';

  // Gerar código OTP de 6 dígitos numéricos
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Invalidar tokens antigos deste paciente
  execute("DELETE FROM patient_auth_tokens WHERE patient_id = ? AND used_at IS NULL", [primaryPatient.id]);

  // Gravar novo OTP válido por 10 minutos
  execute(
    `INSERT INTO patient_auth_tokens (patient_id, phone_used, otp_code, expires_at)
     VALUES (?, ?, ?, datetime('now', '+10 minutes'))`,
    [primaryPatient.id, targetPhone, otpCode]
  );

  console.log(`\n======================================================`);
  console.log(`🔑 [SYNAPSIS PACIENTE] Código de Acesso OTP para ${cleanCpf}: [ ${otpCode} ]`);
  console.log(`📱 Destinatário WhatsApp: ${targetPhone}`);
  console.log(`======================================================\n`);

  // Mascarar telefone para exibição segura na tela
  const digitsOnly = targetPhone.replace(/\D/g, '');
  const maskedPhone = digitsOnly.length >= 8 
    ? `(${digitsOnly.slice(0, 2)}) *****-${digitsOnly.slice(-4)}`
    : targetPhone;

  res.json({
    success: true,
    message: 'Código de verificação enviado com sucesso.',
    phoneMasked: maskedPhone,
    devOtp: otpCode, // Facilita validação em ambiente de desenvolvimento
  });
});

/**
 * Validar código OTP e iniciar sessão
 */
patientRouter.post('/auth/verify-otp', (req: Request, res: Response): void => {
  const { cpf, otpCode } = req.body;
  if (!cpf || !otpCode) {
    res.status(400).json({ error: 'CPF e código de verificação são obrigatórios.' });
    return;
  }

  const cleanCpf = normalizeCpf(cpf);

  // Buscar tokens válidos
  const tokenRecord = queryOne<any>(
    `SELECT t.id, t.patient_id, t.otp_code, t.attempts, t.expires_at, p.full_name, p.phone, p.cpf as patient_cpf
     FROM patient_auth_tokens t
     JOIN patients p ON p.id = t.patient_id
     WHERE t.used_at IS NULL 
       AND datetime('now') < t.expires_at
       AND t.otp_code = ?
     ORDER BY t.created_at DESC LIMIT 1`,
    [otpCode.trim()]
  );

  if (!tokenRecord) {
    res.status(400).json({ error: 'Código de verificação inválido ou expirado. Solicite um novo código.' });
    return;
  }

  // Marcar token como utilizado
  execute("UPDATE patient_auth_tokens SET used_at = datetime('now') WHERE id = ?", [tokenRecord.id]);

  // Verificar se o CPF informado é titular ou responsável
  const isTitular = normalizeCpf(tokenRecord.patient_cpf) === cleanCpf;

  // Carregar todos os dependentes vinculados ao CPF
  const allPatients = queryAll<any>("SELECT id, full_name, cpf, birth_date, group_type, guardian_json, financial_responsible_json FROM patients");
  const associatedPatients: any[] = [];

  if (isTitular) {
    associatedPatients.push({
      id: tokenRecord.patient_id,
      full_name: tokenRecord.full_name,
      group_type: 'Titular',
      is_titular: true
    });
  }

  for (const p of allPatients) {
    try {
      let isDep = false;
      if (p.guardian_json) {
        const g = JSON.parse(p.guardian_json);
        if (g.cpf && normalizeCpf(g.cpf) === cleanCpf) isDep = true;
      }
      if (p.financial_responsible_json) {
        const f = JSON.parse(p.financial_responsible_json);
        if (f.cpf && normalizeCpf(f.cpf) === cleanCpf) isDep = true;
      }
      if (isDep && !associatedPatients.some(x => x.id === p.id)) {
        associatedPatients.push({
          id: p.id,
          full_name: p.full_name,
          birth_date: p.birth_date,
          group_type: p.group_type || 'Dependente',
          is_titular: false
        });
      }
    } catch (e) {}
  }

  const activePatient = associatedPatients[0];
  const dependentIds = associatedPatients.map(p => p.id);

  // Verificar se já tem PIN cadastrado
  const creds = queryOne<any>("SELECT pin_hash FROM patient_credentials WHERE patient_id = ?", [activePatient.id]);
  const hasPin = !!(creds && creds.pin_hash);

  const tokenPayload: AuthenticatedPatient = {
    patient_id: activePatient.id,
    full_name: isTitular ? tokenRecord.full_name : 'Responsável Legal',
    cpf: cleanCpf,
    phone: tokenRecord.phone,
    is_guardian: !isTitular || associatedPatients.length > 1,
    guardian_cpf: !isTitular ? cleanCpf : undefined,
    active_patient_id: activePatient.id,
    dependent_ids: dependentIds,
    role: 'patient'
  };

  const jwtToken = generatePatientToken(tokenPayload);

  res.json({
    success: true,
    token: jwtToken,
    patient: {
      id: activePatient.id,
      name: activePatient.full_name,
      cpf: cleanCpf,
      isGuardian: tokenPayload.is_guardian,
    },
    hasPin,
    dependents: associatedPatients
  });
});

/**
 * Validar Token do Magic Link de Convite
 */
patientRouter.post('/auth/verify-invite', (req: Request, res: Response): void => {
  const { inviteToken } = req.body;
  if (!inviteToken || typeof inviteToken !== 'string') {
    res.status(400).json({ error: 'Token de convite não informado.' });
    return;
  }

  const patient = queryOne<any>(
    `SELECT id, full_name, phone, cpf, email, portal_access_enabled, portal_invite_expires_at, portal_first_access_at
     FROM patients
     WHERE portal_invite_token = ?`,
    [inviteToken.trim()]
  );

  if (!patient) {
    res.status(404).json({ error: 'Link de convite inválido ou não encontrado. Solicite um novo link à clínica.' });
    return;
  }

  if (patient.portal_access_enabled === 0) {
    res.status(403).json({ error: 'O acesso a este portal foi desativado pela clínica. Entre em contato com a recepção.' });
    return;
  }

  if (patient.portal_invite_expires_at && new Date(patient.portal_invite_expires_at) < new Date()) {
    res.status(410).json({ error: 'Este link de convite expirou (validade de 7 dias). Solicite um novo link à sua clínica.' });
    return;
  }

  // Verificar se já possui PIN cadastrado
  const creds = queryOne<any>("SELECT pin_hash, last_login_at FROM patient_credentials WHERE patient_id = ?", [patient.id]);
  const hasPin = !!(creds && creds.pin_hash);

  const digitsOnly = (patient.phone || '').replace(/\D/g, '');
  const maskedPhone = digitsOnly.length >= 8
    ? `(${digitsOnly.slice(0, 2)}) *****-${digitsOnly.slice(-4)}`
    : patient.phone;

  res.json({
    valid: true,
    patient: {
      id: patient.id,
      fullName: patient.full_name,
      firstName: patient.full_name.split(' ')[0],
      phoneMasked: maskedPhone,
      email: patient.email || '',
      hasPin,
      isFirstAccess: !patient.portal_first_access_at,
    }
  });
});

/**
 * Concluir ativação do primeiro acesso via convite: define o PIN e loga diretamente
 */
patientRouter.post('/auth/set-initial-pin', (req: Request, res: Response): void => {
  const { inviteToken, pin } = req.body;
  if (!inviteToken || !pin) {
    res.status(400).json({ error: 'Token de convite e PIN são obrigatórios.' });
    return;
  }

  if (pin.toString().length !== 4 || !/^\d{4}$/.test(pin.toString())) {
    res.status(400).json({ error: 'O PIN deve conter exatamente 4 números.' });
    return;
  }

  const patient = queryOne<any>(
    `SELECT id, full_name, phone, cpf, portal_access_enabled, portal_invite_expires_at
     FROM patients
     WHERE portal_invite_token = ?`,
    [inviteToken.trim()]
  );

  if (!patient) {
    res.status(404).json({ error: 'Link de convite inválido ou expirado.' });
    return;
  }

  if (patient.portal_access_enabled === 0) {
    res.status(403).json({ error: 'O acesso a este portal foi desativado pela clínica.' });
    return;
  }

  const pinHash = bcrypt.hashSync(pin.toString(), 10);

  // Grava ou atualiza as credenciais
  execute(
    `INSERT INTO patient_credentials (patient_id, pin_hash, last_login_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(patient_id) DO UPDATE SET pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = NULL, last_login_at = datetime('now'), updated_at = datetime('now')`,
    [patient.id, pinHash]
  );

  // Registra a data do primeiro acesso
  execute(
    `UPDATE patients SET portal_first_access_at = COALESCE(portal_first_access_at, datetime('now')) WHERE id = ?`,
    [patient.id]
  );

  // Buscar dependentes vinculados ao paciente (caso haja)
  const allPatients = queryAll<any>("SELECT id, full_name, cpf, birth_date, group_type, guardian_json, financial_responsible_json FROM patients");
  const associatedPatients: any[] = [
    {
      id: patient.id,
      full_name: patient.full_name,
      group_type: 'Titular',
      is_titular: true
    }
  ];

  const cleanCpf = normalizeCpf(patient.cpf || '');
  if (cleanCpf) {
    for (const p of allPatients) {
      try {
        let isDep = false;
        if (p.guardian_json) {
          const g = JSON.parse(p.guardian_json);
          if (g.cpf && normalizeCpf(g.cpf) === cleanCpf) isDep = true;
        }
        if (p.financial_responsible_json) {
          const f = JSON.parse(p.financial_responsible_json);
          if (f.cpf && normalizeCpf(f.cpf) === cleanCpf) isDep = true;
        }
        if (isDep && !associatedPatients.some(x => x.id === p.id)) {
          associatedPatients.push({
            id: p.id,
            full_name: p.full_name,
            birth_date: p.birth_date,
            group_type: p.group_type || 'Dependente',
            is_titular: false
          });
        }
      } catch (e) {}
    }
  }

  const tokenPayload: AuthenticatedPatient = {
    patient_id: patient.id,
    full_name: patient.full_name,
    cpf: cleanCpf,
    phone: patient.phone || '',
    is_guardian: associatedPatients.length > 1,
    active_patient_id: patient.id,
    dependent_ids: associatedPatients.map(p => p.id),
    role: 'patient'
  };

  const jwtToken = generatePatientToken(tokenPayload);

  res.json({
    success: true,
    token: jwtToken,
    patient: {
      id: patient.id,
      name: patient.full_name,
      cpf: cleanCpf,
      isGuardian: tokenPayload.is_guardian,
    },
    hasPin: true,
    dependents: associatedPatients
  });
});

/**
 * Desbloqueio rápido por PIN de 4 dígitos

 */
patientRouter.post('/auth/verify-pin', (req: Request, res: Response): void => {
  const { cpf, pin } = req.body;
  if (!cpf || !pin) {
    res.status(400).json({ error: 'CPF e PIN são obrigatórios.' });
    return;
  }

  const cleanCpf = normalizeCpf(cpf);
  
  // Localizar paciente
  const titular = queryOne<any>(
    "SELECT id, full_name, phone, cpf FROM patients WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?",
    [cleanCpf]
  );

  let targetPatientId = titular ? titular.id : null;
  let targetName = titular ? titular.full_name : '';
  let targetPhone = titular ? titular.phone : '';

  if (!targetPatientId) {
    // Busca nos responsáveis
    const allP = queryAll<any>("SELECT id, full_name, phone, guardian_json FROM patients WHERE guardian_json IS NOT NULL");
    for (const p of allP) {
      try {
        const g = JSON.parse(p.guardian_json);
        if (g.cpf && normalizeCpf(g.cpf) === cleanCpf) {
          targetPatientId = p.id;
          targetName = g.fullName || p.full_name;
          targetPhone = g.phone || p.phone;
          break;
        }
      } catch (e) {}
    }
  }

  if (!targetPatientId) {
    res.status(404).json({ error: 'Cadastro não encontrado.' });
    return;
  }

  const cred = queryOne<any>(
    "SELECT pin_hash, failed_attempts, locked_until FROM patient_credentials WHERE patient_id = ?",
    [targetPatientId]
  );

  if (!cred || !cred.pin_hash) {
    res.status(400).json({ error: 'PIN não cadastrado para este usuário. Acesse utilizando o código via WhatsApp.' });
    return;
  }

  // Verificar bloqueio por tentativas
  if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
    res.status(403).json({ error: 'Acesso temporariamente bloqueado por tentativas incorretas. Aguarde alguns minutos.' });
    return;
  }

  const isValidPin = bcrypt.compareSync(pin.toString(), cred.pin_hash);

  if (!isValidPin) {
    const attempts = (cred.failed_attempts || 0) + 1;
    if (attempts >= 5) {
      execute(
        "UPDATE patient_credentials SET failed_attempts = ?, locked_until = datetime('now', '+15 minutes') WHERE patient_id = ?",
        [attempts, targetPatientId]
      );
      res.status(403).json({ error: 'Muitas tentativas incorretas. Acesso bloqueado por 15 minutos.' });
      return;
    } else {
      execute("UPDATE patient_credentials SET failed_attempts = ? WHERE patient_id = ?", [attempts, targetPatientId]);
      res.status(400).json({ error: `PIN incorreto. Tentativa ${attempts} de 5.` });
      return;
    }
  }

  // Resetar tentativas e registrar login
  execute(
    "UPDATE patient_credentials SET failed_attempts = 0, locked_until = NULL, last_login_at = datetime('now') WHERE patient_id = ?",
    [targetPatientId]
  );

  // Carregar dependentes
  const allPatients = queryAll<any>("SELECT id, full_name, cpf, birth_date, group_type, guardian_json, financial_responsible_json FROM patients");
  const associatedPatients: any[] = [];

  if (titular) {
    associatedPatients.push({ id: titular.id, full_name: titular.full_name, group_type: 'Titular', is_titular: true });
  }

  for (const p of allPatients) {
    try {
      let isDep = false;
      if (p.guardian_json) {
        const g = JSON.parse(p.guardian_json);
        if (g.cpf && normalizeCpf(g.cpf) === cleanCpf) isDep = true;
      }
      if (isDep && !associatedPatients.some(x => x.id === p.id)) {
        associatedPatients.push({ id: p.id, full_name: p.full_name, birth_date: p.birth_date, group_type: p.group_type || 'Dependente', is_titular: false });
      }
    } catch (e) {}
  }

  const activePatient = associatedPatients[0] || { id: targetPatientId, full_name: targetName };
  const dependentIds = associatedPatients.map(p => p.id);

  const tokenPayload: AuthenticatedPatient = {
    patient_id: activePatient.id,
    full_name: targetName,
    cpf: cleanCpf,
    phone: targetPhone,
    is_guardian: associatedPatients.length > 1,
    guardian_cpf: titular ? undefined : cleanCpf,
    active_patient_id: activePatient.id,
    dependent_ids: dependentIds,
    role: 'patient'
  };

  const jwtToken = generatePatientToken(tokenPayload);

  res.json({
    success: true,
    token: jwtToken,
    patient: {
      id: activePatient.id,
      name: activePatient.full_name,
      cpf: cleanCpf,
      isGuardian: tokenPayload.is_guardian,
    },
    hasPin: true,
    dependents: associatedPatients
  });
});

/**
 * Cadastrar ou atualizar PIN de acesso rápido
 */
patientRouter.post('/auth/set-pin', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const { pin } = req.body;
  if (!pin || pin.toString().length !== 4 || !/^\d{4}$/.test(pin.toString())) {
    res.status(400).json({ error: 'O PIN deve conter exatamente 4 números.' });
    return;
  }

  const patientId = req.patient!.active_patient_id;
  const pinHash = bcrypt.hashSync(pin.toString(), 10);

  execute(
    `INSERT INTO patient_credentials (patient_id, pin_hash, last_login_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(patient_id) DO UPDATE SET pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = NULL, updated_at = datetime('now')`,
    [patientId, pinHash]
  );

  res.json({ success: true, message: 'PIN cadastrado com sucesso! Você pode usá-lo no próximo acesso.' });
});

/**
 * Alternar dependente ativo no perfil familiar
 */
patientRouter.post('/switch-dependent', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const { dependentId } = req.body;
  if (!dependentId) {
    res.status(400).json({ error: 'Identificador do dependente é obrigatório.' });
    return;
  }

  const depIdNum = Number(dependentId);
  const allowedIds = req.patient!.dependent_ids || [req.patient!.patient_id];

  if (!allowedIds.includes(depIdNum)) {
    res.status(403).json({ error: 'Você não possui permissão para acessar este dependente.' });
    return;
  }

  const depPatient = queryOne<any>("SELECT id, full_name, cpf, phone FROM patients WHERE id = ?", [depIdNum]);
  if (!depPatient) {
    res.status(404).json({ error: 'Dependente não encontrado.' });
    return;
  }

  const updatedPayload: AuthenticatedPatient = {
    ...req.patient!,
    active_patient_id: depIdNum,
  };

  const newToken = generatePatientToken(updatedPayload);

  res.json({
    success: true,
    token: newToken,
    activeDependent: {
      id: depPatient.id,
      name: depPatient.full_name,
    }
  });
});

/**
 * Perfil do paciente ativo e dados da clínica
 */
patientRouter.get('/profile', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;

  const patient = queryOne<any>(
    `SELECT p.id, p.full_name, p.cpf, p.phone, p.birth_date, p.group_type, p.session_price,
            u.id as psychologist_id, u.name as psychologist_name, u.crp_number
     FROM patients p
     LEFT JOIN users u ON u.id = p.psychologist_id
     WHERE p.id = ?`,
    [patientId]
  );

  const clinic = queryOne<any>("SELECT clinic_name, phone, email, address, logo_base64 FROM clinic_settings WHERE id = 1");

  res.json({
    patient,
    clinic: clinic || { clinic_name: 'PsicoGestão', phone: '(11) 99999-9999' },
    isGuardian: req.patient!.is_guardian
  });
});

// ==========================================
// 2. AGENDA E SESSÕES
// ==========================================

/**
 * Próximas sessões e histórico
 */
patientRouter.get('/appointments', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;

  const sessions = queryAll<any>(
    `SELECT s.id, s.start_time, s.end_time, s.status, s.modality, s.price, s.notes, s.session_type,
            s.video_status, s.video_provider, s.video_room_id, s.video_external_url, s.patient_access_token, s.patient_tcle_accepted_at,
            u.name as psychologist_name, u.crp_number, u.epsi_code
     FROM sessions s
     JOIN users u ON u.id = s.psychologist_id
     WHERE s.patient_id = ?
     ORDER BY s.start_time DESC`,
    [patientId]
  );

  const now = new Date();
  const upcoming = sessions.filter(s => new Date(s.start_time) >= now && s.status !== 'CANCELED');
  const past = sessions.filter(s => new Date(s.start_time) < now || s.status === 'CANCELED');

  res.json({
    upcoming,
    past,
    nextAppointment: upcoming[0] || null
  });
});

/**
 * Confirmar presença em 1 toque
 */
patientRouter.post('/appointments/:id/confirm', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;
  const sessionId = Number(req.params.id);

  const session = queryOne<any>("SELECT id, status, patient_id FROM sessions WHERE id = ? AND patient_id = ?", [sessionId, patientId]);
  if (!session) {
    res.status(404).json({ error: 'Consulta não localizada.' });
    return;
  }

  execute("UPDATE sessions SET status = 'CONFIRMED' WHERE id = ?", [sessionId]);
  recordPatientAuditLog(req, 'CONFIRM_SESSION', `SESSION #${sessionId}`, 'Paciente confirmou presença via app');

  res.json({ success: true, message: 'Presença confirmada com sucesso! Seu terapeuta já foi notificado.' });
});

/**
 * Obter horários disponíveis do terapeuta para remarcação
 */
patientRouter.get('/available-slots', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;

  const p = queryOne<any>("SELECT psychologist_id FROM patients WHERE id = ?", [patientId]);
  if (!p || !p.psychologist_id) {
    res.status(400).json({ error: 'Terapeuta não vinculado a este paciente.' });
    return;
  }

  // Buscar sessões ocupadas nos próximos 14 dias
  const booked = queryAll<any>(
    `SELECT start_time, end_time FROM sessions
     WHERE psychologist_id = ? 
       AND start_time >= datetime('now')
       AND start_time <= datetime('now', '+14 days')
       AND status != 'CANCELED'`,
    [p.psychologist_id]
  );

  const bookedSet = new Set(booked.map(b => b.start_time.slice(0, 16)));

  // Gerar slots padrão de atendimento (08:00 às 18:00 nos dias úteis)
  const slots: Array<{ date: string; time: string; startIso: string; endIso: string }> = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + 1); // A partir de amanhã

  for (let d = 0; d < 10; d++) {
    const day = new Date(baseDate);
    day.setDate(day.getDate() + d);
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Pular fim de semana

    const yyyy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, '0');
    const dd = String(day.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const workHours = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
    for (const h of workHours) {
      const slotStart = `${dateStr}T${h}:00`;
      const slotEndHour = String(Number(h.split(':')[0])).padStart(2, '0');
      const slotEnd = `${dateStr}T${slotEndHour}:50:00`;
      
      if (!bookedSet.has(slotStart.slice(0, 16))) {
        slots.push({
          date: dateStr,
          time: h,
          startIso: slotStart,
          endIso: slotEnd
        });
      }
    }
  }

  res.json({ slots: slots.slice(0, 20) });
});

/**
 * Reagendar consulta (com validação da trava de antecedência)
 */
patientRouter.post('/appointments/:id/reschedule', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;
  const sessionId = Number(req.params.id);
  const { newStartTime, newEndTime, reason } = req.body;

  if (!newStartTime || !newEndTime) {
    res.status(400).json({ error: 'Novo horário é obrigatório.' });
    return;
  }

  const session = queryOne<any>("SELECT id, start_time, psychologist_id FROM sessions WHERE id = ? AND patient_id = ?", [sessionId, patientId]);
  if (!session) {
    res.status(404).json({ error: 'Consulta não encontrada.' });
    return;
  }

  const clinic = queryOne<any>("SELECT cancellation_notice_hours FROM clinic_settings WHERE id = 1");
  const noticeHours = clinic?.cancellation_notice_hours || 24;

  const now = new Date();
  const sessionStart = new Date(session.start_time);
  const hoursRemaining = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursRemaining >= noticeHours) {
    // Reagendamento automático liberado
    execute(
      "UPDATE sessions SET start_time = ?, end_time = ?, status = 'SCHEDULED', notes = COALESCE(notes, '') || ' [Reagendado pelo paciente no app]' WHERE id = ?",
      [newStartTime, newEndTime, sessionId]
    );

    recordPatientAuditLog(req, 'RESCHEDULE_SESSION', `SESSION #${sessionId}`, `De ${session.start_time} para ${newStartTime} (>24h livre)`);

    res.json({
      success: true,
      autoRescheduled: true,
      message: 'Consulta reagendada com sucesso!'
    });
  } else {
    // Menos de 24h: gera solicitação pendente para a recepção
    execute(
      `INSERT INTO patient_messages (patient_id, channel_type, sender_type, message_text)
       VALUES (?, 'ADMINISTRATIVE', 'PATIENT', ?)`,
      [patientId, `[SOLICITAÇÃO DE REAGENDAMENTO EM CIMA DA HORA]: O paciente solicita troca da consulta de ${session.start_time} para ${newStartTime}. Motivo: ${reason || 'Não informado'}. (Menos de ${noticeHours}h de antecedência).`]
    );

    res.json({
      success: true,
      autoRescheduled: false,
      message: `Como faltam menos de ${noticeHours} horas para a consulta, enviamos uma Solicitação de Reagendamento à recepção para avaliação conforme a política do consultório.`
    });
  }
});

/**
 * Cancelar consulta (com validação da trava de antecedência)
 */
patientRouter.post('/appointments/:id/cancel', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;
  const sessionId = Number(req.params.id);
  const { reason } = req.body;

  const session = queryOne<any>("SELECT id, start_time FROM sessions WHERE id = ? AND patient_id = ?", [sessionId, patientId]);
  if (!session) {
    res.status(404).json({ error: 'Consulta não encontrada.' });
    return;
  }

  const clinic = queryOne<any>("SELECT cancellation_notice_hours FROM clinic_settings WHERE id = 1");
  const noticeHours = clinic?.cancellation_notice_hours || 24;

  const now = new Date();
  const sessionStart = new Date(session.start_time);
  const hoursRemaining = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursRemaining >= noticeHours) {
    execute(
      "UPDATE sessions SET status = 'CANCELED', cancellation_reason = ? WHERE id = ?",
      [reason || 'Cancelado pelo paciente no app com antecedência', sessionId]
    );

    recordPatientAuditLog(req, 'CANCEL_SESSION', `SESSION #${sessionId}`, 'Cancelamento com antecedência > 24h');

    res.json({
      success: true,
      autoCanceled: true,
      message: 'Consulta cancelada com sucesso.'
    });
  } else {
    execute(
      `INSERT INTO patient_messages (patient_id, channel_type, sender_type, message_text)
       VALUES (?, 'ADMINISTRATIVE', 'PATIENT', ?)`,
      [patientId, `[SOLICITAÇÃO DE CANCELAMENTO TARDIO]: O paciente solicitou o cancelamento da consulta de ${session.start_time}. Motivo: ${reason || 'Não informado'}. (Aviso com menos de ${noticeHours}h).`]
    );

    res.json({
      success: true,
      autoCanceled: false,
      message: `Solicitação registrada. De acordo com a política de cancelamentos da clínica, cancelamentos com menos de ${noticeHours}h de antecedência estão sujeitos à cobrança da sessão.`
    });
  }
});

// ==========================================
// 3. MÓDULO FINANCEIRO E PIX
// ==========================================

/**
 * Faturas pendentes e histórico financeiro
 */
patientRouter.get('/financial', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;

  const transactions = queryAll<any>(
    `SELECT t.id, t.amount, t.status, t.payment_method, t.transaction_date, t.paid_at, t.notes,
            s.start_time, s.session_type,
            i.invoice_number, i.status as invoice_status
     FROM financial_transactions t
     LEFT JOIN sessions s ON s.id = t.session_id
     LEFT JOIN invoice_items ii ON ii.transaction_id = t.id
     LEFT JOIN invoices i ON i.id = ii.invoice_id
     WHERE t.patient_id = ?
     ORDER BY t.transaction_date DESC`,
    [patientId]
  );

  const clinic = queryOne<any>("SELECT pix_key, pix_key_type, pix_beneficiary, clinic_name FROM clinic_settings WHERE id = 1");

  // Gerar chave copia e cola simulada caso pendente
  const pending = transactions.filter(t => t.status === 'PENDING').map(t => ({
    ...t,
    pixCopyPaste: `00020126580014BR.GOV.BCB.PIX0114+5511999999999520400005303986540${Number(t.amount).toFixed(2)}5802BR5915${(clinic?.pix_beneficiary || clinic?.clinic_name || 'PsicoGestao').slice(0, 15)}6009SAO PAULO62070503***6304E8A2`,
  }));

  const paid = transactions.filter(t => t.status === 'PAID');

  res.json({
    pending,
    paid,
    totalPending: pending.reduce((acc, cur) => acc + cur.amount, 0),
    clinicPix: clinic
  });
});

// ==========================================
// 4. COFRE DE DOCUMENTOS OFICIAIS CFP
// (Blindagem: NUNCA expõe medical_records ou confidential_notes)
// ==========================================

patientRouter.get('/documents', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;

  // Atestados e Declarações oficiais CFP
  const docs = queryAll<any>(
    `SELECT d.id, d.document_type, d.hash_sha256, d.is_signed, d.created_at,
            u.name as psychologist_name, u.crp_number
     FROM documents d
     JOIN users u ON u.id = d.psychologist_id
     WHERE d.patient_id = ? AND d.is_signed = 1
     ORDER BY d.created_at DESC`,
    [patientId]
  );

  // Laudos e relatórios anexados e finalizados
  const patientDocs = queryAll<any>(
    `SELECT pd.id, pd.title, pd.category, pd.file_name, pd.file_size, pd.hash_sha256, pd.created_at,
            u.name as psychologist_name
     FROM patient_documents pd
     JOIN users u ON u.id = pd.psychologist_id
     WHERE pd.patient_id = ? AND pd.is_signed = 1
     ORDER BY pd.created_at DESC`,
    [patientId]
  );

  recordPatientAuditLog(req, 'VIEW_DOCUMENTS_VAULT', `PATIENT #${patientId}`, 'Acessou o cofre de documentos oficiais');

  res.json({
    officialDocuments: docs,
    patientDocuments: patientDocs
  });
});

// ==========================================
// 5. ATIVIDADES E ESCALAS TERAPÊUTICAS
// ==========================================

patientRouter.get('/activities', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;

  const activities = queryAll<any>(
    `SELECT a.id, a.title, a.description, a.activity_type, a.status, a.due_date, a.completed_at, a.response_json,
            u.name as psychologist_name
     FROM patient_activities a
     JOIN users u ON u.id = a.psychologist_id
     WHERE a.patient_id = ?
     ORDER BY a.created_at DESC`,
    [patientId]
  );

  res.json({ activities });
});

patientRouter.post('/activities/:id/submit', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;
  const activityId = Number(req.params.id);
  const { responseJson } = req.body;

  const act = queryOne<any>("SELECT id, activity_type, psychologist_id FROM patient_activities WHERE id = ? AND patient_id = ?", [activityId, patientId]);
  if (!act) {
    res.status(404).json({ error: 'Atividade não encontrada.' });
    return;
  }

  execute(
    "UPDATE patient_activities SET status = 'COMPLETED', response_json = ?, completed_at = datetime('now') WHERE id = ?",
    [JSON.stringify(responseJson || {}), activityId]
  );

  // Se for escala psicométrica GAD-7 ou PHQ-9, registrar também na tabela oficial de escalas
  if (act.activity_type === 'SCALE_GAD7' || act.activity_type === 'SCALE_PHQ9') {
    const scaleType = act.activity_type === 'SCALE_GAD7' ? 'GAD7' : 'PHQ9';
    let totalScore = 0;
    if (responseJson && typeof responseJson === 'object') {
      for (const val of Object.values(responseJson)) {
        totalScore += Number(val) || 0;
      }
    }
    const severity = totalScore >= 15 ? 'Grave' : totalScore >= 10 ? 'Moderada' : totalScore >= 5 ? 'Leve' : 'Mínima';

    execute(
      `INSERT INTO psychological_scales (patient_id, psychologist_id, scale_type, answers_json, total_score, severity)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patientId, act.psychologist_id, scaleType, JSON.stringify(responseJson), totalScore, severity]
    );
  }

  recordPatientAuditLog(req, 'SUBMIT_ACTIVITY', `ACTIVITY #${activityId}`, `Concluiu atividade ${act.activity_type}`);

  res.json({ success: true, message: 'Respostas enviadas com sucesso ao seu psicólogo!' });
});

// ==========================================
// 6. MENSAGERIA EM DUAS VIAS
// ==========================================

/**
 * Status dos canais de comunicação
 */
patientRouter.get('/messages/status', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;

  const p = queryOne<any>(
    `SELECT p.psychologist_chat_override, u.id as psychologist_id, u.name as psychologist_name,
            u.chat_enabled_default, u.chat_working_hours
     FROM patients p
     LEFT JOIN users u ON u.id = p.psychologist_id
     WHERE p.id = ?`,
    [patientId]
  );

  // Determinar se canal clínico está ativo
  let clinicalEnabled = false;
  if (p) {
    if (p.psychologist_chat_override === 'ENABLED') clinicalEnabled = true;
    else if (p.psychologist_chat_override === 'DISABLED') clinicalEnabled = false;
    else clinicalEnabled = p.chat_enabled_default === 1;
  }

  res.json({
    administrativeChannel: {
      enabled: true,
      label: 'Recepção da Clínica',
      description: 'Dúvidas sobre agendamentos, recibos e orientações gerais.'
    },
    clinicalChannel: {
      enabled: clinicalEnabled,
      therapistName: p?.psychologist_name || 'Seu Terapeuta',
      workingHours: p?.chat_working_hours ? JSON.parse(p.chat_working_hours) : { days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' },
      disabledMessage: 'O contato do terapeuta via app está desativado para melhor aproveitamento do tempo durante as consultas presenciais ou online.'
    },
    emergencyHelpline: '188 - Centro de Valorização da Vida (CVV)'
  });
});

/**
 * Listar mensagens de um canal
 */
patientRouter.get('/messages', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;
  const channel = (req.query.channel as string) || 'ADMINISTRATIVE';

  const messages = queryAll<any>(
    `SELECT id, channel_type, sender_type, sender_user_id, message_text, attachment_url, attachment_name, is_read, created_at
     FROM patient_messages
     WHERE patient_id = ? AND channel_type = ?
     ORDER BY created_at ASC`,
    [patientId, channel]
  );

  res.json({ messages });
});

/**
 * Enviar mensagem
 */
patientRouter.post('/messages', authenticatePatientToken, (req: PatientAuthRequest, res: Response): void => {
  const patientId = req.patient!.active_patient_id;
  const { channelType, messageText } = req.body;

  if (!messageText || !messageText.trim()) {
    res.status(400).json({ error: 'Texto da mensagem não pode ser vazio.' });
    return;
  }

  const channel = channelType === 'CLINICAL' ? 'CLINICAL' : 'ADMINISTRATIVE';

  if (channel === 'CLINICAL') {
    // Validar se o terapeuta permite mensagens
    const p = queryOne<any>(
      `SELECT p.psychologist_chat_override, u.chat_enabled_default
       FROM patients p
       LEFT JOIN users u ON u.id = p.psychologist_id
       WHERE p.id = ?`,
      [patientId]
    );
    const enabled = p?.psychologist_chat_override === 'ENABLED' || (p?.psychologist_chat_override !== 'DISABLED' && p?.chat_enabled_default === 1);
    if (!enabled) {
      res.status(403).json({ error: 'O canal clínico direto com o terapeuta encontra-se desativado no momento.' });
      return;
    }
  }

  const result = execute(
    `INSERT INTO patient_messages (patient_id, channel_type, sender_type, message_text)
     VALUES (?, ?, 'PATIENT', ?)`,
    [patientId, channel, messageText.trim()]
  );

  res.json({
    success: true,
    message: {
      id: result.lastInsertRowid,
      channel_type: channel,
      sender_type: 'PATIENT',
      message_text: messageText.trim(),
      created_at: new Date().toISOString()
    }
  });
});
