import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api.js';
import { FinancialTransaction, CarneLeaoRecord, Patient } from '../types.js';
import { ExpensesModule } from './ExpensesModule.js';
import { BillingsModule } from './BillingsModule.js';
import { RepasseManagementTab } from './financial/RepasseManagementTab.js';
import { useAuth } from '../context/AuthContext.js';
import { InvoiceRequestModal } from './InvoiceRequestModal.js';
import { InvoiceCompleteModal } from './InvoiceCompleteModal.js';
import { EvaluationReceiptModal } from './patients/EvaluationReceiptModal.js';
import { CarneLeaoTab } from './fiscal/CarneLeaoTab.js';
import { InvoiceCancelNotifyModal } from './fiscal/InvoiceCancelNotifyModal.js';
import { InvoiceCancellationModal } from './fiscal/InvoiceCancellationModal.js';
import {
  DollarSign,
  Download,
  CheckCircle2,
  Clock,
  CreditCard,
  Building,
  Filter,
  Search,
  Receipt,
  FileSpreadsheet,
  CheckSquare,
  Square,
  X,
  Calendar,
  AlertCircle,
  Repeat,
  User,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Plus,
  FileCheck,
  Send,
  Ban,
  Eye,
  FileText,
  Brain,
  Percent,
  Zap,
  AlertTriangle,
  Undo2,
  Link2,
  ShieldAlert,
  Loader2,
  MoreVertical,
  ChevronDown,
  RefreshCw,
  FolderArchive
} from 'lucide-react';

interface SettleSessionItem {
  id: number;
  patient_id: number;
  start_time: string;
  end_time: string;
  status: string;
  modality: string;
  price: number;
  recurrence_group_id?: string | null;
  recurrence_pattern?: string | null;
  transaction_id?: number | null;
  payment_status: string;
  is_future: boolean;
  is_recurring: boolean;
  transaction_notes?: string;
  selected: boolean;
}

interface FinancialModuleProps {
  initialSubTab?: 'revenues' | 'expenses' | 'billings' | 'invoices' | 'repasses' | 'carne-leao';
  onSubTabChange?: (tab: 'revenues' | 'expenses' | 'billings' | 'invoices' | 'repasses' | 'carne-leao') => void;
}

export const FinancialModule: React.FC<FinancialModuleProps> = ({
  initialSubTab = 'revenues',
  onSubTabChange,
}) => {
  const { user, clinicSettings } = useAuth();
  const isRepasseEnabled = clinicSettings?.repasse_enabled !== false;
  const canViewInvoices = user?.role === 'ADMIN' || user?.permissions?.includes('view_invoices');
  const canManageRepasses = user?.role === 'ADMIN' || user?.permissions?.includes('view_financial') || user?.permissions?.includes('manage_repasses');

  const [currentTab, setCurrentTab] = useState<'revenues' | 'expenses' | 'billings' | 'invoices' | 'repasses' | 'carne-leao'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      if (initialSubTab === 'repasses' && clinicSettings?.repasse_enabled === false) {
        setCurrentTab('revenues');
      } else {
        setCurrentTab(initialSubTab);
      }
    }
  }, [initialSubTab, clinicSettings?.repasse_enabled]);

  useEffect(() => {
    if (currentTab === 'repasses' && clinicSettings?.repasse_enabled === false) {
      setCurrentTab('revenues');
      if (onSubTabChange) {
        onSubTabChange('revenues');
      }
    }
  }, [currentTab, clinicSettings?.repasse_enabled, onSubTabChange]);

  const handleTabChange = (tab: 'revenues' | 'expenses' | 'billings' | 'invoices' | 'repasses' | 'carne-leao') => {
    setCurrentTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'date' | 'patient' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('asc');
  const [carneLeaoModalOpen, setCarneLeaoModalOpen] = useState(false);
  const [carneLeaoData, setCarneLeaoData] = useState<CarneLeaoRecord[]>([]);

  // Sub-abas de Receitas (Honorários)
  const [revenueSubTab, setRevenueSubTab] = useState<'overview' | 'psychotherapy' | 'evaluations'>('overview');
  // Filtros Temporais de Receitas (Honorários)
  const [revenueDateMode, setRevenueDateMode] = useState<'ALL' | 'MONTH' | 'PERIOD'>('ALL');
  const [revenueMonth, setRevenueMonth] = useState<string>(() => new Date().toISOString().substring(0, 7)); // 'YYYY-MM'
  const [revenueStartDate, setRevenueStartDate] = useState<string>('');
  const [revenueEndDate, setRevenueEndDate] = useState<string>('');

  // Recibo Profissional / Convênio
  const [selectedEvaluationReceipt, setSelectedEvaluationReceipt] = useState<{
    evaluationId?: number | null;
    transactionId?: number;
  } | null>(null);

  // Modal: Dar Baixa de Sessões (Pendentes e Futuras Recorrentes)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settlePatient, setSettlePatient] = useState<{ id: number; full_name: string; cpf: string; phone: string } | null>(null);
  const [settleSessions, setSettleSessions] = useState<SettleSessionItem[]>([]);
  const [settlePaidSessions, setSettlePaidSessions] = useState<any[]>([]);
  const [showPaidHistory, setShowPaidHistory] = useState(false);
  const [isLoadingSettleSessions, setIsLoadingSettleSessions] = useState(false);
  const [settlePaymentDate, setSettlePaymentDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<string>('PIX');
  const [settleNotes, setSettleNotes] = useState<string>('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSuccess, setSettleSuccess] = useState<string | null>(null);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);

  // Invoices States
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('ALL');
  const [macroStatusFilter, setMacroStatusFilter] = useState<'ALL' | 'WAITING' | 'ISSUED' | 'CANCELED_REJECTED'>('ALL');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('ALL');
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<number | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceDateFilter, setInvoiceDateFilter] = useState<string>('');
  const [invoiceDateEndFilter, setInvoiceDateEndFilter] = useState<string>('');
  const [invoiceRangeMode, setInvoiceRangeMode] = useState<boolean>(false);

  // Modais de NF
  const [isInvoiceRequestModalOpen, setIsInvoiceRequestModalOpen] = useState(false);
  const [invoiceRequestPatient, setInvoiceRequestPatient] = useState<any | null>(null);
  const [invoiceRequestSessions, setInvoiceRequestSessions] = useState<any[]>([]);
  const [invoiceRequestEvaluationTxIds, setInvoiceRequestEvaluationTxIds] = useState<number[]>([]);
  const [invoiceRequestExistingId, setInvoiceRequestExistingId] = useState<number | undefined>(undefined);

  const [isInvoiceCompleteModalOpen, setIsInvoiceCompleteModalOpen] = useState(false);
  const [selectedInvoiceForComplete, setSelectedInvoiceForComplete] = useState<any | null>(null);

  // Modal de Cancelamento de NF Emitida (Assistência Contábil & Baixa Oficial)
  const [selectedInvoiceForCancel, setSelectedInvoiceForCancel] = useState<any | null>(null);
  const [cancellationModalMode, setCancellationModalMode] = useState<'REQUEST' | 'COMPLETE'>('REQUEST');

  // Checkbox no modal de Baixa
  const [requestNfOnSettle, setRequestNfOnSettle] = useState(false);

  const fetchInvoices = async () => {
    try {
      setIsLoadingInvoices(true);
      const params: any = {};
      if (invoiceStatusFilter !== 'ALL') params.status = invoiceStatusFilter;
      if (invoiceDateFilter) {
        if (invoiceRangeMode && invoiceDateEndFilter) {
          params.start_date = invoiceDateFilter;
          params.end_date = invoiceDateEndFilter;
        } else {
          params.date = invoiceDateFilter;
        }
      }
      const res = await api.get('/invoices', { params });
      setInvoices(res.data.invoices || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Sub-visão dentro de Notas Fiscais: 'issued' (Emitidas), 'requested' (Solicitadas), 'overview' (Painel para Solicitações), 'history' (Canceladas & Histórico)
  type InvoiceSubViewType = 'issued' | 'requested' | 'overview' | 'history';
  const [invoiceSubView, setInvoiceSubView] = useState<InvoiceSubViewType>('issued');

  // Filtros rápidos contextuais para as sub-abas
  const [issuedCategoryFilter, setIssuedCategoryFilter] = useState<'ALL' | 'SESSIONS' | 'EVALUATIONS'>('ALL');
  const [requestedSubFilter, setRequestedSubFilter] = useState<'ALL' | 'PENDING_DISPATCH' | 'REQUESTED'>('ALL');
  const [historySubFilter, setHistorySubFilter] = useState<'ALL' | 'CANCELLATION_REQUESTED' | 'CANCELED' | 'REJECTED'>('ALL');

  // Sub-categoria dentro do Painel de Solicitações: 'SESSIONS' (Psicoterapia) ou 'EVALUATIONS' (Avaliações)
  const [fiscalCategoryTab, setFiscalCategoryTab] = useState<'SESSIONS' | 'EVALUATIONS'>('SESSIONS');

  // Visão de Atendimentos Aptos & Pendências de NF
  const [overviewSessions, setOverviewSessions] = useState<any[]>([]);
  const [isLoadingOverviewSessions, setIsLoadingOverviewSessions] = useState(false);
  // Por padrão, o painel de solicitações exibe estritamente itens SEM NOTA FISCAL ('NONE')
  const [sessionFiscalFilter, setSessionFiscalFilter] = useState<string>('NONE');
  // Por padrão, o painel de solicitações foca em atendimentos QUITADOS / PAGOS (incluindo baixas automáticas do Asaas)
  const [sessionPaymentStatusFilter, setSessionPaymentStatusFilter] = useState<string>('PAID');
  const [sessionPaymentMethodFilter, setSessionPaymentMethodFilter] = useState<string>('ALL');
  const [sessionDateFilter, setSessionDateFilter] = useState<string>('');
  const [sessionDateEndFilter, setSessionDateEndFilter] = useState<string>('');
  const [sessionRangeMode, setSessionRangeMode] = useState<boolean>(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [selectedOverviewSessionIds, setSelectedOverviewSessionIds] = useState<Record<number, boolean>>({});

  // Visão de Avaliações Neuropsicológicas & Pendências de NF
  const [overviewEvaluations, setOverviewEvaluations] = useState<any[]>([]);
  const [isLoadingOverviewEvaluations, setIsLoadingOverviewEvaluations] = useState(false);
  const [selectedOverviewEvalTxIds, setSelectedOverviewEvalTxIds] = useState<Record<number, boolean>>({});

  // Modal: Dar Baixa de Avaliação Neuropsicológica (Contrato / Parcelas)
  const [isEvalSettleModalOpen, setIsEvalSettleModalOpen] = useState(false);
  const [evalSettleData, setEvalSettleData] = useState<{
    evaluation: any;
    pending_installments: any[];
    paid_installments: any[];
  } | null>(null);
  const [selectedEvalInstallmentMap, setSelectedEvalInstallmentMap] = useState<Record<number, boolean>>({});
  const [isLoadingEvalSettle, setIsLoadingEvalSettle] = useState(false);
  const [evalPaymentDate, setEvalPaymentDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [evalPaymentMethod, setEvalPaymentMethod] = useState<string>('PIX');
  const [evalNotes, setEvalNotes] = useState<string>('');
  const [evalRequestNfOnSettle, setEvalRequestNfOnSettle] = useState(false);
  const [isSubmittingEvalSettle, setIsSubmittingEvalSettle] = useState(false);
  const [evalSettleError, setEvalSettleError] = useState<string | null>(null);
  const [evalSettleSuccess, setEvalSettleSuccess] = useState<string | null>(null);
  const [showEvalPaidHistory, setShowEvalPaidHistory] = useState(false);

  const fetchOverviewSessions = async () => {
    try {
      setIsLoadingOverviewSessions(true);
      const params: any = {};
      if (sessionFiscalFilter !== 'ALL') params.fiscal_status = sessionFiscalFilter;
      if (sessionPaymentStatusFilter !== 'ALL') params.payment_status = sessionPaymentStatusFilter;
      if (sessionPaymentMethodFilter !== 'ALL' && sessionPaymentStatusFilter !== 'PENDING') {
        params.payment_method = sessionPaymentMethodFilter;
      }
      if (sessionDateFilter) {
        if (sessionRangeMode && sessionDateEndFilter) {
          params.start_date = sessionDateFilter;
          params.end_date = sessionDateEndFilter;
        } else {
          params.date = sessionDateFilter;
        }
      }
      if (sessionSearch.trim()) params.search = sessionSearch.trim();

      const res = await api.get('/invoices/sessions-overview', { params });
      setOverviewSessions(res.data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions overview for invoices:', err);
    } finally {
      setIsLoadingOverviewSessions(false);
    }
  };

  const fetchOverviewEvaluations = async () => {
    try {
      setIsLoadingOverviewEvaluations(true);
      const params: any = {};
      if (sessionFiscalFilter !== 'ALL') params.fiscal_status = sessionFiscalFilter;
      if (sessionPaymentStatusFilter !== 'ALL') params.payment_status = sessionPaymentStatusFilter;
      if (sessionPaymentMethodFilter !== 'ALL' && sessionPaymentStatusFilter !== 'PENDING') {
        params.payment_method = sessionPaymentMethodFilter;
      }
      if (sessionDateFilter) {
        if (sessionRangeMode && sessionDateEndFilter) {
          params.start_date = sessionDateFilter;
          params.end_date = sessionDateEndFilter;
        } else {
          params.date = sessionDateFilter;
        }
      }
      if (sessionSearch.trim()) params.search = sessionSearch.trim();

      const res = await api.get('/invoices/evaluations-overview', { params });
      setOverviewEvaluations(res.data.evaluations || []);
    } catch (err) {
      console.error('Failed to load evaluations overview for invoices:', err);
    } finally {
      setIsLoadingOverviewEvaluations(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'invoices') {
      fetchInvoices();
      if (invoiceSubView === 'overview') {
        fetchOverviewSessions();
        fetchOverviewEvaluations();
      }
    }
  }, [
    currentTab,
    invoiceSubView,
    fiscalCategoryTab,
    invoiceStatusFilter,
    invoiceDateFilter,
    invoiceDateEndFilter,
    invoiceRangeMode,
    sessionFiscalFilter,
    sessionPaymentStatusFilter,
    sessionPaymentMethodFilter,
    sessionDateFilter,
    sessionDateEndFilter,
    sessionRangeMode,
    sessionSearch,
  ]);

  const overviewStats = useMemo(() => {
    let totalSessions = overviewSessions.length;
    let pendingNfCount = 0;
    let pendingNfSum = 0;
    let withNfCount = 0;
    let withNfSum = 0;

    for (const s of overviewSessions) {
      const price = Number(s.price) || 0;
      if (s.fiscal_status === 'NONE') {
        pendingNfCount++;
        pendingNfSum += price;
      } else {
        withNfCount++;
        withNfSum += price;
      }
    }

    return {
      totalSessions,
      pendingNfCount,
      pendingNfSum,
      withNfCount,
      withNfSum,
    };
  }, [overviewSessions]);

  const selectedSessionsList = useMemo(() => {
    return overviewSessions.filter((s) => selectedOverviewSessionIds[s.session_id]);
  }, [overviewSessions, selectedOverviewSessionIds]);

  const selectedPatientData = useMemo(() => {
    if (selectedSessionsList.length === 0) return null;
    const firstPatientId = selectedSessionsList[0].patient_id;
    const allSame = selectedSessionsList.every((s) => s.patient_id === firstPatientId);
    if (!allSame) return { isConflict: true, patient_id: 0, patient_name: '', patient_cpf: '', patient_phone: '', totalAmount: 0 };
    return {
      isConflict: false,
      patient_id: firstPatientId,
      patient_name: selectedSessionsList[0].patient_name,
      patient_cpf: selectedSessionsList[0].patient_cpf,
      patient_phone: selectedSessionsList[0].patient_phone,
      totalAmount: selectedSessionsList.reduce((sum, s) => sum + (Number(s.price) || 0), 0),
    };
  }, [selectedSessionsList]);

  const handleToggleOverviewSession = (sessionId: number) => {
    setSelectedOverviewSessionIds((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  const handleSelectAllPendingOverview = (select: boolean) => {
    const next: Record<number, boolean> = {};
    if (select) {
      overviewSessions.forEach((s) => {
        if (s.fiscal_status === 'NONE') {
          next[s.session_id] = true;
        }
      });
    }
    setSelectedOverviewSessionIds(next);
  };

  const handleLaunchInvoiceForSelectedSessions = () => {
    if (!selectedPatientData || selectedPatientData.isConflict) return;
    setInvoiceRequestPatient({
      id: selectedPatientData.patient_id,
      full_name: selectedPatientData.patient_name,
      cpf: selectedPatientData.patient_cpf,
      phone: selectedPatientData.patient_phone,
    });
    setInvoiceRequestSessions(
      selectedSessionsList.map((s) => ({
        id: s.session_id,
        start_time: s.start_time,
        end_time: s.end_time,
        modality: s.modality,
        price: Number(s.price),
        is_paid: s.payment_status === 'PAID',
      }))
    );
    setInvoiceRequestExistingId(undefined);
    setIsInvoiceRequestModalOpen(true);
  };

  const overviewEvalStats = useMemo(() => {
    let totalEvaluations = overviewEvaluations.length;
    let pendingNfCount = 0;
    let pendingNfSum = 0;
    let withNfCount = 0;
    let withNfSum = 0;

    for (const ev of overviewEvaluations) {
      const price = Number(ev.price) || 0;
      if (ev.fiscal_status === 'NONE') {
        pendingNfCount++;
        pendingNfSum += price;
      } else {
        withNfCount++;
        withNfSum += price;
      }
    }

    return {
      totalEvaluations,
      pendingNfCount,
      pendingNfSum,
      withNfCount,
      withNfSum,
    };
  }, [overviewEvaluations]);

  const selectedEvaluationsList = useMemo(() => {
    return overviewEvaluations.filter((ev) => selectedOverviewEvalTxIds[ev.transaction_id]);
  }, [overviewEvaluations, selectedOverviewEvalTxIds]);

  const selectedEvalPatientData = useMemo(() => {
    if (selectedEvaluationsList.length === 0) return null;
    const firstPatientId = selectedEvaluationsList[0].patient_id;
    const allSame = selectedEvaluationsList.every((ev) => ev.patient_id === firstPatientId);
    if (!allSame) return { isConflict: true, patient_id: 0, patient_name: '', patient_cpf: '', patient_phone: '', totalAmount: 0 };
    return {
      isConflict: false,
      patient_id: firstPatientId,
      patient_name: selectedEvaluationsList[0].patient_name,
      patient_cpf: selectedEvaluationsList[0].patient_cpf,
      patient_phone: selectedEvaluationsList[0].patient_phone,
      totalAmount: selectedEvaluationsList.reduce((sum, ev) => sum + (Number(ev.price) || 0), 0),
    };
  }, [selectedEvaluationsList]);

  const handleToggleOverviewEval = (txId: number) => {
    setSelectedOverviewEvalTxIds((prev) => ({
      ...prev,
      [txId]: !prev[txId],
    }));
  };

  const handleSelectAllPendingOverviewEvals = (select: boolean) => {
    const next: Record<number, boolean> = {};
    if (select) {
      overviewEvaluations.forEach((ev) => {
        if (ev.fiscal_status === 'NONE') {
          next[ev.transaction_id] = true;
        }
      });
    }
    setSelectedOverviewEvalTxIds(next);
  };

  const handleLaunchInvoiceForSelectedEvaluations = () => {
    if (!selectedEvalPatientData || selectedEvalPatientData.isConflict) return;
    setInvoiceRequestPatient({
      id: selectedEvalPatientData.patient_id,
      full_name: selectedEvalPatientData.patient_name,
      cpf: selectedEvalPatientData.patient_cpf,
      phone: selectedEvalPatientData.patient_phone,
    });
    setInvoiceRequestSessions([]);
    setInvoiceRequestEvaluationTxIds(selectedEvaluationsList.map((ev) => ev.transaction_id));
    setInvoiceRequestExistingId(undefined);
    setIsInvoiceRequestModalOpen(true);
  };

  // Handlers do Modal de Baixa de Avaliação Neuropsicológica
  const handleOpenEvaluationSettleModal = async (evaluationId: number, preselectedTxId?: number) => {
    setEvalSettleError(null);
    setEvalSettleSuccess(null);
    setEvalNotes('');
    setShowEvalPaidHistory(false);
    setEvalRequestNfOnSettle(false);
    setEvalPaymentDate(new Date().toISOString().substring(0, 10));
    setEvalPaymentMethod('PIX');
    setIsEvalSettleModalOpen(true);
    setIsLoadingEvalSettle(true);

    try {
      const res = await api.get(`/financial/evaluation-installments/${evaluationId}`);
      setEvalSettleData(res.data);
      if (res.data.evaluation?.payment_method) {
        const pm = res.data.evaluation.payment_method;
        if (pm === 'CARTAO') {
          setEvalPaymentMethod('Cartão de Crédito');
        } else if (pm === 'DINHEIRO') {
          setEvalPaymentMethod('Dinheiro');
        } else if (pm === 'BOLETO') {
          setEvalPaymentMethod('Boleto');
        } else if (['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência Bancária', 'Dinheiro', 'Boleto', 'Convênio'].includes(pm)) {
          setEvalPaymentMethod(pm);
        } else {
          setEvalPaymentMethod('PIX');
        }
      }

      const pendingList: any[] = res.data.pending_installments || [];
      const map: Record<number, boolean> = {};
      if (preselectedTxId) {
        map[preselectedTxId] = true;
      } else {
        pendingList.forEach((inst: any) => {
          map[inst.id] = true;
        });
      }
      setSelectedEvalInstallmentMap(map);
    } catch (err: any) {
      console.error('Failed to load evaluation installments for settle:', err);
      setEvalSettleError(err.response?.data?.error || 'Erro ao carregar parcelas da avaliação neuropsicológica.');
    } finally {
      setIsLoadingEvalSettle(false);
    }
  };

  const handleToggleSelectEvalInstallment = (id: number) => {
    setSelectedEvalInstallmentMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectAllPendingEvalInstallments = (select: boolean) => {
    const next: Record<number, boolean> = {};
    if (select && evalSettleData?.pending_installments) {
      evalSettleData.pending_installments.forEach((inst) => {
        next[inst.id] = true;
      });
    }
    setSelectedEvalInstallmentMap(next);
  };

  const selectedEvalInstallments = useMemo(() => {
    if (!evalSettleData?.pending_installments) return [];
    return evalSettleData.pending_installments.filter((inst: any) => selectedEvalInstallmentMap[inst.id]);
  }, [evalSettleData, selectedEvalInstallmentMap]);

  const totalEvalSettleAmount = useMemo(() => {
    return selectedEvalInstallments.reduce((acc: number, inst: any) => acc + (Number(inst.amount) || 0), 0);
  }, [selectedEvalInstallments]);

  const handleSaveEvaluationSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalSettleData?.evaluation) {
      setEvalSettleError('Nenhuma avaliação selecionada.');
      return;
    }
    if (selectedEvalInstallments.length === 0) {
      setEvalSettleError('Selecione pelo menos uma parcela para dar baixa.');
      return;
    }

    try {
      setIsSubmittingEvalSettle(true);
      setEvalSettleError(null);
      const payload = {
        evaluation_id: evalSettleData.evaluation.id,
        payment_date: evalPaymentDate,
        payment_method: evalPaymentMethod,
        notes: evalNotes.trim(),
        settlements: selectedEvalInstallments.map((inst: any) => ({
          transaction_id: inst.id,
          amount: Number(inst.amount),
        })),
      };

      const res = await api.post('/financial/settle-evaluation-installments', payload);
      setEvalSettleSuccess(res.data.message || 'Baixa de parcelas registrada com sucesso!');
      await fetchTransactions();

      const settledTxIds = selectedEvalInstallments.map((inst: any) => inst.id);
      const evalPatient = {
        id: evalSettleData.evaluation.patient_id,
        full_name: evalSettleData.evaluation.patient_name,
        cpf: evalSettleData.evaluation.patient_cpf,
        phone: evalSettleData.evaluation.patient_phone,
      };

      if (evalRequestNfOnSettle) {
        setIsEvalSettleModalOpen(false);
        setEvalSettleSuccess(null);

        setInvoiceRequestPatient(evalPatient);
        setInvoiceRequestSessions([]);
        setInvoiceRequestEvaluationTxIds(settledTxIds);
        setInvoiceRequestExistingId(undefined);
        setIsInvoiceRequestModalOpen(true);
      } else {
        setTimeout(() => {
          setIsEvalSettleModalOpen(false);
          setEvalSettleSuccess(null);
        }, 900);
      }
    } catch (err: any) {
      console.error('Failed to submit evaluation settlement:', err);
      setEvalSettleError(err.response?.data?.error || 'Erro ao registrar baixa de parcelas.');
    } finally {
      setIsSubmittingEvalSettle(false);
    }
  };

  const handleCancelInvoice = async (invoiceId: number, inv?: any) => {
    if (!window.confirm('Tem certeza de que deseja cancelar esta solicitação de NF?')) return;
    try {
      await api.delete(`/invoices/${invoiceId}`);
      await fetchInvoices();
      fetchOverviewSessions();
      fetchOverviewEvaluations();
      if (inv && inv.status === 'REQUESTED') {
        setInvoiceCancelNotifyData({
          patientName: inv.patient_name || 'Paciente',
          totalAmount: Number(inv.total_amount || 0),
          requestDate: inv.created_at || new Date().toISOString(),
        });
        setIsInvoiceCancelNotifyOpen(true);
      }
    } catch (err) {
      console.error('Failed to cancel invoice:', err);
      alert('Erro ao cancelar solicitação de Nota Fiscal.');
    }
  };

  const handleDownloadInvoicePdf = (inv: any) => {
    if (!inv.file_data) return;
    try {
      const byteCharacters = atob(inv.file_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: inv.file_type || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = inv.file_name || `NF_${inv.invoice_number || inv.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Error downloading invoice PDF:', e);
    }
  };

  const handleSendInvoiceWhatsAppToPatient = (inv: any) => {
    if (!inv.patient_phone) {
      alert('Paciente não possui telefone cadastrado.');
      return;
    }
    const cleanPhone = inv.patient_phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = `Olá, *${inv.patient_name}*! Tudo bem?\n\nSua Nota Fiscal de prestação de serviços de Psicologia já foi emitida pela nossa contabilidade.\n\n📄 *NF Número:* ${inv.invoice_number || 'S/N'}\n💰 *Valor:* R$ ${Number(inv.total_amount).toFixed(2)}\n\nO documento também já está anexado e disponível em seu prontuário digital conosco. Qualquer dúvida estamos à disposição!`;
    window.open(`https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(text)}`, '_blank');
  };

  // 1. Listas Fiscais Especializadas por Sub-Aba
  const issuedInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === 'ISSUED');
  }, [invoices]);

  const requestedInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === 'PENDING_DISPATCH' || inv.status === 'REQUESTED' || inv.status === 'PROCESSING_GATEWAY');
  }, [invoices]);

  const historyInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === 'CANCELED' || inv.status === 'CANCELLATION_REQUESTED' || inv.status === 'REJECTED');
  }, [invoices]);

  const pendingDispatchInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === 'PENDING_DISPATCH');
  }, [invoices]);

  const waitingAccountantInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === 'REQUESTED' || inv.status === 'PROCESSING_GATEWAY');
  }, [invoices]);

  const cancellationRequestedInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === 'CANCELLATION_REQUESTED');
  }, [invoices]);

  const canceledDefinitiveInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === 'CANCELED');
  }, [invoices]);

  const rejectedInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status === 'REJECTED');
  }, [invoices]);

  // Alertas de Reversão para Notas Emitidas
  const [filterOnlyReverted, setFilterOnlyReverted] = useState(false);
  const issuedRevertedInvoices = useMemo(() => {
    return issuedInvoices.filter((inv) => Boolean(inv.has_reverted_payments));
  }, [issuedInvoices]);

  const requestedRevertedInvoices = useMemo(() => {
    return requestedInvoices.filter((inv) => Boolean(inv.has_reverted_payments));
  }, [requestedInvoices]);

  const [isCancelingAllRevertedRequests, setIsCancelingAllRevertedRequests] = useState(false);
  const handleCancelAllRevertedRequests = async () => {
    if (requestedRevertedInvoices.length === 0) return;
    if (!window.confirm(`Deseja realmente cancelar ${requestedRevertedInvoices.length} solicitação(ões) de Nota Fiscal cujo pagamento foi estornado?`)) {
      return;
    }
    try {
      setIsCancelingAllRevertedRequests(true);
      for (const inv of requestedRevertedInvoices) {
        await api.delete(`/invoices/${inv.id}`).catch(() => {});
      }
      await fetchInvoices();
      alert(`${requestedRevertedInvoices.length} solicitação(ões) cancelada(s) com sucesso!`);
    } catch (e) {
      console.error('Failed to cancel requested invoices:', e);
      alert('Erro ao cancelar algumas solicitações de NF.');
    } finally {
      setIsCancelingAllRevertedRequests(false);
    }
  };

  // Contagens e fatiamento por categoria das Notas Emitidas (Psicoterapia vs Avaliações)
  const issuedSessionsCount = useMemo(() => {
    return issuedInvoices.filter((inv) => (inv.items || []).some((it: any) => it.session_id != null)).length;
  }, [issuedInvoices]);

  const issuedEvaluationsCount = useMemo(() => {
    return issuedInvoices.filter((inv) => (inv.items || []).some((it: any) => it.evaluation_id != null || it.transaction_id != null)).length;
  }, [issuedInvoices]);

  const issuedCategoryInvoices = useMemo(() => {
    if (issuedCategoryFilter === 'SESSIONS') {
      return issuedInvoices.filter((inv) => (inv.items || []).some((it: any) => it.session_id != null));
    }
    if (issuedCategoryFilter === 'EVALUATIONS') {
      return issuedInvoices.filter((inv) => (inv.items || []).some((it: any) => it.evaluation_id != null || it.transaction_id != null));
    }
    return issuedInvoices;
  }, [issuedInvoices, issuedCategoryFilter]);

  // 2. Listas Filtradas por Contexto
  const filteredIssuedInvoices = useMemo(() => {
    return issuedCategoryInvoices.filter((inv) => {
      if (filterOnlyReverted && !inv.has_reverted_payments) return false;
      const q = invoiceSearch.toLowerCase().trim();
      if (!q) return true;
      const patientName = (inv.patient_name || '').toLowerCase();
      const patientCpf = (inv.patient_cpf || '').toLowerCase();
      const invNum = (inv.invoice_number || '').toLowerCase();
      return patientName.includes(q) || patientCpf.includes(q) || invNum.includes(q);
    });
  }, [issuedCategoryInvoices, filterOnlyReverted, invoiceSearch]);

  const filteredRequestedInvoices = useMemo(() => {
    return requestedInvoices.filter((inv) => {
      if (requestedSubFilter === 'PENDING_DISPATCH' && inv.status !== 'PENDING_DISPATCH') return false;
      if (requestedSubFilter === 'REQUESTED' && (inv.status !== 'REQUESTED' && inv.status !== 'PROCESSING_GATEWAY')) return false;
      const q = invoiceSearch.toLowerCase().trim();
      if (!q) return true;
      const patientName = (inv.patient_name || '').toLowerCase();
      const patientCpf = (inv.patient_cpf || '').toLowerCase();
      return patientName.includes(q) || patientCpf.includes(q);
    });
  }, [requestedInvoices, requestedSubFilter, invoiceSearch]);

  const filteredHistoryInvoices = useMemo(() => {
    return historyInvoices.filter((inv) => {
      if (historySubFilter === 'CANCELLATION_REQUESTED' && inv.status !== 'CANCELLATION_REQUESTED') return false;
      if (historySubFilter === 'CANCELED' && inv.status !== 'CANCELED') return false;
      if (historySubFilter === 'REJECTED' && inv.status !== 'REJECTED') return false;
      const q = invoiceSearch.toLowerCase().trim();
      if (!q) return true;
      const patientName = (inv.patient_name || '').toLowerCase();
      const patientCpf = (inv.patient_cpf || '').toLowerCase();
      const invNum = (inv.invoice_number || '').toLowerCase();
      const reason = (inv.cancellation_reason || '').toLowerCase();
      return patientName.includes(q) || patientCpf.includes(q) || invNum.includes(q) || reason.includes(q);
    });
  }, [historyInvoices, historySubFilter, invoiceSearch]);

  // 3. Indicadores de Micro-KPIs Contextuais
  const issuedStats = useMemo(() => {
    const totalSum = issuedCategoryInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const revertedCount = issuedCategoryInvoices.filter((inv) => inv.has_reverted_payments).length;
    return {
      totalSum,
      totalCount: issuedCategoryInvoices.length,
      revertedCount,
    };
  }, [issuedCategoryInvoices]);

  const requestedStats = useMemo(() => {
    const totalSum = requestedInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const pendingDispatchSum = pendingDispatchInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const waitingAccountantSum = waitingAccountantInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    return {
      totalSum,
      totalCount: requestedInvoices.length,
      pendingDispatchCount: pendingDispatchInvoices.length,
      pendingDispatchSum,
      waitingCount: waitingAccountantInvoices.length,
      waitingSum: waitingAccountantSum,
    };
  }, [requestedInvoices, pendingDispatchInvoices, waitingAccountantInvoices]);

  const historyStats = useMemo(() => {
    const totalSum = historyInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    return {
      totalSum,
      totalCount: historyInvoices.length,
      cancellationRequestedCount: cancellationRequestedInvoices.length,
      canceledCount: canceledDefinitiveInvoices.length,
      rejectedCount: rejectedInvoices.length,
    };
  }, [historyInvoices, cancellationRequestedInvoices, canceledDefinitiveInvoices, rejectedInvoices]);

  // Contagem total de atendimentos aptos no Painel para Solicitações
  const aptTotalCount = useMemo(() => {
    return (overviewStats.pendingNfCount + overviewEvalStats.pendingNfCount);
  }, [overviewStats.pendingNfCount, overviewEvalStats.pendingNfCount]);

  // Fechar menu de ações da tabela ao clicar fora
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.invoice-action-menu-container')) {
        setActiveActionMenuId(null);
      }
    };
    if (activeActionMenuId !== null) {
      window.addEventListener('click', handleOutsideClick);
      return () => window.removeEventListener('click', handleOutsideClick);
    }
  }, [activeActionMenuId]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/financial/transactions');
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Modal 4: Reversão de Receitas com Guarda Fiscal e Suporte a Lotes
  interface FinancialBatchRevertItem {
    id: number;
    session_id?: number | null;
    evaluation_id?: number | null;
    amount: number;
    title: string;
    date: string;
    invoice_id?: number | null;
    invoice_status: string;
    invoice_number?: string | null;
    selected: boolean;
  }

  const [financialRevertTarget, setFinancialRevertTarget] = useState<any | null>(null);
  const [financialRevertBatchItems, setFinancialRevertBatchItems] = useState<FinancialBatchRevertItem[]>([]);
  const [isLoadingFinancialBatch, setIsLoadingFinancialBatch] = useState(false);
  const [cancelRequestedInvoicesInFinancial, setCancelRequestedInvoicesInFinancial] = useState(true);
  const [isRevertingFinancial, setIsRevertingFinancial] = useState(false);
  const [financialRevertToast, setFinancialRevertToast] = useState<string | null>(null);

  // Modal de Aviso de Cancelamento Fiscal para Contabilidade via WhatsApp
  const [isInvoiceCancelNotifyOpen, setIsInvoiceCancelNotifyOpen] = useState(false);
  const [invoiceCancelNotifyData, setInvoiceCancelNotifyData] = useState<{
    patientName: string;
    totalAmount: number;
    requestDate?: string;
  }>({
    patientName: '',
    totalAmount: 0,
  });

  const handleOpenFinancialRevertModal = async (tx: any) => {
    setFinancialRevertTarget(tx);
    setIsLoadingFinancialBatch(true);
    setCancelRequestedInvoicesInFinancial(true);

    try {
      const res = await api.get(`/financial/transactions/${tx.id}/batch`);
      const batchData = res.data;
      if (batchData.items && batchData.items.length > 0) {
        setFinancialRevertBatchItems(
          batchData.items.map((it: any) => ({
            ...it,
            selected: true,
          }))
        );
      } else {
        setFinancialRevertBatchItems([{
          id: tx.id,
          session_id: tx.session_id || null,
          evaluation_id: tx.evaluation_id || null,
          amount: Number(tx.amount || 0),
          title: tx.evaluation_id
            ? `Avaliação Neuropsicológica: Parcela ${tx.installment_number || 1} - ${tx.evaluation_title || 'Laudo'}`
            : (tx.patient_name ? `Sessão de Psicoterapia - ${tx.patient_name}` : (tx.notes || 'Lançamento Financeiro')),
          date: tx.transaction_date || tx.paid_at,
          invoice_id: tx.invoice_id || null,
          invoice_status: tx.invoice_status || 'NONE',
          invoice_number: tx.invoice_number || null,
          selected: true,
        }]);
      }
    } catch {
      setFinancialRevertBatchItems([{
        id: tx.id,
        session_id: tx.session_id || null,
        evaluation_id: tx.evaluation_id || null,
        amount: Number(tx.amount || 0),
        title: tx.evaluation_id
          ? `Avaliação Neuropsicológica: Parcela ${tx.installment_number || 1} - ${tx.evaluation_title || 'Laudo'}`
          : (tx.patient_name ? `Sessão de Psicoterapia - ${tx.patient_name}` : (tx.notes || 'Lançamento Financeiro')),
        date: tx.transaction_date || tx.paid_at,
        invoice_id: tx.invoice_id || null,
        invoice_status: tx.invoice_status || 'NONE',
        invoice_number: tx.invoice_number || null,
        selected: true,
      }]);
    } finally {
      setIsLoadingFinancialBatch(false);
    }
  };

  const handleToggleFinancialBatchItem = (id: number) => {
    setFinancialRevertBatchItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleSelectAllFinancialBatch = (select: boolean) => {
    setFinancialRevertBatchItems((prev) => prev.map((i) => ({ ...i, selected: select })));
  };

  const handleExecuteFinancialRevert = async () => {
    const selected = financialRevertBatchItems.filter((i) => i.selected);
    if (selected.length === 0) {
      alert('Selecione ao menos um lançamento para reverter.');
      return;
    }

    const hasRequestedInvoices = selected.some(
      (i) => i.invoice_status === 'REQUESTED' || i.invoice_status === 'PENDING_DISPATCH'
    );
    const patientNameForNotice = financialRevertTarget?.patient_name || selected[0]?.title || 'Paciente';
    const totalAmountForNotice = selected.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const dateForNotice = selected[0]?.date || new Date().toISOString();

    try {
      setIsRevertingFinancial(true);
      const res = await api.post('/financial/transactions/revert-batch', {
        transaction_ids: selected.map((i) => i.id),
        cancel_requested_invoices: cancelRequestedInvoicesInFinancial,
      });

      const warnMsg = res.data.warning ? ` (${res.data.warning})` : '';
      setFinancialRevertToast(`Pagamento de ${selected.length} lançamento(s) revertido para pendente com sucesso!${warnMsg}`);
      setFinancialRevertTarget(null);
      setFinancialRevertBatchItems([]);
      await Promise.all([fetchTransactions(), fetchInvoices()]);
      setTimeout(() => setFinancialRevertToast(null), 6000);

      // Encadeamento automático: se cancelou NF solicitada, abre o modal de aviso para o WhatsApp da contabilidade
      if (cancelRequestedInvoicesInFinancial && hasRequestedInvoices) {
        setInvoiceCancelNotifyData({
          patientName: patientNameForNotice,
          totalAmount: totalAmountForNotice,
          requestDate: dateForNotice,
        });
        setIsInvoiceCancelNotifyOpen(true);
      }
    } catch (err: any) {
      console.error('Failed to revert payment:', err);
      alert(err.response?.data?.error || 'Erro ao reverter status do pagamento.');
    } finally {
      setIsRevertingFinancial(false);
    }
  };

  const handleToggleStatus = async (transactionId: number, currentStatus: string) => {
    if (currentStatus === 'PAID') {
      const tx = transactions.find((t) => t.id === transactionId);
      if (tx) {
        handleOpenFinancialRevertModal(tx);
        return;
      }
    }

    const newStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
    try {
      await api.patch(`/financial/transactions/${transactionId}/status`, {
        status: newStatus,
      });
      fetchTransactions();
    } catch (err) {
      console.error('Failed to update payment status:', err);
    }
  };

  const handleOpenSettleModal = async (patientId?: number, preselectedSessionId?: number) => {
    setSettleError(null);
    setSettleSuccess(null);
    setSettleNotes('');
    setShowPaidHistory(false);
    setRequestNfOnSettle(false);
    setSettlePaymentDate(new Date().toISOString().substring(0, 10));
    setSettlePaymentMethod('PIX');
    setIsSettleModalOpen(true);

    try {
      const pRes = await api.get('/patients');
      const loadedPatients: Patient[] = pRes.data.patients || [];
      setAllPatients(loadedPatients);

      if (patientId) {
        await loadPatientSessionsForSettle(patientId, preselectedSessionId);
      } else if (loadedPatients.length > 0) {
        // Prioriza o paciente que tiver lançamento pendente no momento
        const pendingTx = transactions.find((t) => t.status === 'PENDING');
        const defaultId = pendingTx ? pendingTx.patient_id : loadedPatients[0].id;
        await loadPatientSessionsForSettle(defaultId);
      }
    } catch (err) {
      console.error('Failed to prepare settle modal:', err);
    }
  };

  const loadPatientSessionsForSettle = async (patientId: number, preselectedSessionId?: number) => {
    try {
      setIsLoadingSettleSessions(true);
      setSettleError(null);
      const res = await api.get(`/financial/patient-sessions/${patientId}`);
      setSettlePatient(res.data.patient);
      setSettlePaidSessions(res.data.paid_sessions || []);
      const list: SettleSessionItem[] = (res.data.sessions || []).map((s: any) => ({
        ...s,
        selected: preselectedSessionId ? s.id === preselectedSessionId : !s.is_future,
      }));
      if (list.length > 0 && !list.some((s) => s.selected)) {
        list[0].selected = true;
      }
      setSettleSessions(list);
    } catch (err: any) {
      console.error('Failed to load patient sessions for settle:', err);
      setSettleError(err.response?.data?.error || 'Erro ao carregar sessões do paciente.');
    } finally {
      setIsLoadingSettleSessions(false);
    }
  };

  const handleToggleSelectSession = (id: number) => {
    setSettleSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const handleSelectAllPending = (select: boolean) => {
    setSettleSessions((prev) =>
      prev.map((s) => (!s.is_future ? { ...s, selected: select } : s))
    );
  };

  const handleSelectAllFuture = (select: boolean) => {
    setSettleSessions((prev) =>
      prev.map((s) => (s.is_future ? { ...s, selected: select } : s))
    );
  };

  const handleSessionPriceChange = (id: number, val: number) => {
    setSettleSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, price: isNaN(val) ? 0 : val } : s))
    );
  };

  const selectedSessions = useMemo(() => {
    return settleSessions.filter((s) => s.selected);
  }, [settleSessions]);

  const totalSettleAmount = useMemo(() => {
    return selectedSessions.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
  }, [selectedSessions]);

  const pendingSessions = useMemo(() => {
    return settleSessions.filter((s) => !s.is_future);
  }, [settleSessions]);

  const futureRecurringSessions = useMemo(() => {
    return settleSessions.filter((s) => s.is_future);
  }, [settleSessions]);

  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlePatient) {
      setSettleError('Selecione um paciente para dar baixa.');
      return;
    }
    if (selectedSessions.length === 0) {
      setSettleError('Selecione pelo menos uma sessão para dar baixa.');
      return;
    }

    try {
      setIsSubmittingSettle(true);
      setSettleError(null);
      const payload = {
        patient_id: settlePatient.id,
        payment_date: settlePaymentDate,
        payment_method: settlePaymentMethod,
        notes: settleNotes.trim(),
        settlements: selectedSessions.map((s) => ({
          session_id: s.id,
          amount: Number(s.price),
        })),
      };

      const res = await api.post('/financial/settle-sessions', payload);
      setSettleSuccess(res.data.message || 'Baixa registrada com sucesso!');
      await fetchTransactions();

      if (requestNfOnSettle) {
        try {
          const invRes = await api.post('/invoices', {
            patient_id: settlePatient.id,
            session_ids: selectedSessions.map((s) => s.id),
            notes: settleNotes.trim(),
            status: 'PENDING_DISPATCH',
          });
          const createdInvoice = invRes.data.invoice;

          setIsSettleModalOpen(false);
          setSettleSuccess(null);

          setInvoiceRequestPatient(settlePatient);
          setInvoiceRequestSessions(selectedSessions);
          setInvoiceRequestExistingId(createdInvoice?.id);
          setIsInvoiceRequestModalOpen(true);
        } catch (invErr) {
          console.error('Failed to create invoice on settlement', invErr);
          setIsSettleModalOpen(false);
          setSettleSuccess(null);
        }
      } else {
        setTimeout(() => {
          setIsSettleModalOpen(false);
          setSettleSuccess(null);
        }, 900);
      }
    } catch (err: any) {
      console.error('Failed to submit settlement:', err);
      setSettleError(err.response?.data?.error || 'Erro ao processar baixa.');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleOpenCarneLeao = async () => {
    try {
      const res = await api.get('/financial/carne-leao');
      setCarneLeaoData(res.data.carneLeaoRecords || []);
      setCarneLeaoModalOpen(true);
    } catch (err) {
      console.error('Failed to load carne-leao data:', err);
    }
  };

  const handleDownloadCSV = () => {
    if (carneLeaoData.length === 0) return;

    const headers = 'Data Pagamento;CPF Titular;Nome Paciente;Codigo Ocupacao;Descricao;Valor (R$)\n';
    const rows = carneLeaoData
      .map(
        (r) =>
          `"${r.data_pagamento}";"${r.cpf_titular}";"${r.titular_pagamento}";"${r.codigo_ocupacao}";"${r.historico}";"${r.valor.toFixed(2)}"`
      )
      .join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(headers + rows);
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', csvContent);
    downloadLink.setAttribute('download', `carne_leao_psicologia_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Contadores para as 3 sub-abas (respeitando os filtros temporais)
  const revenueTabCounts = useMemo(() => {
    let overview = 0;
    let overviewPending = 0;
    let psychotherapy = 0;
    let psychotherapyPending = 0;
    let evaluations = 0;
    let evaluationsPending = 0;

    for (const t of transactions) {
      const txDateStr = (t.transaction_date || '').substring(0, 10);
      if (revenueDateMode === 'MONTH' && revenueMonth) {
        if (!txDateStr.startsWith(revenueMonth)) continue;
      } else if (revenueDateMode === 'PERIOD') {
        if (revenueStartDate && txDateStr < revenueStartDate) continue;
        if (revenueEndDate && txDateStr > revenueEndDate) continue;
      }

      overview++;
      if (t.status === 'PENDING') {
        overviewPending++;
      }

      if (t.evaluation_id) {
        evaluations++;
        if (t.status === 'PENDING') evaluationsPending++;
      } else {
        psychotherapy++;
        if (t.status === 'PENDING') psychotherapyPending++;
      }
    }

    return {
      overview,
      overviewPending,
      psychotherapy,
      psychotherapyPending,
      evaluations,
      evaluationsPending,
    };
  }, [transactions, revenueDateMode, revenueMonth, revenueStartDate, revenueEndDate]);

  // Filter & Sort transactions (por padrão ordenada por data - mais recente primeiro)
  const filteredTransactions = useMemo(() => {
    const list = transactions.filter((t) => {
      // 1. Filtro por Sub-aba (Visão Geral, Sessões de Psicoterapia, Parcelas Avaliações)
      if (revenueSubTab === 'psychotherapy' && t.evaluation_id) return false;
      if (revenueSubTab === 'evaluations' && !t.evaluation_id) return false;

      // 2. Filtro por Status
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      if (!matchesStatus) return false;

      // 3. Filtro Temporal (Mês ou Período)
      const txDateStr = (t.transaction_date || '').substring(0, 10);
      if (revenueDateMode === 'MONTH' && revenueMonth) {
        if (!txDateStr.startsWith(revenueMonth)) return false;
      } else if (revenueDateMode === 'PERIOD') {
        if (revenueStartDate && txDateStr < revenueStartDate) return false;
        if (revenueEndDate && txDateStr > revenueEndDate) return false;
      }

      // 4. Filtro por Busca
      const q = search.toLowerCase().trim();
      if (q) {
        const matchesName = (t.patient_name || '').toLowerCase().includes(q);
        const matchesCpf = (t.patient_cpf || '').includes(q);
        const matchesInv = (t.invoice_number || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCpf && !matchesInv) return false;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortField === 'date') {
        const timeA = new Date(a.transaction_date).getTime();
        const timeB = new Date(b.transaction_date).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }
      if (sortField === 'amount') {
        return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
      }
      if (sortField === 'patient') {
        return sortOrder === 'desc'
          ? (b.patient_name || '').localeCompare(a.patient_name || '')
          : (a.patient_name || '').localeCompare(b.patient_name || '');
      }
      return 0;
    });
  }, [transactions, revenueSubTab, statusFilter, revenueDateMode, revenueMonth, revenueStartDate, revenueEndDate, search, sortField, sortOrder]);

  // Cálculos dos 3 KPIs baseados nas transações ativas da sub-aba e do período selecionado
  const revenueStats = useMemo(() => {
    const baseList = transactions.filter((t) => {
      if (revenueSubTab === 'psychotherapy' && t.evaluation_id) return false;
      if (revenueSubTab === 'evaluations' && !t.evaluation_id) return false;

      const txDateStr = (t.transaction_date || '').substring(0, 10);
      if (revenueDateMode === 'MONTH' && revenueMonth) {
        if (!txDateStr.startsWith(revenueMonth)) return false;
      } else if (revenueDateMode === 'PERIOD') {
        if (revenueStartDate && txDateStr < revenueStartDate) return false;
        if (revenueEndDate && txDateStr > revenueEndDate) return false;
      }
      return true;
    });

    let totalPaid = 0;
    let paidCount = 0;
    let totalPending = 0;
    let pendingCount = 0;
    let totalInvoiced = 0;
    let invoicedCount = 0;

    for (const t of baseList) {
      const val = Number(t.amount) || 0;
      if (t.status === 'PAID') {
        totalPaid += val;
        paidCount++;
      } else if (t.status === 'PENDING') {
        totalPending += val;
        pendingCount++;
      }

      if (t.invoice_status === 'ISSUED') {
        totalInvoiced += val;
        invoicedCount++;
      }
    }

    return {
      totalPaid,
      paidCount,
      totalPending,
      pendingCount,
      totalInvoiced,
      invoicedCount,
      totalBaseCount: baseList.length,
    };
  }, [transactions, revenueSubTab, revenueDateMode, revenueMonth, revenueStartDate, revenueEndDate]);

  return (
    <div className="space-y-6 pb-12">
      {/* Primary Section Switcher: Segmentado por Áreas */}
      <div className="flex flex-wrap gap-4 xl:gap-6 border-b border-slate-200 dark:border-slate-800 pb-5 mb-2">
        
        {/* Bloco 1: Pacientes & Clínico */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-2">
            Pacientes & Clínico
          </span>
          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-300/60 dark:border-slate-700/60 w-fit shadow-sm">
            <button
              id="tab-btn-receitas"
              data-tour="subnav-revenues"
              type="button"
              onClick={() => handleTabChange('revenues')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs transition cursor-pointer ${
                currentTab === 'revenues'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Receitas (Honorários)</span>
            </button>

            <button
              id="tab-btn-cobrancas"
              data-tour="subnav-billings"
              type="button"
              onClick={() => handleTabChange('billings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs transition cursor-pointer ${
                currentTab === 'billings'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Cobranças (WhatsApp)</span>
            </button>
          </div>
        </div>

        {/* Bloco 2: Gestão & Equipe */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-2">
            Gestão & Equipe
          </span>
          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-300/60 dark:border-slate-700/60 w-fit shadow-sm">
            <button
              id="tab-btn-despesas"
              data-tour="subnav-expenses"
              type="button"
              onClick={() => handleTabChange('expenses')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs transition cursor-pointer ${
                currentTab === 'expenses'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <TrendingDown className="h-3.5 w-3.5" />
              <span>Despesas (Contas)</span>
            </button>

            {canManageRepasses && isRepasseEnabled && (
              <button
                id="tab-btn-repasses"
                data-tour="subnav-repasses"
                data-help-id="repasse-panel"
                type="button"
                onClick={() => handleTabChange('repasses')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs transition cursor-pointer ${
                  currentTab === 'repasses'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Percent className="h-3.5 w-3.5" />
                <span>Repasses (Psicólogos)</span>
              </button>
            )}
          </div>
        </div>

        {/* Bloco 3: Fiscal & Contábil */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-2">
            Fiscal & Contábil
          </span>
          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-300/60 dark:border-slate-700/60 w-fit shadow-sm">
            {canViewInvoices && (
              <button
                id="tab-btn-invoices"
                data-tour="subnav-invoices"
                data-help-id="nf-solicitacoes-tab"
                type="button"
                onClick={() => handleTabChange('invoices')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs transition cursor-pointer ${
                  currentTab === 'invoices'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>Notas Fiscais</span>
              </button>
            )}

            <button
              id="tab-btn-carne-leao"
              data-tour="subnav-carne-leao"
              data-help-id="carne-leao-export"
              type="button"
              onClick={() => handleTabChange('carne-leao')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs transition cursor-pointer ${
                currentTab === 'carne-leao'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Carnê-Leão & Livro-Caixa</span>
            </button>
          </div>
        </div>

      </div>

      {currentTab === 'expenses' ? (
        <ExpensesModule />
      ) : currentTab === 'billings' ? (
        <BillingsModule onNavigateToSettle={(patientId) => handleOpenSettleModal(patientId)} />
      ) : currentTab === 'repasses' ? (
        <RepasseManagementTab />
      ) : currentTab === 'carne-leao' ? (
        <CarneLeaoTab />
      ) : currentTab === 'invoices' ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="h-5 w-5 text-teal-600" />
                Controle de Emissão de Notas Fiscais
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhe solicitações de NF enviadas à contabilidade e registre as notas emitidas para os pacientes.
              </p>
            </div>
            <button
              id="btn-new-invoice-body"
              type="button"
              onClick={() => {
                setInvoiceRequestPatient(null);
                setInvoiceRequestSessions([]);
                setInvoiceRequestExistingId(undefined);
                setIsInvoiceRequestModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-500 transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Solicitação de NF</span>
            </button>
          </div>

                    {/* Sub-Views Switcher: 4 Sub-Abas Especializadas */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-2xl border border-slate-300/60 dark:border-slate-700 w-fit">
            <button
              id="subview-btn-issued"
              data-help-id="nf-emitidas-tab"
              type="button"
              onClick={() => setInvoiceSubView('issued')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                invoiceSubView === 'issued'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              <span>NF's Emitidas</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-bold">
                {issuedInvoices.length}
              </span>
              {issuedRevertedInvoices.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-amber-950 font-extrabold animate-pulse" title="Notas emitidas com pagamentos revertidos">
                  {issuedRevertedInvoices.length} alerta{issuedRevertedInvoices.length > 1 ? 's' : ''}
                </span>
              )}
            </button>

            <button
              id="subview-btn-requested"
              data-help-id="nf-solicitacoes-tab"
              type="button"
              onClick={() => setInvoiceSubView('requested')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                invoiceSubView === 'requested'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Send className="h-4 w-4" />
              <span>NF's Solicitadas</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-bold">
                {requestedInvoices.length}
              </span>
              {pendingDispatchInvoices.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-amber-950 font-extrabold">
                  {pendingDispatchInvoices.length} a enviar
                </span>
              )}
            </button>

            <button
              id="subview-btn-overview"
              data-help-id="nf-solicitacoes-tab"
              type="button"
              onClick={() => setInvoiceSubView('overview')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                invoiceSubView === 'overview'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span>Painel para Solicitações</span>
              {aptTotalCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                  {aptTotalCount} {aptTotalCount === 1 ? 'apto' : 'aptos'}
                </span>
              )}
            </button>

            <button
              id="subview-btn-history"
              type="button"
              onClick={() => setInvoiceSubView('history')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                invoiceSubView === 'history'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FolderArchive className="h-4 w-4" />
              <span>Canceladas & Histórico</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-bold">
                {historyInvoices.length}
              </span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* SUB-ABA 1: NF's Emitidas (Finalizadas na Prefeitura)                       */}
          {/* ========================================================================= */}
          {invoiceSubView === 'issued' && (
            <div className="space-y-4">
              {/* Micro-KPIs: Foco em Faturamento Emitido e Integridade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Notas Emitidas</div>
                      <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        R$ {issuedStats.totalSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                    {issuedStats.totalCount} {issuedStats.totalCount === 1 ? 'nota emitida' : 'notas emitidas'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${issuedStats.revertedCount > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notas com Pagamento Estornado</div>
                      <div className={`text-xl font-extrabold ${issuedStats.revertedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {issuedStats.revertedCount} {issuedStats.revertedCount === 1 ? 'nota requer atenção' : 'notas requerem atenção'}
                      </div>
                    </div>
                  </div>
                  {issuedStats.revertedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterOnlyReverted(!filterOnlyReverted)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                        filterOnlyReverted
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                      }`}
                    >
                      {filterOnlyReverted ? 'Ver Todas' : 'Filtrar Alertas'}
                    </button>
                  )}
                </div>
              </div>

              {/* Banner Retrátil de Alerta de Reversão em Notas Emitidas */}
              {issuedRevertedInvoices.length > 0 && (
                <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300 shrink-0">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-amber-950 dark:text-amber-200">
                          Atenção Contábil ({issuedRevertedInvoices.length} nota{issuedRevertedInvoices.length > 1 ? 's' : ''}):
                        </span>{' '}
                        <span className="text-amber-800 dark:text-amber-300">
                          Estas notas já foram emitidas com número oficial, mas um ou mais atendimentos tiveram o pagamento revertido/estornado.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAlertsDrawerOpen(!isAlertsDrawerOpen)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 transition cursor-pointer"
                    >
                      <span>{isAlertsDrawerOpen ? 'Ocultar Detalhes' : 'Instruções de Resolução'}</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isAlertsDrawerOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {isAlertsDrawerOpen && (
                    <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 animate-in fade-in duration-200">
                      <p>
                        <strong>Como resolver:</strong> Como a nota já foi transmitida para a prefeitura com número oficial, o estorno financeiro no sistema não anula a nota automaticamente.
                      </p>
                      <p>
                        1. Clique no botão de ações (<strong>⋮</strong>) da nota correspondente e selecione <strong>&quot;Solicitar Cancelamento NF&quot;</strong>.
                      </p>
                      <p>
                        2. Uma mensagem de cancelamento com o motivo será formatada para o seu contador entrar no portal da prefeitura e realizar o cancelamento.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Seletor de Categoria: Todas as Notas vs Sessões de Psicoterapia vs Avaliações Neuropsicológicas */}
              <div data-help-id="nf-filter-service-type" className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-2xl w-fit border border-slate-300/60 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIssuedCategoryFilter('ALL')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                    issuedCategoryFilter === 'ALL'
                      ? 'bg-white text-slate-900 dark:bg-slate-700 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Todas as Notas</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    issuedCategoryFilter === 'ALL'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold'
                      : 'bg-slate-300/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {issuedInvoices.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIssuedCategoryFilter('SESSIONS')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                    issuedCategoryFilter === 'SESSIONS'
                      ? 'bg-white text-teal-700 dark:bg-slate-700 dark:text-teal-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Sessões de Psicoterapia</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    issuedCategoryFilter === 'SESSIONS'
                      ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-extrabold'
                      : 'bg-slate-300/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {issuedSessionsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIssuedCategoryFilter('EVALUATIONS')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                    issuedCategoryFilter === 'EVALUATIONS'
                      ? 'bg-white text-purple-700 dark:bg-slate-700 dark:text-purple-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Brain className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Avaliações Neuropsicológicas</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    issuedCategoryFilter === 'EVALUATIONS'
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 font-extrabold'
                      : 'bg-slate-300/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {issuedEvaluationsCount}
                  </span>
                </button>
              </div>

              {/* Barra de Busca e Filtros de Data para Notas Emitidas */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por paciente, CPF ou Nº da Nota Fiscal..."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:text-white focus:outline-hidden focus:border-teal-500 transition"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {!invoiceRangeMode ? (
                    <div
                      onClick={(e) => {
                        const input = e.currentTarget.querySelector('input');
                        try { input?.showPicker(); } catch {}
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer hover:border-teal-500 transition group"
                      title="Clique para abrir o calendário"
                    >
                      <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Data:</span>
                      <input
                        type="date"
                        value={invoiceDateFilter}
                        onChange={(e) => setInvoiceDateFilter(e.target.value)}
                        onClick={(e) => {
                          e.stopPropagation();
                          try { (e.currentTarget as any).showPicker?.(); } catch {}
                        }}
                        className="bg-transparent text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer dark:[color-scheme:dark]"
                      />
                      {invoiceDateFilter && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInvoiceDateFilter('');
                          }}
                          className="ml-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer rounded-full"
                          title="Limpar filtro de data"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-0.5 text-xs">
                      <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0 mr-1" />
                      <span className="text-[11px] text-slate-400">De:</span>
                      <input
                        type="date"
                        value={invoiceDateFilter}
                        onChange={(e) => setInvoiceDateFilter(e.target.value)}
                        onClick={(e) => {
                          try { (e.currentTarget as any).showPicker?.(); } catch {}
                        }}
                        className="bg-transparent text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer dark:[color-scheme:dark]"
                      />
                      <span className="text-[11px] text-slate-400 ml-1">Até:</span>
                      <input
                        type="date"
                        value={invoiceDateEndFilter}
                        onChange={(e) => setInvoiceDateEndFilter(e.target.value)}
                        onClick={(e) => {
                          try { (e.currentTarget as any).showPicker?.(); } catch {}
                        }}
                        className="bg-transparent text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer dark:[color-scheme:dark]"
                      />
                      {(invoiceDateFilter || invoiceDateEndFilter) && (
                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceDateFilter('');
                            setInvoiceDateEndFilter('');
                          }}
                          className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer rounded-full"
                          title="Limpar período"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setInvoiceRangeMode(false);
                      setInvoiceDateFilter(invoiceDateFilter === today ? '' : today);
                      setInvoiceDateEndFilter('');
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                      !invoiceRangeMode && invoiceDateFilter === new Date().toISOString().split('T')[0]
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    Hoje
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceRangeMode(!invoiceRangeMode);
                      if (invoiceRangeMode) {
                        setInvoiceDateEndFilter('');
                      }
                    }}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer px-1"
                  >
                    {invoiceRangeMode ? 'Dia Único' : '+ Período'}
                  </button>
                </div>
              </div>

              {/* Tabela de NF's Emitidas */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800 overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px]">
                  <table className="w-full text-left text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold select-none">
                      <tr>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Número da NF</th>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Paciente</th>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Itens / Atendimentos</th>
                        <th className="px-5 py-3.5 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Valor Consolidado</th>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Data de Emissão</th>
                        <th className="px-5 py-3.5 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Status</th>
                        <th className="px-5 py-3.5 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {isLoadingInvoices ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                            Carregando notas fiscais emitidas...
                          </td>
                        </tr>
                      ) : filteredIssuedInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                            <FileCheck className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="font-semibold text-slate-600 dark:text-slate-300">Nenhuma Nota Fiscal emitida encontrada</p>
                            <p className="text-xs text-slate-400 mt-0.5">Notas emitidas com número oficial pela prefeitura constarão nesta tela.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredIssuedInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span>NF nº {inv.invoice_number || inv.id}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {inv.file_data && (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadInvoicePdf(inv)}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 underline cursor-pointer"
                                  >
                                    <Download className="h-3 w-3" />
                                    <span>PDF</span>
                                  </button>
                                )}
                                {inv.xml_data && (
                                  <a
                                    href={`/api/invoices/${inv.id}/xml`}
                                    download={`NFSe_${inv.invoice_number || inv.id}.xml`}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-300 underline cursor-pointer"
                                  >
                                    <FileCheck className="h-3 w-3 text-teal-600" />
                                    <span>XML</span>
                                  </a>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900 dark:text-white">{inv.patient_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {inv.patient_cpf ? `CPF: ${inv.patient_cpf}` : 'Sem CPF'}
                              </div>
                            </td>

                            <td className="px-5 py-3.5">
                              {(() => {
                                const isEval = (inv.items || []).some((it: any) => it.evaluation_id != null || it.transaction_id != null);
                                return (
                                  <div className="mb-1">
                                    {isEval ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/60">
                                        <Brain className="h-3 w-3 text-purple-500" />
                                        <span>Avaliação Neuro</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800/60">
                                        <Calendar className="h-3 w-3 text-teal-500" />
                                        <span>Psicoterapia</span>
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                              <div className="font-medium text-slate-700 dark:text-slate-300">
                                {inv.items?.length || 0} {inv.items?.length === 1 ? 'atendimento' : 'atendimentos'}
                              </div>
                              <div className="text-[11px] text-slate-400 max-w-xs truncate" title={(inv.items || []).map((it: any) => it.session_date ? new Date(it.session_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '').filter(Boolean).join(', ')}>
                                {(inv.items || []).map((it: any) => it.session_date ? new Date(it.session_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '').filter(Boolean).join(', ')}
                              </div>
                            </td>

                            <td className="px-5 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
                              R$ {Number(inv.total_amount).toFixed(2)}
                            </td>

                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <div>{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('pt-BR') : '-'}</div>
                              {inv.requested_at && (
                                <div className="text-[10px] text-slate-400">
                                  Solicitada: {new Date(inv.requested_at).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-3.5 text-center whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Emitida</span>
                              </span>
                              {inv.has_reverted_payments && (
                                <div className="mt-1 flex justify-center">
                                  <span
                                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 shadow-2xs"
                                    title="Item(ns) desta nota fiscal teve(rão) pagamento estornado para pendente"
                                  >
                                    <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                    <span>Pagamento Revertido</span>
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  title="Enviar comprovante ao paciente via WhatsApp"
                                  onClick={() => handleSendInvoiceWhatsAppToPatient(inv)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition font-bold cursor-pointer text-xs"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  <span>Avisar Paciente</span>
                                </button>

                                <div className="relative inline-block invoice-action-menu-container">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveActionMenuId(activeActionMenuId === inv.id ? null : inv.id);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700/60 transition cursor-pointer"
                                    title="Mais opções da nota fiscal"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>

                                  {activeActionMenuId === inv.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50 py-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 text-left"
                                    >
                                      {inv.file_data && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleDownloadInvoicePdf(inv);
                                            setActiveActionMenuId(null);
                                          }}
                                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 cursor-pointer"
                                        >
                                          <Download className="h-3.5 w-3.5 text-teal-600" />
                                          <span>Baixar PDF da NF</span>
                                        </button>
                                      )}
                                      {inv.xml_data && (
                                        <a
                                          href={`/api/invoices/${inv.id}/xml`}
                                          download={`NFSe_${inv.invoice_number || inv.id}.xml`}
                                          onClick={() => setActiveActionMenuId(null)}
                                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 cursor-pointer"
                                        >
                                          <FileCheck className="h-3.5 w-3.5 text-teal-600" />
                                          <span>Baixar XML Oficial</span>
                                        </a>
                                      )}
                                      <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedInvoiceForCancel(inv);
                                          setCancellationModalMode('REQUEST');
                                          setActiveActionMenuId(null);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer text-rose-600 dark:text-rose-400 font-medium"
                                      >
                                        <Ban className="h-3.5 w-3.5" />
                                        <span>Solicitar Cancelamento NF</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUB-ABA 2: NF's Solicitadas (Em Tramitação / Aguardando Emissão)          */}
          {/* ========================================================================= */}
          {invoiceSubView === 'requested' && (
            <div className="space-y-4">
              {/* Micro-KPIs: Foco em Fila de Despacho e Fila do Contador */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                      <Send className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total em Tramitação</div>
                      <div className="text-xl font-extrabold text-slate-800 dark:text-white">
                        R$ {requestedStats.totalSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40">
                    {requestedStats.totalCount}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aguardando Envio WhatsApp</div>
                      <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                        R$ {requestedStats.pendingDispatchSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                    {requestedStats.pendingDispatchCount}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Com o Contador</div>
                      <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                        R$ {requestedStats.waitingSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
                    {requestedStats.waitingCount}
                  </span>
                </div>
              </div>

              {/* Filtros Contextuais de Tramitação + Busca */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
                <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 gap-1">
                  {[
                    { id: 'ALL', label: 'Todas em Tramitação', count: requestedStats.totalCount },
                    { id: 'PENDING_DISPATCH', label: 'Aguardando Envio WhatsApp', count: requestedStats.pendingDispatchCount },
                    { id: 'REQUESTED', label: 'Aguardando Contador', count: requestedStats.waitingCount },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRequestedSubFilter(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        requestedSubFilter === tab.id
                          ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        requestedSubFilter === tab.id
                          ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-extrabold'
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por paciente ou CPF..."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:text-white focus:outline-hidden focus:border-teal-500 transition"
                  />
                </div>
              </div>

              {/* Tabela de NF's Solicitadas */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800 overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px]">
                  <table className="w-full text-left text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold select-none">
                      <tr>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Paciente</th>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Itens / Atendimentos</th>
                        <th className="px-5 py-3.5 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Valor Consolidado</th>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Solicitada em</th>
                        <th className="px-5 py-3.5 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Fase Atual</th>
                        <th className="px-5 py-3.5 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Ação Direta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {isLoadingInvoices ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                            Carregando solicitações de nota fiscal...
                          </td>
                        </tr>
                      ) : filteredRequestedInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                            <Send className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="font-semibold text-slate-600 dark:text-slate-300">Nenhuma solicitação em tramitação encontrada</p>
                            <p className="text-xs text-slate-400 mt-0.5">Use o &quot;Painel para Solicitações&quot; para enviar novos lotes ao contador.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredRequestedInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900 dark:text-white">{inv.patient_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {inv.patient_cpf ? `CPF: ${inv.patient_cpf}` : 'Sem CPF'}
                              </div>
                            </td>

                            <td className="px-5 py-3.5">
                              <div className="font-medium text-slate-700 dark:text-slate-300">
                                {inv.items?.length || 0} {inv.items?.length === 1 ? 'atendimento' : 'atendimentos'}
                              </div>
                              <div className="text-[11px] text-slate-400 max-w-xs truncate" title={(inv.items || []).map((it: any) => it.session_date ? new Date(it.session_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '').filter(Boolean).join(', ')}>
                                {(inv.items || []).map((it: any) => it.session_date ? new Date(it.session_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '').filter(Boolean).join(', ')}
                              </div>
                            </td>

                            <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white text-sm whitespace-nowrap">
                              R$ {Number(inv.total_amount).toFixed(2)}
                            </td>

                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {inv.requested_at ? new Date(inv.requested_at).toLocaleDateString('pt-BR') : '-'}
                            </td>

                            <td className="px-5 py-3.5 text-center whitespace-nowrap">
                              {inv.status === 'PENDING_DISPATCH' ? (
                                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                  <Clock className="h-3 w-3 animate-pulse" />
                                  <span>Aguardando Envio WhatsApp</span>
                                </span>
                              ) : inv.status === 'PROCESSING_GATEWAY' ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                                  <div className="h-2.5 w-2.5 border-2 border-blue-400 border-t-blue-700 rounded-full animate-spin" />
                                  <span>Processando</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800">
                                  <Send className="h-3 w-3" />
                                  <span>Aguardando Retorno Contador</span>
                                </span>
                              )}
                              {inv.has_reverted_payments && (
                                <div className="mt-1 flex justify-center">
                                  <span
                                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700 shadow-2xs"
                                    title="Item com pagamento estornado. Recomenda-se cancelar a solicitação antes da emissão."
                                  >
                                    <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                                    <span>Pagamento Estornado</span>
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                {inv.status === 'PENDING_DISPATCH' ? (
                                  <button
                                    type="button"
                                    title="Disparar mensagem WhatsApp para contabilidade"
                                    onClick={() => {
                                      setInvoiceRequestPatient({
                                        id: inv.patient_id,
                                        full_name: inv.patient_name,
                                        cpf: inv.patient_cpf,
                                        phone: inv.patient_phone,
                                      });
                                      setInvoiceRequestSessions(
                                        (inv.items || [])
                                          .filter((it: any) => it.session_id)
                                          .map((it: any) => ({
                                            id: it.session_id,
                                            start_time: it.start_time || it.session_date,
                                            end_time: it.end_time,
                                            modality: it.modality || 'PRESENTIAL',
                                            price: it.session_price,
                                            is_paid: !it.is_future_reimbursement,
                                          }))
                                      );
                                      setInvoiceRequestEvaluationTxIds(
                                        (inv.items || [])
                                          .filter((it: any) => it.transaction_id)
                                          .map((it: any) => it.transaction_id)
                                      );
                                      setInvoiceRequestExistingId(inv.id);
                                      setIsInvoiceRequestModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span>Enviar WhatsApp</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    title="Registrar número da NF e anexar PDF recebido da contabilidade"
                                    onClick={() => {
                                      setSelectedInvoiceForComplete(inv);
                                      setIsInvoiceCompleteModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                                  >
                                    <FileCheck className="h-3.5 w-3.5" />
                                    <span>Anotar NF</span>
                                  </button>
                                )}

                                <div className="relative inline-block invoice-action-menu-container">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveActionMenuId(activeActionMenuId === inv.id ? null : inv.id);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700/60 transition cursor-pointer"
                                    title="Mais opções"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>

                                  {activeActionMenuId === inv.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50 py-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 text-left"
                                    >
                                      {inv.status === 'PENDING_DISPATCH' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedInvoiceForComplete(inv);
                                            setIsInvoiceCompleteModalOpen(true);
                                            setActiveActionMenuId(null);
                                          }}
                                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 cursor-pointer"
                                        >
                                          <FileCheck className="h-3.5 w-3.5 text-teal-600" />
                                          <span>Anotar NF Diretamente</span>
                                        </button>
                                      )}

                                      {inv.status === 'REQUESTED' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setInvoiceRequestPatient({
                                              id: inv.patient_id,
                                              full_name: inv.patient_name,
                                              cpf: inv.patient_cpf,
                                              phone: inv.patient_phone,
                                            });
                                            setInvoiceRequestSessions(
                                              (inv.items || [])
                                                .filter((it: any) => it.session_id)
                                                .map((it: any) => ({
                                                  id: it.session_id,
                                                  start_time: it.start_time || it.session_date,
                                                  end_time: it.end_time,
                                                  modality: it.modality || 'PRESENTIAL',
                                                  price: it.session_price,
                                                  is_paid: !it.is_future_reimbursement,
                                                }))
                                            );
                                            setInvoiceRequestEvaluationTxIds(
                                              (inv.items || [])
                                                .filter((it: any) => it.transaction_id)
                                                .map((it: any) => it.transaction_id)
                                            );
                                            setInvoiceRequestExistingId(inv.id);
                                            setIsInvoiceRequestModalOpen(true);
                                            setActiveActionMenuId(null);
                                          }}
                                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 cursor-pointer text-emerald-700 dark:text-emerald-400"
                                        >
                                          <MessageSquare className="h-3.5 w-3.5" />
                                          <span>Reenviar WhatsApp ao Contador</span>
                                        </button>
                                      )}

                                      <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleCancelInvoice(inv.id, inv);
                                          setActiveActionMenuId(null);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer text-rose-600 dark:text-rose-400 font-medium"
                                      >
                                        <Ban className="h-3.5 w-3.5" />
                                        <span>Cancelar Solicitação</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUB-ABA 4: Canceladas & Histórico (Histórico e Descarte)                  */}
          {/* ========================================================================= */}
          {invoiceSubView === 'history' && (
            <div className="space-y-4">
              {/* Micro-KPIs: Cancelamentos e Rejeições */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      <FolderArchive className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Histórico Cancelado</div>
                      <div className="text-xl font-extrabold text-slate-800 dark:text-white">
                        R$ {historyStats.totalSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {historyStats.totalCount}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cancelamento em Andamento</div>
                      <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                        {historyStats.cancellationRequestedCount}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                    Aguardando Contador
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                      <Ban className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Canceladas / Rejeitadas</div>
                      <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                        {historyStats.canceledCount + historyStats.rejectedCount}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40">
                    Definitivas
                  </span>
                </div>
              </div>

              {/* Filtros Contextuais de Histórico + Busca */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
                <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 gap-1 flex-wrap">
                  {[
                    { id: 'ALL', label: 'Todo o Histórico', count: historyStats.totalCount },
                    { id: 'CANCELLATION_REQUESTED', label: 'Cancelamento Solicitado', count: historyStats.cancellationRequestedCount },
                    { id: 'CANCELED', label: 'Canceladas Definitivas', count: historyStats.canceledCount },
                    { id: 'REJECTED', label: 'Rejeitadas pela Prefeitura', count: historyStats.rejectedCount },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setHistorySubFilter(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        historySubFilter === tab.id
                          ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        historySubFilter === tab.id
                          ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-extrabold'
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar paciente, motivo ou protocolo..."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:text-white focus:outline-hidden focus:border-teal-500 transition"
                  />
                </div>
              </div>

              {/* Tabela de Canceladas & Histórico */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800 overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px]">
                  <table className="w-full text-left text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold select-none">
                      <tr>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Nota / Paciente</th>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Valor</th>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Status</th>
                        <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Motivo / Protocolo</th>
                        <th className="px-5 py-3.5 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {isLoadingInvoices ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                            Carregando histórico fiscal...
                          </td>
                        </tr>
                      ) : filteredHistoryInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                            <FolderArchive className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="font-semibold text-slate-600 dark:text-slate-300">Nenhum registro de cancelamento ou rejeição</p>
                          </td>
                        </tr>
                      ) : (
                        filteredHistoryInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {inv.invoice_number ? `NF nº ${inv.invoice_number}` : `Solicitação #${inv.id}`}
                              </div>
                              <div className="text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                                {inv.patient_name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {inv.patient_cpf ? `CPF: ${inv.patient_cpf}` : 'Sem CPF'}
                              </div>
                            </td>

                            <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              R$ {Number(inv.total_amount).toFixed(2)}
                            </td>

                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {inv.status === 'CANCELLATION_REQUESTED' ? (
                                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                  <Clock className="h-3 w-3 text-amber-600 animate-pulse" />
                                  <span>Cancelamento em Andamento</span>
                                </span>
                              ) : inv.status === 'REJECTED' ? (
                                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                                  <AlertCircle className="h-3 w-3 text-rose-600" />
                                  <span>Rejeitada</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                  <Ban className="h-3 w-3 text-rose-500" />
                                  <span>Cancelada Definitiva</span>
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs">
                              {inv.cancellation_protocol && (
                                <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  Prot: {inv.cancellation_protocol}
                                </div>
                              )}
                              {inv.cancellation_reason && (
                                <div className="text-[11px] text-slate-500 italic mt-0.5 truncate" title={inv.cancellation_reason}>
                                  Motivo: &quot;{inv.cancellation_reason}&quot;
                                </div>
                              )}
                              {inv.error_details && inv.status === 'REJECTED' && (
                                <div className="text-[11px] text-rose-600 italic mt-0.5 truncate" title={inv.error_details}>
                                  Erro: {inv.error_details}
                                </div>
                              )}
                              {!inv.cancellation_protocol && !inv.cancellation_reason && !inv.error_details && (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                {inv.status === 'CANCELLATION_REQUESTED' && (
                                  <>
                                    <button
                                      type="button"
                                      title="Confirmar baixa do cancelamento efetuada pelo contador na prefeitura"
                                      onClick={() => {
                                        setSelectedInvoiceForCancel(inv);
                                        setCancellationModalMode('COMPLETE');
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Confirmar Baixa</span>
                                    </button>

                                    <button
                                      type="button"
                                      title="Reabrir mensagem formatada de cancelamento para o WhatsApp do contador"
                                      onClick={() => {
                                        setSelectedInvoiceForCancel(inv);
                                        setCancellationModalMode('REQUEST');
                                      }}
                                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 dark:border-slate-700 dark:text-slate-300 transition cursor-pointer"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}

                                {inv.status === 'REJECTED' && (
                                  <button
                                    type="button"
                                    title="Retentar emissão direta"
                                    onClick={async () => {
                                      try {
                                        await api.post(`/invoices/${inv.id}/emit-direct`);
                                        fetchInvoices();
                                      } catch (e: any) {
                                        alert(e.response?.data?.error || 'Erro ao retentar emissão');
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-bold transition cursor-pointer text-xs"
                                  >
                                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                                    <span>Reemitir</span>
                                  </button>
                                )}

                                {inv.status === 'CANCELED' && (
                                  <span className="text-[11px] text-slate-400 italic">
                                    {inv.cancellation_protocol ? `Prot: ${inv.cancellation_protocol}` : 'Cancelada'}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUB-ABA 3: Painel para Solicitações de Emissão (Atendimentos Aptos)       */}
          {/* ========================================================================= */}
          {invoiceSubView === 'overview' && (
            <div className="space-y-6">
              {/* Seletor de Categoria: Sessões Clínicas vs Avaliações Neuropsicológicas */}
              <div className="flex items-center gap-2 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-2xl w-fit border border-slate-300/60 dark:border-slate-700">
                <button
                  id="tab-fiscal-sessions"
                  type="button"
                  onClick={() => {
                    setFiscalCategoryTab('SESSIONS');
                    setSelectedOverviewSessionIds({});
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                    fiscalCategoryTab === 'SESSIONS'
                      ? 'bg-white text-teal-700 dark:bg-slate-700 dark:text-teal-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span>Sessões de Psicoterapia</span>
                  {overviewStats.pendingNfCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                      {overviewStats.pendingNfCount}
                    </span>
                  )}
                </button>

                <button
                  id="tab-fiscal-evaluations"
                  type="button"
                  onClick={() => {
                    setFiscalCategoryTab('EVALUATIONS');
                    setSelectedOverviewEvalTxIds({});
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                    fiscalCategoryTab === 'EVALUATIONS'
                      ? 'bg-white text-purple-700 dark:bg-slate-700 dark:text-purple-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span>Avaliações Neuropsicológicas</span>
                  {overviewEvalStats.pendingNfCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                      {overviewEvalStats.pendingNfCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Summary Stats based on Category */}
              {fiscalCategoryTab === 'SESSIONS' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Total de Sessões
                      </span>
                      <Calendar className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                      {overviewStats.totalSessions} sessões
                    </div>
                    <span className="text-[11px] text-slate-400">Atendimentos clínicos de psicoterapia</span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Pendentes de NF (Sem Solicitação)
                      </span>
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                      R$ {overviewStats.pendingNfSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {overviewStats.pendingNfCount} {overviewStats.pendingNfCount === 1 ? 'sessão aguardando solicitação' : 'sessões aguardando solicitação'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        Com NF Solicitada / Emitida
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                      R$ {overviewStats.withNfSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {overviewStats.withNfCount} {overviewStats.withNfCount === 1 ? 'sessão com processo fiscal' : 'sessões com processo fiscal'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                        Parcelas de Avaliação
                      </span>
                      <Brain className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                      {overviewEvalStats.totalEvaluations} parcelas
                    </div>
                    <span className="text-[11px] text-slate-400">Contratos de Avaliação Neuropsicológica</span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Pendentes de NF (Sem Solicitação)
                      </span>
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                      R$ {overviewEvalStats.pendingNfSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {overviewEvalStats.pendingNfCount} {overviewEvalStats.pendingNfCount === 1 ? 'parcela aguardando solicitação' : 'parcelas aguardando solicitação'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        Com NF Solicitada / Emitida
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                      R$ {overviewEvalStats.withNfSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {overviewEvalStats.withNfCount} {overviewEvalStats.withNfCount === 1 ? 'parcela com processo fiscal' : 'parcelas com processo fiscal'}
                    </span>
                  </div>
                </div>
              )}

              {/* Selection Banner: Sessões de Psicoterapia */}
              {fiscalCategoryTab === 'SESSIONS' && selectedSessionsList.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <CheckSquare className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0" />
                    {selectedPatientData?.isConflict ? (
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        Atenção: Você selecionou sessões de pacientes diferentes. Para compor uma Nota Fiscal, selecione apenas sessões do mesmo paciente.
                      </span>
                    ) : (
                      <div className="text-xs text-teal-950 dark:text-teal-200">
                        <span className="font-bold">{selectedSessionsList.length}</span> {selectedSessionsList.length === 1 ? 'sessão selecionada' : 'sessões selecionadas'} de{' '}
                        <span className="font-bold">{selectedPatientData?.patient_name}</span> • Valor Consolidado:{' '}
                        <span className="font-bold text-teal-700 dark:text-teal-300">
                          R$ {selectedPatientData?.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOverviewSessionIds({})}
                      className="px-3 py-1.5 rounded-xl text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium cursor-pointer"
                    >
                      Limpar Seleção
                    </button>
                    <button
                      type="button"
                      disabled={selectedPatientData?.isConflict}
                      onClick={handleLaunchInvoiceForSelectedSessions}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs shadow-xs hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <Receipt className="h-4 w-4" />
                      <span>Solicitar NF para {selectedPatientData?.isConflict ? 'Paciente' : selectedPatientData?.patient_name?.split(' ')[0]}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Selection Banner: Avaliações Neuropsicológicas */}
              {fiscalCategoryTab === 'EVALUATIONS' && selectedEvaluationsList.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <CheckSquare className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
                    {selectedEvalPatientData?.isConflict ? (
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        Atenção: Você selecionou parcelas de pacientes diferentes. Para compor uma Nota Fiscal, selecione apenas parcelas do mesmo paciente.
                      </span>
                    ) : (
                      <div className="text-xs text-purple-950 dark:text-purple-200">
                        <span className="font-bold">{selectedEvaluationsList.length}</span> {selectedEvaluationsList.length === 1 ? 'parcela selecionada' : 'parcelas selecionadas'} de{' '}
                        <span className="font-bold">{selectedEvalPatientData?.patient_name}</span> • Valor Consolidado:{' '}
                        <span className="font-bold text-purple-700 dark:text-purple-300">
                          R$ {selectedEvalPatientData?.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOverviewEvalTxIds({})}
                      className="px-3 py-1.5 rounded-xl text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium cursor-pointer"
                    >
                      Limpar Seleção
                    </button>
                    <button
                      type="button"
                      disabled={selectedEvalPatientData?.isConflict}
                      onClick={handleLaunchInvoiceForSelectedEvaluations}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-xs hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <Receipt className="h-4 w-4" />
                      <span>Solicitar NF para {selectedEvalPatientData?.isConflict ? 'Paciente' : selectedEvalPatientData?.patient_name?.split(' ')[0]}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Filter and Search Bar for Sessions Overview */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800">
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar paciente ou CPF..."
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  {/* Filtro de Data com Acesso ao Calendário */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {!sessionRangeMode ? (
                      <div
                        onClick={(e) => {
                          const input = e.currentTarget.querySelector('input');
                          try { input?.showPicker(); } catch {}
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer hover:border-teal-500 transition group"
                        title="Clique para abrir o calendário e selecionar uma data"
                      >
                        <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition shrink-0" />
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Data:</span>
                        <input
                          type="date"
                          value={sessionDateFilter}
                          onChange={(e) => setSessionDateFilter(e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation();
                            try { (e.currentTarget as any).showPicker?.(); } catch {}
                          }}
                          className="bg-transparent text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer dark:[color-scheme:dark]"
                        />
                        {sessionDateFilter && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionDateFilter('');
                            }}
                            className="ml-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                            title="Limpar filtro de data"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-0.5 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0 mr-1" />
                        <span className="text-[11px] text-slate-400">De:</span>
                        <input
                          type="date"
                          value={sessionDateFilter}
                          onChange={(e) => setSessionDateFilter(e.target.value)}
                          onClick={(e) => {
                            try { (e.currentTarget as any).showPicker?.(); } catch {}
                          }}
                          className="bg-transparent text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer dark:[color-scheme:dark]"
                        />
                        <span className="text-[11px] text-slate-400 ml-1">Até:</span>
                        <input
                          type="date"
                          value={sessionDateEndFilter}
                          onChange={(e) => setSessionDateEndFilter(e.target.value)}
                          onClick={(e) => {
                            try { (e.currentTarget as any).showPicker?.(); } catch {}
                          }}
                          className="bg-transparent text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer dark:[color-scheme:dark]"
                        />
                        {(sessionDateFilter || sessionDateEndFilter) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSessionDateFilter('');
                              setSessionDateEndFilter('');
                            }}
                            className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer rounded-full"
                            title="Limpar período"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setSessionRangeMode(false);
                        setSessionDateFilter(sessionDateFilter === today ? '' : today);
                        setSessionDateEndFilter('');
                      }}
                      className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer ${
                        !sessionRangeMode && sessionDateFilter === new Date().toISOString().split('T')[0]
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                      title="Filtrar atendimentos de hoje"
                    >
                      Hoje
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSessionRangeMode(!sessionRangeMode);
                        if (sessionRangeMode) {
                          setSessionDateEndFilter('');
                        }
                      }}
                      className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer px-1"
                      title={sessionRangeMode ? 'Filtrar por um dia específico' : 'Filtrar por intervalo de datas'}
                    >
                      {sessionRangeMode ? 'Dia Único' : '+ Período'}
                    </button>
                  </div>

                  {/* Status Fiscal */}
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">NF:</span>
                    <div className="flex items-center rounded-lg border border-slate-200 p-1 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                      {[
                        { id: 'ALL', label: 'Todas' },
                        { id: 'NONE', label: 'Sem NF' },
                        { id: 'REQUESTED', label: 'Solicitada' },
                        { id: 'ISSUED', label: 'Emitida' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setSessionFiscalFilter(tab.id)}
                          className={`px-2 py-0.5 font-semibold rounded cursor-pointer transition text-xs ${
                            sessionFiscalFilter === tab.id
                              ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-700 dark:text-teal-300'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status Pagamento */}
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Pagamento:</span>
                    <div className="flex items-center rounded-lg border border-slate-200 p-1 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                      {[
                        { id: 'ALL', label: 'Todos' },
                        { id: 'PAID', label: 'Pagas' },
                        { id: 'PENDING', label: 'Pendentes/Futuras' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setSessionPaymentStatusFilter(tab.id);
                            if (tab.id === 'PENDING') {
                              setSessionPaymentMethodFilter('ALL');
                            }
                          }}
                          className={`px-2 py-0.5 font-semibold rounded cursor-pointer transition text-xs ${
                            sessionPaymentStatusFilter === tab.id
                              ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-700 dark:text-teal-300'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Forma de Pagamento (Conforme pedido do usuário!) */}
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={sessionPaymentMethodFilter}
                      onChange={(e) => setSessionPaymentMethodFilter(e.target.value)}
                      disabled={sessionPaymentStatusFilter === 'PENDING'}
                      title={sessionPaymentStatusFilter === 'PENDING' ? 'Aplica-se apenas aos atendimentos já quitados' : 'Filtrar por forma de pagamento recebida'}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="ALL">Todas as Formas</option>
                      <option value="PIX">PIX</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Transferência Bancária">Transferência Bancária</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Boleto">Boleto</option>
                      <option value="Convênio">Convênio</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sessions or Evaluations Table based on fiscalCategoryTab */}
              {fiscalCategoryTab === 'SESSIONS' ? (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800 overflow-hidden">
                  <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px]">
                    <table className="w-full text-left text-xs border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold select-none">
                        <tr>
                          <th className="px-4 py-3 text-center w-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                            <input
                              type="checkbox"
                              checked={
                                overviewSessions.length > 0 &&
                                overviewSessions.filter(s => s.fiscal_status === 'NONE').length > 0 &&
                                overviewSessions.filter(s => s.fiscal_status === 'NONE').every(s => selectedOverviewSessionIds[s.session_id])
                              }
                              onChange={(e) => handleSelectAllPendingOverview(e.target.checked)}
                              title="Selecionar todas sem NF"
                              className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            />
                          </th>
                          <th className="px-4 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Data & Horário</th>
                          <th className="px-4 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Paciente / Contato</th>
                          <th className="px-4 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Modalidade</th>
                          <th className="px-4 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Atendimento</th>
                          <th className="px-4 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Pagamento</th>
                          <th className="px-4 py-3 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Valor</th>
                          <th className="px-4 py-3 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Status NF</th>
                          <th className="px-4 py-3 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {isLoadingOverviewSessions ? (
                          <tr>
                            <td colSpan={9} className="px-5 py-10 text-center text-slate-400">
                              Carregando sessões agendadas...
                            </td>
                          </tr>
                        ) : overviewSessions.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                              <Calendar className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                              <p className="font-semibold text-slate-600 dark:text-slate-300">Nenhuma sessão encontrada com os filtros selecionados</p>
                            </td>
                          </tr>
                        ) : (
                          overviewSessions.map((s) => {
                            const dateObj = new Date(s.start_time);
                            const dateFormatted = dateObj.toLocaleDateString('pt-BR');
                            const timeFormatted = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            const isSelected = !!selectedOverviewSessionIds[s.session_id];

                            return (
                              <tr
                                key={s.session_id}
                                className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition ${
                                  isSelected ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''
                                }`}
                              >
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleOverviewSession(s.session_id)}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                  />
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {dateFormatted} <span className="font-normal text-slate-500">às {timeFormatted}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {s.is_future ? (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 font-semibold">
                                        Futura
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium">
                                        Realizada
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {s.patient_name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    {s.patient_cpf ? `CPF: ${s.patient_cpf}` : 'Sem CPF'}
                                  </div>
                                </td>

                                <td className="px-4 py-3">
                                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                    {s.modality === 'ONLINE' ? 'Online' : 'Presencial'}
                                  </span>
                                </td>

                                <td className="px-4 py-3">
                                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                                    {s.session_status === 'CONFIRMED'
                                      ? 'Confirmado'
                                      : s.session_status === 'SCHEDULED'
                                      ? 'Agendado'
                                      : s.session_status === 'COMPLETED'
                                      ? 'Concluído'
                                      : s.session_status === 'NO_SHOW'
                                      ? 'Falta'
                                      : s.session_status}
                                  </span>
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  {s.payment_status === 'PAID' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>Pago {s.payment_method ? `• ${s.payment_method}` : ''}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                      <Clock className="h-3 w-3" />
                                      <span>{s.is_future ? 'Futura (Pendente)' : 'Pendente'}</span>
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                  R$ {Number(s.price).toFixed(2)}
                                </td>

                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                  {s.fiscal_status === 'NONE' ? (
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                      Sem Solicitação
                                    </span>
                                  ) : s.fiscal_status === 'PENDING_DISPATCH' ? (
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                      <Clock className="h-3 w-3" />
                                      Pendente Envio
                                    </span>
                                  ) : s.fiscal_status === 'REQUESTED' ? (
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800">
                                      <Send className="h-3 w-3" />
                                      Solicitada
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>Emitida {s.invoice_number ? `(NF ${s.invoice_number})` : ''}</span>
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {s.fiscal_status === 'NONE' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInvoiceRequestPatient({
                                          id: s.patient_id,
                                          full_name: s.patient_name,
                                          cpf: s.patient_cpf,
                                          phone: s.patient_phone,
                                        });
                                        setInvoiceRequestSessions([{
                                          id: s.session_id,
                                          start_time: s.start_time,
                                          end_time: s.end_time,
                                          modality: s.modality,
                                          price: Number(s.price),
                                          is_paid: s.payment_status === 'PAID',
                                        }]);
                                        setInvoiceRequestExistingId(undefined);
                                        setIsInvoiceRequestModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800 font-semibold text-xs transition cursor-pointer"
                                    >
                                      <Receipt className="h-3.5 w-3.5" />
                                      <span>Solicitar NF</span>
                                    </button>
                                  ) : s.fiscal_status === 'REQUESTED' || s.fiscal_status === 'PENDING_DISPATCH' ? (
                                    <button
                                      type="button"
                                      onClick={() => setInvoiceSubView('requested')}
                                      className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline font-semibold cursor-pointer"
                                    >
                                      <span>Ver em Solicitadas</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setInvoiceSubView('issued')}
                                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline font-semibold cursor-pointer"
                                    >
                                      <span>Ver em Emitidas</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Evaluations Table */
                <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800 overflow-hidden">
                  <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px]">
                    <table className="w-full text-left text-xs border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold select-none">
                        <tr>
                          <th className="px-4 py-3 text-center w-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                            <input
                              type="checkbox"
                              checked={
                                overviewEvaluations.length > 0 &&
                                overviewEvaluations.filter(ev => ev.fiscal_status === 'NONE').length > 0 &&
                                overviewEvaluations.filter(ev => ev.fiscal_status === 'NONE').every(ev => selectedOverviewEvalTxIds[ev.transaction_id])
                              }
                              onChange={(e) => handleSelectAllPendingOverviewEvals(e.target.checked)}
                              title="Selecionar todas sem NF"
                              className="h-3.5 w-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                          </th>
                          <th className="px-4 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Data / Parcela</th>
                          <th className="px-4 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Paciente / Contato</th>
                          <th className="px-4 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Demanda / Avaliação</th>
                          <th className="px-4 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Pagamento</th>
                          <th className="px-4 py-3 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Valor</th>
                          <th className="px-4 py-3 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Status NF</th>
                          <th className="px-4 py-3 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {isLoadingOverviewEvaluations ? (
                          <tr>
                            <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                              Carregando parcelas de avaliação neuropsicológica...
                            </td>
                          </tr>
                        ) : overviewEvaluations.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                              <Brain className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                              <p className="font-semibold text-slate-600 dark:text-slate-300">Nenhuma parcela de avaliação encontrada com os filtros selecionados</p>
                            </td>
                          </tr>
                        ) : (
                          overviewEvaluations.map((ev) => {
                            const dateObj = new Date(ev.transaction_date);
                            const dateFormatted = dateObj.toLocaleDateString('pt-BR');
                            const isSelected = !!selectedOverviewEvalTxIds[ev.transaction_id];

                            return (
                              <tr
                                key={ev.transaction_id}
                                className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition ${
                                  isSelected ? 'bg-purple-50/40 dark:bg-purple-950/20' : ''
                                }`}
                              >
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleOverviewEval(ev.transaction_id)}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                  />
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {dateFormatted}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 font-bold">
                                      {ev.installment_number && ev.total_installments
                                        ? `Parcela ${ev.installment_number}/${ev.total_installments}`
                                        : 'Parcela Única'}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {ev.patient_name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    {ev.patient_cpf ? `CPF: ${ev.patient_cpf}` : 'Sem CPF'}
                                  </div>
                                </td>

                                <td className="px-4 py-3">
                                  <div className="font-medium text-slate-800 dark:text-slate-200">
                                    {ev.evaluation_title || 'Avaliação Neuropsicológica'}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                    Status: {ev.evaluation_status || 'Em Andamento'}
                                  </div>
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  {ev.payment_status === 'PAID' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>Pago {ev.payment_method ? `• ${ev.payment_method}` : ''}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                      <Clock className="h-3 w-3" />
                                      <span>Pendente</span>
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                  R$ {Number(ev.price).toFixed(2)}
                                </td>

                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                  {ev.fiscal_status === 'NONE' ? (
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                      Sem Solicitação
                                    </span>
                                  ) : ev.fiscal_status === 'PENDING_DISPATCH' ? (
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                      <Clock className="h-3 w-3" />
                                      Pendente Envio
                                    </span>
                                  ) : ev.fiscal_status === 'REQUESTED' ? (
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800">
                                      <Send className="h-3 w-3" />
                                      Solicitada
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>Emitida {ev.invoice_number ? `(NF ${ev.invoice_number})` : ''}</span>
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {ev.fiscal_status === 'NONE' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInvoiceRequestPatient({
                                          id: ev.patient_id,
                                          full_name: ev.patient_name,
                                          cpf: ev.patient_cpf,
                                          phone: ev.patient_phone,
                                        });
                                        setInvoiceRequestSessions([]);
                                        setInvoiceRequestEvaluationTxIds([ev.transaction_id]);
                                        setInvoiceRequestExistingId(undefined);
                                        setIsInvoiceRequestModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-bold text-xs shadow-xs transition cursor-pointer"
                                      title="Solicitar Nota Fiscal à contabilidade para esta parcela"
                                    >
                                      <Receipt className="h-3.5 w-3.5" />
                                      <span>Solicitar NF</span>
                                    </button>
                                  ) : ev.fiscal_status === 'REQUESTED' || ev.fiscal_status === 'PENDING_DISPATCH' ? (
                                    <button
                                      type="button"
                                      onClick={() => setInvoiceSubView('requested')}
                                      className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline font-semibold cursor-pointer"
                                    >
                                      <span>Ver em Solicitadas</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setInvoiceSubView('issued')}
                                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline font-semibold cursor-pointer"
                                    >
                                      <span>Ver em Emitidas</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Top Header Card (Padrão Idêntico a Cobranças) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Recebimento de Honorários de Pacientes
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gestão integrada de honorários: Sessões de Psicoterapia e Parcelas de Avaliações com controle fiscal e Carnê-Leão
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleOpenCarneLeao}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-semibold text-xs transition cursor-pointer"
                title="Visualizar estrutura e baixar CSV para Carnê-Leão Web"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Carnê-Leão</span>
              </button>

              <button
                type="button"
                onClick={fetchTransactions}
                disabled={isLoading}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>
          </div>

          {/* Main Specialized Tabs Navigation (Padrão Underline Tab Idêntico a Cobranças) */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 gap-6 overflow-x-auto">
            <button
              type="button"
              onClick={() => setRevenueSubTab('overview')}
              className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition whitespace-nowrap ${
                revenueSubTab === 'overview'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              <span>Visão Geral ({revenueTabCounts.overview})</span>
              {revenueTabCounts.overviewPending > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-extrabold">
                  {revenueTabCounts.overviewPending} pendente(s)
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setRevenueSubTab('psychotherapy')}
              className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition whitespace-nowrap ${
                revenueSubTab === 'psychotherapy'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Sessões de Psicoterapia ({revenueTabCounts.psychotherapy})</span>
              {revenueTabCounts.psychotherapyPending > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-extrabold">
                  {revenueTabCounts.psychotherapyPending} pendente(s)
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setRevenueSubTab('evaluations')}
              className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition whitespace-nowrap ${
                revenueSubTab === 'evaluations'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>Parcelas de Avaliações ({revenueTabCounts.evaluations})</span>
              {revenueTabCounts.evaluationsPending > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-extrabold">
                  {revenueTabCounts.evaluationsPending} pendente(s)
                </span>
              )}
            </button>
          </div>

          {/* 2. Summary Stats (Micro-KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Recebido</span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                R$ {revenueStats.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-400">{revenueStats.paidCount} lançamento(s) quitado(s)</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aguardando Pagamento</span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                R$ {revenueStats.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-400">{revenueStats.pendingCount} honorário(s) em aberto</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Faturado (com NF's)</span>
              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-2">
                R$ {revenueStats.totalInvoiced.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-400">{revenueStats.invoicedCount} lançamento(s) com NF emitida</span>
            </div>
          </div>

          {/* 3. Filter and Search Bar com Mês e Período de Datas */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por paciente, CPF ou NF..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                />
              </div>

              {/* Filtro de Datas: Todos | Mês | Período */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setRevenueDateMode('ALL')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      revenueDateMode === 'ALL'
                        ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-700 dark:text-teal-300'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Todo o Histórico
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevenueDateMode('MONTH')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      revenueDateMode === 'MONTH'
                        ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-700 dark:text-teal-300'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Mês
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevenueDateMode('PERIOD')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      revenueDateMode === 'PERIOD'
                        ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-700 dark:text-teal-300'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Período
                  </button>
                </div>

                {revenueDateMode === 'MONTH' && (
                  <input
                    type="month"
                    value={revenueMonth}
                    onChange={(e) => setRevenueMonth(e.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white font-medium focus:outline-hidden"
                  />
                )}

                {revenueDateMode === 'PERIOD' && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <input
                      type="date"
                      value={revenueStartDate}
                      onChange={(e) => setRevenueStartDate(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-white font-medium focus:outline-hidden"
                    />
                    <span className="text-slate-400">até</span>
                    <input
                      type="date"
                      value={revenueEndDate}
                      onChange={(e) => setRevenueEndDate(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-white font-medium focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().substring(0, 10);
                        setRevenueStartDate(today);
                        setRevenueEndDate(today);
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Hoje
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs shrink-0">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="font-semibold text-slate-600 dark:text-slate-300">Status:</span>
              <div className="flex items-center rounded-lg border border-slate-200 p-1 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1 font-semibold rounded cursor-pointer ${
                    statusFilter === 'ALL' ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-700 dark:text-teal-300' : 'text-slate-500'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('PAID')}
                  className={`px-3 py-1 font-semibold rounded cursor-pointer ${
                    statusFilter === 'PAID' ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-700 dark:text-emerald-300' : 'text-slate-500'
                  }`}
                >
                  Pagos
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('PENDING')}
                  className={`px-3 py-1 font-semibold rounded cursor-pointer ${
                    statusFilter === 'PENDING' ? 'bg-white text-amber-700 shadow-xs dark:bg-slate-700 dark:text-amber-300' : 'text-slate-500'
                  }`}
                >
                  Pendentes
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Toast de Reversão */}
          {financialRevertToast && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between shadow-xs mb-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{financialRevertToast}</span>
              </div>
              <button type="button" onClick={() => setFinancialRevertToast(null)} className="p-1 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 rounded-lg cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* 4. Transactions Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800 overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px]">
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold select-none">
                  <tr>
                    <th
                      onClick={() => {
                        if (sortField === 'patient') {
                          setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setSortField('patient');
                          setSortOrder('asc');
                        }
                      }}
                      className="px-5 py-3 cursor-pointer hover:text-slate-800 dark:hover:text-white transition bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs"
                    >
                      <div className="flex items-center gap-1">
                        <span>Paciente / CPF</span>
                        {sortField === 'patient' && (
                          sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-teal-600" /> : <ArrowDown className="h-3.5 w-3.5 text-teal-600" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (sortField === 'date') {
                          setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setSortField('date');
                          setSortOrder('asc');
                        }
                      }}
                      className="px-5 py-3 cursor-pointer hover:text-slate-800 dark:hover:text-white transition bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs"
                    >
                      <div className="flex items-center gap-1">
                        <span>Data</span>
                        {sortField === 'date' ? (
                          sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-teal-600" /> : <ArrowDown className="h-3.5 w-3.5 text-teal-600" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (sortField === 'amount') {
                          setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                        } else {
                          setSortField('amount');
                          setSortOrder('desc');
                        }
                      }}
                      className="px-5 py-3 cursor-pointer hover:text-slate-800 dark:hover:text-white transition bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs"
                    >
                      <div className="flex items-center gap-1">
                        <span>Valor</span>
                        {sortField === 'amount' && (
                          sortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-teal-600" /> : <ArrowUp className="h-3.5 w-3.5 text-teal-600" />
                        )}
                      </div>
                    </th>
                    <th className="px-5 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Forma</th>
                    <th className="px-5 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Status</th>
                    <th className="px-5 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Nota Fiscal</th>
                    <th className="px-5 py-3 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                        Nenhum lançamento financeiro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const isPaid = tx.status === 'PAID';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">{tx.patient_name}</span>
                              {tx.evaluation_id && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/60">
                                  <Brain className="h-3 w-3" />
                                  <span>Laudo Neuro {tx.installment_number ? `• Parcela ${tx.installment_number}/${tx.total_installments}` : ''}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              CPF: {tx.patient_cpf}
                              {tx.evaluation_title && ` • ${tx.evaluation_title}`}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                            {new Date(tx.transaction_date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                            R$ {tx.amount.toFixed(2)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                              {tx.payment_method}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {isPaid ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {tx.invoice_status === 'ISSUED' ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 font-bold text-[11px] text-emerald-700 dark:text-emerald-400">
                                  <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>NF nº {tx.invoice_number || 'S/N'}</span>
                                </span>
                                {tx.invoice_issued_at && (
                                  <span className="text-[10px] text-slate-400">
                                    Emitida em {new Date(tx.invoice_issued_at).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                                {tx.invoice_has_pdf ? (
                                  <a
                                    href={`/api/invoices/${tx.invoice_id}/pdf`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-600 hover:text-teal-700 underline mt-0.5 cursor-pointer"
                                  >
                                    <Download className="h-2.5 w-2.5" />
                                    <span>Ver PDF</span>
                                  </a>
                                ) : null}
                              </div>
                            ) : tx.invoice_status === 'REQUESTED' || tx.invoice_status === 'PENDING_DISPATCH' ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800 w-fit">
                                  <Clock className="h-2.5 w-2.5" />
                                  <span>Solicitada</span>
                                </span>
                                {tx.invoice_requested_at && (
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(tx.invoice_requested_at).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isPaid && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedEvaluationReceipt({ evaluationId: tx.evaluation_id || null, transactionId: tx.id })}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950/80 dark:hover:bg-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1 cursor-pointer"
                                  title="Emitir Recibo Profissional com Selo Digital"
                                >
                                  <Receipt className="h-3.5 w-3.5" />
                                  <span>Recibo</span>
                                </button>
                              )}
                              {!isPaid ? (
                                <button
                                  id={`btn-dar-baixa-${tx.id}`}
                                  type="button"
                                  onClick={() => {
                                    if (tx.evaluation_id) {
                                      handleOpenEvaluationSettleModal(tx.evaluation_id, tx.id);
                                    } else {
                                      handleOpenSettleModal(tx.patient_id, tx.session_id);
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                  <CheckSquare className="h-3.5 w-3.5" />
                                  <span>Dar Baixa</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenFinancialRevertModal(tx)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                  title="Reverter pagamento para pendente com guarda fiscal"
                                >
                                  <Undo2 className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Reverter</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

      {/* Modal Carnê-Leão */}
      {carneLeaoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-teal-600" />
                  Livro Caixa / Carnê-Leão (Código 2251-05 - Psicólogo)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Estrutura oficial para preenchimento no programa Carnê-Leão Web da Receita Federal do Brasil.
                </p>
              </div>

              <button
                onClick={handleDownloadCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition"
              >
                <Download className="h-4 w-4" />
                <span>Baixar CSV</span>
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 text-xs text-teal-950 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200">
                <strong>Obrigação Legal:</strong> Conforme IN RFB nº 1.500/2014, profissionais de psicologia devem declarar o CPF de cada paciente atendido que efetuou o pagamento dos honorários.
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">CPF Titular</th>
                      <th className="px-3 py-2">Paciente</th>
                      <th className="px-3 py-2">Cód. Ocupação</th>
                      <th className="px-3 py-2 text-right">Valor Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {carneLeaoData.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.data_pagamento}</td>
                        <td className="px-3 py-2 font-mono">{row.cpf_titular}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">{row.titular_pagamento}</td>
                        <td className="px-3 py-2 text-slate-500">{row.codigo_ocupacao}</td>
                        <td className="px-3 py-2 font-bold text-right text-emerald-600 dark:text-emerald-400">
                          R$ {row.valor.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setCarneLeaoModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Dar Baixa de Pagamento de Sessões (Pendentes e Futuras Recorrentes) */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[94vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Dar Baixa de Pagamento de Sessões
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecione as sessões quitadas (pendentes e/ou futuras recorrentes) e confirme o recebimento.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Patient Selector / Info Bar */}
            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Paciente:
                </span>
                <select
                  value={settlePatient?.id || ''}
                  onChange={(e) => {
                    const pid = parseInt(e.target.value, 10);
                    if (pid) loadPatientSessionsForSettle(pid);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                >
                  <option value="">Selecione o paciente...</option>
                  {allPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} {p.cpf ? `(CPF: ${p.cpf})` : '(Sem CPF)'}
                    </option>
                  ))}
                </select>
              </div>

              {settlePatient && (
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                  <span>{settlePatient.cpf ? `CPF: ${settlePatient.cpf}` : 'Sem CPF'}</span>
                  <span>•</span>
                  <span>{settlePatient.phone || 'Sem Telefone'}</span>
                </div>
              )}
            </div>

            {/* Messages */}
            {settleError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{settleError}</span>
              </div>
            )}
            {settleSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{settleSuccess}</span>
              </div>
            )}

            {/* Scrollable Sessions List */}
            <div className="mt-3 overflow-y-auto flex-1 pr-1 space-y-4">
              {isLoadingSettleSessions ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Carregando sessões pendentes e futuras recorrentes...
                </div>
              ) : !settlePatient ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Selecione um paciente acima para carregar as sessões.
                </div>
              ) : (
                <>
                  {/* Seção 1: Sessões Pendentes de Pagamento */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          Sessões Pendentes de Pagamento ({pendingSessions.length})
                        </span>
                      </div>
                      {pendingSessions.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleSelectAllPending(true)}
                            className="text-amber-700 dark:text-amber-300 font-semibold hover:underline cursor-pointer"
                          >
                            Selecionar todas
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllPending(false)}
                            className="text-slate-500 hover:underline cursor-pointer"
                          >
                            Desmarcar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-2 space-y-2 max-h-64 sm:max-h-72 overflow-y-auto">
                      {pendingSessions.length === 0 ? (
                        <p className="p-4 text-center text-xs text-slate-400">
                          Nenhuma sessão pendente de pagamento encontrada para este paciente.
                        </p>
                      ) : (
                        pendingSessions.map((session) => {
                          const dateObj = new Date(session.start_time);
                          const dateFormatted = !isNaN(dateObj.getTime())
                            ? dateObj.toLocaleDateString('pt-BR', {
                                weekday: 'short',
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }) +
                              ' às ' +
                              dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : session.start_time;

                          return (
                            <div
                              key={session.id}
                              className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                session.selected
                                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 dark:border-emerald-600 shadow-xs'
                                  : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:hover:border-slate-600'
                              }`}
                            >
                              <div
                                onClick={() => handleToggleSelectSession(session.id)}
                                className="flex items-center gap-2.5 cursor-pointer flex-1"
                              >
                                <button
                                  type="button"
                                  className="text-emerald-600 dark:text-emerald-400 focus:outline-hidden cursor-pointer"
                                >
                                  {session.selected ? (
                                    <CheckSquare className="h-4 w-4" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-400" />
                                  )}
                                </button>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                      {dateFormatted}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                                      Pendente
                                    </span>
                                    {session.is_recurring && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-semibold flex items-center gap-1">
                                        <Repeat className="h-2.5 w-2.5" />
                                        Recorrente
                                      </span>
                                    )}
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                      {session.modality === 'ONLINE' ? 'Online' : 'Presencial'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Editar valor individual da sessão */}
                              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                  Valor da Sessão: R$
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={session.price}
                                  onChange={(e) =>
                                    handleSessionPriceChange(session.id, parseFloat(e.target.value))
                                  }
                                  className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:border-teal-500 focus:outline-hidden"
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Seção 2: Sessões Futuras Recorrentes */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-3 bg-sky-50/70 dark:bg-sky-950/30 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Repeat className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          Sessões Futuras Recorrentes ({futureRecurringSessions.length})
                        </span>
                      </div>
                      {futureRecurringSessions.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleSelectAllFuture(true)}
                            className="text-sky-700 dark:text-sky-300 font-semibold hover:underline cursor-pointer"
                          >
                            Selecionar todas
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllFuture(false)}
                            className="text-slate-500 hover:underline cursor-pointer"
                          >
                            Desmarcar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-2 space-y-2 max-h-64 sm:max-h-72 overflow-y-auto">
                      {futureRecurringSessions.length === 0 ? (
                        <p className="p-4 text-center text-xs text-slate-400">
                          Nenhuma sessão futura recorrente encontrada para este paciente.
                        </p>
                      ) : (
                        futureRecurringSessions.map((session) => {
                          const dateObj = new Date(session.start_time);
                          const dateFormatted = !isNaN(dateObj.getTime())
                            ? dateObj.toLocaleDateString('pt-BR', {
                                weekday: 'short',
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }) +
                              ' às ' +
                              dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : session.start_time;

                          return (
                            <div
                              key={session.id}
                              className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                session.selected
                                  ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 dark:border-sky-600 shadow-xs'
                                  : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:hover:border-slate-600'
                              }`}
                            >
                              <div
                                onClick={() => handleToggleSelectSession(session.id)}
                                className="flex items-center gap-2.5 cursor-pointer flex-1"
                              >
                                <button
                                  type="button"
                                  className="text-emerald-600 dark:text-emerald-400 focus:outline-hidden cursor-pointer"
                                >
                                  {session.selected ? (
                                    <CheckSquare className="h-4 w-4" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-400" />
                                  )}
                                </button>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                      {dateFormatted}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-semibold">
                                      Futura Recorrente
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                      {session.modality === 'ONLINE' ? 'Online' : 'Presencial'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Editar valor individual da sessão */}
                              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                  Valor da Sessão: R$
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={session.price}
                                  onChange={(e) =>
                                    handleSessionPriceChange(session.id, parseFloat(e.target.value))
                                  }
                                  className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:border-teal-500 focus:outline-hidden"
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Seção 3: Histórico de Sessões já Quitadas (opcional para conferência) */}
                  {settlePaidSessions.length > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowPaidHistory(!showPaidHistory)}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span>Histórico de Sessões já Quitadas ({settlePaidSessions.length})</span>
                        </div>
                        <span className="text-[11px] text-teal-600 dark:text-teal-400 underline">
                          {showPaidHistory ? 'Ocultar' : 'Visualizar'}
                        </span>
                      </button>

                      {showPaidHistory && (
                        <div className="p-2 space-y-1.5 max-h-40 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
                          {settlePaidSessions.map((ps) => (
                            <div
                              key={ps.id}
                              className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <CheckSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {new Date(ps.start_time).toLocaleDateString('pt-BR')} às{' '}
                                  {new Date(ps.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                                  Quitada via {ps.payment_method || 'PIX'}
                                </span>
                              </div>
                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                R$ {Number(ps.price).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Painel de Totalização, Forma de Pagamento e Finalização */}
            <form onSubmit={handleSaveSettlement} className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              {/* Totalização das sessões selecionadas */}
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Sessões Selecionadas para Baixa
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {selectedSessions.length === 0
                      ? 'Nenhuma sessão selecionada'
                      : `${selectedSessions.length} sessão(ões) marcadas para quitação`}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Valor Total:
                  </span>
                  <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                    R$ {totalSettleAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Controles de Pagamento: Data, Forma e Observação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data do Pagamento *
                  </label>
                  <input
                    type="date"
                    required
                    value={settlePaymentDate}
                    onChange={(e) => setSettlePaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Forma de Pagamento *
                  </label>
                  <select
                    required
                    value={settlePaymentMethod}
                    onChange={(e) => setSettlePaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Transferência Bancária">Transferência Bancária</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Convênio">Convênio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Observação
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Quitação pacote mensal antecipado"
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              {canViewInvoices && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
                  <input
                    type="checkbox"
                    id="checkbox-request-nf-settle"
                    checked={requestNfOnSettle}
                    onChange={(e) => setRequestNfOnSettle(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <label htmlFor="checkbox-request-nf-settle" className="text-xs font-bold text-teal-900 dark:text-teal-200 cursor-pointer flex items-center gap-1.5 select-none">
                    <Receipt className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span>Solicitar emissão de Nota Fiscal à Contabilidade após salvar</span>
                  </label>
                </div>
              )}

              {/* Botões Salvar e Cancelar */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-save-settlement"
                  type="submit"
                  disabled={isSubmittingSettle || selectedSessions.length === 0}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="h-4 w-4" />
                  <span>
                    {isSubmittingSettle
                      ? 'Salvando Baixa...'
                      : `Salvar Baixa (${selectedSessions.length} sessões • R$ ${totalSettleAmount.toFixed(2)})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Dar Baixa de Parcelas de Avaliação Neuropsicológica */}
      {isEvalSettleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[94vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Dar Baixa em Parcelas de Avaliação Neuropsicológica
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecione as parcelas quitadas do contrato de avaliação e confirme o recebimento.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEvalSettleModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Evaluation & Patient Summary Card */}
            {evalSettleData?.evaluation && (
              <div className="mt-3.5 p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-purple-950 dark:text-purple-100">
                        {evalSettleData.evaluation.title || 'Avaliação Neuropsicológica'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-900 dark:bg-purple-900 dark:text-purple-200 font-bold">
                        {evalSettleData.evaluation.status || 'EM ANDAMENTO'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      <span className="font-semibold">Paciente:</span> {evalSettleData.evaluation.patient_name} • CPF: {evalSettleData.evaluation.patient_cpf || 'Não informado'}
                    </div>
                  </div>
                  <div className="text-right sm:border-l sm:border-purple-200 sm:dark:border-purple-800/60 sm:pl-4">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Contrato Total:</span>
                    <span className="font-bold text-base text-purple-900 dark:text-purple-200">
                      R$ {Number(evalSettleData.evaluation.contract_value).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      em {evalSettleData.evaluation.installments_count || 1}x ({evalSettleData.evaluation.payment_mode || 'PARCELADO'})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            {evalSettleError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{evalSettleError}</span>
              </div>
            )}
            {evalSettleSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{evalSettleSuccess}</span>
              </div>
            )}

            {/* Installments Selection Section */}
            <div className="mt-3.5 flex-1 overflow-y-auto space-y-3 min-h-[160px] max-h-[38vh] pr-1">
              {isLoadingEvalSettle ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Carregando parcelas da avaliação...
                </div>
              ) : (
                <>
                  {/* Pending Installments */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        Parcelas Pendentes de Quitação ({evalSettleData?.pending_installments?.length || 0})
                      </span>
                      {evalSettleData?.pending_installments && evalSettleData.pending_installments.length > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectAllPendingEvalInstallments(true)}
                            className="text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 cursor-pointer"
                          >
                            Marcar Todas
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllPendingEvalInstallments(false)}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                          >
                            Desmarcar
                          </button>
                        </div>
                      )}
                    </div>

                    {!evalSettleData?.pending_installments || evalSettleData.pending_installments.length === 0 ? (
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                        Todas as parcelas desta avaliação já foram quitadas!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {evalSettleData.pending_installments.map((inst: any) => {
                          const isSelected = !!selectedEvalInstallmentMap[inst.id];
                          const dueDate = new Date(inst.transaction_date).toLocaleDateString('pt-BR');
                          return (
                            <div
                              key={inst.id}
                              onClick={() => handleToggleSelectEvalInstallment(inst.id)}
                              className={`p-3 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
                                  : 'border-slate-200 hover:border-purple-300 bg-white dark:border-slate-700 dark:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // Handled by container onClick
                                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                                <div>
                                  <div className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-2">
                                    <span>
                                      {inst.installment_number && inst.total_installments
                                        ? `Parcela ${inst.installment_number} de ${inst.total_installments}`
                                        : 'Parcela Única'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    Vencimento programado: {dueDate}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  R$ {Number(inst.amount).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Paid History Collapsible */}
                  {evalSettleData?.paid_installments && evalSettleData.paid_installments.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowEvalPaidHistory(!showEvalPaidHistory)}
                        className="flex items-center justify-between w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          Histórico de Parcelas Já Pagas ({evalSettleData.paid_installments.length})
                        </span>
                        <span className="text-[11px] text-purple-600 dark:text-purple-400">
                          {showEvalPaidHistory ? 'Ocultar' : 'Exibir'}
                        </span>
                      </button>

                      {showEvalPaidHistory && (
                        <div className="mt-2 space-y-1.5">
                          {evalSettleData.paid_installments.map((pi: any) => (
                            <div
                              key={pi.id}
                              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between text-xs opacity-75"
                            >
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {pi.installment_number && pi.total_installments
                                    ? `Parcela ${pi.installment_number}/${pi.total_installments}`
                                    : 'Parcela'}
                                </span>
                                <span className="text-slate-400 text-[11px]">
                                  • Paga em {pi.paid_at ? new Date(pi.paid_at).toLocaleDateString('pt-BR') : new Date(pi.transaction_date).toLocaleDateString('pt-BR')} ({pi.payment_method})
                                </span>
                              </div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                R$ {Number(pi.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Settle Form & Totalizer */}
            <form onSubmit={handleSaveEvaluationSettlement} className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              {/* Totalization */}
              <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                    Parcelas Selecionadas para Baixa
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {selectedEvalInstallments.length === 0
                      ? 'Nenhuma parcela selecionada'
                      : `${selectedEvalInstallments.length} parcela(s) marcada(s) para quitação`}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Valor Total:
                  </span>
                  <span className="text-xl font-black text-purple-700 dark:text-purple-400">
                    R$ {totalEvalSettleAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Payment inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data do Pagamento *
                  </label>
                  <input
                    type="date"
                    required
                    value={evalPaymentDate}
                    onChange={(e) => setEvalPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Forma de Pagamento *
                  </label>
                  <select
                    required
                    value={evalPaymentMethod}
                    onChange={(e) => setEvalPaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Transferência Bancária">Transferência Bancária</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Convênio">Convênio</option>
                    {evalPaymentMethod === 'CARTAO' && <option value="CARTAO">Cartão de Crédito / Débito</option>}
                    {evalPaymentMethod === 'DINHEIRO' && <option value="DINHEIRO">Dinheiro</option>}
                    {evalPaymentMethod === 'BOLETO' && <option value="BOLETO">Boleto</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Observação
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Quitação parcela de avaliação"
                    value={evalNotes}
                    onChange={(e) => setEvalNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              {canViewInvoices && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                  <input
                    type="checkbox"
                    id="checkbox-request-nf-eval-settle"
                    checked={evalRequestNfOnSettle}
                    onChange={(e) => setEvalRequestNfOnSettle(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <label htmlFor="checkbox-request-nf-eval-settle" className="text-xs font-bold text-purple-950 dark:text-purple-200 cursor-pointer flex items-center gap-1.5 select-none">
                    <Receipt className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span>Solicitar emissão de Nota Fiscal à Contabilidade após salvar</span>
                  </label>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEvalSettleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-save-eval-settlement"
                  type="submit"
                  disabled={isSubmittingEvalSettle || selectedEvalInstallments.length === 0}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="h-4 w-4" />
                  <span>
                    {isSubmittingEvalSettle
                      ? 'Salvando Baixa...'
                      : `Salvar Baixa (${selectedEvalInstallments.length} parcela(s) • R$ ${totalEvalSettleAmount.toFixed(2)})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {/* Modais de Nota Fiscal */}
      {isInvoiceRequestModalOpen && (
        <InvoiceRequestModal
          isOpen={isInvoiceRequestModalOpen}
          onClose={() => {
            setIsInvoiceRequestModalOpen(false);
            setInvoiceRequestPatient(null);
            setInvoiceRequestSessions([]);
            setInvoiceRequestEvaluationTxIds([]);
            setInvoiceRequestExistingId(undefined);
          }}
          onSuccess={() => {
            setIsInvoiceRequestModalOpen(false);
            setInvoiceRequestPatient(null);
            setInvoiceRequestSessions([]);
            setInvoiceRequestEvaluationTxIds([]);
            setInvoiceRequestExistingId(undefined);
            fetchInvoices();
            fetchOverviewSessions();
            fetchOverviewEvaluations();
            setSelectedOverviewSessionIds({});
            setSelectedOverviewEvalTxIds({});
          }}
          initialPatient={invoiceRequestPatient}
          initialSessions={invoiceRequestSessions}
          initialEvaluationTransactionIds={invoiceRequestEvaluationTxIds}
          existingInvoiceId={invoiceRequestExistingId}
        />
      )}

      {isInvoiceCompleteModalOpen && selectedInvoiceForComplete && (
        <InvoiceCompleteModal
          isOpen={isInvoiceCompleteModalOpen}
          onClose={() => {
            setIsInvoiceCompleteModalOpen(false);
            setSelectedInvoiceForComplete(null);
          }}
          onSuccess={() => {
            setIsInvoiceCompleteModalOpen(false);
            setSelectedInvoiceForComplete(null);
            fetchInvoices();
            fetchOverviewSessions();
          }}
          invoice={selectedInvoiceForComplete}
        />
      )}

      {/* Modal de Recibo de Avaliação Neuropsicológica (Convênio) */}
      {selectedEvaluationReceipt && (
        <EvaluationReceiptModal
          isOpen={true}
          evaluationId={selectedEvaluationReceipt.evaluationId}
          transactionId={selectedEvaluationReceipt.transactionId}
          onClose={() => setSelectedEvaluationReceipt(null)}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: REVERSÃO FINANCEIRA COM LOTE INTELIGENTE & GUARDA FISCAL */}
      {/* ========================================================= */}
      {financialRevertTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            {/* Header com Guarda Fiscal */}
            {financialRevertBatchItems.some(i => i.selected && (i.invoice_status === 'ISSUED' || i.invoice_status === 'REQUESTED' || i.invoice_status === 'PENDING_DISPATCH')) ? (
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shrink-0">
                  <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Reversão com Guarda Fiscal
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    Impacto Fiscal & Contábil Detectado
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                  <Undo2 className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Reverter Pagamento para Pendente
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Confirmação de estorno financeiro
                  </p>
                </div>
              </div>
            )}

            {isLoadingFinancialBatch ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                <span className="text-xs">Analisando lote e vínculos fiscais...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cenário 1: Pagamento em Lote Conjunto */}
                {financialRevertBatchItems.length > 1 ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold">
                          <Link2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Pagamento Realizado em Lote Conjunto</span>
                        </div>
                        {financialRevertTarget?.patient_name && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold text-[10px]">
                            Paciente
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed">
                        Deseja reverter a quitação de lançamentos referente a <strong>{financialRevertTarget?.patient_name || 'paciente'}</strong>?
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        Identificamos que este pagamento foi baixado simultaneamente com outros <strong>{financialRevertBatchItems.length - 1} item(ns)</strong> em lote. Selecione quais deseja reverter:
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs px-1">
                      <button
                        type="button"
                        onClick={() => handleSelectAllFinancialBatch(!financialRevertBatchItems.every(i => i.selected))}
                        className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                      >
                        {financialRevertBatchItems.every(i => i.selected) ? 'Desmarcar Todos' : 'Selecionar Todo o Lote'}
                      </button>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {financialRevertBatchItems.filter(i => i.selected).length} de {financialRevertBatchItems.length} selecionado(s)
                      </span>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 max-h-48 overflow-y-auto">
                      {financialRevertBatchItems.map((item) => (
                        <label
                          key={item.id}
                          className={`flex items-center justify-between p-2.5 text-xs transition cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                            item.selected ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleFinancialBatchItem(item.id)}
                              className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {item.title}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '-'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              R$ {Number(item.amount).toFixed(2)}
                            </span>
                            {item.invoice_status === 'ISSUED' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                                NF nº {item.invoice_number || 'Emitida'}
                              </span>
                            )}
                            {(item.invoice_status === 'REQUESTED' || item.invoice_status === 'PENDING_DISPATCH') && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                                NF Solicitada
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="flex justify-between items-center px-1 text-xs font-semibold text-slate-700 dark:text-slate-200 pt-1">
                      <span>Total Selecionado para Reversão:</span>
                      <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                        R$ {financialRevertBatchItems.filter(i => i.selected).reduce((sum, i) => sum + Number(i.amount || 0), 0).toFixed(2)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1 pt-0.5">
                      O(s) valor(es) selecionado(s) voltará(ão) a constar como pendente em aberto para <strong>{financialRevertTarget?.patient_name || 'o paciente'}</strong> nos indicadores e na lista de receitas.
                    </p>
                  </div>
                ) : (
                  /* Cenário 2: Item Unitário */
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>
                      Deseja reverter a quitação de <strong>R$ {Number(financialRevertTarget.amount).toFixed(2)}</strong> referente a <strong>{financialRevertTarget.patient_name || financialRevertTarget.notes || 'lançamento'}</strong>?
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      O valor retornará como pendente na lista de receitas e nos indicadores.
                    </p>
                  </div>
                )}

                {/* Guarda Fiscal 1: AÇÃO IMEDIATA para NFs Solicitadas */}
                {financialRevertBatchItems.some(i => i.selected && (i.invoice_status === 'REQUESTED' || i.invoice_status === 'PENDING_DISPATCH')) && (
                  <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200 font-bold">
                      <Zap className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      <span>Ação Imediata: Solicitação de NF em Aberto</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Existe solicitação de Nota Fiscal em andamento para este lançamento. Você pode cancelar a solicitação agora para abortar o envio à prefeitura.
                    </p>
                    <label className="flex items-center gap-2 pt-1 font-semibold text-sky-950 dark:text-sky-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cancelRequestedInvoicesInFinancial}
                        onChange={(e) => setCancelRequestedInvoicesInFinancial(e.target.checked)}
                        className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 border-sky-300 cursor-pointer"
                      />
                      <span>Cancelar solicitação de Nota Fiscal imediatamente (Recomendado)</span>
                    </label>
                  </div>
                )}

                {/* Guarda Fiscal 2: Alerta para NFs já Emitidas na Prefeitura */}
                {financialRevertBatchItems.some(i => i.selected && i.invoice_status === 'ISSUED') && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
                      <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span>Nota Fiscal Já Emitida (Risco Tributário)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      O lançamento selecionado possui Nota Fiscal já autorizada pela prefeitura. A reversão financeira registrará um <strong>Alerta Fiscal</strong> na aba de Notas Fiscais para providências junto à sua contabilidade.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Ações do Modal */}
            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isRevertingFinancial}
                onClick={() => {
                  setFinancialRevertTarget(null);
                  setFinancialRevertBatchItems([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRevertingFinancial || isLoadingFinancialBatch || financialRevertBatchItems.filter(i => i.selected).length === 0}
                onClick={handleExecuteFinancialRevert}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                  financialRevertBatchItems.some(i => i.selected && (i.invoice_status === 'ISSUED' || i.invoice_status === 'REQUESTED' || i.invoice_status === 'PENDING_DISPATCH'))
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRevertingFinancial ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Revertendo...</span>
                  </>
                ) : (
                  <>
                    <Undo2 className="h-3.5 w-3.5" />
                    <span>
                      Confirmar Reversão
                      {financialRevertBatchItems.length > 1 ? ` (${financialRevertBatchItems.filter(i => i.selected).length})` : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso de Cancelamento Fiscal para Contabilidade via WhatsApp */}
      <InvoiceCancelNotifyModal
        isOpen={isInvoiceCancelNotifyOpen}
        onClose={() => setIsInvoiceCancelNotifyOpen(false)}
        patientName={invoiceCancelNotifyData.patientName}
        totalAmount={invoiceCancelNotifyData.totalAmount}
        requestDate={invoiceCancelNotifyData.requestDate}
      />

      {/* Modal de Cancelamento de NF Emitida (Solicitação ao Contador & Baixa Oficial) */}
      <InvoiceCancellationModal
        isOpen={Boolean(selectedInvoiceForCancel)}
        onClose={() => setSelectedInvoiceForCancel(null)}
        onSuccess={() => {
          fetchInvoices();
          fetchTransactions();
          fetchOverviewSessions();
          fetchOverviewEvaluations();
        }}
        invoice={selectedInvoiceForCancel}
        mode={cancellationModalMode}
      />
    </div>
  );
};
