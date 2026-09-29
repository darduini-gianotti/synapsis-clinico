import React from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Cake,
} from 'lucide-react';

interface DashboardMetricsRowProps {
  totalSessions: number;
  confirmedSessions: number;
  inProgressOrUpcoming: number;
  birthdaysThisWeek: number;
  selectedPsychologistName?: string;
}

export const DashboardMetricsRow: React.FC<DashboardMetricsRowProps> = ({
  totalSessions,
  confirmedSessions,
  inProgressOrUpcoming,
  birthdaysThisWeek,
  selectedPsychologistName,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* 1. Atendimentos Hoje */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850 shadow-2xs">
        <div className="p-1 rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 shrink-0">
          <CalendarCheck className="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Hoje:</span>
          <span className="font-extrabold text-slate-900 dark:text-white font-mono">
            {totalSessions}
          </span>
          <span className="text-[11px] text-slate-400">
            {totalSessions === 1 ? 'sessão' : 'sessões'}
          </span>
        </div>
      </div>

      {/* 2. Presenças Confirmadas */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850 shadow-2xs">
        <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Confirmados:</span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {confirmedSessions}
          </span>
          {totalSessions > 0 && (
            <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-semibold">
              ({Math.round((confirmedSessions / totalSessions) * 100)}%)
            </span>
          )}
        </div>
      </div>

      {/* 3. Em Andamento / Próximos */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850 shadow-2xs">
        <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shrink-0">
          <Clock className="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Restantes:</span>
          <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
            {inProgressOrUpcoming}
          </span>
          <span className="text-[11px] text-slate-400">no turno</span>
        </div>
      </div>

      {/* 4. Aniversariantes da Semana */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850 shadow-2xs">
        <div className="p-1 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 shrink-0">
          <Cake className="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Aniversários:</span>
          <span className="font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {birthdaysThisWeek}
          </span>
          <span className="text-[11px] text-slate-400">nesta semana</span>
        </div>
      </div>
    </div>
  );
};
