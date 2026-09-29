import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.js';
import {
  Search,
  User,
  Phone,
  Calendar,
  FileText,
  AlertTriangle,
  ChevronRight,
  X,
  Plus,
  ShieldCheck,
} from 'lucide-react';

interface PatientItem {
  id: number;
  full_name: string;
  phone?: string;
  cpf?: string;
  status: string;
  created_at: string;
}

interface MobilePatientsTabProps {
  onOpenEvolutionForPatient: (patientId: number, patientName: string) => void;
  selectedPatientId?: number | null;
}

export const MobilePatientsTab: React.FC<MobilePatientsTabProps> = ({
  onOpenEvolutionForPatient,
  selectedPatientId,
}) => {
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activePatient, setActivePatient] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/patients');
      setPatients(res.data.patients || res.data || []);
    } catch (err) {
      console.error('Erro ao buscar pacientes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const openPatientDetails = async (patientId: number) => {
    try {
      setIsLoadingDetails(true);
      const res = await api.get(`/patients/${patientId}`);
      setActivePatient(res.data.patient || res.data);
    } catch (err) {
      console.error('Erro ao carregar detalhes do paciente:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      openPatientDetails(selectedPatientId);
    }
  }, [selectedPatientId]);

  const filteredPatients = patients.filter((p) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      p.full_name?.toLowerCase().includes(term) ||
      p.cpf?.includes(term) ||
      p.phone?.includes(term)
    );
  });

  return (
    <div className="space-y-3 pb-24">
      {/* Campo de Busca Rápida */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar paciente por nome ou CPF..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Lista de Pacientes */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-500 text-xs">
          Carregando pacientes...
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs">
          Nenhum paciente encontrado para "{search}".
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPatients.map((patient) => {
            const initials = patient.full_name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('');

            return (
              <button
                key={patient.id}
                onClick={() => openPatientDetails(patient.id)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-950/80 border border-teal-800/60 text-teal-400 flex items-center justify-center font-bold text-xs shrink-0">
                    {initials}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 line-clamp-1">
                      {patient.full_name}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {patient.phone || 'Sem telefone'} • CPF: {patient.cpf || 'Não inf.'}
                    </p>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Drawer: Ficha Rápida de Bolso */}
      {activePatient && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-4 max-w-md w-full mx-auto shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            {/* Header do Drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-sm">
                  {activePatient.full_name
                    ?.split(' ')
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{activePatient.full_name}</h3>
                  <p className="text-[11px] text-slate-400">
                    CPF: {activePatient.cpf || 'Não inf.'} • Tel: {activePatient.phone || '-'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActivePatient(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo Clínico de Bolso */}
            <div className="py-3 space-y-3">
              {/* Alerta Clínico */}
              {activePatient.clinical_alerts || activePatient.notes ? (
                <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    <span>Alerta Clínico / Observação</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    {activePatient.clinical_alerts || activePatient.notes}
                  </p>
                </div>
              ) : null}

              {/* Botão de Ação Rápida */}
              <button
                onClick={() => {
                  const pId = activePatient.id;
                  const pName = activePatient.full_name;
                  setActivePatient(null);
                  onOpenEvolutionForPatient(pId, pName);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-900/40 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Evolução com Ditado de Voz</span>
              </button>

              {/* Informações de Contato & Responsável */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Data de Nascimento:</span>
                  <span className="text-slate-200 font-semibold">
                    {activePatient.birth_date || 'Não informada'}
                  </span>
                </div>
                {activePatient.guardian_name && (
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Responsável Legal:</span>
                    <span className="text-slate-200 font-semibold">
                      {activePatient.guardian_name}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-400">
                  <span>Prontuário Imutável:</span>
                  <span className="flex items-center gap-1 text-teal-400 font-mono text-[10px]">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Ativo (CFP 06/2019)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
