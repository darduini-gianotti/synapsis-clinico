import React, { useState } from 'react';
import { Patient } from '../../types.js';
import { useAuth } from '../../context/AuthContext.js';
import { calculateAge, formatCPF } from '../../utils/cpfValidator.js';
import { PatientOverviewTab } from './PatientOverviewTab.js';
import { PatientProfileTab } from './PatientProfileTab.js';
import { PatientClinicalTab } from './PatientClinicalTab.js';
import { PatientFinancialTab } from './PatientFinancialTab.js';
import {
  ArrowLeft,
  LayoutDashboard,
  UserCheck,
  FileText,
  Calendar,
  Plus,
  PhoneCall,
  Lock,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  HeartPulse,
  DollarSign,
} from 'lucide-react';


interface PatientHubViewProps {
  patient: Patient;
  onBackToList: () => void;
  onUpdatePatient: (updated: Patient) => void;
  onCreatePatient?: (created: Patient) => void;
  onOpenSettleModal?: (patientId: number) => void;
  initialTab?: 'overview' | 'profile' | 'clinical' | 'financial';
  initialClinicalSubTab?: 'evolutions' | 'new_evolution' | 'confidential' | 'documents' | 'scales' | 'evaluations';
}

export const PatientHubView: React.FC<PatientHubViewProps> = ({
  patient,
  onBackToList,
  onUpdatePatient,
  onCreatePatient,
  onOpenSettleModal,
  initialTab = 'overview',
  initialClinicalSubTab = 'evolutions',
}) => {
  const { isSecretary, canAccessClinical, hasPermission } = useAuth();
  const canViewFinancial = hasPermission('view_financial');
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'clinical' | 'financial'>(patient.id === 0 ? 'profile' : initialTab);
  const [clinicalSubTab, setClinicalSubTab] = useState<'evolutions' | 'new_evolution' | 'confidential' | 'documents' | 'scales' | 'evaluations'>(
    initialClinicalSubTab
  );


  const age = patient.birth_date ? calculateAge(patient.birth_date) : null;
  const patientPhoneClean = (patient.phone || '').replace(/\D/g, '');
  const guardianPhoneClean = (patient.guardian?.phone || '').replace(/\D/g, '');

  const isMinor = patient.group === 'Criança' || patient.group === 'Adolescente';
  const routing = patient.whatsapp_routing;
  const preferGuardian = routing?.appointmentChannel === 'GUARDIAN' || (!routing && isMinor && Boolean(guardianPhoneClean));

  const primaryPhone = preferGuardian && guardianPhoneClean ? guardianPhoneClean : (patientPhoneClean || guardianPhoneClean);
  const primaryName = preferGuardian && guardianPhoneClean ? (patient.guardian?.fullName?.split(' ')[0] || 'Responsável') : (patient.full_name?.split(' ')[0] || 'Paciente');
  const isTargetingGuardian = preferGuardian && Boolean(guardianPhoneClean);
  const rawPhone = primaryPhone;

  const handleNavigateFromOverview = (tab: 'profile' | 'clinical', subTab?: string) => {
    setActiveTab(tab);
    if (tab === 'clinical' && subTab) {
      setClinicalSubTab(subTab as any);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. TOP HUB HEADER BAR */}
      {/* ========================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Back button & Patient Avatar & Title */}
          <div className="flex items-start sm:items-center gap-4">
            <button
              type="button"
              onClick={onBackToList}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0"
              title="Voltar para a lista geral de pacientes"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar para Lista</span>
            </button>

            {/* Avatar */}
            <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              {patient.id === 0 ? (
                <Plus className="h-6 w-6" />
              ) : (
                patient.full_name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() || 'P'
              )}
            </div>

            {/* Patient Name & Quick Badges */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {patient.id === 0 ? 'Novo Cadastro de Paciente' : patient.full_name}
                </h1>

                {/* Group Badge */}
                {patient.id !== 0 && patient.group && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800">
                    {patient.group}
                  </span>
                )}

                {/* Status Badge */}
                {patient.id !== 0 && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      patient.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : patient.status === 'DISCHARGED'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {patient.status === 'ACTIVE'
                      ? 'Ativo'
                      : patient.status === 'DISCHARGED'
                      ? 'Alta Terapêutica'
                      : 'Inativo'}
                  </span>
                )}
              </div>

              {/* Contact & Demographics Snippet */}
              {patient.id !== 0 ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-600 dark:text-slate-400 font-medium">
                  {patient.cpf && <span>CPF: {patient.cpf}</span>}
                  {patient.cpf && (age || patientPhoneClean) && <span className="opacity-40">•</span>}
                  {age && <span>{age.text} ({patient.birth_date})</span>}
                  {age && patientPhoneClean && <span className="opacity-40">•</span>}
                  {patient.phone ? (
                    <a
                      href={`https://wa.me/55${rawPhone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      <PhoneCall className="h-3 w-3" />
                      <span>{patient.phone}</span>
                    </a>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Sem Celular</span>
                  )}
                </div>
              ) : (
                <div className="text-[13px] text-slate-600 dark:text-slate-400 font-medium">
                  Preencha as informações do formulário abaixo para registrar o paciente.
                </div>
              )}
            </div>
          </div>

          {/* Right: Quick Actions & Security Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* WhatsApp Quick Button */}
            {primaryPhone && (
              <div className="flex items-center gap-1.5">
                <a
                  href={`https://wa.me/55${primaryPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 text-xs font-semibold shadow-2xs transition"
                  title={isTargetingGuardian ? `Canal preferencial: Responsável ${patient.guardian?.fullName}` : 'Conversar no WhatsApp'}
                >
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
                  <span>WhatsApp {isTargetingGuardian ? `(Resp: ${primaryName})` : ''}</span>
                </a>
                {patientPhoneClean && guardianPhoneClean && (
                  <a
                    href={`https://wa.me/55${isTargetingGuardian ? patientPhoneClean : guardianPhoneClean}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-400 bg-white/5 hover:bg-white/15 text-slate-800 dark:text-white font-semibold text-xs shadow-2xs hover:border-slate-400 dark:hover:border-white transition cursor-pointer"
                    title={isTargetingGuardian ? `Conversar diretamente com o paciente (${patient.full_name})` : `Conversar com o responsável (${patient.guardian?.fullName})`}
                  >
                    <PhoneCall className="h-3.5 w-3.5 text-slate-600 dark:text-slate-200" />
                    <span>{isTargetingGuardian ? 'Falar c/ Paciente' : 'Falar c/ Resp.'}</span>
                  </a>
                )}
              </div>
            )}

              {/* Security Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-teal-200 bg-teal-50/70 text-teal-900 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-200 text-[11px] font-medium">
              <KeyRound className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>AES-256</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          {patient.id !== 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>1. Principal (Visão Geral)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>{patient.id === 0 ? 'Cadastro do Paciente' : '2. Cadastro Completo'}</span>
          </button>

          {patient.id !== 0 && (
            <button
              type="button"
              data-tour="patient-tab-clinical"
              disabled={isSecretary}
              onClick={() => setActiveTab('clinical')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'clinical'
                  ? 'bg-teal-600 text-white shadow-xs cursor-pointer'
                  : isSecretary
                  ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>3. Prontuário Clínico</span>
              {isSecretary && <Lock className="h-3.5 w-3.5 text-slate-400" />}
            </button>
          )}

          {/* Tab 4: Financeiro (RBAC: canViewFinancial) */}
          {patient.id !== 0 && canViewFinancial && (
            <button
              type="button"
              onClick={() => setActiveTab('financial')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'financial'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              <span>4. Financeiro</span>
            </button>
          )}
        </div>
      </div>


      {/* ========================================================= */}
      {/* 2. MAIN ACTIVE TAB CONTENT */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <PatientOverviewTab
          patient={patient}
          onNavigateToTab={handleNavigateFromOverview}
          onOpenSettleModal={onOpenSettleModal}
        />
      )}

      {activeTab === 'profile' && (
        <PatientProfileTab
          patient={patient}
          onUpdatePatient={onUpdatePatient}
          onCreatePatient={onCreatePatient}
        />
      )}

      {activeTab === 'clinical' && (
        <>
          {isSecretary ? (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-8 text-center dark:border-indigo-900 dark:bg-indigo-950/50">
              <Lock className="mx-auto h-12 w-12 text-indigo-600 dark:text-indigo-400" />
              <h3 className="mt-3 text-base font-bold text-indigo-950 dark:text-indigo-100">
                Sigilo Profissional Estrito (Resolução CFP nº 01/2009 e LGPD)
              </h3>
              <p className="mt-2 text-xs text-indigo-800 dark:text-indigo-300 max-w-md mx-auto leading-relaxed">
                Usuários com perfil de <strong>SECRETÁRIA</strong> possuem autorização legal restrita ao agendamento, cadastro básico e controle financeiro. O acesso a prontuários clínicos, queixas e anotações psicoterápicas é privativo do psicólogo responsável.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-white/70 dark:bg-slate-900 px-3 py-1.5 rounded-lg">
                <ShieldCheck className="h-4 w-4" />
                <span>Trilha de Auditoria registrada no servidor</span>
              </div>
            </div>
          ) : (
            <PatientClinicalTab
              patient={patient}
              initialSubTab={clinicalSubTab}
              onEvolutionCreated={() => {
                // Can trigger indicator refreshes or notifications
              }}
            />
          )}
          </>
        )}

      {/* ── Tab 4: Financeiro ─────────────────────────────── */}
      {activeTab === 'financial' && canViewFinancial && (
        <PatientFinancialTab patient={patient} />
      )}
      </div>
    );
  };

