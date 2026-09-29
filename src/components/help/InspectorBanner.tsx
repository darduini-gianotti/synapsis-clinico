import React from 'react';
import { HelpCircle, X, Sparkles, BrainCircuit } from 'lucide-react';
import { useHelp } from '../../contexts/HelpContext.js';

export const InspectorBanner: React.FC = () => {
  const { isInspectorActive, closeInspector, openHelpCenter } = useHelp();

  if (!isInspectorActive) return null;

  return (
    <aside
      data-inspector-ui="true"
      className="sticky top-0 z-50 bg-gradient-to-r from-teal-500 via-indigo-600 to-purple-600 text-white px-4 py-2.5 shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200"
      aria-label="Aviso do Modo Lente Inteligente Ativado"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
        <div className="truncate">
          <div className="text-xs font-black text-white flex items-center gap-1.5 truncate uppercase tracking-wider">
            <BrainCircuit className="w-4 h-4 text-white shrink-0 stroke-[2.5]" />
            <span>Modo Lente Inteligente Ativo (Apontar & Explicar com IA)</span>
          </div>
          <p className="text-[11px] font-medium text-white/90 truncate">
            Clique em qualquer botão ou elemento da tela para ver sua explicação clínica e legal gerada por IA.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={openHelpCenter}
          className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-sm transition flex items-center gap-1.5 cursor-pointer border border-white/30"
          title="Abrir o Copiloto Clínico com perguntas abertas"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden sm:inline">Copiloto IA</span>
        </button>

        <button
          type="button"
          onClick={closeInspector}
          className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-950 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border border-white/10"
          title="Encerrar o Modo Lente (tecla ESC)"
        >
          <X className="w-3.5 h-3.5" />
          <span>Sair (ESC)</span>
        </button>
      </div>
    </aside>
  );
};
