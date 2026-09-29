import React, { useMemo } from 'react';
import {
  X,
  HelpCircle,
  Sun,
  ShieldCheck,
  LogOut,
  Calendar,
  Filter,
  Plus,
  FileText,
  Lock,
  Shield,
  Brain,
  FileCheck,
  Receipt,
  CheckCircle,
  FileSpreadsheet,
  Coins,
  Download,
  CheckSquare,
  Scale,
  Sparkles,
  Lightbulb,
  Loader2,
  BrainCircuit,
  MessageSquare
} from 'lucide-react';
import { useHelp } from '../../contexts/HelpContext.js';
import { CATEGORY_LABELS } from './helpData.js';

const ICONS_MAP: Record<string, React.ReactNode> = {
  HelpCircle: <HelpCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
  Sun: <Sun className="w-5 h-5 text-amber-500" />,
  ShieldCheck: <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
  LogOut: <LogOut className="w-5 h-5 text-rose-500" />,
  Calendar: <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
  Filter: <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  Plus: <Plus className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
  FileText: <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
  Lock: <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
  Shield: <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  Brain: <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
  FileCheck: <FileCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
  Receipt: <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
  CheckCircle: <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
  FileSpreadsheet: <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
  Coins: <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
  Download: <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
  CheckSquare: <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
  Sparkles: <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
};

export const InspectorPopover: React.FC = () => {
  const {
    isInspectorActive,
    activeHelpItem,
    targetRect,
    isLoadingAiExplanation,
    clearActiveItem,
    closeInspector,
    openHelpCenter
  } = useHelp();

  const coords = useMemo(() => {
    if (!targetRect) return null;

    const CARD_WIDTH = 380;
    const CARD_HEIGHT_APPROX = 440;
    const MARGIN = 12;

    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

    let left = targetRect.right + MARGIN;
    let top = targetRect.top;

    // Se ultrapassar a margem direita da tela, inverte para a esquerda do elemento
    if (left + CARD_WIDTH > winW - 16) {
      left = targetRect.left - CARD_WIDTH - MARGIN;
    }

    // Se ainda assim vazar à esquerda (elemento muito largo ou tela estreita), posiciona abaixo ou centraliza
    if (left < 16) {
      left = Math.max(16, Math.min(targetRect.left, winW - CARD_WIDTH - 16));
      top = targetRect.bottom + MARGIN;
    }

    // Ajusta o topo para não vazar o rodapé da janela
    if (top + CARD_HEIGHT_APPROX > winH - 16) {
      top = Math.max(16, winH - CARD_HEIGHT_APPROX - 16);
    }

    top = Math.max(16, top);

    return { left, top };
  }, [targetRect]);

  if (!isInspectorActive || !targetRect || !coords) {
    return null;
  }

  const category = activeHelpItem
    ? (CATEGORY_LABELS[activeHelpItem.category as keyof typeof CATEGORY_LABELS] || CATEGORY_LABELS.geral)
    : CATEGORY_LABELS.geral;

  return (
    <>
      {/* Spotlight Ring ao redor do elemento inspecionado */}
      <div
        className="fixed pointer-events-none z-[60] rounded-xl ring-4 ring-teal-400 shadow-[0_0_30px_rgba(20,184,166,0.65)] transition-all duration-200 animate-pulse"
        style={{
          top: targetRect.top - 3,
          left: targetRect.left - 3,
          width: targetRect.width + 6,
          height: targetRect.height + 6,
        }}
      />

      {/* Popover Ancorado Contextual */}
      <div
        data-inspector-ui="true"
        className="fixed z-[70] w-[380px] rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xl dark:border-slate-700/80 dark:bg-slate-900 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
        style={{
          top: coords.top,
          left: coords.left,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isLoadingAiExplanation ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-indigo-600 text-white flex items-center justify-center shadow-md animate-pulse">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-500" />
                <span>Copiloto IA analisando componente...</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Consultando rotinas operacionais e resoluções do CFP
              </p>
            </div>
          </div>
        ) : activeHelpItem ? (
          <>
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                  {ICONS_MAP[activeHelpItem.iconName || 'Sparkles'] || <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${category.color}`}>
                      {category.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <Sparkles className="h-2.5 w-2.5" /> IA
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {activeHelpItem.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={clearActiveItem}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Fechar explicação (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo: O que é */}
            <div className="mt-3.5 space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                  O que esta funcionalidade faz:
                </span>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                  {activeHelpItem.description}
                </p>
              </div>

              {activeHelpItem.howToUse && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                    Como utilizar:
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                    {activeHelpItem.howToUse}
                  </p>
                </div>
              )}

              {/* Destaque: Importância Clínica & Legal */}
              <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200/80 dark:bg-teal-950/30 dark:border-teal-900/60 text-teal-900 dark:text-teal-200">
                <div className="flex items-center gap-1.5 mb-1 font-bold text-[11px] text-teal-800 dark:text-teal-300">
                  <Scale className="w-3.5 h-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                  <span>Importância Clínica & Legal (CFP / LGPD / Fiscal)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-teal-900/90 dark:text-teal-200/90 font-medium">
                  {activeHelpItem.clinicalAndLegalTip}
                </p>
              </div>

              {/* Dica Prática */}
              {activeHelpItem.bestPractice && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200">
                  <Lightbulb className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="leading-snug">
                    <span className="font-bold">Dica Prática: </span>
                    <span>{activeHelpItem.bestPractice}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé com botão de tirar mais dúvidas */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={openHelpCenter}
                className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer"
              >
                <MessageSquare className="h-3 w-3" />
                <span>Perguntar ao Copiloto</span>
              </button>

              <button
                type="button"
                onClick={closeInspector}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              >
                Sair do Modo Lente
              </button>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
};
