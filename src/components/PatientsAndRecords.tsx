import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import { Patient } from '../types.js';
import { useAuth } from '../context/AuthContext.js';
import { PatientListView } from './patients/PatientListView.js';
import { PatientHubView } from './patients/PatientHubView.js';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAcademy } from '../context/AcademyContext.js';
import { MOCK_SANDBOX_PATIENTS } from './academy/mockData.js';

interface PatientsAndRecordsProps {
  initialPatientId?: number | null;
  initialAction?: 'none' | 'new_evolution';
  initialTab?: 'overview' | 'profile' | 'clinical' | 'financial' | 'insurance';
  initialClinicalSubTab?: 'evolutions' | 'new_evolution' | 'confidential' | 'documents' | 'scales' | 'evaluations';
}

export const PatientsAndRecords: React.FC<PatientsAndRecordsProps> = ({
  initialPatientId,
  initialAction = 'none',
  initialTab = 'overview',
  initialClinicalSubTab = 'evolutions',
}) => {
  const { user, isSecretary, canAccessClinical } = useAuth();
  const { isSandboxActive } = useAcademy();

  // Patients Data & Loading State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [pendingFilter, setPendingFilter] = useState(false);

  // View Navigation: 'list' (Nível 1) or 'hub' (Nível 2)
  const [viewMode, setViewMode] = useState<'list' | 'hub'>('list');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Hub initial tab routing
  const [hubTab, setHubTab] = useState<'overview' | 'profile' | 'clinical' | 'financial' | 'insurance'>(initialTab);
  const [hubClinicalSubTab, setHubClinicalSubTab] = useState<'evolutions' | 'new_evolution' | 'confidential' | 'documents' | 'scales' | 'evaluations'>(
    initialClinicalSubTab
  );

  // New Patient Creation
  const [feedback, setFeedback] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 5000);
  };

  // Fetch Patients List
  const fetchPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.append('search', search.trim());
      if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
      if (groupFilter !== 'ALL') queryParams.append('group', groupFilter);

      const res = await api.get(`/patients?${queryParams.toString()}`);
      let list: Patient[] = res.data.patients || [];
      if (isSandboxActive) {
        const hasMock = list.some((p) => p.id === 901);
        if (!hasMock) {
          list = [...(MOCK_SANDBOX_PATIENTS as unknown as Patient[]), ...list];
        }
      }
      setPatients(list);

      // Keep selected patient in sync if already selected
      if (selectedPatient) {
        const updated = list.find((p) => p.id === selectedPatient.id);
        if (updated) setSelectedPatient(updated);
      }
    } catch (err) {
      console.error('Failed to load patients list:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, groupFilter, selectedPatient?.id, isSandboxActive]);

  useEffect(() => {
    fetchPatients();
  }, [search, statusFilter, groupFilter, isSandboxActive]);

  // Handle external navigation from Agenda, Dashboard or Evaluations Hub (via props)
  useEffect(() => {
    if (initialPatientId) {
      const applyTabs = () => {
        setViewMode('hub');
        if (initialAction === 'new_evolution' && !isSecretary) {
          setHubTab('clinical');
          setHubClinicalSubTab('new_evolution');
        } else if (initialTab) {
          setHubTab(initialTab);
          if (initialClinicalSubTab) {
            setHubClinicalSubTab(initialClinicalSubTab);
          }
        } else {
          setHubTab('overview');
          setHubClinicalSubTab('evolutions');
        }
      };

      // Find patient or fetch if not in current list
      const match = patients.find((p) => p.id === initialPatientId) ||
        (isSandboxActive ? (MOCK_SANDBOX_PATIENTS as unknown as Patient[]).find((p) => p.id === initialPatientId) : undefined);
      if (match) {
        setSelectedPatient(match);
        applyTabs();
      } else {
        // Fetch specific patient directly
        api.get(`/patients/${initialPatientId}`)
          .then((res) => {
            if (res.data.patient) {
              setSelectedPatient(res.data.patient);
              applyTabs();
            }
          })
          .catch((err) => {
            console.error('Failed to fetch initial patient:', err);
          });
      }
    }
  }, [initialPatientId, initialAction, initialTab, initialClinicalSubTab, isSecretary, patients, isSandboxActive]);

  // Select patient to open Hub (Nível 2)
  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setHubTab('overview');
    setHubClinicalSubTab('evolutions');
    setViewMode('hub');
  };

  // Back to patient list (Nível 1)
  const handleBackToList = () => {
    setViewMode('list');
    // Refresh to ensure any edited data is fresh in list
    fetchPatients();
  };

  // Update patient handler
  const handleUpdatePatient = (updated: Patient) => {
    setSelectedPatient(updated);
    setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    showNotification('Cadastro do paciente atualizado com sucesso.');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Global Toast Notification */}
      {feedback && (
        <div className="flex items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 p-3.5 text-sm text-teal-900 shadow-xs dark:border-teal-800 dark:bg-teal-950/80 dark:text-teal-200 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Nível 1: Lista Geral de Pacientes (Tabela 100% de largura) */}
      {viewMode === 'list' && (
        <PatientListView
          patients={patients}
          isLoading={isLoading}
          onSelectPatient={handleSelectPatient}
          onOpenNewPatientModal={() => {
            setSelectedPatient({
              id: 0,
              psychologist_id: user?.id || 0,
              full_name: '',
              group: 'Adulto',
              phone: '',
              cpf: '',
              status: 'ACTIVE'
            } as Patient);
            setViewMode('hub');
            setHubTab('profile');
          }}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          groupFilter={groupFilter}
          onGroupFilterChange={setGroupFilter}
          pendingFilter={pendingFilter}
          onPendingFilterChange={setPendingFilter}
          onRefresh={fetchPatients}
        />
      )}

      {/* Nível 2: Hub Individual do Paciente (Tela Dedicada) */}
      {viewMode === 'hub' && selectedPatient && (
        <PatientHubView
          patient={selectedPatient}
          onBackToList={handleBackToList}
          onUpdatePatient={handleUpdatePatient}
          onCreatePatient={(newPatient) => {
            setPatients(prev => [newPatient, ...prev]);
            setSelectedPatient(newPatient);
            setHubTab('overview');
            showNotification(`Paciente "${newPatient.full_name}" cadastrado com sucesso!`);
          }}
          initialTab={hubTab}
          initialClinicalSubTab={hubClinicalSubTab}
          onOpenSettleModal={(pId) => {
            // Can notify or guide user to financial module
            alert(`Para dar baixa detalhada nos honorários, acesse o módulo Financeiro.`);
          }}
        />
      )}

    </div>
  );
};
