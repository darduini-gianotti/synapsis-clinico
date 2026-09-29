import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { queryOne, queryAll, execute } from '../db.js';
import { encryptClinicalText, decryptClinicalText } from '../crypto.js';

export interface GatewayPublicConfig {
  is_active: boolean;
  provider: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  api_key_masked: string | null;
  has_api_key: boolean;
  webhook_token: string;
  webhook_url: string;
  default_due_days: number;
  fine_percentage: number;
  interest_percentage: number;
}

export interface AsaasCustomerData {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  province?: string;
  postalCode?: string;
}

export interface CreateChargeParams {
  clinicId?: number;
  patientId: number;
  transactionId?: number;
  sessionId?: number;
  evaluationId?: number;
  amount: number;
  dueDate?: string;
  description: string;
  billingType?: 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
  installments?: number;
}

/**
 * Retorna as URLs base de acordo com o ambiente
 */
function getAsaasBaseUrl(environment: 'SANDBOX' | 'PRODUCTION'): string {
  return environment === 'PRODUCTION'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

/**
 * Cria ou recupera um token de webhook exclusivo da clínica
 */
function getOrCreateWebhookToken(clinicId: number): string {
  const row = queryOne<any>(
    'SELECT webhook_token FROM clinic_gateway_settings WHERE clinic_id = ?',
    [clinicId]
  );
  if (row?.webhook_token) {
    return row.webhook_token;
  }
  const newToken = crypto.randomBytes(24).toString('hex');
  return newToken;
}

/**
 * Recupera as credenciais descriptografadas do Asaas para a clínica
 */
export function getInternalGatewayCredentials(clinicId: number = 1): {
  isActive: boolean;
  apiKey: string | null;
  environment: 'SANDBOX' | 'PRODUCTION';
  webhookToken: string;
} {
  const row = queryOne<any>(
    'SELECT is_active, environment, api_key_encrypted, webhook_token FROM clinic_gateway_settings WHERE clinic_id = ?',
    [clinicId]
  );

  if (!row) {
    return {
      isActive: false,
      apiKey: null,
      environment: 'SANDBOX',
      webhookToken: crypto.randomBytes(24).toString('hex'),
    };
  }

  let decryptedKey: string | null = null;
  if (row.api_key_encrypted) {
    try {
      const parsed = JSON.parse(row.api_key_encrypted);
      decryptedKey = decryptClinicalText(parsed);
      if (decryptedKey.startsWith('[ERRO')) {
        decryptedKey = null;
      }
    } catch {
      decryptedKey = null;
    }
  }

  return {
    isActive: Boolean(row.is_active),
    apiKey: decryptedKey,
    environment: (row.environment as 'SANDBOX' | 'PRODUCTION') || 'SANDBOX',
    webhookToken: row.webhook_token || crypto.randomBytes(24).toString('hex'),
  };
}

/**
 * Retorna a configuração pública para exibição na UI mascarando segredos
 */
export function getPublicGatewaySettings(clinicId: number = 1, hostHeader?: string): GatewayPublicConfig {
  const row = queryOne<any>(
    'SELECT is_active, provider, environment, api_key_encrypted, webhook_token, default_due_days, fine_percentage, interest_percentage FROM clinic_gateway_settings WHERE clinic_id = ?',
    [clinicId]
  );

  const internal = getInternalGatewayCredentials(clinicId);
  const webhookToken = row?.webhook_token || getOrCreateWebhookToken(clinicId);

  // Determina URL completa do Webhook
  const host = hostHeader || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const webhookUrl = `${protocol}://${host}/api/webhooks/asaas`;

  let maskedKey: string | null = null;
  if (internal.apiKey && internal.apiKey.length > 8) {
    const prefix = internal.apiKey.slice(0, 6);
    const suffix = internal.apiKey.slice(-4);
    maskedKey = `${prefix}...${suffix}`;
  }

  return {
    is_active: Boolean(row?.is_active),
    provider: row?.provider || 'ASAAS',
    environment: (row?.environment as 'SANDBOX' | 'PRODUCTION') || 'SANDBOX',
    api_key_masked: maskedKey,
    has_api_key: Boolean(internal.apiKey),
    webhook_token: webhookToken,
    webhook_url: webhookUrl,
    default_due_days: row?.default_due_days ?? 3,
    fine_percentage: row?.fine_percentage ?? 0.0,
    interest_percentage: row?.interest_percentage ?? 0.0,
  };
}

/**
 * Salva as credenciais e configurações de integração da clínica
 */
export function saveGatewaySettings(
  clinicId: number = 1,
  data: {
    is_active?: boolean;
    environment?: 'SANDBOX' | 'PRODUCTION';
    api_key?: string;
    default_due_days?: number;
    fine_percentage?: number;
    interest_percentage?: number;
  }
): { success: boolean; message: string } {
  const existing = queryOne<any>(
    'SELECT id, api_key_encrypted, webhook_token FROM clinic_gateway_settings WHERE clinic_id = ?',
    [clinicId]
  );

  let apiKeyEncrypted = existing?.api_key_encrypted;
  if (data.api_key && data.api_key.trim() !== '') {
    const enc = encryptClinicalText(data.api_key.trim());
    apiKeyEncrypted = JSON.stringify(enc);
  }

  const webhookToken = existing?.webhook_token || crypto.randomBytes(24).toString('hex');
  const isActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1;
  const env = data.environment || existing?.environment || 'SANDBOX';
  const dueDays = data.default_due_days ?? existing?.default_due_days ?? 3;
  const fine = data.fine_percentage ?? existing?.fine_percentage ?? 0.0;
  const interest = data.interest_percentage ?? existing?.interest_percentage ?? 0.0;

  if (existing) {
    execute(
      `UPDATE clinic_gateway_settings 
       SET is_active = ?, environment = ?, api_key_encrypted = COALESCE(?, api_key_encrypted),
           webhook_token = ?, default_due_days = ?, fine_percentage = ?, interest_percentage = ?, updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?`,
      [isActive, env, apiKeyEncrypted, webhookToken, dueDays, fine, interest, clinicId]
    );
  } else {
    execute(
      `INSERT INTO clinic_gateway_settings 
       (clinic_id, provider, is_active, environment, api_key_encrypted, webhook_token, default_due_days, fine_percentage, interest_percentage)
       VALUES (?, 'ASAAS', ?, ?, ?, ?, ?, ?, ?)`,
      [clinicId, isActive, env, apiKeyEncrypted, webhookToken, dueDays, fine, interest]
    );
  }

  return { success: true, message: 'Configurações de integração Asaas salvas com sucesso.' };
}

/**
 * Cria uma instância do Axios configurada para a API do Asaas
 */
function createAsaasClient(apiKey: string, environment: 'SANDBOX' | 'PRODUCTION'): AxiosInstance {
  return axios.create({
    baseURL: getAsaasBaseUrl(environment),
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
    timeout: 15000,
  });
}

/**
 * Testa a conexão com a API do Asaas consultando a conta cadastrada
 */
export async function testAsaasConnection(
  apiKey: string,
  environment: 'SANDBOX' | 'PRODUCTION'
): Promise<{
  success: boolean;
  accountName?: string;
  email?: string;
  cpfCnpj?: string;
  status?: string;
  error?: string;
}> {
  try {
    const client = createAsaasClient(apiKey, environment);
    // Endpoint oficial para dados cadastrais da conta
    const res = await client.get('/myAccount');
    return {
      success: true,
      accountName: res.data.name || res.data.tradingName || 'Conta Asaas Homologada',
      email: res.data.email,
      cpfCnpj: res.data.cpfCnpj,
      status: 'CONECTADO',
    };
  } catch (err: any) {
    const errorDetail =
      err.response?.data?.errors?.[0]?.description ||
      err.response?.data?.message ||
      err.message ||
      'Falha de autenticação com a chave de API do Asaas';
    return {
      success: false,
      error: errorDetail,
    };
  }
}

/**
 * Localiza ou cadastra um cliente no Asaas pelo CPF/CNPJ
 */
async function findOrCreateCustomer(
  client: AxiosInstance,
  customer: AsaasCustomerData
): Promise<string> {
  const cleanCpfCnpj = (customer.cpfCnpj || '').replace(/\D/g, '');

  if (cleanCpfCnpj) {
    try {
      const searchRes = await client.get(`/customers?cpfCnpj=${cleanCpfCnpj}`);
      if (searchRes.data?.data && searchRes.data.data.length > 0) {
        return searchRes.data.data[0].id;
      }
    } catch (e) {
      console.warn('Busca de cliente no Asaas por CPF falhou, tentando cadastro direto:', e);
    }
  }

  // Se não encontrou, cadastra novo cliente
  const payload: any = {
    name: customer.name,
    cpfCnpj: cleanCpfCnpj || undefined,
    email: customer.email || undefined,
    mobilePhone: customer.mobilePhone || customer.phone || undefined,
    address: customer.address || undefined,
    addressNumber: customer.addressNumber || undefined,
    province: customer.province || undefined,
    postalCode: customer.postalCode ? customer.postalCode.replace(/\D/g, '') : undefined,
  };

  const createRes = await client.post('/customers', payload);
  return createRes.data.id;
}

/**
 * Cria a cobrança no Asaas e gera PIX Dinâmico + Link de Pagamento
 */
export async function createAsaasCharge(params: CreateChargeParams): Promise<{
  success: boolean;
  paymentId?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixCopyPaste?: string;
  pixQrCodeBase64?: string;
  dueDate?: string;
  amount?: number;
  payerName?: string;
  payerCpf?: string;
  error?: string;
}> {
  const clinicId = params.clinicId || 1;
  const credentials = getInternalGatewayCredentials(clinicId);

  if (!credentials.isActive || !credentials.apiKey) {
    return {
      success: false,
      error: 'Integração Asaas desativada ou chave de API não configurada. Ative nas Configurações da Clínica.',
    };
  }

  // 1. Busca dados do paciente e identifica o Pagador (Regra: menor de idade -> Responsável Financeiro)
  const patient = queryOne<any>('SELECT * FROM patients WHERE id = ?', [params.patientId]);
  if (!patient) {
    return { success: false, error: 'Paciente não encontrado no sistema.' };
  }

  let payerName = patient.full_name;
  let payerCpf = patient.cpf || '';
  let payerPhone = patient.phone || '';
  let payerEmail = patient.email || '';

  // Verifica se há responsável financeiro cadastrado
  if (patient.financial_responsible_json) {
    try {
      const resp = JSON.parse(patient.financial_responsible_json);
      if (resp?.fullName && resp?.cpf) {
        payerName = resp.fullName;
        payerCpf = resp.cpf;
        if (resp.phone) payerPhone = resp.phone;
        if (resp.email) payerEmail = resp.email;
      }
    } catch {}
  } else if (patient.guardian_json && patient.group_type === 'Criança') {
    try {
      const guard = JSON.parse(patient.guardian_json);
      if (guard?.fullName && guard?.cpf) {
        payerName = guard.fullName;
        payerCpf = guard.cpf;
        if (guard.phone) payerPhone = guard.phone;
        if (guard.email) payerEmail = guard.email;
      }
    } catch {}
  }

  // Data de vencimento padrão
  let dueDate = params.dueDate;
  if (!dueDate) {
    const dueDays = 3;
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + dueDays);
    dueDate = dateObj.toISOString().split('T')[0];
  }

  const client = createAsaasClient(credentials.apiKey, credentials.environment);

  try {
    // 2. Localiza ou cria o cliente no Asaas
    const customerId = await findOrCreateCustomer(client, {
      name: payerName,
      cpfCnpj: payerCpf,
      email: payerEmail,
      mobilePhone: payerPhone,
    });

    // 3. Monta payload de pagamento
    const billingType = params.billingType || 'UNDEFINED'; // UNDEFINED permite ao paciente escolher PIX, Boleto ou Cartão
    const paymentPayload: any = {
      customer: customerId,
      billingType: billingType,
      dueDate: dueDate,
      value: Number(params.amount.toFixed(2)),
      description: params.description || `Atendimento Psicológico / Avaliação - ${patient.full_name}`,
      postalService: false,
    };

    // Suporte a parcelamento de pacotes de Neuropsicologia
    if (params.installments && params.installments > 1) {
      paymentPayload.installmentCount = params.installments;
      paymentPayload.installmentValue = Number((params.amount / params.installments).toFixed(2));
    }

    const paymentRes = await client.post('/payments', paymentPayload);
    const paymentData = paymentRes.data;
    const paymentId = paymentData.id;
    const invoiceUrl = paymentData.invoiceUrl || paymentData.bankSlipUrl;

    // 4. Busca QR Code PIX específico da cobrança
    let pixCopyPaste = '';
    let pixQrCodeBase64 = '';

    try {
      const pixRes = await client.get(`/payments/${paymentId}/pixQrCode`);
      if (pixRes.data) {
        pixCopyPaste = pixRes.data.payload || '';
        pixQrCodeBase64 = pixRes.data.encodedImage || '';
      }
    } catch (e) {
      console.warn('Não foi possível obter PIX QR Code imediato do Asaas (pode ser processado assincronamente):', e);
    }

    // 5. Atualiza registro em financial_transactions se fornecido
    if (params.transactionId) {
      execute(
        `UPDATE financial_transactions 
         SET gateway_payment_id = ?, payment_link_url = ?, pix_copy_paste = ?, pix_qr_code_base64 = ?
         WHERE id = ?`,
        [paymentId, invoiceUrl, pixCopyPaste, pixQrCodeBase64, params.transactionId]
      );
    }

    return {
      success: true,
      paymentId,
      invoiceUrl,
      bankSlipUrl: paymentData.bankSlipUrl,
      pixCopyPaste,
      pixQrCodeBase64,
      dueDate,
      amount: params.amount,
      payerName,
      payerCpf,
    };
  } catch (err: any) {
    const errorDetail =
      err.response?.data?.errors?.[0]?.description ||
      err.response?.data?.message ||
      err.message ||
      'Erro ao gerar cobrança no Asaas';
    return {
      success: false,
      error: errorDetail,
    };
  }
}

/**
 * Processa eventos recebidos do Webhook do Asaas
 */
export function handleAsaasWebhookEvent(
  payload: any,
  receivedToken: string | undefined
): { success: boolean; message: string; transactionId?: number } {
  // 1. Valida token de autenticação
  const clinicId = 1;
  const credentials = getInternalGatewayCredentials(clinicId);

  if (credentials.webhookToken && receivedToken !== credentials.webhookToken) {
    return { success: false, message: 'Token de webhook inválido ou não autorizado' };
  }

  const event = payload?.event;
  const payment = payload?.payment;

  if (!payment?.id) {
    return { success: false, message: 'Payload do webhook sem identificador de pagamento' };
  }

  const paymentId = payment.id;

  // Busca transação vinculada no banco
  const tx = queryOne<any>(
    'SELECT id, patient_id, session_id, status FROM financial_transactions WHERE gateway_payment_id = ?',
    [paymentId]
  );

  if (!tx) {
    return { success: true, message: `Cobrança ${paymentId} não associada a transação local ativa.` };
  }

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    const method =
      payment.billingType === 'PIX'
        ? 'PIX'
        : payment.billingType === 'CREDIT_CARD'
        ? 'CARTAO'
        : 'BOLETO';

    execute(
      `UPDATE financial_transactions 
       SET status = 'PAID', paid_at = ?, payment_method = ?, auto_reconciled = 1, auto_reconciled_at = ?
       WHERE id = ?`,
      [timestamp, method, timestamp, tx.id]
    );

    // Se houver sessão vinculada, confirma comparecimento/status
    if (tx.session_id) {
      execute(
        `UPDATE sessions SET status = 'CONFIRMED' WHERE id = ? AND status = 'SCHEDULED'`,
        [tx.session_id]
      );
    }

    // Registra na trilha de auditoria LGPD
    execute(
      `INSERT INTO audit_logs (user_id, action, resource, ip_address, timestamp, details)
       VALUES (NULL, 'GATEWAY_AUTO_RECONCILE', 'FINANCIAL_TRANSACTION #' || ?, '127.0.0.1 (ASAAS_WEBHOOK)', CURRENT_TIMESTAMP, ?)`,
      [tx.id, `Liquidação automática via Webhook Asaas (${event}) - Valor: R$ ${payment.value || 0}`]
    );

    return {
      success: true,
      message: `Transação #${tx.id} conciliada automaticamente como PAGA.`,
      transactionId: tx.id,
    };
  }

  if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') {
    execute(
      `UPDATE financial_transactions 
       SET status = 'PENDING', auto_reconciled = 0
       WHERE id = ?`,
      [tx.id]
    );

    return {
      success: true,
      message: `Transação #${tx.id} atualizada após estorno/cancelamento (${event}).`,
      transactionId: tx.id,
    };
  }

  return { success: true, message: `Evento ${event} registrado sem alteração de status.` };
}
