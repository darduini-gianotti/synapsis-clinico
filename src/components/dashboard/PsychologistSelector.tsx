import React from 'react';
import { Session } from '../../types.js';
import {
  Users,
  Building,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export interface PsychologistItem {
  id: number;
  name: string;
  email: string;
  role_name: string;
  crp_number?: string | null;
}

interface PsychologistSelectorProps {
  psychologists: PsychologistItem[];
  selectedId: 'ALL' | number;
  onSelect: (id: 'ALL' | number) => void;
  sessionsToday: Session[];
  isLoading: boolean;
}

export const PsychologistSelector: React.FC<PsychologistSelectorProps> = ({
  psychologists,
  selectedId,
  onSelect,
  sessionsToday,
  isLoading,
}) => {
  const now = new Date();
  const currentIso = now.toISOString();

  // Helper to calculate real-time status of a psychologist
  const getPsychologistStatus = (psychologistId: number) => {
    const psychSessions = sessionsToday.filter(
      (s) => s.psychologist_id === psychologistId && s.status !== 'CANCELED'
    );

    if (psychSessions.length === 0) {
      return {
        label: 'Livre hoje',
        dot: 'bg-slate-400',
        badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      };
    }

    // Check if currently in session
    const active = psychSessions.find(
      (s) => s.start_time <= currentIso && s.end_time >= currentIso && s.status !== 'COMPLETED'
    );
    if (active) {
      return {
        label: 'Em atendimento agora',
        dot: 'bg-emerald-500 animate-pulse',
        badge: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    }

    // Check next upcoming session
    const upcoming = psychSessions
      .filter((s) => s.start_time > currentIso)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (upcoming.length > 0) {
      const nextTime = new Date(upcoming[0].start_time).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        label: `Próximo às ${nextTime}`,
        dot: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    }

    // All completed
    return {
      label: 'Sessões encerradas',
      dot: 'bg-indigo-400',
      badge: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    };
  };

  const totalSessionsCount = sessionsToday.filter((s) => s.status !== 'CANCELED').length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
            Equipe de Psicólogos
          </h3>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {psychologists.length} profissionais
        </span>
      </div>

      {/* Button: Toda a Clínica (Visão Geral) */}
      <button
        type="button"
        onClick={() => onSelect('ALL')}
        className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
          selectedId === 'ALL'
            ? 'border-teal-500 bg-teal-50/80 dark:bg-teal-950/40 dark:border-teal-400 shadow-2xs'
            : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-800/60 dark:hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition ${
              selectedId === 'ALL'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <Building className="h-4 w-4" />
          </div>
          <div>
            <span
              className={`block text-xs font-bold ${
                selectedId === 'ALL'
                  ? 'text-teal-950 dark:text-white'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              Toda a Clínica (Geral)
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Visão consolidada do dia
            </span>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              selectedId === 'ALL'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {totalSessionsCount}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">atendimentos</span>
        </div>
      </button>

      {/* List of Psychologists */}
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Carregando equipe clínica...
          </div>
        ) : psychologists.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Nenhum psicólogo cadastrado.
          </div>
        ) : (
          psychologists.map((psych) => {
            const isSelected = selectedId === psych.id;
            const psychSessions = sessionsToday.filter(
              (s) => s.psychologist_id === psych.id && s.status !== 'CANCELED'
            );
            const status = getPsychologistStatus(psych.id);

            const initials = psych.name
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((n) => n[0])
              .join('')
              .toUpperCase();

            return (
              <div
                key={psych.id}
                onClick={() => onSelect(psych.id)}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 dark:border-teal-400 shadow-2xs'
                    : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* Avatar */}
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition ${
                        isSelected
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {initials}
                    </div>

                    <div>
                      <h4
                        className={`text-xs font-bold leading-snug ${
                          isSelected
                            ? 'text-teal-950 dark:text-white'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {psych.name}
                      </h4>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        {psych.crp_number ? `CRP ${psych.crp_number}` : 'Psicólogo(a)'}
                      </p>
                    </div>
                  </div>

                  {/* Sessions count badge */}
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isSelected
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {psychSessions.length}
                  </span>
                </div>

                {/* Status Pill in real-time */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-700/50 flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${status.dot}`} />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {status.label}
                    </span>
                  </div>
                  <span className="text-slate-400">
                    {psychSessions.length === 1 ? '1 sessão' : `${psychSessions.length} sessões`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
