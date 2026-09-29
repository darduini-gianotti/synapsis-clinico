import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Brain,
  Clock,
  Send,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api.js';

export interface LiveScratchpadPanelProps {
  patientId: number;
  patientName: string;
  sessionId?: number;
  onApplyEvolution?: (dap: { dados: string; avaliacao: string; plano: string }) => void;
  className?: string;
  compact?: boolean;
}

export const LiveScratchpadPanel: React.FC<LiveScratchpadPanelProps> = ({
  patientId,
  patientName,
  sessionId,
  onApplyEvolution,
  className = '',
  compact = false,
}) => {
  const storageKey = `psicogestao_scratchpad_${patientId}`;
  
  const [notes, setNotes] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  });

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [modelType, setModelType] = useState<'DAP' | 'BIRP'>('DAP');
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [consolidatedResult, setConsolidatedResult] = useState<{
    dap?: { dados: string; avaliacao: string; plano: string };
    summary?: string;
    cfpNote?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Auto-save no localStorage para segurança de rascunho
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, notes);
      setLastSaved(new Date());
    } catch (e) {
      console.warn('Falha ao salvar rascunho:', e);
    }
  }, [notes, storageKey]);

  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleClear = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      setTimeout(() => setConfirmingClear(false), 4000);
      return;
    }
    setNotes('');
    setConsolidatedResult(null);
    setConfirmingClear(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  const handleConsolidate = async () => {
    if (!notes.trim()) {
      setFeedback('Digite ao menos algumas anotações ou tópicos antes de consolidar.');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setIsConsolidating(true);
    setFeedback(null);

    try {
      const res = await api.post('/ai/generate-evolution', {
        patientId,
        currentNotes: notes.trim(),
        modelType: 'DAP',
      });

      if (res.data && res.data.dap) {
        setConsolidatedResult({
          dap: res.data.dap,
          summary: res.data.summary,
          cfpNote: res.data.cfpComplianceNote,
        });
        setFeedback('Evolução consolidada pela IA com sucesso!');
        setTimeout(() => setFeedback(null), 3000);
      } else {
        throw new Error('Formato de resposta inesperado da IA');
      }
    } catch (err: any) {
      console.error(err);
      setFeedback(err.response?.data?.error || 'Erro ao processar anotações com IA.');
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsConsolidating(false);
    }
  };

  const handleApplyToForm = () => {
    if (!consolidatedResult?.dap) return;
    if (onApplyEvolution) {
      onApplyEvolution(consolidatedResult.dap);
      setFeedback('Evolução transferida para o formulário do prontuário!');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleCopyText = () => {
    if (!consolidatedResult?.dap) return;
    const text = `REGISTRO DE EVOLUÇÃO (CFP 06/2019) - ${patientName}\n\n[D] DADOS:\n${consolidatedResult.dap.dados}\n\n[A] AVALIAÇÃO:\n${consolidatedResult.dap.avaliacao}\n\n[P] PLANO:\n${consolidatedResult.dap.plano}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-slate-200 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              Live Scratchpad Clínico
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                IA CFP
              </span>
            </span>
            <p className="text-[10px] text-slate-400">Anotações rápidas em tempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Salvo
            </span>
          )}
          {notes.trim().length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className={`p-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 ${
                confirmingClear
                  ? 'bg-rose-600 text-white font-bold px-2 py-0.5'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-rose-400'
              }`}
              title={confirmingClear ? 'Clique novamente para confirmar a limpeza' : 'Limpar anotações'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmingClear && <span className="text-[10px]">Limpar?</span>}
            </button>
          )}
        </div>
      </div>

      {/* Textarea de Anotações */}
      <div className="p-3.5 flex-1 flex flex-col space-y-2.5">
        <div className="relative flex-1 min-h-[140px]">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Digite tópicos soltos durante o atendimento...&#10;Ex: Paciente relata conflito com irmão na quarta-feira. Queixa de insônia e pensamentos catastróficos. Aplicada técnica de reestruturação cognitiva. Acordado RPD para próxima semana."
            className="w-full h-full min-h-[140px] p-3 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition resize-y leading-relaxed font-sans"
          />
        </div>

        {/* Barra de Ações de Consolidação */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Modelo:</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-teal-300 border border-slate-700">
              DAP (Dados, Avaliação, Plano)
            </span>
          </div>

          <button
            type="button"
            onClick={handleConsolidate}
            disabled={isConsolidating || !notes.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs shadow-md transition disabled:opacity-40 cursor-pointer"
          >
            {isConsolidating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sintetizando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Consolidar com IA</span>
              </>
            )}
          </button>
        </div>

        {feedback && (
          <div className="text-[11px] px-3 py-1.5 rounded-lg bg-teal-950/70 border border-teal-800/60 text-teal-300 flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5 text-teal-400" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Resultado Consolidado pela IA */}
        {consolidatedResult?.dap && (
          <div className="mt-2 p-3 bg-slate-950 rounded-xl border border-teal-800/60 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                Minuta Técnica Estruturada (CFP)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-semibold transition cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
                {onApplyEvolution && (
                  <button
                    type="button"
                    onClick={handleApplyToForm}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[10.5px] font-bold transition shadow-xs cursor-pointer"
                  >
                    <span>Preencher Prontuário</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div>
                <span className="font-bold text-slate-400">[D] DADOS: </span>
                <span className="text-slate-200">{consolidatedResult.dap.dados}</span>
              </div>
              <div>
                <span className="font-bold text-slate-400">[A] AVALIAÇÃO: </span>
                <span className="text-slate-200">{consolidatedResult.dap.avaliacao}</span>
              </div>
              <div>
                <span className="font-bold text-slate-400">[P] PLANO: </span>
                <span className="text-slate-200">{consolidatedResult.dap.plano}</span>
              </div>
            </div>

            {consolidatedResult.summary && (
              <p className="text-[10px] text-teal-400/90 italic pt-1 border-t border-slate-800/80">
                "{consolidatedResult.summary}"
              </p>
            )}
          </div>
        )}

        {/* Rodapé de Segurança e Sigilo */}
        <div className="flex items-center justify-between pt-1 text-[9.5px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Notas confidenciais do profissional. Áudio não gravado.</span>
          </span>
          <span>CFP nº 06/2019</span>
        </div>
      </div>
    </div>
  );
};
