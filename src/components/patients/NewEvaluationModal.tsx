import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Patient } from '../../types.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Brain,
  X,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  User,
} from 'lucide-react';

interface NewEvaluationModalProps {
  patient?: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (evaluationId: number) => void;
}

interface InstallmentRow {
  installment_number: number;
  amount: number;
  due_date: string;
  payment_method: 'PIX' | 'CARTAO' | 'DINHEIRO' | 'BOLETO';
  notes?: string;
}

export const NewEvaluationModal: React.FC<NewEvaluationModalProps> = ({
  patient,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, isAdmin, hasPermission } = useAuth();
  const canViewFinancial = isAdmin || Boolean(hasPermission('view_financial'));
  const hasManageUsers = user?.role === 'ADMIN' || Boolean(user?.permissions?.includes('manage_users'));

  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | ''>(patient?.id || '');
  const [psychologistsList, setPsychologistsList] = useState<any[]>([]);
  const [selectedPsychologistId, setSelectedPsychologistId] = useState<number | ''>(user?.id || 1);

  const [title, setTitle] = useState('Avaliação Neuropsicológica');
  const [estimatedSessions, setEstimatedSessions] = useState(6);
  const [totalPrice, setTotalPrice] = useState<number>(canViewFinancial ? 2400 : 0);
  const [paymentMode, setPaymentMode] = useState<'A_VISTA' | 'PARCELADO'>('PARCELADO');
  const [hypothesisDiagnosis, setHypothesisDiagnosis] = useState('');
  const [notes, setNotes] = useState('');

  // Installment generator state
  const [numInstallments, setNumInstallments] = useState(4);
  const [downPayment, setDownPayment] = useState<number>(0);
  const [installments, setInstallments] = useState<InstallmentRow[]>(() => {
    const today = new Date();
    const rows: InstallmentRow[] = [];
    const count = 4;
    const baseAmount = Math.round((2400 / count) * 100) / 100;
    for (let i = 1; i <= count; i++) {
      const d = new Date(today);
      d.setMonth(d.getMonth() + (i - 1));
      rows.push({
        installment_number: i,
        amount: baseAmount,
        due_date: d.toISOString().split('T')[0],
        payment_method: 'PIX',
      });
    }
    return rows;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalculate installments based on current parameters
  const handleGenerateInstallments = () => {
    const count = Math.max(1, Math.min(12, numInstallments));
    const total = Number(totalPrice) || 0;
    const entrada = Math.max(0, Math.min(total, Number(downPayment) || 0));
    const remaining = Math.max(0, total - entrada);
    const remainingCount = entrada > 0 ? count - 1 : count;

    const rows: InstallmentRow[] = [];
    const today = new Date();

    if (entrada > 0) {
      rows.push({
        installment_number: 1,
        amount: entrada,
        due_date: today.toISOString().split('T')[0],
        payment_method: 'PIX',
        notes: 'Entrada / Sinal da Avaliação',
      });
    }

    if (remainingCount > 0) {
      const perInstallment = Math.floor((remaining / remainingCount) * 100) / 100;
      let diff = remaining - (perInstallment * remainingCount);

      for (let i = 1; i <= remainingCount; i++) {
        const d = new Date(today);
        d.setMonth(d.getMonth() + (entrada > 0 ? i : i - 1));
        const finalAmt = i === remainingCount ? Math.round((perInstallment + diff) * 100) / 100 : perInstallment;
        rows.push({
          installment_number: entrada > 0 ? i + 1 : i,
          amount: finalAmt,
          due_date: d.toISOString().split('T')[0],
          payment_method: 'PIX',
        });
      }
    }

    setInstallments(rows);
  };

  // Update specific installment row
  const updateInstallment = (index: number, field: keyof InstallmentRow, value: any) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    setInstallments(updated);
  };

  const installmentsSum = installments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const isSumMatching = Math.abs(installmentsSum - totalPrice) < 0.05;

  useEffect(() => {
    if (patient) {
      setSelectedPatientId(patient.id);
    } else if (isOpen) {
      api.get('/patients').then((res) => {
        const list: Patient[] = res.data.patients || [];
        setPatientsList(list);
        if (list.length > 0 && !selectedPatientId) {
          setSelectedPatientId(list[0].id);
        }
      }).catch(console.error);

      if (hasManageUsers) {
        api.get('/users').then((res) => {
          const psychs = (res.data.users || []).filter((u: any) => u.role === 'PSYCHOLOGIST' || u.role === 'ADMIN');
          setPsychologistsList(psychs);
          if (psychs.length > 0 && !selectedPsychologistId) {
            setSelectedPsychologistId(user?.id || psychs[0].id);
          }
        }).catch(console.error);
      }
    }
  }, [isOpen, patient]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetPatientId = patient ? patient.id : Number(selectedPatientId);
    if (!targetPatientId) {
      setError('Por favor, selecione um paciente para iniciar a avaliação.');
      return;
    }

    if (!title.trim()) {
      setError('Informe o título ou demanda clínica da avaliação.');
      return;
    }

    if (canViewFinancial) {
      if (totalPrice <= 0) {
        setError('O valor total fechado deve ser maior que zero.');
        return;
      }

      if (installments.length === 0) {
        setError('É necessário definir pelo menos 1 parcela.');
        return;
      }

      if (!isSumMatching) {
        setError(
          `A soma das parcelas (R$ ${installmentsSum.toFixed(2)}) não confere com o valor total fechado (R$ ${totalPrice.toFixed(2)}). Ajuste os valores.`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        patient_id: targetPatientId,
        psychologist_id: hasManageUsers && selectedPsychologistId ? Number(selectedPsychologistId) : (user?.id || 1),
        title: title.trim(),
        estimated_sessions: Number(estimatedSessions) || 6,
        hypothesis_diagnosis: hypothesisDiagnosis.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (canViewFinancial) {
        payload.total_price = Number(totalPrice);
        payload.payment_mode = paymentMode;
        payload.financial_status = 'APPROVED';
        payload.installments = installments.map((i, idx) => ({
          installment_number: idx + 1,
          amount: Number(i.amount),
          due_date: i.due_date,
          payment_method: i.payment_method,
          notes: i.notes || undefined,
        }));
      } else {
        payload.total_price = 0;
        payload.payment_mode = 'A_VISTA';
        payload.financial_status = 'PENDING_PRICING';
        payload.installments = [];
      }

      const res = await api.post('/evaluations', payload);

      onSuccess(res.data.evaluation_id);
      onClose();
    } catch (err: any) {
      console.error('Error opening evaluation:', err);
      setError(err.response?.data?.error || 'Erro ao iniciar avaliação neuropsicológica.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Nova Avaliação Neuropsicológica
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {patient ? (
                  <>Paciente: <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.full_name}</span> • </>
                ) : (
                  <>Contratação de </>
                )}
                Pacote Fechado & Laudo CFP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-5 text-xs">
          {/* Seletor de Paciente & Psicólogo (se aberto do Hub sem paciente pré-selecionado) */}
          {!patient && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/60 dark:bg-purple-950/20 space-y-3">
              <h3 className="font-bold text-purple-950 dark:text-purple-300 flex items-center gap-1.5 text-sm">
                <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>Vinculação do Paciente & Profissional Responsável</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Selecionar Paciente *
                  </label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(Number(e.target.value) || '')}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden focus:border-purple-500 font-medium"
                    required
                  >
                    <option value="" disabled>-- Selecione um paciente --</option>
                    {patientsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} {p.cpf ? `(CPF: ${p.cpf})` : '(Sem CPF)'}
                      </option>
                    ))}
                  </select>
                </div>

                {hasManageUsers && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Psicólogo Responsável Técnico *
                    </label>
                    <select
                      value={selectedPsychologistId}
                      onChange={(e) => setSelectedPsychologistId(Number(e.target.value) || '')}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden focus:border-purple-500 font-medium"
                      required
                    >
                      {psychologistsList.map((ps) => (
                        <option key={ps.id} value={ps.id}>
                          {ps.name} {ps.crp_number ? `(${ps.crp_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Dados Clínicos & Demanda */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
              <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Demanda Clínica & Investigação</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título / Queixa Principal *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Investigação Neuropsicológica de Funções Executivas e TDAH"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Estimativa de Sessões
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={estimatedSessions}
                  onChange={(e) => setEstimatedSessions(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hipótese Diagnóstica Inicial (Opcional)
                </label>
                <input
                  type="text"
                  value={hypothesisDiagnosis}
                  onChange={(e) => setHypothesisDiagnosis(e.target.value)}
                  placeholder="Ex: TDAH combinado (CID-11: 6A05), TEA Nível 1..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Anotações Internas / Solicitante
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Encaminhado por neuropediatra Dr. Carlos; relatório até 30/10"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Dados Comerciais & Gerador de Parcelas */}
          {!canViewFinancial ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 shrink-0">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  Condições Comerciais & Financeiras Centralizadas
                </h4>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5 leading-relaxed">
                  O processo de avaliação será iniciado com o seu enquadre técnico/clínico. O plano comercial e as parcelas de pagamento serão configurados e aprovados pela recepção ou administração da clínica antes da liberação do agendamento dos horários.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Condições Comerciais & Plano de Pagamento</span>
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode('A_VISTA');
                      setNumInstallments(1);
                      setDownPayment(0);
                      setInstallments([
                        {
                          installment_number: 1,
                          amount: totalPrice,
                          due_date: new Date().toISOString().split('T')[0],
                          payment_method: 'PIX',
                          notes: 'Pagamento Integral À Vista',
                        },
                      ]);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      paymentMode === 'A_VISTA'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    À Vista
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode('PARCELADO');
                      handleGenerateInstallments();
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      paymentMode === 'PARCELADO'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Parcelado
                  </button>
                </div>
              </div>

              {/* Inputs de valor e gerador */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor Total Fechado (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min={1}
                      value={totalPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTotalPrice(val);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-slate-900 font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                {paymentMode === 'PARCELADO' && (
                  <>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Entrada / Sinal (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={totalPrice}
                          value={downPayment}
                          onChange={(e) => setDownPayment(Number(e.target.value))}
                          placeholder="0.00"
                          className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Número de Parcelas
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={numInstallments}
                          onChange={(e) => setNumInstallments(Number(e.target.value))}
                          className="flex-1 rounded-xl border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden focus:border-purple-500"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                            <option key={n} value={n}>
                              {n}x {n === 1 ? '(Parcela única)' : `parcelas`}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleGenerateInstallments}
                          className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition cursor-pointer flex items-center gap-1 shrink-0"
                          title="Distribuir valores automaticamente"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Gerar</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Tabela de parcelas customizáveis */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Cronograma de Vencimento e Parcelas ({installments.length})
                  </span>
                  <span
                    className={`font-bold ${
                      isSumMatching
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    Soma: R$ {installmentsSum.toFixed(2)} / R$ {totalPrice.toFixed(2)}
                    {isSumMatching ? ' ✓' : ' ⚠️ Ajuste os valores'}
                  </span>
                </div>

                <div className="overflow-auto max-h-60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 select-none">
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs text-slate-700 dark:text-slate-300 font-semibold">Parcela</th>
                        <th className="py-2.5 px-3 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs text-slate-700 dark:text-slate-300 font-semibold">Valor (R$)</th>
                        <th className="py-2.5 px-3 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs text-slate-700 dark:text-slate-300 font-semibold">Vencimento</th>
                        <th className="py-2.5 px-3 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs text-slate-700 dark:text-slate-300 font-semibold">Meio</th>
                        <th className="py-2.5 px-3 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs text-slate-700 dark:text-slate-300 font-semibold">Identificação / Nota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {installments.map((inst, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-bold text-purple-700 dark:text-purple-400">
                            {inst.installment_number}ª Parcela
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min={0.01}
                              value={inst.amount}
                              onChange={(e) => updateInstallment(idx, 'amount', Number(e.target.value))}
                              className="w-24 rounded-lg border border-slate-300 bg-white p-1 text-slate-900 font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={inst.due_date}
                              onChange={(e) => updateInstallment(idx, 'due_date', e.target.value)}
                              className="rounded-lg border border-slate-300 bg-white p-1 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={inst.payment_method}
                              onChange={(e) => updateInstallment(idx, 'payment_method', e.target.value)}
                              className="rounded-lg border border-slate-300 bg-white p-1 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              <option value="PIX">PIX</option>
                              <option value="CARTAO">Cartão</option>
                              <option value="BOLETO">Boleto</option>
                              <option value="DINHEIRO">Dinheiro</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={inst.notes || ''}
                              onChange={(e) => updateInstallment(idx, 'notes', e.target.value)}
                              placeholder={`Parcela ${inst.installment_number}/${installments.length}`}
                              className="w-full rounded-lg border border-slate-300 bg-white p-1 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer CFP */}
          <div className="rounded-xl bg-purple-50/70 border border-purple-200/60 p-3 text-[11px] text-purple-900 dark:bg-purple-950/40 dark:border-purple-800/60 dark:text-purple-300 flex items-start gap-2">
            <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
            <div>
              <strong>Integração com Agenda, Prontuário e Finanças:</strong> {canViewFinancial 
                ? 'Ao confirmar, o sistema abrirá o processo de avaliação, gerará o rascunho do Laudo Clínico estruturado (CFP 06/2019) e inserirá as parcelas no módulo financeiro da clínica para envio de cobrança PIX e emissão de recibos individuais para convênios. As sessões agendadas na Agenda terão marcação especial com custo zerado pelo pacote.'
                : 'Ao confirmar, o sistema abrirá o processo de avaliação e gerará o rascunho do Laudo Clínico estruturado (CFP 06/2019). O plano financeiro será configurado pela recepção/administração para liberação do agendamento das sessões.'
              }
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isSumMatching}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-500 disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting ? (
                <span>Salvando Avaliação...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirmar & Iniciar Avaliação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
