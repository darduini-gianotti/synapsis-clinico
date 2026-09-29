import React, { useState, useEffect } from 'react';
import { Patient } from '../../types.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { calculateAge } from '../../utils/cpfValidator.js';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  DollarSign,
  TrendingUp,
  UserCheck,
  Receipt,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  PhoneCall,
  Mail,
  User,
  HeartPulse
} from 'lucide-react';

interface PatientOverviewTabProps {
  patient: Patient;
  onNavigateToTab: (tab: 'profile' | 'clinical', subTab?: string) => void;
  onOpenSettleModal?: (patientId: number) => void;
}

export const PatientOverviewTab: React.FC<PatientOverviewTabProps> = ({
  patient,
  onNavigateToTab,
  onOpenSettleModal,
}) => {
  const { isAdmin, hasPermission } = useAuth();
  const canViewFinancial = isAdmin || hasPermission('view_financial');
  const [indicators, setIndicators] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchIndicators = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/patients/${patient.id}/indicators`);
      setIndicators(res.data);
    } catch (err) {
      console.error('Failed to load patient indicators:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIndicators();
  }, [patient.id]);

  const age = patient.birth_date ? calculateAge(patient.birth_date) : null;
  const cleanPhone = patient.phone ? patient.phone.replace(/\D/g, '') : '';

  // Verificação de pendências cadastrais
  const missingFields: string[] = [];
  if (!patient.cpf || !patient.cpf.trim()) missingFields.push('CPF');
  if (!patient.phone || !patient.phone.trim()) missingFields.push('Celular');
  if (!patient.email || !patient.email.trim()) missingFields.push('E-mail');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ======================================================== */}
      {/* 1. Alerta de Pendências Cadastrais (se houver)           */}
      {/* ======================================================== */}
      {missingFields.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Cadastro com dados pendentes
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Faltam os seguintes dados para completar o cadastro: <strong>{missingFields.join(', ')}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('profile')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer self-start sm:self-auto shrink-0"
          >
            Completar no Cadastro
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. Card de Resumo Cadastral & Contatos Rápidos           */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Resumo do Paciente
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('profile')}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Ver Cadastro Completo</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${canViewFinancial ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 text-xs`}>
          {/* Idade & Nascimento */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Idade & Nascimento:</span>
            <p className="font-bold text-slate-800 dark:text-slate-100">
              {age !== null ? age.text : 'Não informada'}
            </p>
            {patient.birth_date && (
              <span className="text-[11px] text-slate-500">
                {new Date(patient.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>

          {/* Contato Principal */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">WhatsApp / Comunicação:</span>
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[170px]">
                {patient.phone || (patient.guardian?.phone ? `${patient.guardian.phone}` : 'Sem telefone')}
              </span>
              <div className="flex items-center gap-1">
                {cleanPhone.length >= 10 && (
                  <a
                    href={`https://api.whatsapp.com/send?phone=55${cleanPhone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="Conversar com o Paciente via WhatsApp"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </a>
                )}
                {patient.guardian?.phone && patient.guardian.phone.replace(/\D/g, '').length >= 10 && (
                  <a
                    href={`https://api.whatsapp.com/send?phone=55${patient.guardian.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    title={`Conversar com o Responsável (${patient.guardian.fullName || 'Legal'}) via WhatsApp`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
            <span className="text-[11px] text-slate-500 truncate block">
              {patient.email || (patient.guardian?.email ? `${patient.guardian.email} (Resp)` : 'Sem e-mail')}
            </span>
          </div>

          {/* Plano & Valor */}
          {canViewFinancial && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Plano Terapêutico:</span>
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {patient.financial_plan_type || 'Por Sessão'}
              </p>
              <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                R$ {Number(patient.session_price || 0).toFixed(2)} / sessão
              </span>
            </div>
          )}

          {/* Responsável / Emergência */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
              {patient.group === 'Criança' || patient.group === 'Adolescente' ? 'Responsável Legal:' : 'Emergência:'}
            </span>
            {patient.guardian?.fullName ? (
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                  {patient.guardian.fullName}
                </p>
                <span className="text-[11px] text-slate-500">
                  {patient.guardian.relationship || 'Responsável'} {patient.guardian.phone ? `• ${patient.guardian.phone}` : ''}
                </span>
              </div>
            ) : patient.emergency_contacts && patient.emergency_contacts.length > 0 && patient.emergency_contacts[0].fullName ? (
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                  {patient.emergency_contacts[0].fullName}
                </p>
                <span className="text-[11px] text-slate-500">
                  {patient.emergency_contacts[0].relationship || 'Contato'} {patient.emergency_contacts[0].phone ? `• ${patient.emergency_contacts[0].phone}` : ''}
                </span>
              </div>
            ) : (
              <span className="text-slate-400 italic">Não cadastrado</span>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. Dashboard de Atendimentos & Assiduidade                */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Atendimentos & Assiduidade
            </h3>
          </div>
        </div>

        {/* 4 Cards de KPI de Sessões */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {/* Total Realizadas */}
          <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50">
            <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wider block">
              Sessões Realizadas
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {indicators?.attendance?.totalCompleted ?? 0}
            </div>
            <span className="text-[10px] text-slate-400">atendimentos concluídos</span>
          </div>

          {/* Próximo Atendimento */}
          <div className="p-4 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50">
            <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider block">
              Próxima Sessão
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
              {indicators?.attendance?.nextSession ? (
                <div>
                  <span>
                    {new Date(indicators.attendance.nextSession.start_time).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-xs text-slate-500 font-normal ml-1">
                    às {new Date(indicators.attendance.nextSession.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 font-normal">Nenhum agendamento</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">
              {indicators?.attendance?.totalScheduled ?? 0} agendada(s) no futuro
            </span>
          </div>

          {/* Faltas / Cancelamentos */}
          <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50">
            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">
              Faltas & Cancelamentos
            </span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {indicators?.attendance?.totalNoShow ?? 0}
            </div>
            <span className="text-[10px] text-slate-400">
              {indicators?.attendance?.totalCanceled ?? 0} cancelada(s)
            </span>
          </div>

          {/* Taxa de Assiduidade % */}
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                Assiduidade
              </span>
              <span className="text-xs font-extrabold text-emerald-600">
                {indicators?.attendance?.attendanceRate ?? 100}%
              </span>
            </div>
            {/* Barra de progresso */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${indicators?.attendance?.attendanceRate ?? 100}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              taxa de presença do paciente
            </span>
          </div>
        </div>

        {/* Mini-Linha do Tempo dos Últimos Atendimentos */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Atendimentos Recentes
            </span>
            <button
              type="button"
              onClick={() => onNavigateToTab('clinical', 'records')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Ver Prontuário Completo</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {indicators?.attendance?.recentSessions && indicators.attendance.recentSessions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {indicators.attendance.recentSessions.map((s: any) => {
                const dateObj = new Date(s.start_time);
                const isCompleted = s.status === 'COMPLETED';
                const isNoShow = s.status === 'NO_SHOW';

                return (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-100 block">
                        {dateObj.toLocaleDateString('pt-BR')} às{' '}
                        {dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {s.modality === 'ONLINE' ? '🌐 Online' : '🏢 Presencial'}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : isNoShow
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-2">
              Nenhuma sessão realizada ainda para este paciente.
            </p>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. Dashboard de Saúde Financeira (Protegido por RBAC)    */}
      {/* ======================================================== */}
      {canViewFinancial && indicators?.canViewFinancial && indicators?.financial && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Saúde Financeira do Paciente
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Quitado */}
            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                Total de Honorários Quitados
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                R$ {Number(indicators.financial.totalPaid || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400">pagamentos recebidos</span>
            </div>

            {/* Total Pendente / Em Aberto */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                Honorários em Aberto / Pendentes
              </span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                R$ {Number(indicators.financial.totalPending || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400">
                {indicators.financial.pendingCount} atendimento(s) pendente(s)
              </span>
            </div>

            {/* Notas Fiscais */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                Notas Fiscais
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {indicators.financial.invoiceStatusSummary?.issued || 0} emitida(s)
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                {indicators.financial.invoiceStatusSummary?.requested || 0} aguardando contabilidade
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
