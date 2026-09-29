import React, { useState, useEffect } from 'react';
import {
  Home, Calendar, CreditCard, FileText, MessageSquare, Brain,
  LogOut, Users, KeyRound, Sparkles, RefreshCw, X, ChevronDown, Check
} from 'lucide-react';
import { patientApi, PatientUser, Dependent } from '../../services/patientApi';
import { PatientLoginModal } from './PatientLoginModal';
import { PatientHomeTab } from './PatientHomeTab';
import { PatientAgendaTab } from './PatientAgendaTab';
import { PatientFinancialTab } from './PatientFinancialTab';
import { PatientDocumentsTab } from './PatientDocumentsTab';
import { PatientMessagesTab } from './PatientMessagesTab';
import { PatientActivitiesTab } from './PatientActivitiesTab';

export const PatientPortal: React.FC<{ onClosePortal?: () => void }> = ({ onClosePortal }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'agenda' | 'financial' | 'documents' | 'messages' | 'activities'>('home');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!patientApi.getToken());
  const [patientUser, setPatientUser] = useState<PatientUser | null>(patientApi.getStoredPatient());
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [appointmentsData, setAppointmentsData] = useState<{ upcoming: any[]; past: any[] }>({ upcoming: [], past: [] });
  const [financialData, setFinancialData] = useState<any>({ pending: [], paid: [], totalPending: 0, clinicPix: null });
  const [documentsData, setDocumentsData] = useState<any>({ officialDocuments: [], patientDocuments: [] });
  const [activitiesData, setActivitiesData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showDependentModal, setShowDependentModal] = useState<boolean>(false);
  const [showSetPinModal, setShowSetPinModal] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string>('');

  const loadAllData = async () => {
    if (!patientApi.getToken()) return;
    setLoading(true);
    try {
      const [profileRes, apptsRes, finRes, docsRes, actRes] = await Promise.all([
        patientApi.getProfile(),
        patientApi.getAppointments(),
        patientApi.getFinancial(),
        patientApi.getDocuments(),
        patientApi.getActivities(),
      ]);

      setProfileData(profileRes);
      setAppointmentsData({
        upcoming: apptsRes.upcoming || [],
        past: apptsRes.past || [],
      });
      setFinancialData(finRes);
      setDocumentsData(docsRes);
      setActivitiesData(actRes.activities || []);
    } catch (err) {
      console.error('Failed to load patient data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('invite')) {
        patientApi.logout();
        setIsAuthenticated(false);
        setPatientUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
    }
  }, [isAuthenticated]);

  const handleLoginSuccess = (patient: PatientUser, deps: Dependent[]) => {
    setIsAuthenticated(true);
    setPatientUser(patient);
    setDependents(deps || []);
    loadAllData();
  };

  const handleLogout = () => {
    patientApi.logout();
    setIsAuthenticated(false);
    setPatientUser(null);
    setProfileData(null);
  };

  const handleSwitchDependent = async (depId: number) => {
    try {
      const res = await patientApi.switchDependent(depId);
      setShowDependentModal(false);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Erro ao trocar perfil.');
    }
  };

  const handleSavePin = async () => {
    if (newPin.length !== 4) return;
    try {
      await patientApi.setPin(newPin);
      setPinSuccessMsg('PIN salvo com sucesso!');
      setTimeout(() => {
        setShowSetPinModal(false);
        setPinSuccessMsg('');
        setNewPin('');
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar PIN');
    }
  };

  // Se não estiver logado, exibe a modal de login
  if (!isAuthenticated) {
    return (
      <PatientLoginModal
        isOpen={true}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const activePatientName = profileData?.patient?.full_name || patientUser?.name || 'Paciente';
  const pendingBillsCount = financialData?.pending?.length || 0;
  const pendingActsCount = activitiesData.filter(a => a.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col font-sans">
      
      {/* Container Central Mobile-First (Max W-MD) */}
      <div className="w-full max-w-lg mx-auto bg-white dark:bg-slate-900 min-h-screen flex flex-col shadow-2xl relative border-x border-slate-200 dark:border-slate-800">
        
        {/* BARRA SUPERIOR (HEADER) */}
        <header className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Synapsis Paciente
                </h1>
              </div>

              {/* Seletor de Dependente / Nome Ativo */}
              <button
                type="button"
                onClick={() => setShowDependentModal(true)}
                className="flex items-center gap-1 text-sm font-bold text-slate-800 dark:text-white hover:text-indigo-600 transition-colors cursor-pointer"
              >
                <span className="truncate max-w-[180px]">{activePatientName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSetPinModal(true)}
              title="Cadastrar PIN de 4 dígitos"
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="Encerrar Sessão"
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {onClosePortal && (
              <button
                type="button"
                onClick={onClosePortal}
                title="Fechar visão do paciente"
                className="ml-1 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL DA ABA SELECIONADA */}
        <main className="flex-1 p-4 overflow-y-auto pb-24">
          {loading && (
            <div className="py-2 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>Sincronizando com a clínica...</span>
            </div>
          )}

          {activeTab === 'home' && (
            <PatientHomeTab
              patientProfile={profileData}
              nextAppointment={appointmentsData.upcoming[0] || null}
              financialSummary={financialData}
              pendingActivitiesCount={pendingActsCount}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onRefreshData={loadAllData}
            />
          )}

          {activeTab === 'agenda' && (
            <PatientAgendaTab
              appointmentsData={appointmentsData}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'financial' && (
            <PatientFinancialTab
              financialData={financialData}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'documents' && (
            <PatientDocumentsTab
              documentsData={documentsData}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'messages' && (
            <PatientMessagesTab />
          )}

          {activeTab === 'activities' && (
            <PatientActivitiesTab
              activitiesData={activitiesData}
              onRefresh={loadAllData}
            />
          )}
        </main>

        {/* BARRA INFERIOR DE NAVEGAÇÃO MOBILE (BOTTOM NAV) */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-50 px-2 py-2 flex items-center justify-around shadow-lg">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'home' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Início</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('agenda')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'agenda' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px]">Agenda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('financial')}
            className={`relative flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'financial' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[10px]">Financeiro</span>
            {pendingBillsCount > 0 && (
              <span className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'documents' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px]">Laudos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'messages' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px]">Mensagens</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activities')}
            className={`relative flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'activities' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Brain className="w-5 h-5" />
            <span className="text-[10px]">Tarefas</span>
            {pendingActsCount > 0 && (
              <span className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-purple-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>
        </nav>

        {/* MODAL DE TROCA DE DEPENDENTES (GESTÃO FAMILIAR) */}
        {showDependentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-extrabold text-base text-slate-800 dark:text-white">
                    Perfis & Dependentes
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDependentModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Escolha qual perfil você deseja visualizar e gerenciar:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {/* Opção atual ou dependentes */}
                {dependents.length > 0 ? (
                  dependents.map((dep) => {
                    const isCurrent = profileData?.patient?.id === dep.id;
                    return (
                      <button
                        key={dep.id}
                        type="button"
                        onClick={() => handleSwitchDependent(dep.id)}
                        className={`w-full p-3 rounded-2xl text-left flex items-center justify-between transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs">{dep.full_name}</p>
                          <p className={`text-[10px] ${isCurrent ? 'text-indigo-200' : 'text-slate-500'}`}>
                            {dep.group_type || 'Paciente'}
                          </p>
                        </div>
                        {isCurrent && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-3 rounded-2xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-between">
                    <span>{activePatientName} (Titular)</span>
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL PARA CADASTRAR/ATUALIZAR PIN */}
        {showSetPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-center">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-extrabold text-base text-slate-800 dark:text-white">
                    PIN de Acesso Rápido
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSetPinModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {pinSuccessMsg ? (
                <div className="p-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{pinSuccessMsg}</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Cadastre um PIN de 4 números para entrar rapidamente no app sem precisar esperar o código do WhatsApp.
                  </p>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-36 mx-auto tracking-[0.5em] text-2xl font-black text-center py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSavePin}
                    disabled={newPin.length !== 4}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md"
                  >
                    Salvar Novo PIN
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
