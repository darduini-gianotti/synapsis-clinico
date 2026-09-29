import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Brain,
  X,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Lock,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface EditEvaluationModalProps {
  isOpen: boolean;
  evaluationId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface InstallmentItem {
  id?: number;
  installment_number: number;
  amount: number;
  due_date: string;
  payment_method: 'PIX' | 'CARTAO' | 'DINHEIRO' | 'BOLETO';
  status: 'PAID' | 'PENDING';
  paid_at?: string;
  notes?: string;
}

export const EditEvaluationModal: React.FC<EditEvaluationModalProps> = ({
  isOpen,
  evaluationId,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || Boolean(user?.permissions?.includes('manage_users'));
  const canViewFinancial = isAdmin || Boolean(user?.permissions?.includes('view_financial'));

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Evaluation Data
  const [evaluationData, setEvaluationData] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [estimatedSessions, setEstimatedSessions] = useState(6);
  const [hypothesisDiagnosis, setHypothesisDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'IN_PROGRESS' | 'AWAITING_DEVOLUTIVA' | 'COMPLETED'>('IN_PROGRESS');

  // Financial Data
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [installments, setInstallments] = useState<InstallmentItem[]>([]);

  // Pending balance generator helper
  const [genCount, setGenCount] = useState<number>(2);
  const [genFirstDate, setGenFirstDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [genMethod, setGenMethod] = useState<'PIX' | 'CARTAO' | 'DINHEIRO' | 'BOLETO'>('PIX');

  useEffect(() => {
    if (isOpen && evaluationId) {
      loadEvaluation(evaluationId);
    } else {
      setEvaluationData(null);
      setErrorMsg(null);
    }
  }, [isOpen, evaluationId]);

  const loadEvaluation = async (id: number) => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await api.get(`/evaluations/${id}`);
      const ev = res.data.evaluation;
      if (!ev) return;

      setEvaluationData(ev);
      setTitle(ev.title || 'Avaliação Neuropsicológica');
      setEstimatedSessions(ev.estimated_sessions || 6);
      setHypothesisDiagnosis(ev.hypothesis_diagnosis || '');
      setNotes(ev.notes || '');
      setStatus(ev.status || 'IN_PROGRESS');

      const price = Number(ev.total_price) || 0;
      setTotalPrice(price);

      const rawInst: any[] = ev.installments || [];
      const mapped: InstallmentItem[] = rawInst.map((inst, index) => ({
        id: inst.id,
        installment_number: inst.installment_number || index + 1,
        amount: Number(inst.amount) || 0,
        due_date: inst.transaction_date || inst.due_date || new Date().toISOString().split('T')[0],
        payment_method: inst.payment_method || 'PIX',
        status: inst.status === 'PAID' ? 'PAID' : 'PENDING',
        paid_at: inst.paid_at,
        notes: inst.notes,
      }));

      setInstallments(mapped);
    } catch (err: any) {
      console.error('Failed to load evaluation for editing:', err);
      setErrorMsg(err.response?.data?.error || 'Erro ao carregar dados da avaliação.');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculations
  const paidInstallments = installments.filter((i) => i.status === 'PAID');
  const pendingInstallments = installments.filter((i) => i.status === 'PENDING');

  const totalPaid = paidInstallments.reduce((sum, i) => sum + Number(i.amount), 0);
  const pendingSum = pendingInstallments.reduce((sum, i) => sum + Number(i.amount), 0);
  const currentTotal = totalPaid + pendingSum;
  const remainingToDistribute = Math.max(0, totalPrice - totalPaid);
  const isSumMatching = Math.abs(currentTotal - totalPrice) < 0.05;

  // Redistribute remaining balance into N pending installments
  const handleRecalculatePending = () => {
    const count = Math.max(1, Math.min(12, genCount));
    const balance = remainingToDistribute;

    if (balance <= 0) {
      // Remove any pending installments if total is fully paid
      setInstallments(paidInstallments);
      return;
    }

    const perInstallment = Math.floor((balance / count) * 100) / 100;
    const diff = balance - (perInstallment * count);

    const newPending: InstallmentItem[] = [];
    const baseDate = new Date(genFirstDate);

    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);

      const instNum = paidInstallments.length + i + 1;
      const val = i === 0 ? perInstallment + diff : perInstallment;

      newPending.push({
        installment_number: instNum,
        amount: Math.round(val * 100) / 100,
        due_date: d.toISOString().split('T')[0],
        payment_method: genMethod,
        status: 'PENDING',
        notes: `Parcela ${instNum} (Reajustada)`,
      });
    }

    setInstallments([...paidInstallments, ...newPending]);
  };

  // Update a single pending installment
  const handleUpdatePending = (indexInPending: number, field: keyof InstallmentItem, value: any) => {
    const newPending = [...pendingInstallments];
    newPending[indexInPending] = {
      ...newPending[indexInPending],
      [field]: value,
    };
    setInstallments([...paidInstallments, ...newPending]);
  };

  // Add a pending installment manually
  const handleAddPendingRow = () => {
    const nextNum = paidInstallments.length + pendingInstallments.length + 1;
    const lastDate = pendingInstallments.length > 0 
      ? new Date(pendingInstallments[pendingInstallments.length - 1].due_date)
      : new Date();
    lastDate.setMonth(lastDate.getMonth() + 1);

    const newRow: InstallmentItem = {
      installment_number: nextNum,
      amount: 0,
      due_date: lastDate.toISOString().split('T')[0],
      payment_method: 'PIX',
      status: 'PENDING',
      notes: `Parcela ${nextNum}`,
    };

    setInstallments([...paidInstallments, ...pendingInstallments, newRow]);
  };

  // Remove a pending installment manually
  const handleRemovePendingRow = (indexInPending: number) => {
    const filtered = pendingInstallments.filter((_, idx) => idx !== indexInPending);
    // Renumber remaining pending
    const renumbered = filtered.map((inst, idx) => ({
      ...inst,
      installment_number: paidInstallments.length + idx + 1,
    }));
    setInstallments([...paidInstallments, ...renumbered]);
  };

  // Save changes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluationId) return;

    if (!title.trim()) {
      setErrorMsg('O título da avaliação é obrigatório.');
      return;
    }

    if (canViewFinancial) {
      if (totalPrice < totalPaid - 0.01) {
        setErrorMsg(
          `O novo valor total (R$ ${totalPrice.toFixed(2)}) não pode ser menor que o montante já recebido (R$ ${totalPaid.toFixed(2)}).`
        );
        return;
      }

      if (!isSumMatching) {
        setErrorMsg(
          `A soma das parcelas (R$ ${currentTotal.toFixed(2)}) diverge do valor total do pacote (R$ ${totalPrice.toFixed(2)}). Ajuste as parcelas para fechar a conta.`
        );
        return;
      }
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const payload: any = {
        title: title.trim(),
        estimated_sessions: Number(estimatedSessions),
        hypothesis_diagnosis: hypothesisDiagnosis.trim() || null,
        notes: notes.trim() || null,
        status,
      };

      if (canViewFinancial) {
        payload.total_price = Number(totalPrice);
        payload.installments = installments.map((i, idx) => ({
          ...i,
          installment_number: idx + 1,
        }));
      }

      await api.put(`/evaluations/${evaluationId}`, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update evaluation:', err);
      setErrorMsg(err.response?.data?.error || 'Erro ao salvar alterações da avaliação.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-3xl my-8 rounded-2xl border border-purple-200 bg-white shadow-2xl dark:border-purple-900/60 dark:bg-slate-900 overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Editar Avaliação Neuropsicológica</span>
                {evaluationData && (
                  <span className="text-xs font-mono text-purple-600 dark:text-purple-400">
                    #{evaluationData.id}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {evaluationData?.patient_name ? (
                  <>Paciente: <strong>{evaluationData.patient_name}</strong> {evaluationData.patient_cpf ? `(CPF: ${evaluationData.patient_cpf})` : ''}</>
                ) : (
                  'Ajuste de escopo clínico e renegociação do plano financeiro'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-purple-500 mb-3" />
            <p className="text-sm font-semibold">Carregando dados da avaliação...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* SEÇÃO 1: DADOS CLÍNICOS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  1. Escopo Clínico & Status
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Título / Demanda da Avaliação *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500"
                    placeholder="Ex: Avaliação Neuropsicológica das Funções Executivas"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Hipótese Diagnóstica Preliminar (CID-11)
                  </label>
                  <input
                    type="text"
                    value={hypothesisDiagnosis}
                    onChange={(e) => setHypothesisDiagnosis(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500"
                    placeholder="Ex: 6A05 TDAH / 6A02 TEA / Altas Habilidades"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sessões Estimadas de Testagem
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={estimatedSessions}
                    onChange={(e) => setEstimatedSessions(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Situação Atual do Processo
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500"
                  >
                    <option value="IN_PROGRESS">Em Teste</option>
                    <option value="AWAITING_DEVOLUTIVA">Aguardando Devolutiva</option>
                    <option value="COMPLETED">Laudo Emitido (Concluído)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Observações Internas
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500"
                    placeholder="Anotações de acompanhamento interno..."
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: PLANO FINANCEIRO & PARCELAS */}
            {canViewFinancial && (
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      2. Plano Financeiro do Pacote & Parcelas
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">
                      Já Quitado:{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        R$ {totalPaid.toFixed(2)}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Resumo & Novo Valor Total */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Valor Total Contratado (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={totalPaid}
                      value={totalPrice}
                      onChange={(e) => setTotalPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500"
                    />
                    <span className="text-[10px] text-slate-400">
                      Mínimo aceito: R$ {totalPaid.toFixed(2)} (já quitado)
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Saldo Devedor Restante
                    </label>
                    <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-purple-600 dark:text-purple-400">
                      R$ {remainingToDistribute.toFixed(2)}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Total - Quitado
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Conferência de Parcelas
                    </label>
                    <div
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between ${
                        isSumMatching
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                      }`}
                    >
                      <span>Soma: R$ {currentTotal.toFixed(2)}</span>
                      {isSumMatching ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="text-[10px] font-semibold">
                          Dif: R$ {(currentTotal - totalPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {isSumMatching ? 'Contas batendo 100%' : 'Ajuste as parcelas'}
                    </span>
                  </div>
                </div>

                {/* Bloco de Recálculo Rápido do Saldo */}
                {remainingToDistribute > 0 && (
                  <div className="p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/40 dark:border-purple-900/40 dark:bg-purple-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 text-xs">
                      <span className="font-bold text-purple-900 dark:text-purple-300">
                        Redistribuir saldo de R$ {remainingToDistribute.toFixed(2)}:
                      </span>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <select
                          value={genCount}
                          onChange={(e) => setGenCount(Number(e.target.value))}
                          className="px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 font-semibold"
                        >
                          <option value={1}>1x Parcela</option>
                          <option value={2}>2x Parcelas</option>
                          <option value={3}>3x Parcelas</option>
                          <option value={4}>4x Parcelas</option>
                          <option value={5}>5x Parcelas</option>
                          <option value={6}>6x Parcelas</option>
                        </select>

                        <input
                          type="date"
                          value={genFirstDate}
                          onChange={(e) => setGenFirstDate(e.target.value)}
                          className="px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                        />

                        <select
                          value={genMethod}
                          onChange={(e) => setGenMethod(e.target.value as any)}
                          className="px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 font-semibold"
                        >
                          <option value="PIX">PIX</option>
                          <option value="CARTAO">Cartão</option>
                          <option value="BOLETO">Boleto</option>
                          <option value="DINHEIRO">Dinheiro</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRecalculatePending}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      Recalcular Parcelas
                    </button>
                  </div>
                )}

                {/* Lista de Parcelas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Detalhamento do Cronograma ({installments.length} parcela{installments.length === 1 ? '' : 's'}):
                    </span>
                    <button
                      type="button"
                      onClick={handleAddPendingRow}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Adicionar Parcela Manual</span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
                    {/* Parcelas Quitas (Protegidas) */}
                    {paidInstallments.map((inst, pIdx) => (
                      <div
                        key={`paid-${inst.id || pIdx}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <Lock className="h-3 w-3" />
                            <span>Quitada (Inalterável)</span>
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            Parcela {inst.installment_number}
                          </span>
                          {inst.paid_at && (
                            <span className="text-[11px] text-slate-400">
                              Pago em: {inst.paid_at.split(' ')[0]}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            R$ {inst.amount.toFixed(2)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            {inst.payment_method}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Parcelas Pendentes (Editáveis) */}
                    {pendingInstallments.length === 0 && remainingToDistribute > 0 && (
                      <div className="p-4 text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
                        Nenhuma parcela pendente configurada. Clique em "Recalcular Parcelas" acima para distribuir o saldo restante.
                      </div>
                    )}

                    {pendingInstallments.map((inst, pendIdx) => (
                      <div
                        key={`pending-${pendIdx}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <Clock className="h-3 w-3" />
                            <span>Pendente</span>
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            Parcela {inst.installment_number}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 max-w-lg">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400 font-mono">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min={0.01}
                              value={inst.amount}
                              onChange={(e) =>
                                handleUpdatePending(pendIdx, 'amount', Number(e.target.value))
                              }
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                            />
                          </div>

                          <input
                            type="date"
                            value={inst.due_date}
                            onChange={(e) =>
                              handleUpdatePending(pendIdx, 'due_date', e.target.value)
                            }
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                          />

                          <div className="flex items-center gap-2">
                            <select
                              value={inst.payment_method}
                              onChange={(e) =>
                                handleUpdatePending(pendIdx, 'payment_method', e.target.value as any)
                              }
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-semibold"
                            >
                              <option value="PIX">PIX</option>
                              <option value="CARTAO">Cartão</option>
                              <option value="BOLETO">Boleto</option>
                              <option value="DINHEIRO">Dinheiro</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemovePendingRow(pendIdx)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                              title="Remover parcela"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || (canViewFinancial && !isSumMatching)}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition shadow-md ${
                  isSaving || (canViewFinancial && !isSumMatching)
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 cursor-pointer shadow-purple-600/20'
                }`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
