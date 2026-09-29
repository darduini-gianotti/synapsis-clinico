import React, { useState, useEffect, useMemo } from 'react';
import { Patient } from '../../types.js';
import { api } from '../../services/api.js';
import { EvaluationReceiptModal } from './EvaluationReceiptModal.js';
import { InvoiceCancelNotifyModal } from '../fiscal/InvoiceCancelNotifyModal.js';
import {
  DollarSign, TrendingUp, Clock, CheckCircle2,
  AlertCircle, X, CheckSquare, Loader2,
  Calendar, FileText, ChevronDown, ChevronUp,
  ReceiptText, RefreshCw, Brain, Layers, Receipt,
  Undo2, AlertTriangle, Link2, Zap, ShieldAlert,
} from 'lucide-react';

interface PatientFinancialTabProps {
  patient: Patient;
}

interface BatchRevertItem {
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

interface SettleSessionItem {
  id: number;
  start_time: string;
  status: string;
  modality: string;
  price: number;
  payment_status?: string;
  is_future?: boolean;
  selected: boolean;
}

interface UnifiedTransactionItem {
  id: string;
  rawId: number;
  transactionId?: number | null;
  serviceType: 'PSYCHOTHERAPY' | 'EVALUATION';
  title: string;
  evaluationId?: number;
  date: string;
  amount: number;
  payment_status: 'PAID' | 'PENDING';
  is_future: boolean;
  payment_method?: string | null;
  paid_at?: string | null;
  modality: string;
  invoice_id?: number | null;
  invoice_status?: string | null;
  invoice_number?: string | null;
}

const PAYMENT_METHODS = [
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Dinheiro',
  'Transferência Bancária',
  'Boleto',
  'Convênio',
  'Outro',
];

const formatDate = (val: string | null | undefined) => {
  if (!val) return '-';
  try {
    const raw = String(val).trim();
    const datePart = raw.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
};

const formatDateTime = (iso: string) => {
  if (!iso) return '-';
  try {
    const cleanIso = String(iso).replace(' ', 'T');
    const d = new Date(cleanIso);
    if (isNaN(d.getTime())) return formatDate(iso);
    return (
      d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' às ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return formatDate(iso);
  }
};

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const PatientFinancialTab: React.FC<PatientFinancialTabProps> = ({ patient }) => {
  // Navigation Sub-tab: ALL | PSYCHOTHERAPY | EVALUATION
  const [categoryTab, setCategoryTab] = useState<'ALL' | 'PSYCHOTHERAPY' | 'EVALUATION'>('ALL');

  // Loading States
  const [isLoading, setIsLoading] = useState(true);

  // Raw Data from APIs
  const [psychSessions, setPsychSessions] = useState<{ eligible: any[]; paid: any[] }>({ eligible: [], paid: [] });
  const [evaluations, setEvaluations] = useState<any[]>([]);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'3m' | '6m' | '12m' | 'all'>('3m');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');

  // Modal 1: Psychotherapy Settlement
  const [psychSettleOpen, setPsychSettleOpen] = useState(false);
  const [psychSessionsToSettle, setPsychSessionsToSettle] = useState<SettleSessionItem[]>([]);
  const [psychPaidHistory, setPsychPaidHistory] = useState<any[]>([]);
  const [loadPsychSettle, setLoadPsychSettle] = useState(false);
  const [psychSettleError, setPsychSettleError] = useState<string | null>(null);
  const [psychSettleSuccess, setPsychSettleSuccess] = useState<string | null>(null);
  const [psychDate, setPsychDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [psychMethod, setPsychMethod] = useState('PIX');
  const [psychNotes, setPsychNotes] = useState('');
  const [psychRequestNf, setPsychRequestNf] = useState(false);
  const [submittingPsych, setSubmittingPsych] = useState(false);
  const [showPsychPaidHistory, setShowPsychPaidHistory] = useState(false);

  // Modal 2: Evaluation Settlement
  const [evalSettleOpen, setEvalSettleOpen] = useState(false);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<number | null>(null);
  const [evalSettleData, setEvalSettleData] = useState<{
    evaluation: any;
    pending_installments: any[];
    paid_installments: any[];
  } | null>(null);
  const [selectedEvalInstallmentMap, setSelectedEvalInstallmentMap] = useState<Record<number, boolean>>({});
  const [loadEvalSettle, setLoadEvalSettle] = useState(false);
  const [evalSettleError, setEvalSettleError] = useState<string | null>(null);
  const [evalSettleSuccess, setEvalSettleSuccess] = useState<string | null>(null);
  const [evalDate, setEvalDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [evalMethod, setEvalMethod] = useState('PIX');
  const [evalNotes, setEvalNotes] = useState('');
  const [evalRequestNf, setEvalRequestNf] = useState(false);
  const [submittingEval, setSubmittingEval] = useState(false);
  const [showEvalPaidHistory, setShowEvalPaidHistory] = useState(false);

  // Modal 3: Recibo Modal
  const [receiptModal, setReceiptModal] = useState<{
    isOpen: boolean;
    transactionId: number | null;
    evaluationId?: number | null;
  } | null>(null);

  // Modal 4: Reverter Pagamento (com Guarda Fiscal e Lote Inteligente)
  const [revertConfirmTarget, setRevertConfirmTarget] = useState<UnifiedTransactionItem | null>(null);
  const [revertBatchItems, setRevertBatchItems] = useState<BatchRevertItem[]>([]);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [cancelRequestedInvoices, setCancelRequestedInvoices] = useState(true);
  const [isReverting, setIsReverting] = useState(false);
  const [revertToast, setRevertToast] = useState<string | null>(null);

  // Modal 5: Aviso de Cancelamento Fiscal para Contabilidade via WhatsApp
  const [isInvoiceCancelNotifyOpen, setIsInvoiceCancelNotifyOpen] = useState(false);
  const [invoiceCancelNotifyData, setInvoiceCancelNotifyData] = useState<{
    patientName: string;
    totalAmount: number;
    requestDate?: string;
  }>({
    patientName: '',
    totalAmount: 0,
  });

  // ==========================================
  // 1. DATA LOADING
  // ==========================================
  const loadFinancialData = async () => {
    if (patient.id === 0) return;
    try {
      setIsLoading(true);
      const [psychRes, evalRes] = await Promise.all([
        api.get(`/financial/patient-sessions/${patient.id}`).catch(() => ({ data: { sessions: [], paid_sessions: [] } })),
        api.get(`/evaluations/patient/${patient.id}`).catch(() => ({ data: { evaluations: [] } })),
      ]);

      setPsychSessions({
        eligible: psychRes.data.sessions || [],
        paid: psychRes.data.paid_sessions || [],
      });
      setEvaluations(evalRes.data.evaluations || []);
    } catch (err) {
      console.error('Failed to load patient financial records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [patient.id]);

  // ==========================================
  // 2. UNIFIED TRANSACTIONS COMPILATION
  // ==========================================
  const allUnifiedTransactions = useMemo<UnifiedTransactionItem[]>(() => {
    const list: UnifiedTransactionItem[] = [];
    const todayStr = new Date().toISOString().substring(0, 10);

    // 1. Psychotherapy Paid Sessions
    (psychSessions.paid || []).forEach((s: any) => {
      list.push({
        id: `psych-paid-${s.id}`,
        rawId: s.id,
        transactionId: s.transaction_id || s.id,
        serviceType: 'PSYCHOTHERAPY',
        title: 'Sessão de Psicoterapia',
        date: s.start_time,
        amount: Number(s.price || s.transaction_amount || 0),
        payment_status: 'PAID',
        is_future: false,
        payment_method: s.payment_method || null,
        paid_at: s.paid_at || null,
        modality: s.modality === 'ONLINE' ? 'Online' : 'Presencial',
        invoice_id: s.invoice_id || null,
        invoice_status: s.invoice_status || 'NONE',
        invoice_number: s.invoice_number || null,
      });
    });

    // 2. Psychotherapy Pending / Scheduled Sessions
    (psychSessions.eligible || []).forEach((s: any) => {
      list.push({
        id: `psych-elig-${s.id}`,
        rawId: s.id,
        transactionId: s.transaction_id || null,
        serviceType: 'PSYCHOTHERAPY',
        title: s.recurrence_pattern ? `Sessão (${s.recurrence_pattern})` : 'Sessão de Psicoterapia',
        date: s.start_time,
        amount: Number(s.price || 0),
        payment_status: s.payment_status === 'PAID' ? 'PAID' : 'PENDING',
        is_future: Boolean(s.is_future),
        payment_method: s.payment_method || null,
        paid_at: s.paid_at || null,
        modality: s.modality === 'ONLINE' ? 'Online' : 'Presencial',
        invoice_id: s.invoice_id || null,
        invoice_status: s.invoice_status || 'NONE',
        invoice_number: s.invoice_number || null,
      });
    });

    // 3. Evaluation Installments
    (evaluations || []).forEach((ev: any) => {
      const installments = ev.installments || [];
      installments.forEach((inst: any) => {
        const isPaid = inst.status === 'PAID';
        const instDate = inst.transaction_date || (inst.paid_at ? inst.paid_at.substring(0, 10) : todayStr);
        const isFuture = !isPaid && instDate > todayStr;

        list.push({
          id: `eval-inst-${inst.id}`,
          rawId: inst.id,
          transactionId: inst.id,
          serviceType: 'EVALUATION',
          title: inst.installment_number && inst.total_installments
            ? `Parcela ${inst.installment_number}/${inst.total_installments} - ${ev.title || 'Avaliação'}`
            : `Avaliação: ${ev.title || 'Neuropsicológica'}`,
          evaluationId: ev.id,
          date: inst.paid_at || inst.transaction_date || todayStr,
          amount: Number(inst.amount || 0),
          payment_status: isPaid ? 'PAID' : 'PENDING',
          is_future: isFuture,
          payment_method: inst.payment_method || null,
          paid_at: inst.paid_at || null,
          modality: ev.status === 'COMPLETED' ? 'Concluída' : 'Em Andamento',
          invoice_id: inst.invoice_id || null,
          invoice_status: inst.invoice_status || 'NONE',
          invoice_number: inst.invoice_number || null,
        });
      });
    });

    // Sort ascending by date (iniciando pela data mais antiga)
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [psychSessions, evaluations]);

  // Counts for Subtabs
  const counts = useMemo(() => {
    const psychCount = allUnifiedTransactions.filter((t) => t.serviceType === 'PSYCHOTHERAPY').length;
    const evalCount = allUnifiedTransactions.filter((t) => t.serviceType === 'EVALUATION').length;
    return {
      all: allUnifiedTransactions.length,
      psych: psychCount,
      eval: evalCount,
    };
  }, [allUnifiedTransactions]);

  // Filtered by Category Tab, Period, and Status
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const cutoffs: Record<string, Date | null> = {
      '3m': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
      '6m': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
      '12m': new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
      all: null,
    };
    const cutoff = cutoffs[periodFilter];

    return allUnifiedTransactions.filter((item) => {
      if (categoryTab === 'PSYCHOTHERAPY' && item.serviceType !== 'PSYCHOTHERAPY') return false;
      if (categoryTab === 'EVALUATION' && item.serviceType !== 'EVALUATION') return false;
      if (cutoff && new Date(item.date) < cutoff) return false;
      if (statusFilter === 'PAID' && item.payment_status !== 'PAID') return false;
      if (statusFilter === 'PENDING' && item.payment_status === 'PAID') return false;
      return true;
    });
  }, [allUnifiedTransactions, categoryTab, periodFilter, statusFilter]);

  // ==========================================
  // 3. REACTIVE KPIS (Scoped by Category Tab)
  // ==========================================
  const kpis = useMemo(() => {
    const scopedList = allUnifiedTransactions.filter((item) => {
      if (categoryTab === 'PSYCHOTHERAPY' && item.serviceType !== 'PSYCHOTHERAPY') return false;
      if (categoryTab === 'EVALUATION' && item.serviceType !== 'EVALUATION') return false;
      return true;
    });

    const paidList = scopedList.filter((item) => item.payment_status === 'PAID');
    const pendingNonFuture = scopedList.filter((item) => item.payment_status !== 'PAID' && !item.is_future);
    const futureList = scopedList.filter((item) => item.payment_status !== 'PAID' && item.is_future);

    const totalPaid = paidList.reduce((acc, item) => acc + item.amount, 0);
    const totalPending = pendingNonFuture.reduce((acc, item) => acc + item.amount, 0);
    const futureTotal = futureList.reduce((acc, item) => acc + item.amount, 0);
    const expected = totalPaid + totalPending;
    const adimplencia = expected > 0 ? Math.round((totalPaid / expected) * 100) : 100;

    return {
      totalPaid,
      paidCount: paidList.length,
      totalPending,
      pendingCount: pendingNonFuture.length,
      adimplencia,
      futureTotal,
      futureCount: futureList.length,
    };
  }, [allUnifiedTransactions, categoryTab]);

  const pendingPsychCount = useMemo(() => {
    return (psychSessions.eligible || []).filter((s: any) => !s.is_future && s.payment_status !== 'PAID').length;
  }, [psychSessions]);

  const pendingEvalCount = useMemo(() => {
    let count = 0;
    (evaluations || []).forEach((ev: any) => {
      (ev.installments || []).forEach((i: any) => {
        if (i.status !== 'PAID') count++;
      });
    });
    return count;
  }, [evaluations]);

  // ==========================================
  // 4. PSYCHOTHERAPY SETTLE MODAL HANDLERS
  // ==========================================
  const openPsychSettle = async (preselectedSessionId?: number) => {
    setPsychSettleOpen(true);
    setPsychSettleError(null);
    setPsychSettleSuccess(null);
    setPsychNotes('');
    setPsychRequestNf(false);
    setShowPsychPaidHistory(false);
    setPsychDate(new Date().toISOString().substring(0, 10));
    setPsychMethod('PIX');

    try {
      setLoadPsychSettle(true);
      const res = await api.get(`/financial/patient-sessions/${patient.id}`);
      const list: SettleSessionItem[] = (res.data.sessions || []).map((s: any) => ({
        ...s,
        selected: preselectedSessionId ? s.id === preselectedSessionId : !s.is_future,
      }));
      if (list.length > 0 && !list.some((s) => s.selected)) {
        list[0].selected = true;
      }
      setPsychSessionsToSettle(list);
      setPsychPaidHistory(res.data.paid_sessions || []);
    } catch (err: any) {
      setPsychSettleError(err.response?.data?.error || 'Erro ao carregar sessões de psicoterapia.');
    } finally {
      setLoadPsychSettle(false);
    }
  };

  const selectedPsychSessions = psychSessionsToSettle.filter((s) => s.selected);
  const totalPsychSettleAmount = selectedPsychSessions.reduce((s, t) => s + Number(t.price || 0), 0);
  const pendingPsychList = psychSessionsToSettle.filter((s) => !s.is_future);
  const futurePsychList = psychSessionsToSettle.filter((s) => s.is_future);

  const togglePsychSession = (id: number) => {
    setPsychSessionsToSettle((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const selectAllPsych = (list: SettleSessionItem[], val: boolean) => {
    const ids = new Set(list.map((s) => s.id));
    setPsychSessionsToSettle((prev) =>
      prev.map((s) => (ids.has(s.id) ? { ...s, selected: val } : s))
    );
  };

  const changePsychAmount = (id: number, val: string) => {
    setPsychSessionsToSettle((prev) =>
      prev.map((s) => (s.id === id ? { ...s, price: Number(val) } : s))
    );
  };

  const submitPsychSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPsychSessions.length === 0) {
      setPsychSettleError('Selecione pelo menos uma sessão para dar baixa.');
      return;
    }
    try {
      setSubmittingPsych(true);
      setPsychSettleError(null);
      await api.post('/financial/settle', {
        patient_id: patient.id,
        payment_date: psychDate,
        payment_method: psychMethod,
        notes: psychNotes.trim(),
        settlements: selectedPsychSessions.map((s) => ({ session_id: s.id, amount: Number(s.price) })),
      });

      if (psychRequestNf) {
        try {
          await api.post('/invoices', {
            patient_id: patient.id,
            session_ids: selectedPsychSessions.map((s) => s.id),
            notes: psychNotes.trim(),
            status: 'PENDING_DISPATCH',
          });
        } catch {
          // non-blocking
        }
      }

      setPsychSettleSuccess(`Baixa de ${selectedPsychSessions.length} sessão(ões) realizada com sucesso!`);
      await loadFinancialData();
      setTimeout(() => {
        setPsychSettleOpen(false);
        setPsychSettleSuccess(null);
      }, 1200);
    } catch (err: any) {
      setPsychSettleError(err.response?.data?.error || 'Erro ao processar baixa de psicoterapia.');
    } finally {
      setSubmittingPsych(false);
    }
  };

  // ==========================================
  // 5. EVALUATION SETTLE MODAL HANDLERS
  // ==========================================
  const openEvalSettleForEvaluation = async (evalId: number, preselectedTxId?: number) => {
    setSelectedEvaluationId(evalId);
    setEvalSettleOpen(true);
    setEvalSettleError(null);
    setEvalSettleSuccess(null);
    setEvalNotes('');
    setEvalRequestNf(false);
    setShowEvalPaidHistory(false);
    setEvalDate(new Date().toISOString().substring(0, 10));
    setEvalMethod('PIX');

    try {
      setLoadEvalSettle(true);
      const res = await api.get(`/financial/evaluation-installments/${evalId}`);
      setEvalSettleData(res.data);

      const pendingList: any[] = res.data.pending_installments || [];
      const map: Record<number, boolean> = {};
      if (preselectedTxId) {
        map[preselectedTxId] = true;
      } else if (pendingList.length > 0) {
        // Se abriu pelo botão geral do topo, pré-seleciona apenas a primeira parcela pendente
        map[pendingList[0].id] = true;
      }
      setSelectedEvalInstallmentMap(map);

      if (res.data.evaluation?.payment_method) {
        const pm = res.data.evaluation.payment_method;
        if (pm === 'CARTAO') setEvalMethod('Cartão de Crédito');
        else if (pm === 'DINHEIRO') setEvalMethod('Dinheiro');
        else if (pm === 'BOLETO') setEvalMethod('Boleto');
        else setEvalMethod(pm || 'PIX');
      }
    } catch (err: any) {
      setEvalSettleError(err.response?.data?.error || 'Erro ao carregar parcelas da avaliação.');
    } finally {
      setLoadEvalSettle(false);
    }
  };

  const openEvalSettle = () => {
    const evalWithPending = (evaluations || []).find((ev: any) =>
      (ev.installments || []).some((i: any) => i.status !== 'PAID')
    );
    const targetId = evalWithPending?.id || evaluations[0]?.id;
    if (targetId) {
      const firstPending = (evalWithPending?.installments || []).find((i: any) => i.status !== 'PAID');
      openEvalSettleForEvaluation(targetId, firstPending?.id);
    } else {
      alert('Nenhuma avaliação neuropsicológica encontrada para este paciente.');
    }
  };

  const toggleEvalInstallment = (id: number) => {
    setSelectedEvalInstallmentMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selectAllEval = (val: boolean) => {
    const next: Record<number, boolean> = {};
    if (val && evalSettleData?.pending_installments) {
      evalSettleData.pending_installments.forEach((inst: any) => {
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

  const submitEvalSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalSettleData?.evaluation) {
      setEvalSettleError('Nenhuma avaliação selecionada.');
      return;
    }
    if (selectedEvalInstallments.length === 0) {
      setEvalSettleError('Selecione pelo menos uma parcela para quitação.');
      return;
    }

    try {
      setSubmittingEval(true);
      setEvalSettleError(null);
      await api.post('/financial/settle-evaluation-installments', {
        evaluation_id: evalSettleData.evaluation.id,
        payment_date: evalDate,
        payment_method: evalMethod,
        notes: evalNotes.trim(),
        settlements: selectedEvalInstallments.map((inst: any) => ({
          transaction_id: inst.id,
          amount: Number(inst.amount),
        })),
      });

      if (evalRequestNf) {
        try {
          await api.post('/invoices', {
            patient_id: patient.id,
            evaluation_transaction_ids: selectedEvalInstallments.map((inst: any) => inst.id),
            notes: evalNotes.trim(),
            status: 'PENDING_DISPATCH',
          });
        } catch {
          // non-blocking
        }
      }

      setEvalSettleSuccess(`Baixa de ${selectedEvalInstallments.length} parcela(s) registrada com sucesso!`);
      await loadFinancialData();
      setTimeout(() => {
        setEvalSettleOpen(false);
        setEvalSettleSuccess(null);
      }, 1200);
    } catch (err: any) {
      setEvalSettleError(err.response?.data?.error || 'Erro ao registrar baixa de parcelas.');
    } finally {
      setSubmittingEval(false);
    }
  };

  // ==========================================
  // 6. REVERSÃO DE PAGAMENTO (COM GUARDA FISCAL E LOTE INTELIGENTE)
  // ==========================================
  const handleOpenRevertModal = async (item: UnifiedTransactionItem) => {
    setRevertConfirmTarget(item);
    setIsLoadingBatch(true);
    setCancelRequestedInvoices(true);

    const txId = item.transactionId || item.rawId;
    try {
      const res = await api.get(`/financial/transactions/${txId}/batch`);
      const batchData = res.data;
      if (batchData.items && batchData.items.length > 0) {
        setRevertBatchItems(
          batchData.items.map((it: any) => ({
            ...it,
            selected: true,
          }))
        );
      } else {
        setRevertBatchItems([{
          id: txId,
          session_id: item.serviceType === 'PSYCHOTHERAPY' ? item.rawId : null,
          evaluation_id: item.serviceType === 'EVALUATION' ? (item.evaluationId || null) : null,
          amount: item.amount,
          title: item.title,
          date: item.date,
          invoice_id: item.invoice_id || null,
          invoice_status: item.invoice_status || 'NONE',
          invoice_number: item.invoice_number || null,
          selected: true,
        }]);
      }
    } catch (e) {
      setRevertBatchItems([{
        id: txId,
        session_id: item.serviceType === 'PSYCHOTHERAPY' ? item.rawId : null,
        evaluation_id: item.serviceType === 'EVALUATION' ? (item.evaluationId || null) : null,
        amount: item.amount,
        title: item.title,
        date: item.date,
        invoice_id: item.invoice_id || null,
        invoice_status: item.invoice_status || 'NONE',
        invoice_number: item.invoice_number || null,
        selected: true,
      }]);
    } finally {
      setIsLoadingBatch(false);
    }
  };

  const handleToggleBatchItem = (id: number) => {
    setRevertBatchItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleSelectAllBatch = (select: boolean) => {
    setRevertBatchItems((prev) => prev.map((i) => ({ ...i, selected: select })));
  };

  const handleExecuteRevert = async () => {
    const selectedBatch = revertBatchItems.filter((i) => i.selected);
    if (selectedBatch.length === 0) {
      alert('Selecione ao menos um lançamento para reverter.');
      return;
    }

    const hasRequestedInvoices = selectedBatch.some(
      (i) => i.invoice_status === 'REQUESTED' || i.invoice_status === 'PENDING_DISPATCH'
    );
    const totalAmountForNotice = selectedBatch.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const dateForNotice = selectedBatch[0]?.date || new Date().toISOString();

    try {
      setIsReverting(true);
      const res = await api.post('/financial/transactions/revert-batch', {
        transaction_ids: selectedBatch.map((i) => i.id),
        cancel_requested_invoices: cancelRequestedInvoices,
      });

      const warnMsg = res.data.warning ? ` (${res.data.warning})` : '';
      setRevertToast(`Pagamento de ${selectedBatch.length} item(ns) revertido com sucesso!${warnMsg}`);
      setRevertConfirmTarget(null);
      setRevertBatchItems([]);
      await loadFinancialData();
      setTimeout(() => setRevertToast(null), 6000);

      // Encadeamento automático: se cancelou NF solicitada, abre o modal de aviso para a contabilidade via WhatsApp
      if (cancelRequestedInvoices && hasRequestedInvoices) {
        setInvoiceCancelNotifyData({
          patientName: patient?.full_name || 'Paciente',
          totalAmount: totalAmountForNotice,
          requestDate: dateForNotice,
        });
        setIsInvoiceCancelNotifyOpen(true);
      }
    } catch (err: any) {
      console.error('Failed to revert payment:', err);
      alert(err.response?.data?.error || 'Erro ao reverter status do pagamento.');
    } finally {
      setIsReverting(false);
    }
  };

  // Guard: New Patient
  if (patient.id === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <DollarSign className="h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm">Salve o paciente primeiro para ver o histórico financeiro.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ── Feedback Toast de Reversão ── */}
      {revertToast && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{revertToast}</span>
          </div>
          <button type="button" onClick={() => setRevertToast(null)} className="p-1 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 rounded-lg cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Sub-Aba: Todos | Psicoterapia | Avaliação Neuropsicológica ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCategoryTab('ALL')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              categoryTab === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Todos os Lançamentos</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryTab('PSYCHOTHERAPY')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              categoryTab === 'PSYCHOTHERAPY'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Psicoterapia</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 font-semibold">
              {counts.psych}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryTab('EVALUATION')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              categoryTab === 'EVALUATION'
                ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Brain className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span>Avaliação Neuropsicológica</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 font-semibold">
              {counts.eval}
            </span>
          </button>
        </div>

        {/* Global Refresh Button */}
        <button
          type="button"
          onClick={loadFinancialData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
          title="Atualizar dados financeiros"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {/* ── KPI Cards (Scoped by active sub-tab) ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm font-medium">Carregando indicadores financeiros...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Quitado */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                Total Quitado
              </span>
            </div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(kpis.totalPaid)}
            </div>
            <span className="text-[10px] text-slate-400">
              {kpis.paidCount} lançamento(s) recebido(s)
            </span>
          </div>

          {/* Em Aberto */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                Em Aberto
              </span>
            </div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">
              {formatCurrency(kpis.totalPending)}
            </div>
            <span className="text-[10px] text-slate-400">
              {kpis.pendingCount} pendência(s) a receber
            </span>
          </div>

          {/* Adimplência */}
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                Adimplência
              </span>
            </div>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {kpis.adimplencia}%
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40">
              <div
                className="h-1.5 rounded-full bg-indigo-500 transition-all"
                style={{ width: `${kpis.adimplencia}%` }}
              />
            </div>
          </div>

          {/* Futuro Estimado */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Futuro Estimado
              </span>
            </div>
            <div className="text-xl font-black text-slate-700 dark:text-slate-200">
              {formatCurrency(kpis.futureTotal)}
            </div>
            <span className="text-[10px] text-slate-400">
              {kpis.futureCount} lançamento(s) futuro(s)
            </span>
          </div>
        </div>
      )}

      {/* ── Tabela de Lançamentos com Filtros e Ações ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {categoryTab === 'ALL' && 'Histórico Geral de Lançamentos'}
              {categoryTab === 'PSYCHOTHERAPY' && 'Atendimentos de Psicoterapia'}
              {categoryTab === 'EVALUATION' && 'Contratos de Avaliação Neuropsicológica'}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Period Filter */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
              {(['3m', '6m', '12m', 'all'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodFilter(p)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                    periodFilter === p
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {p === 'all' ? 'Todos' : p}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-[11px] font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Todos os Status</option>
              <option value="PAID">Pagos</option>
              <option value="PENDING">Pendentes</option>
            </select>

            {/* Botões de Baixa por Serviço */}
            {(categoryTab === 'ALL' || categoryTab === 'PSYCHOTHERAPY') && pendingPsychCount > 0 && (
              <button
                type="button"
                data-help-id="patient-quick-settle"
                onClick={openPsychSettle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
                title="Dar baixa em sessões de psicoterapia pendentes"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>Dar Baixa Psicoterapia ({pendingPsychCount})</span>
              </button>
            )}

            {(categoryTab === 'ALL' || categoryTab === 'EVALUATION') && pendingEvalCount > 0 && (
              <button
                type="button"
                data-help-id="patient-quick-settle"
                onClick={openEvalSettle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
                title="Dar baixa em parcelas de avaliação neuropsicológica pendentes"
              >
                <Brain className="h-3.5 w-3.5" />
                <span>Dar Baixa Avaliação ({pendingEvalCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs">Carregando lançamentos...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <DollarSign className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">Nenhum lançamento encontrado no período ou filtro selecionado.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[320px]">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 select-none">
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left px-4 py-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-500 dark:text-slate-400">Data</th>
                  <th className="text-left px-4 py-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-500 dark:text-slate-400">Tipo</th>
                  <th className="text-left px-4 py-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-500 dark:text-slate-400">Descrição / Atendimento</th>
                  <th className="text-right px-4 py-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-500 dark:text-slate-400">Valor</th>
                  <th className="text-left px-4 py-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-left px-4 py-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-500 dark:text-slate-400">Forma Pgto.</th>
                  <th className="text-left px-4 py-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-500 dark:text-slate-400">Pago em</th>
                  <th className="text-right px-4 py-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-500 dark:text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((item) => {
                  const isPaid = item.payment_status === 'PAID';
                  const isFuture = item.is_future;
                  const hasActiveInvoice = item.invoice_status === 'ISSUED' || item.invoice_status === 'REQUESTED' || item.invoice_status === 'PENDING_DISPATCH';

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition"
                    >
                      {/* Data */}
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {formatDate(item.date)}
                        {isFuture && (
                          <span className="ml-1.5 text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-full">
                            FUTURO
                          </span>
                        )}
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {item.serviceType === 'PSYCHOTHERAPY' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            <Calendar className="h-2.5 w-2.5" />
                            Psicoterapia
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <Brain className="h-2.5 w-2.5" />
                            Avaliação
                          </span>
                        )}
                      </td>

                      {/* Descrição */}
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 max-w-xs truncate">
                        <div className="font-medium text-xs flex items-center gap-1.5">
                          <span>{item.title}</span>
                          {hasActiveInvoice && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                              title={`Nota Fiscal: ${item.invoice_number || 'Solicitada'} (${item.invoice_status})`}
                            >
                              NF
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">{item.modality}</div>
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Pago
                          </span>
                        ) : isFuture ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                            <Calendar className="h-2.5 w-2.5" />
                            Agendado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            <Clock className="h-2.5 w-2.5" />
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* Forma Pgto */}
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {item.payment_method || '-'}
                      </td>

                      {/* Pago em (Tratamento seguro sem Invalid Date) */}
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {item.paid_at ? formatDate(item.paid_at) : '-'}
                      </td>

                      {/* Ações: Recibo + Reverter (Opção A) */}
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {isPaid ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botão Recibo */}
                            <button
                              type="button"
                              onClick={() =>
                                setReceiptModal({
                                  isOpen: true,
                                  transactionId: item.transactionId || item.rawId,
                                  evaluationId: item.evaluationId || null,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:hover:bg-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-800 cursor-pointer"
                              title="Emitir Recibo Profissional com Selo Digital"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>Recibo</span>
                            </button>

                            {/* Botão Reverter */}
                            <button
                              type="button"
                              onClick={() => handleOpenRevertModal(item)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                              title="Reverter pagamento para Pendente"
                            >
                              <Undo2 className="h-3 w-3 text-slate-400" />
                              <span>Reverter</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (item.serviceType === 'PSYCHOTHERAPY') {
                                openPsychSettle(item.rawId);
                              } else if (item.evaluationId) {
                                openEvalSettleForEvaluation(item.evaluationId, item.rawId);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              item.serviceType === 'PSYCHOTHERAPY'
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300'
                            }`}
                          >
                            Dar Baixa
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer */}
        {filteredTransactions.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-800/20">
            <span>{filteredTransactions.length} registro(s) exibido(s)</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Total: {formatCurrency(filteredTransactions.reduce((s, t) => s + t.amount, 0))}
            </span>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: CONFIRMAÇÃO DE REVERSÃO COM GUARDA FISCAL E LOTE INTELIGENTE */}
      {/* ========================================================= */}
      {revertConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            {/* Header com Guarda Fiscal */}
            {revertBatchItems.some(i => i.selected && (i.invoice_status === 'ISSUED' || i.invoice_status === 'REQUESTED' || i.invoice_status === 'PENDING_DISPATCH')) ? (
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

            {isLoadingBatch ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                <span className="text-xs">Analisando lote e vínculos fiscais...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cenário 1: Pagamento em Lote Conjunto */}
                {revertBatchItems.length > 1 ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold">
                          <Link2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Pagamento Realizado em Lote Conjunto</span>
                        </div>
                        {patient?.full_name && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold text-[10px]">
                            Paciente
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed">
                        Deseja reverter a quitação de lançamentos referente a <strong>{patient?.full_name || 'paciente'}</strong>?
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        Identificamos que este pagamento foi baixado simultaneamente com outros <strong>{revertBatchItems.length - 1} item(ns)</strong> em lote. Selecione quais deseja reverter:
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs px-1">
                      <button
                        type="button"
                        onClick={() => handleSelectAllBatch(!revertBatchItems.every(i => i.selected))}
                        className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                      >
                        {revertBatchItems.every(i => i.selected) ? 'Desmarcar Todos' : 'Selecionar Todo o Lote'}
                      </button>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {revertBatchItems.filter(i => i.selected).length} de {revertBatchItems.length} selecionado(s)
                      </span>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 max-h-48 overflow-y-auto">
                      {revertBatchItems.map((item) => (
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
                              onChange={() => handleToggleBatchItem(item.id)}
                              className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {item.title}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {item.date ? formatDate(item.date) : '-'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {formatCurrency(item.amount)}
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
                        {formatCurrency(
                          revertBatchItems.filter(i => i.selected).reduce((sum, i) => sum + Number(i.amount || 0), 0)
                        )}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1 pt-0.5">
                      O(s) valor(es) selecionado(s) voltará(ão) a constar como pendente em aberto para <strong>{patient?.full_name || 'o paciente'}</strong> nos indicadores da clínica.
                    </p>
                  </div>
                ) : (
                  /* Cenário 2: Item Unitário */
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>
                      Deseja reverter a quitação de <strong>{formatCurrency(revertConfirmTarget.amount)}</strong> referente a <strong>{patient?.full_name || revertConfirmTarget.title}</strong>?
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      O valor retornará para a lista de pagamentos pendentes nos indicadores da clínica.
                    </p>
                  </div>
                )}

                {/* Guarda Fiscal 1: AÇÃO IMEDIATA para NFs Solicitadas */}
                {revertBatchItems.some(i => i.selected && (i.invoice_status === 'REQUESTED' || i.invoice_status === 'PENDING_DISPATCH')) && (
                  <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200 font-bold">
                      <Zap className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      <span>Ação Imediata: Solicitação de NF em Aberto</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Existe solicitação de Nota Fiscal aguardando envio/processamento para este lançamento. Você pode cancelar a solicitação agora mesmo para abortar a emissão na prefeitura.
                    </p>
                    <label className="flex items-center gap-2 pt-1 font-semibold text-sky-950 dark:text-sky-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cancelRequestedInvoices}
                        onChange={(e) => setCancelRequestedInvoices(e.target.checked)}
                        className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 border-sky-300 cursor-pointer"
                      />
                      <span>Cancelar solicitação de Nota Fiscal imediatamente (Recomendado)</span>
                    </label>
                  </div>
                )}

                {/* Guarda Fiscal 2: Alerta para NFs já Emitidas na Prefeitura */}
                {revertBatchItems.some(i => i.selected && i.invoice_status === 'ISSUED') && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
                      <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span>Nota Fiscal Já Emitida (Risco Tributário)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      O lançamento selecionado possui Nota Fiscal já autorizada pela prefeitura. A reversão financeira não cancela a NF na prefeitura automaticamente, mas registrará um <strong>Alerta Fiscal</strong> na aba de Notas Fiscais para providências junto à sua contabilidade.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Ações do Modal */}
            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isReverting}
                onClick={() => {
                  setRevertConfirmTarget(null);
                  setRevertBatchItems([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isReverting || isLoadingBatch || revertBatchItems.filter(i => i.selected).length === 0}
                onClick={handleExecuteRevert}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                  revertBatchItems.some(i => i.selected && (i.invoice_status === 'ISSUED' || i.invoice_status === 'REQUESTED' || i.invoice_status === 'PENDING_DISPATCH'))
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isReverting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Revertendo...</span>
                  </>
                ) : (
                  <>
                    <Undo2 className="h-3.5 w-3.5" />
                    <span>
                      Confirmar Reversão
                      {revertBatchItems.length > 1 ? ` (${revertBatchItems.filter(i => i.selected).length})` : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: DAR BAIXA DE PSICOTERAPIA (Tema Esmeralda / Teal)  */}
      {/* ========================================================= */}
      {psychSettleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[94vh] flex flex-col my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Dar Baixa de Pagamento de Sessões de Psicoterapia
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecione as sessões quitadas (pendentes e/ou futuras) e confirme o recebimento.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPsychSettleOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {patient.full_name}
              </span>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                {patient.cpf && <span>CPF: {patient.cpf}</span>}
                {patient.phone && <span>• {patient.phone}</span>}
              </div>
            </div>

            {psychSettleError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                {psychSettleError}
              </div>
            )}
            {psychSettleSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {psychSettleSuccess}
              </div>
            )}

            <form onSubmit={submitPsychSettle} className="flex flex-col gap-4 mt-4 overflow-y-auto flex-1 min-h-0">
              {loadPsychSettle ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Carregando sessões...</span>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto pr-1">
                  {/* Pending Sessions */}
                  {pendingPsychList.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          Sessões Pendentes ({pendingPsychList.length})
                        </h4>
                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => selectAllPsych(pendingPsychList, true)}
                            className="text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer"
                          >
                            Selecionar todas
                          </button>
                          <span className="text-slate-400">•</span>
                          <button
                            type="button"
                            onClick={() => selectAllPsych(pendingPsychList, false)}
                            className="text-slate-500 hover:underline cursor-pointer"
                          >
                            Desmarcar
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {pendingPsychList.map((s) => (
                          <label
                            key={s.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                              s.selected
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={s.selected}
                              onChange={() => togglePsychSession(s.id)}
                              className="rounded accent-emerald-600 cursor-pointer"
                            />
                            <span className="flex-1 text-xs text-slate-700 dark:text-slate-200 font-medium">
                              {formatDateTime(s.start_time)}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              Pendente
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {s.modality === 'ONLINE' ? 'Online' : 'Presencial'}
                            </span>
                            <div className="flex items-center gap-1 text-xs shrink-0">
                              <span className="text-slate-500 dark:text-slate-400">R$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={s.price}
                                onChange={(e) => changePsychAmount(s.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-800 dark:text-white text-right focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Future Sessions */}
                  {futurePsychList.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          Sessões Futuras Recorrentes ({futurePsychList.length})
                        </h4>
                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => selectAllPsych(futurePsychList, true)}
                            className="text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer"
                          >
                            Selecionar todas
                          </button>
                          <span className="text-slate-400">•</span>
                          <button
                            type="button"
                            onClick={() => selectAllPsych(futurePsychList, false)}
                            className="text-slate-500 hover:underline cursor-pointer"
                          >
                            Desmarcar
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {futurePsychList.map((s) => (
                          <label
                            key={s.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                              s.selected
                                ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={s.selected}
                              onChange={() => togglePsychSession(s.id)}
                              className="rounded accent-indigo-600 cursor-pointer"
                            />
                            <span className="flex-1 text-xs text-slate-700 dark:text-slate-200 font-medium">
                              {formatDateTime(s.start_time)}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                              Futuro
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {s.modality === 'ONLINE' ? 'Online' : 'Presencial'}
                            </span>
                            <div className="flex items-center gap-1 text-xs shrink-0">
                              <span className="text-slate-500 dark:text-slate-400">R$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={s.price}
                                onChange={(e) => changePsychAmount(s.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-800 dark:text-white text-right focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Paid History Collapsible */}
                  {psychPaidHistory.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowPsychPaidHistory(!showPsychPaidHistory)}
                        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold cursor-pointer transition"
                      >
                        {showPsychPaidHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        Ver histórico de sessões já pagas ({psychPaidHistory.length})
                      </button>
                      {showPsychPaidHistory && (
                        <div className="mt-2 space-y-1.5">
                          {psychPaidHistory.map((s: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/10 text-xs text-slate-500 dark:text-slate-400"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="flex-1">{formatDateTime(s.start_time)}</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(Number(s.price || s.transaction_amount || 0))}
                              </span>
                              <span>{s.payment_method || ''}</span>
                              {s.paid_at && <span>• {formatDate(s.paid_at)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {pendingPsychList.length === 0 && futurePsychList.length === 0 && (
                    <div className="flex flex-col items-center py-8 text-slate-400">
                      <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-400" />
                      <p className="text-sm font-medium">Nenhuma sessão pendente de pagamento.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Totalizer */}
              {selectedPsychSessions.length > 0 && (
                <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-between text-xs shrink-0">
                  <div>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                      SESSÕES SELECIONADAS PARA BAIXA
                    </p>
                    <p className="text-emerald-200 mt-0.5">
                      {selectedPsychSessions.length} sessão(ões) marcada(s) para quitação
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-400">Valor Total:</p>
                    <p className="text-xl font-black text-emerald-400">{formatCurrency(totalPsychSettleAmount)}</p>
                  </div>
                </div>
              )}

              {(pendingPsychList.length > 0 || futurePsychList.length > 0) && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Data do Pagamento *
                      </label>
                      <input
                        type="date"
                        required
                        value={psychDate}
                        onChange={(e) => setPsychDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Forma de Pagamento *
                      </label>
                      <select
                        required
                        value={psychMethod}
                        onChange={(e) => setPsychMethod(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Observação
                      </label>
                      <input
                        type="text"
                        value={psychNotes}
                        onChange={(e) => setPsychNotes(e.target.value)}
                        placeholder="Ex: Quitação pacote mensal"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* NF Checkbox */}
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/20 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={psychRequestNf}
                      onChange={(e) => setPsychRequestNf(e.target.checked)}
                      className="rounded accent-teal-600 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="text-xs font-semibold text-teal-800 dark:text-teal-200">
                        Solicitar emissão de Nota Fiscal à Contabilidade após salvar
                      </span>
                    </div>
                  </label>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setPsychSettleOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                {(pendingPsychList.length > 0 || futurePsychList.length > 0) && (
                  <button
                    type="submit"
                    disabled={submittingPsych || selectedPsychSessions.length === 0}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>
                      {submittingPsych
                        ? 'Salvando Baixa...'
                        : `Salvar Baixa (${selectedPsychSessions.length} sessões - ${formatCurrency(totalPsychSettleAmount)})`}
                    </span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: DAR BAIXA DE AVALIAÇÃO NEUROPSICOLÓGICA (Purple)   */}
      {/* ========================================================= */}
      {evalSettleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[94vh] flex flex-col my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Dar Baixa de Avaliação Neuropsicológica
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecione as parcelas do contrato quitadas e confirme o recebimento.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEvalSettleOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Evaluation Selector if patient has more than 1 evaluation */}
            {evaluations.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  Selecionar Contrato:
                </label>
                <select
                  value={selectedEvaluationId || evaluations[0]?.id}
                  onChange={(e) => openEvalSettleForEvaluation(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer"
                >
                  {evaluations.map((ev: any) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title || 'Avaliação Neuropsicológica'} - {formatCurrency(Number(ev.total_price))} ({ev.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Evaluation Summary Card */}
            {evalSettleData?.evaluation && (
              <div className="mt-3 p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
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
                      <span className="font-semibold">Paciente:</span> {patient.full_name}
                      {patient.cpf && <span> • CPF: {patient.cpf}</span>}
                    </div>
                  </div>
                  <div className="text-right sm:border-l sm:border-purple-200 sm:dark:border-purple-800/60 sm:pl-4">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                      Contrato Total:
                    </span>
                    <span className="font-bold text-base text-purple-900 dark:text-purple-200">
                      {formatCurrency(Number(evalSettleData.evaluation.contract_value || evalSettleData.evaluation.total_price))}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      em {evalSettleData.evaluation.installments_count || 1}x ({evalSettleData.evaluation.payment_mode || 'PARCELADO'})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {evalSettleError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                {evalSettleError}
              </div>
            )}
            {evalSettleSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {evalSettleSuccess}
              </div>
            )}

            <form onSubmit={submitEvalSettle} className="flex flex-col gap-4 mt-4 overflow-y-auto flex-1 min-h-0">
              {loadEvalSettle ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Carregando parcelas da avaliação...</span>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto pr-1">
                  {/* Pending Installments */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-purple-600" />
                        Parcelas Pendentes de Quitação ({evalSettleData?.pending_installments?.length || 0})
                      </h4>
                      {evalSettleData?.pending_installments && evalSettleData.pending_installments.length > 1 && (
                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => selectAllEval(true)}
                            className="text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer"
                          >
                            Selecionar todas
                          </button>
                          <span className="text-slate-400">•</span>
                          <button
                            type="button"
                            onClick={() => selectAllEval(false)}
                            className="text-slate-500 hover:underline cursor-pointer"
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
                          return (
                            <label
                              key={inst.id}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
                                  : 'border-slate-200 hover:border-purple-300 bg-white dark:border-slate-700 dark:bg-slate-800'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleEvalInstallment(inst.id)}
                                className="h-4 w-4 rounded accent-purple-600 cursor-pointer"
                              />
                              <div className="flex-1">
                                <div className="font-bold text-xs text-slate-800 dark:text-white">
                                  {inst.installment_number && inst.total_installments
                                    ? `Parcela ${inst.installment_number} de ${inst.total_installments}`
                                    : 'Parcela'}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Vencimento programado: {formatDate(inst.transaction_date)}
                                </div>
                              </div>
                              <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                                {formatCurrency(Number(inst.amount))}
                              </span>
                            </label>
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
                                  • Paga em {formatDate(pi.paid_at || pi.transaction_date)} ({pi.payment_method || '-'})
                                </span>
                              </div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatCurrency(Number(pi.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Totalizer */}
              {selectedEvalInstallments.length > 0 && (
                <div className="p-3 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-between text-xs shrink-0">
                  <div>
                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                      PARCELAS SELECIONADAS PARA BAIXA
                    </p>
                    <p className="text-purple-200 mt-0.5">
                      {selectedEvalInstallments.length} parcela(s) marcada(s) para quitação
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-purple-400">Valor Total:</p>
                    <p className="text-xl font-black text-purple-400">{formatCurrency(totalEvalSettleAmount)}</p>
                  </div>
                </div>
              )}

              {evalSettleData?.pending_installments && evalSettleData.pending_installments.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Data do Pagamento *
                      </label>
                      <input
                        type="date"
                        required
                        value={evalDate}
                        onChange={(e) => setEvalDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Forma de Pagamento *
                      </label>
                      <select
                        required
                        value={evalMethod}
                        onChange={(e) => setEvalMethod(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Observação
                      </label>
                      <input
                        type="text"
                        value={evalNotes}
                        onChange={(e) => setEvalNotes(e.target.value)}
                        placeholder="Ex: Quitação parcela de avaliação"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* NF Checkbox */}
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/20 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={evalRequestNf}
                      onChange={(e) => setEvalRequestNf(e.target.checked)}
                      className="rounded accent-purple-600 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                        Solicitar emissão de Nota Fiscal à Contabilidade após salvar
                      </span>
                    </div>
                  </label>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setEvalSettleOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                {evalSettleData?.pending_installments && evalSettleData.pending_installments.length > 0 && (
                  <button
                    type="submit"
                    disabled={submittingEval || selectedEvalInstallments.length === 0}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>
                      {submittingEval
                        ? 'Salvando Baixa...'
                        : `Salvar Baixa (${selectedEvalInstallments.length} parcelas - ${formatCurrency(totalEvalSettleAmount)})`}
                    </span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: RECIBO PROFISSIONAL COM SELO DIGITAL E IMPRESSÃO  */}
      {/* ========================================================= */}
      {receiptModal?.isOpen && (
        <EvaluationReceiptModal
          isOpen={receiptModal.isOpen}
          transactionId={receiptModal.transactionId}
          evaluationId={receiptModal.evaluationId}
          onClose={() => setReceiptModal(null)}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 5: AVISO DE CANCELAMENTO FISCAL PARA CONTABILIDADE  */}
      {/* ========================================================= */}
      <InvoiceCancelNotifyModal
        isOpen={isInvoiceCancelNotifyOpen}
        onClose={() => setIsInvoiceCancelNotifyOpen(false)}
        patientName={invoiceCancelNotifyData.patientName}
        totalAmount={invoiceCancelNotifyData.totalAmount}
        requestDate={invoiceCancelNotifyData.requestDate}
      />
    </div>
  );
};
