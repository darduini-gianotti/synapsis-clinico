import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Target,
  ArrowRight,
  ShieldCheck,
  ListTodo,
  Clock,
  Layers,
} from 'lucide-react';
import { SessionPrepInsightsResponse } from '../../../server/aiService.js';

interface SessionPrepCardProps {
  patientId: number;
  patientName?: string;
  apiClient: any;
  onStartEvolution?: (initialFocusText?: string) => void;
  defaultCollapsed?: boolean;
}

export const SessionPrepCard: React.FC<SessionPrepCardProps> = ({
  patientId,
  patientName,
  apiClient,
  onStartEvolution,
  defaultCollapsed = false,
}) => {
  const [insights, setInsights] = useState<SessionPrepInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});

  const fetchInsights = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await apiClient.post('/ai/session-prep-insights', { patientId });
      setInsights(res.data);
    } catch (err: any) {
      console.error('Failed to load session prep insights:', err);
      setErrorMessage(err.response?.data?.error || 'Não foi possível carregar os insights da próxima sessão.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchInsights();
    }
  }, [patientId]);

  const toggleTaskCheck = (index: number) => {
    setCheckedTasks((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="rounded-2xl border border-teal-200/70 bg-linear-to-br from-teal-50/40 via-white to-indigo-50/30 p-5 shadow-xs dark:border-teal-900/50 dark:bg-linear-to-br dark:from-teal-950/20 dark:via-slate-900 dark:to-indigo-950/20 transition-all">
      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-teal-100 dark:border-teal-900/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-teal-600 to-indigo-600 text-white shadow-md shadow-teal-500/20 shrink-0">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Preparação da Próxima Sessão
              </h3>
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                Synapsis IA • Fase 2
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Análise longitudinal das últimas sessões • Resolução CFP 06/2019
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={fetchInsights}
            disabled={isLoading}
            title="Atualizar análise longitudinal com base nas últimas evoluções"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-2xs transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-teal-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
          <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
          <p className="text-xs font-medium animate-pulse">
            Sintetizando histórico clínico e preparando sugestões para a consulta...
          </p>
        </div>
      )}

      {/* Error state */}
      {!isLoading && errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Conteúdo Expandido */}
      {!isLoading && !isCollapsed && insights && (
        <div className="mt-4 space-y-4 text-xs animate-in fade-in duration-200">
          {/* 1. Resumo Executivo da Trajetória */}
          <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-teal-100 dark:border-teal-900/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 block mb-1">
              Trajetória Clínica Recente:
            </span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              {insights.summary}
            </p>
            {insights.lastSessionHighlight && (
              <span className="inline-block mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                📌 {insights.lastSessionHighlight}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 2. Tarefas e Combinados Pendentes */}
            <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2.5">
                <ListTodo className="h-4 w-4 text-amber-500" />
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  Tarefas & Combinados para Checar Hoje
                </h4>
              </div>

              {insights.tasksPending && insights.tasksPending.length > 0 ? (
                <div className="space-y-2">
                  {insights.tasksPending.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => toggleTaskCheck(idx)}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border transition cursor-pointer ${
                        checkedTasks[idx]
                          ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40 line-through text-slate-400'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checkedTasks[idx])}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-xs block leading-tight">{item.task}</span>
                        {item.sessionDate && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Acordado em: {item.sessionDate}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic text-[11px]">
                  Nenhuma pendência ou exercício específico registrado nas sessões anteriores.
                </p>
              )}
            </div>

            {/* 3. Padrões e Gatilhos Recorrentes */}
            <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2.5">
                <Layers className="h-4 w-4 text-indigo-500" />
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  Gatilhos & Padrões Recorrentes
                </h4>
              </div>

              {insights.recurringThemes && insights.recurringThemes.length > 0 ? (
                <div className="space-y-2">
                  {insights.recurringThemes.map((theme, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {theme.theme}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                          Frequência: {theme.frequency}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {theme.observation}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic text-[11px]">
                  Padrões em consolidação. Conforme novas evoluções forem registradas, temas recorrentes serão mapeados.
                </p>
              )}
            </div>
          </div>

          {/* 4. Sugestões de Foco Clínico & Perguntas Reflexivas */}
          {insights.suggestedClinicalFocus && insights.suggestedClinicalFocus.length > 0 && (
            <div className="p-3.5 rounded-xl bg-teal-50/30 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <h4 className="font-bold text-teal-900 dark:text-teal-200 text-xs uppercase tracking-wider">
                  Foco Sugerido para Condução & Perguntas Abertas
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {insights.suggestedClinicalFocus.map((focus, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900/40"
                  >
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block mb-1">
                      🎯 {focus.topic}
                    </span>
                    <p className="text-[11px] text-teal-700 dark:text-teal-300 italic leading-relaxed">
                      "{focus.reflectiveQuestion}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Alertas Preventivos de Acompanhamento */}
          {insights.attentionAlerts && insights.attentionAlerts.length > 0 && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300">
              <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Acompanhamento Clínico: </span>
                {insights.attentionAlerts.join(' • ')}
              </div>
            </div>
          )}

          {/* Rodapé com Ação Rápida */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400">
              {insights.disclaimer}
            </span>

            {onStartEvolution && (
              <button
                type="button"
                onClick={() => {
                  const focusTopic = insights.suggestedClinicalFocus?.[0]?.topic;
                  onStartEvolution(focusTopic ? `Foco da sessão: ${focusTopic}.` : undefined);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs shadow-teal-600/20 transition cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Iniciar Evolução desta Sessão</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
