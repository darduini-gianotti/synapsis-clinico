import pg from 'pg';

const { Pool } = pg;

let pgPool: pg.Pool | null = null;

export function isPgEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.PG_HOST);
}

export function getPgPool(): pg.Pool | null {
  if (!isPgEnabled()) return null;

  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      pgPool = new Pool({
        connectionString,
        ssl: process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } else {
      pgPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: Number(process.env.PG_PORT) || 5432,
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || '',
        database: process.env.PG_DATABASE || 'psicogestao',
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
      });
    }

    pgPool.on('error', (err) => {
      console.error('[PostgreSQL Pool] Erro inesperado no cliente ocioso:', err);
    });
  }

  return pgPool;
}

/**
 * Executes a PostgreSQL query converting SQLite ? placeholders to $1, $2, etc.
 */
function translatePlaceholders(sql: string): string {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

export async function queryPgAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL não configurado (DATABASE_URL ausente)');
  const translatedSql = translatePlaceholders(sql);
  const result = await pool.query(translatedSql, params);
  return result.rows as T[];
}

export async function queryPgOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryPgAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function executePg(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL não configurado (DATABASE_URL ausente)');
  const translatedSql = translatePlaceholders(sql);
  const result = await pool.query(translatedSql, params);
  return {
    changes: result.rowCount || 0,
    lastInsertRowid: (result.rows && result.rows[0]?.id) ? Number(result.rows[0].id) : 0,
  };
}

/**
 * Initializes full schema on PostgreSQL for production deployment on AWS Lightsail
 */
export async function initPgSchema(): Promise<void> {
  const pool = getPgPool();
  if (!pool) return;

  console.log('🐘 [PostgreSQL] Verificando e inicializando schema multi-tenant na nuvem...');

  const schemaSql = `
    CREATE TABLE IF NOT EXISTS clinic_settings (
      id SERIAL PRIMARY KEY,
      clinic_name TEXT NOT NULL DEFAULT 'PsicoGestão',
      cnpj TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      logo_base64 TEXT,
      accounting_info_json TEXT,
      default_session_price NUMERIC DEFAULT 180.00,
      default_evaluation_price NUMERIC DEFAULT 2400.00,
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
      cancellation_notice_hours INTEGER DEFAULT 24,
      plan TEXT DEFAULT 'PARCERIA',
      billing_cycle TEXT DEFAULT 'MONTHLY',
      subscription_status TEXT DEFAULT 'ACTIVE',
      trial_ends_at TIMESTAMP WITH TIME ZONE,
      is_vip_exempt INTEGER DEFAULT 1,
      asaas_customer_id TEXT,
      asaas_subscription_id TEXT,
      owner_user_id INTEGER,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id),
      permission_id INTEGER NOT NULL REFERENCES permissions(id),
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL DEFAULT 1 REFERENCES clinic_settings(id),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT,
      role_id INTEGER REFERENCES roles(id),
      crp_number TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMP WITH TIME ZONE,
      token_version INTEGER NOT NULL DEFAULT 1,
      is_superadmin INTEGER DEFAULT 0,
      epsi_code TEXT,
      default_video_provider TEXT DEFAULT 'NATIVE',
      default_external_video_url TEXT,
      repasse_mode TEXT DEFAULT 'PERCENTAGE',
      repasse_percentage NUMERIC DEFAULT 50.0,
      repasse_eval_percentage NUMERIC DEFAULT 60.0,
      repasse_fixed_amount NUMERIC,
      pix_key TEXT,
      pix_key_type TEXT,
      bank_info TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_invites (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      lead_id INTEGER,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      whatsapp TEXT,
      clinic_name TEXT,
      plan TEXT DEFAULT 'PARCERIA',
      status TEXT DEFAULT 'PENDING',
      is_vip_exempt INTEGER DEFAULT 0,
      trial_days INTEGER DEFAULT 90,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      accepted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS waitlist_leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL,
      profile TEXT,
      current_software TEXT,
      interested_plan TEXT,
      status TEXT DEFAULT 'PENDING',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL DEFAULT 1 REFERENCES clinic_settings(id),
      psychologist_id INTEGER REFERENCES users(id),
      full_name TEXT NOT NULL,
      cpf TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      lgpd_consent_at TIMESTAMP WITH TIME ZONE NOT NULL,
      birth_date TEXT,
      email TEXT,
      notes_basic TEXT,
      group_type TEXT DEFAULT 'Adulto',
      rg TEXT,
      gender TEXT,
      financial_plan_type TEXT DEFAULT 'Por Sessão',
      session_price NUMERIC,
      address_json TEXT,
      emergency_contacts_json TEXT,
      birthplace TEXT,
      education TEXT,
      race TEXT,
      profession TEXT,
      guardian_json TEXT,
      financial_responsible_json TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL DEFAULT 1 REFERENCES clinic_settings(id),
      psychologist_id INTEGER NOT NULL REFERENCES users(id),
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      start_time TIMESTAMP WITH TIME ZONE NOT NULL,
      end_time TIMESTAMP WITH TIME ZONE NOT NULL,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      modality TEXT NOT NULL DEFAULT 'PRESENTIAL',
      price NUMERIC,
      notes TEXT,
      room_id INTEGER,
      video_provider TEXT DEFAULT 'NATIVE',
      video_room_id TEXT,
      video_external_url TEXT,
      video_status TEXT DEFAULT 'INACTIVE',
      video_started_at TIMESTAMP WITH TIME ZONE,
      video_ended_at TIMESTAMP WITH TIME ZONE,
      patient_joined_at TIMESTAMP WITH TIME ZONE,
      patient_tcle_accepted_at TIMESTAMP WITH TIME ZONE,
      patient_access_token TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medical_records (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL DEFAULT 1 REFERENCES clinic_settings(id),
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      session_id INTEGER REFERENCES sessions(id),
      psychologist_id INTEGER NOT NULL REFERENCES users(id),
      record_type TEXT NOT NULL,
      encrypted_content TEXT NOT NULL,
      encryption_iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      is_signed INTEGER NOT NULL DEFAULT 0,
      hash_sha256 TEXT NOT NULL,
      signed_at TIMESTAMP WITH TIME ZONE,
      signed_by_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS financial_transactions (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL DEFAULT 1 REFERENCES clinic_settings(id),
      patient_id INTEGER REFERENCES patients(id),
      session_id INTEGER REFERENCES sessions(id),
      amount NUMERIC NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      payment_method TEXT,
      transaction_date DATE NOT NULL,
      paid_at TIMESTAMP WITH TIME ZONE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL DEFAULT 1 REFERENCES clinic_settings(id),
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      psychologist_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'REQUESTED',
      total_amount NUMERIC NOT NULL,
      invoice_number TEXT,
      requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      issued_at TIMESTAMP WITH TIME ZONE,
      file_name TEXT,
      file_size INTEGER,
      file_type TEXT,
      file_data TEXT,
      hash_sha256 TEXT,
      notes TEXT,
      emission_mode TEXT DEFAULT 'MANUAL',
      gateway_reference_id TEXT
    );
  `;

  await pool.query(schemaSql);
  console.log('✅ [PostgreSQL] Schema multi-tenant configurado e pronto com sucesso.');
}
