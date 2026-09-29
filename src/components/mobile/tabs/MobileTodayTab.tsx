import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.js';
import { MobileSessionCard, MobileSessionItem } from '../components/MobileSessionCard.js';
import { Calendar, RefreshCw, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface MobileTodayTabProps {
  onStartVideo: (session: MobileSessionItem) => void;
  onOpenEvolution: (session: MobileSessionItem) => void;
  onViewPatient: (patientId: number) => void;
}

export const MobileTodayTab: React.FC<MobileTodayTabProps> = ({
  onStartVideo,
  onOpenEvolution,
  onViewPatient,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().substring(0, 10);
  });
  const [sessions, setSessions] = useState<MobileSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Gera os 7 dias ao redor da data atual para o seletor rápido
  const daysSelector = React.useMemo(() => {
    const days = [];
    const base = new Date();
    // Começa 2 dias antes até 4 dias depois
    for (let i = -2; i <= 4; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = d.toISOString().substring(0, 10);
      days.push({
        iso,
        dayNumber: d.getDate(),
        weekday: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
        isToday: i === 0,
      });
    }
    return days;
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/sessions', {
        params: {
          start: `${selectedDate}T00:00:00`,
          end: `${selectedDate}T23:59:59`,
        },
      });

      const rawSessions = res.data.sessions || res.data || [];
      const mapped: MobileSessionItem[] = rawSessions.map((s: any) => ({
        id: s.id,
        patient_id: s.patient_id,
        patient_name: s.patient_name || 'Paciente',
        patient_phone: s.patient_phone || s.phone || '',
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status || 'SCHEDULED',
        modality: s.modality === 'IN_PERSON' ? 'IN_PERSON' : 'ONLINE',
        teleconsulta_token: s.teleconsulta_token,
        price: s.price,
        payment_status: s.payment_status,
        notes: s.notes,
      }));

      // Ordena por horário de início
      mapped.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      setSessions(mapped);
    } catch (err) {
      console.error('Erro ao carregar sessões do mobile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [selectedDate]);

  const confirmedCount = sessions.filter(
    (s) => s.status === 'CONFIRMED' || s.status === 'SCHEDULED'
  ).length;

  return (
    <div className="space-y-4 pb-24">
      {/* Seletor Horizontal de Dias (Pílulas de Toque) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {daysSelector.map((d) => {
          const isSelected = selectedDate === d.iso;
          return (
            <button
              key={d.iso}
              onClick={() => setSelectedDate(d.iso)}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-2xl min-w-[54px] transition-all cursor-pointer ${
                isSelected
                  ? 'bg-teal-500 text-slate-950 font-black shadow-md shadow-teal-500/30 scale-105'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider">
                {d.weekday}
              </span>
              <span className="text-base font-black leading-tight mt-0.5">
                {d.dayNumber}
              </span>
              {d.isToday && !isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Barra de Resumo Rápido do Dia */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-bold text-slate-200">{sessions.length} atendimento(s)</span>
          <span>•</span>
          <span className="text-teal-400 font-semibold">{confirmedCount} confirmados</span>
        </div>

        <button
          onClick={fetchSessions}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          title="Recarregar"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
        </button>
      </div>

      {/* Lista de Cards de Atendimento */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-teal-500" />
          <p className="text-xs">Buscando atendimentos...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center bg-slate-900/40 rounded-3xl border border-dashed border-slate-800">
          <div className="h-12 w-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
            <Calendar className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-300">Nenhum atendimento agendado</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            Você não possui sessões agendadas para este dia. Selecione outra data acima.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <MobileSessionCard
              key={session.id}
              session={session}
              onStartVideo={onStartVideo}
              onOpenEvolution={onOpenEvolution}
              onViewPatient={onViewPatient}
            />
          ))}
        </div>
      )}
    </div>
  );
};
