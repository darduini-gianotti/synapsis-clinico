import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Session, Patient } from '../types.js';
import { DashboardMetricsRow } from './dashboard/DashboardMetricsRow.js';
import { PsychologistSelector, PsychologistItem } from './dashboard/PsychologistSelector.js';
import { DailyAgendaTimeline } from './dashboard/DailyAgendaTimeline.js';
import { BirthdayWidget, BirthdayPatient } from './dashboard/BirthdayWidget.js';
import { QuickRemindersWidget } from './dashboard/QuickRemindersWidget.js';
import { ShieldCheck } from 'lucide-react';

interface DashboardProps {
  onStartSession: (patientId: number, sessionId: number) => void;
  onNavigateTab: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartSession,
  onNavigateTab,
}) => {
  const { isSecretary, canAccessClinical, user, isLoading: isAuthLoading, clinicSettings } = useAuth();

  // Core States
  const [sessionsToday, setSessionsToday] = useState<Session[]>([]);
  const [psychologists, setPsychologists] = useState<PsychologistItem[]>([]);
  const [selectedPsychologistId, setSelectedPsychologistId] = useState<'ALL' | number>('ALL');
  const [birthdays, setBirthdays] = useState<BirthdayPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Actions & Feedback
  const [whatsappLoadingId, setWhatsappLoadingId] = useState<number | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 5000);
  };

  // Compute Birthdays for Today + Next 7 Days
  const computeBirthdays = (patientsList: Patient[]): BirthdayPatient[] => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    const todayMidnight = new Date(currentYear, todayMonth, todayDay);

    const results: BirthdayPatient[] = [];

    for (const p of patientsList) {
      if (!p.birth_date || p.status === 'INACTIVE') continue;
      const parts = p.birth_date.split('-');
      if (parts.length !== 3) continue;

      const bYear = parseInt(parts[0], 10);
      const bMonth = parseInt(parts[1], 10) - 1;
      const bDay = parseInt(parts[2], 10);

      // Birthday this year
      let birthdayDate = new Date(currentYear, bMonth, bDay);
      let diffDays = Math.round((birthdayDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

      // If near end of year (e.g. today is Dec 30 and birthday is Jan 2)
      if (diffDays < 0 && diffDays < -300) {
        birthdayDate = new Date(currentYear + 1, bMonth, bDay);
        diffDays = Math.round((birthdayDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
      }

      if (diffDays >= 0 && diffDays <= 7) {
        const isToday = diffDays === 0;
        const turningAge = currentYear - bYear;
        const dayAndMonthText = isToday
          ? 'Hoje'
          : birthdayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', weekday: 'short' });

        results.push({
          id: p.id,
          full_name: p.full_name,
          phone: p.phone,
          birth_date: p.birth_date,
          psychologist_name: p.psychologist_name,
          turningAge: Math.max(1, turningAge),
          isToday,
          daysUntil: diffDays,
          dayAndMonthText,
        });
      }
    }

    return results.sort((a, b) => {
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;
      return a.daysUntil - b.daysUntil;
    });
  };

  // Load Dashboard Data
  const fetchData = async () => {
    if (!user || isAuthLoading) return;
    try {
      setIsLoading(true);
      const todayIso = new Date().toISOString().split('T')[0];

      const [sessRes, collabRes, patRes] = await Promise.all([
        api.get(`/sessions?date=${todayIso}`),
        api.get('/collaborators'),
        api.get('/patients'),
      ]);

      const loadedSessions: Session[] = sessRes.data.sessions || [];
      setSessionsToday(loadedSessions);

      // Filter psychologists from collaborators
      const allUsers: any[] = collabRes.data.users || [];
      const psychList: PsychologistItem[] = allUsers
        .filter((u) => u.role_name === 'Psicólogo' || u.role_id === 2 || u.crp_number || u.role_id === 1)
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role_name: u.role_name,
          crp_number: u.crp_number || null,
        }));
      setPsychologists(psychList);

      // Default selection: if logged-in user is a psychologist, preselect them
      if (user.role === 'PSYCHOLOGIST' && selectedPsychologistId === 'ALL') {
        setSelectedPsychologistId(user.id);
      }

      // Compute birthdays
      const patientsList: Patient[] = patRes.data.patients || [];
      setBirthdays(computeBirthdays(patientsList));
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        console.error('Error loading dashboard data:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchData();
    }
  }, [isAuthLoading, user]);

  // WhatsApp Presence Reminder (Neutral LGPD)
  const handleWhatsAppReminder = async (sessionId: number) => {
    try {
      setWhatsappLoadingId(sessionId);
      const res = await api.post(`/sessions/${sessionId}/whatsapp-reminder`);
      const { whatsappUrl, recipientName, recipientType } = res.data;

      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      const targetLabel = recipientType === 'GUARDIAN' ? `responsável (${recipientName})` : 'paciente';
      showFeedback(`Lembrete gerado e aberto no WhatsApp para ${targetLabel} (Mensagem neutra sem expor dados clínicos).`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao gerar confirmação no WhatsApp');
    } finally {
      setWhatsappLoadingId(null);
    }
  };

  // Change Session Status
  const handleStatusChange = async (sessionId: number, newStatus: string) => {
    try {
      await api.patch(`/sessions/${sessionId}/status`, { status: newStatus });
      setSessionsToday((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: newStatus as any } : s))
      );
      showFeedback('Status da sessão atualizado com sucesso.');
    } catch (err) {
      console.error('Error changing session status', err);
      alert('Erro ao atualizar status da sessão.');
    }
  };

  // Filter sessions by selected psychologist
  const filteredSessions = useMemo(() => {
    if (selectedPsychologistId === 'ALL') {
      return sessionsToday;
    }
    return sessionsToday.filter((s) => s.psychologist_id === selectedPsychologistId);
  }, [sessionsToday, selectedPsychologistId]);

  // Operational metrics
  const totalSessions = filteredSessions.filter((s) => s.status !== 'CANCELED').length;
  const confirmedSessions = filteredSessions.filter((s) => s.status === 'CONFIRMED').length;
  const inProgressOrUpcoming = filteredSessions.filter(
    (s) => s.status !== 'COMPLETED' && s.status !== 'CANCELED'
  ).length;

  const selectedPsychologistName = useMemo(() => {
    if (selectedPsychologistId === 'ALL') return undefined;
    const found = psychologists.find((p) => p.id === selectedPsychologistId);
    return found ? found.name : undefined;
  }, [psychologists, selectedPsychologistId]);

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Toast Alert Feedback */}
      {notificationMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 p-3 text-xs font-semibold text-teal-900 dark:border-teal-800 dark:bg-teal-950/80 dark:text-teal-200 shadow-xs animate-in fade-in">
          <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* 1. TOP BAR COMPACTA: Título do Painel + Pílulas de Métricas Operacionais (Ganho de +120px) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Painel do Dia
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acompanhamento operacional em tempo real e atendimentos diários.
          </p>
        </div>

        {/* Compact Metrics Row */}
        <DashboardMetricsRow
          totalSessions={totalSessions}
          confirmedSessions={confirmedSessions}
          inProgressOrUpcoming={inProgressOrUpcoming}
          birthdaysThisWeek={birthdays.length}
          selectedPsychologistName={selectedPsychologistName}
        />
      </div>

      {/* 2. ZONA PRINCIPAL: GRID EM 2 COLUNAS (8 cols Agenda / 4 cols Barra Lateral Unificada) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Principal: Timeline da Agenda do Dia (8 cols - 70% da tela!) */}
        <div className="lg:col-span-8">
          <DailyAgendaTimeline
            sessions={filteredSessions}
            selectedPsychologistName={selectedPsychologistName}
            canAccessClinical={canAccessClinical}
            onStartSession={onStartSession}
            onWhatsAppReminder={handleWhatsAppReminder}
            onStatusChange={handleStatusChange}
            onNavigateToFullAgenda={() => onNavigateTab('agenda')}
            whatsappLoadingId={whatsappLoadingId}
          />
        </div>

        {/* Coluna Lateral Direita de Apoio: Psicólogos + Aniversariantes + Lembretes (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <PsychologistSelector
            psychologists={psychologists}
            selectedId={selectedPsychologistId}
            onSelect={(id) => setSelectedPsychologistId(id)}
            sessionsToday={sessionsToday}
            isLoading={isLoading}
          />

          <BirthdayWidget
            birthdays={birthdays}
            clinicName={clinicSettings?.clinic_name || 'PsicoGestão'}
            isLoading={isLoading}
          />

          <QuickRemindersWidget
            userRole={user?.role || 'PSYCHOLOGIST'}
            onNavigateToTab={onNavigateTab}
          />
        </div>
      </div>
    </div>
  );
};
