import React, { useState } from 'react';
import {
  Calendar, Clock, Video, MapPin, CheckCircle2, AlertCircle,
  CreditCard, FileText, MessageSquare, ArrowRight, HeartHandshake,
  ExternalLink, Sparkles, Check
} from 'lucide-react';
import { patientApi } from '../../services/patientApi';

interface PatientHomeTabProps {
  patientProfile: any;
  nextAppointment: any;
  financialSummary: any;
  pendingActivitiesCount: number;
  onNavigateTab: (tab: 'agenda' | 'financial' | 'documents' | 'messages' | 'activities') => void;
  onRefreshData: () => void;
}

export const PatientHomeTab: React.FC<PatientHomeTabProps> = ({
  patientProfile,
  nextAppointment,
  financialSummary,
  pendingActivitiesCount,
  onNavigateTab,
  onRefreshData,
}) => {
  const [confirming, setConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  const patientName = patientProfile?.patient?.full_name?.split(' ')[0] || 'Paciente';

  const handleConfirmNextSession = async () => {
    if (!nextAppointment?.id) return;
    setConfirming(true);
    try {
      await patientApi.confirmAppointment(nextAppointment.id);
      setConfirmedSuccess(true);
      setTimeout(() => {
        onRefreshData();
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Erro ao confirmar presença');
    } finally {
      setConfirming(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-5 pb-8 animate-fade-in">
      
      {/* Boas-vindas */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <span>Olá, {patientName}!</span>
            <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cuidando da sua saúde mental e bem-estar
          </p>
        </div>

        {patientProfile?.isGuardian && (
          <div className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-[11px] font-bold text-purple-700 dark:text-purple-300">
            Perfil Familiar
          </div>
        )}
      </div>

      {/* CARD DA PRÓXIMA SESSÃO */}
      {nextAppointment ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white p-5 shadow-xl shadow-indigo-600/20">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              <span>Próxima Consulta</span>
            </span>

            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              nextAppointment.status === 'CONFIRMED'
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-amber-300 text-slate-950'
            }`}>
              {nextAppointment.status === 'CONFIRMED' ? 'Confirmado' : 'Aguardando Confirmação'}
            </span>
          </div>

          <div className="space-y-1 mb-4">
            <h3 className="text-2xl font-black tracking-tight capitalize">
              {formatDate(nextAppointment.start_time)}
            </h3>
            <div className="flex items-center gap-3 text-indigo-100 text-sm font-medium">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatTime(nextAppointment.start_time)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {nextAppointment.modality === 'ONLINE' ? (
                  <>
                    <Video className="w-4 h-4 text-emerald-300" />
                    <span>Consulta Online</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 text-amber-300" />
                    <span>Presencial no Consultório</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-indigo-200 pt-1">
              Profissional: <strong>{nextAppointment.psychologist_name}</strong> {nextAppointment.crp_number && `(${nextAppointment.crp_number})`}
            </p>
          </div>

          {/* Botões de Ação na Consulta */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/10">
            {nextAppointment.status !== 'CONFIRMED' ? (
              <button
                type="button"
                onClick={handleConfirmNextSession}
                disabled={confirming || confirmedSuccess}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {confirmedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Presença Confirmada!</span>
                  </>
                ) : confirming ? (
                  <span>Confirmando...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Presença (1 toque)</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Sua presença já está confirmada!</span>
              </div>
            )}

            {nextAppointment.modality === 'ONLINE' && (
              <a
                href="https://meet.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-white text-indigo-900 font-bold text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
              >
                <Video className="w-4 h-4 text-indigo-600" />
                <span>Sala Virtual</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-3xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Nenhuma consulta agendada</h4>
          <p className="text-xs text-slate-500">
            Você não possui sessões agendadas no momento.
          </p>
        </div>
      )}

      {/* ALERTAS PENDENTES (FINANCEIRO OU ESCALAS) */}
      {financialSummary?.totalPending > 0 && (
        <div 
          onClick={() => onNavigateTab('financial')}
          className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                Fatura Pendente
              </h4>
              <p className="text-sm font-extrabold text-slate-800 dark:text-white">
                R$ {Number(financialSummary.totalPending).toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
            Pagar com PIX <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      )}

      {pendingActivitiesCount > 0 && (
        <div 
          onClick={() => onNavigateTab('activities')}
          className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between cursor-pointer hover:bg-indigo-100/70 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
                Tarefas / Questionário Pendente
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Você tem {pendingActivitiesCount} escala ou atividade atribuída pelo seu terapeuta.
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-indigo-600 shrink-0" />
        </div>
      )}

      {/* GRID DE ATALHOS RÁPIDOS */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Acesso Rápido
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('agenda')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-left hover:border-indigo-500 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <h5 className="font-bold text-sm text-slate-800 dark:text-white">Minha Agenda</h5>
            <p className="text-[11px] text-slate-500 mt-0.5">Histórico e reagendamentos</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('financial')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-left hover:border-indigo-500 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <h5 className="font-bold text-sm text-slate-800 dark:text-white">Financeiro</h5>
            <p className="text-[11px] text-slate-500 mt-0.5">PIX e recibos para IRPF</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('documents')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-left hover:border-indigo-500 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <h5 className="font-bold text-sm text-slate-800 dark:text-white">Documentos</h5>
            <p className="text-[11px] text-slate-500 mt-0.5">Atestados e laudos emitidos</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('messages')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-left hover:border-indigo-500 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h5 className="font-bold text-sm text-slate-800 dark:text-white">Mensagens</h5>
            <p className="text-[11px] text-slate-500 mt-0.5">Recepção e terapeuta</p>
          </button>
        </div>
      </div>

      {/* BANNER DE APOIO EMOCIONAL / SALVAGUARDA 188 */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/30 border border-rose-200/60 dark:border-rose-800/40 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
          <HeartHandshake className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-xs font-bold text-rose-900 dark:text-rose-200">
            Apoio Emocional Imediato (CVV)
          </h5>
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            Em momentos de angústia ou crise, ligue gratuitamente para o <strong>188</strong> (disponível 24h por dia).
          </p>
        </div>
        <a
          href="tel:188"
          className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 shrink-0"
        >
          Ligar 188
        </a>
      </div>

    </div>
  );
};
