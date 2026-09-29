import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { NeuropsychEvaluation } from '../types.js';
import { NewEvaluationModal } from './patients/NewEvaluationModal.js';
import { EvaluationReceiptModal } from './patients/EvaluationReceiptModal.js';
import { EditEvaluationModal } from './patients/EditEvaluationModal.js';
import { EvaluationReportModal } from './patients/EvaluationReportModal.js';
import {
  Brain,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  CalendarClock,
  DollarSign,
  TrendingUp,
  User,
  FileText,
  Receipt,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Eye,
  Check,
  Save,
  X,
  Pencil,
} from 'lucide-react';

interface NeuropsychEvaluationsModuleProps {
  onNavigateToPatient?: (patientId: number, tab?: 'overview' | 'profile' | 'clinical', subTab?: any) => void;
}

export const NeuropsychEvaluationsModule: React.FC<NeuropsychEvaluationsModuleProps> = ({
  onNavigateToPatient,
}) => {
  const { user, hasPermission } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || Boolean(user?.permissions?.includes('manage_users'));
  const canViewFinancial = isAdmin || Boolean(user?.permissions?.includes('view_financial'));
  const canStartEvaluations = isAdmin || Boolean(hasPermission('start_evaluations'));

  const [evaluations, setEvaluations] = useState<NeuropsychEvaluation[]>([]);
  const [stats, setStats] = useState<{
    in_progress: number;
    awaiting_devolutiva: number;
    completed: number;
    financial_summary: {
      total_contracted: number;
      total_received: number;
      total_pending: number;
    } | null;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'AWAITING_DEVOLUTIVA' | 'COMPLETED'>('ALL');
  const [psychologistFilter, setPsychologistFilter] = useState<string>('ALL');
  const [psychologists, setPsychologists] = useState<any[]>([]);

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedForEditId, setSelectedForEditId] = useState<number | null>(null);
  const [selectedForReportId, setSelectedForReportId] = useState<number | null>(null);
  const [selectedForReceipt, setSelectedForReceipt] = useState<{
    evaluationId: number;
    transactionId?: number;
  } | null>(null);

  const fetchEvaluations = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (psychologistFilter !== 'ALL') params.psychologist_id = psychologistFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/evaluations', { params });
      setEvaluations(res.data.evaluations || []);
      setStats(res.data.stats || null);
    } catch (err) {
      console.error('Failed to load evaluations hub:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [statusFilter, psychologistFilter]);

  useEffect(() => {
    if (isAdmin) {
      api.get('/users').then((res) => {
        const psychs = (res.data.users || []).filter((u: any) => u.role === 'PSYCHOLOGIST' || u.role === 'ADMIN');
        setPsychologists(psychs);
      }).catch(console.error);
    }
  }, [isAdmin]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvaluations();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md shadow-purple-600/30">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Avaliações Neuropsicológicas & Laudos
                </h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <ShieldCheck className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  <span>CFP 06/2019</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hub executivo centralizado: contratação por pacote fechado, timeline de testagem, parcelamento flexível e emissão de laudos oficiais.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchEvaluations()}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:border-purple-300 transition cursor-pointer shadow-xs"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-purple-600' : ''}`} />
          </button>

          {canStartEvaluations && (
            <button
              onClick={() => setIsNewModalOpen(true)}
              data-help-id="avaliacao-nova"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Nova Avaliação</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Cards de KPIs Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Em Andamento */}
        <div className="rounded-2xl border border-purple-200/80 bg-gradient-to-br from-white to-purple-50/40 p-4 shadow-xs dark:border-purple-900/40 dark:from-slate-900 dark:to-purple-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">
              Em Teste
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300">
              <Brain className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats?.in_progress ?? 0}
            </span>
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
              avaliações ativas
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Sessões de testagem e baterias em aplicação
          </p>
        </div>

        {/* Card 2: Aguardando Devolutiva */}
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/40 p-4 shadow-xs dark:border-amber-900/40 dark:from-slate-900 dark:to-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Aguardando Devolutiva
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats?.awaiting_devolutiva ?? 0}
            </span>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              laudos em redação
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Baterias concluídas, prontas para entrega
          </p>
        </div>

        {/* Card 3: Concluídas / Laudo Emitido */}
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-xs dark:border-emerald-900/40 dark:from-slate-900 dark:to-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
              Laudos Emitidos
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats?.completed ?? 0}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              finalizadas
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Devolutivas realizadas e laudos assinados
          </p>
        </div>

        {/* Card 4: Financeiro de Pacotes (Condicional à Permissão) */}
        {canViewFinancial && stats?.financial_summary ? (
          <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-white to-indigo-50/40 p-4 shadow-xs dark:border-indigo-900/40 dark:from-slate-900 dark:to-indigo-950/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                Faturamento de Pacotes
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                R$ {stats.financial_summary.total_received.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                / R$ {stats.financial_summary.total_contracted.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Saldo a receber:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                R$ {stats.financial_summary.total_pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/50 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider">Sigilo Profissional</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Acesso exclusivo aos dados técnicos e clínicos das avaliações sob sua responsabilidade.
            </p>
          </div>
        )}
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-help-id="avaliacao-busca-filtro"
              placeholder="Buscar por paciente, CPF ou hipótese diagnóstica..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
              <Filter className="h-3.5 w-3.5" />
              <span>Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              data-help-id="avaliacao-filtro-status"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2 px-3 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500"
            >
              <option value="ALL">Todos os Status</option>
              <option value="IN_PROGRESS">Em Teste</option>
              <option value="AWAITING_DEVOLUTIVA">Aguardando Devolutiva</option>
              <option value="COMPLETED">Laudo Emitido (Concluído)</option>
            </select>

            {isAdmin && psychologists.length > 0 && (
              <select
                value={psychologistFilter}
                onChange={(e) => setPsychologistFilter(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2 px-3 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500"
              >
                <option value="ALL">Todos os Psicólogos</option>
                {psychologists.map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    {ps.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              Filtrar
            </button>
          </div>
        </form>
      </div>

      {/* Tabela Rica de Avaliações - Compacta & Blindada contra Overflow com Cabeçalho Sticky */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden w-full">
        <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px] w-full">
          <table className="w-full text-left text-xs min-w-[880px] border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-3.5 py-2.5 text-[11px] bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs">Paciente</th>
                <th className="px-3.5 py-2.5 text-[11px] bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs">Demanda Clínica & Hipótese</th>
                <th className="px-3.5 py-2.5 text-[11px] bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs">Responsável Técnico</th>
                <th className="px-3.5 py-2.5 text-[11px] bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs">Sessões de Testagem</th>
                {canViewFinancial && <th className="px-3.5 py-2.5 text-[11px] bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs">Progresso Financeiro</th>}
                <th className="px-3.5 py-2.5 text-[11px] bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs">Situação</th>
                <th className="px-3.5 py-2.5 text-[11px] text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={canViewFinancial ? 7 : 6} className="py-10 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-purple-500 mb-2" />
                    <span className="text-xs">Carregando avaliações neuropsicológicas...</span>
                  </td>
                </tr>
              ) : evaluations.length === 0 ? (
                <tr>
                  <td colSpan={canViewFinancial ? 7 : 6} className="py-10 text-center text-slate-400">
                    <Brain className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300 text-xs">Nenhuma avaliação encontrada</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Clique em "+ Nova Avaliação" para cadastrar o primeiro processo de avaliação neuropsicológica.
                    </p>
                  </td>
                </tr>
              ) : (
                evaluations.map((ev) => {
                  const patientInitials = (ev.patient_name || 'P')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('');

                  const sessionProgress = ev.estimated_sessions > 0
                    ? Math.min(100, Math.round(((ev.sessions_count || 0) / ev.estimated_sessions) * 100))
                    : 0;

                  const finPaid = Number(ev.total_paid) || 0;
                  const finTotal = Number(ev.total_price) || 0;
                  const finProgress = finTotal > 0 ? Math.min(100, Math.round((finPaid / finTotal) * 100)) : 0;

                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition">
                      {/* Paciente */}
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold text-[10px] border border-purple-200 dark:border-purple-800">
                            {patientInitials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs leading-tight">
                              {ev.patient_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono leading-tight">
                              CPF: {ev.patient_cpf || 'Não informado'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Demanda & Hipótese */}
                      <td className="px-3.5 py-2.5 max-w-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate text-xs">
                          {ev.title}
                        </div>
                        {ev.hypothesis_diagnosis ? (
                          <div className="text-[10px] text-purple-600 dark:text-purple-400 truncate mt-0.5" title={ev.hypothesis_diagnosis}>
                            🔍 {ev.hypothesis_diagnosis}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">Sem hipótese preliminar</div>
                        )}
                      </td>

                      {/* Psicólogo */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs leading-tight">
                          {ev.psychologist_name}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight">
                          {ev.psychologist_crp || 'CRP Ativo'}
                        </div>
                      </td>

                      {/* Sessões de Testagem */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {ev.sessions_count || 0}/{ev.estimated_sessions}
                          </span>
                          <span className="text-[10px] text-slate-400">sessões</span>
                        </div>
                        <div className="w-20 h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${sessionProgress}%` }}
                          />
                        </div>
                      </td>

                      {/* Progresso Financeiro (se permitido) */}
                      {canViewFinancial && (
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          {ev.total_price !== null ? (
                            <div>
                              <div className="flex items-center gap-1 font-bold text-xs">
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  R$ {finPaid.toFixed(2)}
                                </span>
                                <span className="text-slate-400 text-[10px]">/ R$ {finTotal.toFixed(2)}</span>
                              </div>
                              <div className="w-20 h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                  style={{ width: `${finProgress}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                      )}

                      {/* Situação */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {ev.status === 'IN_PROGRESS' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                            <Clock className="h-2.5 w-2.5" />
                            <span>Em Teste</span>
                          </span>
                        )}
                        {ev.status === 'AWAITING_DEVOLUTIVA' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <CalendarClock className="h-2.5 w-2.5" />
                            <span>Aguardando Devolutiva</span>
                          </span>
                        )}
                        {ev.status === 'COMPLETED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            <span>Laudo Emitido</span>
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ação 1: Editar Avaliação / Plano de Parcelas */}
                          <button
                            type="button"
                            onClick={() => setSelectedForEditId(ev.id)}
                            data-help-id="avaliacao-editar"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800/80 transition cursor-pointer"
                            title="Editar Dados e Plano Financeiro"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Editar</span>
                          </button>

                          {/* Ação 2: Laudo Oficial CFP 06/2019 */}
                          <button
                            type="button"
                            onClick={() => setSelectedForReportId(ev.id)}
                            data-help-id="avaliacao-laudo"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800/80 transition cursor-pointer"
                            title="Ver / Redigir Laudo Técnico"
                          >
                            <FileText className="h-3 w-3" />
                            <span>Laudo</span>
                          </button>

                          {/* Ação 3: Recibo Timbrado com Selo SHA-256 */}
                          {canViewFinancial && (
                            <button
                              type="button"
                              onClick={() => setSelectedForReceipt({ evaluationId: ev.id })}
                              data-help-id="avaliacao-recibo"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                              title="Emitir Recibo do Convênio com Selo Digital"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>Recibo</span>
                            </button>
                          )}

                          {/* Ação 4: Ir diretamente para o Prontuário Clínico -> Avaliações & Laudos */}
                          {onNavigateToPatient && (
                            <button
                              type="button"
                              onClick={() => onNavigateToPatient(ev.patient_id, 'clinical', 'evaluations')}
                              data-help-id="avaliacao-ver-prontuario"
                              className="inline-flex items-center gap-1 p-1 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Abrir diretamente no Prontuário Clínico (Aba Avaliações)"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
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

      {/* Modal: Nova Avaliação (acesso direto pelo Hub) */}
      {isNewModalOpen && (
        <NewEvaluationModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSuccess={() => {
            setIsNewModalOpen(false);
            fetchEvaluations();
          }}
        />
      )}

      {/* Modal: Editar Avaliação & Plano de Parcelas */}
      {selectedForEditId !== null && (
        <EditEvaluationModal
          isOpen={selectedForEditId !== null}
          evaluationId={selectedForEditId}
          onClose={() => setSelectedForEditId(null)}
          onSuccess={() => {
            setSelectedForEditId(null);
            fetchEvaluations();
          }}
        />
      )}

      {/* Modal: Recibo Timbrado Oficial (com Selo SHA-256) */}
      {selectedForReceipt && (
        <EvaluationReceiptModal
          isOpen={true}
          evaluationId={selectedForReceipt.evaluationId}
          transactionId={selectedForReceipt.transactionId}
          onClose={() => setSelectedForReceipt(null)}
        />
      )}

      {/* Modal: Visualizador & Editor Estruturado de Laudo (CFP 06/2019) */}
      {selectedForReportId !== null && (
        <EvaluationReportModal
          isOpen={selectedForReportId !== null}
          evaluationId={selectedForReportId}
          onClose={() => setSelectedForReportId(null)}
          onSuccess={() => fetchEvaluations()}
          onNavigateToPatientProntuario={(patientId) => {
            setSelectedForReportId(null);
            if (onNavigateToPatient) {
              onNavigateToPatient(patientId, 'clinical', 'evaluations');
            }
          }}
        />
      )}
    </div>
  );
};
