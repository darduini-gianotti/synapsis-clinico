import React, { useState, useEffect, useRef } from 'react';
import { useAcademy } from '../../context/AcademyContext.js';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  X,
  GraduationCap,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';

export const TourSpotlightOverlay: React.FC = () => {
  const {
    activeTour,
    activeStepIndex,
    activeStep,
    advanceStep,
    skipStep,
    exitSandbox,
    startTour,
    userProgress,
    finishTourAndOpenCatalog,
  } = useAcademy();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [elementFound, setElementFound] = useState<boolean>(false);
  const clickListenerAttached = useRef<Element | null>(null);

  const isTourCompleted = activeTour && activeStepIndex >= activeTour.steps.length;

  // Poll and measure target element
  useEffect(() => {
    if (!activeStep || isTourCompleted) {
      setTargetRect(null);
      setElementFound(false);
      return;
    }

    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds total

    const checkElement = () => {
      if (!isMounted) return;
      const el = document.querySelector(activeStep.targetSelector);

      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        setElementFound(true);

        // Smooth scroll if element is not in visible viewport
        const isInViewport =
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth);

        if (!isInViewport) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Attach target click listener for hands-on progression
        if (activeStep.advanceOnTargetClick && el !== clickListenerAttached.current) {
          if (clickListenerAttached.current) {
            clickListenerAttached.current.removeEventListener('click', handleTargetClick);
          }
          el.addEventListener('click', handleTargetClick);
          clickListenerAttached.current = el;
        }
      } else {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkElement, 100);
        } else {
          setElementFound(false);
          setTargetRect(null);
        }
      }
    };

    const handleTargetClick = () => {
      // Short delay to allow regular UI action to execute before advancing tour
      setTimeout(() => {
        advanceStep();
      }, 300);
    };

    checkElement();

    const handleResizeOrScroll = () => {
      const el = document.querySelector(activeStep.targetSelector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      isMounted = false;
      if (clickListenerAttached.current) {
        clickListenerAttached.current.removeEventListener('click', handleTargetClick);
        clickListenerAttached.current = null;
      }
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [activeStep, isTourCompleted, advanceStep]);

  if (!activeTour) return null;

  // Completion Screen (Modal de Conclusão e Repetição)
  if (isTourCompleted) {
    const currentProg = userProgress[activeTour.id];
    const repCount = currentProg?.completed_count || 1;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
        <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-teal-500/40 shadow-2xl p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-950/80 dark:text-teal-400 mb-4 animate-bounce">
            <GraduationCap className="h-9 w-9" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold mb-3">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Procedimento Concluído com Sucesso
          </div>

          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
            {activeTour.title}
          </h3>

          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            Parabéns! Você concluiu todas as etapas deste procedimento prático no ambiente seguro da Synapsis Academy.
          </p>

          <div className="my-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3.5 flex items-center justify-around text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Trilha</span>
              <strong className="text-slate-800 dark:text-slate-200 capitalize">{activeTour.category}</strong>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Status</span>
              <strong className="text-emerald-600 dark:text-emerald-400">100% Capacitado</strong>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Práticas Realizadas</span>
              <strong className="text-teal-600 dark:text-teal-400 font-bold">{repCount} {repCount === 1 ? 'vez' : 'vezes'}</strong>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => startTour(activeTour.id)}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 transition cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Praticar Novamente
            </button>

            <button
              onClick={finishTourAndOpenCatalog}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-sm font-semibold text-white shadow-lg shadow-teal-600/30 transition cursor-pointer"
            >
              Ver Trilhas & Progresso
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={exitSandbox}
            className="mt-3.5 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 font-medium transition cursor-pointer block mx-auto"
          >
            Encerrar simulação e voltar ao consultório
          </button>
        </div>
      </div>
    );
  }

  if (!activeStep) return null;

  // Calculate tooltip placement position
  const pad = 8;
  const tooltipWidth = 340;
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  if (targetRect) {
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceRight = window.innerWidth - targetRect.right;

    if (activeStep.placement === 'right' && spaceRight > tooltipWidth + 20) {
      tooltipStyle.top = Math.max(16, targetRect.top);
      tooltipStyle.left = targetRect.right + 16;
    } else if (activeStep.placement === 'left' && targetRect.left > tooltipWidth + 20) {
      tooltipStyle.top = Math.max(16, targetRect.top);
      tooltipStyle.left = targetRect.left - tooltipWidth - 16;
    } else if (spaceBelow > 220) {
      tooltipStyle.top = targetRect.bottom + 16;
      tooltipStyle.left = Math.max(16, Math.min(targetRect.left, window.innerWidth - tooltipWidth - 20));
    } else {
      tooltipStyle.bottom = Math.max(16, window.innerHeight - targetRect.top + 16);
      tooltipStyle.left = Math.max(16, Math.min(targetRect.left, window.innerWidth - tooltipWidth - 20));
    }
  } else {
    // Fallback if element not yet measured: center bottom
    tooltipStyle = {
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      maxWidth: 360,
    };
  }

  return (
    <>
      {/* Glowing Pulsing Focus Ring directly on the target element (100% bright without screen darkening) */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-40 rounded-xl ring-4 ring-teal-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-[0_0_25px_rgba(20,184,166,0.7)] animate-pulse transition-all duration-200"
          style={{
            left: targetRect.left - pad,
            top: targetRect.top - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
          }}
        >
          {/* Beacon pulse indicator at the top-right corner of the button */}
          <span className="absolute -top-3 -right-3 flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-6 w-6 bg-teal-600 text-white text-[11px] font-black items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
              {activeStepIndex + 1}
            </span>
          </span>
        </div>
      )}

      {/* Guidance Tooltip Card */}
      <div
        style={tooltipStyle}
        className="w-full max-w-[340px] rounded-2xl bg-white dark:bg-slate-900 border-2 border-teal-500 p-4 shadow-2xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[10px] font-extrabold text-white">
              {activeStepIndex + 1}
            </span>
            <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">
              Etapa {activeStepIndex + 1} de {activeTour.steps.length}
            </span>
          </div>

          <button
            onClick={exitSandbox}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition"
            title="Encerrar Treino"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
          {activeStep.title}
        </h4>

        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
          {activeStep.description}
        </p>

        {activeStep.actionPrompt && (
          <div className="mt-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/80 px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-teal-800 dark:text-teal-300">
            <Sparkles className="h-3.5 w-3.5 shrink-0 animate-spin text-teal-600" />
            <span>{activeStep.actionPrompt}</span>
          </div>
        )}

        {/* Buttons: Pular Passo / Próximo */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={skipStep}
            className="text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 font-medium transition cursor-pointer"
          >
            Pular etapa
          </button>

          <button
            onClick={advanceStep}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
          >
            <span>{activeStepIndex + 1 === activeTour.steps.length ? 'Concluir' : 'Avançar'}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
};
