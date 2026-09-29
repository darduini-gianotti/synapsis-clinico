import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { Patient, NeuropsychEvaluation, Session, FinancialTransaction } from '../../types.js';
import { NewEvaluationModal } from './NewEvaluationModal.js';
import { EvaluationReceiptModal } from './EvaluationReceiptModal.js';
import { EvaluationReportModal } from './EvaluationReportModal.js';
import { EditEvaluationModal } from './EditEvaluationModal.js';
import {
  Brain,
  Plus,
  CheckCircle2,
  Clock,
  DollarSign,
  FileSignature,
  Printer,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calendar,
  AlertCircle,
  Save,
  Check,
  CreditCard,
  ShieldCheck,
  FileText,
  HelpCircle,
  Award,
  ExternalLink,
  Pencil,
} from 'lucide-react';

interface PatientEvaluationsSubTabProps {
  patient: Patient;
}

export const PatientEvaluationsSubTab: React.FC<PatientEvaluationsSubTabProps> = ({ patient }) => {
  const { user, isAdmin, hasPermission } = useAuth();
  const canStartEvaluations = isAdmin || Boolean(hasPermission('start_evaluations'));
  const canViewFinancial = isAdmin || Boolean(hasPermission('view_financial'));

  const [evaluations, setEvaluations] = useState<NeuropsychEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [receiptModalConfig, setReceiptModalConfig] = useState<{
    evaluationId: number;
    transactionId?: number | null;
  } | null>(null);
  const [selectedForReportId, setSelectedForReportId] = useState<number | null>(null);
  const [selectedForEditId, setSelectedForEditId] = useState<number | null>(null);

  // Active section inside evaluation view
  const [activeSubSection, setActiveSubSection] = useState<'timeline' | 'finances' | 'report'>('timeline');

  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchEvaluations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get(`/evaluations/patient/${patient.id}`);
      setEvaluations(res.data.evaluations || []);
    } catch (err: any) {
      console.error('Failed to load patient evaluations:', err);
      setError('Erro ao carregar avaliações neuropsicológicas do paciente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [patient.id]);

  const handleSettleInstallment = async (txId: number) => {
    try {
      await api.patch(`/financial/transactions/${txId}/status`, {
        status: 'PAID',
        payment_method: 'PIX',
      });
      showFeedback('Baixa da parcela efetuada com sucesso! Recibo disponível para emissão.', 'success');
      fetchEvaluations();
    } catch (err: any) {
      console.error('Error settling installment:', err);
      showFeedback(err.response?.data?.error || 'Erro ao dar baixa na parcela.', 'error');
    }
  };

  const handleCompleteEvaluation = async (evalId: number, nextStatus: 'AWAITING_DEVOLUTIVA' | 'COMPLETED') => {
    if (nextStatus === 'COMPLETED') {
      setSelectedForReportId(evalId);
      return;
    }

    if (!window.confirm('Deseja atualizar a avaliação para "Aguardando Sessão de Devolutiva"?')) return;

    try {
      const res = await api.post(`/evaluations/${evalId}/complete`, {
        status: nextStatus,
      });

      showFeedback(res.data.message || 'Status atualizado com sucesso!', 'success');
      fetchEvaluations();
    } catch (err: any) {
      console.error('Error completing evaluation:', err);
      showFeedback(err.response?.data?.error || 'Erro ao atualizar avaliação.', 'error');
    }
  };

  const activeEvaluation = evaluations[0]; // Most recent or primary

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-5 text-white shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-purple-300">
            <Brain className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>Avaliação Neuropsicológica & Laudos</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-purple-200 font-bold uppercase tracking-wider">
                CFP 06/2019
              </span>
            </h2>
            <p className="text-xs text-purple-200/80">
              Contratação por pacote fechado, cronograma flexível de parcelas e emissão de laudos oficiais.
            </p>
          </div>
        </div>

        {canStartEvaluations && (
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Avaliação</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent mb-3" />
          <p>Carregando avaliações neuropsicológicas...</p>
        </div>
      ) : evaluations.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 mb-4">
            <Brain className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Nenhuma avaliação neuropsicológica em andamento
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Abra um processo de avaliação neuropsicológica para {patient.full_name}. Você poderá definir o valor fechado, flexibilizar parcelas com recibos para convênios e redigir o Laudo estruturado conforme a Resolução CFP nº 06/2019.
          </p>
          {canStartEvaluations && (
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Contratar Avaliação Neuropsicológica</span>
            </button>
          )}
        </div>
      ) : (
        /* Active Evaluation Main View */
        <div className="space-y-6">
          {evaluations.map((ev) => {
            const isCompleted = ev.status === 'COMPLETED';
            const isAwaitingDevolutiva = ev.status === 'AWAITING_DEVOLUTIVA';
            const totalPaid = ev.total_paid || 0;
            const totalPrice = ev.total_price || 1;
            const paidPercent = Math.min(100, Math.round((totalPaid / totalPrice) * 100));

            return (
              <div
                key={ev.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5"
              >
                {/* Evaluation Card Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : isAwaitingDevolutiva
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        }`}
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Concluída & Laudo Emitido</span>
                          </>
                        ) : isAwaitingDevolutiva ? (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>Aguardando Devolutiva</span>
                          </>
                        ) : (
                          <>
                            <Brain className="h-3 w-3" />
                            <span>Em Andamento</span>
                          </>
                        )}
                      </span>

                      {ev.financial_status === 'PENDING_PRICING' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          <span>Aguardando Plano Financeiro</span>
                        </span>
                      )}

                      <span className="text-slate-400 text-xs">•</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Iniciada em {new Date(ev.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {ev.title}
                    </h3>
                    {ev.hypothesis_diagnosis && (
                      <p className="text-xs text-purple-700 dark:text-purple-300 font-medium mt-0.5">
                        Hipótese em Investigação: {ev.hypothesis_diagnosis}
                      </p>
                    )}
                  </div>

                  {/* Financial KPI pill & Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    {ev.financial_status === 'PENDING_PRICING' ? (
                      canViewFinancial ? (
                        <button
                          type="button"
                          onClick={() => setSelectedForEditId(ev.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                          title="Definir Valor do Pacote e Parcelas"
                        >
                          <DollarSign className="h-4 w-4" />
                          <span>Definir Condições Comerciais</span>
                        </button>
                      ) : (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 dark:bg-amber-950/40 dark:border-amber-800 text-right">
                          <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">
                            Financeiro
                          </span>
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                            Aguardando Recepção
                          </span>
                        </div>
                      )
                    ) : (
                      canViewFinancial && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 dark:bg-slate-800 dark:border-slate-700 text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Pacote Total
                          </span>
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            R$ {Number(ev.total_price).toFixed(2)}
                          </span>
                        </div>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedForEditId(ev.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold transition cursor-pointer"
                      title="Editar Dados da Avaliação e Plano Financeiro"
                    >
                      <Pencil className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setReceiptModalConfig({
                          evaluationId: ev.id,
                          transactionId: null, // Consolidated receipt
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                      title="Emitir Recibo Consolidado do Pacote"
                    >
                      <Printer className="h-4 w-4 text-slate-500" />
                      <span>Recibo Geral</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedForReportId(ev.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-xs font-semibold transition cursor-pointer"
                      title="Abrir Laudo Neuropsicológico Oficial (CFP 06/2019)"
                    >
                      <FileSignature className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span>Laudo Oficial</span>
                    </button>

                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCompleteEvaluation(
                            ev.id,
                            isAwaitingDevolutiva ? 'COMPLETED' : 'AWAITING_DEVOLUTIVA'
                          )
                        }
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition shadow-xs cursor-pointer ${
                          isAwaitingDevolutiva
                            ? 'bg-emerald-600 hover:bg-emerald-500'
                            : 'bg-amber-600 hover:bg-amber-500'
                        }`}
                      >
                        <Award className="h-4 w-4" />
                        <span>{isAwaitingDevolutiva ? 'Finalizar Laudo Oficial' : 'Agendar Devolutiva'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Financial Progress Bar */}
                <div className="space-y-1.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-400">
                      Progresso Financeiro ({paidPercent}% quitado)
                    </span>
                    <span className="text-slate-900 dark:text-white">
                      R$ {totalPaid.toFixed(2)} de R$ {Number(ev.total_price).toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubSection('timeline')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      activeSubSection === 'timeline'
                        ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Sessões & Bateria de Testes ({ev.sessions_count || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubSection('finances')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      activeSubSection === 'finances'
                        ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    <DollarSign className="h-4 w-4" />
                    <span>Parcelas & Recibos Convênio ({ev.installments?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubSection('report');
                      setSelectedForReportId(ev.id);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      activeSubSection === 'report'
                        ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    <FileSignature className="h-4 w-4" />
                    <span>Laudo Psicológico CFP 06/2019</span>
                    <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
                  </button>
                </div>

                {/* Section 1: Timeline de Sessões e Testes */}
                {activeSubSection === 'timeline' && (
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                          Linha do Tempo de Aplicação ({ev.sessions?.length || 0} de {ev.estimated_sessions} sessões previstas)
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Sessões com custo zerado no agendamento, cobertas pelo pacote fechado.
                        </p>
                      </div>

                      {ev.financial_status === 'PENDING_PRICING' ? (
                        <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>Agendamentos bloqueados: aguardando definição do plano financeiro pela Recepção/Gestão.</span>
                        </div>
                      ) : (
                        <div className="text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 rounded-lg border border-purple-200 dark:border-purple-800/50">
                          💡 Para agendar, acesse a <strong>Agenda</strong> e selecione "Avaliação Neuropsicológica (Pacote)".
                        </div>
                      )}
                    </div>

                    {(!ev.sessions || ev.sessions.length === 0) ? (
                      <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        Nenhuma sessão de avaliação vinculada ainda. Agende o primeiro horário na Agenda com o tipo "Avaliação Neuropsicológica".
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        {ev.sessions.map((sess, idx) => (
                          <div
                            key={sess.id}
                            className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold text-[11px]">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>
                                    {new Date(sess.start_time).toLocaleDateString('pt-BR')} às{' '}
                                    {sess.start_time.split('T')[1]?.substring(0, 5)}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {sess.modality === 'ONLINE' ? 'Teleconsulta' : 'Presencial'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {sess.notes || 'Sessão de aplicação de bateria de testes neuropsicológicos'}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                sess.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : sess.status === 'CONFIRMED'
                                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {sess.status === 'COMPLETED'
                                ? 'Realizada'
                                : sess.status === 'CONFIRMED'
                                ? 'Confirmada'
                                : 'Agendada'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Section 2: Parcelamento & Recibos Convênio */}
                {activeSubSection === 'finances' && (
                  <div className="space-y-4 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                          Plano Financeiro & Recibos por Parcela para Convênio
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Gere recibos individuais por parcela paga para que o paciente solicite reembolso mensal no plano de saúde.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedForEditId(ev.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer self-start sm:self-auto"
                        title="Reajustar parcelas, valores e vencimentos"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Reajustar Plano / Parcelas</span>
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-auto max-h-[calc(100vh-270px)] min-h-[220px]">
                      <table className="w-full text-left text-xs border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 select-none">
                          <tr className="border-b border-slate-200 dark:border-slate-800">
                            <th className="py-2.5 px-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-700 dark:text-slate-300">Parcela</th>
                            <th className="py-2.5 px-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-700 dark:text-slate-300">Valor (R$)</th>
                            <th className="py-2.5 px-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-700 dark:text-slate-300">Vencimento</th>
                            <th className="py-2.5 px-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-700 dark:text-slate-300">Meio</th>
                            <th className="py-2.5 px-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-700 dark:text-slate-300">Status</th>
                            <th className="py-2.5 px-3.5 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-slate-700 dark:text-slate-300">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {ev.installments?.map((inst) => {
                            const isPaid = inst.status === 'PAID';
                            return (
                              <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="py-3 px-3.5 font-bold text-purple-700 dark:text-purple-400">
                                  {inst.installment_number}ª Parcela
                                  {inst.notes && (
                                    <span className="block text-[10px] font-normal text-slate-400">
                                      {inst.notes}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white">
                                  R$ {Number(inst.amount).toFixed(2)}
                                </td>
                                <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300">
                                  {new Date(inst.transaction_date).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="py-3 px-3.5">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                    {inst.payment_method}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      isPaid
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    }`}
                                  >
                                    {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                    {isPaid ? 'Pago' : 'Pendente'}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {isPaid ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setReceiptModalConfig({
                                            evaluationId: ev.id,
                                            transactionId: inst.id,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-bold transition cursor-pointer"
                                      >
                                        <Printer className="h-3.5 w-3.5" />
                                        <span>Recibo Convênio</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleSettleInstallment(inst.id)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition shadow-xs cursor-pointer"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                        <span>Dar Baixa</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Section 3: Resumo do Laudo & Abertura no Modal Estruturado CFP 06/2019 */}
                {activeSubSection === 'report' && (
                  <div className="space-y-4 pt-1">
                    <div className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/30 dark:bg-purple-950/20 p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 dark:border-purple-900/40 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs shrink-0">
                            <FileSignature className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                Laudo Neuropsicológico (Resolução CFP nº 06/2019)
                              </h4>
                              {ev.draft_document?.is_signed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <ShieldCheck className="h-3 w-3" />
                                  <span>Assinado Digitalmente</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  <Clock className="h-3 w-3" />
                                  <span>Rascunho em Elaboração</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Estruturado nas 6 seções normatizadas do CFP, com identificação completa, seletor de responsável legal, preview timbrado A4 e selo criptográfico SHA-256.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedForReportId(ev.id)}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
                        >
                          <FileSignature className="h-4 w-4" />
                          <span>Abrir Editor & Laudo Timbrado</span>
                        </button>
                      </div>

                      {/* Grid compacto de status */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                          <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            Responsável Legal:
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white truncate block">
                            {ev.draft_document?.content?.identificacao?.responsavel || 'Conforme Ficha do Paciente'}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                          <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            Hipótese Diagnóstica:
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white truncate block">
                            {ev.hypothesis_diagnosis || 'Não informada'}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                          <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            Autenticidade Criptográfica:
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white truncate block">
                            {ev.draft_document?.hash_sha256
                              ? `SHA-256: ${ev.draft_document.hash_sha256.substring(0, 12)}...`
                              : 'Pendente de assinatura'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nova Avaliação */}
      <NewEvaluationModal
        patient={patient}
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => {
          showFeedback('Avaliação Neuropsicológica iniciada com sucesso!', 'success');
          fetchEvaluations();
        }}
      />

      {/* Modal Recibo Convênio */}
      {receiptModalConfig && (
        <EvaluationReceiptModal
          evaluationId={receiptModalConfig.evaluationId}
          transactionId={receiptModalConfig.transactionId}
          isOpen={true}
          onClose={() => setReceiptModalConfig(null)}
        />
      )}

      {/* Modal: Visualizador & Editor Estruturado de Laudo (CFP 06/2019) */}
      {selectedForReportId !== null && (
        <EvaluationReportModal
          isOpen={selectedForReportId !== null}
          evaluationId={selectedForReportId}
          onClose={() => setSelectedForReportId(null)}
          onSuccess={() => fetchEvaluations()}
        />
      )}

      {/* Modal: Edição de Dados da Avaliação & Plano de Parcelas */}
      {selectedForEditId !== null && (
        <EditEvaluationModal
          isOpen={selectedForEditId !== null}
          evaluationId={selectedForEditId}
          onClose={() => setSelectedForEditId(null)}
          onSuccess={() => {
            setSelectedForEditId(null);
            fetchEvaluations();
            showFeedback('Avaliação e plano financeiro atualizados com sucesso!', 'success');
          }}
        />
      )}
    </div>
  );
};
