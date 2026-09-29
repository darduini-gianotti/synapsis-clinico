import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Video, MapPin, CheckCircle2, AlertTriangle,
  RefreshCw, X, ArrowRight, Check, CalendarDays, HelpCircle, MessageCircle
} from 'lucide-react';
import { patientApi } from '../../services/patientApi';

interface PatientAgendaTabProps {
  appointmentsData: { upcoming: any[]; past: any[] };
  onRefresh: () => void;
}

export const PatientAgendaTab: React.FC<PatientAgendaTabProps> = ({ appointmentsData, onRefresh }) => {
  const [filter, setFilter] = useState<'UPCOMING' | 'PAST'>('UPCOMING');
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [modalMode, setModalMode] = useState<'RESCHEDULE' | 'CANCEL' | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Polling em tempo real: verifica se a sala virtual foi aberta pelo terapeuta
  useEffect(() => {
    const hasOnlineSession = appointmentsData.upcoming?.some(
      (s: any) => s.modality === 'ONLINE' && s.video_status !== 'FINISHED'
    );
    if (!hasOnlineSession) return;
    const interval = setInterval(() => {
      onRefresh();
    }, 8000);
    return () => clearInterval(interval);
  }, [appointmentsData.upcoming, onRefresh]);

  const openRescheduleModal = async (session: any) => {
    setSelectedSession(session);
    setModalMode('RESCHEDULE');
    setSelectedSlot(null);
    setReason('');
    setActionSuccessMsg('');
    setLoadingSlots(true);
    try {
      const res = await patientApi.getAvailableSlots();
      setAvailableSlots(res.slots || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSlots(false);
    }
  };

  const openCancelModal = (session: any) => {
    setSelectedSession(session);
    setModalMode('CANCEL');
    setReason('');
    setActionSuccessMsg('');
  };

  const handleConfirm = async (id: number) => {
    try {
      await patientApi.confirmAppointment(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao confirmar presença');
    }
  };

  const handleConfirmReschedule = async () => {
    if (!selectedSession || !selectedSlot) return;
    setLoadingAction(true);
    try {
      const res = await patientApi.rescheduleAppointment(
        selectedSession.id,
        selectedSlot.startIso,
        selectedSlot.endIso,
        reason
      );
      setActionSuccessMsg(res.message);
      setTimeout(() => {
        setModalMode(null);
        onRefresh();
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Erro ao reagendar consulta');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedSession) return;
    setLoadingAction(true);
    try {
      const res = await patientApi.cancelAppointment(selectedSession.id, reason);
      setActionSuccessMsg(res.message);
      setTimeout(() => {
        setModalMode(null);
        onRefresh();
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar consulta');
    } finally {
      setLoadingAction(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const isLessThan24h = (isoString?: string) => {
    if (!isoString) return false;
    const diff = (new Date(isoString).getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return diff < 24;
  };

  const list = filter === 'UPCOMING' ? (appointmentsData?.upcoming || []) : (appointmentsData?.past || []);

  return (
    <div className="space-y-4 pb-8 animate-fade-in">
      
      {/* Header com Segmented Control */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white">Minha Agenda</h2>
          <p className="text-xs text-slate-500">Acompanhe suas sessões e presenças</p>
        </div>

        <div className="flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFilter('UPCOMING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'UPCOMING'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Próximas ({appointmentsData?.upcoming?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setFilter('PAST')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'PAST'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Histórico ({appointmentsData?.past?.length || 0})
          </button>
        </div>
      </div>

      {/* Lista de Sessões */}
      {list.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <CalendarDays className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
            {filter === 'UPCOMING' ? 'Nenhuma consulta programada' : 'Nenhum histórico encontrado'}
          </h4>
          <p className="text-xs text-slate-400">
            {filter === 'UPCOMING' ? 'Suas novas consultas agendadas aparecerão aqui.' : 'Suas consultas anteriores concluídas ficam arquivadas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((session: any) => {
            const lessThan24 = isLessThan24h(session.start_time);
            return (
              <div
                key={session.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-400 transition-all space-y-3"
              >
                {/* Linha Superior: Data, Status e Modalidade */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-black flex flex-col items-center justify-center text-xs leading-none">
                      <span>{new Date(session.start_time).getDate()}</span>
                      <span className="text-[10px] font-semibold uppercase mt-0.5">
                        {new Date(session.start_time).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white capitalize">
                        {formatDate(session.start_time)}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatTime(session.start_time)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {session.modality === 'ONLINE' ? (
                            <>
                              <Video className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Online</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-amber-500" />
                              <span>Presencial</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    session.status === 'CONFIRMED'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : session.status === 'COMPLETED'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : session.status === 'CANCELED'
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {session.status === 'CONFIRMED' ? 'Confirmada' :
                     session.status === 'COMPLETED' ? 'Realizada' :
                     session.status === 'CANCELED' ? 'Cancelada' : 'Agendada'}
                  </span>
                </div>

                {/* Terapeuta */}
                <div className="text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span>Terapeuta: <strong>{session.psychologist_name}</strong></span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">R$ {Number(session.price).toFixed(2).replace('.', ',')}</span>
                </div>

                {/* Ações (Apenas para sessões futuras não canceladas) */}
                {filter === 'UPCOMING' && session.status !== 'CANCELED' && (
                  <>
                    {/* Botão de Entrada na Sala de Vídeo Online */}
                    {session.modality === 'ONLINE' && session.video_provider === 'WHATSAPP' && (session.video_status === 'OPEN' || session.video_status === 'ACTIVE') && (
                      <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2">
                        <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 animate-pulse" />
                        <span>Atendimento via WhatsApp Vídeo em andamento com seu terapeuta</span>
                      </div>
                    )}

                    {session.modality === 'ONLINE' && session.video_provider !== 'WHATSAPP' && (session.video_status === 'OPEN' || session.video_status === 'ACTIVE') && (
                      <a
                        href={session.patient_access_token ? `/teleconsulta/${session.patient_access_token}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer border border-teal-400/40"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                        <Video className="w-4 h-4" />
                        <span>Entrar na Consulta Online com Terapeuta</span>
                      </a>
                    )}

                    {session.modality === 'ONLINE' && session.video_status !== 'OPEN' && session.video_status !== 'ACTIVE' && session.video_status !== 'FINISHED' && (
                      <div className="text-[11px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-3 py-1.5 rounded-xl border border-teal-200 dark:border-teal-800/60 flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        <span>Sua sala virtual segura (CFP 11/2018) será aberta pelo psicólogo no horário da sessão.</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {session.status !== 'CONFIRMED' && (
                        <button
                          type="button"
                          onClick={() => handleConfirm(session.id)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirmar Presença</span>
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => openRescheduleModal(session)}
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Remarcar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openCancelModal(session)}
                      className="py-2 px-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Cancelar</span>
                    </button>
                  </div>
                </>
              )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE REAGENDAMENTO COM TRAVA DE 24H */}
      {modalMode === 'RESCHEDULE' && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-white">
                Reagendar Consulta
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso sobre Trava de 24h */}
            {isLessThan24h(selectedSession.start_time) ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Aviso de Menos de 24 Horas</strong>
                  <span>Esta consulta está agendada para breve. A solicitação será enviada para avaliação prévia da recepção/terapeuta conforme a política da clínica.</span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Reagendamento com antecedência garantida: a troca de horário será imediata.</span>
              </div>
            )}

            {actionSuccessMsg ? (
              <div className="p-4 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-sm font-bold text-center">
                {actionSuccessMsg}
              </div>
            ) : (
              <>
                {/* Seletor de Horários Vagos */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Escolha um novo horário disponível:
                  </label>
                  {loadingSlots ? (
                    <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Buscando horários vagos do terapeuta...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      Nenhum horário livre encontrado nos próximos 10 dias. Fale com a recepção.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {availableSlots.map((slot, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                            selectedSlot?.startIso === slot.startIso
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span>{formatDate(slot.startIso)} às {slot.time}</span>
                          {selectedSlot?.startIso === slot.startIso && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Motivo opcional */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Motivo da remarcação (opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Imprevisto de trabalho, consulta médica..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReschedule}
                    disabled={!selectedSlot || loadingAction}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
                  >
                    {loadingAction ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirmar Troca'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CANCELAMENTO COM AVISO DE HONORÁRIOS */}
      {modalMode === 'CANCEL' && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-rose-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span>Cancelar Consulta</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tem certeza que deseja desmarcar a consulta de <strong>{formatDate(selectedSession.start_time)} às {formatTime(selectedSession.start_time)}</strong>?
            </p>

            {isLessThan24h(selectedSession.start_time) ? (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
                <strong className="block font-bold mb-1">Aviso Contratual (Menos de 24 horas):</strong>
                Cancelamentos em cima da hora estão sujeitos à cobrança dos honorários da sessão conforme acordado no contrato terapêutico. A recepção será notificada da sua justificativa.
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                Cancelamento com mais de 24 horas de antecedência. Não haverá cobrança de taxa de sessão.
              </div>
            )}

            {actionSuccessMsg ? (
              <div className="p-4 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-sm font-bold text-center">
                {actionSuccessMsg}
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Motivo do cancelamento:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Descreva brevemente o motivo..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Não, manter sessão
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    disabled={loadingAction}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
                  >
                    {loadingAction ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirmar Cancelamento'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
