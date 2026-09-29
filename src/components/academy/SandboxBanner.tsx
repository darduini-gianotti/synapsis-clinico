import React from 'react';
import { useAcademy } from '../../context/AcademyContext.js';
import { ShieldAlert, LogOut, Sparkles, GraduationCap } from 'lucide-react';

export const SandboxBanner: React.FC = () => {
  const { isSandboxActive, activeTour, exitSandbox } = useAcademy();

  if (!isSandboxActive) return null;

  return (
    <aside
      aria-label="Aviso de ambiente de treinamento da Synapsis Academy"
      className="sticky top-0 z-50 w-full bg-gradient-to-r from-amber-500 via-teal-600 to-emerald-600 px-4 py-2 text-white shadow-md transition-all duration-300"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 text-xs font-medium">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-white font-bold animate-pulse">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold tracking-wide uppercase bg-black/20 px-2 py-0.5 rounded text-[11px]">
              Modo Simulação Academy
            </span>
            <span className="hidden sm:inline text-white/90">
              Dados fictícios de treinamento em memória • Sua clínica real está 100% protegida
            </span>
            {activeTour && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white truncate">
                Procedimento: {activeTour.title}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={exitSandbox}
          className="flex items-center gap-1.5 shrink-0 rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 text-xs font-bold text-white transition cursor-pointer border border-white/30"
          title="Encerrar Simulação e Voltar para Dados Reais"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Encerrar Simulação</span>
        </button>
      </div>
    </aside>
  );
};
