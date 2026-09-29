import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { RepasseBatch, RepasseBatchItem, RepasseAdjustment, User } from '../../types.js';
import { generateRepassePdf } from '../../utils/repassePdfGenerator.js';
import {
  Percent,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  CreditCard,
  Plus,
  Trash2,
  Download,
  Eye,
  AlertCircle,
  Filter,
  Search,
  FileText,
  Layers,
  ArrowRight,
  UserCheck,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface PreviewItem extends RepasseBatchItem {
  selected?: boolean;
}

export const RepasseManagementTab: React.FC = () => {
  const [subView, setSubView] = useState<'apuracao' | 'historico'>('apuracao');

  // Collaborators / Psychologists list
  const [psychologists, setPsychologists] = useState<User[]>([]);
  const [selectedPsychologistId, setSelectedPsychologistId] = useState<number | ''>('');
  const [isLoadingPsychologists, setIsLoadingPsychologists] = useState(false);

  // Period inputs
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().substring(0, 10);
  });

  // Preview data
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    psychologist: any;
    summary: { total_items: number; gross_total: number; repasse_subtotal: number };
    items: PreviewItem[];
  } | null>(null);

  // Manual Adjustments
  const [adjustments, setAdjustments] = useState<RepasseAdjustment[]>([]);
  const [adjType, setAdjType] = useState<'DEDUCTION' | 'ADDITION'>('DEDUCTION');
  const [adjDescription, setAdjDescription] = useState('');
  const [adjAmount, setAdjAmount] = useState<number | ''>('');

  // Notes
  const [batchNotes, setBatchNotes] = useState('');
  const [isClosingBatch, setIsClosingBatch] = useState(false);
  const [closingError, setClosingError] = useState<string | null>(null);
  const [closingSuccess, setClosingSuccess] = useState<string | null>(null);

  // Batches history
  const [batches, setBatches] = useState<RepasseBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'CLOSED' | 'PAID'>('ALL');
  const [historyPsychologistFilter, setHistoryPsychologistFilter] = useState<number | ''>('');

  // Modals
  const [detailsModalBatch, setDetailsModalBatch] = useState<{
    batch: RepasseBatch;
    items: RepasseBatchItem[];
    adjustments: RepasseAdjustment[];
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [paymentModalBatch, setPaymentModalBatch] = useState<RepasseBatch | null>(null);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);

  // Initial load
  useEffect(() => {
    fetchPsychologists();
    fetchBatches();
  }, []);

  const fetchPsychologists = async () => {
    try {
      setIsLoadingPsychologists(true);
      const res = await api.get('/collaborators');
      const collabs: User[] = res.data?.users || res.data || [];
      const psychs = collabs.filter(
        (c) => c.role === 'PSYCHOLOGIST' || (c as any).role_name === 'PSYCHOLOGIST' || (c.crp_number && c.crp_number.trim().length > 0)
      );
      setPsychologists(psychs);
      if (psychs.length > 0 && selectedPsychologistId === '') {
        setSelectedPsychologistId(psychs[0].id);
      }
    } catch (err) {
      console.error('Failed to load psychologists:', err);
    } finally {
      setIsLoadingPsychologists(false);
    }
  };

  const fetchBatches = async () => {
    try {
      setIsLoadingBatches(true);
      const params: any = {};
      if (historyStatusFilter !== 'ALL') params.status = historyStatusFilter;
      if (historyPsychologistFilter) params.psychologist_id = historyPsychologistFilter;
      const res = await api.get('/repasse/batches', { params });
      setBatches(res.data.batches || []);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  useEffect(() => {
    if (subView === 'historico') {
      fetchBatches();
    }
  }, [subView, historyStatusFilter, historyPsychologistFilter]);

  const handleFetchPreview = async () => {
    if (!selectedPsychologistId) return;
    try {
      setIsLoadingPreview(true);
      setClosingError(null);
      setClosingSuccess(null);
      const res = await api.get('/repasse/preview', {
        params: {
          psychologist_id: selectedPsychologistId,
          start_date: startDate,
          end_date: endDate
        }
      });
      const data = res.data;
      const itemsWithSelection = (data.items || []).map((item: RepasseBatchItem) => ({
        ...item,
        selected: true
      }));
      setPreviewData({
        ...data,
        items: itemsWithSelection
      });
      setAdjustments([]);
    } catch (err: any) {
      console.error('Failed to load repasse preview:', err);
      setClosingError(err.response?.data?.error || 'Erro ao carregar prévia de repasse.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleToggleSelectItem = (idx: number) => {
    if (!previewData) return;
    const updated = [...previewData.items];
    updated[idx].selected = !updated[idx].selected;
    setPreviewData({ ...previewData, items: updated });
  };

  const handleToggleSelectAll = (select: boolean) => {
    if (!previewData) return;
    const updated = previewData.items.map((it) => ({ ...it, selected: select }));
    setPreviewData({ ...previewData, items: updated });
  };

  // Adjustments handlers
  const handleAddAdjustment = () => {
    if (!adjDescription.trim() || !adjAmount || Number(adjAmount) <= 0) return;
    const newAdj: RepasseAdjustment = {
      adjustment_type: adjType,
      description: adjDescription.trim(),
      amount: Number(adjAmount)
    };
    setAdjustments((prev) => [...prev, newAdj]);
    setAdjDescription('');
    setAdjAmount('');
  };

  const handleRemoveAdjustment = (idx: number) => {
    setAdjustments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calculation totals
  const selectedItems = previewData?.items.filter((it) => it.selected) || [];
  const selectedGrossTotal = selectedItems.reduce((acc, it) => acc + (it.gross_amount || 0), 0);
  const selectedRepasseSubtotal = selectedItems.reduce((acc, it) => acc + it.repasse_amount, 0);

  const totalDeductions = adjustments
    .filter((a) => a.adjustment_type === 'DEDUCTION')
    .reduce((acc, a) => acc + a.amount, 0);

  const totalAdditions = adjustments
    .filter((a) => a.adjustment_type === 'ADDITION')
    .reduce((acc, a) => acc + a.amount, 0);

  const netRepasseTotal = Math.max(0, selectedRepasseSubtotal - totalDeductions + totalAdditions);

  // Close batch
  const handleCloseBatch = async () => {
    if (!selectedPsychologistId || !previewData) return;
    if (selectedItems.length === 0) {
      alert('Selecione pelo menos um atendimento para fechar o lote.');
      return;
    }

    if (
      !confirm(
        `Confirma o fechamento do lote para ${previewData.psychologist.name}?\n` +
          `Qtd Itens: ${selectedItems.length}\n` +
          `Total Líquido: ${formatCurrency(netRepasseTotal)}\n\n` +
          `Ao fechar, as sessões serão congeladas neste lote e não poderão ser liquidadas novamente.`
      )
    ) {
      return;
    }

    try {
      setIsClosingBatch(true);
      setClosingError(null);
      const payload = {
        psychologist_id: selectedPsychologistId,
        period_start: startDate,
        period_end: endDate,
        notes: batchNotes.trim() || undefined,
        items: selectedItems.map((it) => ({
          session_id: it.session_id,
          evaluation_id: it.evaluation_id,
          patient_id: it.patient_id,
          service_type: it.service_type,
          service_label: it.service_label,
          service_date: it.service_date,
          gross_amount: it.gross_amount,
          repasse_rate: it.repasse_rate,
          repasse_amount: it.repasse_amount,
          payment_method: it.payment_method,
          paid_at: it.paid_at
        })),
        adjustments: adjustments.map((a) => ({
          adjustment_type: a.adjustment_type,
          description: a.description,
          amount: a.amount
        }))
      };

      const res = await api.post('/repasse/batches', payload);
      setClosingSuccess(`Lote ${res.data.batch_number} criado com sucesso!`);
      setPreviewData(null);
      setAdjustments([]);
      setBatchNotes('');
      // Switch to history tab
      setSubView('historico');
      fetchBatches();
    } catch (err: any) {
      console.error('Failed to close batch:', err);
      setClosingError(err.response?.data?.error || 'Erro ao fechar lote de repasse.');
    } finally {
      setIsClosingBatch(false);
    }
  };

  // Open Details Modal
  const handleOpenDetails = async (batchId: number) => {
    try {
      setIsLoadingDetails(true);
      const res = await api.get(`/repasse/batches/${batchId}`);
      setDetailsModalBatch(res.data);
    } catch (err: any) {
      console.error('Failed to load batch details:', err);
      alert('Erro ao carregar detalhes do lote.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async (batchId: number) => {
    try {
      const res = await api.get(`/repasse/batches/${batchId}`);
      const { batch, items, adjustments: adjs } = res.data;
      generateRepassePdf({
        batch,
        items,
        adjustments: adjs,
        clinic_settings: {
          clinic_name: 'PsicoGestão Clínica Integrada',
          cnpj: '12.345.678/0001-90',
          phone: '(11) 99999-8888',
          email: 'contato@psicogestao.com.br',
          address: 'Av. Paulista, 1000 - São Paulo/SP'
        }
      });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Erro ao gerar PDF do extrato.');
    }
  };

  // Delete Batch
  const handleDeleteBatch = async (batch: RepasseBatch) => {
    if (batch.status === 'PAID') {
      alert('Não é possível excluir um lote já quitado.');
      return;
    }
    if (
      !confirm(
        `Tem certeza que deseja excluir o lote ${batch.batch_number}?\nAs sessões vinculadas voltarão a ficar disponíveis para nova apuração.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/repasse/batches/${batch.id}`);
      fetchBatches();
    } catch (err: any) {
      console.error('Failed to delete batch:', err);
      alert(err.response?.data?.error || 'Erro ao excluir lote.');
    }
  };

  // Open Pay Modal
  const handleOpenPayModal = (batch: RepasseBatch) => {
    setPaymentModalBatch(batch);
    setPaymentDate(new Date().toISOString().substring(0, 10));
    setPaymentMethod('PIX');
    setPaymentNotes('');
    setCopiedPix(false);
  };

  // Submit Payment
  const handleSubmitPayment = async () => {
    if (!paymentModalBatch) return;
    try {
      setIsSubmittingPayment(true);
      await api.patch(`/repasse/batches/${paymentModalBatch.id}/pay`, {
        payment_date: paymentDate,
        payment_method: paymentMethod,
        notes: paymentNotes.trim() || undefined
      });
      setPaymentModalBatch(null);
      fetchBatches();
    } catch (err: any) {
      console.error('Failed to settle repasse batch:', err);
      alert(err.response?.data?.error || 'Erro ao registrar pagamento do lote.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const copyPixKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const formatCurrency = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return (
    <div className="space-y-6">
      {/* Module Sub-header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Percent className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Controle de Repasse de Honorários
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Apuração em Regime de Caixa Estrito (apenas sessões pagas), congelamento de lotes e emissão de extrato formal.
          </p>
        </div>

        {/* Sub-view switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setSubView('apuracao')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              subView === 'apuracao'
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Apuração & Fechamento</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('historico')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              subView === 'historico'
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Histórico de Lotes</span>
            {batches.filter((b) => b.status === 'CLOSED').length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {batches.filter((b) => b.status === 'CLOSED').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SUBVIEW 1: APURAÇÃO & FECHAMENTO */}
      {subView === 'apuracao' && (
        <div className="space-y-6">
          {/* Filter / Search Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800/50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Psicólogo(a) / Profissional
                </label>
                <select
                  value={selectedPsychologistId}
                  onChange={(e) => {
                    setSelectedPsychologistId(Number(e.target.value) || '');
                    setPreviewData(null);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Selecione o psicólogo...</option>
                  {psychologists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.crp_number ? `(${p.crp_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Data Início (Atendimentos)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Data Fim (Atendimentos)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleFetchPreview}
                  disabled={!selectedPsychologistId || isLoadingPreview}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-500 disabled:opacity-50 transition cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                  <span>{isLoadingPreview ? 'Calculando...' : 'Buscar Sessões Elegíveis'}</span>
                </button>
              </div>
            </div>

            {/* Regime de Caixa Alert */}
            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Regime de Caixa Ativo:</strong> Apenas sessões realizadas (COMPLETED) com status de pagamento
                do paciente confirmado (PAID) e que ainda não estejam em nenhum lote fechado aparecem nesta listagem.
              </span>
            </div>
          </div>

          {closingError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{closingError}</span>
            </div>
          )}

          {closingSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{closingSuccess}</span>
            </div>
          )}

          {/* Preview Results */}
          {previewData && (
            <div className="space-y-6">
              {/* Professional Contractual Summary Badge */}
              <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900/60 dark:bg-teal-950/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {previewData.psychologist.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {previewData.psychologist.name}
                      {previewData.psychologist.crp_number && (
                        <span className="text-[11px] font-normal px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
                          {previewData.psychologist.crp_number}
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 flex flex-wrap gap-3">
                      <span>
                        Taxa Psicoterapia:{' '}
                        <strong>
                          {previewData.psychologist.repasse_mode === 'FIXED_PER_SESSION'
                            ? formatCurrency(previewData.psychologist.repasse_fixed_amount)
                            : `${previewData.psychologist.repasse_percentage || 0}%`}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Taxa Avaliação Neuro:{' '}
                        <strong>{previewData.psychologist.repasse_eval_percentage || 0}%</strong>
                      </span>
                      {previewData.psychologist.pix_key && (
                        <>
                          <span>•</span>
                          <span>
                            Chave PIX: <strong>{previewData.psychologist.pix_key}</strong> (
                            {previewData.psychologist.pix_key_type || 'PIX'})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Período da Apuração
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {formatDate(startDate)} até {formatDate(endDate)}
                  </span>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Itens Elegíveis
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {selectedItems.length} / {previewData.items.length}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Faturado Bruto
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {formatCurrency(selectedGrossTotal)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Subtotal Repasse
                  </span>
                  <p className="text-lg font-bold text-teal-600 dark:text-teal-400 mt-1">
                    {formatCurrency(selectedRepasseSubtotal)}
                  </p>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 shadow-xs dark:border-rose-900/50 dark:bg-rose-950/20">
                  <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase">
                    (-) Deduções
                  </span>
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">
                    {formatCurrency(totalDeductions)}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 shadow-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                    (+) Acréscimos
                  </span>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatCurrency(totalAdditions)}
                  </p>
                </div>

                <div className="rounded-xl border border-teal-500 bg-teal-600 text-white p-3 shadow-md">
                  <span className="text-[10px] font-semibold uppercase text-teal-100">
                    Líquido a Pagar
                  </span>
                  <p className="text-lg font-extrabold mt-1">{formatCurrency(netRepasseTotal)}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800/50 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-teal-600" />
                      Atendimentos Elegíveis para Inclusão no Lote
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Desmarque qualquer sessão caso deseje postergá-la para o próximo lote.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(true)}
                      className="text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                    >
                      Selecionar Todos
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(false)}
                      className="text-xs text-slate-500 dark:text-slate-400 font-semibold hover:underline"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                {previewData.items.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                    Nenhum atendimento pago encontrado para este profissional no período informado.
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[320px]">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10 select-none">
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="p-3 w-10 text-center bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs">
                            <input
                              type="checkbox"
                              checked={previewData.items.length > 0 && selectedItems.length === previewData.items.length}
                              onChange={(e) => handleToggleSelectAll(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                          </th>
                          <th className="p-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Data Atend.</th>
                          <th className="p-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Paciente</th>
                          <th className="p-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Tipo / Serviço</th>
                          <th className="p-3 text-right bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Valor Bruto</th>
                          <th className="p-3 text-center bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Taxa (%)</th>
                          <th className="p-3 text-right bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Repasse Profissional</th>
                          <th className="p-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Data Quitação Paciente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {previewData.items.map((it, idx) => (
                          <tr
                            key={idx}
                            className={`transition hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                              it.selected ? '' : 'opacity-40 bg-slate-50/50'
                            }`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={!!it.selected}
                                onChange={() => handleToggleSelectItem(idx)}
                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                            </td>
                            <td className="p-3 font-medium text-slate-900 dark:text-white">
                              {formatDate(it.service_date)}
                            </td>
                            <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                              {it.patient_name || `Paciente #${it.patient_id}`}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  it.service_type === 'EVALUATION'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                                    : 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
                                }`}
                              >
                                {it.service_label || it.service_type}
                              </span>
                            </td>
                            <td className="p-3 text-right font-medium text-slate-600 dark:text-slate-400">
                              {formatCurrency(it.gross_amount)}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                              {it.repasse_rate}%
                            </td>
                            <td className="p-3 text-right font-bold text-teal-600 dark:text-teal-400">
                              {formatCurrency(it.repasse_amount)}
                            </td>
                            <td className="p-3 text-slate-500 dark:text-slate-400">
                              {it.paid_at ? formatDate(it.paid_at) : 'Quitado'} ({it.payment_method || 'PIX'})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Manual Adjustments Section */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-teal-600" />
                      Lançamentos Extras & Ajustes Manuais
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Adicione descontos (ex: adiantamentos, protocolos de testes) ou acréscimos (ex: bonificações).
                    </p>
                  </div>
                </div>

                {/* Add Adjustment Form */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Tipo de Lançamento
                    </label>
                    <select
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="DEDUCTION">(-) Desconto / Dedução</option>
                      <option value="ADDITION">(+) Acréscimo / Bonificação</option>
                    </select>
                  </div>

                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Descrição / Justificativa
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Custo de protocolos de teste neuropsicológico"
                      value={adjDescription}
                      onChange={(e) => setAdjDescription(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddAdjustment}
                      disabled={!adjDescription.trim() || !adjAmount || Number(adjAmount) <= 0}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-500 disabled:opacity-50 transition cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

                {/* Adjustments List */}
                {adjustments.length > 0 && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    {adjustments.map((adj, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              adj.adjustment_type === 'DEDUCTION'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                            }`}
                          >
                            {adj.adjustment_type === 'DEDUCTION' ? '(-) DEDUÇÃO' : '(+) ACRÉSCIMO'}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {adj.description}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span
                            className={`font-bold ${
                              adj.adjustment_type === 'DEDUCTION'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {adj.adjustment_type === 'DEDUCTION' ? '-' : '+'}
                            {formatCurrency(adj.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAdjustment(idx)}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Batch Notes & Close Button Bar */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800/50 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Observações do Lote / Extrato (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                    placeholder="Ex: Fechamento referente aos atendimentos quinzenais de Setembro/2026."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>
                      O fechamento criará um <strong>Snapshot Imutável</strong> das sessões selecionadas.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseBatch}
                    disabled={isClosingBatch || selectedItems.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-teal-500 disabled:opacity-50 transition cursor-pointer"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span>
                      {isClosingBatch
                        ? 'Fechando Lote...'
                        : `Fechar Lote (${selectedItems.length} sessões - ${formatCurrency(netRepasseTotal)})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW 2: HISTÓRICO DE LOTES */}
      {subView === 'historico' && (
        <div className="space-y-6">
          {/* History Filters */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <Filter className="h-4 w-4" />
                <span>Status:</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                {(['ALL', 'CLOSED', 'PAID'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setHistoryStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      historyStatusFilter === st
                        ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-2xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st === 'ALL' ? 'Todos' : st === 'CLOSED' ? 'Aguardando Pagamento' : 'Quitados (Pagos)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={historyPsychologistFilter}
                onChange={(e) => setHistoryPsychologistFilter(Number(e.target.value) || '')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Todos os Psicólogos</option>
                {psychologists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Batches Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800/50 overflow-hidden">
            {isLoadingBatches ? (
              <div className="p-8 text-center text-slate-500 text-xs">Carregando lotes de repasse...</div>
            ) : batches.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                Nenhum lote de repasse encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[320px]">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 select-none">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3.5 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Nº do Lote</th>
                      <th className="p-3.5 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Psicólogo(a)</th>
                      <th className="p-3.5 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Período de Apuração</th>
                      <th className="p-3.5 text-center bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Sessões</th>
                      <th className="p-3.5 text-right bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Faturado Bruto</th>
                      <th className="p-3.5 text-right bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Líquido Repasse</th>
                      <th className="p-3.5 text-center bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Status</th>
                      <th className="p-3.5 text-right bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {batches.map((batch) => (
                      <tr
                        key={batch.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"
                      >
                        <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          {batch.batch_number}
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {batch.psychologist_name || `Psicólogo #${batch.psychologist_id}`}
                          </div>
                          {batch.psychologist_crp && (
                            <div className="text-[10px] text-slate-500">{batch.psychologist_crp}</div>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-700 dark:text-slate-300">
                          {formatDate(batch.period_start)} a {formatDate(batch.period_end)}
                        </td>
                        <td className="p-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                          {batch.total_sessions_count}
                        </td>
                        <td className="p-3.5 text-right text-slate-600 dark:text-slate-400 font-medium">
                          {formatCurrency(batch.gross_total_amount)}
                        </td>
                        <td className="p-3.5 text-right font-extrabold text-teal-600 dark:text-teal-400">
                          {formatCurrency(batch.net_repasse_amount)}
                        </td>
                        <td className="p-3.5 text-center">
                          {batch.status === 'PAID' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              QUITADO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                              <Clock className="h-3 w-3" />
                              AGUARDANDO PAGTO
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ver detalhes */}
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(batch.id)}
                              title="Visualizar Itens do Lote"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {/* Baixar PDF */}
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(batch.id)}
                              title="Baixar Extrato Oficial (PDF)"
                              className="p-1.5 rounded-lg border border-teal-200 bg-teal-50/50 hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/40 text-teal-600 dark:text-teal-300 transition"
                            >
                              <Download className="h-4 w-4" />
                            </button>

                            {/* Pagar (se não quitado) */}
                            {batch.status !== 'PAID' && (
                              <button
                                type="button"
                                onClick={() => handleOpenPayModal(batch)}
                                title="Registrar Pagamento PIX"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-2xs transition"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                <span>Pagar</span>
                              </button>
                            )}

                            {/* Excluir Lote (se não quitado) */}
                            {batch.status !== 'PAID' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteBatch(batch)}
                                title="Excluir Lote Aberto"
                                className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: DETALHES DO LOTE */}
      {detailsModalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-600 text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Extrato de Repasse: {detailsModalBatch.batch.batch_number}
                    {detailsModalBatch.batch.status === 'PAID' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                        QUITADO
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                        PENDENTE DE PAGTO
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Profissional: {detailsModalBatch.batch.psychologist_name} | Período:{' '}
                    {formatDate(detailsModalBatch.batch.period_start)} a{' '}
                    {formatDate(detailsModalBatch.batch.period_end)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailsModalBatch(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Totals Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Qtd Sessões</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {detailsModalBatch.batch.total_sessions_count}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Subtotal Repasse</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatCurrency(detailsModalBatch.batch.repasse_subtotal)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Ajustes (+ / -)</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    +{formatCurrency(detailsModalBatch.batch.additions_amount)} / -
                    {formatCurrency(detailsModalBatch.batch.deductions_amount)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Líquido</span>
                  <p className="text-sm font-extrabold text-teal-600 dark:text-teal-400">
                    {formatCurrency(detailsModalBatch.batch.net_repasse_amount)}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  Atendimentos Vinculados ({detailsModalBatch.items.length})
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 select-none">
                      <tr>
                        <th className="p-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Data</th>
                        <th className="p-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Paciente</th>
                        <th className="p-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Serviço</th>
                        {detailsModalBatch.batch.gross_total_amount !== null && (
                          <th className="p-2.5 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Bruto</th>
                        )}
                        <th className="p-2.5 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Taxa</th>
                        <th className="p-2.5 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Repasse</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {detailsModalBatch.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5">{formatDate(item.service_date)}</td>
                          <td className="p-2.5 font-medium">{item.patient_name || '-'}</td>
                          <td className="p-2.5">{item.service_label || item.service_type}</td>
                          {detailsModalBatch.batch.gross_total_amount !== null && (
                            <td className="p-2.5 text-right text-slate-500">
                              {formatCurrency(item.gross_amount)}
                            </td>
                          )}
                          <td className="p-2.5 text-center font-semibold">{item.repasse_rate}%</td>
                          <td className="p-2.5 text-right font-bold text-teal-600 dark:text-teal-400">
                            {formatCurrency(item.repasse_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Adjustments */}
              {detailsModalBatch.adjustments.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                    Lançamentos Extras / Ajustes ({detailsModalBatch.adjustments.length})
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2.5">Tipo</th>
                          <th className="p-2.5">Descrição</th>
                          <th className="p-2.5 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detailsModalBatch.adjustments.map((adj, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  adj.adjustment_type === 'DEDUCTION'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {adj.adjustment_type === 'DEDUCTION' ? 'DEDUÇÃO' : 'ACRÉSCIMO'}
                              </span>
                            </td>
                            <td className="p-2.5">{adj.description}</td>
                            <td
                              className={`p-2.5 text-right font-bold ${
                                adj.adjustment_type === 'DEDUCTION' ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                            >
                              {adj.adjustment_type === 'DEDUCTION' ? '-' : '+'}
                              {formatCurrency(adj.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Audit Metadata */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700 text-[11px] text-slate-500 space-y-1">
                <div>
                  Fechado em: <strong>{formatDate(detailsModalBatch.batch.closed_at)}</strong>
                  {detailsModalBatch.batch.closed_by_name && (
                    <span> por {detailsModalBatch.batch.closed_by_name}</span>
                  )}
                </div>
                {detailsModalBatch.batch.status === 'PAID' && (
                  <div>
                    Quitado em:{' '}
                    <strong>
                      {formatDate(detailsModalBatch.batch.payment_date || detailsModalBatch.batch.paid_at)}
                    </strong>{' '}
                    via <strong>{detailsModalBatch.batch.payment_method || 'PIX'}</strong>
                    {detailsModalBatch.batch.paid_by_name && (
                      <span> por {detailsModalBatch.batch.paid_by_name}</span>
                    )}
                  </div>
                )}
                {detailsModalBatch.batch.notes && (
                  <div>
                    Observações: <em>{detailsModalBatch.batch.notes}</em>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDownloadPdf(detailsModalBatch.batch.id)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition"
              >
                <Download className="h-4 w-4" />
                <span>Baixar Extrato PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailsModalBatch(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRAR PAGAMENTO PIX */}
      {paymentModalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CreditCard className="h-6 w-6" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Quitar Lote: {paymentModalBatch.batch_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalBatch(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Profissional: <strong>{paymentModalBatch.psychologist_name}</strong>
            </p>

            {/* Pix Key Highlight Card */}
            <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
                  Chave PIX do Profissional:
                </span>
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                  {paymentModalBatch.psychologist_pix_key_type || 'PIX'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 mt-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white select-all">
                  {paymentModalBatch.psychologist_pix_key || 'Chave PIX não cadastrada no perfil'}
                </span>
                {paymentModalBatch.psychologist_pix_key && (
                  <button
                    type="button"
                    onClick={() => copyPixKey(paymentModalBatch.psychologist_pix_key!)}
                    className="p-1 rounded hover:bg-emerald-50 text-emerald-600 dark:hover:bg-slate-800 transition"
                    title="Copiar Chave PIX"
                  >
                    {copiedPix ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>

              <div className="mt-3 text-right">
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase block">
                  Valor Líquido a Pagar
                </span>
                <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(paymentModalBatch.net_repasse_amount)}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data do Pagamento
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="PIX">PIX</option>
                  <option value="TRANSFERENCIA">Transferência Bancária (TED/DOC)</option>
                  <option value="DINHEIRO">Dinheiro / Espécie</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observações / Código de Transação (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: End-to-end PIX E12345678..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-2.5 text-[11px] text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60">
                <strong>Atenção:</strong> Ao confirmar a quitação, o lote será marcado como{' '}
                <strong>QUITADO</strong> e uma despesa na categoria <strong>'REPASSE_PROFISSIONAL'</strong> será
                inserida automaticamente no Livro Caixa da clínica.
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPaymentModalBatch(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSubmitPayment}
                disabled={isSubmittingPayment}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition cursor-pointer"
              >
                {isSubmittingPayment ? 'Quiting...' : 'Confirmar e Quitar Lote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
