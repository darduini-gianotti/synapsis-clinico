import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useAcademy } from '../context/AcademyContext.js';
import {
  MessageSquare,
  Send,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  DollarSign,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Settings,
  Phone,
  Sparkles,
  CheckSquare,
  Square,
  X,
  CreditCard,
  Building,
  Handshake,
  ArrowRight,
  FileText,
  QrCode,
} from 'lucide-react';
import { AsaasChargeModal } from './financial/AsaasChargeModal.js';
import { WhatsAppRecipientSelector } from './whatsapp/WhatsAppRecipientSelector';
import {
  resolveAvailableRecipients,
  getDefaultRecipientType,
  WhatsAppRecipientType,
  cleanWhatsAppPhone,
  buildWhatsAppLink,
} from '../utils/whatsappRouting';
import type {
  EvaluationBilling,
  EvaluationInstallment,
  BillingContact,
  BillingContactBadge,
} from '../types.js';

export interface BillingSession {
  id: number;
  start_time: string;
  end_time: string;
  price: number;
  modality: string;
  status: string;
  recurrence_pattern?: string;
  is_recurring?: boolean;
  notes?: string;
  transaction_id?: number | null;
  due_status?: 'OVERDUE' | 'DUE_TODAY' | 'PREVENTIVE' | 'FUTURE';
  days_overdue?: number;
  days_until_due?: number;
  is_overdue?: boolean;
  is_preventive?: boolean;
  is_eligible_for_active_billing?: boolean;
}

export interface PatientBilling {
  patient_id: number;
  patient_name: string;
  cpf: string;
  phone: string;
  group?: string;
  guardian?: any;
  financial_responsible?: any;
  whatsapp_routing?: any;
  pending_count: number;
  total_pending_amount: number;
  overdue_sessions_count?: number;
  overdue_amount?: number;
  preventive_sessions_count?: number;
  preventive_amount?: number;
  future_sessions_count?: number;
  future_amount?: number;
  has_overdue?: boolean;
  has_preventive?: boolean;
  has_agreement?: boolean;
  sessions: BillingSession[];
  oldest_date: string;
  latest_date: string;
  last_contact?: BillingContact | null;
  contact_badge?: BillingContactBadge;
  all_sessions_count?: number;
  all_sessions?: BillingSession[];
}

interface BillingsModuleProps {
  onNavigateToSettle?: (patientId?: number) => void;
  onNavigateToSettings?: () => void;
}

export const BillingsModule: React.FC<BillingsModuleProps> = ({ onNavigateToSettle, onNavigateToSettings }) => {
  const { clinicSettings, refreshClinicSettings } = useAuth();
  const { isSandboxActive, advanceStep } = useAcademy();

  // Active Top-level Navigation Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'psychotherapy' | 'evaluations'>('overview');

  // Main Lists & Summary
  const [psychotherapyBillings, setPsychotherapyBillings] = useState<PatientBilling[]>([]);
  const [evaluationBillings, setEvaluationBillings] = useState<EvaluationBilling[]>([]);
  const [summary, setSummary] = useState({
    total_pending_amount: 0,
    total_pending_sessions: 0,
    patients_with_pending_count: 0,
    psychotherapy_overdue_amount: 0,
    psychotherapy_overdue_count: 0,
    psychotherapy_overdue_patients_count: 0,
    psychotherapy_preventive_amount: 0,
    psychotherapy_preventive_count: 0,
    psychotherapy_preventive_patients_count: 0,
    psychotherapy_agreement_patients_count: 0,
    evaluations_overdue_amount: 0,
    evaluations_overdue_count: 0,
    evaluations_preventive_amount: 0,
    evaluations_preventive_count: 0,
    evaluations_total_active_amount: 0,
    evaluations_with_pending_count: 0,
    global_active_amount: 0,
  });

  const [psychologistInfo, setPsychologistInfo] = useState({
    name: 'Dr. Marcos Silveira',
    crp: 'CRP 06/128945-SP',
  });
  const [isLoading, setIsLoading] = useState(true);

  // General Filter: Search
  const [search, setSearch] = useState('');

  // Psychotherapy Filters
  const [psychDueFilter, setPsychDueFilter] = useState<'ALL' | 'OVERDUE' | 'PREVENTIVE' | 'AGREEMENT'>('ALL');
  const [psychContactFilter, setPsychContactFilter] = useState<'ALL' | 'RECENT' | 'OVERDUE_CONTACT' | 'NEVER'>('ALL');
  const [whatsappFilter, setWhatsappFilter] = useState<'ALL' | 'WITH_PHONE'>('ALL');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'MONTH' | 'PERIOD'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().substring(0, 7));
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [expandedPatientId, setExpandedPatientId] = useState<number | null>(null);

  // Evaluations Filters
  const [evalDueFilter, setEvalDueFilter] = useState<'ALL' | 'OVERDUE' | 'PREVENTIVE' | 'AGREEMENT'>('ALL');
  const [evalContactFilter, setEvalContactFilter] = useState<'ALL' | 'RECENT' | 'OVERDUE_CONTACT' | 'NEVER'>('ALL');
  const [expandedEvaluationId, setExpandedEvaluationId] = useState<number | null>(null);

  // Centralized Clinic PIX Data
  const [pixKey, setPixKey] = useState<string>('');
  const [pixKeyType, setPixKeyType] = useState<string>('CPF');
  const [pixBeneficiary, setPixBeneficiary] = useState<string>('PsicoGestão');
  const [bankInfo, setBankInfo] = useState<string>('');
  const [isPixSettingsOpen, setIsPixSettingsOpen] = useState(false);
  const [isSavingPix, setIsSavingPix] = useState(false);

  // Modal 1: Psychotherapy WhatsApp Generator
  const [activeModalPatient, setActiveModalPatient] = useState<PatientBilling | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Record<number, boolean>>({});
  const [sessionPriceOverrides, setSessionPriceOverrides] = useState<Record<number, number>>({});
  const [psychTone, setPsychTone] = useState<'FRIENDLY' | 'FORMAL' | 'SHORT'>('FRIENDLY');
  const [copiedPsych, setCopiedPsych] = useState(false);
  const [customNotesPsych, setCustomNotesPsych] = useState('');
  const [selectedRecipientTypePsych, setSelectedRecipientTypePsych] = useState<WhatsAppRecipientType>('PATIENT');

  // Modal 2: Evaluation WhatsApp Generator
  const [activeEvalModalTarget, setActiveEvalModalTarget] = useState<EvaluationBilling | null>(null);
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<Record<number, boolean>>({});
  const [evalTemplateTone, setEvalTemplateTone] = useState<'PREVENTIVE' | 'FRIENDLY_OVERDUE' | 'FORMAL_REGULARIZATION'>('FRIENDLY_OVERDUE');
  const [copiedEval, setCopiedEval] = useState(false);
  const [customNotesEval, setCustomNotesEval] = useState('');
  const [selectedRecipientTypeEval, setSelectedRecipientTypeEval] = useState<WhatsAppRecipientType>('FINANCIAL_RESPONSIBLE');

  // Modal 3: Payment Agreement Note Modal (Acordo de Pagamento)
  const [activeAgreementTarget, setActiveAgreementTarget] = useState<{
    patient_id: number;
    evaluation_id?: number | null;
    title: string;
    patient_name: string;
    current_date?: string;
    current_notes?: string;
  } | null>(null);
  const [agreementDate, setAgreementDate] = useState<string>('');
  const [agreementNotes, setAgreementNotes] = useState<string>('');
  const [isSavingAgreement, setIsSavingAgreement] = useState(false);

  // Modal 4: Quick Settle Modal
  const [quickSettleTarget, setQuickSettleTarget] = useState<{
    patient_id: number;
    patient_name: string;
    items: { id: number; label: string; amount: number }[];
    total: number;
    isEvaluation?: boolean;
  } | null>(null);
  const [quickSettleDate, setQuickSettleDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [quickSettleMethod, setQuickSettleMethod] = useState<string>('PIX');
  const [quickSettleNotes, setQuickSettleNotes] = useState<string>('');
  const [isSubmittingQuickSettle, setIsSubmittingQuickSettle] = useState(false);
  const [quickSettleSuccess, setQuickSettleSuccess] = useState<string | null>(null);

  // Asaas Charge Modal Target
  const [asaasModalTarget, setAsaasModalTarget] = useState<{
    patient_id: number;
    patient_name: string;
    patient_cpf?: string;
    patient_phone?: string;
    guardian_name?: string;
    guardian_phone?: string;
    financial_responsible_name?: string;
    financial_responsible_phone?: string;
    transaction_id?: number;
    session_id?: number;
    evaluation_id?: number;
    amount: number;
    description: string;
    is_evaluation?: boolean;
    items?: Array<{
      id: number;
      title: string;
      subtitle?: string;
      amount: number;
      isSelected?: boolean;
    }>;
  } | null>(null);

  const handleOpenAsaasModalPsych = (patient: PatientBilling & { all_sessions?: BillingSession[] }) => {
    const allSessions =
      patient.all_sessions && patient.all_sessions.length > 0 ? patient.all_sessions : patient.sessions;
    const activeFilteredIds = new Set(patient.sessions.map((s) => s.id));

    const items = allSessions.map((s, idx) => ({
      id: s.id,
      title: `Sessão #${idx + 1} (${formatDate(s.start_time)})`,
      subtitle: s.is_overdue
        ? `Vencida há ${s.days_overdue || 0}d`
        : s.is_preventive
        ? `A vencer em ${s.days_until_due || 0}d`
        : s.modality === 'ONLINE'
        ? 'Online'
        : 'Presencial',
      amount: Number(s.price) || 0,
      isSelected: activeFilteredIds.has(s.id),
    }));

    setAsaasModalTarget({
      patient_id: patient.patient_id,
      patient_name: patient.patient_name,
      patient_cpf: patient.cpf,
      patient_phone: patient.phone,
      guardian_name: patient.guardian?.fullName,
      guardian_phone: patient.guardian?.phone,
      financial_responsible_name: patient.financial_responsible?.fullName,
      financial_responsible_phone: patient.financial_responsible?.phone,
      amount: patient.total_pending_amount,
      description: `Honorários de Psicoterapia (${patient.sessions.length} sessão(ões)) - ${patient.patient_name}`,
      is_evaluation: false,
      items,
    });
  };

  const handleOpenAsaasModalEvalBatch = (evaluation: EvaluationBilling) => {
    const pendingInstallments = evaluation.installments.filter((i) => i.status !== 'PAID');
    const overdueOrPreventiveIds = new Set(
      pendingInstallments
        .filter((i) => i.status === 'OVERDUE' || i.status === 'DUE_TODAY' || i.status === 'PREVENTIVE')
        .map((i) => i.transaction_id)
    );

    const shouldPreselectOverdue = overdueOrPreventiveIds.size > 0;

    const items = pendingInstallments.map((inst) => ({
      id: inst.transaction_id,
      title: `Parcela ${inst.installment_number}/${inst.total_installments} (${formatDate(inst.due_date)})`,
      subtitle:
        inst.status === 'OVERDUE'
          ? `Vencida há ${inst.days_overdue || 0}d`
          : inst.status === 'PREVENTIVE'
          ? `A vencer em ${inst.days_until_due || 0}d`
          : 'A vencer',
      amount: Number(inst.amount) || 0,
      isSelected: shouldPreselectOverdue ? overdueOrPreventiveIds.has(inst.transaction_id) : true,
    }));

    const initialSelected = items.filter((it) => it.isSelected);
    const initialAmount = initialSelected.reduce((sum, it) => sum + it.amount, 0);

    setAsaasModalTarget({
      patient_id: evaluation.patient_id,
      patient_name: evaluation.patient_name,
      patient_cpf: evaluation.patient_cpf,
      patient_phone: evaluation.patient_phone,
      guardian_name: evaluation.guardian?.fullName,
      guardian_phone: evaluation.guardian?.phone,
      financial_responsible_name: evaluation.financial_responsible?.fullName,
      financial_responsible_phone: evaluation.financial_responsible?.phone,
      evaluation_id: evaluation.evaluation_id,
      amount: initialAmount || evaluation.pending_amount,
      description: `Honorários de Avaliação (${initialSelected.length} parcela(s)) - ${evaluation.patient_name}`,
      is_evaluation: true,
      items,
    });
  };

  const handleOpenAsaasModalEval = (evaluation: EvaluationBilling, installment: EvaluationInstallment) => {
    setAsaasModalTarget({
      patient_id: evaluation.patient_id,
      patient_name: evaluation.patient_name,
      patient_cpf: evaluation.patient_cpf,
      patient_phone: evaluation.patient_phone,
      guardian_name: evaluation.guardian?.fullName,
      guardian_phone: evaluation.guardian?.phone,
      financial_responsible_name: evaluation.financial_responsible?.fullName,
      financial_responsible_phone: evaluation.financial_responsible?.phone,
      transaction_id: installment.transaction_id,
      evaluation_id: evaluation.evaluation_id,
      amount: installment.amount,
      description: `Parcela ${installment.installment_number}/${installment.total_installments} - ${evaluation.title} (${evaluation.patient_name})`,
      is_evaluation: true,
    });
  };

  // ==========================================
  // 1. DATA LOADING & SYNCHRONIZATION
  // ==========================================
  const fetchBillings = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/financial/billings-summary');
      setPsychotherapyBillings(res.data.psychotherapy_billings || res.data.billings || []);
      setEvaluationBillings(res.data.evaluation_billings || []);
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
      if (res.data.psychologist) {
        setPsychologistInfo(res.data.psychologist);
      }
      if (res.data.clinic_settings) {
        const cs = res.data.clinic_settings;
        setPixKey(cs.pix_key || localStorage.getItem('psico_billing_pix_key') || 'contato@psicogestao.com.br');
        setPixKeyType(cs.pix_key_type || localStorage.getItem('psico_billing_pix_type') || 'EMAIL');
        setPixBeneficiary(cs.pix_beneficiary || localStorage.getItem('psico_billing_beneficiary') || 'Clínica PsicoGestão');
        setBankInfo(cs.bank_info || '');
      }
    } catch (err) {
      console.error('Failed to load billings summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBillings();
  }, []);

  useEffect(() => {
    if (clinicSettings) {
      if (clinicSettings.pix_key) setPixKey(clinicSettings.pix_key);
      if (clinicSettings.pix_key_type) setPixKeyType(clinicSettings.pix_key_type);
      if (clinicSettings.pix_beneficiary) setPixBeneficiary(clinicSettings.pix_beneficiary);
      if (clinicSettings.bank_info) setBankInfo(clinicSettings.bank_info);
    }
  }, [clinicSettings]);

  const handleSavePixSettings = async () => {
    try {
      setIsSavingPix(true);
      localStorage.setItem('psico_billing_pix_key', pixKey);
      localStorage.setItem('psico_billing_pix_type', pixKeyType);
      localStorage.setItem('psico_billing_beneficiary', pixBeneficiary);

      await api.put('/clinic-settings', {
        clinic_name: clinicSettings?.clinic_name || 'PsicoGestão',
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        pix_beneficiary: pixBeneficiary,
        bank_info: bankInfo,
      });

      if (refreshClinicSettings) {
        await refreshClinicSettings();
      }
      setIsPixSettingsOpen(false);
    } catch (err) {
      console.error('Failed to save PIX settings:', err);
      alert('Erro ao salvar as configurações de PIX na clínica.');
    } finally {
      setIsSavingPix(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount || 0);
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '-';
    try {
      const parts = isoStr.split('T');
      const dateParts = parts[0].split('-');
      if (dateParts.length === 3) {
        return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      }
      return isoStr;
    } catch {
      return isoStr;
    }
  };

  const formatTime = (isoStr: string) => {
    if (!isoStr || !isoStr.includes('T')) return '';
    try {
      return isoStr.split('T')[1].substring(0, 5);
    } catch {
      return '';
    }
  };

  const getMonthLabel = (yearMonth: string) => {
    if (!yearMonth || !yearMonth.includes('-')) return yearMonth;
    try {
      const [year, month] = yearMonth.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      const formatted = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return yearMonth;
    }
  };

  const handleMonthChange = (delta: number) => {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const date = new Date(year, month - 1 + delta, 1);
      const yStr = date.getFullYear().toString();
      const mStr = (date.getMonth() + 1).toString().padStart(2, '0');
      setSelectedMonth(`${yStr}-${mStr}`);
    } catch (err) {
      console.error('Error changing month:', err);
    }
  };

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    psychotherapyBillings.forEach((p) => {
      p.sessions.forEach((s) => {
        if (s.start_time && s.start_time.length >= 7) {
          monthsSet.add(s.start_time.substring(0, 7));
        }
      });
    });
    monthsSet.add('2026-09');
    monthsSet.add('2026-10');
    return Array.from(monthsSet).sort();
  }, [psychotherapyBillings]);

  // ==========================================
  // 2. FILTERED LISTS & STATS
  // ==========================================
  const psychOverdueStats = useMemo(() => {
    let overdueSessions = 0;
    let overduePatients = 0;
    let preventiveSessions = 0;
    let preventivePatients = 0;
    let agreementPatients = 0;

    psychotherapyBillings.forEach((p) => {
      const hasOverdue = (p.overdue_sessions_count || 0) > 0;
      if (hasOverdue) {
        overduePatients += 1;
        overdueSessions += (p.overdue_sessions_count || 0);
      }
      if ((p.preventive_sessions_count || 0) > 0) {
        preventivePatients += 1;
        preventiveSessions += (p.preventive_sessions_count || 0);
      }
      const b = p.contact_badge?.badge;
      if (b === 'AGREEMENT_PENDING' || b === 'AGREEMENT_OVERDUE') {
        agreementPatients += 1;
      }
    });

    return {
      overdueSessions,
      overduePatients,
      preventiveSessions,
      preventivePatients,
      agreementPatients,
    };
  }, [psychotherapyBillings]);

  const filteredPsychotherapy = useMemo(() => {
    const q = search.toLowerCase().trim();
    const todayStr = new Date().toISOString().substring(0, 10);
    const preventiveLimitStr = new Date(Date.now() + 5 * 86400000).toISOString().substring(0, 10);

    const result = psychotherapyBillings
      .map((patient) => {
        let matchingSessions = patient.sessions;

        if (dateFilterMode === 'MONTH' && selectedMonth) {
          matchingSessions = matchingSessions.filter((s) => {
            const sMonth = s.start_time ? s.start_time.substring(0, 7) : '';
            return sMonth === selectedMonth;
          });
        } else if (dateFilterMode === 'PERIOD') {
          matchingSessions = matchingSessions.filter((s) => {
            const sDate = s.start_time ? s.start_time.split('T')[0] : '';
            if (startDate && sDate < startDate) return false;
            if (endDate && sDate > endDate) return false;
            return true;
          });
        }

        // Filter by Due Date status if OVERDUE or PREVENTIVE
        if (psychDueFilter === 'OVERDUE') {
          matchingSessions = matchingSessions.filter((s) => {
            if (s.is_overdue !== undefined) return s.is_overdue;
            const sDate = s.start_time ? s.start_time.split('T')[0] : '';
            return sDate <= todayStr;
          });
        } else if (psychDueFilter === 'PREVENTIVE') {
          matchingSessions = matchingSessions.filter((s) => {
            if (s.is_preventive !== undefined) return s.is_preventive;
            const sDate = s.start_time ? s.start_time.split('T')[0] : '';
            return sDate > todayStr && sDate <= preventiveLimitStr;
          });
        }

        if (matchingSessions.length === 0) return null;

        const totalAmount = matchingSessions.reduce(
          (sum, s) => sum + (Number(s.price) || 0),
          0
        );

        return {
          ...patient,
          pending_count: matchingSessions.length,
          total_pending_amount: totalAmount,
          sessions: matchingSessions,
          all_sessions: patient.sessions,
          all_sessions_count: patient.sessions.length,
          oldest_date: matchingSessions[0]?.start_time || patient.oldest_date,
          latest_date: matchingSessions[matchingSessions.length - 1]?.start_time || patient.latest_date,
        };
      })
      .filter((b): b is PatientBilling & { all_sessions_count: number; all_sessions: BillingSession[] } => {
        if (!b) return false;

        const matchesSearch =
          !q ||
          b.patient_name.toLowerCase().includes(q) ||
          b.phone.toLowerCase().includes(q) ||
          b.cpf.includes(q);

        if (!matchesSearch) return false;
        if (whatsappFilter === 'WITH_PHONE' && !b.phone.trim()) return false;

        if (psychDueFilter === 'AGREEMENT') {
          const badge = b.contact_badge?.badge;
          if (badge !== 'AGREEMENT_PENDING' && badge !== 'AGREEMENT_OVERDUE') return false;
        }

        if (psychContactFilter === 'RECENT') {
          if (b.contact_badge?.badge !== 'RECENTLY_CONTACTED') return false;
        } else if (psychContactFilter === 'OVERDUE_CONTACT') {
          if (b.contact_badge?.badge !== 'OVERDUE_CONTACT') return false;
        } else if (psychContactFilter === 'NEVER') {
          if (b.contact_badge?.badge !== 'NEVER_CONTACTED') return false;
        }

        return true;
      });

    if (isSandboxActive && result.length === 0) {
      return [
        {
          patient_id: 904,
          patient_name: 'Beatriz Vasconcelos (Simulação)',
          phone: '(11) 95555-4444',
          cpf: '555.666.777-88',
          pending_count: 2,
          overdue_sessions_count: 2,
          preventive_sessions_count: 0,
          total_pending_amount: 360,
          oldest_date: new Date(Date.now() - 10 * 86400000).toISOString(),
          latest_date: new Date(Date.now() - 3 * 86400000).toISOString(),
          sessions: [
            { id: 801, start_time: new Date(Date.now() - 10 * 86400000).toISOString(), end_time: '', price: 180, modality: 'PRESENTIAL', status: 'CONFIRMED' },
            { id: 802, start_time: new Date(Date.now() - 3 * 86400000).toISOString(), end_time: '', price: 180, modality: 'PRESENTIAL', status: 'CONFIRMED' },
          ] as any,
          all_sessions: [],
          all_sessions_count: 2,
        },
      ] as any;
    }

    return result;
  }, [
    psychotherapyBillings,
    search,
    whatsappFilter,
    dateFilterMode,
    selectedMonth,
    startDate,
    endDate,
    psychDueFilter,
    psychContactFilter,
    isSandboxActive,
  ]);

  const filteredEvaluations = useMemo(() => {
    const q = search.toLowerCase().trim();

    return evaluationBillings
      .map((ev) => {
        let matchingInstallments = ev.installments;

        if (dateFilterMode === 'MONTH' && selectedMonth) {
          matchingInstallments = matchingInstallments.filter((inst) => {
            const dStr = (inst.due_date || '').substring(0, 7);
            return dStr === selectedMonth;
          });
        } else if (dateFilterMode === 'PERIOD') {
          matchingInstallments = matchingInstallments.filter((inst) => {
            const dStr = (inst.due_date || '').substring(0, 10);
            if (startDate && dStr < startDate) return false;
            if (endDate && dStr > endDate) return false;
            return true;
          });
        }

        if (matchingInstallments.length === 0) return null;

        const overdueCount = matchingInstallments.filter((i) => i.status === 'OVERDUE' || i.status === 'DUE_TODAY').length;
        const preventiveCount = matchingInstallments.filter((i) => i.status === 'PREVENTIVE').length;
        const activeAmt = matchingInstallments.reduce((sum, i) => sum + (i.is_eligible_for_active_billing ? Number(i.amount) : 0), 0);
        const pendAmt = matchingInstallments.reduce((sum, i) => sum + (i.status !== 'PAID' ? Number(i.amount) : 0), 0);

        return {
          ...ev,
          installments: matchingInstallments,
          active_amount: activeAmt > 0 ? activeAmt : pendAmt,
          pending_amount: pendAmt,
          overdue_installments_count: overdueCount,
          preventive_installments_count: preventiveCount,
        };
      })
      .filter((ev): ev is EvaluationBilling => {
        if (!ev) return false;
        if (q) {
          const matchesName = ev.patient_name.toLowerCase().includes(q);
          const matchesPhone = ev.patient_phone.toLowerCase().includes(q);
          const matchesCpf = ev.patient_cpf.includes(q);
          const matchesTitle = ev.title.toLowerCase().includes(q);
          if (!matchesName && !matchesPhone && !matchesCpf && !matchesTitle) return false;
        }

        if (evalDueFilter === 'OVERDUE' && ev.overdue_installments_count === 0) return false;
        if (evalDueFilter === 'PREVENTIVE' && ev.preventive_installments_count === 0) return false;
        if (evalDueFilter === 'AGREEMENT') {
          const badge = ev.contact_badge?.badge;
          if (badge !== 'AGREEMENT_PENDING' && badge !== 'AGREEMENT_OVERDUE') return false;
        }

        if (evalContactFilter === 'RECENT') {
          if (ev.contact_badge?.badge !== 'RECENTLY_CONTACTED') return false;
        } else if (evalContactFilter === 'OVERDUE_CONTACT') {
          if (ev.contact_badge?.badge !== 'OVERDUE_CONTACT') return false;
        } else if (evalContactFilter === 'NEVER') {
          if (ev.contact_badge?.badge !== 'NEVER_CONTACTED') return false;
        }

        return true;
      });
  }, [evaluationBillings, search, evalDueFilter, evalContactFilter, dateFilterMode, selectedMonth, startDate, endDate]);

  const dynamicPsychSummary = useMemo(() => {
    let totalPending = 0;
    let totalSessions = 0;
    let patientsCount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let preventiveCount = 0;
    let preventiveAmount = 0;

    filteredPsychotherapy.forEach((p) => {
      totalPending += p.total_pending_amount;
      totalSessions += p.pending_count;
      patientsCount += 1;
      overdueCount += p.overdue_sessions_count || 0;
      overdueAmount += p.overdue_amount || 0;
      preventiveCount += p.preventive_sessions_count || 0;
      preventiveAmount += p.preventive_amount || 0;
    });

    return {
      total_pending_amount: totalPending,
      total_pending_sessions: totalSessions,
      patients_with_pending_count: patientsCount,
      overdue_count: overdueCount,
      overdue_amount: overdueAmount,
      preventive_count: preventiveCount,
      preventive_amount: preventiveAmount,
    };
  }, [filteredPsychotherapy]);

  const dynamicEvalSummary = useMemo(() => {
    let overdueAmount = 0;
    let overdueCount = 0;
    let preventiveAmount = 0;
    let preventiveCount = 0;

    filteredEvaluations.forEach((ev) => {
      overdueAmount += ev.overdue_amount;
      overdueCount += ev.overdue_installments_count;
      preventiveAmount += ev.preventive_amount;
      preventiveCount += ev.preventive_installments_count;
    });

    return {
      overdue_amount: overdueAmount,
      overdue_count: overdueCount,
      preventive_amount: preventiveAmount,
      preventive_count: preventiveCount,
      active_amount: overdueAmount + preventiveAmount,
      total_evaluations: filteredEvaluations.length,
    };
  }, [filteredEvaluations]);

  // ==========================================
  // 3. LOGGING CONTACT AUDIT TO BACKEND
  // ==========================================
  const logContactAudit = async (params: {
    patient_id: number;
    evaluation_id?: number | null;
    channel: 'WHATSAPP' | 'COPIED_TEXT' | 'MANUAL_NOTE';
    recipient_type: string;
    recipient_name?: string;
    recipient_phone?: string;
    template_type?: string;
    message_preview?: string;
    agreement_date?: string;
    agreement_notes?: string;
  }) => {
    try {
      await api.post('/financial/billings/contact-log', {
        patient_id: params.patient_id,
        evaluation_id: params.evaluation_id || null,
        contact_channel: params.channel,
        recipient_type: params.recipient_type,
        recipient_name: params.recipient_name,
        recipient_phone: params.recipient_phone,
        template_type: params.template_type,
        message_preview: params.message_preview,
        agreement_date: params.agreement_date,
        agreement_notes: params.agreement_notes,
      });

      const res = await api.get('/financial/billings-summary');
      if (res.data.psychotherapy_billings) setPsychotherapyBillings(res.data.psychotherapy_billings);
      if (res.data.evaluation_billings) setEvaluationBillings(res.data.evaluation_billings);
      if (res.data.summary) setSummary(res.data.summary);
    } catch (err) {
      console.error('Failed to log contact audit:', err);
    }
  };

  // ==========================================
  // 4. PSYCHOTHERAPY WHATSAPP MODAL LOGIC
  // ==========================================
  const handleOpenPsychModal = (patient: PatientBilling) => {
    setActiveModalPatient(patient);
    setCopiedPsych(false);
    setCustomNotesPsych('');

    const defaultType = getDefaultRecipientType(patient, 'BILLING');
    setSelectedRecipientTypePsych(defaultType);

    const selectionMap: Record<number, boolean> = {};
    const priceMap: Record<number, number> = {};
    patient.sessions.forEach((s) => {
      selectionMap[s.id] = true;
      priceMap[s.id] = Number(s.price) || 0;
    });
    setSelectedSessionIds(selectionMap);
    setSessionPriceOverrides(priceMap);
  };

  const selectedSessionsList = useMemo(() => {
    if (!activeModalPatient) return [];
    return activeModalPatient.sessions.filter((s) => selectedSessionIds[s.id]);
  }, [activeModalPatient, selectedSessionIds]);

  const modalPsychTotalAmount = useMemo(() => {
    return selectedSessionsList.reduce((sum, s) => {
      const price = sessionPriceOverrides[s.id] !== undefined ? sessionPriceOverrides[s.id] : Number(s.price) || 0;
      return sum + price;
    }, 0);
  }, [selectedSessionsList, sessionPriceOverrides]);

  const modalPsychRecipients = useMemo(() => {
    return resolveAvailableRecipients(activeModalPatient, 'BILLING');
  }, [activeModalPatient]);

  const activePsychRecipient = useMemo(() => {
    return modalPsychRecipients.find((r) => r.type === selectedRecipientTypePsych) || modalPsychRecipients[0];
  }, [modalPsychRecipients, selectedRecipientTypePsych]);

  const generatedPsychText = useMemo(() => {
    if (!activeModalPatient || selectedSessionsList.length === 0) return '';

    const patientFirstName = activeModalPatient.patient_name.split(' ')[0];
    const isGuardian = activePsychRecipient?.type === 'GUARDIAN' || activePsychRecipient?.type === 'FINANCIAL_RESPONSIBLE';
    const recipientFirstName = activePsychRecipient?.fullName ? activePsychRecipient.fullName.split(' ')[0] : patientFirstName;
    const sessionCount = selectedSessionsList.length;
    const sessionLabel = sessionCount === 1 ? '1 sessão realizada' : `${sessionCount} sessões realizadas`;

    const sessionLines = selectedSessionsList.map((s) => {
      const dateFormatted = formatDate(s.start_time);
      const timeFormatted = formatTime(s.start_time);
      const price = sessionPriceOverrides[s.id] !== undefined ? sessionPriceOverrides[s.id] : Number(s.price) || 0;
      const modLabel = s.modality === 'ONLINE' ? 'Online' : 'Presencial';
      const timeStr = timeFormatted ? ` às ${timeFormatted}` : '';
      return `• *${dateFormatted}${timeStr}* — ${formatMoney(price)} (${modLabel})`;
    }).join('\n');

    const totalFormatted = formatMoney(modalPsychTotalAmount);
    const psychName = psychologistInfo.name || 'Dr(a). Psicólogo(a)';
    const crpStr = psychologistInfo.crp ? ` (${psychologistInfo.crp})` : '';

    let periodDesc = '';
    if (dateFilterMode === 'MONTH' && selectedMonth) {
      periodDesc = `referente a ${getMonthLabel(selectedMonth)}`;
    } else if (dateFilterMode === 'CUSTOM' && (startDate || endDate)) {
      if (startDate && endDate) {
        periodDesc = `referente ao período de ${formatDate(startDate)} a ${formatDate(endDate)}`;
      } else if (startDate) {
        periodDesc = `referente a partir de ${formatDate(startDate)}`;
      } else if (endDate) {
        periodDesc = `referente até ${formatDate(endDate)}`;
      }
    }

    const bankStr = bankInfo ? `\n• Banco / Instruções: ${bankInfo}` : '';

    if (psychTone === 'FORMAL') {
      const formalRecipient = isGuardian && activePsychRecipient?.fullName ? activePsychRecipient.fullName : activeModalPatient.patient_name;
      const targetReference = isGuardian
        ? ` referente aos atendimentos psicológicos de *${activeModalPatient.patient_name}* prestados por *${psychName}*${crpStr}`
        : ` referente aos atendimentos psicológicos prestados por *${psychName}*${crpStr}`;

      return (
`Prezado(a) *${formalRecipient}*,

Espero que este contato o(a) encontre bem.

Informamos o demonstrativo consolidado de honorários profissionais${periodDesc ? ` (${periodDesc})` : ''}${targetReference}:

📋 *Demonstrativo de Sessões (${sessionLabel}):*
${sessionLines}

💰 *Valor Total a Quitar:* *${totalFormatted}*

🔑 *Instruções de Pagamento (PIX):*
• Tipo de Chave: ${pixKeyType}
• Chave PIX: *${pixKey}*
• Beneficiário: *${pixBeneficiary}*${bankStr}
${customNotesPsych.trim() ? `\n📌 *Observação:* ${customNotesPsych.trim()}` : ''}
Solicitamos a gentileza do envio do respectivo comprovante de transferência para registro contábil e quitação em prontuário.

Permanecemos à disposição para quaisquer esclarecimentos.

Atenciosamente,
*${psychName}*`
      );
    }

    if (psychTone === 'SHORT') {
      const shortContext = isGuardian
        ? `Segue o resumo para acerto dos atendimentos de *${activeModalPatient.patient_name}* com *${psychName}*${periodDesc ? ` (${periodDesc})` : ''}:`
        : `Segue o resumo para acerto dos atendimentos com *${psychName}*${periodDesc ? ` (${periodDesc})` : ''}:`;

      return (
`Olá, *${recipientFirstName}*! Tudo bem?

${shortContext}

📋 *${sessionLabel}:*
${sessionLines}

💰 *Total:* *${totalFormatted}*
🔑 *PIX (${pixKeyType}):* *${pixKey}*
• Favorecido: ${pixBeneficiary}${bankStr}
${customNotesPsych.trim() ? `\n📌 ${customNotesPsych.trim()}` : ''}
Assim que efetuar o pagamento, envie o comprovante por aqui. Muito obrigado(a)!`
      );
    }

    const friendlyContext = isGuardian
      ? `Passando para compartilhar o demonstrativo detalhado das sessões de *${activeModalPatient.patient_name}* em aberto${periodDesc ? ` (${periodDesc})` : ''} para o acerto de honorários:`
      : `Passando para compartilhar o demonstrativo detalhado das suas sessões em aberto${periodDesc ? ` (${periodDesc})` : ''} para o acerto de honorários:`;

    return (
`Olá, *${recipientFirstName}*! Tudo bem? Espero que sim! 😊

Aqui é do consultório de psicologia de *${psychName}*${crpStr}.
${friendlyContext}

📋 *Sessões Realizadas (${sessionLabel}):*
${sessionLines}

💰 *Valor Total:* *${totalFormatted}*

🔑 *Dados para Pagamento via PIX:*
• Tipo de Chave: ${pixKeyType}
• Chave PIX: *${pixKey}*
• Favorecido: *${pixBeneficiary}*${bankStr}
${customNotesPsych.trim() ? `\n📌 *Observação:* ${customNotesPsych.trim()}` : ''}
Assim que realizar a transferência, por gentileza nos envie o comprovante por aqui para registrarmos a baixa no sistema.

Qualquer dúvida ou caso queira combinar algo em relação às datas, estou à total disposição!

Tenha uma ótima semana!`
    );
  }, [
    activeModalPatient,
    activePsychRecipient,
    selectedSessionsList,
    sessionPriceOverrides,
    modalPsychTotalAmount,
    psychTone,
    pixKey,
    pixKeyType,
    pixBeneficiary,
    bankInfo,
    psychologistInfo,
    customNotesPsych,
    dateFilterMode,
    selectedMonth,
    startDate,
    endDate,
  ]);

  const handleCopyPsychMessage = async () => {
    if (!generatedPsychText || !activeModalPatient) return;
    try {
      await navigator.clipboard.writeText(generatedPsychText);
      setCopiedPsych(true);
      setTimeout(() => setCopiedPsych(false), 2500);

      await logContactAudit({
        patient_id: activeModalPatient.patient_id,
        channel: 'COPIED_TEXT',
        recipient_type: activePsychRecipient?.type || 'PATIENT',
        recipient_name: activePsychRecipient?.fullName || activeModalPatient.patient_name,
        recipient_phone: activePsychRecipient?.phone || activeModalPatient.phone,
        template_type: `PSYCH_${psychTone}`,
        message_preview: generatedPsychText.substring(0, 500),
      });
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleOpenPsychWhatsAppLink = async () => {
    if (!activeModalPatient || !generatedPsychText) return;

    if (isSandboxActive) {
      // 🎓 INTERCEPTADOR SEGURO DA SYNAPSIS ACADEMY
      // Fecha o modal de cobrança com suavidade para que a celebração visual da Academy assuma o palco
      setActiveModalPatient(null);
      advanceStep();
      return;
    }

    const phoneClean = activePsychRecipient?.cleanPhone || cleanWhatsAppPhone(activeModalPatient.phone);
    const url = buildWhatsAppLink(phoneClean, generatedPsychText);

    await logContactAudit({
      patient_id: activeModalPatient.patient_id,
      channel: 'WHATSAPP',
      recipient_type: activePsychRecipient?.type || 'PATIENT',
      recipient_name: activePsychRecipient?.fullName || activeModalPatient.patient_name,
      recipient_phone: activePsychRecipient?.phone || activeModalPatient.phone,
      template_type: `PSYCH_${psychTone}`,
      message_preview: generatedPsychText.substring(0, 500),
    });

    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      window.location.href = url;
    }
  };

  // ==========================================
  // 5. EVALUATION WHATSAPP MODAL LOGIC
  // ==========================================
  const handleOpenEvalModal = (evaluation: EvaluationBilling) => {
    setActiveEvalModalTarget(evaluation);
    setCopiedEval(false);
    setCustomNotesEval('');

    const selectionMap: Record<number, boolean> = {};
    let hasOverdue = false;
    evaluation.installments.forEach((inst) => {
      if (inst.is_eligible_for_active_billing) {
        selectionMap[inst.transaction_id] = true;
        if (inst.status === 'OVERDUE' || inst.status === 'DUE_TODAY') hasOverdue = true;
      }
    });

    if (Object.keys(selectionMap).length === 0) {
      evaluation.installments.forEach((inst) => {
        if (inst.status !== 'PAID') selectionMap[inst.transaction_id] = true;
      });
    }
    setSelectedInstallmentIds(selectionMap);

    if (hasOverdue) {
      setEvalTemplateTone('FRIENDLY_OVERDUE');
    } else {
      setEvalTemplateTone('PREVENTIVE');
    }

    const recipients = resolveAvailableRecipients(
      {
        patient_id: evaluation.patient_id,
        patient_name: evaluation.patient_name,
        phone: evaluation.patient_phone,
        guardian: evaluation.guardian,
        financial_responsible: evaluation.financial_responsible,
        whatsapp_routing: evaluation.whatsapp_routing,
      },
      'BILLING'
    );
    const defaultRec = recipients.find((r) => r.type === 'FINANCIAL_RESPONSIBLE') ||
      recipients.find((r) => r.type === 'GUARDIAN') ||
      recipients[0];

    setSelectedRecipientTypeEval(defaultRec ? defaultRec.type : 'PATIENT');
  };

  const selectedEvalInstallmentsList = useMemo(() => {
    if (!activeEvalModalTarget) return [];
    return activeEvalModalTarget.installments.filter((i) => selectedInstallmentIds[i.transaction_id]);
  }, [activeEvalModalTarget, selectedInstallmentIds]);

  const modalEvalTotalAmount = useMemo(() => {
    return selectedEvalInstallmentsList.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  }, [selectedEvalInstallmentsList]);

  const modalEvalRecipients = useMemo(() => {
    if (!activeEvalModalTarget) return [];
    return resolveAvailableRecipients(
      {
        patient_id: activeEvalModalTarget.patient_id,
        patient_name: activeEvalModalTarget.patient_name,
        phone: activeEvalModalTarget.patient_phone,
        guardian: activeEvalModalTarget.guardian,
        financial_responsible: activeEvalModalTarget.financial_responsible,
        whatsapp_routing: activeEvalModalTarget.whatsapp_routing,
      },
      'BILLING'
    );
  }, [activeEvalModalTarget]);

  const activeEvalRecipient = useMemo(() => {
    return modalEvalRecipients.find((r) => r.type === selectedRecipientTypeEval) || modalEvalRecipients[0];
  }, [modalEvalRecipients, selectedRecipientTypeEval]);

  const generatedEvalText = useMemo(() => {
    if (!activeEvalModalTarget || selectedEvalInstallmentsList.length === 0) return '';

    const patientName = activeEvalModalTarget.patient_name;
    const recipientName = activeEvalRecipient?.fullName ? activeEvalRecipient.fullName.split(' ')[0] : patientName.split(' ')[0];
    const psychName = activeEvalModalTarget.psychologist_name || psychologistInfo.name || 'Dr(a). Psicólogo(a)';
    const totalAmountStr = formatMoney(modalEvalTotalAmount);
    const evalTitle = activeEvalModalTarget.title || 'Avaliação Neuropsicológica';
    const bankStr = bankInfo ? `\n• Banco / Instruções: ${bankInfo}` : '';

    const firstInst = selectedEvalInstallmentsList[0];
    const installmentStr = selectedEvalInstallmentsList.length === 1
      ? `${firstInst.installment_number}/${firstInst.total_installments}`
      : selectedEvalInstallmentsList.map((i) => `${i.installment_number}/${i.total_installments}`).join(', ');

    const installmentsLines = selectedEvalInstallmentsList.map((i) => {
      const dueStr = formatDate(i.due_date);
      const overdueNotice = i.status === 'OVERDUE'
        ? ` (Vencida há ${i.days_overdue} dias)`
        : i.status === 'PREVENTIVE'
        ? ` (Vence em ${i.days_until_due} dias)`
        : '';
      return `• *Parcela ${i.installment_number}/${i.total_installments}:* ${formatMoney(i.amount)} — Vencimento: ${dueStr}${overdueNotice}`;
    }).join('\n');

    if (evalTemplateTone === 'PREVENTIVE') {
      return (
`Olá, *${recipientName}*! Tudo bem? Espero que sim! 😊

Aqui é do consultório de psicologia de *${psychName}*.
Passando para lembrar cordialmente que a *parcela ${installmentStr}* referente à *${evalTitle}* de *${patientName}* vencerá nos próximos dias (${formatDate(firstInst.due_date)}).

📋 *Detalhes da Parcela:*
${installmentsLines}

💰 *Valor Total:* *${totalAmountStr}*

🔑 *Chave PIX Oficial da Clínica:*
• Tipo de Chave: ${pixKeyType}
• Chave PIX: *${pixKey}*
• Favorecido: *${pixBeneficiary}*${bankStr}
${customNotesEval.trim() ? `\n📌 *Observação:* ${customNotesEval.trim()}` : ''}
Assim que realizar o pagamento, por gentileza compartilhe o comprovante por aqui para atualizarmos o prontuário.

Qualquer dúvida, estamos à total disposição! Tenha uma excelente semana!`
      );
    }

    if (evalTemplateTone === 'FRIENDLY_OVERDUE') {
      return (
`Olá, *${recipientName}*! Tudo bem?

Aqui é do consultório de psicologia de *${psychName}*.
Gostaríamos de verificar se está tudo certo em relação à *parcela ${installmentStr}* da *${evalTitle}* de *${patientName}*, com vencimento em *${formatDate(firstInst.due_date)}*${firstInst.days_overdue > 0 ? ` (${firstInst.days_overdue} dias atrás)` : ''}.

📋 *Resumo da Parcela em Aberto:*
${installmentsLines}

💰 *Valor Total a Regularizar:* *${totalAmountStr}*

🔑 *Dados para Pagamento via PIX:*
• Tipo de Chave: ${pixKeyType}
• Chave PIX: *${pixKey}*
• Favorecido: *${pixBeneficiary}*${bankStr}
${customNotesEval.trim() ? `\n📌 *Observação:* ${customNotesEval.trim()}` : ''}
Caso o pagamento já tenha sido efetuado, por gentileza nos envie o comprovante para darmos a baixa no sistema. Caso precise de mais prazo ou queira combinar uma data, fique à vontade para nos avisar!

Agradecemos muito pela atenção e compreensão!`
      );
    }

    return (
`Prezado(a) *${activeEvalRecipient?.fullName || recipientName}*,

Espero que este contato o(a) encontre bem.

Entramos em contato referente ao contrato da *${evalTitle}* de *${patientName}*, sob acompanhamento técnico de *${psychName}*.

Constatamos em nosso sistema financeiro parcela(s) pendente(s) de regularização:

📋 *Demonstrativo de Parcelas:*
${installmentsLines}

💰 *Valor Total em Aberto:* *${totalAmountStr}*
📈 *Progresso do Contrato:* ${activeEvalModalTarget.paid_installments_count}/${activeEvalModalTarget.total_installments} parcelas já quitadas

🔑 *Instruções para Quitação (PIX):*
• Tipo de Chave: ${pixKeyType}
• Chave PIX: *${pixKey}*
• Favorecido: *${pixBeneficiary}*${bankStr}
${customNotesEval.trim() ? `\n📌 *Observação:* ${customNotesEval.trim()}` : ''}
Solicitamos a gentileza de realizar a quitação ou nos enviar o respectivo comprovante de transferência. Caso haja necessidade de repactuação de datas, por favor nos responda por este canal para encontrarmos a melhor solução.

Atenciosamente,
*${psychName}*
PsicoGestão`
    );
  }, [
    activeEvalModalTarget,
    activeEvalRecipient,
    selectedEvalInstallmentsList,
    modalEvalTotalAmount,
    evalTemplateTone,
    pixKey,
    pixKeyType,
    pixBeneficiary,
    bankInfo,
    psychologistInfo,
    customNotesEval,
  ]);

  const handleCopyEvalMessage = async () => {
    if (!generatedEvalText || !activeEvalModalTarget) return;
    try {
      await navigator.clipboard.writeText(generatedEvalText);
      setCopiedEval(true);
      setTimeout(() => setCopiedEval(false), 2500);

      await logContactAudit({
        patient_id: activeEvalModalTarget.patient_id,
        evaluation_id: activeEvalModalTarget.evaluation_id,
        channel: 'COPIED_TEXT',
        recipient_type: activeEvalRecipient?.type || 'PATIENT',
        recipient_name: activeEvalRecipient?.fullName || activeEvalModalTarget.patient_name,
        recipient_phone: activeEvalRecipient?.phone || activeEvalModalTarget.patient_phone,
        template_type: `EVAL_${evalTemplateTone}`,
        message_preview: generatedEvalText.substring(0, 500),
      });
    } catch (err) {
      console.error('Failed to copy evaluation text:', err);
    }
  };

  const handleOpenEvalWhatsAppLink = async () => {
    if (!activeEvalModalTarget || !generatedEvalText) return;

    if (isSandboxActive) {
      setActiveEvalModalTarget(null);
      return;
    }

    const phoneClean = activeEvalRecipient?.cleanPhone || cleanWhatsAppPhone(activeEvalModalTarget.patient_phone);
    const url = buildWhatsAppLink(phoneClean, generatedEvalText);

    await logContactAudit({
      patient_id: activeEvalModalTarget.patient_id,
      evaluation_id: activeEvalModalTarget.evaluation_id,
      channel: 'WHATSAPP',
      recipient_type: activeEvalRecipient?.type || 'PATIENT',
      recipient_name: activeEvalRecipient?.fullName || activeEvalModalTarget.patient_name,
      recipient_phone: activeEvalRecipient?.phone || activeEvalModalTarget.patient_phone,
      template_type: `EVAL_${evalTemplateTone}`,
      message_preview: generatedEvalText.substring(0, 500),
    });

    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      window.location.href = url;
    }
  };

  // ==========================================
  // 6. PAYMENT AGREEMENT (ACORDO) MODAL LOGIC
  // ==========================================
  const handleOpenAgreementModal = (target: {
    patient_id: number;
    evaluation_id?: number | null;
    title: string;
    patient_name: string;
    current_date?: string;
    current_notes?: string;
  }) => {
    setActiveAgreementTarget(target);
    const defaultDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().substring(0, 10);
    setAgreementDate(target.current_date || defaultDate);
    setAgreementNotes(target.current_notes || '');
  };

  const handleSaveAgreement = async () => {
    if (!activeAgreementTarget || !agreementDate) return;
    try {
      setIsSavingAgreement(true);
      await logContactAudit({
        patient_id: activeAgreementTarget.patient_id,
        evaluation_id: activeAgreementTarget.evaluation_id || null,
        channel: 'MANUAL_NOTE',
        recipient_type: 'PATIENT',
        recipient_name: activeAgreementTarget.patient_name,
        template_type: 'AGREEMENT',
        agreement_date: agreementDate,
        agreement_notes: agreementNotes,
        message_preview: `Promessa de pagamento registrada para ${formatDate(agreementDate)}: ${agreementNotes}`,
      });
      setActiveAgreementTarget(null);
    } catch (err) {
      console.error('Failed to save payment agreement:', err);
      alert('Erro ao registrar acordo de pagamento.');
    } finally {
      setIsSavingAgreement(false);
    }
  };

  // ==========================================
  // 7. QUICK SETTLE MODAL LOGIC
  // ==========================================
  const handleOpenQuickSettlePsych = (patient: PatientBilling) => {
    setQuickSettleTarget({
      patient_id: patient.patient_id,
      patient_name: patient.patient_name,
      items: patient.sessions.map((s) => ({
        id: s.id,
        label: `Sessão ${formatDate(s.start_time)}`,
        amount: Number(s.price) || 0,
      })),
      total: patient.total_pending_amount,
      isEvaluation: false,
    });
    setQuickSettleDate(new Date().toISOString().substring(0, 10));
    setQuickSettleMethod('PIX');
    setQuickSettleNotes('');
    setQuickSettleSuccess(null);
  };

  const handleOpenQuickSettleEval = (evaluation: EvaluationBilling, installment: EvaluationInstallment) => {
    setQuickSettleTarget({
      patient_id: evaluation.patient_id,
      patient_name: evaluation.patient_name,
      items: [
        {
          id: -installment.transaction_id,
          label: `Parcela ${installment.installment_number}/${installment.total_installments} (${evaluation.title})`,
          amount: installment.amount,
        },
      ],
      total: installment.amount,
      isEvaluation: true,
    });
    setQuickSettleDate(new Date().toISOString().substring(0, 10));
    setQuickSettleMethod('PIX');
    setQuickSettleNotes(`Quitação da parcela ${installment.installment_number}/${installment.total_installments} da avaliação`);
    setQuickSettleSuccess(null);
  };

  const handleOpenQuickSettleEvalBatch = (evaluation: EvaluationBilling) => {
    const pendingInstallments = evaluation.installments.filter((i) => i.status !== 'PAID');
    const totalPending = pendingInstallments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    setQuickSettleTarget({
      patient_id: evaluation.patient_id,
      patient_name: evaluation.patient_name,
      items: pendingInstallments.map((inst) => ({
        id: -inst.transaction_id,
        label: `Parcela ${inst.installment_number}/${inst.total_installments} (${formatDate(inst.due_date)})`,
        amount: Number(inst.amount) || 0,
      })),
      total: totalPending,
      isEvaluation: true,
    });
    setQuickSettleDate(new Date().toISOString().substring(0, 10));
    setQuickSettleMethod('PIX');
    setQuickSettleNotes(`Quitação de parcelas da avaliação - ${evaluation.title}`);
    setQuickSettleSuccess(null);
  };

  const handleExecuteQuickSettle = async () => {
    if (!quickSettleTarget || quickSettleTarget.items.length === 0) return;

    try {
      setIsSubmittingQuickSettle(true);
      const settlements = quickSettleTarget.items.map((it) => ({
        session_id: it.id,
        amount: it.amount,
      }));

      await api.post('/financial/settle-sessions', {
        patient_id: quickSettleTarget.patient_id,
        payment_date: quickSettleDate,
        payment_method: quickSettleMethod,
        notes: quickSettleNotes || 'Baixa rápida realizada no módulo de cobranças',
        settlements,
      });

      setQuickSettleSuccess('Pagamento registrado com sucesso!');
      setTimeout(() => {
        setQuickSettleTarget(null);
        setQuickSettleSuccess(null);
        fetchBillings();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to settle items:', err);
      alert(err.response?.data?.error || 'Erro ao dar baixa nos itens selecionados');
    } finally {
      setIsSubmittingQuickSettle(false);
    }
  };

  // Helper to render contact badge
  const renderContactBadge = (badge?: BillingContactBadge, onOpenAgreement?: () => void) => {
    if (!badge) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
          <Clock className="h-3 w-3" />
          Nunca contatado
        </span>
      );
    }

    if (badge.badge === 'AGREEMENT_PENDING') {
      return (
        <span
          onClick={onOpenAgreement}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 transition"
          title={badge.agreement_notes ? `Acordo: ${badge.agreement_notes}` : 'Promessa de pagamento registrada'}
        >
          <Handshake className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>{badge.label}</span>
        </span>
      );
    }

    if (badge.badge === 'AGREEMENT_OVERDUE') {
      return (
        <span
          onClick={onOpenAgreement}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 transition"
          title={badge.agreement_notes ? `Acordo não cumprido: ${badge.agreement_notes}` : 'Acordo com prazo vencido'}
        >
          <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          <span>{badge.label}</span>
        </span>
      );
    }

    if (badge.badge === 'RECENTLY_CONTACTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{badge.label}</span>
        </span>
      );
    }

    if (badge.badge === 'OVERDUE_CONTACT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span>{badge.label}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
        <Clock className="h-3 w-3" />
        {badge.label}
      </span>
    );
  };

  // Helper to render Psychotherapy Card
  const renderPsychotherapyCard = (patient: PatientBilling) => {
    const isExpanded = expandedPatientId === patient.patient_id;

    return (
      <div
        key={patient.patient_id}
        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden transition"
      >
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm border border-teal-500/20 shrink-0">
              {patient.patient_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {patient.patient_name}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {patient.pending_count} {patient.pending_count === 1 ? 'sessão em aberto' : 'sessões em aberto'}
                </span>
                {(patient.overdue_sessions_count || 0) > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20">
                    {patient.overdue_sessions_count} vencida(s)
                  </span>
                )}
                {(patient.preventive_sessions_count || 0) > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {patient.preventive_sessions_count} a vencer (5d)
                  </span>
                )}
                {renderContactBadge(patient.contact_badge, () =>
                  handleOpenAgreementModal({
                    patient_id: patient.patient_id,
                    title: 'Psicoterapia Clínica',
                    patient_name: patient.patient_name,
                    current_date: patient.contact_badge?.agreement_date,
                    current_notes: patient.contact_badge?.agreement_notes,
                  })
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{patient.phone || 'Sem telefone'}</span>
                </div>
                {patient.cpf && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">CPF:</span>
                    <span>{patient.cpf}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {patient.pending_count === 1
                      ? `Em ${formatDate(patient.oldest_date)}`
                      : `De ${formatDate(patient.oldest_date)} até ${formatDate(patient.latest_date)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions & Total */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:self-center">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium">Total em Aberto</div>
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatMoney(patient.total_pending_amount)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                data-tour="billings-whatsapp-batch-btn"
                onClick={() => handleOpenPsychModal(patient)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Cobrança WhatsApp</span>
              </button>

              <button
                onClick={() =>
                  handleOpenAgreementModal({
                    patient_id: patient.patient_id,
                    title: 'Psicoterapia Clínica',
                    patient_name: patient.patient_name,
                    current_date: patient.contact_badge?.agreement_date,
                    current_notes: patient.contact_badge?.agreement_notes,
                  })
                }
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition cursor-pointer"
                title="Registrar Acordo / Promessa de Pagamento"
              >
                <Handshake className="h-4 w-4 text-blue-500" />
              </button>

              <button
                onClick={() => handleOpenAsaasModalPsych(patient)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 dark:from-teal-950/40 dark:to-cyan-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-semibold text-xs transition cursor-pointer"
                title="Cobrar via Asaas (PIX Dinâmico + Cartão com baixa automática)"
              >
                <QrCode className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span className="hidden md:inline">Cobrança Asaas</span>
              </button>

              <button
                onClick={() => handleOpenQuickSettlePsych(patient)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-semibold text-xs transition cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />
                <span className="hidden sm:inline">Quitar</span>
              </button>

              <button
                onClick={() => setExpandedPatientId(isExpanded ? null : patient.patient_id)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Psychotherapy Details */}
        {isExpanded && (
          <div className="border-t border-slate-100 dark:border-slate-700/70 bg-slate-50/50 dark:bg-slate-900/40 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Detalhamento das Sessões Pendentes ({patient.sessions.length}):
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {patient.sessions.map((s, idx) => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Sessão #{idx + 1}</span>
                      <span className="text-slate-400 font-normal">•</span>
                      <span>{formatDate(s.start_time)}</span>
                      {formatTime(s.start_time) && (
                        <span className="text-slate-400 font-normal">às {formatTime(s.start_time)}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {s.modality === 'ONLINE' ? 'Atendimento Online' : 'Atendimento Presencial'}
                      {s.recurrence_pattern ? ` • ${s.recurrence_pattern}` : ''}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(Number(s.price) || 0)}
                    </div>
                    {s.is_overdue ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 font-bold border border-red-500/20">
                        Vencida {s.days_overdue && s.days_overdue > 0 ? `há ${s.days_overdue}d` : 'hoje'}
                      </span>
                    ) : s.is_preventive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                        A vencer {s.days_until_due ? `em ${s.days_until_due}d` : 'breve'}
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        Agendada
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper to render Evaluation Card
  const renderEvaluationCard = (ev: EvaluationBilling) => {
    const isExpanded = expandedEvaluationId === ev.evaluation_id;

    return (
      <div
        key={ev.evaluation_id}
        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden transition"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm border border-purple-500/20 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {ev.patient_name}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  {ev.title}
                </span>
                {ev.overdue_installments_count > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse">
                    {ev.overdue_installments_count} vencida(s)
                  </span>
                )}
                {ev.preventive_installments_count > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {ev.preventive_installments_count} a vencer (5d)
                  </span>
                )}
                {renderContactBadge(ev.contact_badge, () =>
                  handleOpenAgreementModal({
                    patient_id: ev.patient_id,
                    evaluation_id: ev.evaluation_id,
                    title: ev.title,
                    patient_name: ev.patient_name,
                    current_date: ev.contact_badge?.agreement_date,
                    current_notes: ev.contact_badge?.agreement_notes,
                  })
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{ev.patient_phone || 'Sem telefone'}</span>
                </div>
                {ev.patient_cpf && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">CPF:</span>
                    <span>{ev.patient_cpf}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    Contrato: <strong>{formatMoney(ev.total_price)}</strong> ({ev.paid_installments_count}/{ev.total_installments} parcelas pagas)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions & Total Ativo */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:self-center">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium">Cobrança Ativa (Vencida/Preventiva)</div>
              <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {formatMoney(ev.active_amount)}
              </div>
              <div className="text-[11px] text-slate-400">
                Total em aberto: {formatMoney(ev.pending_amount)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenEvalModal(ev)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Cobrar Avaliação</span>
              </button>

              <button
                onClick={() =>
                  handleOpenAgreementModal({
                    patient_id: ev.patient_id,
                    evaluation_id: ev.evaluation_id,
                    title: ev.title,
                    patient_name: ev.patient_name,
                    current_date: ev.contact_badge?.agreement_date,
                    current_notes: ev.contact_badge?.agreement_notes,
                  })
                }
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition cursor-pointer"
                title="Registrar Acordo / Promessa de Pagamento"
              >
                <Handshake className="h-4 w-4 text-blue-500" />
              </button>

              <button
                onClick={() => handleOpenAsaasModalEvalBatch(ev)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 dark:from-teal-950/40 dark:to-cyan-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-semibold text-xs transition cursor-pointer"
                title="Cobrar via Asaas (PIX Dinâmico + Cartão com baixa automática)"
              >
                <QrCode className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span className="hidden md:inline">Cobrança Asaas</span>
              </button>

              <button
                onClick={() => handleOpenQuickSettleEvalBatch(ev)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-semibold text-xs transition cursor-pointer"
                title="Quitar parcelas em aberto manualmente"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />
                <span className="hidden sm:inline">Quitar</span>
              </button>

              <button
                onClick={() => setExpandedEvaluationId(isExpanded ? null : ev.evaluation_id)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Contract Timeline / Mini-cronograma Visual */}
        <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 dark:border-slate-700/60 pt-3 bg-slate-50/40 dark:bg-slate-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-teal-500" />
              Cronograma de Parcelas do Contrato:
            </span>
            <span className="text-[11px] text-slate-400">
              {ev.paid_installments_count}/{ev.total_installments} quitadas • {formatMoney(ev.paid_amount)} pago de {formatMoney(ev.total_price)}
            </span>
          </div>

          {/* Installment Pills Row */}
          <div className="flex flex-wrap gap-2">
            {ev.installments.map((inst) => {
              const isPaid = inst.status === 'PAID';
              const isOverdue = inst.status === 'OVERDUE' || inst.status === 'DUE_TODAY';
              const isPreventive = inst.status === 'PREVENTIVE';

              let pillStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
              let statusText = `A vencer em ${formatDate(inst.due_date)}`;

              if (isPaid) {
                pillStyle = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
                statusText = `Pago em ${formatDate(inst.paid_at || inst.due_date)}`;
              } else if (isOverdue) {
                pillStyle = 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 font-bold';
                statusText = inst.days_overdue > 0 ? `Vencida há ${inst.days_overdue}d (${formatDate(inst.due_date)})` : `Vence Hoje!`;
              } else if (isPreventive) {
                pillStyle = 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold';
                statusText = `Vence em ${inst.days_until_due}d (${formatDate(inst.due_date)})`;
              }

              return (
                <div
                  key={inst.transaction_id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${pillStyle}`}
                >
                  <span className="font-bold">
                    {inst.installment_number}/{inst.total_installments}
                  </span>
                  <span>•</span>
                  <span>{formatMoney(inst.amount)}</span>
                  <span>•</span>
                  <span className="text-[11px]">{statusText}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expanded Full Details */}
        {isExpanded && (
          <div className="border-t border-slate-100 dark:border-slate-700/70 bg-white dark:bg-slate-800 p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Dados do Paciente & Responsáveis:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Nome: <strong>{ev.patient_name}</strong>
                </p>
                {ev.financial_responsible && (
                  <p className="text-slate-600 dark:text-slate-400">
                    Resp. Financeiro: <strong>{ev.financial_responsible.name}</strong> ({ev.financial_responsible.phone || 'Sem telefone'})
                  </p>
                )}
                {ev.guardian && (
                  <p className="text-slate-600 dark:text-slate-400">
                    Guardião/Mãe/Pai: <strong>{ev.guardian.name}</strong> ({ev.guardian.phone || 'Sem telefone'})
                  </p>
                )}
              </div>

              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Contrato de Avaliação:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Título: <strong>{ev.title}</strong>
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Status do Laudo: <strong className="uppercase">{ev.status}</strong>
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Psicólogo(a): <strong>{ev.psychologist_name}</strong>
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Último Contato Realizado:
                </span>
                {ev.last_contact ? (
                  <div className="space-y-0.5 text-slate-600 dark:text-slate-400">
                    <p>
                      Canal: <strong>{ev.last_contact.contact_channel}</strong> em {formatDate(ev.last_contact.created_at)}
                    </p>
                    <p>
                      Por: <strong>{ev.last_contact.created_by_name || 'Sistema'}</strong>
                    </p>
                    {ev.last_contact.agreement_notes && (
                      <p className="italic text-blue-600 dark:text-blue-400">
                        Nota: "{ev.last_contact.agreement_notes}"
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400">Nenhum acionamento registrado ainda.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Cobranças & Lembretes WhatsApp
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gestão integrada de honorários: Sessões de Psicoterapia e Parcelas de Avaliações com cronograma de contratos e chave PIX oficial
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPixSettingsOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-semibold text-xs transition cursor-pointer"
          >
            <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Chave PIX Oficial</span>
          </button>

          <button
            onClick={fetchBillings}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Main Specialized Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition ${
            activeTab === 'overview'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Visão Geral (Todas as Cobranças)
        </button>

        <button
          onClick={() => setActiveTab('psychotherapy')}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition ${
            activeTab === 'psychotherapy'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <User className="h-4 w-4" />
          <span>Sessões de Psicoterapia ({filteredPsychotherapy.length})</span>
          {psychOverdueStats.overdueSessions > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-extrabold">
              {psychOverdueStats.overdueSessions} vencida(s)
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('evaluations')}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition ${
            activeTab === 'evaluations'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Parcelas de Avaliações ({filteredEvaluations.length})
          {summary.evaluations_overdue_count > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-extrabold">
              {summary.evaluations_overdue_count} vencida(s)
            </span>
          )}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Ativo a Cobrar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Total em Aberto Ativo</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatMoney(dynamicPsychSummary.total_pending_amount + dynamicEvalSummary.active_amount)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            Psicoterapia + Parcelas vencidas/preventivas
          </div>
        </div>

        {/* Psicoterapia Pendente */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            <span>Sessões de Psicoterapia</span>
            <User className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
            {formatMoney(dynamicPsychSummary.total_pending_amount)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            {dynamicPsychSummary.overdue_count > 0 ? (
              <span className="text-red-500 font-semibold">
                {dynamicPsychSummary.overdue_count} vencida(s) •{' '}
              </span>
            ) : null}
            {dynamicPsychSummary.preventive_count > 0 ? (
              <span className="text-amber-500 font-semibold">
                {dynamicPsychSummary.preventive_count} a vencer (5d) •{' '}
              </span>
            ) : null}
            <span>{dynamicPsychSummary.total_pending_sessions} sessões ({dynamicPsychSummary.patients_with_pending_count} pacientes)</span>
          </div>
        </div>

        {/* Parcelas de Avaliações Ativas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
            <span>Avaliações (Vencidas / Preventivas)</span>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatMoney(dynamicEvalSummary.active_amount)}
          </div>
          <div className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-400/80">
            {dynamicEvalSummary.overdue_count} vencida(s) • {dynamicEvalSummary.preventive_count} a vencer (5d)
          </div>
        </div>

        {/* Chave PIX Oficial */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-teal-600 dark:text-teal-400 font-medium">
            <span>Chave PIX da Clínica</span>
            <CreditCard className="h-4 w-4 text-teal-500" />
          </div>
          <div className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
            {pixKey || 'Não configurada'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Tipo: {pixKeyType} • Favorecido: {pixBeneficiary ? pixBeneficiary.split(' ')[0] : 'Clínica'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar com Mês e Período de Datas (Padrão Idêntico a Receitas) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por paciente, telefone, CPF ou avaliação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtro de Datas: Todo o Histórico | Mês | Período */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setDateFilterMode('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  dateFilterMode === 'ALL'
                    ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-700 dark:text-teal-300'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Todo o Histórico
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode('MONTH')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  dateFilterMode === 'MONTH'
                    ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-700 dark:text-teal-300'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Mês
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode('PERIOD')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  dateFilterMode === 'PERIOD'
                    ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-700 dark:text-teal-300'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Período
              </button>
            </div>

            {dateFilterMode === 'MONTH' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white font-medium focus:outline-hidden"
              />
            )}

            {dateFilterMode === 'PERIOD' && (
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-white font-medium focus:outline-hidden"
                />
                <span className="text-slate-400">até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-white font-medium focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().substring(0, 10);
                    setStartDate(today);
                    setEndDate(today);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Hoje
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENT 1: VISÃO GERAL (TODAS AS COBRANÇAS) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-xs">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Group 1: Vencimento */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => {
                    setPsychDueFilter('ALL');
                    setEvalDueFilter('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychDueFilter === 'ALL' && evalDueFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todas ({psychotherapyBillings.length + evaluationBillings.length})
                </button>
                <button
                  onClick={() => {
                    setPsychDueFilter('OVERDUE');
                    setEvalDueFilter('OVERDUE');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychDueFilter === 'OVERDUE' && evalDueFilter === 'OVERDUE'
                      ? 'bg-red-500 text-white font-bold shadow-xs'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Vencidas ({psychOverdueStats.overdueSessions + summary.evaluations_overdue_count})</span>
                </button>
                <button
                  onClick={() => {
                    setPsychDueFilter('PREVENTIVE');
                    setEvalDueFilter('PREVENTIVE');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychDueFilter === 'PREVENTIVE' && evalDueFilter === 'PREVENTIVE'
                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>A Vencer (5 dias)</span>
                </button>
                <button
                  onClick={() => {
                    setPsychDueFilter('AGREEMENT');
                    setEvalDueFilter('AGREEMENT');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychDueFilter === 'AGREEMENT' && evalDueFilter === 'AGREEMENT'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  <Handshake className="h-3.5 w-3.5" />
                  <span>Com Acordo</span>
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

              {/* Group 2: Contato / Recência */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => {
                    setPsychContactFilter('ALL');
                    setEvalContactFilter('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychContactFilter === 'ALL' && evalContactFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todos Contatos
                </button>
                <button
                  onClick={() => {
                    setPsychContactFilter('OVERDUE_CONTACT');
                    setEvalContactFilter('OVERDUE_CONTACT');
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychContactFilter === 'OVERDUE_CONTACT' && evalContactFilter === 'OVERDUE_CONTACT'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Sem Cobrança &gt; 7d
                </button>
                <button
                  onClick={() => {
                    setPsychContactFilter('NEVER');
                    setEvalContactFilter('NEVER');
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychContactFilter === 'NEVER' && evalContactFilter === 'NEVER'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Nunca Contatados
                </button>
              </div>
            </div>
          </div>

          {/* Seção 1: Parcelas de Avaliações */}
          {filteredEvaluations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Avaliações Neuropsicológicas / Laudos Fechados ({filteredEvaluations.length})
                </h3>
                <button
                  onClick={() => setActiveTab('evaluations')}
                  className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver todas as avaliações</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {filteredEvaluations.slice(0, 3).map((ev) => renderEvaluationCard(ev))}
              </div>
            </div>
          )}

          {/* Seção 2: Sessões de Psicoterapia */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="h-4 w-4 text-teal-500" />
                Sessões de Psicoterapia em Aberto ({filteredPsychotherapy.length})
              </h3>
              <button
                onClick={() => setActiveTab('psychotherapy')}
                className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver com filtros de mês/período</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {filteredPsychotherapy.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Nenhuma sessão de psicoterapia em aberto encontrada.</p>
                </div>
              ) : (
                filteredPsychotherapy.slice(0, 5).map((p) => renderPsychotherapyCard(p))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 2: SESSÕES DE PSICOTERAPIA */}
      {/* ========================================================================= */}
      {activeTab === 'psychotherapy' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-xs">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Group 1: Vencimento */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setPsychDueFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychDueFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todas ({psychotherapyBillings.length})
                </button>
                <button
                  onClick={() => setPsychDueFilter('OVERDUE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychDueFilter === 'OVERDUE'
                      ? 'bg-red-500 text-white font-bold shadow-xs'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Vencidas ({psychOverdueStats.overdueSessions})</span>
                </button>
                <button
                  onClick={() => setPsychDueFilter('PREVENTIVE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychDueFilter === 'PREVENTIVE'
                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>A Vencer (5 dias)</span>
                </button>
                <button
                  onClick={() => setPsychDueFilter('AGREEMENT')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychDueFilter === 'AGREEMENT'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  <Handshake className="h-3.5 w-3.5" />
                  <span>Com Acordo</span>
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

              {/* Group 2: Contato / Recência */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setPsychContactFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychContactFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todos Contatos
                </button>
                <button
                  onClick={() => setPsychContactFilter('OVERDUE_CONTACT')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychContactFilter === 'OVERDUE_CONTACT'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Sem Cobrança &gt; 7d
                </button>
                <button
                  onClick={() => setPsychContactFilter('NEVER')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    psychContactFilter === 'NEVER'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Nunca Contatados
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

              {/* Group 3: WhatsApp */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setWhatsappFilter(whatsappFilter === 'WITH_PHONE' ? 'ALL' : 'WITH_PHONE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    whatsappFilter === 'WITH_PHONE'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Filtrar pacientes com telefone/WhatsApp cadastrado"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Com WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="inline-block animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full mb-3" />
                <p>Carregando pacientes com sessões em aberto...</p>
              </div>
            ) : filteredPsychotherapy.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 mb-3">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Nenhuma sessão pendente encontrada
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Todos os atendimentos de psicoterapia dentro do filtro selecionado estão quitados.
                </p>
              </div>
            ) : (
              filteredPsychotherapy.map((patient) => renderPsychotherapyCard(patient))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 3: PARCELAS DE AVALIAÇÕES NEUROPSICOLÓGICAS */}
      {/* ========================================================================= */}
      {activeTab === 'evaluations' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-xs">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setEvalDueFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    evalDueFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todas ({evaluationBillings.length})
                </button>
                <button
                  onClick={() => setEvalDueFilter('OVERDUE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    evalDueFilter === 'OVERDUE'
                      ? 'bg-red-500 text-white font-bold shadow-xs'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Vencidas ({summary.evaluations_overdue_count})</span>
                </button>
                <button
                  onClick={() => setEvalDueFilter('PREVENTIVE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    evalDueFilter === 'PREVENTIVE'
                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>A Vencer (5 dias)</span>
                </button>
                <button
                  onClick={() => setEvalDueFilter('AGREEMENT')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    evalDueFilter === 'AGREEMENT'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  <Handshake className="h-3.5 w-3.5" />
                  <span>Com Acordo</span>
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

              <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setEvalContactFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    evalContactFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todos Contatos
                </button>
                <button
                  onClick={() => setEvalContactFilter('OVERDUE_CONTACT')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    evalContactFilter === 'OVERDUE_CONTACT'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Sem Cobrança &gt; 7d
                </button>
                <button
                  onClick={() => setEvalContactFilter('NEVER')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    evalContactFilter === 'NEVER'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Nunca Contatados
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="inline-block animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full mb-3" />
                <p>Carregando parcelas de avaliações neuropsicológicas...</p>
              </div>
            ) : filteredEvaluations.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 mb-3">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Nenhuma avaliação com pendência encontrada
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Todas as parcelas de avaliações estão em dia ou não há contratos cadastrados correspondentes ao filtro.
                </p>
              </div>
            ) : (
              filteredEvaluations.map((ev) => renderEvaluationCard(ev))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: GERADOR DE COBRANÇA WHATSAPP - PSICOTERAPIA */}
      {/* ========================================================================= */}
      {activeModalPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Demonstrativo & Mensagem de Cobrança (Psicoterapia)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paciente: <strong className="text-slate-800 dark:text-slate-200">{activeModalPatient.patient_name}</strong>
                    {activeModalPatient.phone ? ` • WhatsApp: ${activeModalPatient.phone}` : ' • (Sem telefone)'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveModalPatient(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-5 space-y-6">
              {/* Session Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    1. Selecione as Sessões a Incluir:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-tour="billings-select-all"
                      onClick={() => {
                        const all: Record<number, boolean> = {};
                        activeModalPatient.sessions.forEach((s) => (all[s.id] = true));
                        setSelectedSessionIds(all);
                      }}
                      className="text-[11px] font-semibold text-teal-600 hover:underline cursor-pointer"
                    >
                      Selecionar Todas
                    </button>
                    <span className="text-slate-400">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSessionIds({})}
                      className="text-[11px] font-semibold text-slate-400 hover:underline cursor-pointer"
                    >
                      Desmarcar Todas
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeModalPatient.sessions.map((s) => {
                    const isSelected = Boolean(selectedSessionIds[s.id]);
                    const currentPrice =
                      sessionPriceOverrides[s.id] !== undefined
                        ? sessionPriceOverrides[s.id]
                        : Number(s.price) || 0;

                    return (
                      <div
                        key={s.id}
                        onClick={() =>
                          setSelectedSessionIds((prev) => ({
                            ...prev,
                            [s.id]: !prev[s.id],
                          }))
                        }
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 text-xs ${
                          isSelected
                            ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/40'
                            : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatDate(s.start_time)}
                            </span>
                            {formatTime(s.start_time) && (
                              <span className="text-slate-400 ml-1.5">às {formatTime(s.start_time)}</span>
                            )}
                            <span className="text-slate-400 ml-1.5">
                              ({s.modality === 'ONLINE' ? 'Online' : 'Presencial'})
                            </span>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-slate-400 text-[11px]">Valor: R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={currentPrice}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setSessionPriceOverrides((prev) => ({
                                ...prev,
                                [s.id]: val,
                              }));
                            }}
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-right font-bold text-emerald-600 dark:text-emerald-400 text-xs"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Message Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                    2. Tom da Mensagem:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPsychTone('FRIENDLY')}
                      className={`p-2 rounded-xl text-xs font-semibold border text-center transition cursor-pointer ${
                        psychTone === 'FRIENDLY'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Acolhedor
                    </button>
                    <button
                      type="button"
                      onClick={() => setPsychTone('FORMAL')}
                      className={`p-2 rounded-xl text-xs font-semibold border text-center transition cursor-pointer ${
                        psychTone === 'FORMAL'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Formal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPsychTone('SHORT')}
                      className={`p-2 rounded-xl text-xs font-semibold border text-center transition cursor-pointer ${
                        psychTone === 'SHORT'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Curto
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                    Observação Adicional (Opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Sessão do dia 12 com 10% de desconto"
                    value={customNotesPsych}
                    onChange={(e) => setCustomNotesPsych(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Recipient Selector */}
              <WhatsAppRecipientSelector
                recipients={modalPsychRecipients}
                selectedType={selectedRecipientTypePsych}
                onSelectRecipient={(t) => setSelectedRecipientTypePsych(t)}
                patientName={activeModalPatient.patient_name}
              />

              {/* WhatsApp Authentic Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                    Prévia Formatada no WhatsApp:
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    {selectedSessionsList.length} sessões • Total: {formatMoney(modalPsychTotalAmount)}
                  </span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-[#efeae2] dark:bg-[#0b141a] border border-slate-300 dark:border-slate-700 shadow-inner">
                  <div className="max-w-xl ml-auto bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 p-4 rounded-2xl rounded-tr-xs shadow-sm text-xs leading-relaxed whitespace-pre-wrap select-text">
                    {generatedPsychText}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCopyPsychMessage}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                  copiedPsych
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {copiedPsych ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                <span>{copiedPsych ? 'Copiado para Área de Transferência!' : 'Copiar Texto da Mensagem'}</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveModalPatient(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  data-tour="whatsapp-batch-confirm-btn"
                  onClick={handleOpenPsychWhatsAppLink}
                  disabled={selectedSessionsList.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>Enviar no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: GERADOR DE COBRANÇA WHATSAPP - AVALIAÇÕES NEUROPSICOLÓGICAS */}
      {/* ========================================================================= */}
      {activeEvalModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Cobrança de Avaliação Neuropsicológica
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paciente: <strong className="text-slate-800 dark:text-slate-200">{activeEvalModalTarget.patient_name}</strong>
                    {' • '}{activeEvalModalTarget.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveEvalModalTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-5 space-y-6">
              {/* Installment Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    1. Selecione as Parcelas a Cobrar:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const all: Record<number, boolean> = {};
                        activeEvalModalTarget.installments.forEach((i) => {
                          if (i.status !== 'PAID') all[i.transaction_id] = true;
                        });
                        setSelectedInstallmentIds(all);
                      }}
                      className="text-[11px] font-semibold text-teal-600 hover:underline cursor-pointer"
                    >
                      Selecionar Todas Pendentes
                    </button>
                    <span className="text-slate-400">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedInstallmentIds({})}
                      className="text-[11px] font-semibold text-slate-400 hover:underline cursor-pointer"
                    >
                      Desmarcar Todas
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeEvalModalTarget.installments.map((inst) => {
                    const isSelected = Boolean(selectedInstallmentIds[inst.transaction_id]);
                    const isPaid = inst.status === 'PAID';

                    return (
                      <div
                        key={inst.transaction_id}
                        onClick={() => {
                          if (isPaid) return;
                          setSelectedInstallmentIds((prev) => ({
                            ...prev,
                            [inst.transaction_id]: !prev[inst.transaction_id],
                          }));
                        }}
                        className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 text-xs ${
                          isPaid
                            ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                            : isSelected
                            ? 'bg-purple-500/10 border-purple-500/40 cursor-pointer'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isPaid ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : isSelected ? (
                            <CheckSquare className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400 shrink-0" />
                          )}

                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              Parcela {inst.installment_number}/{inst.total_installments}
                            </span>
                            <span className="text-slate-400 ml-1.5">•</span>
                            <span className="text-slate-500 dark:text-slate-400 ml-1.5">
                              Vencimento: {formatDate(inst.due_date)}
                            </span>
                            {inst.status === 'OVERDUE' && (
                              <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-extrabold">
                                Vencida há {inst.days_overdue}d
                              </span>
                            )}
                            {inst.status === 'PREVENTIVE' && (
                              <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-bold">
                                Vence em {inst.days_until_due}d
                              </span>
                            )}
                            {isPaid && (
                              <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold">
                                Paga
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {formatMoney(inst.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Template Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                    2. Modelo de Mensagem Especializado:
                  </label>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setEvalTemplateTone('PREVENTIVE')}
                      className={`w-full p-2 rounded-xl text-xs font-semibold border text-left flex items-center justify-between transition cursor-pointer ${
                        evalTemplateTone === 'PREVENTIVE'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 shadow-2xs font-bold'
                          : 'bg-slate-50 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span>Lembrete Preventivo (Vencimento Próximo)</span>
                      </div>
                      {evalTemplateTone === 'PREVENTIVE' && <Check className="h-3.5 w-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEvalTemplateTone('FRIENDLY_OVERDUE')}
                      className={`w-full p-2 rounded-xl text-xs font-semibold border text-left flex items-center justify-between transition cursor-pointer ${
                        evalTemplateTone === 'FRIENDLY_OVERDUE'
                          ? 'bg-teal-500/10 border-teal-500 text-teal-700 dark:text-teal-300 shadow-2xs font-bold'
                          : 'bg-slate-50 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-teal-500" />
                        <span>Atraso Amigável (Acolhedor / Recém-vencido)</span>
                      </div>
                      {evalTemplateTone === 'FRIENDLY_OVERDUE' && <Check className="h-3.5 w-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEvalTemplateTone('FORMAL_REGULARIZATION')}
                      className={`w-full p-2 rounded-xl text-xs font-semibold border text-left flex items-center justify-between transition cursor-pointer ${
                        evalTemplateTone === 'FORMAL_REGULARIZATION'
                          ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 shadow-2xs font-bold'
                          : 'bg-slate-50 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-purple-500" />
                        <span>Regularização Financeira (Formal e Detalhado)</span>
                      </div>
                      {evalTemplateTone === 'FORMAL_REGULARIZATION' && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                    Observação Adicional (Opcional):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Conforme conversado, combinamos o vencimento da 2ª parcela para o dia 20."
                    value={customNotesEval}
                    onChange={(e) => setCustomNotesEval(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white resize-none"
                  />
                </div>
              </div>

              {/* Recipient Selector */}
              <WhatsAppRecipientSelector
                recipients={modalEvalRecipients}
                selectedType={selectedRecipientTypeEval}
                onSelectRecipient={(t) => setSelectedRecipientTypeEval(t)}
                patientName={activeEvalModalTarget.patient_name}
              />

              {/* WhatsApp Authentic Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                    Prévia Formatada no WhatsApp:
                  </span>
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                    {selectedEvalInstallmentsList.length} parcela(s) • Total: {formatMoney(modalEvalTotalAmount)}
                  </span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-[#efeae2] dark:bg-[#0b141a] border border-slate-300 dark:border-slate-700 shadow-inner">
                  <div className="max-w-xl ml-auto bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 p-4 rounded-2xl rounded-tr-xs shadow-sm text-xs leading-relaxed whitespace-pre-wrap select-text">
                    {generatedEvalText}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCopyEvalMessage}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                  copiedEval
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {copiedEval ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                <span>{copiedEval ? 'Copiado para Área de Transferência!' : 'Copiar Texto da Mensagem'}</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveEvalModalTarget(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={handleOpenEvalWhatsAppLink}
                  disabled={selectedEvalInstallmentsList.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>Enviar no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REGISTRAR ACORDO / PROMESSA DE PAGAMENTO */}
      {/* ========================================================================= */}
      {activeAgreementTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Handshake className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Registrar Acordo / Promessa
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paciente: <strong>{activeAgreementTarget.patient_name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveAgreementTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data Prometida para Pagamento:
                </label>
                <input
                  type="date"
                  value={agreementDate}
                  onChange={(e) => setAgreementDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notas / Detalhes do Acordo:
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Mãe informou que receberá salário no dia 25 e efetuará o PIX da 2ª parcela integralmente."
                  value={agreementNotes}
                  onChange={(e) => setAgreementNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveAgreementTarget(null)}
                disabled={isSavingAgreement}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAgreement}
                disabled={isSavingAgreement || !agreementDate}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingAgreement && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Salvar Acordo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: BAIXA RÁPIDA DE SESSÕES / PARCELAS */}
      {/* ========================================================================= */}
      {quickSettleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {quickSettleTarget.isEvaluation ? 'Quitar Parcela de Avaliação' : 'Dar Baixa de Honorários'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paciente: <strong>{quickSettleTarget.patient_name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickSettleTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {quickSettleSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto animate-bounce" />
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {quickSettleSuccess}
                </p>
              </div>
            ) : (
              <div className="py-4 space-y-3.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">
                    Total a Quitar ({quickSettleTarget.items.length} item(s)):
                  </span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(quickSettleTarget.total)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Data do Pagamento:
                    </label>
                    <input
                      type="date"
                      value={quickSettleDate}
                      onChange={(e) => setQuickSettleDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Meio de Pagamento:
                    </label>
                    <select
                      value={quickSettleMethod}
                      onChange={(e) => setQuickSettleMethod(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-white"
                    >
                      <option value="PIX">PIX</option>
                      <option value="CARTAO">Cartão de Débito/Crédito</option>
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="TRANSFERENCIA">Transferência Bancária</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Observações de Quitação:
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Comprovante PIX recebido via WhatsApp"
                    value={quickSettleNotes}
                    onChange={(e) => setQuickSettleNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {!quickSettleSuccess && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickSettleTarget(null)}
                  disabled={isSubmittingQuickSettle}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteQuickSettle}
                  disabled={isSubmittingQuickSettle}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingQuickSettle && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Confirmar Baixa</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CONFIGURAR CHAVE PIX OFICIAL */}
      {/* ========================================================================= */}
      {isPixSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Chave PIX Oficial da Clínica
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sincronizada no banco de dados da clínica
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPixSettingsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Chave PIX:
                </label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white"
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="TELEFONE">Telefone / Celular</option>
                  <option value="ALEATORIA">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chave PIX:
                </label>
                <input
                  type="text"
                  placeholder="Ex: financeiro@psicogestao.com.br"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Favorecido / Titular:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Clínica PsicoGestão Ltda"
                  value={pixBeneficiary}
                  onChange={(e) => setPixBeneficiary(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Banco / Dados Adicionais:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Banco Cora (403) • Agência 0001 • C/C 12345-6"
                  value={bankInfo}
                  onChange={(e) => setBankInfo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPixSettingsOpen(false)}
                disabled={isSavingPix}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePixSettings}
                disabled={isSavingPix}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                {isSavingPix && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Salvar Configurações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Asaas Dynamic Charge Modal */}
      {asaasModalTarget && (
        <AsaasChargeModal
          isOpen={!!asaasModalTarget}
          onClose={() => setAsaasModalTarget(null)}
          patientId={asaasModalTarget.patient_id}
          patientName={asaasModalTarget.patient_name}
          patientCpf={asaasModalTarget.patient_cpf}
          patientPhone={asaasModalTarget.patient_phone}
          guardianName={asaasModalTarget.guardian_name}
          guardianPhone={asaasModalTarget.guardian_phone}
          financialResponsibleName={asaasModalTarget.financial_responsible_name}
          financialResponsiblePhone={asaasModalTarget.financial_responsible_phone}
          transactionId={asaasModalTarget.transaction_id}
          sessionId={asaasModalTarget.session_id}
          evaluationId={asaasModalTarget.evaluation_id}
          items={asaasModalTarget.items}
          defaultAmount={asaasModalTarget.amount}
          defaultDescription={asaasModalTarget.description}
          isEvaluation={asaasModalTarget.is_evaluation}
          onSuccess={() => {
            fetchBillings();
          }}
        />
      )}
    </div>
  );
};
