import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useAcademy } from '../../context/AcademyContext.js';
import {
  ReceptionSession,
  ReceptionBoardStats,
  Room,
  RoomTimelineData,
  RoomTimelineSession,
} from '../../types.js';
import { RoomModal } from './RoomModal.js';
import {
  Radio,
  Clock,
  UserCheck,
  CheckCircle2,
  Users,
  Building,
  Volume2,
  Play,
  Check,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Tv,
  Calendar,
  CalendarClock,
  Search,
  Plus,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Info,
  XCircle,
} from 'lucide-react';

interface ReceptionTowerModuleProps {
  onStartSession?: (patientId: number, sessionId: number) => void;
  onOpenTv?: () => void;
}

const HOURS_TIMELINE = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00'
];

export const ReceptionTowerModule: React.FC<ReceptionTowerModuleProps> = ({
  onStartSession,
  onOpenTv,
}) => {
  const { user, isAdmin, isSecretary, canAccessClinical, clinicSettings } = useAuth();
  const { isSandboxActive, advanceStep } = useAcademy();

  const [activeSubTab, setActiveSubTab] = useState<'kanban' | 'rooms' | 'timeline'>('kanban');
  const [boardData, setBoardData] = useState<{
    scheduled: ReceptionSession[];
    waiting: ReceptionSession[];
    in_session: ReceptionSession[];
    completed: ReceptionSession[];
    canceled: ReceptionSession[];
  }>({
    scheduled: [],
    waiting: [],
    in_session: [],
    completed: [],
    canceled: [],
  });
  const [stats, setStats] = useState<ReceptionBoardStats>({
    total_today: 0,
    waiting_count: 0,
    in_session_count: 0,
    completed_count: 0,
    scheduled_count: 0,
    canceled_count: 0,
    avg_wait_minutes: 0,
  });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomForCheckIn, setSelectedRoomForCheckIn] = useState<Record<number, number>>({});
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Room modal state
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null);

  // Timeline state
  const [timelineDate, setTimelineDate] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [timelineData, setTimelineData] = useState<RoomTimelineData | null>(null);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  // Local ticker every 1s for fluid live wait timers without backend polling overhead
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live board data
  const fetchLiveBoard = async (silent = false) => {
    try {
      if (!silent) setIsRefreshing(true);
      const res = await api.get('/reception/live-board');
      if (res.data) {
        setBoardData(res.data.board);
        setStats(res.data.stats);
        setRooms(res.data.rooms || []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch live board:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial fetch and 8-second smart polling
  useEffect(() => {
    fetchLiveBoard();
    const interval = setInterval(() => {
      fetchLiveBoard(true);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Fetch timeline data when subtab is timeline or date changes
  const fetchTimelineData = async (dateStr: string) => {
    try {
      setIsLoadingTimeline(true);
      const res = await api.get('/reception/rooms-timeline', {
        params: { date: dateStr },
      });
      if (res.data) {
        setTimelineData(res.data);
      }
    } catch (err) {
      console.error('Failed to load rooms timeline:', err);
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'timeline') {
      fetchTimelineData(timelineDate);
    }
  }, [activeSubTab, timelineDate]);

  // Helper to calculate live wait time string
  const getLiveWaitSeconds = (session: ReceptionSession): number => {
    if (!session.arrival_time) return 0;
    const arrival = new Date(session.arrival_time).getTime();
    const end = session.session_started_at ? new Date(session.session_started_at).getTime() : nowMs;
    return Math.max(0, Math.floor((end - arrival) / 1000));
  };

  const formatTimer = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Actions
  const handleCheckIn = async (sessionId: number) => {
    if (isSandboxActive) {
      showFeedback('🎓 [Simulação Academy]: Presença confirmada! Paciente encaminhado para a sala de espera.');
      setBoardData((prev) => {
        const item = prev.scheduled.find((s) => s.id === sessionId) || {
          id: 702,
          patient_id: 902,
          patient_name: 'Ana Paula Mendonça (Simulação)',
          psychologist_name: 'Dr. Marcos Silveira',
          display_room_name: 'Consultório 1 (Adulto)',
          room_id: 1,
          start_time: '14:00',
          end_time: '14:50',
          status: 'SCHEDULED',
          payment_status: 'PAID',
          price: 180,
        };
        const remaining = prev.scheduled.filter((s) => s.id !== sessionId);
        const waitingItem = {
          ...item,
          status: 'WAITING_IN_LOBBY',
          waiting_since: new Date().toISOString(),
        };
        return {
          ...prev,
          scheduled: remaining,
          waiting: [waitingItem as any, ...prev.waiting],
        };
      });
      advanceStep();
      return;
    }

    const roomId = selectedRoomForCheckIn[sessionId] || undefined;
    const room = rooms.find((r) => r.id === roomId);
    try {
      await api.post('/reception/check-in', {
        session_id: sessionId,
        room_id: roomId,
        room_name: room?.name,
      });
      showFeedback('Presença confirmada! Paciente encaminhado para a sala de espera.');
      fetchLiveBoard(true);
    } catch (err) {
      console.error('Error on check-in:', err);
    }
  };

  const handleCallPatient = async (sessionId: number, defaultRoomId?: number | null, defaultRoomName?: string | null) => {
    if (isSandboxActive) {
      showFeedback('🎓 [Simulação Academy]: Chamada na TV da sala de espera disparada com sucesso! (Aviso sonoro e visual simulados)');
      advanceStep();
      return;
    }

    const roomId = selectedRoomForCheckIn[sessionId] || defaultRoomId || undefined;
    const room = rooms.find((r) => r.id === roomId);
    try {
      const res = await api.post('/reception/call-patient', {
        session_id: sessionId,
        room_id: roomId,
        room_name: room?.name || defaultRoomName,
      });
      showFeedback(`Chamada disparada para TV e consultório: ${res.data?.patient_display_name}`);
      fetchLiveBoard(true);
    } catch (err) {
      console.error('Error calling patient:', err);
    }
  };

  const handleStartSession = async (session: ReceptionSession) => {
    try {
      await api.post('/reception/start-session', {
        session_id: session.id,
        room_id: session.room_id,
      });
      showFeedback(`Atendimento iniciado na sala ${session.display_room_name}`);
      fetchLiveBoard(true);
      if (onStartSession && canAccessClinical) {
        onStartSession(session.patient_id, session.id);
      }
    } catch (err) {
      console.error('Error starting session:', err);
    }
  };

  const handleFinishSession = async (sessionId: number, roomId?: number | null) => {
    try {
      await api.post('/reception/finish-session', {
        session_id: sessionId,
        room_id: roomId,
      });
      showFeedback('Atendimento concluído e consultório liberado.');
      fetchLiveBoard(true);
    } catch (err) {
      console.error('Error finishing session:', err);
    }
  };

  const handleUpdateRoomStatus = async (roomId: number, newStatus: string) => {
    try {
      await api.put(`/reception/rooms/${roomId}`, { status: newStatus });
      fetchLiveBoard(true);
    } catch (err) {
      console.error('Error updating room:', err);
    }
  };

  const showFeedback = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 3500);
  };

  // Filtered lists
  const filterBySearch = (list: ReceptionSession[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s) =>
        s.patient_name.toLowerCase().includes(q) ||
        s.psychologist_name.toLowerCase().includes(q) ||
        (s.display_room_name && s.display_room_name.toLowerCase().includes(q))
    );
  };

  const scheduledFiltered = useMemo(() => {
    const list = filterBySearch(boardData.scheduled);
    if (isSandboxActive && list.length === 0 && boardData.waiting.length === 0) {
      return [
        {
          id: 702,
          patient_id: 902,
          patient_name: 'Ana Paula Mendonça (Simulação)',
          psychologist_name: 'Dr. Marcos Silveira',
          display_room_name: 'Consultório 1 (Adulto)',
          room_id: 1,
          start_time: '14:00',
          end_time: '14:50',
          status: 'SCHEDULED',
          payment_status: 'PAID',
          price: 180,
        } as any,
      ];
    }
    return list;
  }, [boardData.scheduled, boardData.waiting, searchQuery, isSandboxActive]);
  const waitingFiltered = useMemo(() => filterBySearch(boardData.waiting), [boardData.waiting, searchQuery]);
  const inSessionFiltered = useMemo(() => filterBySearch(boardData.in_session), [boardData.in_session, searchQuery]);
  const completedFiltered = useMemo(() => filterBySearch(boardData.completed), [boardData.completed, searchQuery]);

  // Timeline Navigation
  const handleShiftTimelineDate = (days: number) => {
    const d = new Date(`${timelineDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, '0');
    setTimelineDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };

  const handleSetTodayTimeline = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setTimelineDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };

  const formattedTimelineDate = useMemo(() => {
    const d = new Date(`${timelineDate}T12:00:00`);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [timelineDate]);

  return (
    <div className="space-y-6 max-w-7xl animate-in fade-in">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-md">
            <Radio className="h-7 w-7 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Torre de Recepção ao Vivo</h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                AO VIVO
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Fluxo em tempo real • Salas de atendimento • Sala de espera com cronômetro dinâmico
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Open TV View Button */}
          {clinicSettings?.waiting_tv_enabled !== false && (
            <button
              onClick={onOpenTv || (() => window.open('/tv-espera', '_blank'))}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/60 transition cursor-pointer shadow-2xs"
              title="Abrir painel em tela cheia para a TV da sala de espera"
            >
              <Tv className="h-4 w-4" />
              <span>Painel TV da Espera</span>
            </button>
          )}

          {/* Sub-tab Switcher */}
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveSubTab('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'kanban'
                  ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              Cockpit Kanban
            </button>
            <button
              onClick={() => setActiveSubTab('rooms')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'rooms'
                  ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Building className="h-3.5 w-3.5" />
              Consultórios ({rooms.length})
            </button>
            <button
              onClick={() => setActiveSubTab('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'timeline'
                  ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Timeline de Salas
            </button>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={() => {
              fetchLiveBoard();
              if (activeSubTab === 'timeline') {
                fetchTimelineData(timelineDate);
              }
            }}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Atualizar agora"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Real-time Metrics Row (exibido no Kanban) */}
      {activeSubTab === 'kanban' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-400">Total do Dia</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{stats.total_today}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                <Calendar className="h-5 w-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-300/40 dark:border-amber-700/40 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400">Na Sala de Espera</span>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-300 mt-0.5">{stats.waiting_count}</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300">
                <Clock className="h-5 w-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-teal-500/5 dark:bg-teal-950/20 border border-teal-300/40 dark:border-teal-700/40 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase text-teal-700 dark:text-teal-400">Em Atendimento</span>
                <div className="text-2xl font-black text-teal-600 dark:text-teal-300 mt-0.5">{stats.in_session_count}</div>
              </div>
              <div className="p-3 rounded-xl bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300">
                <UserCheck className="h-5 w-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-300/40 dark:border-purple-700/40 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase text-purple-700 dark:text-purple-400">Atendidos Hoje</span>
                <div className="text-2xl font-black text-purple-600 dark:text-purple-300 mt-0.5">{stats.completed_count}</div>
              </div>
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-300/40 dark:border-rose-700/40 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase text-rose-700 dark:text-rose-400">Cancelados</span>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-300 mt-0.5">{stats.canceled_count || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300">
                <XCircle className="h-5 w-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-400">Espera Média</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  {stats.avg_wait_minutes} <span className="text-xs font-normal text-slate-500">min</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* SEARCH AND FILTER BAR */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por paciente, psicólogo ou consultório..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 shadow-2xs"
              />
            </div>
            <div className="text-xs text-slate-400 hidden sm:block">
              Sincronizado às {lastUpdated.toLocaleTimeString('pt-BR')} (atualiza a cada 8s)
            </div>
          </div>
        </>
      )}

      {/* VIEW: KANBAN COCKPIT */}
      {activeSubTab === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {/* COLUNA 1: AGUARDADOS HOJE / A CHEGAR */}
          <div className="bg-slate-50/70 dark:bg-slate-850 dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3.5 min-h-[500px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Aguardados Hoje</h3>
              </div>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {scheduledFiltered.length}
              </span>
            </div>

            {scheduledFiltered.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Nenhum atendimento pendente para chegar.
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledFiltered.map((session) => {
                  const startTimeStr = session.start_time.includes('T')
                    ? session.start_time.split('T')[1].substring(0, 5)
                    : session.start_time.substring(11, 16);

                  return (
                    <div
                      key={session.id}
                      className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs hover:border-teal-300 dark:hover:border-teal-700 transition space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-teal-600 dark:text-teal-400">
                            {startTimeStr} • {session.session_type === 'EVALUATION' ? 'Avaliação Neuro' : 'Psicoterapia'}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                            {session.patient_name}
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {session.modality === 'ONLINE' ? 'Online' : 'Presencial'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Terapeuta: <strong>{session.psychologist_name.split(' ')[0]}</strong></span>
                        <span>{session.display_room_name}</span>
                      </div>

                      {/* Room selection before check-in */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
                        <select
                          value={selectedRoomForCheckIn[session.id] || session.room_id || ''}
                          onChange={(e) =>
                            setSelectedRoomForCheckIn({
                              ...selectedRoomForCheckIn,
                              [session.id]: Number(e.target.value),
                            })
                          }
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300"
                        >
                          <option value="">Consultório...</option>
                          {rooms.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>

                        <button
                          data-tour={`tower-checkin-btn-${session.id}`}
                          onClick={() => handleCheckIn(session.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                          title="Registrar chegada do paciente"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Chegou
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLUNA 2: NA SALA DE ESPERA (COM CRONÔMETRO AO VIVO) */}
          <div className="bg-amber-50/50 dark:bg-amber-950/10 rounded-2xl p-4 border border-amber-200/60 dark:border-amber-800/40 space-y-3.5 min-h-[500px]">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-800/40">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">Na Sala de Espera</h3>
              </div>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                {waitingFiltered.length}
              </span>
            </div>

            {waitingFiltered.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Sala de espera vazia no momento.
              </div>
            ) : (
              <div className="space-y-3">
                {waitingFiltered.map((session) => {
                  const waitSecs = getLiveWaitSeconds(session);
                  const waitMins = Math.floor(waitSecs / 60);

                  const timerColor =
                    waitMins < 5
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300'
                      : waitMins < 15
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300'
                      : 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 animate-pulse';

                  return (
                    <div
                      key={session.id}
                      className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-slate-700 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${timerColor}`}>
                              ⏱️ Espera: {formatTimer(waitSecs)}
                            </span>
                            {session.presence_status === 'CALLED' && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse">
                                CHAMADO
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                            {session.patient_name}
                          </h4>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Terapeuta:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{session.psychologist_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Consultório:</span>
                          <span className="font-semibold text-teal-600 dark:text-teal-400">{session.display_room_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Financeiro:</span>
                          <span className={session.payment_status === 'PAID' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                            {session.payment_status === 'PAID' ? 'Pago R$ ' + session.price : 'Pendente (Cobrar)'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons: Call & Enter */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          data-tour={`tower-call-tv-btn-${session.id}`}
                          onClick={() => handleCallPatient(session.id, session.room_id, session.display_room_name)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                          title="Chamar paciente no painel de TV da sala de espera"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          Chamar TV
                        </button>

                        <button
                          onClick={() => handleStartSession(session)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                          title="Marcar entrada na sala com o psicólogo"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Entrar Sala
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLUNA 3: EM ATENDIMENTO (CONSULTÓRIOS OCUPADOS) */}
          <div className="bg-teal-50/50 dark:bg-teal-950/10 rounded-2xl p-4 border border-teal-200/60 dark:border-teal-800/40 space-y-3.5 min-h-[500px]">
            <div className="flex items-center justify-between pb-2 border-b border-teal-200/60 dark:border-teal-800/40">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                <h3 className="text-sm font-bold text-teal-900 dark:text-teal-300">Em Atendimento</h3>
              </div>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-teal-200/70 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200">
                {inSessionFiltered.length}
              </span>
            </div>

            {inSessionFiltered.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Nenhum consultório com atendimento em andamento.
              </div>
            ) : (
              <div className="space-y-3">
                {inSessionFiltered.map((session) => {
                  const durationSecs = session.session_started_at
                    ? Math.max(0, Math.floor((nowMs - new Date(session.session_started_at).getTime()) / 1000))
                    : 0;
                  const durationMins = Math.floor(durationSecs / 60);
                  const isNearEnd = durationMins >= 45;

                  return (
                    <div
                      key={session.id}
                      className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-teal-200 dark:border-slate-700 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300">
                              🟢 {formatTimer(durationSecs)} / 50:00
                            </span>
                            {isNearEnd && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                                Término Próximo
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                            {session.patient_name}
                          </h4>
                        </div>
                      </div>

                      {/* Progress bar of 50 minutes */}
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            isNearEnd ? 'bg-amber-500' : 'bg-teal-500'
                          }`}
                          style={{ width: `${Math.min(100, (durationMins / 50) * 100)}%` }}
                        />
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Consultório:</span>
                          <span className="font-bold text-teal-600 dark:text-teal-400">{session.display_room_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Psicólogo:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{session.psychologist_name}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleFinishSession(session.id, session.room_id)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold transition shadow-xs cursor-pointer"
                          title="Finalizar atendimento e liberar consultório"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Finalizar & Liberar Sala
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLUNA 4: ATENDIDOS & CONCLUÍDOS HOJE */}
          <div className="bg-slate-50/70 dark:bg-slate-850 dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3.5 min-h-[500px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Atendidos Hoje</h3>
              </div>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                {completedFiltered.length}
              </span>
            </div>

            {completedFiltered.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Nenhum atendimento finalizado ainda hoje.
              </div>
            ) : (
              <div className="space-y-3">
                {completedFiltered.map((session) => (
                  <div
                    key={session.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs space-y-2 opacity-90 hover:opacity-100 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {session.patient_name}
                        </h4>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {session.psychologist_name.split(' ')[0]} • {session.display_room_name}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                        Concluído
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-700/60">
                      <span className="text-slate-500">
                        {session.wait_minutes > 0 ? `Espera: ${session.wait_minutes}m` : 'Sem espera'}
                      </span>
                      <span className={session.payment_status === 'PAID' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                        {session.payment_status === 'PAID' ? '✓ Pago' : '⚠️ A Cobrar'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: ROOMS GRID */}
      {activeSubTab === 'rooms' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Mapa Espacial dos Consultórios Físicos</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monitore a ocupação física das salas, higienização e disponibilidade em tempo real.
              </p>
            </div>
            {(isAdmin || isSecretary) && (
              <button
                onClick={() => {
                  setRoomToEdit(null);
                  setIsRoomModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Consultório</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {rooms.map((room) => {
              const isOccupied = room.status === 'OCCUPIED' || Boolean(room.current_session);
              const isCleaning = room.status === 'CLEANING';

              const statusBadge = isOccupied
                ? { label: 'OCUPADO', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300' }
                : isCleaning
                ? { label: 'HIGIENIZAÇÃO', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300' }
                : { label: 'DISPONÍVEL', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300' };

              return (
                <div
                  key={room.id}
                  className="rounded-2xl p-5 bg-white dark:bg-slate-800 border-2 shadow-xs transition space-y-4"
                  style={{ borderColor: isOccupied ? '#f43f5e' : room.color_code || '#0d9488' }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {room.room_type}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                        {room.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(isAdmin || isSecretary) && (
                        <button
                          onClick={() => {
                            setRoomToEdit(room);
                            setIsRoomModalOpen(true);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition cursor-pointer"
                          title="Editar Consultório"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Room current occupant if any */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs min-h-[75px] flex flex-col justify-center">
                    {room.current_session ? (
                      <div className="space-y-1">
                        <div className="text-slate-400 text-[11px]">Paciente em sessão:</div>
                        <div className="font-bold text-slate-900 dark:text-white">{room.current_session.patient_name}</div>
                        <div className="text-teal-600 text-[11px] font-semibold">{room.current_session.psychologist_name}</div>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-center py-2 flex items-center justify-center gap-1.5">
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span>Pronto para próximo paciente</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Status Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => handleUpdateRoomStatus(room.id, !isOccupied && !isCleaning ? 'CLEANING' : 'AVAILABLE')}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      {isCleaning ? 'Marcar Livre' : 'Higienização'}
                    </button>
                    {isOccupied && (
                      <button
                        onClick={() => handleUpdateRoomStatus(room.id, 'AVAILABLE')}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-[11px] font-bold hover:bg-slate-900 transition cursor-pointer"
                      >
                        Liberar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: TIMELINE DE SALAS */}
      {activeSubTab === 'timeline' && (
        <div className="space-y-5">
          {/* Header Controls: Date Picker & Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            {/* Date Navigator */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleShiftTimelineDate(-1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Dia anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleSetTodayTimeline}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Hoje
              </button>
              <button
                onClick={() => handleShiftTimelineDate(1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Próximo dia"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <input
                type="date"
                value={timelineDate}
                onChange={(e) => setTimelineDate(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />

              <span className="text-xs font-bold capitalize text-slate-700 dark:text-slate-300 ml-2 hidden md:inline">
                {formattedTimelineDate}
              </span>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-teal-700 dark:text-teal-300 text-xs font-bold">
                <Building className="h-3.5 w-3.5" />
                <span>{timelineData?.rooms?.length || 0} Consultórios</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300 text-xs font-bold">
                <CalendarClock className="h-3.5 w-3.5" />
                <span>{timelineData?.sessions?.length || 0} Agendamentos</span>
              </div>
            </div>
          </div>

          {/* Timeline Table Container */}
          {isLoadingTimeline ? (
            <div className="p-16 text-center text-xs text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-teal-500" />
              Carregando grade de ocupação dos consultórios...
            </div>
          ) : !timelineData || timelineData.rooms.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <Building className="h-10 w-10 mx-auto text-slate-400" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">Nenhum consultório físico cadastrado</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Cadastre seus consultórios físicos para acompanhar a timeline de ocupação e prevenir choques de agenda.
              </p>
              {(isAdmin || isSecretary) && (
                <button
                  onClick={() => {
                    setRoomToEdit(null);
                    setIsRoomModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold shadow-xs hover:bg-teal-700 transition cursor-pointer"
                >
                  + Cadastrar Consultório
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-auto max-h-[calc(100vh-230px)] min-h-[500px] relative">
              <div className="min-w-[800px]">
                {/* Header Row: Rooms (Sticky Top) */}
                <div
                  className="grid border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 sticky top-0 z-20 shadow-xs"
                  style={{
                    gridTemplateColumns: `90px repeat(${timelineData.rooms.length}, minmax(180px, 1fr))`,
                  }}
                >
                  <div className="p-3 text-[11px] font-bold text-slate-400 flex items-center justify-center border-r border-slate-200 dark:border-slate-700 sticky left-0 z-30 bg-slate-100 dark:bg-slate-900">
                    <Clock className="h-3.5 w-3.5 mr-1" /> Horário
                  </div>
                  {timelineData.rooms.map((room) => (
                    <div
                      key={room.id}
                      className="p-3 border-r border-slate-200 dark:border-slate-700 relative overflow-hidden bg-slate-100 dark:bg-slate-900"
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ backgroundColor: room.color_code || '#0d9488' }}
                      />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {room.name}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                          {room.room_type || 'Geral'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline Hour Rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {HOURS_TIMELINE.map((hourStr) => {
                    const hourNum = parseInt(hourStr.split(':')[0]);

                    return (
                      <div
                        key={hourStr}
                        className="grid hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition min-h-[64px]"
                        style={{
                          gridTemplateColumns: `90px repeat(${timelineData.rooms.length}, minmax(180px, 1fr))`,
                        }}
                      >
                        {/* Time label */}
                        <div className="p-2.5 text-xs font-mono font-bold text-slate-400 dark:text-slate-400 flex items-center justify-center border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 sticky left-0 z-10">
                          {hourStr}
                        </div>

                        {/* Room slots */}
                        {timelineData.rooms.map((room) => {
                          // Find sessions overlapping with this hour slot [hourNum:00 to hourNum+1:00]
                          const matchingSessions = (timelineData.sessions || []).filter((s) => {
                            if (s.room_id !== room.id) return false;
                            const startParts = s.start_time.split('T')[1]?.split(':') || ['0', '0'];
                            const endParts = s.end_time.split('T')[1]?.split(':') || ['0', '0'];
                            const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
                            const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
                            const slotStart = hourNum * 60;
                            const slotEnd = (hourNum + 1) * 60;
                            return startMin < slotEnd && endMin > slotStart;
                          });

                          return (
                            <div
                              key={room.id}
                              className="p-1.5 border-r border-slate-200 dark:border-slate-700 flex flex-col justify-center"
                            >
                              {matchingSessions.length === 0 ? (
                                <div className="h-full rounded-lg border border-dashed border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-400 font-medium py-2">
                                  Livre
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {matchingSessions.map((session) => {
                                    const sTime = session.start_time.split('T')[1]?.substring(0, 5);
                                    const eTime = session.end_time.split('T')[1]?.substring(0, 5);

                                    const isNow = session.presence_status === 'IN_SESSION';
                                    const isWaiting = session.presence_status === 'WAITING' || session.presence_status === 'CALLED';
                                    const isCompleted = session.presence_status === 'COMPLETED';

                                    const statusClass = isNow
                                      ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-200'
                                      : isWaiting
                                      ? 'bg-amber-950/70 border-amber-500/80 text-amber-200'
                                      : isCompleted
                                      ? 'bg-purple-950/60 border-purple-500/60 text-purple-200 opacity-75'
                                      : 'bg-slate-900 border-slate-700 text-slate-200';

                                    return (
                                      <div
                                        key={session.id}
                                        className={`p-2 rounded-xl border shadow-xs text-xs space-y-1 ${statusClass}`}
                                        style={{ borderLeftColor: room.color_code || '#0d9488', borderLeftWidth: '3px' }}
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-bold text-[11px] truncate">
                                            {session.patient_display_name || session.patient_name}
                                          </span>
                                          <span className="text-[9px] font-mono shrink-0 px-1 py-0.2 rounded bg-black/30">
                                            {sTime} - {eTime}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] opacity-80">
                                          <span className="truncate">Psi: {session.psychologist_name.split(' ')[0]}</span>
                                          <span className="font-bold uppercase text-[8px]">
                                            {isNow ? '🟢 Atendendo' : isWaiting ? '🟡 Espera' : isCompleted ? '🟣 Feita' : 'Agendada'}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Room Modal for Creating/Editing Rooms */}
      <RoomModal
        isOpen={isRoomModalOpen}
        roomToEdit={roomToEdit}
        onClose={() => setIsRoomModalOpen(false)}
        onSuccess={() => {
          setIsRoomModalOpen(false);
          fetchLiveBoard();
          if (activeSubTab === 'timeline') {
            fetchTimelineData(timelineDate);
          }
        }}
      />
    </div>
  );
};
