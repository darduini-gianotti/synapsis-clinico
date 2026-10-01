export type UserRole = 'ADMIN' | 'PSYCHOLOGIST' | 'SECRETARY';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  role_id?: number;
  crp_number: string | null;
  permissions?: string[];
  repasse_mode?: 'PERCENTAGE' | 'FIXED_PER_SESSION';
  repasse_percentage?: number;
  repasse_eval_percentage?: number;
  repasse_fixed_amount?: number | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_info?: string | null;
}

export interface RepasseBatchItem {
  id?: number;
  batch_id?: number;
  session_id?: number | null;
  evaluation_id?: number | null;
  patient_id: number;
  patient_name?: string;
  service_type: string;
  service_label?: string;
  service_date: string;
  gross_amount?: number | null;
  repasse_rate: number;
  repasse_amount: number;
  payment_method?: string;
  paid_at?: string;
}

export interface RepasseAdjustment {
  id?: number;
  batch_id?: number;
  adjustment_type: 'DEDUCTION' | 'ADDITION';
  description: string;
  amount: number;
}

export interface RepasseBatch {
  id: number;
  batch_number: string;
  psychologist_id: number;
  psychologist_name?: string;
  psychologist_crp?: string;
  psychologist_pix_key?: string;
  psychologist_pix_key_type?: string;
  period_start: string;
  period_end: string;
  status: 'OPEN' | 'CLOSED' | 'PAID';
  total_sessions_count: number;
  gross_total_amount?: number | null;
  repasse_subtotal: number;
  deductions_amount: number;
  additions_amount: number;
  net_repasse_amount: number;
  notes?: string | null;
  closed_at?: string | null;
  closed_by_name?: string | null;
  paid_at?: string | null;
  paid_by_name?: string | null;
  payment_date?: string | null;
  payment_method?: string | null;
  expense_id?: number | null;
}

export type PatientGroup = 'Criança' | 'Adolescente' | 'Adulto' | 'Idoso';

export type FinancialPlanType = 'Por Sessão' | 'Mensal' | 'Convênio' | 'Isento';

export type GenderOption =
  | 'Mulher cisgênero'
  | 'Homem cisgênero'
  | 'Mulher transgênero'
  | 'Homem transgênero'
  | 'Não-binário'
  | 'Travesti'
  | 'Agênero'
  | 'Outro'
  | 'Prefiro não informar';

export type EducationOption =
  | 'Não alfabetizado'
  | 'Ensino Fundamental Incompleto'
  | 'Ensino Fundamental Completo'
  | 'Ensino Médio Incompleto'
  | 'Ensino Médio Completo'
  | 'Ensino Superior Incompleto'
  | 'Ensino Superior Completo'
  | 'Pós-graduação / Especialização'
  | 'Mestrado'
  | 'Doutorado';

export type RaceOption =
  | 'Branca'
  | 'Preta'
  | 'Parda'
  | 'Amarela'
  | 'Indígena'
  | 'Outra / Não declarada';

export interface EmergencyContact {
  fullName: string;
  relationship: string;
  phone: string;
}

export interface PatientAddress {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface GuardianData {
  fullName: string;
  email: string;
  phone: string;
  cpf: string;
  rg?: string;
  birthDate?: string;
  relationship?: string;
  isFinancialResponsible?: boolean;
}

export interface FinancialResponsibleData {
  isSameAsGuardian?: boolean;
  fullName: string;
  relationship?: string;
  phone: string;
  cpf?: string;
  email?: string;
  notes?: string;
}

export type WhatsAppAppointmentChannel = 'PATIENT' | 'GUARDIAN';
export type WhatsAppFinancialChannel = 'PATIENT' | 'GUARDIAN' | 'FINANCIAL_RESPONSIBLE';

export interface WhatsAppRoutingConfig {
  appointmentChannel: WhatsAppAppointmentChannel;
  financialChannel: WhatsAppFinancialChannel;
}

export interface Patient {
  id: number;
  psychologist_id: number;
  // 1) Dados Cadastrais
  full_name: string;
  group: PatientGroup;
  birth_date?: string;
  email?: string;
  phone: string;
  cpf: string;
  rg?: string;
  gender?: string;

  // 2) Plano Financeiro
  financial_plan_type?: FinancialPlanType;
  session_price?: number;
  financial_responsible?: FinancialResponsibleData;

  // 3) Endereço
  address?: PatientAddress;

  // 4) Contatos de Emergência (2 contatos)
  emergency_contacts?: EmergencyContact[];

  // 5) Dados Adicionais
  birthplace?: string;
  education?: string;
  race?: string;
  profession?: string;

  // 6) Dados do Responsável
  guardian?: GuardianData;

  // 7) Comunicação e Roteamento WhatsApp
  whatsapp_routing?: WhatsAppRoutingConfig;

  // 8) Synapsis Paciente (Acesso ao Portal & Mensagens no App)
  psychologist_chat_override?: 'ENABLED' | 'DISABLED' | null;
  portal_access_enabled?: boolean;
  portal_invite_token?: string | null;
  portal_invite_sent_at?: string | null;
  portal_invite_expires_at?: string | null;
  portal_first_access_at?: string | null;
  portal_last_login_at?: string | null;

  // Sistema & LGPD
  status: 'ACTIVE' | 'INACTIVE' | 'DISCHARGED';
  lgpd_consent_at: string;
  notes_basic?: string;
  created_at: string;
  psychologist_name?: string;
}

export type SessionCancellationReason = 'PATIENT' | 'PSYCHOLOGIST' | null;
export type SessionStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED' | 'NO_SHOW' | 'CANCELED_BY_PATIENT' | 'CANCELED_BY_PSYCHOLOGIST';
export type SessionModality = 'ONLINE' | 'PRESENTIAL';

export interface Session {
  id: number;
  psychologist_id: number;
  patient_id: number;
  start_time: string;
  end_time: string;
  status: SessionStatus;
  cancellation_reason?: SessionCancellationReason;
  modality: SessionModality;
  price: number;
  notes?: string;
  patient_name: string;
  patient_phone: string;
  patient_cpf: string;
  psychologist_name: string;
  payment_status?: 'PAID' | 'PENDING';
  recurrence_group_id?: string;
  recurrence_pattern?: string;
  evaluation_id?: number | null;
  session_type?: 'PSYCHOTHERAPY' | 'EVALUATION';
  room_id?: number | null;
  room_name?: string | null;
  room_initials?: string | null;
  room_color?: string | null;
  room_type?: string | null;
  presence_status?: PresenceStatus | null;
  video_provider?: 'NATIVE' | 'EXTERNAL' | null;
  video_room_id?: string | null;
  video_external_url?: string | null;
  video_status?: 'INACTIVE' | 'OPEN' | 'ACTIVE' | 'FINISHED' | null;
  video_started_at?: string | null;
  video_ended_at?: string | null;
  patient_joined_at?: string | null;
  patient_tcle_accepted_at?: string | null;
  patient_access_token?: string | null;
  psychologist_crp?: string | null;
  psychologist_epsi?: string | null;
}

export type ExpenseCategory =
  | 'ALUGUEL'
  | 'CONDOMINIO'
  | 'UTILIDADES'
  | 'TELECOMUNICACOES'
  | 'CRP_CONSELHO'
  | 'SERVICOS_PROFISSIONAIS'
  | 'SISTEMAS_SOFTWARE'
  | 'MATERIAIS_TESTES'
  | 'MANUTENCAO_LIMPEZA'
  | 'OUTROS';

export type ExpensePaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED';

export type ExpensePaymentMethod =
  | 'PIX'
  | 'BOLETO'
  | 'CARTAO'
  | 'TRANSFERENCIA'
  | 'DINHEIRO'
  | 'DEBITO_AUTOMATICO';

export type ExpenseRecurrencePeriod = 'MONTHLY' | 'BIMONTHLY' | 'SEMIANNUAL' | 'YEARLY';
export type ExpenseScope = 'CLINIC' | 'INDIVIDUAL' | 'SHARED';

export interface Expense {
  id: number;
  psychologist_id: number;
  psychologist_name?: string | null;
  title: string;
  category: ExpenseCategory;
  amount: number;
  due_date: string;
  payment_date?: string | null;
  status: ExpensePaymentStatus;
  payment_method?: ExpensePaymentMethod | null;
  is_recurring: boolean;
  recurrence_period?: ExpenseRecurrencePeriod | null;
  recurrence_group_id?: string | null;
  installment_number?: number | null;
  installments_total?: number | null;
  carne_leao_deductible: boolean;
  is_shared?: boolean;
  shared_splits_json?: string | null;
  scope?: ExpenseScope;
  payer_user_id?: number | null;
  payer_name?: string | null;
  rfb_account_code?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExpenseSettlement {
  id: number;
  from_user_id: number;
  from_user_name?: string;
  to_user_id: number;
  to_user_name?: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  competence_month: string;
  notes?: string | null;
  created_by_user_id?: number;
  created_at?: string;
}

export interface SettlementBalance {
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  grossOwed: number;
  settledAmount: number;
  netPending: number;
}

export interface AgendaEvent {
  id: number;
  date: string;
  title: string;
  event_type: 'HOLIDAY' | 'REMINDER' | 'FINANCIAL' | 'OTHER';
  created_at?: string;
  expense_id?: number | null;
  amount?: number | null;
  status?: ExpensePaymentStatus | null;
  payment_date?: string | null;
  category?: string | null;
}

export type RecordType = 'DAP' | 'BIRP' | 'FREE';

export interface MedicalRecord {
  id: number;
  patient_id: number;
  session_id?: number;
  record_type: RecordType;
  content: {
    dados?: string;
    avaliacao?: string;
    plano?: string;
    behavior?: string;
    intervention?: string;
    response?: string;
    raw?: string;
  };
  is_signed: boolean;
  hash_sha256?: string;
  signed_at?: string;
  psychologist_name: string;
  psychologist_crp?: string;
  created_at: string;
}

export interface ConfidentialNote {
  id: number;
  patient_id: number;
  content: string;
  created_at: string;
}

export type CFPType = 'DECLARACAO' | 'ATESTADO' | 'RELATORIO' | 'LAUDO' | 'PARECER';

export type PatientDocumentCategory =
  | 'ANAMNESE'
  | 'LAUDO'
  | 'RELATORIO'
  | 'ENCAMINHAMENTO'
  | 'ATESTADO'
  | 'DECLARACAO'
  | 'PARECER'
  | 'ANEXO_EXTERNO'
  | 'OUTRO';

export interface AnamneseContent {
  queixa_principal: string;
  historico_sintomas?: string;
  antecedentes_pessoais?: string;
  antecedentes_familiares?: string;
  rotina_habitos?: string;
  hipoteses_diagnosticas?: string;
  objetivos_terapeuticos?: string;
}

export interface EncaminhamentoContent {
  especialidade_destino: string;
  profissional_destino?: string;
  motivo_encaminhamento: string;
  sintese_caso: string;
  solicitacao: string;
}

export interface CFPContent {
  identificacao: string;
  demanda: string;
  procedimento: string;
  analise: string;
  conclusao: string;
}

export interface AnexoContent {
  description?: string;
  category_label?: string;
}

export interface PatientDocument {
  id: number;
  patient_id: number;
  psychologist_id: number;
  title: string;
  category: PatientDocumentCategory;
  document_type?: string;
  evaluation_id?: number | null;
  content: AnamneseContent | EncaminhamentoContent | CFPContent | AnexoContent | Record<string, any>;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  file_data?: string;
  hash_sha256?: string;
  is_signed: boolean;
  signed_at?: string;
  created_at: string;
  updated_at?: string;
  psychologist_name?: string;
  psychologist_crp?: string;
  patient_name?: string;
}

export interface CFPBlock {
  id: string;
  title: string;
  content: string;
}

export interface DocumentCFP {
  id: number;
  patient_id: number;
  psychologist_id: number;
  document_type: CFPType;
  content: any; // Used for old objects
  content_json?: string;
  hash_sha256: string;
  is_signed: number;
  created_at: string;
  patient_name: string;
  psychologist_name: string;
  crp_number?: string;
}

export interface TemplateCFP {
  id: number;
  psychologist_id: number | null;
  title: string;
  document_type: CFPType;
  content_json: string;
}

export interface ScaleResult {
  id: number;
  patient_id: number;
  psychologist_id: number;
  scale_type: 'PHQ9' | 'GAD7';
  answers: Record<string, number>;
  total_score: number;
  severity: string;
  created_at: string;
  patient_name: string;
}

export interface FinancialSummary {
  revenuePaid: number;
  revenuePending: number;
  occupancyRate: number;
  noShowRate: number;
  monthlyData: Array<{ mes: string; receitas: number; despesas: number }>;
}

export interface FinancialTransaction {
  id: number;
  patient_id: number;
  session_id?: number;
  evaluation_id?: number | null;
  installment_number?: number | null;
  total_installments?: number | null;
  invoice_status?: string | null;
  invoice_id?: number | null;
  invoice_number?: string | null;
  invoice_issued_at?: string | null;
  invoice_requested_at?: string | null;
  invoice_has_pdf?: boolean | number | null;
  amount: number;
  status: 'PENDING' | 'PAID';
  payment_method: 'PIX' | 'CARTAO' | 'DINHEIRO' | 'BOLETO' | string;
  transaction_date: string;
  paid_at?: string;
  notes?: string;
  patient_name: string;
  patient_cpf: string;
  evaluation_title?: string | null;
}

export type EvaluationStatus = 'IN_PROGRESS' | 'AWAITING_DEVOLUTIVA' | 'COMPLETED' | 'CANCELED';
export type PaymentMode = 'A_VISTA' | 'PARCELADO';

export interface PsychometricTestScore {
  id: string;
  testName: string;
  domain: string;
  standardScore?: number;
  percentile: number;
  classification: string;
  notes?: string;
}

export interface DiagnosticHypothesisItem {
  id: string;
  code: string;
  title: string;
  category: string;
  summary: string;
  directives: string[];
}

export interface NeuropsychEvaluation {
  id: number;
  patient_id: number;
  psychologist_id: number;
  title: string;
  status: EvaluationStatus;
  estimated_sessions: number;
  total_price: number;
  payment_mode: PaymentMode;
  hypothesis_diagnosis?: string | null;
  notes?: string | null;
  created_at: string;
  completed_at?: string | null;
  patient_name?: string;
  patient_cpf?: string;
  patient_phone?: string;
  psychologist_name?: string;
  psychologist_crp?: string;
  sessions?: Session[];
  sessions_count?: number;
  installments?: FinancialTransaction[];
  total_paid?: number;
  total_pending?: number;
  draft_document?: PatientDocument | null;
}

export interface CarneLeaoRecord {
  id: number;
  data_pagamento: string;
  valor: number;
  titular_pagamento: string;
  cpf_titular: string;
  codigo_ocupacao: string;
  historico: string;
}

export interface UserFiscalSettings {
  id?: number;
  user_id: number;
  cpf: string;
  crp: string;
  cbo_code: string;
  dependents_count: number;
  inss_mode: 'NONE' | 'STANDARD_20' | 'SIMPLIFIED_11' | 'CUSTOM_FIXED';
  inss_custom_amount: number;
  use_simplified_deduction: number;
}

export interface CarneLeaoRevenueItem {
  id: number;
  date: string;
  amount: number;
  patientId: number;
  patientName: string;
  patientCpf: string;
  payerName: string;
  payerCpf: string;
  cboCode: string;
  description: string;
  receiptNumber?: string;
}

export interface CarneLeaoExpenseItem {
  id: number;
  date: string;
  amount: number;
  originalAmount: number;
  title: string;
  category: string;
  rfbAccountCode: string;
  isShared: boolean;
  splitPercent: number;
  notes?: string;
  origin: 'DIRECT' | 'SHARED' | 'SUBLOCACAO_CLINICA';
}

export interface CarneLeaoSummary {
  psychologist: {
    id: number;
    name: string;
    crp: string;
    cpf: string;
    cboCode: string;
  };
  competence: {
    year: number;
    month: number;
    label: string;
  };
  settings: UserFiscalSettings;
  revenues: CarneLeaoRevenueItem[];
  totalRevenues: number;
  expenses: CarneLeaoExpenseItem[];
  totalDeductibleExpenses: number;
  coworkingRoomDeductions: number;
  carriedOverDeficitFromPreviousMonths: number;
  netLivroCaixaBalance: number;
  nextMonthCarryOverDeficit: number;
  inssDeduction: number;
  dependentsDeduction: number;
  totalPersonalDeductions: number;
  totalCombinedDeductions: number;
  taxBase: number;
  darf: {
    taxableAmount: number;
    aliquotPercent: number;
    deductionParcel: number;
    calculatedTax: number;
    isBelowMinThreshold: boolean;
    finalDarfAmount: number;
    revenueCode: string;
    dueDate: string;
    dueDateFormatted: string;
    notes: string;
  };
}

export interface FiscalDossier {
  psychologist: {
    id: number;
    name: string;
    crp: string;
    cpf: string;
    cboCode: string;
  };
  competence: {
    year: number;
    month: number;
    label: string;
  };
  revenues: CarneLeaoRevenueItem[];
  totalRevenues: number;
  expenses: CarneLeaoExpenseItem[];
  totalDeductibleExpenses: number;
  coworkingRoomDeductions: number;
  carriedOverDeficitFromPreviousMonths: number;
  netLivroCaixaBalance: number;
  nextMonthCarryOverDeficit: number;
  inssDeduction: number;
  dependentsDeduction: number;
  totalPersonalDeductions: number;
  totalCombinedDeductions: number;
  taxBase: number;
  darf: {
    taxableAmount: number;
    aliquotPercent: number;
    deductionParcel: number;
    calculatedTax: number;
    isBelowMinThreshold: boolean;
    finalDarfAmount: number;
    revenueCode: string;
    dueDate: string;
    dueDateFormatted: string;
    notes: string;
  };
  clinic: {
    name: string;
    cnpj: string;
    address: string;
    phone: string;
    logo?: string | null;
  };
  verification: {
    hashSha256: string;
    generatedAt: string;
    legalTerms: string;
  };
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  resource: string;
  ip_address: string;
  timestamp: string;
  details?: string;
  user_name?: string;
  user_role?: UserRole;
}

export type EvaluationInstallmentStatus = 'PAID' | 'OVERDUE' | 'DUE_TODAY' | 'PREVENTIVE' | 'FUTURE';

export interface EvaluationInstallment {
  transaction_id: number;
  evaluation_id: number;
  installment_number: number;
  total_installments: number;
  amount: number;
  due_date: string;
  paid_at?: string | null;
  payment_method?: string | null;
  status: EvaluationInstallmentStatus;
  raw_status: string;
  days_overdue: number;
  days_until_due: number;
  is_eligible_for_active_billing: boolean;
  notes?: string;
}

export interface BillingContact {
  id: number;
  patient_id: number;
  evaluation_id?: number | null;
  contact_channel: 'WHATSAPP' | 'COPIED_TEXT' | 'PHONE' | 'EMAIL' | 'MANUAL_NOTE';
  recipient_type: 'PATIENT' | 'FINANCIAL_RESPONSIBLE' | 'LEGAL_GUARDIAN' | 'OTHER';
  recipient_name?: string | null;
  recipient_phone?: string | null;
  template_type?: string | null;
  message_preview?: string | null;
  agreement_date?: string | null;
  agreement_notes?: string | null;
  created_by_user_id?: number;
  created_by_name?: string;
  created_at: string;
}

export interface BillingContactBadge {
  badge: 'NEVER_CONTACTED' | 'RECENTLY_CONTACTED' | 'OVERDUE_CONTACT' | 'AGREEMENT_PENDING' | 'AGREEMENT_OVERDUE';
  label: string;
  color: 'gray' | 'green' | 'amber' | 'blue' | 'red';
  days_since?: number;
  agreement_date?: string;
  agreement_notes?: string;
}

export interface EvaluationBilling {
  evaluation_id: number;
  patient_id: number;
  patient_name: string;
  patient_cpf: string;
  patient_phone: string;
  psychologist_id: number;
  psychologist_name: string;
  title: string;
  status: string;
  total_price: number;
  total_installments: number;
  paid_installments_count: number;
  paid_amount: number;
  pending_installments_count: number;
  pending_amount: number;
  overdue_installments_count: number;
  overdue_amount: number;
  preventive_installments_count: number;
  preventive_amount: number;
  active_amount: number;
  active_count: number;
  installments: EvaluationInstallment[];
  guardian?: any;
  financial_responsible?: any;
  whatsapp_routing?: any;
  last_contact?: BillingContact | null;
  contact_badge?: BillingContactBadge;
}

export type OperatingMode = 'SOLO' | 'SMALL_CLINIC' | 'ENTERPRISE_CLINIC';

export interface ClinicModuleFlags {
  operating_mode: OperatingMode;
  repasse_enabled: boolean;
  reception_tower_enabled: boolean;
  rooms_enabled: boolean;
  collaborators_enabled: boolean;
  waiting_tv_enabled: boolean;
}

export const OPERATING_PRESETS: Record<OperatingMode, ClinicModuleFlags> = {
  SOLO: {
    operating_mode: 'SOLO',
    repasse_enabled: false,
    reception_tower_enabled: false,
    rooms_enabled: false,
    collaborators_enabled: false,
    waiting_tv_enabled: false,
  },
  SMALL_CLINIC: {
    operating_mode: 'SMALL_CLINIC',
    repasse_enabled: true,
    reception_tower_enabled: false,
    rooms_enabled: false,
    collaborators_enabled: true,
    waiting_tv_enabled: false,
  },
  ENTERPRISE_CLINIC: {
    operating_mode: 'ENTERPRISE_CLINIC',
    repasse_enabled: true,
    reception_tower_enabled: true,
    rooms_enabled: true,
    collaborators_enabled: true,
    waiting_tv_enabled: true,
  },
};

export type RoomType = 'CLINICAL' | 'NEURO' | 'PLAY_THERAPY' | 'ONLINE';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';

export interface Room {
  id: number;
  name: string;
  initials?: string | null;
  room_type: RoomType;
  color_code: string;
  status: RoomStatus;
  active: boolean | number;
  current_session?: {
    id: number;
    patient_name: string;
    psychologist_name: string;
    session_minutes: number;
  } | null;
}

export type PresenceStatus = 
  | 'SCHEDULED' 
  | 'CONFIRMED' 
  | 'WAITING' 
  | 'CALLED' 
  | 'IN_SESSION' 
  | 'FINISHED' 
  | 'NO_SHOW';

export interface ReceptionSession {
  id: number;
  psychologist_id: number;
  patient_id: number;
  start_time: string;
  end_time: string;
  status: string;
  modality: 'ONLINE' | 'PRESENTIAL';
  price: number;
  notes?: string;
  session_type: string;
  room_id?: number | null;
  room_name?: string | null;
  display_room_name?: string;
  room_color?: string;
  arrival_time?: string | null;
  called_at?: string | null;
  session_started_at?: string | null;
  session_ended_at?: string | null;
  presence_status: PresenceStatus;
  waiting_notes?: string | null;
  patient_name: string;
  anonymized_name: string;
  patient_phone?: string;
  patient_cpf?: string;
  psychologist_name: string;
  payment_status: 'PAID' | 'PENDING';
  transaction_id?: number | null;
  wait_minutes: number;
  session_minutes: number;
}

export interface ReceptionBoardStats {
  total_today: number;
  waiting_count: number;
  in_session_count: number;
  completed_count: number;
  scheduled_count: number;
  canceled_count: number;
  avg_wait_minutes: number;
}

export interface WaitingRoomCall {
  id: number;
  session_id: number;
  patient_display_name: string;
  room_name: string;
  psychologist_name: string;
  called_at: string;
  status: 'ACTIVE' | 'EXPIRED';
}

export interface RoomAvailability {
  id: number;
  name: string;
  room_type: string;
  color_code: string;
  status: string;
  active: number;
  is_available: boolean;
  conflict_session?: {
    session_id: number;
    start_time: string;
    end_time: string;
    psychologist_name: string;
    patient_name: string;
  } | null;
}

export interface RoomTimelineSession {
  id: number;
  room_id: number;
  room_name?: string;
  start_time: string;
  end_time: string;
  status: string;
  presence_status?: PresenceStatus;
  modality: 'ONLINE' | 'PRESENTIAL';
  session_type: string;
  patient_name: string;
  patient_display_name: string;
  psychologist_name: string;
  room_color?: string;
}

export interface RoomTimelineData {
  date: string;
  rooms: Room[];
  sessions: RoomTimelineSession[];
}

export interface HealthInsurance {
  id: number;
  clinic_id?: number;
  name: string;
  ans_code?: string | null;
  cnpj?: string | null;
  payment_deadline_days: number;
  submission_cut_day: number;
  status: 'ACTIVE' | 'INACTIVE';
  repasse_default_mode: 'FIXED' | 'PERCENTAGE';
  repasse_default_value: number;
  notes?: string | null;
  negotiated_procedures_count?: number;
  active_guides_count?: number;
  created_at?: string;
}

export interface TussProcedure {
  id: number;
  code: string;
  description: string;
  category: 'PSICOLOGIA' | 'NEUROPSICOLOGIA' | 'FONOAUDIOLOGIA' | 'TERAPIA_OCUPACIONAL' | 'PSIQUIATRIA' | 'OUTROS';
  standard_session_minutes: number;
  default_suggested_price: number;
  is_active: number;
  created_at?: string;
}

export interface HealthInsurancePrice {
  id: number;
  insurance_id: number;
  tuss_id: number;
  agreed_price: number;
  copay_price?: number;
  repasse_fixed_amount?: number | null;
  tuss_code?: string;
  tuss_description?: string;
  tuss_category?: string;
  standard_session_minutes?: number;
  created_at?: string;
}

export interface PatientAuthorization {
  id: number;
  clinic_id?: number;
  patient_id: number;
  insurance_id: number;
  tuss_id?: number | null;
  card_number: string;
  card_validity?: string | null;
  plan_name?: string | null;
  guide_number: string;
  auth_date?: string | null;
  valid_until: string;
  total_sessions_authorized: number;
  executed_sessions_count: number;
  remaining_sessions?: number;
  doctor_referral_crm?: string | null;
  doctor_referral_name?: string | null;
  doctor_referral_cid?: string | null;
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'CANCELED';
  notes?: string | null;
  patient_name?: string;
  patient_cpf?: string;
  insurance_name?: string;
  insurance_ans_code?: string;
  tuss_code?: string;
  tuss_description?: string;
  created_at?: string;
}

export interface InsuranceExtensionReport {
  reportTitle: string;
  summary: string;
  clinicalJustification: string;
  therapeuticGoalsNextCycle: string[];
  suggestedFrequency: string;
  requestedSessions: number;
  ethicalNotice: string;
  formattedFullDocument: string;
}

