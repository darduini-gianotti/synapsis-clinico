import React from 'react';
import { Session } from '../../types.js';
import {
  Clock,
  Video,
  Building,
  PlayCircle,
  MessageCircle,
  CalendarCheck,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  User,
} from 'lucide-react';

interface DailyAgendaTimelineProps {
  sessions: Session[];
  selectedPsychologistName?: string;
  canAccessClinical: boolean;
  onStartSession: (patientId: number, sessionId: number) => void;
  onWhatsAppReminder: (sessionId: number) => void;
  onStatusChange: (sessionId: number, newStatus: string) => void;
  onNavigateToFullAgenda: () => void;
  whatsappLoadingId: number | null;
}

export const DailyAgendaTimeline: React.FC<DailyAgendaTimelineProps> = ({
  sessions,
  selectedPsychologistName,
  canAccessClinical,
  onStartSession,
  onWhatsAppReminder,
  onStatusChange,
  onNavigateToFullAgenda,
  whatsappLoadingId,
}) => {
  // Sort sessions chronologically
  const sortedSessions = [...sessions].sort((a, b) => a.start_time.localeCompare(b.start_time));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return {
          label: 'Confirmado',
          color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        };
      case 'NO_SHOW':
        return {
          label: 'Falta (No-Show)',
          color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        };
      case 'COMPLETED':
        return {
          label: 'Realizado',
          color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-800',
        };
      case 'CANCELED':
        return {
          label: 'Cancelado',
          color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
        };
      default:
        return {
          label: 'Agendado',
          color: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        };
    }
  };

  const todayText = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70 space-y-4">
      {/* Top Header of Timeline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Agenda do Dia
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {selectedPsychologistName || 'Visão Geral da Clínica'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">
            {todayText} • {sortedSessions.length}{' '}
            {sortedSessions.length === 1 ? 'atendimento programado' : 'atendimentos programados'}
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToFullAgenda}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold shadow-2xs transition cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>Ver Agenda Completa</span>
          <ArrowRight className="h-3 w-3 text-slate-400" />
        </button>
      </div>

      {/* Sessions Timeline List */}
      {sortedSessions.length === 0 ? (
        <div className="py-14 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <CalendarCheck className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Nenhum atendimento agendado para hoje
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {selectedPsychologistName
                ? `${selectedPsychologistName} não possui sessões programadas nesta data. Horários livres na agenda.`
                : 'Nenhum paciente agendado para a clínica nesta data.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToFullAgenda}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Abrir Agenda para Agendar</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSessions.map((session) => {
            const badge = getStatusBadge(session.status);
            const startTime = new Date(session.start_time).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const endTime = new Date(session.end_time).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={session.id}
                className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4.5 shadow-2xs transition hover:border-teal-400/60 dark:border-slate-700/60 dark:bg-slate-800/80 dark:hover:border-slate-600 space-y-3"
              >
                {/* Header of session card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Time pill */}
                    <div className="px-3 py-1.5 rounded-xl bg-teal-500/10 text-teal-800 dark:text-teal-300 font-mono font-bold text-xs flex items-center gap-1.5 border border-teal-500/20 shrink-0">
                      <Clock className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      <span>{startTime} - {endTime}</span>
                    </div>

                    {/* Patient Name & Details */}
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                        {session.patient_name || 'Paciente em Atendimento'}
                      </h4>
                      {session.psychologist_name && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Terapeuta: <strong className="text-slate-700 dark:text-slate-300 font-medium">{session.psychologist_name}</strong>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Modality & Status */}
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {/* Modality Pill */}
                    {session.modality === 'ONLINE' ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        session.video_status === 'ACTIVE'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : session.video_status === 'OPEN'
                          ? 'border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400'
                          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
                      }`}>
                        <Video className={`h-3 w-3 ${session.video_status === 'OPEN' || session.video_status === 'ACTIVE' ? 'text-emerald-500 animate-pulse' : 'text-sky-500'}`} />
                        <span>Online{session.video_status === 'ACTIVE' ? ' • Conectado' : session.video_status === 'OPEN' ? ' • Sala Aberta' : ''}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300">
                        <Building className="h-3 w-3 text-amber-500" />
                        <span>Presencial</span>
                      </span>
                    )}

                    {/* Status Badge */}
                    <span
                      className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full border ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                    {/* Iniciar Atendimento (Clínico) */}
                    {canAccessClinical ? (
                      <button
                        type="button"
                        id={`start-session-${session.id}`}
                        onClick={() => onStartSession(session.patient_id, session.id)}
                        className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition cursor-pointer ${
                          session.modality === 'ONLINE' && (session.video_status === 'OPEN' || session.video_status === 'ACTIVE')
                            ? 'bg-emerald-600 hover:bg-emerald-500'
                            : 'bg-teal-600 hover:bg-teal-500'
                        }`}
                        title="Abrir prontuário eletrônico e iniciar atendimento"
                      >
                        {session.modality === 'ONLINE' ? <Video className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                        <span>
                          {session.modality === 'ONLINE'
                            ? (session.video_status === 'OPEN' || session.video_status === 'ACTIVE' ? 'Entrar na Sala Online' : 'Iniciar Atendimento Online')
                            : 'Iniciar Atendimento'}
                        </span>
                      </button>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200/80 text-slate-500 text-xs font-medium dark:bg-slate-700/60 dark:text-slate-400"
                        title="Atendimento clínico privativo do psicólogo responsável (Resolução CFP nº 01/2009)"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                        <span>Acesso Clínico Restrito</span>
                      </span>
                    )}

                    {/* Disparar Confirmação no WhatsApp */}
                    <button
                      type="button"
                      id={`whatsapp-btn-${session.id}`}
                      onClick={() => onWhatsAppReminder(session.id)}
                      disabled={whatsappLoadingId === session.id}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40 text-xs font-semibold transition cursor-pointer"
                      title="Enviar confirmação de presença neutra via WhatsApp conforme LGPD"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{whatsappLoadingId === session.id ? 'Gerando...' : 'Confirmar Presença'}</span>
                    </button>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">Alterar Status:</span>
                    <select
                      value={session.status}
                      onChange={(e) => onStatusChange(session.id, e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 font-medium dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer shadow-2xs"
                    >
                      <option value="SCHEDULED">Agendado</option>
                      <option value="CONFIRMED">Confirmado</option>
                      <option value="COMPLETED">Realizado</option>
                      <option value="NO_SHOW">Falta (No-Show)</option>
                      <option value="CANCELED">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
