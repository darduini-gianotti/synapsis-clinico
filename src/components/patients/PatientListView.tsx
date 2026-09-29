import React, { useMemo } from 'react';
import { Patient, PatientGroup } from '../../types.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Search,
  Plus,
  Users,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  UserCheck,
  UserX,
  GraduationCap,
  Calendar,
  X,
  DollarSign,
} from 'lucide-react';

interface PatientListViewProps {
  patients: Patient[];
  isLoading: boolean;
  onSelectPatient: (patient: Patient) => void;
  onOpenNewPatientModal: () => void;
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  groupFilter: string;
  onGroupFilterChange: (val: string) => void;
  pendingFilter: boolean;
  onPendingFilterChange: (val: boolean) => void;
  onRefresh?: () => void;
}

export const PatientListView: React.FC<PatientListViewProps> = ({
  patients,
  isLoading,
  onSelectPatient,
  onOpenNewPatientModal,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  groupFilter,
  onGroupFilterChange,
  pendingFilter,
  onPendingFilterChange,
}) => {
  const { isAdmin, hasPermission } = useAuth();
  const canViewFinancial = isAdmin || hasPermission('view_financial');
  const canCreatePatients = isAdmin || hasPermission('create_patients');

  // Helper para verificar pendências cadastrais (falta CPF, telefone ou email)
  const getMissingFields = (p: Patient) => {
    const missing: string[] = [];
    if (!p.cpf || !p.cpf.trim()) missing.push('CPF');
    if (!p.phone || !p.phone.trim()) missing.push('Celular');
    if (!p.email || !p.email.trim()) missing.push('E-mail');
    return missing;
  };

  // Contagem de pacientes com pendência cadastral
  const pendingCount = useMemo(() => {
    return patients.filter((p) => getMissingFields(p).length > 0).length;
  }, [patients]);

  // Filtragem local complementar para garantir responsividade instantânea
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // Filtro de pendência
      if (pendingFilter && getMissingFields(p).length === 0) {
        return false;
      }
      // Filtro de status
      if (statusFilter !== 'ALL' && p.status !== statusFilter) {
        return false;
      }
      // Filtro de grupo
      if (groupFilter !== 'ALL' && p.group !== groupFilter) {
        return false;
      }
      // Busca textual
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = p.full_name.toLowerCase().includes(q);
        const matchesCpf = p.cpf ? p.cpf.toLowerCase().includes(q) : false;
        const matchesPhone = p.phone ? p.phone.toLowerCase().includes(q) : false;
        const matchesEmail = p.email ? p.email.toLowerCase().includes(q) : false;
        return matchesName || matchesCpf || matchesPhone || matchesEmail;
      }
      return true;
    });
  }, [patients, search, statusFilter, groupFilter, pendingFilter]);

  // Status badges configuration
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Ativo
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
            Inativo
          </span>
        );
      case 'DISCHARGED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
            Em Alta
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  // Group badge
  const getGroupBadge = (group?: PatientGroup) => {
    switch (group) {
      case 'Criança':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
            Criança
          </span>
        );
      case 'Adolescente':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
            Adolescente
          </span>
        );
      case 'Idoso':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
            Idoso
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
            Adulto
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ======================================================== */}
      {/* 1. Header do Módulo & Botão Novo Paciente                */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Pacientes & Prontuários
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                  {patients.length} {patients.length === 1 ? 'paciente' : 'pacientes'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acesse o cadastro completo, indicadores de assiduidade{canViewFinancial ? ', dados financeiros' : ''} e prontuário clínico protegido com AES-256.
              </p>
            </div>
          </div>
        </div>

        {canCreatePatients && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              id="btn-novo-paciente-lista"
              onClick={onOpenNewPatientModal}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-teal-500 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Paciente</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. Barra de Busca e Filtros Integrados                   */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
        {/* Campo de Busca em Tempo Real */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Comece a digitar o nome, CPF, e-mail ou celular do paciente..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Linha de Filtros: Status, Grupo e Pendências */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pílulas de Status */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Status:</span>
              <div className="flex items-center rounded-xl border border-slate-200 p-1 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {[
                  { id: 'ALL', label: 'Todos' },
                  { id: 'ACTIVE', label: 'Ativos' },
                  { id: 'INACTIVE', label: 'Inativos' },
                  { id: 'DISCHARGED', label: 'Em Alta' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onStatusFilterChange(st.id)}
                    className={`px-2.5 py-1 font-semibold rounded-lg cursor-pointer transition text-xs ${
                      statusFilter === st.id
                        ? 'bg-white text-teal-700 shadow-xs dark:bg-slate-700 dark:text-teal-300'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Seletor de Grupo */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Grupo:</span>
              <select
                value={groupFilter}
                onChange={(e) => onGroupFilterChange(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-hidden"
              >
                <option value="ALL">Todos os Grupos</option>
                <option value="Adulto">Adulto</option>
                <option value="Criança">Criança</option>
                <option value="Adolescente">Adolescente</option>
                <option value="Idoso">Idoso</option>
              </select>
            </div>
          </div>

          {/* Botão de Filtro de Pendências Cadastrais */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => onPendingFilterChange(!pendingFilter)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                pendingFilter
                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              }`}
              title="Filtrar pacientes com campos cadastrais incompletos (CPF, celular ou e-mail)"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Pendências Cadastrais ({pendingCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. Tabela Geral de Pacientes (100% da Largura)           */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900/50 overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px]">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold select-none">
              <tr>
                <th className="px-5 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Paciente</th>
                <th className="px-4 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Status</th>
                <th className="px-4 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Grupo</th>
                <th className="px-4 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Celular / WhatsApp</th>
                <th className="px-4 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">E-mail</th>
                {canViewFinancial && <th className="px-4 py-3.5 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Plano / Honorários</th>}
                <th className="px-5 py-3.5 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={canViewFinancial ? 7 : 6} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse"></span>
                      <span>Carregando pacientes...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={canViewFinancial ? 7 : 6} className="px-5 py-16 text-center text-slate-400">
                    <Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      Nenhum paciente encontrado
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tente alterar os termos de busca ou os filtros de status e grupo.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => {
                  const missing = getMissingFields(patient);
                  const cleanPhone = patient.phone ? patient.phone.replace(/\D/g, '') : '';
                  const initials = patient.full_name
                    .split(' ')
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase();

                  return (
                    <tr
                      key={patient.id}
                      data-tour={`patient-row-${patient.id}`}
                      onClick={() => onSelectPatient(patient)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer group"
                    >
                      {/* Paciente (Avatar, Nome em Link Teal, CPF) */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-400 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                            {initials}
                          </div>
                          <div>
                            <button
                              type="button"
                              data-tour={`patient-open-btn-${patient.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPatient(patient);
                              }}
                              className="font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 text-xs sm:text-sm hover:underline text-left block cursor-pointer"
                            >
                              {patient.full_name}
                            </button>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                              <span>CPF: {patient.cpf || 'Não informado'}</span>
                              {patient.psychologist_name && (
                                <span>• {patient.psychologist_name}</span>
                              )}
                            </div>
                            {missing.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                <span>Pendente: {missing.join(', ')}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getStatusBadge(patient.status)}
                      </td>

                      {/* Grupo */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getGroupBadge(patient.group)}
                      </td>

                      {/* Celular / WhatsApp */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {patient.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {patient.phone}
                            </span>
                            {cleanPhone.length >= 10 && (
                              <a
                                href={`https://api.whatsapp.com/send?phone=55${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Abrir WhatsApp do Paciente"
                                className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        ) : patient.guardian?.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                              {patient.guardian.phone} <span className="text-[10px] text-slate-400">(Resp)</span>
                            </span>
                            {patient.guardian.phone.replace(/\D/g, '').length >= 10 && (
                              <a
                                href={`https://api.whatsapp.com/send?phone=55${patient.guardian.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`Abrir WhatsApp do Responsável (${patient.guardian.fullName})`}
                                className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sem telefone</span>
                        )}
                      </td>

                      {/* E-mail */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {patient.email ? (
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {patient.email}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-200/50 dark:border-amber-800/40">
                            Sem E-mail
                          </span>
                        )}
                      </td>

                      {/* Plano / Preço */}
                      {canViewFinancial && (
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {patient.financial_plan_type || 'Por Sessão'}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            R$ {Number(patient.session_price || 0).toFixed(2)} / sessão
                          </span>
                        </td>
                      )}

                      {/* Ação */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          data-tour={`patient-open-btn-${patient.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPatient(patient);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800 font-bold text-xs transition cursor-pointer border border-teal-200 group-hover:scale-105"
                        >
                          <span>Ver Paciente</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
