import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { RepasseBatch, RepasseBatchItem, RepasseAdjustment } from '../types.js';
import { generateRepassePdf } from '../utils/repassePdfGenerator.js';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  AlertCircle,
  FileText,
  Layers,
  ShieldCheck,
  CreditCard,
  X,
  Sparkles,
  User,
  Users,
  Activity
} from 'lucide-react';

interface PsychologistSummaryResponse {
  psychologist: {
    id: number;
    name: string;
    crp_number: string | null;
    repasse_mode: 'PERCENTAGE' | 'FIXED_PER_SESSION';
    repasse_percentage: number;
    repasse_eval_percentage: number;
    repasse_fixed_amount: number | null;
    pix_key: string | null;
    pix_key_type: string | null;
  };
  stats: {
    total_sessions_month: number;
    total_paid_sessions_month: number;
    pending_patient_payment_sessions: number;
    accrued_repasse_month: number;
    total_received_year: number;
  };
  eligible_sessions: Array<{
    session_id?: number | null;
    evaluation_id?: number | null;
    service_date: string;
    patient_name: string;
    service_type: string;
    service_label: string;
    repasse_rate: number;
    repasse_amount: number;
    payment_status: string;
    paid_at?: string | null;
    payment_method?: string | null;
  }>;
  batches: RepasseBatch[];
}

export const PsychologistProductivityModule: React.FC = () => {
  const { user, isAdmin, isSecretary, hasPermission } = useAuth();
  const canSelectAny = isAdmin || isSecretary || hasPermission('view_financial') || hasPermission('manage_repasses');

  const [psychologists, setPsychologists] = useState<Array<{ id: number; name: string; crp_number: string | null }>>([]);
  const [selectedPsychId, setSelectedPsychId] = useState<number | null>(null);

  const [data, setData] = useState<PsychologistSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'sessions' | 'batches'>('sessions');

  // Batch Details Modal
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<{
    batch: RepasseBatch;
    items: RepasseBatchItem[];
    adjustments: RepasseAdjustment[];
  } | null>(null);
  const [isLoadingBatchDetails, setIsLoadingBatchDetails] = useState(false);

  // Carrega lista de psicólogos se tiver privilégio de gestão
  useEffect(() => {
    if (canSelectAny) {
      api.get('/collaborators')
        .then((res) => {
          const psychList = (res.data.users || []).filter(
            (u: any) => u.role_name === 'Psicólogo' || u.role_id === 2
          );
          setPsychologists(psychList);
        })
        .catch((err) => console.error('Failed to load psychologists list:', err));
    }
  }, [canSelectAny, user?.id]);

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: any = {};
      const idToFetch = canSelectAny ? selectedPsychId : user?.id;
      if (canSelectAny && idToFetch) {
        params.psychologist_id = idToFetch;
      }
      const res = await api.get('/repasse/my-summary', { params });
      setData(res.data);
      if (canSelectAny && res.data?.psychologist?.id && selectedPsychId === null) {
        setSelectedPsychId(res.data.psychologist.id);
      }
    } catch (err: any) {
      console.error('Failed to load psychologist summary:', err);
      setError(err.response?.data?.error || 'Erro ao carregar seu extrato de produtividade.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [user?.id, selectedPsychId, canSelectAny]);

  const handleOpenBatchDetails = async (batchId: number) => {
    try {
      setIsLoadingBatchDetails(true);
      const res = await api.get(`/repasse/batches/${batchId}`);
      setSelectedBatchDetails(res.data);
    } catch (err: any) {
      console.error('Failed to load batch details:', err);
      alert('Erro ao carregar detalhes do lote.');
    } finally {
      setIsLoadingBatchDetails(false);
    }
  };

  const handleDownloadBatchPdf = async (batchId: number) => {
    try {
      const res = await api.get(`/repasse/batches/${batchId}`);
      const { batch, items, adjustments } = res.data;
      generateRepassePdf({
        batch,
        items,
        adjustments,
        clinic_settings: {
          clinic_name: 'PsicoGestão Clínica Integrada',
          cnpj: '12.345.678/0001-90',
          phone: '(11) 99999-8888',
          email: 'contato@psicogestao.com.br',
          address: 'Av. Paulista, 1000 - São Paulo/SP'
        }
      });
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert('Erro ao gerar extrato em PDF.');
    }
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

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full mb-2" />
        <p>Carregando sua produtividade e repasses...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
        <AlertCircle className="h-6 w-6 shrink-0" />
        <div>
          <p className="font-bold">Não foi possível carregar o resumo de produtividade</p>
          <p className="text-xs mt-0.5">{error || 'Verifique se seu usuário possui perfil de psicólogo.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Seletor de Gestão de Psicólogo (Exclusivo para Administrador e Secretária) */}
      {canSelectAny && psychologists.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Auditoria de Produtividade da Equipe
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                  {isAdmin ? 'Administrador' : isSecretary ? 'Secretária' : 'Gestão'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecione o profissional para auditar atendimentos do mês, taxas contratuais e fechamentos de repasse.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <label htmlFor="select-psychologist-productivity" className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
              Profissional:
            </label>
            <select
              id="select-psychologist-productivity"
              value={selectedPsychId || (data?.psychologist?.id || '')}
              onChange={(e) => {
                const newId = Number(e.target.value);
                setSelectedPsychId(newId);
              }}
              className="px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden min-w-[240px] cursor-pointer"
            >
              {psychologists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.crp_number ? `(${p.crp_number})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Header Profile Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
              {data.psychologist.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {data.psychologist.name}
                </h1>
                {data.psychologist.crp_number && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
                    {data.psychologist.crp_number}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Portal de Produtividade & Repasse de Honorários • Sigilo Financeiro Assegurado
              </p>
            </div>
          </div>

          {/* Contractual badge */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
            <div className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span>Parâmetros Contratuais Ativos</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
              <span>
                Psicoterapia:{' '}
                <strong>
                  {data.psychologist.repasse_mode === 'FIXED_PER_SESSION'
                    ? formatCurrency(data.psychologist.repasse_fixed_amount)
                    : `${data.psychologist.repasse_percentage}%`}
                </strong>
              </span>
              <span>
                Avaliação Neuro:{' '}
                <strong>{data.psychologist.repasse_eval_percentage}%</strong>
              </span>
              {data.psychologist.pix_key && (
                <span className="col-span-2 mt-1">
                  Chave PIX: <strong>{data.psychologist.pix_key}</strong> (
                  {data.psychologist.pix_key_type || 'PIX'})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800/50">
          <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-teal-600" />
            Atendimentos (Mês)
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
            {data.stats.total_sessions_month}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Realizados no mês atual</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800/50">
          <span className="text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Quitados pelo Paciente
          </span>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {data.stats.total_paid_sessions_month}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Elegíveis para repasse</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800/50">
          <span className="text-[11px] font-semibold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Aguardando Quitação
          </span>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5">
            {data.stats.pending_patient_payment_sessions}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Aguardando pagamento do paciente</span>
        </div>

        <div className="rounded-2xl border border-teal-500 bg-teal-600 text-white p-4 shadow-md">
          <span className="text-[11px] font-semibold uppercase text-teal-100 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Repasse Apurado (Mês)
          </span>
          <p className="text-2xl font-black mt-1.5">
            {formatCurrency(data.stats.accrued_repasse_month)}
          </p>
          <span className="text-[10px] text-teal-200 mt-1 block">Sobre sessões pagas</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800/50">
          <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-teal-600" />
            Total Recebido (Ano)
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
            {formatCurrency(data.stats.total_received_year)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Lotes quitados em 2026</span>
        </div>
      </div>

      {/* Zero Knowledge Confidentiality Pill */}
      <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0" />
        <span>
          <strong>Sigilo Financeiro Ativo:</strong> Esta área exibe exclusivamente a sua produtividade e o valor
          líquido de seus honorários. Valores globais e dados de faturamento da clínica são estritamente preservados
          conforme o protocolo de Zero-Knowledge da plataforma.
        </span>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'sessions'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Atendimentos do Mês Atual ({data.eligible_sessions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('batches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'batches'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Extratos & Lotes de Repasse ({data.batches.length})</span>
        </button>
      </div>

      {/* TAB 1: SESSIONS */}
      {activeSubTab === 'sessions' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800/50 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Sessões Realizadas no Mês Vigente
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Apenas sessões quitadas pelo paciente geram repasse
            </span>
          </div>

          {data.eligible_sessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
              Nenhum atendimento registrado neste mês até o momento.
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[320px]">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 select-none">
                  <tr>
                    <th className="p-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Data</th>
                    <th className="p-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Paciente</th>
                    <th className="p-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Tipo de Atendimento</th>
                    <th className="p-3 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Taxa (%)</th>
                    <th className="p-3 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Seu Repasse</th>
                    <th className="p-3 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Status Quitação Paciente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.eligible_sessions.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td className="p-3 font-medium text-slate-900 dark:text-white">
                        {formatDate(item.service_date)}
                      </td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                        {item.patient_name}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.service_type === 'EVALUATION'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                              : 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
                          }`}
                        >
                          {item.service_label}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold">{item.repasse_rate}%</td>
                      <td className="p-3 text-right font-extrabold text-teal-600 dark:text-teal-400">
                        {formatCurrency(item.repasse_amount)}
                      </td>
                      <td className="p-3 text-center">
                        {item.payment_status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Pago ({item.payment_method || 'PIX'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                            <Clock className="h-3 w-3" />
                            Aguardando Paciente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BATCHES / EXTRATOS */}
      {activeSubTab === 'batches' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-800/50 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Histórico de Lotes & Extratos Oficiais
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lotes fechados pela administração clínica com discriminação detalhada e extratos em PDF.
            </p>
          </div>

          {data.batches.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
              Nenhum lote de repasse fechado até o momento.
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[320px]">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 select-none">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Lote Nº</th>
                    <th className="p-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Período de Apuração</th>
                    <th className="p-3 text-center bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Atendimentos</th>
                    <th className="p-3 text-right bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Subtotal</th>
                    <th className="p-3 text-right bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Ajustes (+ / -)</th>
                    <th className="p-3 text-right bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Líquido a Receber</th>
                    <th className="p-3 text-center bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Status</th>
                    <th className="p-3 text-right bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Extrato Oficial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                        {batch.batch_number}
                      </td>
                      <td className="p-3">
                        {formatDate(batch.period_start)} a {formatDate(batch.period_end)}
                      </td>
                      <td className="p-3 text-center font-bold">{batch.total_sessions_count}</td>
                      <td className="p-3 text-right text-slate-500">
                        {formatCurrency(batch.repasse_subtotal)}
                      </td>
                      <td className="p-3 text-right">
                        {batch.deductions_amount > 0 && (
                          <span className="text-rose-600 block">
                            -{formatCurrency(batch.deductions_amount)}
                          </span>
                        )}
                        {batch.additions_amount > 0 && (
                          <span className="text-emerald-600 block">
                            +{formatCurrency(batch.additions_amount)}
                          </span>
                        )}
                        {batch.deductions_amount === 0 && batch.additions_amount === 0 && '-'}
                      </td>
                      <td className="p-3 text-right font-black text-teal-600 dark:text-teal-400">
                        {formatCurrency(batch.net_repasse_amount)}
                      </td>
                      <td className="p-3 text-center">
                        {batch.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Quitado ({formatDate(batch.payment_date || batch.paid_at)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                            <Clock className="h-3 w-3" />
                            Aguardando Pagamento
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenBatchDetails(batch.id)}
                            title="Ver Detalhes do Extrato"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadBatchPdf(batch.id)}
                            title="Baixar Extrato Oficial (PDF)"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-[11px] shadow-2xs transition"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: EXTRATO COMPLETO DO LOTE */}
      {selectedBatchDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-600 text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Extrato de Repasse: {selectedBatchDetails.batch.batch_number}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Período: {formatDate(selectedBatchDetails.batch.period_start)} a{' '}
                    {formatDate(selectedBatchDetails.batch.period_end)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBatchDetails(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Financial Snapshot */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Subtotal</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatCurrency(selectedBatchDetails.batch.repasse_subtotal)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Ajustes</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    +{formatCurrency(selectedBatchDetails.batch.additions_amount)} / -
                    {formatCurrency(selectedBatchDetails.batch.deductions_amount)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Líquido</span>
                  <p className="text-sm font-extrabold text-teal-600 dark:text-teal-400">
                    {formatCurrency(selectedBatchDetails.batch.net_repasse_amount)}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  Atendimentos Vinculados ({selectedBatchDetails.items.length})
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 select-none">
                      <tr>
                        <th className="p-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Data</th>
                        <th className="p-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Paciente</th>
                        <th className="p-2.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Serviço</th>
                        <th className="p-2.5 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Taxa</th>
                        <th className="p-2.5 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 shadow-2xs">Repasse</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedBatchDetails.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5">{formatDate(item.service_date)}</td>
                          <td className="p-2.5 font-medium">{item.patient_name || '-'}</td>
                          <td className="p-2.5">{item.service_label || item.service_type}</td>
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
              {selectedBatchDetails.adjustments.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                    Lançamentos Extras / Descontos ({selectedBatchDetails.adjustments.length})
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedBatchDetails.adjustments.map((adj, idx) => (
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
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDownloadBatchPdf(selectedBatchDetails.batch.id)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition"
              >
                <Download className="h-4 w-4" />
                <span>Baixar Extrato Oficial (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedBatchDetails(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
