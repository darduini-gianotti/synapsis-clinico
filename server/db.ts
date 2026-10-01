import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { encryptClinicalText, generateSHA256 } from './crypto.js';

let dbInstance: any = null;

export function getDbFilePath(): string {
  const customPath = process.env.DB_FILE_PATH;
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.join(process.cwd(), customPath);
  }
  return path.join(process.cwd(), 'psico_database.sqlite');
}

function ensureDbDirectory(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function getDb() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  const dbPath = getDbFilePath();

  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      dbInstance = new SQL.Database(fileBuffer);
      migrateTables(dbInstance);
      saveDb(true);
      return dbInstance;
    } catch (e) {
      console.error('Could not load existing database file, creating new in-memory instance', e);
    }
  }

  dbInstance = new SQL.Database();
  initTables(dbInstance);
  migrateTables(dbInstance);

  const isCleanMode = process.env.APP_MODE === 'clean' || process.env.SEED_DEMO_DATA === 'false';
  if (isCleanMode) {
    console.log('🌱 Inicializando banco limpo em branco para produção/consultório real...');
    seedCleanProductionData(dbInstance);
  } else {
    seedInitialData(dbInstance);
  }

  saveDb(true);
  return dbInstance;
}

let isSaving = false;
let pendingSaveTimeout: NodeJS.Timeout | null = null;
let hasUnsavedChanges = false;

/**
 * Persist database to disk.
 * By default, debounces writes over 50ms to coalesce rapid writes and writes asynchronously.
 * If forceSync is true, flushes immediately using synchronous write.
 */
export function saveDb(forceSync: boolean = false) {
  if (!dbInstance) return;

  const targetPath = getDbFilePath();
  ensureDbDirectory(targetPath);

  if (forceSync) {
    if (pendingSaveTimeout) {
      clearTimeout(pendingSaveTimeout);
      pendingSaveTimeout = null;
    }
    try {
      const data = dbInstance.export();
      const buffer = Buffer.from(data);
      const tempPath = `${targetPath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, buffer);
      fs.copyFileSync(tempPath, targetPath);
      try { fs.unlinkSync(tempPath); } catch {}
      hasUnsavedChanges = false;
    } catch (err) {
      console.error('Failed to save SQLite database to disk (sync):', err);
    }
    return;
  }

  hasUnsavedChanges = true;

  if (pendingSaveTimeout) {
    return; // Already debouncing
  }

  pendingSaveTimeout = setTimeout(async () => {
    pendingSaveTimeout = null;
    if (!hasUnsavedChanges || isSaving || !dbInstance) return;

    isSaving = true;
    try {
      const data = dbInstance.export();
      const buffer = Buffer.from(data);
      hasUnsavedChanges = false;
      const tempPath = `${targetPath}.tmp.${Date.now()}`;
      await fs.promises.writeFile(tempPath, buffer);
      await fs.promises.copyFile(tempPath, targetPath);
      try { await fs.promises.unlink(tempPath); } catch {}
    } catch (err) {
      console.error('Failed to save SQLite database to disk (async):', err);
      hasUnsavedChanges = true;
    } finally {
      isSaving = false;
      if (hasUnsavedChanges) {
        saveDb();
      }
    }
  }, 50);
}

/**
 * Force an immediate synchronous flush of any pending in-memory database changes.
 */
export function flushSaveDb() {
  saveDb(true);
}

// Ensure changes are flushed synchronously on process exit
process.on('beforeExit', () => {
  if (hasUnsavedChanges) saveDb(true);
});
process.on('SIGINT', () => {
  if (hasUnsavedChanges) saveDb(true);
});
process.on('SIGTERM', () => {
  if (hasUnsavedChanges) saveDb(true);
});

/**
 * Execute a query with parameters and return array of objects
 */
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

/**
 * Execute a query with parameters and return first object or null
 */
export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute an INSERT / UPDATE / DELETE statement with parameters
 */
export function execute(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.run(params);
  stmt.free();

  const lastIdRes = queryOne('SELECT last_insert_rowid() as id');
  const lastInsertRowid = lastIdRes ? Number(lastIdRes.id) : 0;
  saveDb();
  return { changes: 1, lastInsertRowid };
}

function initTables(db: any) {
  db.exec(`
    -- 1. Roles table
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0
    );

    -- 1a. Permissions table
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    -- 1b. Role Permissions table
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (permission_id) REFERENCES permissions(id)
    );

    -- 1c. Users table (RBAC & Security updated)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT,
      role_id INTEGER,
      crp_number TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PENDING_ACTIVATION', 'BLOCKED')),
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until DATETIME,
      token_version INTEGER NOT NULL DEFAULT 1,
      repasse_mode TEXT DEFAULT 'PERCENTAGE' CHECK(repasse_mode IN ('PERCENTAGE', 'FIXED_PER_SESSION')),
      repasse_percentage REAL DEFAULT 50.0,
      repasse_eval_percentage REAL DEFAULT 60.0,
      repasse_fixed_amount REAL,
      pix_key TEXT,
      pix_key_type TEXT,
      bank_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    -- 1d. Auth Tokens table (Convites de 1o Acesso e Redefinicao de Senha)
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      token_type TEXT NOT NULL CHECK(token_type IN ('INVITE', 'RESET')),
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 2. Patients table (Estrutura Completa de Cadastro em 6 Módulos)
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      psychologist_id INTEGER,
      full_name TEXT NOT NULL,
      cpf TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'DISCHARGED')),
      lgpd_consent_at DATETIME NOT NULL,
      birth_date TEXT,
      email TEXT,
      notes_basic TEXT,
      group_type TEXT NOT NULL DEFAULT 'Adulto' CHECK(group_type IN ('Criança', 'Adolescente', 'Adulto', 'Idoso')),
      rg TEXT,
      gender TEXT,
      financial_plan_type TEXT NOT NULL DEFAULT 'Por Sessão' CHECK(financial_plan_type IN ('Por Sessão', 'Mensal', 'Convênio', 'Isento')),
      session_price REAL NOT NULL DEFAULT 180.00,
      address_json TEXT,
      emergency_contacts_json TEXT,
      birthplace TEXT,
      education TEXT,
      race TEXT,
      profession TEXT,
      guardian_json TEXT,
      financial_responsible_json TEXT,
      whatsapp_routing_json TEXT,
      psychologist_chat_override TEXT DEFAULT NULL,
      portal_access_enabled INTEGER DEFAULT 1,
      portal_invite_token TEXT DEFAULT NULL,
      portal_invite_sent_at DATETIME DEFAULT NULL,
      portal_invite_expires_at DATETIME DEFAULT NULL,
      portal_first_access_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (psychologist_id) REFERENCES users(id)
    );

    -- 3. Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      psychologist_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW')),
      modality TEXT NOT NULL DEFAULT 'PRESENTIAL' CHECK(modality IN ('ONLINE', 'PRESENTIAL')),
      price REAL NOT NULL DEFAULT 180.00,
      notes TEXT,
      recurrence_group_id TEXT,
      recurrence_pattern TEXT,
      cancellation_reason TEXT,
      evaluation_id INTEGER,
      session_type TEXT NOT NULL DEFAULT 'PSYCHOTHERAPY' CHECK(session_type IN ('PSYCHOTHERAPY', 'EVALUATION')),
      video_provider TEXT DEFAULT 'NATIVE',
      video_room_id TEXT,
      video_external_url TEXT,
      video_status TEXT DEFAULT 'INACTIVE' CHECK(video_status IN ('INACTIVE', 'OPEN', 'ACTIVE', 'FINISHED')),
      video_started_at DATETIME,
      video_ended_at DATETIME,
      patient_joined_at DATETIME,
      patient_tcle_accepted_at DATETIME,
      patient_access_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (psychologist_id) REFERENCES users(id),
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (evaluation_id) REFERENCES neuropsych_evaluations(id)
    );

    -- 4. Medical Records (Prontuários - Criptografia AES-256-GCM At-Rest + Hash SHA-256)
    CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      session_id INTEGER,
      psychologist_id INTEGER NOT NULL,
      record_type TEXT NOT NULL CHECK(record_type IN ('DAP', 'BIRP', 'FREE')),
      encrypted_content TEXT NOT NULL,
      encryption_iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      is_signed INTEGER NOT NULL DEFAULT 0,
      hash_sha256 TEXT,
      signed_at DATETIME,
      signed_by_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (psychologist_id) REFERENCES users(id)
    );

    -- 5. Confidential Notes (Anotações Confidenciais do Terapeuta - CFP 01/2009)
    CREATE TABLE IF NOT EXISTS confidential_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      psychologist_id INTEGER NOT NULL,
      encrypted_content TEXT NOT NULL,
      encryption_iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (psychologist_id) REFERENCES users(id)
    );

    -- 6. CFP Documents (Declaração, Atestado, Relatório, Laudo, Parecer)
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      psychologist_id INTEGER NOT NULL,
      document_type TEXT NOT NULL CHECK(document_type IN ('DECLARACAO', 'ATESTADO', 'RELATORIO', 'LAUDO', 'PARECER')),
      content_json TEXT NOT NULL,
      content_html TEXT,
      hash_sha256 TEXT NOT NULL,
      is_signed INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (psychologist_id) REFERENCES users(id)
    );

    -- 6.1. CFP Document Templates
    CREATE TABLE IF NOT EXISTS document_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      psychologist_id INTEGER, -- Se NULL, é template nativo do sistema
      title TEXT NOT NULL,
      document_type TEXT NOT NULL CHECK(document_type IN ('DECLARACAO', 'ATESTADO', 'RELATORIO', 'LAUDO', 'PARECER')),
      content_html TEXT,
      content_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (psychologist_id) REFERENCES users(id)
    );

    -- 7. Psychological Scales (PHQ-9, GAD-7)
    CREATE TABLE IF NOT EXISTS psychological_scales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      psychologist_id INTEGER NOT NULL,
      scale_type TEXT NOT NULL CHECK(scale_type IN ('PHQ9', 'GAD7')),
      answers_json TEXT NOT NULL,
      total_score INTEGER NOT NULL,
      severity TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (psychologist_id) REFERENCES users(id)
    );

    -- 8. Financial Transactions (Honorários, Carnê-Leão, Parcelas de Avaliação)
    CREATE TABLE IF NOT EXISTS financial_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      session_id INTEGER,
      evaluation_id INTEGER,
      installment_number INTEGER,
      total_installments INTEGER,
      invoice_status TEXT DEFAULT 'NOT_ISSUED',
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID')),
      payment_method TEXT NOT NULL DEFAULT 'PIX' CHECK(payment_method IN ('PIX', 'CARTAO', 'DINHEIRO', 'BOLETO')),
      transaction_date DATE NOT NULL,
      paid_at DATETIME,
      notes TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (evaluation_id) REFERENCES neuropsych_evaluations(id)
    );

    -- 9. Audit Logs (Trilha de Auditoria LGPD)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      details TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 10. Patient Documents & Attachments (Anamnese, Laudos, Encaminhamentos, Anexos, etc.)
    CREATE TABLE IF NOT EXISTS patient_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      psychologist_id INTEGER NOT NULL,
      evaluation_id INTEGER,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      document_type TEXT,
      content_json TEXT NOT NULL,
      file_name TEXT,
      file_size INTEGER,
      file_type TEXT,
      file_data TEXT,
      hash_sha256 TEXT,
      is_signed INTEGER NOT NULL DEFAULT 1,
      signed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (psychologist_id) REFERENCES users(id),
      FOREIGN KEY (evaluation_id) REFERENCES neuropsych_evaluations(id)
    );

    -- 11. Expenses Table (Despesas Fixas, Variáveis e Recorrentes - Carnê-Leão / Livro-Caixa)
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      psychologist_id INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'OUTROS',
      amount REAL NOT NULL,
      due_date DATE NOT NULL,
      payment_date DATE,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELED')),
      payment_method TEXT CHECK(payment_method IN ('PIX', 'BOLETO', 'CARTAO', 'TRANSFERENCIA', 'DINHEIRO', 'DEBITO_AUTOMATICO')),
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_period TEXT DEFAULT 'MONTHLY',
      recurrence_group_id TEXT,
      installment_number INTEGER,
      installments_total INTEGER,
      carne_leao_deductible INTEGER NOT NULL DEFAULT 1,
      is_shared INTEGER NOT NULL DEFAULT 0,
      shared_splits_json TEXT,
      scope TEXT NOT NULL DEFAULT 'CLINIC' CHECK(scope IN ('CLINIC', 'INDIVIDUAL', 'SHARED')),
      payer_user_id INTEGER,
      rfb_account_code TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (psychologist_id) REFERENCES users(id),
      FOREIGN KEY (payer_user_id) REFERENCES users(id)
    );

    -- 11.1. Expense Settlements Table (Acertos de Contas e Reembolsos entre Terapeutas)
    CREATE TABLE IF NOT EXISTS expense_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL REFERENCES users(id),
      to_user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      payment_date DATE NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'PIX' CHECK(payment_method IN ('PIX', 'TRANSFERENCIA', 'DINHEIRO', 'OUTRO')),
      competence_month TEXT NOT NULL,
      notes TEXT,
      created_by_user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_settlements_month ON expense_settlements(competence_month);

    -- 12. Agenda All-Day Events & Reminders Table
    CREATE TABLE IF NOT EXISTS agenda_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'REMINDER' CHECK(event_type IN ('HOLIDAY', 'REMINDER', 'FINANCIAL', 'OTHER')),
      expense_id INTEGER,
      amount REAL,
      status TEXT DEFAULT 'PENDING',
      payment_date DATE,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (expense_id) REFERENCES expenses(id)
    );

    -- 13. Clinic Settings
    CREATE TABLE IF NOT EXISTS clinic_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_name TEXT NOT NULL DEFAULT 'PsicoGestão',
      cnpj TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      logo_base64 TEXT,
      accounting_info_json TEXT,
      default_session_price REAL DEFAULT 180.00,
      default_evaluation_price REAL DEFAULT 2400.00,
      pix_key TEXT,
      pix_key_type TEXT DEFAULT 'CPF',
      pix_beneficiary TEXT,
      bank_info TEXT,
      repasse_enabled INTEGER NOT NULL DEFAULT 1,
      operating_mode TEXT DEFAULT 'ENTERPRISE_CLINIC',
      reception_tower_enabled INTEGER NOT NULL DEFAULT 1,
      rooms_enabled INTEGER NOT NULL DEFAULT 1,
      collaborators_enabled INTEGER NOT NULL DEFAULT 1,
      waiting_tv_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 14. Invoices (Notas Fiscais)
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      psychologist_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'REQUESTED',
      total_amount REAL NOT NULL,
      invoice_number TEXT,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      issued_at DATETIME,
      file_name TEXT,
      file_size INTEGER,
      file_type TEXT,
      file_data TEXT,
      hash_sha256 TEXT,
      notes TEXT,
      emission_mode TEXT DEFAULT 'MANUAL',
      gateway_reference_id TEXT,
      rps_number INTEGER,
      rps_series TEXT,
      xml_data TEXT,
      error_details TEXT,
      cancellation_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (psychologist_id) REFERENCES users(id)
    );

    -- 15. Invoice Items (Sessões ou Itens de Avaliação vinculados à NF)
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      session_id INTEGER,
      evaluation_id INTEGER,
      transaction_id INTEGER,
      item_type TEXT DEFAULT 'SESSION',
      item_description TEXT,
      session_date DATETIME NOT NULL,
      session_price REAL NOT NULL,
      is_future_reimbursement INTEGER DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (evaluation_id) REFERENCES neuropsych_evaluations(id),
      FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id)
    );

    -- 16. Neuropsychological Evaluations (Avaliações Neuropsicológicas e Laudos Fechados)
    CREATE TABLE IF NOT EXISTS neuropsych_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      psychologist_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN ('IN_PROGRESS', 'AWAITING_DEVOLUTIVA', 'COMPLETED', 'CANCELED')),
      estimated_sessions INTEGER NOT NULL DEFAULT 6,
      total_price REAL NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'PARCELADO' CHECK(payment_mode IN ('A_VISTA', 'PARCELADO')),
      hypothesis_diagnosis TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (psychologist_id) REFERENCES users(id)
    );

    -- 17. Repasse Batches (Lotes de Fechamento de Repasse de Honorários)
    CREATE TABLE IF NOT EXISTS repasse_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_number TEXT UNIQUE NOT NULL,
      psychologist_id INTEGER NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED', 'PAID')),
      total_sessions_count INTEGER NOT NULL DEFAULT 0,
      gross_total_amount REAL NOT NULL DEFAULT 0.0,
      repasse_subtotal REAL NOT NULL DEFAULT 0.0,
      deductions_amount REAL NOT NULL DEFAULT 0.0,
      additions_amount REAL NOT NULL DEFAULT 0.0,
      net_repasse_amount REAL NOT NULL DEFAULT 0.0,
      notes TEXT,
      closed_at DATETIME,
      closed_by_user_id INTEGER,
      paid_at DATETIME,
      paid_by_user_id INTEGER,
      payment_date DATE,
      payment_method TEXT DEFAULT 'PIX',
      expense_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (psychologist_id) REFERENCES users(id),
      FOREIGN KEY (closed_by_user_id) REFERENCES users(id),
      FOREIGN KEY (paid_by_user_id) REFERENCES users(id),
      FOREIGN KEY (expense_id) REFERENCES expenses(id)
    );

    -- 18. Repasse Batch Items (Itens / Sessões Congeladas no Lote)
    CREATE TABLE IF NOT EXISTS repasse_batch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      session_id INTEGER,
      evaluation_id INTEGER,
      patient_id INTEGER NOT NULL,
      service_type TEXT NOT NULL,
      service_date DATE NOT NULL,
      gross_amount REAL NOT NULL,
      repasse_rate REAL NOT NULL,
      repasse_amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES repasse_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (evaluation_id) REFERENCES neuropsych_evaluations(id),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    -- 19. Repasse Adjustments (Deduções e Bônus do Lote)
    CREATE TABLE IF NOT EXISTS repasse_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('DEDUCTION', 'ADDITION')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES repasse_batches(id) ON DELETE CASCADE
    );

    -- 20. Billing Contacts & Audit (Histórico de Cobrança, WhatsApp, Ligações e Acordos de Pagamento)
    CREATE TABLE IF NOT EXISTS billing_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      evaluation_id INTEGER,
      contact_channel TEXT NOT NULL DEFAULT 'WHATSAPP' CHECK(contact_channel IN ('WHATSAPP', 'COPIED_TEXT', 'PHONE', 'EMAIL', 'MANUAL_NOTE')),
      recipient_type TEXT NOT NULL DEFAULT 'PATIENT' CHECK(recipient_type IN ('PATIENT', 'FINANCIAL_RESPONSIBLE', 'LEGAL_GUARDIAN', 'OTHER')),
      recipient_name TEXT,
      recipient_phone TEXT,
      template_type TEXT,
      message_preview TEXT,
      agreement_date TEXT,
      agreement_notes TEXT,
      created_by_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (evaluation_id) REFERENCES neuropsych_evaluations(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_billing_contacts_patient ON billing_contacts(patient_id);
    CREATE INDEX IF NOT EXISTS idx_billing_contacts_eval ON billing_contacts(evaluation_id);
    CREATE INDEX IF NOT EXISTS idx_billing_contacts_created_at ON billing_contacts(created_at);

    -- 21. Clinic Gateway Settings (Asaas - Cobrança Inteligente & Conciliação Automática)
    CREATE TABLE IF NOT EXISTS clinic_gateway_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'ASAAS' CHECK(provider IN ('ASAAS')),
      is_active INTEGER NOT NULL DEFAULT 0,
      environment TEXT NOT NULL DEFAULT 'SANDBOX' CHECK(environment IN ('SANDBOX', 'PRODUCTION')),
      api_key_encrypted TEXT,
      webhook_token TEXT,
      default_due_days INTEGER DEFAULT 3,
      fine_percentage REAL DEFAULT 0.0,
      interest_percentage REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clinic_id) REFERENCES clinic_settings(id)
    );
    -- 22. Synapsis Academy: Progresso e Contador de Repetições dos Treinamentos
    CREATE TABLE IF NOT EXISTS user_academy_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tour_id TEXT NOT NULL,
      category TEXT NOT NULL,
      completed_count INTEGER DEFAULT 1,
      status TEXT DEFAULT 'COMPLETED',
      last_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, tour_id)
    );
    CREATE INDEX IF NOT EXISTS idx_academy_user ON user_academy_progress(user_id);

    -- 23. Synapsis Paciente: Tokens OTP de Acesso (WhatsApp / SMS)
    CREATE TABLE IF NOT EXISTS patient_auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      phone_used TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_patient_auth_tokens_code ON patient_auth_tokens(otp_code, expires_at);

    -- 24. Synapsis Paciente: Credenciais de Desbloqueio por PIN
    CREATE TABLE IF NOT EXISTS patient_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL UNIQUE,
      pin_hash TEXT,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until DATETIME,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    -- 25. Synapsis Paciente: Mensageria em Duas Vias (Recepção e Clínico)
    CREATE TABLE IF NOT EXISTS patient_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      channel_type TEXT NOT NULL CHECK(channel_type IN ('ADMINISTRATIVE', 'CLINICAL')),
      sender_type TEXT NOT NULL CHECK(sender_type IN ('PATIENT', 'RECEPTION', 'PSYCHOLOGIST')),
      sender_user_id INTEGER,
      message_text TEXT NOT NULL,
      attachment_url TEXT,
      attachment_name TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_patient_messages_patient ON patient_messages(patient_id, channel_type);

    -- 26. Synapsis Paciente: Atividades, Diários e Escalas Atribuídas
    CREATE TABLE IF NOT EXISTS patient_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      psychologist_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      activity_type TEXT NOT NULL CHECK(activity_type IN ('DIARY', 'SCALE_PHQ9', 'SCALE_GAD7', 'HOMEWORK')),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'COMPLETED', 'EXPIRED')),
      response_json TEXT,
      due_date DATE,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (psychologist_id) REFERENCES users(id)
    );

    -- 27. Convênios & Operadoras de Saúde (Fase 1)
    CREATE TABLE IF NOT EXISTS health_insurances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      ans_code TEXT,
      cnpj TEXT,
      payment_deadline_days INTEGER DEFAULT 30,
      submission_cut_day INTEGER DEFAULT 25,
      status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
      repasse_default_mode TEXT DEFAULT 'FIXED' CHECK(repasse_default_mode IN ('FIXED', 'PERCENTAGE')),
      repasse_default_value REAL DEFAULT 50.0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_health_insurances_clinic ON health_insurances(clinic_id);

    -- 28. Catálogo TUSS Multidisciplinar (ANS)
    CREATE TABLE IF NOT EXISTS tuss_procedures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('PSICOLOGIA', 'NEUROPSICOLOGIA', 'FONOAUDIOLOGIA', 'TERAPIA_OCUPACIONAL', 'PSIQUIATRIA', 'OUTROS')),
      standard_session_minutes INTEGER DEFAULT 50,
      default_suggested_price REAL DEFAULT 150.00,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tuss_code ON tuss_procedures(code);

    -- 29. Tabela de Preços e Prazos por Operadora
    CREATE TABLE IF NOT EXISTS health_insurance_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      insurance_id INTEGER NOT NULL,
      tuss_id INTEGER NOT NULL,
      agreed_price REAL NOT NULL,
      copay_price REAL DEFAULT 0.00,
      repasse_fixed_amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (insurance_id) REFERENCES health_insurances(id) ON DELETE CASCADE,
      FOREIGN KEY (tuss_id) REFERENCES tuss_procedures(id) ON DELETE CASCADE,
      UNIQUE(insurance_id, tuss_id)
    );

    -- 30. Autorizações e Guias dos Pacientes (Saldo Regressivo & Preditivo)
    CREATE TABLE IF NOT EXISTS patient_authorizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER DEFAULT 1,
      patient_id INTEGER NOT NULL,
      insurance_id INTEGER NOT NULL,
      tuss_id INTEGER,
      card_number TEXT NOT NULL,
      card_validity TEXT,
      plan_name TEXT,
      guide_number TEXT NOT NULL,
      auth_date DATE,
      valid_until DATE NOT NULL,
      total_sessions_authorized INTEGER NOT NULL,
      executed_sessions_count INTEGER NOT NULL DEFAULT 0,
      doctor_referral_crm TEXT,
      doctor_referral_name TEXT,
      doctor_referral_cid TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELED')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (insurance_id) REFERENCES health_insurances(id),
      FOREIGN KEY (tuss_id) REFERENCES tuss_procedures(id)
    );
    CREATE INDEX IF NOT EXISTS idx_patient_auth_patient ON patient_authorizations(patient_id);
    CREATE INDEX IF NOT EXISTS idx_patient_auth_status ON patient_authorizations(status);
  `);
}

function migrateTables(db: any) {
  try {
    const isCleanMode = process.env.APP_MODE === 'clean' || process.env.SEED_DEMO_DATA === 'false';
    // 0. Ensure roles and permissions tables exist for migration
    db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        is_system INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );
      CREATE TABLE IF NOT EXISTS clinic_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_name TEXT NOT NULL DEFAULT 'PsicoGestão',
        cnpj TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        logo_base64 TEXT,
        accounting_info_json TEXT,
        default_session_price REAL DEFAULT 180.00,
        default_evaluation_price REAL DEFAULT 2400.00,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id),
        FOREIGN KEY (permission_id) REFERENCES permissions(id)
      );
    `);

    // Ensure auth_tokens table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        token_type TEXT NOT NULL CHECK(token_type IN ('INVITE', 'RESET')),
        expires_at DATETIME NOT NULL,
        used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Ensure security columns exist on users
    const usersTableInfo = db.exec("PRAGMA table_info(users);");
    if (usersTableInfo.length > 0 && usersTableInfo[0].values) {
      const usersCols = usersTableInfo[0].values.map((row: any[]) => row[1]);
      if (!usersCols.includes('role_id')) {
        db.exec("ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id);");
      }
      if (!usersCols.includes('status')) {
        db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE';");
      }
      if (!usersCols.includes('failed_login_attempts')) {
        db.exec("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;");
      }
      if (!usersCols.includes('locked_until')) {
        db.exec("ALTER TABLE users ADD COLUMN locked_until DATETIME;");
      }
      if (!usersCols.includes('token_version')) {
        db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1;");
      }
    }

    const tableInfo = db.exec("PRAGMA table_info(patients);");
    if (tableInfo.length > 0 && tableInfo[0].values) {
      // Check if cpf has NOT NULL constraint (notnull === 1)
      const cpfCol = tableInfo[0].values.find((row: any[]) => row[1] === 'cpf');
      if (cpfCol && cpfCol[3] === 1) {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE patients_mig_tmp AS SELECT * FROM patients;
          DROP TABLE patients;
          CREATE TABLE patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            psychologist_id INTEGER,
            full_name TEXT NOT NULL,
            cpf TEXT,
            phone TEXT,
            status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'DISCHARGED')),
            lgpd_consent_at DATETIME NOT NULL,
            birth_date TEXT,
            email TEXT,
            notes_basic TEXT,
            group_type TEXT NOT NULL DEFAULT 'Adulto' CHECK(group_type IN ('Criança', 'Adolescente', 'Adulto', 'Idoso')),
            rg TEXT,
            gender TEXT,
            financial_plan_type TEXT NOT NULL DEFAULT 'Por Sessão' CHECK(financial_plan_type IN ('Por Sessão', 'Mensal', 'Convênio', 'Isento')),
            session_price REAL NOT NULL DEFAULT 180.00,
            address_json TEXT,
            emergency_contacts_json TEXT,
            birthplace TEXT,
            education TEXT,
            race TEXT,
            profession TEXT,
            guardian_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (psychologist_id) REFERENCES users(id)
          );
          INSERT INTO patients SELECT * FROM patients_mig_tmp;
          DROP TABLE patients_mig_tmp;
          PRAGMA foreign_keys = ON;
        `);
      }

      const refreshedInfo = db.exec("PRAGMA table_info(patients);");
      const existingCols = (refreshedInfo.length > 0 && refreshedInfo[0].values)
        ? refreshedInfo[0].values.map((row: any[]) => row[1])
        : [];
      const columnsToAdd = [
        { name: 'group_type', def: "TEXT DEFAULT 'Adulto'" },
        { name: 'rg', def: "TEXT" },
        { name: 'gender', def: "TEXT" },
        { name: 'financial_plan_type', def: "TEXT DEFAULT 'Por Sessão'" },
        { name: 'session_price', def: "REAL DEFAULT 180.00" },
        { name: 'address_json', def: "TEXT" },
        { name: 'emergency_contacts_json', def: "TEXT" },
        { name: 'birthplace', def: "TEXT" },
        { name: 'education', def: "TEXT" },
        { name: 'race', def: "TEXT" },
        { name: 'profession', def: "TEXT" },
        { name: 'guardian_json', def: "TEXT" },
        { name: 'financial_responsible_json', def: "TEXT" },
        { name: 'whatsapp_routing_json', def: "TEXT" },
      ];

      for (const col of columnsToAdd) {
        if (!existingCols.includes(col.name)) {
          db.exec(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.def};`);
        }
      }
    }

    // Sessions table migrations for recurrence
    const sessTableInfo = db.exec("PRAGMA table_info(sessions);");
    if (sessTableInfo.length > 0 && sessTableInfo[0].values) {
      const sessCols = sessTableInfo[0].values.map((row: any[]) => row[1]);
      if (!sessCols.includes('recurrence_group_id')) {
        db.exec("ALTER TABLE sessions ADD COLUMN recurrence_group_id TEXT;");
      }
      if (!sessCols.includes('recurrence_pattern')) {
        db.exec("ALTER TABLE sessions ADD COLUMN recurrence_pattern TEXT;");
      }
      if (!sessCols.includes('cancellation_reason')) {
        db.exec("ALTER TABLE sessions ADD COLUMN cancellation_reason TEXT;");
      }
    }

    // Check if initial patients need structured data migration
    const p1 = db.exec("SELECT id, group_type, address_json FROM patients WHERE id = 1;");
    if (p1.length > 0 && p1[0].values && p1[0].values.length > 0) {
      const row = p1[0].values[0];
      if (!row[1] || !row[2]) {
        db.run(`
          UPDATE patients SET
            group_type = 'Adulto',
            cpf = '111.444.777-35',
            phone = '(11) 98765-4321',
            rg = '38.492.103-8',
            gender = 'Homem cisgênero',
            financial_plan_type = 'Por Sessão',
            session_price = 200.00,
            birthplace = 'São Paulo - SP',
            education = 'Ensino Superior Completo',
            race = 'Branca',
            profession = 'Analista de Sistemas',
            address_json = ?,
            emergency_contacts_json = ?
          WHERE id = 1
        `, [
          JSON.stringify({
            cep: '01310-100',
            street: 'Avenida Paulista',
            number: '1578',
            complement: 'Apto 82',
            neighborhood: 'Bela Vista',
            city: 'São Paulo',
            state: 'SP'
          }),
          JSON.stringify([
            { fullName: 'Carla Silveira Ferreira', relationship: 'Cônjuge', phone: '(11) 98123-4567' },
            { fullName: 'Antônio Carlos Ferreira', relationship: 'Pai', phone: '(11) 97234-5678' }
          ])
        ]);
      }
    }

    const p2 = db.exec("SELECT id, address_json FROM patients WHERE id = 2;");
    if (p2.length > 0 && p2[0].values && p2[0].values.length > 0) {
      const row = p2[0].values[0];
      if (!row[1]) {
        db.run(`
          UPDATE patients SET
            group_type = 'Adulto',
            cpf = '222.555.888-46',
            phone = '(11) 97654-3210',
            rg = '42.189.765-1',
            gender = 'Mulher cisgênero',
            financial_plan_type = 'Mensal',
            session_price = 220.00,
            birthplace = 'Campinas - SP',
            education = 'Pós-graduação / Especialização',
            race = 'Parda',
            profession = 'Gerente de Recursos Humanos',
            address_json = ?,
            emergency_contacts_json = ?
          WHERE id = 2
        `, [
          JSON.stringify({
            cep: '04538-133',
            street: 'Rua Joaquim Floriano',
            number: '466',
            complement: 'Conj 501',
            neighborhood: 'Itaim Bibi',
            city: 'São Paulo',
            state: 'SP'
          }),
          JSON.stringify([
            { fullName: 'Renata Souza Alves', relationship: 'Irmã', phone: '(11) 99887-1122' },
            { fullName: 'Carlos Eduardo Alves', relationship: 'Pai', phone: '(11) 98776-3344' }
          ])
        ]);
      }
    }

    const p3 = db.exec("SELECT id, address_json FROM patients WHERE id = 3;");
    if (p3.length > 0 && p3[0].values && p3[0].values.length > 0) {
      const row = p3[0].values[0];
      if (!row[1]) {
        db.run(`
          UPDATE patients SET
            full_name = 'Pedro Henrique Lima',
            group_type = 'Criança',
            birth_date = '2017-08-10',
            cpf = '333.666.999-57',
            phone = '(11) 99112-2334',
            rg = '58.321.490-X',
            gender = 'Homem cisgênero',
            financial_plan_type = 'Convênio',
            session_price = 190.00,
            birthplace = 'São Paulo - SP',
            education = 'Ensino Fundamental Incompleto',
            race = 'Branca',
            profession = 'Estudante',
            address_json = ?,
            emergency_contacts_json = ?,
            guardian_json = ?
          WHERE id = 3
        `, [
          JSON.stringify({
            cep: '05407-002',
            street: 'Rua Cardeal Arcoverde',
            number: '1200',
            complement: 'Casa 2',
            neighborhood: 'Pinheiros',
            city: 'São Paulo',
            state: 'SP'
          }),
          JSON.stringify([
            { fullName: 'Juliana Lima', relationship: 'Mãe', phone: '(11) 99112-2334' },
            { fullName: 'Marcelo Lima', relationship: 'Pai', phone: '(11) 98223-3445' }
          ]),
          JSON.stringify({
            fullName: 'Juliana Lima',
            email: 'juliana.lima@exemplo.com.br',
            phone: '(11) 99112-2334',
            cpf: '111.444.777-35',
            rg: '29.845.123-4',
            birthDate: '1986-08-24'
          })
        ]);
      }
    }

    // Ensure patient_documents table exists and populate sample clinical documents if empty
    db.exec(`
      CREATE TABLE IF NOT EXISTS patient_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        psychologist_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        document_type TEXT,
        content_json TEXT NOT NULL,
        file_name TEXT,
        file_size INTEGER,
        file_type TEXT,
        file_data TEXT,
        hash_sha256 TEXT,
        is_signed INTEGER NOT NULL DEFAULT 1,
        signed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (psychologist_id) REFERENCES users(id)
      );
    `);

    const docCountRes = db.exec("SELECT count(*) FROM patient_documents;");
    const count = docCountRes.length > 0 && docCountRes[0].values ? docCountRes[0].values[0][0] : 0;
    if (count === 0 && !isCleanMode) {
      // 1. Anamnese Clínica Lucas
      const anamneseLucas = JSON.stringify({
        queixa_principal: 'Crises frequentes de ansiedade com taquicardia, sudorese e sensação de sufocamento durante reuniões de liderança.',
        historico_sintomas: 'Sintomas iniciados há aproximadamente 8 meses após promoção profissional a gestor de equipe técnica. Piora progressiva com estresse.',
        antecedentes_pessoais: 'Nega histórico de comorbidades clínicas severas ou uso prévio de psicotrópicos. Fez psicoterapia breve aos 22 anos.',
        antecedentes_familiares: 'Mãe com histórico de transtorno depressivo maior tratado ambulatorialmente. Vínculos familiares descritos como saudáveis.',
        rotina_habitos: 'Sono fragmentado (5h/noite), alta ingestão de cafeína (>4 xícaras/dia). Sedentário.',
        hipoteses_diagnosticas: 'Hipótese diagnóstica inicial: Transtorno de Ansiedade Generalizada (F41.1) com episódios de pânico situacionais.',
        objetivos_terapeuticos: 'Psicoeducação em ansiedade, reestruturação cognitiva de crenças de incompetência e treino respiratório/relaxamento.'
      });
      const hashAnamnese = generateSHA256(anamneseLucas + ' - CRP 06/128945-SP');
      db.run(`
        INSERT INTO patient_documents (patient_id, psychologist_id, title, category, document_type, content_json, hash_sha256, is_signed, signed_at)
        VALUES (1, 1, 'Anamnese Clínica Inicial', 'ANAMNESE', 'ANAMNESE', ?, ?, 1, '2026-01-15 10:30:00');
      `, [anamneseLucas, hashAnamnese]);

      // 2. Encaminhamento Psiquiátrico Lucas
      const encLucas = JSON.stringify({
        especialidade_destino: 'Psiquiatria Clínica',
        profissional_destino: 'Dr(a). Médico(a) Psiquiatra',
        motivo_encaminhamento: 'Avaliação da necessidade de suporte farmacológico complementar ao processo psicoterápico em curso.',
        sintese_caso: 'Paciente em psicoterapia cognitivo-comportamental semanal devido a quadro ansiogênico intenso com impacto no sono e rotina laboral.',
        solicitacao: 'Solicito avaliação psiquiátrica quanto à conveniência de introdução de ansiolítico/antidepressivo, mantendo canal aberto para acompanhamento interdisciplinar.'
      });
      const hashEnc = generateSHA256(encLucas + ' - CRP 06/128945-SP');
      db.run(`
        INSERT INTO patient_documents (patient_id, psychologist_id, title, category, document_type, content_json, hash_sha256, is_signed, signed_at)
        VALUES (1, 1, 'Encaminhamento para Avaliação Psiquiátrica', 'ENCAMINHAMENTO', 'ENCAMINHAMENTO', ?, ?, 1, '2026-02-10 11:00:00');
      `, [encLucas, hashEnc]);

      // 3. Declaração CFP Lucas
      const declLucas = JSON.stringify({
        identificacao: 'Psicólogo Dr. Marcos Silveira (CRP 06/128945-SP). Paciente: Lucas Gabriel Ferreira, CPF 111.444.777-35.',
        demanda: 'Solicitação do paciente para comprovação de acompanhamento psicoterápico para fins de adequação de escala de trabalho.',
        procedimento: 'Atendimento clínico continuado semanal de abordagem Cognitivo-Comportamental.',
        analise: 'O paciente demonstra assiduidade e compromisso com o projeto terapêutico, desenvolvendo estratégias funcionais de enfrentamento.',
        conclusao: 'Declara-se, para os devidos fins, que o paciente supracitado encontra-se sob acompanhamento psicológico regular neste consultório.'
      });
      const hashDecl = generateSHA256(declLucas + ' - CRP 06/128945-SP');
      db.run(`
        INSERT INTO patient_documents (patient_id, psychologist_id, title, category, document_type, content_json, hash_sha256, is_signed, signed_at)
        VALUES (1, 1, 'Declaração de Comparecimento e Tratamento Psicológico', 'DECLARACAO', 'DECLARACAO', ?, ?, 1, '2026-02-28 17:00:00');
      `, [declLucas, hashDecl]);

      // 4. Anamnese Infantil Enzo Gabriel
      const anamneseEnzo = JSON.stringify({
        queixa_principal: 'Dificuldade de sustentação atencional, inquietação motora e episódios de impulsividade em ambiente escolar relatados pelos professores.',
        historico_sintomas: 'Sintomas percebidos com maior intensidade na transição para o ensino fundamental. Criança afetuosa e criativa, porém dispersa facilmente.',
        antecedentes_pessoais: 'Nascido de parto cesárea sem complicações perinatais. Marcos de marcha e linguagem no tempo esperado.',
        antecedentes_familiares: 'Tio paterno diagnosticado na fase adulta com TDAH. Dinâmica familiar acolhedora.',
        rotina_habitos: 'Exposição excessiva a telas e smartphones antes de dormir. Boa alimentação.',
        hipoteses_diagnosticas: 'Investigação diagnóstica para Transtorno do Déficit de Atenção com Hiperatividade (TDAH - CID-11 6A05).',
        objetivos_terapeuticos: 'Psicoterapia lúdica, treino de autorregulação e orientação parental para manejo de rotinas.'
      });
      const hashEnzo = generateSHA256(anamneseEnzo + ' - CRP 06/128945-SP');
      db.run(`
        INSERT INTO patient_documents (patient_id, psychologist_id, title, category, document_type, content_json, hash_sha256, is_signed, signed_at)
        VALUES (3, 1, 'Anamnese Psicológica Infantil & Escolar', 'ANAMNESE', 'ANAMNESE', ?, ?, 1, '2026-02-20 09:30:00');
      `, [anamneseEnzo, hashEnzo]);

      // 5. Encaminhamento Neuropsicológico Enzo
      const encEnzo = JSON.stringify({
        especialidade_destino: 'Neuropsicologia Infantil',
        profissional_destino: 'Especialista em Avaliação Neuropsicológica',
        motivo_encaminhamento: 'Investigação aprofundada do perfil neuropsicológico atencional e das funções executivas da criança.',
        sintese_caso: 'Criança de 8 anos com queixas de desatenção sustentada e impulsividade com impacto no rendimento escolar.',
        solicitacao: 'Aplicação de bateria neuropsicológica padronizada para mapeamento cognitivo e subsídios para intervenção multidisciplinar.'
      });
      const hashEncEnzo = generateSHA256(encEnzo + ' - CRP 06/128945-SP');
      db.run(`
        INSERT INTO patient_documents (patient_id, psychologist_id, title, category, document_type, content_json, hash_sha256, is_signed, signed_at)
        VALUES (3, 1, 'Encaminhamento para Avaliação Neuropsicológica', 'ENCAMINHAMENTO', 'ENCAMINHAMENTO', ?, ?, 1, '2026-03-01 10:00:00');
      `, [encEnzo, hashEncEnzo]);
    }

    // 11. Expenses Table (Despesas e Contas do Consultório)
    db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        psychologist_id INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'OUTROS',
        amount REAL NOT NULL,
        due_date DATE NOT NULL,
        payment_date DATE,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELED')),
        payment_method TEXT CHECK(payment_method IN ('PIX', 'BOLETO', 'CARTAO', 'TRANSFERENCIA', 'DINHEIRO', 'DEBITO_AUTOMATICO')),
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurrence_period TEXT DEFAULT 'MONTHLY',
        recurrence_group_id TEXT,
        installment_number INTEGER,
        installments_total INTEGER,
        carne_leao_deductible INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (psychologist_id) REFERENCES users(id)
      );
    `);

    // 12. Agenda All-Day Events & Reminders Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agenda_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        event_type TEXT NOT NULL DEFAULT 'REMINDER' CHECK(event_type IN ('HOLIDAY', 'REMINDER', 'FINANCIAL', 'OTHER')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure columns exist on agenda_events
    const agendaColsInfo = db.exec("PRAGMA table_info(agenda_events);");
    if (agendaColsInfo.length > 0 && agendaColsInfo[0].values) {
      const existingAgendaCols = agendaColsInfo[0].values.map((r: any[]) => r[1]);
      if (!existingAgendaCols.includes('expense_id')) {
        db.exec("ALTER TABLE agenda_events ADD COLUMN expense_id INTEGER;");
      }
      if (!existingAgendaCols.includes('amount')) {
        db.exec("ALTER TABLE agenda_events ADD COLUMN amount REAL;");
      }
      if (!existingAgendaCols.includes('status')) {
        db.exec("ALTER TABLE agenda_events ADD COLUMN status TEXT DEFAULT 'PENDING';");
      }
      if (!existingAgendaCols.includes('payment_date')) {
        db.exec("ALTER TABLE agenda_events ADD COLUMN payment_date DATE;");
      }
      if (!existingAgendaCols.includes('category')) {
        db.exec("ALTER TABLE agenda_events ADD COLUMN category TEXT;");
      }
    }

    // Seed sample expenses if empty
    const existingExpenses = db.exec("SELECT count(*) FROM expenses;");
    if ((existingExpenses.length === 0 || !existingExpenses[0].values || Number(existingExpenses[0].values[0][0]) === 0) && !isCleanMode) {
      db.run(`
        INSERT INTO expenses (psychologist_id, title, category, amount, due_date, payment_date, status, payment_method, is_recurring, recurrence_period, recurrence_group_id, installment_number, installments_total, carne_leao_deductible, notes)
        VALUES 
        (1, 'Aluguel do Consultório (Sala Clínica)', 'ALUGUEL', 1800.00, '2026-09-10', NULL, 'PENDING', 'PIX', 1, 'MONTHLY', 'rec_aluguel_2026', 9, 12, 1, 'Locação de sala para consultório clínico. Dedutível no Carnê-Leão.'),
        (1, 'Energia Elétrica (Enel)', 'UTILIDADES', 195.50, '2026-09-10', '2026-09-09', 'PAID', 'DEBITO_AUTOMATICO', 1, 'MONTHLY', 'rec_energia_2026', 9, 12, 1, 'Consumo elétrico do consultório. Pago via débito automático.'),
        (1, 'Internet Fibra & Telefonia', 'TELECOMUNICACOES', 139.90, '2026-09-15', NULL, 'PENDING', 'BOLETO', 1, 'MONTHLY', 'rec_internet_2026', 9, 12, 1, 'Conexão para prontuário eletrônico e telepsicoterapia.'),
        (1, 'Assessoria Contábil Especializada', 'SERVICOS_PROFISSIONAIS', 350.00, '2026-09-20', NULL, 'PENDING', 'PIX', 1, 'MONTHLY', 'rec_contabil_2026', 9, 12, 1, 'Apuração mensal do Livro-Caixa e Carnê-Leão da Receita Federal.'),
        (1, 'Anuidade CRP/06 (Parcela 04/05)', 'CRP_CONSELHO', 180.00, '2026-09-25', NULL, 'PENDING', 'BOLETO', 1, 'MONTHLY', 'rec_crp_2026', 4, 5, 1, 'Anuidade profissional do Conselho Regional de Psicologia.'),
        (1, 'Plataforma PsicoGestão SaaS', 'SISTEMAS_SOFTWARE', 99.00, '2026-09-05', '2026-09-05', 'PAID', 'CARTAO', 1, 'MONTHLY', 'rec_software_2026', 9, 12, 1, 'Assinatura do prontuário e gestão clínica.'),
        (1, 'Bateria de Protocolos de Testes Psicológicos', 'MATERIAIS_TESTES', 240.00, '2026-09-08', '2026-09-08', 'PAID', 'PIX', 0, NULL, NULL, NULL, NULL, 1, 'Manuais e folhas de resposta para avaliação psicológica.');
      `);

      // Clean up previous placeholder duplicate events and insert synchronized events
      db.run("DELETE FROM agenda_events WHERE event_type = 'FINANCIAL' OR title LIKE '%Aluguel%' OR title LIKE '%Energia%';");

      // Insert fresh synchronized agenda events for expenses
      const createdExpenses = db.exec("SELECT id, title, category, amount, due_date, payment_date, status FROM expenses;");
      if (createdExpenses.length > 0 && createdExpenses[0].values) {
        for (const exp of createdExpenses[0].values) {
          const [expId, expTitle, expCat, expAmount, expDueDate, expPaidDate, expStatus] = exp;
          db.run(`
            INSERT INTO agenda_events (date, title, event_type, expense_id, amount, status, payment_date, category)
            VALUES (?, ?, 'FINANCIAL', ?, ?, ?, ?, ?);
          `, [expDueDate, `${expTitle} 💵`, expId, expAmount, expStatus, expPaidDate, expCat]);
        }
      }
    }

    // Ensure non-financial reminders/holidays exist
    const holidayCount = db.exec("SELECT count(*) FROM agenda_events WHERE event_type = 'HOLIDAY';");
    if (holidayCount.length === 0 || !holidayCount[0].values || Number(holidayCount[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO agenda_events (date, title, event_type) VALUES
        ('2026-09-07', 'Independência do Brasil 🏳️', 'HOLIDAY');
      `);
    }
    const reminderCount = db.exec("SELECT count(*) FROM agenda_events WHERE title LIKE '%Convênios%';");
    if (reminderCount.length === 0 || !reminderCount[0].values || Number(reminderCount[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO agenda_events (date, title, event_type) VALUES
        ('2026-09-10', 'Fechamento de Convênios 📋', 'REMINDER');
      `);
    }

    // Ensure sample patients exist for realistic agenda display
    const checkPatient = db.exec("SELECT count(*) FROM patients WHERE full_name LIKE '%Lucas Gabriel Silveira%';");
    if ((checkPatient.length === 0 || !checkPatient[0].values || Number(checkPatient[0].values[0][0]) === 0) && !isCleanMode) {
      const samplePatients = [
        ['Lucas Gabriel Silveira', '401.293.847-10', '(11) 98112-9901', 'Adulto', 200.0],
        ['Mariana Souza Santos', '402.384.912-20', '(11) 98223-8812', 'Adulto', 200.0],
        ['Pedro Henrique Lima', '403.475.023-30', '(11) 98334-7723', 'Criança', 190.0],
        ['Beatriz Mendes Alencar', '404.566.134-40', '(11) 98445-6634', 'Adolescente', 200.0],
        ['Carlos Eduardo Rocha', '405.657.245-50', '(11) 98556-5545', 'Adulto', 220.0],
        ['Fernanda Oliveira Costa', '406.748.356-60', '(11) 98667-4456', 'Adulto', 200.0],
        ['Gabriel Martins Ferreira', '407.839.467-70', '(11) 98778-3367', 'Adulto', 200.0],
        ['Juliana Castro Ribeiro', '408.920.578-80', '(11) 98889-2278', 'Adulto', 180.0],
        ['Felipe Barbosa Nogueira', '409.011.689-90', '(11) 98990-1189', 'Adulto', 200.0],
        ['Amanda Duarte Guimarães', '410.122.790-01', '(11) 99101-0091', 'Adulto', 220.0],
        ['Thiago Carvalho Freitas', '411.233.801-12', '(11) 99212-9902', 'Adulto', 190.0],
        ['Camila Antunes Moreira', '412.344.912-23', '(11) 99323-8813', 'Adulto', 220.0],
        ['Bruno Azevedo Ramos', '413.455.023-34', '(11) 99434-7724', 'Adulto', 190.0],
        ['Larissa Correia Dias', '414.566.134-45', '(11) 99545-6635', 'Adulto', 200.0],
        ['Rodrigo Cavalcanti Meireles', '415.677.245-56', '(11) 99656-5546', 'Adulto', 200.0],
        ['Letícia Farias Pires', '416.788.356-67', '(11) 99767-4457', 'Adulto', 220.0],
        ['André Monteiro Teles', '417.899.467-78', '(11) 99878-3368', 'Adulto', 200.0],
        ['Natália Cunha Vieira', '418.900.578-89', '(11) 99989-2279', 'Adulto', 200.0],
      ];

      for (const p of samplePatients) {
        db.run(`
          INSERT INTO patients (
            psychologist_id, full_name, cpf, phone, status, lgpd_consent_at, group_type, session_price
          ) VALUES (1, ?, ?, ?, 'ACTIVE', '2026-01-01 10:00:00', ?, ?);
        `, [p[0], p[1], p[2], p[3], p[4]]);
      }
    }

    // Ensure sessions matching screenshot week (06/09 - 12/09) exist
    const checkSessions = db.exec("SELECT count(*) FROM sessions WHERE start_time LIKE '2026-09-07%';");
    if ((checkSessions.length === 0 || !checkSessions[0].values || Number(checkSessions[0].values[0][0]) === 0) && !isCleanMode) {
      // Map names to ids
      const pts = db.exec("SELECT id, full_name FROM patients;");
      const ptMap: { [name: string]: number } = {};
      if (pts.length > 0 && pts[0].values) {
        for (const row of pts[0].values) {
          ptMap[String(row[1])] = Number(row[0]);
        }
      }

      const agendaSlots = [
        // SEG 07/09
        { name: 'Lucas Gabriel Silveira', start: '2026-09-07T08:00:00', end: '2026-09-07T08:50:00', status: 'CONFIRMED', modality: 'PRESENTIAL', price: 200, paid: true },
        { name: 'Mariana Souza Santos', start: '2026-09-07T08:50:00', end: '2026-09-07T09:40:00', status: 'CONFIRMED', modality: 'PRESENTIAL', price: 200, paid: true },
        { name: 'Pedro Henrique Lima', start: '2026-09-07T09:40:00', end: '2026-09-07T10:30:00', status: 'CANCELED', modality: 'PRESENTIAL', price: 190, paid: false },
        { name: 'Beatriz Mendes Alencar', start: '2026-09-07T10:30:00', end: '2026-09-07T11:20:00', status: 'CANCELED', modality: 'PRESENTIAL', price: 200, paid: false },

        // TER 08/09
        { name: 'Carlos Eduardo Rocha', start: '2026-09-08T07:40:00', end: '2026-09-08T08:30:00', status: 'CONFIRMED', modality: 'ONLINE', price: 220, paid: true },
        { name: 'Fernanda Oliveira Costa', start: '2026-09-08T08:30:00', end: '2026-09-08T09:30:00', status: 'CONFIRMED', modality: 'PRESENTIAL', price: 200, paid: true },
        { name: 'Gabriel Martins Ferreira', start: '2026-09-08T09:40:00', end: '2026-09-08T10:30:00', status: 'CONFIRMED', modality: 'PRESENTIAL', price: 200, paid: true },
        { name: 'Juliana Castro Ribeiro', start: '2026-09-08T10:30:00', end: '2026-09-08T11:20:00', status: 'CANCELED', modality: 'PRESENTIAL', price: 180, paid: false },

        // QUA 09/09
        { name: 'Felipe Barbosa Nogueira', start: '2026-09-09T07:20:00', end: '2026-09-09T08:10:00', status: 'CONFIRMED', modality: 'PRESENTIAL', price: 200, paid: true },
        { name: 'Amanda Duarte Guimarães', start: '2026-09-09T08:10:00', end: '2026-09-09T09:00:00', status: 'SCHEDULED', modality: 'ONLINE', price: 220, paid: true },
        { name: 'Thiago Carvalho Freitas', start: '2026-09-09T09:50:00', end: '2026-09-09T10:40:00', status: 'CANCELED', modality: 'PRESENTIAL', price: 190, paid: false },

        // QUI 10/09
        { name: 'Camila Antunes Moreira', start: '2026-09-10T07:10:00', end: '2026-09-10T08:00:00', status: 'CONFIRMED', modality: 'ONLINE', price: 220, paid: true },
        { name: 'Bruno Azevedo Ramos', start: '2026-09-10T08:50:00', end: '2026-09-10T09:40:00', status: 'CANCELED', modality: 'PRESENTIAL', price: 190, paid: false },
        { name: 'Larissa Correia Dias', start: '2026-09-10T10:00:00', end: '2026-09-10T10:50:00', status: 'CONFIRMED', modality: 'PRESENTIAL', price: 200, paid: true },

        // SEX 11/09 (Hoje!)
        { name: 'Rodrigo Cavalcanti Meireles', start: '2026-09-11T07:10:00', end: '2026-09-11T08:00:00', status: 'SCHEDULED', modality: 'PRESENTIAL', price: 200, paid: true },
        { name: 'Letícia Farias Pires', start: '2026-09-11T08:00:00', end: '2026-09-11T08:50:00', status: 'SCHEDULED', modality: 'ONLINE', price: 220, paid: true },
        { name: 'André Monteiro Teles', start: '2026-09-11T10:00:00', end: '2026-09-11T10:50:00', status: 'SCHEDULED', modality: 'PRESENTIAL', price: 200, paid: true },
        { name: 'Natália Cunha Vieira', start: '2026-09-11T10:50:00', end: '2026-09-11T11:40:00', status: 'SCHEDULED', modality: 'PRESENTIAL', price: 200, paid: true },
      ];

      for (const slot of agendaSlots) {
        const pId = ptMap[slot.name] || 1;
        db.run(`
          INSERT INTO sessions (psychologist_id, patient_id, start_time, end_time, status, modality, price, notes)
          VALUES (1, ?, ?, ?, ?, ?, ?, 'Sessão Psicoterapia Clínica');
        `, [pId, slot.start, slot.end, slot.status, slot.modality, slot.price]);

        const sessionRow = db.exec("SELECT last_insert_rowid();");
        const newSessionId = sessionRow[0]?.values[0][0];

        db.run(`
          INSERT INTO financial_transactions (patient_id, session_id, amount, status, payment_method, transaction_date)
          VALUES (?, ?, ?, ?, 'PIX', ?);
        `, [pId, newSessionId, slot.price, slot.paid ? 'PAID' : 'PENDING', slot.start.split('T')[0]]);
      }
    }

    // 12. Migration: Ensure recurring future sessions exist for realistic agenda and financial settlement
    const checkRecurring = db.exec("SELECT count(*) FROM sessions WHERE recurrence_group_id IS NOT NULL;");
    if ((checkRecurring.length === 0 || !checkRecurring[0].values || Number(checkRecurring[0].values[0][0]) === 0) && !isCleanMode) {
      const recurringSeries = [
        // Pedro Henrique Lima (patient 3) - Semanal Segundas 09:40 às 10:30
        {
          pId: 3,
          group: 'rec_pedro_01',
          pattern: 'Semanal',
          modality: 'PRESENTIAL',
          price: 200,
          dates: [
            ['2026-09-14T09:40:00', '2026-09-14T10:30:00'],
            ['2026-09-21T09:40:00', '2026-09-21T10:30:00'],
            ['2026-09-28T09:40:00', '2026-09-28T10:30:00'],
            ['2026-10-05T09:40:00', '2026-10-05T10:30:00'],
          ]
        },
        // Beatriz Mendes Alencar (patient 4) - Semanal Segundas 10:30 às 11:20
        {
          pId: 4,
          group: 'rec_beatriz_01',
          pattern: 'Semanal',
          modality: 'PRESENTIAL',
          price: 200,
          dates: [
            ['2026-09-14T10:30:00', '2026-09-14T11:20:00'],
            ['2026-09-21T10:30:00', '2026-09-21T11:20:00'],
            ['2026-09-28T10:30:00', '2026-09-28T11:20:00'],
          ]
        },
        // Lucas Gabriel Silveira (patient 1) - Semanal Segundas 08:00 às 08:50
        {
          pId: 1,
          group: 'rec_lucas_01',
          pattern: 'Semanal',
          modality: 'PRESENTIAL',
          price: 200,
          dates: [
            ['2026-09-14T08:00:00', '2026-09-14T08:50:00'],
            ['2026-09-21T08:00:00', '2026-09-21T08:50:00'],
            ['2026-09-28T08:00:00', '2026-09-28T08:50:00'],
          ]
        },
        // Mariana Souza Santos (patient 2) - Semanal Segundas 08:50 às 09:40
        {
          pId: 2,
          group: 'rec_mariana_01',
          pattern: 'Semanal',
          modality: 'PRESENTIAL',
          price: 200,
          dates: [
            ['2026-09-14T08:50:00', '2026-09-14T09:40:00'],
            ['2026-09-21T08:50:00', '2026-09-21T09:40:00'],
            ['2026-09-28T08:50:00', '2026-09-28T09:40:00'],
          ]
        },
        // Juliana Castro Ribeiro (patient 8) - Semanal Terças 10:30 às 11:20
        {
          pId: 8,
          group: 'rec_juliana_01',
          pattern: 'Semanal',
          modality: 'PRESENTIAL',
          price: 180,
          dates: [
            ['2026-09-15T10:30:00', '2026-09-15T11:20:00'],
            ['2026-09-22T10:30:00', '2026-09-22T11:20:00'],
            ['2026-09-29T10:30:00', '2026-09-29T11:20:00'],
          ]
        },
        // Thiago Carvalho Freitas (patient 11) - Semanal Quartas 09:50 às 10:40
        {
          pId: 11,
          group: 'rec_thiago_01',
          pattern: 'Semanal',
          modality: 'PRESENTIAL',
          price: 190,
          dates: [
            ['2026-09-16T09:50:00', '2026-09-16T10:40:00'],
            ['2026-09-23T09:50:00', '2026-09-23T10:40:00'],
            ['2026-09-30T09:50:00', '2026-09-30T10:40:00'],
          ]
        }
      ];

      for (const item of recurringSeries) {
        for (const [start, end] of item.dates) {
          db.run(`
            INSERT INTO sessions (psychologist_id, patient_id, start_time, end_time, status, modality, price, notes, recurrence_group_id, recurrence_pattern)
            VALUES (1, ?, ?, ?, 'SCHEDULED', ?, ?, 'Sessão Recorrente Psicoterapia', ?, ?);
          `, [item.pId, start, end, item.modality, item.price, item.group, item.pattern]);

          const sRow = db.exec("SELECT last_insert_rowid();");
          const sId = sRow[0]?.values[0][0];

          db.run(`
            INSERT INTO financial_transactions (patient_id, session_id, amount, status, payment_method, transaction_date)
            VALUES (?, ?, ?, 'PENDING', 'PIX', ?);
          `, [item.pId, sId, item.price, start.split('T')[0]]);
        }
      }
    }
    // 13. Seed Roles, Permissions and update Users
    const rolesCount = db.exec("SELECT count(*) FROM roles;");
    if (rolesCount.length === 0 || !rolesCount[0].values || Number(rolesCount[0].values[0][0]) === 0) {
      db.run(`
        INSERT INTO roles (id, name, is_system) VALUES 
        (1, 'Administrador', 1),
        (2, 'Psicólogo', 1),
        (3, 'Secretária', 1);
      `);

      const defaultPermissions = [
        'view_dashboard', 'view_agenda', 'view_patients',
        'view_clinical_records', 'edit_clinical_records',
        'view_documents', 'edit_documents', 'view_scales', 'edit_scales',
        'view_financial', 'edit_financial', 'view_audit', 'manage_users'
      ];

      for (const p of defaultPermissions) {
        db.run("INSERT INTO permissions (name) VALUES (?);", [p]);
      }

      const getPermId = (name: string) => {
        const res = db.exec(`SELECT id FROM permissions WHERE name = '${name}'`);
        return res[0]?.values[0][0];
      };

      const assignPerm = (roleId: number, permName: string) => {
        db.run("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?);", [roleId, getPermId(permName)]);
      };

      for (const p of defaultPermissions) {
        assignPerm(1, p); // Admin has all
      }

      const psyPerms = [
        'view_dashboard', 'view_agenda', 'view_patients',
        'view_clinical_records', 'edit_clinical_records',
        'view_documents', 'edit_documents', 'view_scales', 'edit_scales',
        'view_financial', 'edit_financial'
      ];
      for (const p of psyPerms) {
        assignPerm(2, p);
      }

      const secPerms = [
        'view_dashboard', 'view_agenda', 'view_patients',
        'view_financial', 'edit_financial'
      ];
      for (const p of secPerms) {
        assignPerm(3, p);
      }
    }

    // Migrate existing users to have role_id based on string role
    db.exec(`
      UPDATE users SET role_id = 1 WHERE role = 'ADMIN' AND role_id IS NULL;
      UPDATE users SET role_id = 2 WHERE role = 'PSYCHOLOGIST' AND role_id IS NULL;
      UPDATE users SET role_id = 3 WHERE role = 'SECRETARY' AND role_id IS NULL;
      
      INSERT OR IGNORE INTO clinic_settings (id, clinic_name, cnpj, phone, email, address, logo_base64) VALUES
      (1, 'PsicoGestão', '00.000.000/0001-00', '(11) 99999-9999', 'contato@psicogestao.com.br', 'Av. Paulista, 1000 - São Paulo, SP', NULL);
    `);

    // 14. Invoices & Accounting Settings Migration
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        psychologist_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('PENDING_DISPATCH', 'REQUESTED', 'ISSUED', 'CANCELED')),
        total_amount REAL NOT NULL,
        invoice_number TEXT,
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        issued_at DATETIME,
        file_name TEXT,
        file_size INTEGER,
        file_type TEXT,
        file_data TEXT,
        hash_sha256 TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (psychologist_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        session_id INTEGER,
        evaluation_id INTEGER,
        transaction_id INTEGER,
        item_type TEXT DEFAULT 'SESSION',
        item_description TEXT,
        session_date DATETIME NOT NULL,
        session_price REAL NOT NULL,
        is_future_reimbursement INTEGER DEFAULT 0,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (evaluation_id) REFERENCES neuropsych_evaluations(id),
        FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id)
      );
    `);

    // Migration of invoice_items schema (if session_id was NOT NULL or missing evaluation/transaction fields)
    const invItemsInfo = db.exec("PRAGMA table_info(invoice_items);");
    if (invItemsInfo.length > 0 && invItemsInfo[0].values) {
      const cols = invItemsInfo[0].values.map((row: any[]) => row[1]);
      const sessionIdRow = invItemsInfo[0].values.find((row: any[]) => row[1] === 'session_id');
      const isSessionIdNotNull = sessionIdRow && sessionIdRow[3] === 1;

      if (isSessionIdNotNull) {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE invoice_items_mig_tmp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL,
            session_id INTEGER,
            evaluation_id INTEGER,
            transaction_id INTEGER,
            item_type TEXT DEFAULT 'SESSION',
            item_description TEXT,
            session_date DATETIME NOT NULL,
            session_price REAL NOT NULL,
            is_future_reimbursement INTEGER DEFAULT 0,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (session_id) REFERENCES sessions(id),
            FOREIGN KEY (evaluation_id) REFERENCES neuropsych_evaluations(id),
            FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id)
          );
          INSERT INTO invoice_items_mig_tmp (id, invoice_id, session_id, session_date, session_price, is_future_reimbursement)
          SELECT id, invoice_id, session_id, session_date, session_price, is_future_reimbursement FROM invoice_items;
          DROP TABLE invoice_items;
          ALTER TABLE invoice_items_mig_tmp RENAME TO invoice_items;
          PRAGMA foreign_keys = ON;
        `);
      } else {
        if (!cols.includes('evaluation_id')) {
          db.exec("ALTER TABLE invoice_items ADD COLUMN evaluation_id INTEGER;");
        }
        if (!cols.includes('transaction_id')) {
          db.exec("ALTER TABLE invoice_items ADD COLUMN transaction_id INTEGER;");
        }
        if (!cols.includes('item_type')) {
          db.exec("ALTER TABLE invoice_items ADD COLUMN item_type TEXT DEFAULT 'SESSION';");
        }
        if (!cols.includes('item_description')) {
          db.exec("ALTER TABLE invoice_items ADD COLUMN item_description TEXT;");
        }
      }
    }

    // Ensure accounting_info_json, default_session_price, default_evaluation_price, and PIX columns exist in clinic_settings
    const settingsTableInfo = db.exec("PRAGMA table_info(clinic_settings);");
    if (settingsTableInfo.length > 0 && settingsTableInfo[0].values) {
      const cols = settingsTableInfo[0].values.map((row: any[]) => row[1]);
      if (!cols.includes('accounting_info_json')) {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN accounting_info_json TEXT;");
      }
      if (!cols.includes('default_session_price')) {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN default_session_price REAL DEFAULT 180.00;");
      }
      if (!cols.includes('default_evaluation_price')) {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN default_evaluation_price REAL DEFAULT 2400.00;");
      }
      if (!cols.includes('pix_key')) {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN pix_key TEXT;");
      }
      if (!cols.includes('pix_key_type')) {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN pix_key_type TEXT DEFAULT 'CPF';");
      }
      if (!cols.includes('pix_beneficiary')) {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN pix_beneficiary TEXT;");
      }
      if (!cols.includes('bank_info')) {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN bank_info TEXT;");
      }

      // Seed sensible clinic PIX defaults if not set
      db.exec(`
        UPDATE clinic_settings 
        SET pix_key = 'contato@psicogestao.com.br',
            pix_key_type = 'EMAIL',
            pix_beneficiary = 'Clínica PsicoGestão'
        WHERE id = 1 AND (pix_key IS NULL OR pix_key = '');
      `);
    }

    // Ensure invoice permissions exist
    const invPerms = ['view_invoices', 'manage_invoices'];
    for (const p of invPerms) {
      const checkP = db.exec(`SELECT count(*) FROM permissions WHERE name = '${p}';`);
      if (checkP.length === 0 || !checkP[0].values || Number(checkP[0].values[0][0]) === 0) {
        db.run("INSERT INTO permissions (name) VALUES (?);", [p]);
        const pIdRes = db.exec(`SELECT id FROM permissions WHERE name = '${p}';`);
        const pId = pIdRes[0]?.values[0][0];
        if (pId) {
          // Assign to Admin (1) and Psychologist (2) by default
          db.run("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, ?);", [pId]);
          db.run("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (2, ?);", [pId]);
        }
      }
    }

    // Ensure create_patients permission exists (RBAC governance: Admin and Secretary by default)
    const checkCreatePatients = db.exec("SELECT count(*) FROM permissions WHERE name = 'create_patients';");
    if (checkCreatePatients.length === 0 || !checkCreatePatients[0].values || Number(checkCreatePatients[0].values[0][0]) === 0) {
      db.run("INSERT INTO permissions (name) VALUES (?);", ['create_patients']);
      const cpIdRes = db.exec("SELECT id FROM permissions WHERE name = 'create_patients';");
      const cpId = cpIdRes[0]?.values[0][0];
      if (cpId) {
        db.run("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, ?);", [cpId]); // Admin
        db.run("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (3, ?);", [cpId]); // Secretária
      }
    }

    // 16. Neuropsychological Evaluations Migration
    db.exec(`
      CREATE TABLE IF NOT EXISTS neuropsych_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        psychologist_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN ('IN_PROGRESS', 'AWAITING_DEVOLUTIVA', 'COMPLETED', 'CANCELED')),
        estimated_sessions INTEGER NOT NULL DEFAULT 6,
        total_price REAL NOT NULL,
        payment_mode TEXT NOT NULL DEFAULT 'PARCELADO' CHECK(payment_mode IN ('A_VISTA', 'PARCELADO')),
        hypothesis_diagnosis TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (psychologist_id) REFERENCES users(id)
      );
    `);

    // Ensure evaluation columns exist on sessions
    const sessionsInfo = db.exec("PRAGMA table_info(sessions);");
    if (sessionsInfo.length > 0 && sessionsInfo[0].values) {
      const sessCols = sessionsInfo[0].values.map((row: any[]) => row[1]);
      if (!sessCols.includes('evaluation_id')) {
        db.exec("ALTER TABLE sessions ADD COLUMN evaluation_id INTEGER REFERENCES neuropsych_evaluations(id);");
      }
      if (!sessCols.includes('session_type')) {
        db.exec("ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'PSYCHOTHERAPY';");
      }
    }

    // Ensure evaluation columns exist on financial_transactions
    const finTableInfo = db.exec("PRAGMA table_info(financial_transactions);");
    if (finTableInfo.length > 0 && finTableInfo[0].values) {
      const finCols = finTableInfo[0].values.map((row: any[]) => row[1]);
      if (!finCols.includes('evaluation_id')) {
        db.exec("ALTER TABLE financial_transactions ADD COLUMN evaluation_id INTEGER REFERENCES neuropsych_evaluations(id);");
      }
      if (!finCols.includes('installment_number')) {
        db.exec("ALTER TABLE financial_transactions ADD COLUMN installment_number INTEGER;");
      }
      if (!finCols.includes('total_installments')) {
        db.exec("ALTER TABLE financial_transactions ADD COLUMN total_installments INTEGER;");
      }
      if (!finCols.includes('invoice_status')) {
        db.exec("ALTER TABLE financial_transactions ADD COLUMN invoice_status TEXT DEFAULT 'NOT_ISSUED';");
      }
    }

    // Ensure evaluation column exists on patient_documents
    const docTableInfo = db.exec("PRAGMA table_info(patient_documents);");
    if (docTableInfo.length > 0 && docTableInfo[0].values) {
      const docCols = docTableInfo[0].values.map((row: any[]) => row[1]);
      if (!docCols.includes('evaluation_id')) {
        db.exec("ALTER TABLE patient_documents ADD COLUMN evaluation_id INTEGER REFERENCES neuropsych_evaluations(id);");
      }
    }

    // Ensure evaluation permissions exist
    const evalPerms = ['view_evaluations', 'edit_evaluations'];
    for (const p of evalPerms) {
      const checkP = db.exec(`SELECT count(*) FROM permissions WHERE name = '${p}';`);
      if (checkP.length === 0 || !checkP[0].values || Number(checkP[0].values[0][0]) === 0) {
        db.run("INSERT INTO permissions (name) VALUES (?);", [p]);
        const pIdRes = db.exec(`SELECT id FROM permissions WHERE name = '${p}';`);
        const pId = pIdRes[0]?.values[0][0];
        if (pId) {
          // Assign to Admin (1) and Psychologist (2)
          db.run("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, ?);", [pId]);
          db.run("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (2, ?);", [pId]);
        }
      }
    }

    // Create database performance indexes (Performance Optimizer)
    db.exec(`
      -- Sessions performance indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_patient_id ON sessions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_psych_start ON sessions(psychologist_id, start_time);
      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_recurrence ON sessions(recurrence_group_id);

      -- Patients performance indexes
      CREATE INDEX IF NOT EXISTS idx_patients_cpf ON patients(cpf);
      CREATE INDEX IF NOT EXISTS idx_patients_psychologist ON patients(psychologist_id);
      CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);

      -- Financial transactions performance indexes
      CREATE INDEX IF NOT EXISTS idx_financial_patient ON financial_transactions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_financial_session ON financial_transactions(session_id);
      CREATE INDEX IF NOT EXISTS idx_financial_status ON financial_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_financial_transaction_date ON financial_transactions(transaction_date);

      -- Medical records performance indexes
      CREATE INDEX IF NOT EXISTS idx_records_patient ON medical_records(patient_id);
      CREATE INDEX IF NOT EXISTS idx_records_psychologist ON medical_records(psychologist_id);
      CREATE INDEX IF NOT EXISTS idx_records_session ON medical_records(session_id);

      -- Confidential notes performance indexes
      CREATE INDEX IF NOT EXISTS idx_confidential_patient_psych ON confidential_notes(patient_id, psychologist_id);

      -- Audit logs performance indexes
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

      -- Invoices & invoice items performance indexes
      CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

      -- Documents performance indexes
      CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id);
      CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
      CREATE INDEX IF NOT EXISTS idx_patient_documents_patient ON patient_documents(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_documents_category ON patient_documents(category);

      -- Expenses performance indexes
      CREATE INDEX IF NOT EXISTS idx_expenses_due_date_status ON expenses(due_date, status);
      CREATE INDEX IF NOT EXISTS idx_expenses_recurrence ON expenses(recurrence_group_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_psychologist ON expenses(psychologist_id);

      -- Neuropsych evaluations performance indexes
      CREATE INDEX IF NOT EXISTS idx_evaluations_patient ON neuropsych_evaluations(patient_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_status ON neuropsych_evaluations(status);

      -- Agenda events & Auth tokens performance indexes
      CREATE INDEX IF NOT EXISTS idx_agenda_events_date ON agenda_events(date);
      CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);
    `);

    // 17. Repasse Columns Migration on Users Table
    const userTableInfo = db.exec("PRAGMA table_info(users);");
    const userColumns = userTableInfo[0]?.values.map((col: any) => col[1]) || [];
    if (!userColumns.includes('repasse_mode')) {
      db.exec("ALTER TABLE users ADD COLUMN repasse_mode TEXT DEFAULT 'PERCENTAGE';");
    }
    if (!userColumns.includes('repasse_percentage')) {
      db.exec("ALTER TABLE users ADD COLUMN repasse_percentage REAL DEFAULT 50.0;");
    }
    if (!userColumns.includes('repasse_eval_percentage')) {
      db.exec("ALTER TABLE users ADD COLUMN repasse_eval_percentage REAL DEFAULT 60.0;");
    }
    if (!userColumns.includes('repasse_fixed_amount')) {
      db.exec("ALTER TABLE users ADD COLUMN repasse_fixed_amount REAL;");
    }
    if (!userColumns.includes('pix_key')) {
      db.exec("ALTER TABLE users ADD COLUMN pix_key TEXT;");
    }
    if (!userColumns.includes('pix_key_type')) {
      db.exec("ALTER TABLE users ADD COLUMN pix_key_type TEXT;");
    }
    if (!userColumns.includes('bank_info')) {
      db.exec("ALTER TABLE users ADD COLUMN bank_info TEXT;");
    }

    // 18. Repasse Batches & Items Tables Migration
    db.exec(`
      CREATE TABLE IF NOT EXISTS repasse_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_number TEXT UNIQUE NOT NULL,
        psychologist_id INTEGER NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED', 'PAID')),
        total_sessions_count INTEGER NOT NULL DEFAULT 0,
        gross_total_amount REAL NOT NULL DEFAULT 0.0,
        repasse_subtotal REAL NOT NULL DEFAULT 0.0,
        deductions_amount REAL NOT NULL DEFAULT 0.0,
        additions_amount REAL NOT NULL DEFAULT 0.0,
        net_repasse_amount REAL NOT NULL DEFAULT 0.0,
        notes TEXT,
        closed_at DATETIME,
        closed_by_user_id INTEGER,
        paid_at DATETIME,
        paid_by_user_id INTEGER,
        payment_date DATE,
        payment_method TEXT DEFAULT 'PIX',
        expense_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (psychologist_id) REFERENCES users(id),
        FOREIGN KEY (closed_by_user_id) REFERENCES users(id),
        FOREIGN KEY (paid_by_user_id) REFERENCES users(id),
        FOREIGN KEY (expense_id) REFERENCES expenses(id)
      );

      CREATE TABLE IF NOT EXISTS repasse_batch_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        session_id INTEGER,
        evaluation_id INTEGER,
        patient_id INTEGER NOT NULL,
        service_type TEXT NOT NULL,
        service_date DATE NOT NULL,
        gross_amount REAL NOT NULL,
        repasse_rate REAL NOT NULL,
        repasse_amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES repasse_batches(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (evaluation_id) REFERENCES neuropsych_evaluations(id),
        FOREIGN KEY (patient_id) REFERENCES patients(id)
      );

      CREATE TABLE IF NOT EXISTS repasse_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('DEDUCTION', 'ADDITION')),
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES repasse_batches(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_repasse_batches_psych ON repasse_batches(psychologist_id);
      CREATE INDEX IF NOT EXISTS idx_repasse_batches_status ON repasse_batches(status);
      CREATE INDEX IF NOT EXISTS idx_repasse_batch_items_batch ON repasse_batch_items(batch_id);
      CREATE INDEX IF NOT EXISTS idx_repasse_batch_items_session ON repasse_batch_items(session_id);
    `);

    try {
      db.exec(`ALTER TABLE repasse_batches ADD COLUMN payment_date DATE;`);
    } catch (e) {}

    // Seed default repasse settings on sample psychologist Dr. Marcos if not set
    db.exec(`
      UPDATE users SET 
        repasse_mode = 'PERCENTAGE',
        repasse_percentage = 60.0,
        repasse_eval_percentage = 70.0,
        pix_key = 'marcos@psicogestao.com.br',
        pix_key_type = 'EMAIL'
      WHERE id = 1 AND (pix_key IS NULL OR pix_key = '');
    `);

    // 20. Billing Contacts Migration
    db.exec(`
      CREATE TABLE IF NOT EXISTS billing_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        evaluation_id INTEGER,
        contact_channel TEXT NOT NULL DEFAULT 'WHATSAPP' CHECK(contact_channel IN ('WHATSAPP', 'COPIED_TEXT', 'PHONE', 'EMAIL', 'MANUAL_NOTE')),
        recipient_type TEXT NOT NULL DEFAULT 'PATIENT' CHECK(recipient_type IN ('PATIENT', 'FINANCIAL_RESPONSIBLE', 'LEGAL_GUARDIAN', 'OTHER')),
        recipient_name TEXT,
        recipient_phone TEXT,
        template_type TEXT,
        message_preview TEXT,
        agreement_date TEXT,
        agreement_notes TEXT,
        created_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (evaluation_id) REFERENCES neuropsych_evaluations(id),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_billing_contacts_patient ON billing_contacts(patient_id);
      CREATE INDEX IF NOT EXISTS idx_billing_contacts_eval ON billing_contacts(evaluation_id);
      CREATE INDEX IF NOT EXISTS idx_billing_contacts_created_at ON billing_contacts(created_at);
    `);

    // 21. Clinic Settings - Repasse Toggle Migration & Presets Engine
    const clinicTableInfo = db.exec("PRAGMA table_info(clinic_settings);");
    const clinicColumns = clinicTableInfo[0]?.values.map((col: any) => col[1]) || [];
    if (!clinicColumns.includes('repasse_enabled')) {
      try {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN repasse_enabled INTEGER NOT NULL DEFAULT 1;");
      } catch (e) {}
    }
    if (!clinicColumns.includes('operating_mode')) {
      try {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN operating_mode TEXT DEFAULT 'ENTERPRISE_CLINIC';");
      } catch (e) {}
    }
    if (!clinicColumns.includes('reception_tower_enabled')) {
      try {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN reception_tower_enabled INTEGER NOT NULL DEFAULT 1;");
      } catch (e) {}
    }
    if (!clinicColumns.includes('rooms_enabled')) {
      try {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN rooms_enabled INTEGER NOT NULL DEFAULT 1;");
      } catch (e) {}
    }
    if (!clinicColumns.includes('collaborators_enabled')) {
      try {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN collaborators_enabled INTEGER NOT NULL DEFAULT 1;");
      } catch (e) {}
    }
    if (!clinicColumns.includes('waiting_tv_enabled')) {
      try {
        db.exec("ALTER TABLE clinic_settings ADD COLUMN waiting_tv_enabled INTEGER NOT NULL DEFAULT 1;");
      } catch (e) {}
    }

    // 22. Rooms Table (Consultórios Físicos)
    db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        initials TEXT,
        room_type TEXT NOT NULL DEFAULT 'CLINICAL' CHECK(room_type IN ('CLINICAL', 'NEURO', 'PLAY_THERAPY', 'ONLINE')),
        color_code TEXT DEFAULT '#0d9488',
        status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE')),
        active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure initials column exists for existing installations
    const roomInfo = db.exec("PRAGMA table_info(rooms);");
    const roomCols = roomInfo[0]?.values.map((c: any) => c[1]) || [];
    if (!roomCols.includes('initials')) {
      try { db.exec("ALTER TABLE rooms ADD COLUMN initials TEXT;"); } catch (e) {}
    }

    // Seed default rooms if empty
    const roomCountRes = db.exec("SELECT count(*) FROM rooms;");
    const roomCount = roomCountRes.length > 0 && roomCountRes[0].values ? Number(roomCountRes[0].values[0][0]) : 0;
    if (roomCount === 0) {
      db.run(`
        INSERT INTO rooms (id, name, initials, room_type, color_code, status, active) VALUES
        (1, 'Consultório 1 - Adulto & TCC', 'C1', 'CLINICAL', '#0d9488', 'AVAILABLE', 1),
        (2, 'Consultório 2 - Neuropsicologia', 'C2', 'NEURO', '#3b82f6', 'AVAILABLE', 1),
        (3, 'Consultório 3 - Infantil & Ludoterapia', 'C3', 'PLAY_THERAPY', '#ec4899', 'AVAILABLE', 1),
        (4, 'Consultório 4 - Teleconsulta & Híbrido', 'C4', 'ONLINE', '#8b5cf6', 'AVAILABLE', 1);
      `);
    }

    // Populate initials if empty for known seeded rooms
    try {
      db.run(`
        UPDATE rooms SET initials = 'C1' WHERE id = 1 AND (initials IS NULL OR initials = '');
        UPDATE rooms SET initials = 'C2' WHERE id = 2 AND (initials IS NULL OR initials = '');
        UPDATE rooms SET initials = 'C3' WHERE id = 3 AND (initials IS NULL OR initials = '');
        UPDATE rooms SET initials = 'C4' WHERE id = 4 AND (initials IS NULL OR initials = '');
        UPDATE rooms SET initials = 'C5' WHERE id = 5 AND (initials IS NULL OR initials = '');
        UPDATE rooms SET initials = 'C' || id WHERE (initials IS NULL OR initials = '');
      `);
    } catch (e) {}

    // 23. Sessions Table Presence & Room Columns
    const sessInfo = db.exec("PRAGMA table_info(sessions);");
    const sessCols = sessInfo[0]?.values.map((c: any) => c[1]) || [];
    if (!sessCols.includes('room_id')) {
      try { db.exec("ALTER TABLE sessions ADD COLUMN room_id INTEGER REFERENCES rooms(id);"); } catch (e) {}
    }
    if (!sessCols.includes('room_name')) {
      try { db.exec("ALTER TABLE sessions ADD COLUMN room_name TEXT;"); } catch (e) {}
    }
    if (!sessCols.includes('arrival_time')) {
      try { db.exec("ALTER TABLE sessions ADD COLUMN arrival_time DATETIME;"); } catch (e) {}
    }
    if (!sessCols.includes('called_at')) {
      try { db.exec("ALTER TABLE sessions ADD COLUMN called_at DATETIME;"); } catch (e) {}
    }
    if (!sessCols.includes('session_started_at')) {
      try { db.exec("ALTER TABLE sessions ADD COLUMN session_started_at DATETIME;"); } catch (e) {}
    }
    if (!sessCols.includes('session_ended_at')) {
      try { db.exec("ALTER TABLE sessions ADD COLUMN session_ended_at DATETIME;"); } catch (e) {}
    }
    if (!sessCols.includes('presence_status')) {
      try { db.exec("ALTER TABLE sessions ADD COLUMN presence_status TEXT NOT NULL DEFAULT 'SCHEDULED';"); } catch (e) {}
    }
    if (!sessCols.includes('waiting_notes')) {
      try { db.exec("ALTER TABLE sessions ADD COLUMN waiting_notes TEXT;"); } catch (e) {}
    }

    // 24. Waiting Room Calls Table (TV Display Queue - CFP 06/2019 & LGPD Compliant)
    db.exec(`
      CREATE TABLE IF NOT EXISTS waiting_room_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        patient_display_name TEXT NOT NULL,
        room_name TEXT NOT NULL,
        psychologist_name TEXT NOT NULL,
        called_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'EXPIRED')),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
    `);

    // 25. Fiscal Profile & Carnê-Leão Premium Migrations
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_fiscal_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        cpf TEXT NOT NULL,
        crp TEXT NOT NULL,
        cbo_code TEXT DEFAULT '2251-05',
        dependents_count INTEGER DEFAULT 0,
        inss_mode TEXT DEFAULT 'STANDARD_20' CHECK(inss_mode IN ('NONE', 'STANDARD_20', 'SIMPLIFIED_11', 'CUSTOM_FIXED')),
        inss_custom_amount REAL DEFAULT 0,
        use_simplified_deduction INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_user_fiscal_user ON user_fiscal_settings(user_id);
    `);

    const expInfo = db.exec("PRAGMA table_info(expenses);");
    const expCols = expInfo[0]?.values.map((c: any) => c[1]) || [];
    if (!expCols.includes('is_shared')) {
      try { db.exec("ALTER TABLE expenses ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
    }
    if (!expCols.includes('shared_splits_json')) {
      try { db.exec("ALTER TABLE expenses ADD COLUMN shared_splits_json TEXT;"); } catch (e) {}
    }
    if (!expCols.includes('rfb_account_code')) {
      try { db.exec("ALTER TABLE expenses ADD COLUMN rfb_account_code TEXT;"); } catch (e) {}
    }
    if (!expCols.includes('scope')) {
      try { 
        db.exec("ALTER TABLE expenses ADD COLUMN scope TEXT NOT NULL DEFAULT 'CLINIC';"); 
        // Se já existiam despesas com is_shared = 1, atualiza scope para 'SHARED'
        db.exec("UPDATE expenses SET scope = 'SHARED' WHERE is_shared = 1;");
      } catch (e) {}
    }
    if (!expCols.includes('payer_user_id')) {
      try { db.exec("ALTER TABLE expenses ADD COLUMN payer_user_id INTEGER;"); } catch (e) {}
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS expense_settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL REFERENCES users(id),
        to_user_id INTEGER NOT NULL REFERENCES users(id),
        amount REAL NOT NULL,
        payment_date DATE NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'PIX' CHECK(payment_method IN ('PIX', 'TRANSFERENCIA', 'DINHEIRO', 'OUTRO')),
        competence_month TEXT NOT NULL,
        notes TEXT,
        created_by_user_id INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id),
        FOREIGN KEY (to_user_id) REFERENCES users(id),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_settlements_month ON expense_settlements(competence_month);
      CREATE INDEX IF NOT EXISTS idx_settlements_users ON expense_settlements(from_user_id, to_user_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_scope ON expenses(scope);
      CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer_user_id);
    `);

    if (!clinicColumns.includes('operational_tax_mode')) {
      try { db.exec("ALTER TABLE clinic_settings ADD COLUMN operational_tax_mode TEXT DEFAULT 'AUTONOMOUS';"); } catch (e) {}
    }

    // Seed default fiscal settings for existing demo psychologists if not present
    try {
      const usersRes = db.exec("SELECT id, name, crp_number FROM users WHERE role IN ('PSYCHOLOGIST', 'ADMIN');");
      const userRows = usersRes.length > 0 && usersRes[0]?.values ? usersRes[0].values : [];
      for (const u of userRows) {
        const uId = u[0];
        const uCrp = u[2] || 'CRP 06/128945-SP';
        const sampleCpf = uId === 1 ? '123.456.789-00' : '987.654.321-99';
        db.run(`
          INSERT OR IGNORE INTO user_fiscal_settings (user_id, cpf, crp, cbo_code, dependents_count, inss_mode, inss_custom_amount)
          VALUES (?, ?, ?, '2251-05', 0, 'STANDARD_20', 0);
        `, [uId, sampleCpf, uCrp]);
      }
    } catch (e) {
      console.error('Error seeding default user_fiscal_settings:', e);
    }

    // 26. Invoices Direct NFS-e (Nuvem Fiscal) & Clinic Fiscal Credentials Migration
    try {
      const invInfo = db.exec("PRAGMA table_info(invoices);");
      const invCols = (invInfo.length > 0 && invInfo[0]?.values) ? invInfo[0].values.map((c: any) => c[1]) : [];
      
      const invSqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='invoices';");
      const invSql = invSqlRes.length > 0 && invSqlRes[0]?.values?.[0]?.[0] ? String(invSqlRes[0].values[0][0]) : '';
      if (invSql.includes("CHECK(status IN ('PENDING_DISPATCH', 'REQUESTED', 'ISSUED', 'CANCELED'))")) {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE invoices_mig_tmp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            psychologist_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'REQUESTED',
            total_amount REAL NOT NULL,
            invoice_number TEXT,
            requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            issued_at DATETIME,
            file_name TEXT,
            file_size INTEGER,
            file_type TEXT,
            file_data TEXT,
            hash_sha256 TEXT,
            notes TEXT,
            emission_mode TEXT DEFAULT 'MANUAL',
            gateway_reference_id TEXT,
            rps_number INTEGER,
            rps_series TEXT,
            xml_data TEXT,
            error_details TEXT,
            cancellation_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id),
            FOREIGN KEY (psychologist_id) REFERENCES users(id)
          );
          INSERT INTO invoices_mig_tmp (
            id, patient_id, psychologist_id, status, total_amount, invoice_number,
            requested_at, issued_at, file_name, file_size, file_type, file_data,
            hash_sha256, notes, created_at
          )
          SELECT 
            id, patient_id, psychologist_id, status, total_amount, invoice_number,
            requested_at, issued_at, file_name, file_size, file_type, file_data,
            hash_sha256, notes, created_at
          FROM invoices;
          DROP TABLE invoices;
          ALTER TABLE invoices_mig_tmp RENAME TO invoices;
          CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
          CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
          CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
          PRAGMA foreign_keys = ON;
        `);
      } else {
        if (!invCols.includes('emission_mode')) {
          try { db.exec("ALTER TABLE invoices ADD COLUMN emission_mode TEXT DEFAULT 'MANUAL';"); } catch (e) {}
        }
        if (!invCols.includes('gateway_reference_id')) {
          try { db.exec("ALTER TABLE invoices ADD COLUMN gateway_reference_id TEXT;"); } catch (e) {}
        }
        if (!invCols.includes('rps_number')) {
          try { db.exec("ALTER TABLE invoices ADD COLUMN rps_number INTEGER;"); } catch (e) {}
        }
        if (!invCols.includes('rps_series')) {
          try { db.exec("ALTER TABLE invoices ADD COLUMN rps_series TEXT;"); } catch (e) {}
        }
        if (!invCols.includes('xml_data')) {
          try { db.exec("ALTER TABLE invoices ADD COLUMN xml_data TEXT;"); } catch (e) {}
        }
        if (!invCols.includes('error_details')) {
          try { db.exec("ALTER TABLE invoices ADD COLUMN error_details TEXT;"); } catch (e) {}
        }
        if (!invCols.includes('cancellation_reason')) {
          try { db.exec("ALTER TABLE invoices ADD COLUMN cancellation_reason TEXT;"); } catch (e) {}
        }
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS clinic_fiscal_credentials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clinic_id INTEGER NOT NULL UNIQUE,
          is_active INTEGER NOT NULL DEFAULT 0,
          tax_regime TEXT NOT NULL DEFAULT 'SIMPLES_NACIONAL' CHECK(tax_regime IN ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'MEI')),
          cnpj TEXT,
          municipal_registration TEXT,
          city_ibge_code TEXT,
          service_item_code TEXT DEFAULT '04.16',
          cnae_code TEXT DEFAULT '8650-0/03',
          iss_rate REAL DEFAULT 2.0,
          certificate_pfx_encrypted TEXT,
          certificate_pass_encrypted TEXT,
          certificate_valid_until DATETIME,
          certificate_fingerprint TEXT,
          environment TEXT DEFAULT 'SANDBOX' CHECK(environment IN ('SANDBOX', 'PRODUCTION')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (clinic_id) REFERENCES clinic_settings(id)
        );
        CREATE INDEX IF NOT EXISTS idx_fiscal_cred_clinic ON clinic_fiscal_credentials(clinic_id);
      `);
    } catch (e) {
      console.error('Error migrating clinic_fiscal_credentials & invoices schema:', e);
    }

    // 21. Migration: clinic_gateway_settings & financial_transactions gateway fields
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS clinic_gateway_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clinic_id INTEGER NOT NULL UNIQUE,
          provider TEXT NOT NULL DEFAULT 'ASAAS' CHECK(provider IN ('ASAAS')),
          is_active INTEGER NOT NULL DEFAULT 0,
          environment TEXT NOT NULL DEFAULT 'SANDBOX' CHECK(environment IN ('SANDBOX', 'PRODUCTION')),
          api_key_encrypted TEXT,
          webhook_token TEXT,
          default_due_days INTEGER DEFAULT 3,
          fine_percentage REAL DEFAULT 0.0,
          interest_percentage REAL DEFAULT 0.0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (clinic_id) REFERENCES clinic_settings(id)
        );
        CREATE INDEX IF NOT EXISTS idx_gateway_clinic ON clinic_gateway_settings(clinic_id);
      `);

      const ftInfo = db.exec("PRAGMA table_info(financial_transactions);");
      if (ftInfo.length > 0 && ftInfo[0].values) {
        const ftCols = ftInfo[0].values.map((row: any[]) => row[1]);
        if (!ftCols.includes('gateway_payment_id')) {
          try { db.exec("ALTER TABLE financial_transactions ADD COLUMN gateway_payment_id TEXT;"); } catch (e) {}
        }
        if (!ftCols.includes('payment_link_url')) {
          try { db.exec("ALTER TABLE financial_transactions ADD COLUMN payment_link_url TEXT;"); } catch (e) {}
        }
        if (!ftCols.includes('pix_copy_paste')) {
          try { db.exec("ALTER TABLE financial_transactions ADD COLUMN pix_copy_paste TEXT;"); } catch (e) {}
        }
        if (!ftCols.includes('pix_qr_code_base64')) {
          try { db.exec("ALTER TABLE financial_transactions ADD COLUMN pix_qr_code_base64 TEXT;"); } catch (e) {}
        }
        if (!ftCols.includes('auto_reconciled')) {
          try { db.exec("ALTER TABLE financial_transactions ADD COLUMN auto_reconciled INTEGER DEFAULT 0;"); } catch (e) {}
        }
        if (!ftCols.includes('auto_reconciled_at')) {
          try { db.exec("ALTER TABLE financial_transactions ADD COLUMN auto_reconciled_at DATETIME;"); } catch (e) {}
        }
      }
    } catch (e) {
      console.error('Error migrating clinic_gateway_settings & financial_transactions schema:', e);
    }

    // Synapsis Academy: User progress and practice count tracking
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_academy_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          tour_id TEXT NOT NULL,
          category TEXT NOT NULL,
          completed_count INTEGER DEFAULT 1,
          status TEXT DEFAULT 'COMPLETED',
          last_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, tour_id)
        );
        CREATE INDEX IF NOT EXISTS idx_academy_user ON user_academy_progress(user_id);
      `);
    } catch (e) {
      console.error('Error creating user_academy_progress table in migrateTables:', e);
    }

    // 23. Synapsis Paciente: Migrações de Tabelas e Colunas de Acesso
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS patient_auth_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER NOT NULL,
          phone_used TEXT NOT NULL,
          otp_code TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          expires_at DATETIME NOT NULL,
          used_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_patient_auth_tokens_code ON patient_auth_tokens(otp_code, expires_at);

        CREATE TABLE IF NOT EXISTS patient_credentials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER NOT NULL UNIQUE,
          pin_hash TEXT,
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          locked_until DATETIME,
          last_login_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS patient_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER NOT NULL,
          channel_type TEXT NOT NULL CHECK(channel_type IN ('ADMINISTRATIVE', 'CLINICAL')),
          sender_type TEXT NOT NULL CHECK(sender_type IN ('PATIENT', 'RECEPTION', 'PSYCHOLOGIST')),
          sender_user_id INTEGER,
          message_text TEXT NOT NULL,
          attachment_url TEXT,
          attachment_name TEXT,
          is_read INTEGER NOT NULL DEFAULT 0,
          read_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_patient_messages_patient ON patient_messages(patient_id, channel_type);

        CREATE TABLE IF NOT EXISTS patient_activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER NOT NULL,
          psychologist_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          activity_type TEXT NOT NULL CHECK(activity_type IN ('DIARY', 'SCALE_PHQ9', 'SCALE_GAD7', 'HOMEWORK')),
          status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'COMPLETED', 'EXPIRED')),
          response_json TEXT,
          due_date DATE,
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
          FOREIGN KEY (psychologist_id) REFERENCES users(id)
        );
      `);

      // Migração de colunas em users
      const usersColsInfo = db.exec("PRAGMA table_info(users);");
      if (usersColsInfo.length > 0 && usersColsInfo[0].values) {
        const uCols = usersColsInfo[0].values.map((r: any[]) => r[1]);
        if (!uCols.includes('chat_enabled_default')) {
          try { db.exec("ALTER TABLE users ADD COLUMN chat_enabled_default INTEGER DEFAULT 0;"); } catch (e) {}
        }
        if (!uCols.includes('chat_working_hours')) {
          try { db.exec("ALTER TABLE users ADD COLUMN chat_working_hours TEXT DEFAULT '{\"days\":[1,2,3,4,5],\"start\":\"08:00\",\"end\":\"18:00\"}';"); } catch (e) {}
        }
      }

      // Migração de colunas em patients
      const patientsColsInfo = db.exec("PRAGMA table_info(patients);");
      if (patientsColsInfo.length > 0 && patientsColsInfo[0].values) {
        const pCols = patientsColsInfo[0].values.map((r: any[]) => r[1]);
        if (!pCols.includes('psychologist_chat_override')) {
          try { db.exec("ALTER TABLE patients ADD COLUMN psychologist_chat_override TEXT DEFAULT NULL;"); } catch (e) {}
        }
        if (!pCols.includes('portal_access_enabled')) {
          try { db.exec("ALTER TABLE patients ADD COLUMN portal_access_enabled INTEGER DEFAULT 1;"); } catch (e) {}
        }
        if (!pCols.includes('portal_invite_token')) {
          try { db.exec("ALTER TABLE patients ADD COLUMN portal_invite_token TEXT DEFAULT NULL;"); } catch (e) {}
        }
        if (!pCols.includes('portal_invite_sent_at')) {
          try { db.exec("ALTER TABLE patients ADD COLUMN portal_invite_sent_at DATETIME DEFAULT NULL;"); } catch (e) {}
        }
        if (!pCols.includes('portal_invite_expires_at')) {
          try { db.exec("ALTER TABLE patients ADD COLUMN portal_invite_expires_at DATETIME DEFAULT NULL;"); } catch (e) {}
        }
        if (!pCols.includes('portal_first_access_at')) {
          try { db.exec("ALTER TABLE patients ADD COLUMN portal_first_access_at DATETIME DEFAULT NULL;"); } catch (e) {}
        }
      }

      // Migração de colunas em clinic_settings
      const clinicColsInfo = db.exec("PRAGMA table_info(clinic_settings);");
      if (clinicColsInfo.length > 0 && clinicColsInfo[0].values) {
        const cCols = clinicColsInfo[0].values.map((r: any[]) => r[1]);
        if (!cCols.includes('cancellation_notice_hours')) {
          try { db.exec("ALTER TABLE clinic_settings ADD COLUMN cancellation_notice_hours INTEGER DEFAULT 24;"); } catch (e) {}
        }
      }

      // Seed inicial de atividades e credenciais de teste para o paciente 1 (PIN default: 1234)
      const pinHash = bcrypt.hashSync('1234', 10);
      db.run(`
        INSERT OR IGNORE INTO patient_credentials (patient_id, pin_hash, last_login_at)
        VALUES (1, ?, CURRENT_TIMESTAMP);
      `, [pinHash]);

      const actCount = db.exec("SELECT count(*) FROM patient_activities;");
      if (actCount.length === 0 || !actCount[0].values || Number(actCount[0].values[0][0]) === 0) {
        db.run(`
          INSERT INTO patient_activities (patient_id, psychologist_id, title, description, activity_type, status, due_date)
          VALUES 
          (1, 1, 'Inventário de Ansiedade GAD-7', 'Por favor, responda a este breve inventário para acompanharmos seus sintomas nesta semana.', 'SCALE_GAD7', 'PENDING', '2026-09-25'),
          (1, 1, 'Diário de Pensamentos Automáticos', 'Anote situações em que sentiu desconforto ou ansiedade no trabalho e qual pensamento surgiu.', 'DIARY', 'PENDING', '2026-09-26');
        `);
      }

      const msgCount = db.exec("SELECT count(*) FROM patient_messages;");
      if (msgCount.length === 0 || !msgCount[0].values || Number(msgCount[0].values[0][0]) === 0) {
        db.run(`
          INSERT INTO patient_messages (patient_id, channel_type, sender_type, sender_user_id, message_text, is_read)
          VALUES 
          (1, 'ADMINISTRATIVE', 'RECEPTION', 2, 'Olá, Lucas! Lembramos que o estacionamento conveniado fica ao lado da clínica (número 1020). Qualquer dúvida estamos à disposição.', 1);
        `);
      }
    } catch (e) {
      console.error('Error migrating Synapsis Paciente schema in migrateTables:', e);
    }

    // 16. Ensure waitlist_leads table exists for Clube das Fundadoras
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS waitlist_leads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          whatsapp TEXT NOT NULL,
          email TEXT NOT NULL,
          profile TEXT,
          current_software TEXT,
          interested_plan TEXT,
          status TEXT DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {
      console.error('Error creating waitlist_leads table in migrateTables:', e);
    }

    // 17. Ensure teleatendimento video columns exist on sessions & users tables
    try {
      const sessionsTableInfo = db.exec("PRAGMA table_info(sessions);");
      if (sessionsTableInfo.length > 0 && sessionsTableInfo[0].values) {
        const sessCols = sessionsTableInfo[0].values.map((row: any[]) => row[1]);
        if (!sessCols.includes('video_provider')) {
          db.exec("ALTER TABLE sessions ADD COLUMN video_provider TEXT DEFAULT 'NATIVE';");
        }
        if (!sessCols.includes('video_room_id')) {
          db.exec("ALTER TABLE sessions ADD COLUMN video_room_id TEXT;");
        }
        if (!sessCols.includes('video_external_url')) {
          db.exec("ALTER TABLE sessions ADD COLUMN video_external_url TEXT;");
        }
        if (!sessCols.includes('video_status')) {
          db.exec("ALTER TABLE sessions ADD COLUMN video_status TEXT DEFAULT 'INACTIVE';");
        }
        if (!sessCols.includes('video_started_at')) {
          db.exec("ALTER TABLE sessions ADD COLUMN video_started_at DATETIME;");
        }
        if (!sessCols.includes('video_ended_at')) {
          db.exec("ALTER TABLE sessions ADD COLUMN video_ended_at DATETIME;");
        }
        if (!sessCols.includes('patient_joined_at')) {
          db.exec("ALTER TABLE sessions ADD COLUMN patient_joined_at DATETIME;");
        }
        if (!sessCols.includes('patient_tcle_accepted_at')) {
          db.exec("ALTER TABLE sessions ADD COLUMN patient_tcle_accepted_at DATETIME;");
        }
        if (!sessCols.includes('patient_access_token')) {
          db.exec("ALTER TABLE sessions ADD COLUMN patient_access_token TEXT;");
        }
      }

      const usersTableInfo2 = db.exec("PRAGMA table_info(users);");
      if (usersTableInfo2.length > 0 && usersTableInfo2[0].values) {
        const uCols = usersTableInfo2[0].values.map((row: any[]) => row[1]);
        if (!uCols.includes('epsi_code')) {
          db.exec("ALTER TABLE users ADD COLUMN epsi_code TEXT;");
        }
        if (!uCols.includes('default_video_provider')) {
          db.exec("ALTER TABLE users ADD COLUMN default_video_provider TEXT DEFAULT 'NATIVE';");
        }
        if (!uCols.includes('default_external_video_url')) {
          db.exec("ALTER TABLE users ADD COLUMN default_external_video_url TEXT;");
        }
      }
    } catch (e) {
      console.error('Error migrating sessions & users for teleatendimento:', e);
    }

    // 18. Multi-Tenancy & Clube das Fundadoras Onboarding Schema
    try {
      // 18.1 Tabela de convites de clínicas / onboarding de fundadoras
      db.exec(`
        CREATE TABLE IF NOT EXISTS tenant_invites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          lead_id INTEGER,
          email TEXT NOT NULL,
          name TEXT NOT NULL,
          whatsapp TEXT,
          clinic_name TEXT,
          plan TEXT DEFAULT 'PARCERIA',
          status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED')),
          is_vip_exempt INTEGER DEFAULT 0,
          trial_days INTEGER DEFAULT 90,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          accepted_at DATETIME
        );
      `);

      const inviteSchema = db.exec("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tenant_invites';");
      if (inviteSchema.length > 0 && inviteSchema[0].values && inviteSchema[0].values[0]) {
        const tableSql = String(inviteSchema[0].values[0][0] || '');
        if (tableSql.includes("CHECK(status IN ('PENDING', 'ACCEPTED', 'EXPIRED'))")) {
          db.exec(`
            CREATE TABLE tenant_invites_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              token TEXT UNIQUE NOT NULL,
              lead_id INTEGER,
              email TEXT NOT NULL,
              name TEXT NOT NULL,
              whatsapp TEXT,
              clinic_name TEXT,
              plan TEXT DEFAULT 'PARCERIA',
              status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED')),
              is_vip_exempt INTEGER DEFAULT 0,
              trial_days INTEGER DEFAULT 90,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              expires_at DATETIME NOT NULL,
              accepted_at DATETIME
            );
            INSERT OR IGNORE INTO tenant_invites_new SELECT * FROM tenant_invites;
            DROP TABLE tenant_invites;
            ALTER TABLE tenant_invites_new RENAME TO tenant_invites;
          `);
        }
      }

      // 18.2 Colunas multi-tenant em clinic_settings
      const clinicInfo = db.exec("PRAGMA table_info(clinic_settings);");
      if (clinicInfo.length > 0 && clinicInfo[0].values) {
        const cCols = clinicInfo[0].values.map((r: any[]) => r[1]);
        if (!cCols.includes('plan')) {
          db.exec("ALTER TABLE clinic_settings ADD COLUMN plan TEXT DEFAULT 'PARCERIA';");
        }
        if (!cCols.includes('billing_cycle')) {
          db.exec("ALTER TABLE clinic_settings ADD COLUMN billing_cycle TEXT DEFAULT 'MONTHLY';");
        }
        if (!cCols.includes('subscription_status')) {
          db.exec("ALTER TABLE clinic_settings ADD COLUMN subscription_status TEXT DEFAULT 'ACTIVE';");
        }
        if (!cCols.includes('trial_ends_at')) {
          db.exec("ALTER TABLE clinic_settings ADD COLUMN trial_ends_at DATETIME;");
        }
        if (!cCols.includes('is_vip_exempt')) {
          db.exec("ALTER TABLE clinic_settings ADD COLUMN is_vip_exempt INTEGER DEFAULT 1;");
        }
        if (!cCols.includes('asaas_customer_id')) {
          db.exec("ALTER TABLE clinic_settings ADD COLUMN asaas_customer_id TEXT;");
        }
        if (!cCols.includes('asaas_subscription_id')) {
          db.exec("ALTER TABLE clinic_settings ADD COLUMN asaas_subscription_id TEXT;");
        }
        if (!cCols.includes('owner_user_id')) {
          db.exec("ALTER TABLE clinic_settings ADD COLUMN owner_user_id INTEGER;");
        }
      }

      // Garante que a Clínica 1 seja VIP Isenta Vitalícia
      db.exec("UPDATE clinic_settings SET is_vip_exempt = 1, subscription_status = 'ACTIVE', plan = 'CLINICA' WHERE id = 1;");

      // 18.3 Colunas multi-tenant em users
      const usersInfo = db.exec("PRAGMA table_info(users);");
      if (usersInfo.length > 0 && usersInfo[0].values) {
        const uCols = usersInfo[0].values.map((r: any[]) => r[1]);
        if (!uCols.includes('clinic_id')) {
          db.exec("ALTER TABLE users ADD COLUMN clinic_id INTEGER DEFAULT 1;");
        }
        if (!uCols.includes('is_superadmin')) {
          db.exec("ALTER TABLE users ADD COLUMN is_superadmin INTEGER DEFAULT 0;");
        }
      }

      // 18.4 Coluna clinic_id em tabelas de domínio do consultório
      const domainTables = [
        'patients', 'sessions', 'medical_records', 'confidential_notes',
        'documents', 'patient_documents', 'document_templates',
        'financial_transactions', 'expenses', 'agenda_events',
        'invoices', 'rooms', 'billing_contacts'
      ];

      for (const tName of domainTables) {
        try {
          const tInfo = db.exec(`PRAGMA table_info(${tName});`);
          if (tInfo.length > 0 && tInfo[0].values) {
            const cols = tInfo[0].values.map((r: any[]) => r[1]);
            if (!cols.includes('clinic_id')) {
              db.exec(`ALTER TABLE ${tName} ADD COLUMN clinic_id INTEGER DEFAULT 1;`);
            }
          }
        } catch (colErr) {
          // ignora se tabela ainda não existir
        }
      }

      // 18.5 Seed de SuperAdmin e Dra. Sandra
      const salt = bcrypt.genSaltSync(10);
      const defaultPassHash = bcrypt.hashSync('senha123', salt);

      // Atualiza admin padrão como SuperAdmin
      db.exec("UPDATE users SET is_superadmin = 1 WHERE email = 'admin@psicogestao.com.br';");

      // Insere Sergio D'Arduini (SuperAdmin) se não existir
      db.run(`
        INSERT OR IGNORE INTO users (name, email, password_hash, role, role_id, is_superadmin, clinic_id, status)
        VALUES ('Sergio D''Arduini', 'sergio@psicogestao.com.br', ?, 'ADMIN', 1, 1, 1, 'ACTIVE');
      `, [defaultPassHash]);

      // Insere Dra. Sandra Sorgatti D'Arduini se não existir
      db.run(`
        INSERT OR IGNORE INTO users (name, email, password_hash, role, role_id, crp_number, is_superadmin, clinic_id, status)
        VALUES ('Dra. Sandra Sorgatti D''Arduini', 'sandra@psicogestao.com.br', ?, 'ADMIN', 1, 'CRP 06/162626', 0, 1, 'ACTIVE');
      `, [defaultPassHash]);

    } catch (e) {
      console.error('Error applying multi-tenancy migrations in migrateTables:', e);
    }

    // 19. Convênios, Tabela TUSS Multidisciplinar e Autorizações de Guias (Fase 1)
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS health_insurances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clinic_id INTEGER DEFAULT 1,
          name TEXT NOT NULL,
          ans_code TEXT,
          cnpj TEXT,
          payment_deadline_days INTEGER DEFAULT 30,
          submission_cut_day INTEGER DEFAULT 25,
          status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
          repasse_default_mode TEXT DEFAULT 'FIXED' CHECK(repasse_default_mode IN ('FIXED', 'PERCENTAGE')),
          repasse_default_value REAL DEFAULT 50.0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_health_insurances_clinic ON health_insurances(clinic_id);

        CREATE TABLE IF NOT EXISTS tuss_procedures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL,
          category TEXT NOT NULL CHECK(category IN ('PSICOLOGIA', 'NEUROPSICOLOGIA', 'FONOAUDIOLOGIA', 'TERAPIA_OCUPACIONAL', 'PSIQUIATRIA', 'OUTROS')),
          standard_session_minutes INTEGER DEFAULT 50,
          default_suggested_price REAL DEFAULT 150.00,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_tuss_code ON tuss_procedures(code);

        CREATE TABLE IF NOT EXISTS health_insurance_prices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          insurance_id INTEGER NOT NULL,
          tuss_id INTEGER NOT NULL,
          agreed_price REAL NOT NULL,
          copay_price REAL DEFAULT 0.00,
          repasse_fixed_amount REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (insurance_id) REFERENCES health_insurances(id) ON DELETE CASCADE,
          FOREIGN KEY (tuss_id) REFERENCES tuss_procedures(id) ON DELETE CASCADE,
          UNIQUE(insurance_id, tuss_id)
        );

        CREATE TABLE IF NOT EXISTS patient_authorizations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clinic_id INTEGER DEFAULT 1,
          patient_id INTEGER NOT NULL,
          insurance_id INTEGER NOT NULL,
          tuss_id INTEGER,
          card_number TEXT NOT NULL,
          card_validity TEXT,
          plan_name TEXT,
          guide_number TEXT NOT NULL,
          auth_date DATE,
          valid_until DATE NOT NULL,
          total_sessions_authorized INTEGER NOT NULL,
          executed_sessions_count INTEGER NOT NULL DEFAULT 0,
          doctor_referral_crm TEXT,
          doctor_referral_name TEXT,
          doctor_referral_cid TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELED')),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
          FOREIGN KEY (insurance_id) REFERENCES health_insurances(id),
          FOREIGN KEY (tuss_id) REFERENCES tuss_procedures(id)
        );
        CREATE INDEX IF NOT EXISTS idx_patient_auth_patient ON patient_authorizations(patient_id);
        CREATE INDEX IF NOT EXISTS idx_patient_auth_status ON patient_authorizations(status);
      `);

      // Colunas em sessions para suporte a convênio
      const sessInfo = db.exec("PRAGMA table_info(sessions);");
      if (sessInfo.length > 0 && sessInfo[0].values) {
        const sCols = sessInfo[0].values.map((r: any[]) => r[1]);
        if (!sCols.includes('insurance_id')) {
          db.exec("ALTER TABLE sessions ADD COLUMN insurance_id INTEGER REFERENCES health_insurances(id);");
        }
        if (!sCols.includes('authorization_id')) {
          db.exec("ALTER TABLE sessions ADD COLUMN authorization_id INTEGER REFERENCES patient_authorizations(id);");
        }
        if (!sCols.includes('tuss_code')) {
          db.exec("ALTER TABLE sessions ADD COLUMN tuss_code TEXT;");
        }
        if (!sCols.includes('billing_modality')) {
          db.exec("ALTER TABLE sessions ADD COLUMN billing_modality TEXT DEFAULT 'PRIVATE';");
        }
      }

      // Colunas em patients para atalhos de convênio
      const ptInfo = db.exec("PRAGMA table_info(patients);");
      if (ptInfo.length > 0 && ptInfo[0].values) {
        const pCols = ptInfo[0].values.map((r: any[]) => r[1]);
        if (!pCols.includes('insurance_id')) {
          db.exec("ALTER TABLE patients ADD COLUMN insurance_id INTEGER REFERENCES health_insurances(id);");
        }
        if (!pCols.includes('insurance_card_number')) {
          db.exec("ALTER TABLE patients ADD COLUMN insurance_card_number TEXT;");
        }
        if (!pCols.includes('insurance_card_validity')) {
          db.exec("ALTER TABLE patients ADD COLUMN insurance_card_validity TEXT;");
        }
        if (!pCols.includes('insurance_plan_name')) {
          db.exec("ALTER TABLE patients ADD COLUMN insurance_plan_name TEXT;");
        }
      }

      // Seed do Catálogo TUSS Multidisciplinar Inicial
      const tussCount = db.exec("SELECT count(*) FROM tuss_procedures;");
      if (tussCount.length === 0 || !tussCount[0].values || Number(tussCount[0].values[0][0]) === 0) {
        const defaultTuss = [
          { code: '50000470', desc: 'Consulta / Sessão de Psicoterapia Individual', cat: 'PSICOLOGIA', min: 50, price: 150 },
          { code: '50000488', desc: 'Psicoterapia de Grupo / Familiar (por paciente)', cat: 'PSICOLOGIA', min: 60, price: 100 },
          { code: '50000569', desc: 'Avaliação Neuropsicológica (sessão / bateria)', cat: 'NEUROPSICOLOGIA', min: 60, price: 280 },
          { code: '50000143', desc: 'Sessão de Reabilitação Fonoaudiológica', cat: 'FONOAUDIOLOGIA', min: 45, price: 140 },
          { code: '50000151', desc: 'Avaliação Fonoaudiológica Completa', cat: 'FONOAUDIOLOGIA', min: 60, price: 220 },
          { code: '50000305', desc: 'Atendimento em Terapia Ocupacional Individual', cat: 'TERAPIA_OCUPACIONAL', min: 50, price: 150 },
          { code: '50000321', desc: 'Terapia Ocupacional Especializada (Integração Sensorial / Neuromotora)', cat: 'TERAPIA_OCUPACIONAL', min: 50, price: 200 },
          { code: '10101012', desc: 'Consulta Médica Eletiva em Consultório (Psiquiatria)', cat: 'PSIQUIATRIA', min: 50, price: 350 },
        ];

        for (const t of defaultTuss) {
          db.run(`
            INSERT OR IGNORE INTO tuss_procedures (code, description, category, standard_session_minutes, default_suggested_price)
            VALUES (?, ?, ?, ?, ?);
          `, [t.code, t.desc, t.cat, t.min, t.price]);
        }
      }

      // Seed das Principais Operadoras de Saúde
      const insCount = db.exec("SELECT count(*) FROM health_insurances WHERE clinic_id = 1;");
      if (insCount.length === 0 || !insCount[0].values || Number(insCount[0].values[0][0]) === 0) {
        const defaultInsurances = [
          { name: 'Bradesco Saúde', ans: '005711', cnpj: '92.693.118/0001-60', deadline: 30, cut: 25, repasse: 55.0 },
          { name: 'Amil Assistência Médica', ans: '326305', cnpj: '29.309.127/0001-79', deadline: 30, cut: 20, repasse: 50.0 },
          { name: 'SulAmérica Saúde', ans: '006246', cnpj: '01.685.053/0001-56', deadline: 30, cut: 25, repasse: 60.0 },
          { name: 'Unimed Central', ans: '305715', cnpj: '02.812.468/0001-06', deadline: 45, cut: 15, repasse: 48.0 },
          { name: 'Porto Saúde', ans: '000582', cnpj: '04.884.219/0001-06', deadline: 30, cut: 28, repasse: 65.0 },
          { name: 'Cassi', ans: '346659', cnpj: '33.719.485/0001-27', deadline: 30, cut: 20, repasse: 70.0 },
        ];

        for (const ins of defaultInsurances) {
          db.run(`
            INSERT INTO health_insurances (clinic_id, name, ans_code, cnpj, payment_deadline_days, submission_cut_day, repasse_default_mode, repasse_default_value)
            VALUES (1, ?, ?, ?, ?, ?, 'FIXED', ?);
          `, [ins.name, ins.ans, ins.cnpj, ins.deadline, ins.cut, ins.repasse]);
        }
      }
    } catch (e) {
      console.error('Error applying health insurance migrations in migrateTables:', e);
    }
  } catch (err) {
    console.error('Migration error in db:', err);
  }
}

function seedInitialData(db: any) {
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('senha123', salt);

  // 1. Users
  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, password_hash, role, role_id, crp_number) VALUES
    (1, 'Dr. Marcos Silveira', 'marcos@psicogestao.com.br', ?, 'PSYCHOLOGIST', 2, 'CRP 06/128945-SP'),
    (2, 'Ana Beatriz Lima', 'ana@psicogestao.com.br', ?, 'SECRETARY', 3, NULL),
    (3, 'Dra. Helena Martins', 'admin@psicogestao.com.br', ?, 'ADMIN', 1, 'CRP 06/999999-SP');
  `, [passwordHash, passwordHash, passwordHash]);

  // 2. Patients
  const addr1 = JSON.stringify({ street: 'Rua das Flores', number: '123', complement: 'Apto 42', neighborhood: 'Jardim Primavera', city: 'São Paulo', state: 'SP', zipCode: '01234-567' });
  const contacts1 = JSON.stringify([{ name: 'Maria Silva', relationship: 'Mãe', phone: '(11) 91111-2222' }]);
  
  const addr2 = JSON.stringify({ street: 'Av. Paulista', number: '1000', complement: 'Sala 1502', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', zipCode: '01310-100' });
  const contacts2 = JSON.stringify([{ name: 'João Alves', relationship: 'Cônjuge', phone: '(11) 93333-4444' }]);
  
  const addr3 = JSON.stringify({ street: 'Rua Vergueiro', number: '500', complement: 'Casa', neighborhood: 'Liberdade', city: 'São Paulo', state: 'SP', zipCode: '01504-000' });
  const contacts3 = JSON.stringify([{ name: 'Juliana Mendes', relationship: 'Mãe', phone: '(11) 99112-2334' }]);
  const guardian3 = JSON.stringify({
    fullName: 'Juliana Mendes Souza',
    relationship: 'Mãe',
    email: 'juliana.mendes@email.com',
    phone: '(11) 99112-2334',
    cpf: '111.444.777-35',
    rg: '29.845.123-4',
    birthDate: '1986-08-24'
  });
  const financialResponsible3 = JSON.stringify({
    isSameAsGuardian: true,
    fullName: 'Juliana Mendes Souza',
    relationship: 'Mãe',
    phone: '(11) 99112-2334',
    cpf: '111.444.777-35',
    email: 'juliana.mendes@email.com'
  });

  db.run(`
    INSERT OR IGNORE INTO patients (
      id, psychologist_id, full_name, cpf, phone, status, lgpd_consent_at, birth_date, email, notes_basic,
      group_type, rg, gender, financial_plan_type, session_price, address_json, emergency_contacts_json,
      birthplace, education, race, profession, guardian_json, financial_responsible_json
    ) VALUES
    (1, 1, 'Lucas Gabriel Ferreira', '111.444.777-35', '(11) 98765-4321', 'ACTIVE', '2026-01-10 10:00:00', '1994-06-15', 'lucas.ferreira@email.com', 'Encaminhado por clínico geral com queixa de ansiedade.',
     'Adulto', '38.492.103-8', 'Homem cisgênero', 'Por Sessão', 200.00, ?, ?, 'São Paulo - SP', 'Ensino Superior Completo', 'Branca', 'Analista de Sistemas', NULL, NULL),
    (2, 1, 'Mariana Souza Alves', '222.555.888-46', '(11) 97654-3210', 'ACTIVE', '2026-02-01 14:30:00', '1988-11-20', 'mariana.alves@email.com', 'Demanda de estresse no trabalho e regulação emocional.',
     'Adulto', '42.189.765-1', 'Mulher cisgênero', 'Mensal', 220.00, ?, ?, 'Campinas - SP', 'Pós-graduação / Especialização', 'Parda', 'Gerente de Recursos Humanos', NULL, NULL),
    (3, 1, 'Enzo Gabriel Souza', '333.666.999-57', '', 'ACTIVE', '2026-02-15 09:00:00', '2018-04-12', 'enzo.souza@email.com', 'Atendimento infantil lúdico; avaliação de dificuldades de concentração escolar.',
     'Criança', '58.321.490-X', 'Homem cisgênero', 'Convênio', 190.00, ?, ?, 'São Paulo - SP', 'Ensino Fundamental Incompleto', 'Branca', 'Estudante', ?, ?);
  `, [addr1, contacts1, addr2, contacts2, addr3, contacts3, guardian3, financialResponsible3]);

  // 3. Sessions (Today & this week)
  const today = new Date().toISOString().split('T')[0];
  db.run(`
    INSERT OR IGNORE INTO sessions (id, psychologist_id, patient_id, start_time, end_time, status, modality, price, notes) VALUES
    (1, 1, 1, '${today}T09:00:00', '${today}T09:50:00', 'CONFIRMED', 'PRESENTIAL', 200.00, 'Sessão semanal recorrente'),
    (2, 1, 2, '${today}T11:00:00', '${today}T11:50:00', 'SCHEDULED', 'ONLINE', 220.00, 'Atendimento via Google Meet'),
    (3, 1, 3, '${today}T14:00:00', '${today}T14:50:00', 'SCHEDULED', 'PRESENTIAL', 190.00, 'Sessão presencial'),
    (4, 1, 1, '${today}T16:00:00', '${today}T16:50:00', 'CONFIRMED', 'ONLINE', 200.00, 'Sessão extra pontual'),
    (5, 1, 2, '2026-09-08T10:00:00', '2026-09-08T10:50:00', 'COMPLETED', 'ONLINE', 220.00, 'Concluída'),
    (6, 1, 3, '2026-09-09T14:00:00', '2026-09-09T14:50:00', 'NO_SHOW', 'PRESENTIAL', 190.00, 'Paciente desmarcou em cima da hora');
  `);

  // 4. Medical records (AES-256-GCM encrypted)
  const rawDapRecord = JSON.stringify({
    dados: 'Paciente relata melhora na qualidade do sono após introdução de rotina de higiene do sono.',
    avaliacao: 'Sintomas de ansiedade generalizada em remissão parcial. Apresenta boa aliança terapêutica.',
    plano: 'Manter registro de pensamentos automáticos disfuncionais e técnicas de respiração diafragmática.'
  });
  const encDap = encryptClinicalText(rawDapRecord);
  const dapHash = generateSHA256(rawDapRecord + ' - Dr. Marcos Silveira CRP 06/128945-SP');

  db.run(`
    INSERT OR IGNORE INTO medical_records (id, patient_id, session_id, psychologist_id, record_type, encrypted_content, encryption_iv, auth_tag, is_signed, hash_sha256, signed_at, signed_by_user_id) VALUES
    (1, 1, 1, 1, 'DAP', ?, ?, ?, 1, ?, '${today} 10:00:00', 1);
  `, [encDap.encryptedContent, encDap.iv, encDap.authTag, dapHash]);

  // 5. Confidential notes (Exclusive to Psychologist)
  const rawConfidential = 'Hipótese diagnóstica reservada: observar dinâmica com cônjuge que pode estar atuando como gatilho disfuncional. Não compartilhar em relatório externo.';
  const encConf = encryptClinicalText(rawConfidential);
  db.run(`
    INSERT OR IGNORE INTO confidential_notes (id, patient_id, psychologist_id, encrypted_content, encryption_iv, auth_tag) VALUES
    (1, 1, 1, ?, ?, ?);
  `, [encConf.encryptedContent, encConf.iv, encConf.authTag]);

  // 6. Psychological scales (PHQ-9 and GAD-7)
  db.run(`
    INSERT OR IGNORE INTO psychological_scales (id, patient_id, psychologist_id, scale_type, answers_json, total_score, severity, created_at) VALUES
    (1, 1, 1, 'GAD7', '{"q1":2,"q2":2,"q3":1,"q4":2,"q5":1,"q6":2,"q7":1}', 11, 'Moderada', '2026-08-15 11:30:00'),
    (2, 1, 1, 'GAD7', '{"q1":1,"q2":1,"q3":1,"q4":1,"q5":0,"q6":1,"q7":1}', 6, 'Leve', '2026-09-05 10:15:00'),
    (3, 1, 1, 'PHQ9', '{"q1":1,"q2":1,"q3":0,"q4":1,"q5":1,"q6":0,"q7":1,"q8":0,"q9":0}', 5, 'Leve', '2026-09-05 10:30:00');
  `);

  // 7. Financial transactions
  db.run(`
    INSERT OR IGNORE INTO financial_transactions (id, patient_id, session_id, amount, status, payment_method, transaction_date, paid_at, notes) VALUES
    (1, 1, 1, 200.00, 'PAID', 'PIX', '${today}', '${today} 09:55:00', 'PIX recebido - Banco Inter'),
    (2, 2, 2, 220.00, 'PENDING', 'PIX', '${today}', NULL, 'Aguardando comprovante'),
    (3, 3, 3, 190.00, 'PENDING', 'CARTAO', '${today}', NULL, 'Pagamento em maquininha ao final'),
    (4, 2, 5, 220.00, 'PAID', 'PIX', '2026-09-08', '2026-09-08 11:00:00', 'PIX quitado'),
    (5, 3, 6, 190.00, 'PENDING', 'BOLETO', '2026-09-09', NULL, 'Cobrança de falta conforme contrato terapêutico');
  `);

  // 8. Documents CFP compliant
  const docContent = JSON.stringify({
    identificacao: 'Psicólogo Dr. Marcos Silveira (CRP 06/128945-SP). Paciente: Lucas Gabriel Ferreira, CPF 345.892.128-40.',
    demanda: 'Solicitação do paciente para comprovação de acompanhamento psicoterápico para fins de flexibilização de escala de trabalho.',
    procedimento: 'Realização de 12 sessões semanais de psicoterapia na abordagem Cognitivo-Comportamental com aplicação de inventários de rastreio.',
    analise: 'O paciente vem apresentando aderência satisfatória ao processo terapêutico, desenvolvendo repertório de enfrentamento e manejo de sintomas ansiogênicos.',
    conclusao: 'Declara-se que o paciente encontra-se em acompanhamento psicológico regular neste consultório.'
  });
  const docHash = generateSHA256(docContent);
  db.run(`
    INSERT OR IGNORE INTO documents (id, patient_id, psychologist_id, document_type, content_json, hash_sha256, is_signed) VALUES
    (1, 1, 1, 'DECLARACAO', ?, ?, 1);
  `, [docContent, docHash]);

  // 9. Initial Audit Log
  db.run(`
    INSERT OR IGNORE INTO audit_logs (user_id, action, resource, ip_address, timestamp, details) VALUES
    (1, 'SYSTEM_INIT', 'DATABASE', '127.0.0.1', CURRENT_TIMESTAMP, 'Inicialização do banco com criptografia AES-256 e conformidade LGPD/CFP'),
    (1, 'SIGN_RECORD', 'MEDICAL_RECORD #1', '192.168.1.10', CURRENT_TIMESTAMP, 'Assinatura digital e geração de hash SHA-256 para prontuário');
  `);

  // 9.1 Templates de Documentos CFP (Nativos)
  const atestadoBlocks = JSON.stringify([
    { id: '1', title: 'Identificação', content: 'Atesto, para os devidos fins, que @paciente.nome (CPF: @paciente.cpf), encontra-se em acompanhamento psicológico neste consultório, sob meus cuidados profissionais.' },
    { id: '2', title: 'Recomendação', content: 'Sugere-se afastamento de suas atividades por X dias por motivos de saúde.' },
    { id: '3', title: 'Encerramento', content: 'Sem mais,\n\n@clinica.nome_profissional\nPsicólogo(a) - CRP: @clinica.crp' }
  ]);
  const declaracaoBlocks = JSON.stringify([
    { id: '1', title: 'Declaração', content: 'Declaro para os devidos fins que @paciente.nome compareceu a este consultório psicológico na data de @data.hoje, no período das ___ às ___ horas, para sessão de psicoterapia.' },
    { id: '2', title: 'Encerramento', content: 'Sem mais,\n\n@clinica.nome_profissional\nPsicólogo(a) - CRP: @clinica.crp' }
  ]);

  db.run(`
    INSERT OR IGNORE INTO document_templates (id, psychologist_id, title, document_type, content_json) VALUES
    (1, NULL, 'Atestado Psicológico (Padrão CFP 06/2019)', 'ATESTADO', ?),
    (2, NULL, 'Declaração de Comparecimento', 'DECLARACAO', ?)
  `, [atestadoBlocks, declaracaoBlocks]);

  // 10. Clinic Settings Seed
  db.run(`
    INSERT OR IGNORE INTO clinic_settings (id, clinic_name, cnpj, phone, email, address, logo_base64) VALUES
    (1, 'PsicoGestão', '00.000.000/0001-00', '(11) 99999-9999', 'contato@psicogestao.com.br', 'Av. Paulista, 1000 - São Paulo, SP', NULL);
  `);
}

function seedCleanProductionData(db: any) {
  const adminName = process.env.ADMIN_NAME || 'Dra. Administradora';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@consultorio.com.br').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminCrp = process.env.ADMIN_CRP || 'CRP 06/000000-SP';
  const clinicName = process.env.CLINIC_NAME || 'Meu Consultório de Psicologia';

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(adminPassword, salt);

  // 1. Initial Admin User (Psicóloga Titular / Administradora Oficial)
  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, password_hash, role, role_id, crp_number) VALUES
    (1, ?, ?, ?, 'ADMIN', 1, ?);
  `, [adminName, adminEmail, passwordHash, adminCrp]);

  // 2. CFP Document Templates (Atestado & Declaração normativos indispensáveis)
  const atestadoBlocks = JSON.stringify([
    { id: '1', title: 'Identificação', content: 'Atesto, para os devidos fins, que @paciente.nome (CPF: @paciente.cpf), encontra-se em acompanhamento psicológico neste consultório, sob meus cuidados profissionais.' },
    { id: '2', title: 'Recomendação', content: 'Sugere-se afastamento de suas atividades por X dias por motivos de saúde.' },
    { id: '3', title: 'Encerramento', content: 'Sem mais,\n\n@clinica.nome_profissional\nPsicólogo(a) - CRP: @clinica.crp' }
  ]);
  const declaracaoBlocks = JSON.stringify([
    { id: '1', title: 'Declaração', content: 'Declaro para os devidos fins que @paciente.nome compareceu a este consultório psicológico na data de @data.hoje, no período das ___ às ___ horas, para sessão de psicoterapia.' },
    { id: '2', title: 'Encerramento', content: 'Sem mais,\n\n@clinica.nome_profissional\nPsicólogo(a) - CRP: @clinica.crp' }
  ]);

  db.run(`
    INSERT OR IGNORE INTO document_templates (id, psychologist_id, title, document_type, content_json) VALUES
    (1, NULL, 'Atestado Psicológico (Padrão CFP 06/2019)', 'ATESTADO', ?),
    (2, NULL, 'Declaração de Comparecimento', 'DECLARACAO', ?)
  `, [atestadoBlocks, declaracaoBlocks]);

  // 3. Clean Clinic Settings
  db.run(`
    INSERT OR IGNORE INTO clinic_settings (id, clinic_name, cnpj, phone, email, address, logo_base64) VALUES
    (1, ?, '', '', ?, '', NULL);
  `, [clinicName, adminEmail]);

  // 4. Initial Audit Log
  db.run(`
    INSERT OR IGNORE INTO audit_logs (user_id, action, resource, ip_address, timestamp, details) VALUES
    (1, 'SYSTEM_INIT_CLEAN', 'DATABASE', '127.0.0.1', CURRENT_TIMESTAMP, 'Inicialização de banco limpo em branco para produção/consultório real');
  `);
}
