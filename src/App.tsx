import React, { Component, useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Header } from './components/Header.js';
import { Sidebar, ActiveTab } from './components/Sidebar.js';
import { Dashboard } from './components/Dashboard.js';
import { Agenda } from './components/Agenda.js';
import { PatientsAndRecords } from './components/PatientsAndRecords.js';
import { Lock, X, ShieldAlert } from 'lucide-react';
import { AcademyProvider, useAcademy } from './context/AcademyContext.js';
import { SandboxBanner } from './components/academy/SandboxBanner.js';
import { TourSpotlightOverlay } from './components/academy/TourSpotlightOverlay.js';
import { AcademyCatalogModal } from './components/academy/AcademyCatalogModal.js';
import { HelpProvider, useHelp } from './contexts/HelpContext.js';
import { InspectorBanner } from './components/help/InspectorBanner.js';
import { InspectorPopover } from './components/help/InspectorPopover.js';
import { AiHelpCenterModal } from './components/help/AiHelpCenterModal.js';

// Code-Split secondary modules and heavy modals (Performance Optimizer)
const NeuropsychEvaluationsModule = lazy(() =>
  import('./components/NeuropsychEvaluationsModule.js').then((m) => ({ default: m.NeuropsychEvaluationsModule }))
);
const FinancialModule = lazy(() =>
  import('./components/FinancialModule.js').then((m) => ({ default: m.FinancialModule }))
);
const ReportsModule = lazy(() =>
  import('./components/ReportsModule.js').then((m) => ({ default: m.ReportsModule }))
);
const CollaboratorsModule = lazy(() =>
  import('./components/CollaboratorsModule.js').then((m) => ({ default: m.CollaboratorsModule }))
);
const SettingsModule = lazy(() =>
  import('./components/SettingsModule.js').then((m) => ({ default: m.SettingsModule }))
);
const LoginModal = lazy(() =>
  import('./components/LoginModal.js').then((m) => ({ default: m.LoginModal }))
);
const PrimaryLoginScreen = lazy(() =>
  import('./components/auth/PrimaryLoginScreen.js').then((m) => ({ default: m.PrimaryLoginScreen }))
);
const PasswordActionModal = lazy(() =>
  import('./components/auth/PasswordActionModal.js').then((m) => ({ default: m.PasswordActionModal }))
);
const PsychologistProductivityModule = lazy(() =>
  import('./components/PsychologistProductivityModule.js').then((m) => ({ default: m.PsychologistProductivityModule }))
);
const ReceptionTowerModule = lazy(() =>
  import('./components/reception/ReceptionTowerModule.js').then((m) => ({ default: m.ReceptionTowerModule }))
);
const WaitingRoomTvView = lazy(() =>
  import('./components/reception/WaitingRoomTvView.js').then((m) => ({ default: m.WaitingRoomTvView }))
);
const PatientPortal = lazy(() =>
  import('./components/patient/PatientPortal.js').then((m) => ({ default: m.PatientPortal }))
);
const StandaloneVideoRoom = lazy(() =>
  import('./components/clinical/StandaloneVideoRoom.js').then((m) => ({ default: m.StandaloneVideoRoom }))
);
import { PsychologistMobileApp } from './components/mobile/PsychologistMobileApp.js';
import { TenantActivationScreen } from './components/auth/TenantActivationScreen.js';
import { useIsMobile } from './hooks/useIsMobile.js';

const ModuleLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 gap-3">
    <div className="h-8 w-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
    <span className="text-xs text-slate-500 dark:text-slate-400">Carregando módulo...</span>
  </div>
);

const AppContent: React.FC = () => {
  const { isSecretary, isLoading, user, hasPermission } = useAuth();
  const { isMobile, toggleViewMode } = useIsMobile();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedPatientIdForClinical, setSelectedPatientIdForClinical] = useState<number | null>(null);
  const [initialClinicalAction, setInitialClinicalAction] = useState<'none' | 'new_evolution'>('none');
  const [initialPatientTab, setInitialPatientTab] = useState<'overview' | 'profile' | 'clinical'>('overview');
  const [initialClinicalSubTab, setInitialClinicalSubTab] = useState<'evolutions' | 'new_evolution' | 'confidential' | 'documents' | 'scales' | 'evaluations'>('evolutions');
  const [restrictedModalFeature, setRestrictedModalFeature] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [financialSubTab, setFinancialSubTab] = useState<'revenues' | 'expenses' | 'billings' | 'invoices' | 'repasses' | 'carne-leao'>('revenues');
  const [showTvView, setShowTvView] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.pathname === '/tv-espera';
  });
  const [showPatientPortal, setShowPatientPortal] = useState<boolean>(() => {
    return typeof window !== 'undefined' && (window.location.pathname === '/paciente' || window.location.pathname.startsWith('/paciente/'));
  });
  const [showTeleconsulta, setShowTeleconsulta] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/teleconsulta');
  });
  const [showActivation, setShowActivation] = useState<boolean>(() => {
    return typeof window !== 'undefined' && (
      window.location.pathname === '/ativar' ||
      (window.location.pathname === '/' && new URLSearchParams(window.location.search).has('token') && new URLSearchParams(window.location.search).get('action') !== 'set-password')
    );
  });

  // URL-driven Token Action (e.g. ?action=set-password&token=xyz&type=invite)
  const [passwordActionToken, setPasswordActionToken] = useState<string | null>(null);
  const [passwordActionType, setPasswordActionType] = useState<'INVITE' | 'RESET'>('INVITE');

  useEffect(() => {
    const checkUrlToken = () => {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      const token = params.get('token');
      const type = params.get('type');

      if (action === 'set-password' && token) {
        setPasswordActionToken(token);
        setPasswordActionType(type?.toUpperCase() === 'RESET' ? 'RESET' : 'INVITE');
      }
    };

    const handleUrlChange = () => {
      checkUrlToken();
      setShowTvView(window.location.pathname === '/tv-espera');
      setShowPatientPortal(window.location.pathname === '/paciente' || window.location.pathname.startsWith('/paciente/'));
      setShowTeleconsulta(window.location.pathname.startsWith('/teleconsulta'));
      setShowActivation(
        window.location.pathname === '/ativar' ||
        (window.location.pathname === '/' && new URLSearchParams(window.location.search).has('token') && new URLSearchParams(window.location.search).get('action') !== 'set-password')
      );
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const handleClosePasswordAction = () => {
    setPasswordActionToken(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    url.searchParams.delete('token');
    url.searchParams.delete('type');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
  };

  const handleStartSession = (patientId: number, sessionId: number) => {
    setSelectedPatientIdForClinical(patientId);
    setInitialPatientTab('clinical');
    setInitialClinicalSubTab('new_evolution');
    setInitialClinicalAction('new_evolution');
    setActiveTab('patients');
  };

  const handleRestrictedAttempt = (featureName: string) => {
    setRestrictedModalFeature(featureName);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center animate-in fade-in">
          <img
            src="/landing/synapsi_brain1.png"
            alt="Synapsis Clínico"
            className="h-16 w-auto animate-pulse drop-shadow-[0_0_25px_rgba(45,212,191,0.4)]"
          />
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-xl font-extrabold text-white tracking-tight">Synapsis</span>
              <span className="text-xl font-light text-teal-400 tracking-tight">Clínico</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Iniciando ambiente seguro • Criptografia AES-256 (CFP 06/2019)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Public/Fullscreen TV View for waiting room
  if (showTvView) {
    return (
      <Suspense fallback={<ModuleLoadingFallback />}>
        <WaitingRoomTvView
          onBackToApp={() => {
            setShowTvView(false);
            if (window.location.pathname === '/tv-espera') {
              window.history.pushState({}, '', '/');
            }
          }}
        />
      </Suspense>
    );
  }

  // Public/Fullscreen Portal for Patient (Synapsis Paciente PWA)
  if (showPatientPortal) {
    return (
      <Suspense fallback={<ModuleLoadingFallback />}>
        <PatientPortal
          onClosePortal={() => {
            setShowPatientPortal(false);
            if (window.location.pathname.startsWith('/paciente')) {
              window.history.pushState({}, '', '/');
            }
          }}
        />
      </Suspense>
    );
  }

  // Public/Fullscreen Teleatendimento Video Room (Telepsicologia CFP nº 11/2018)
  if (showTeleconsulta) {
    const isPopout = window.location.pathname === '/teleconsulta/room';
    const params = new URLSearchParams(window.location.search);
    const tokenFromPath = window.location.pathname.startsWith('/teleconsulta/')
      ? window.location.pathname.replace('/teleconsulta/', '').split('/')[0].split('?')[0]
      : undefined;
    const sessionIdParam = params.get('sessionId') ? Number(params.get('sessionId')) : undefined;
    const roleParam = (params.get('role') as 'patient' | 'psychologist') || (isPopout ? 'psychologist' : 'patient');

    return (
      <Suspense fallback={<ModuleLoadingFallback />}>
        <StandaloneVideoRoom
          token={tokenFromPath}
          sessionId={sessionIdParam}
          role={roleParam}
          onExit={() => {
            setShowTeleconsulta(false);
            if (window.location.pathname.startsWith('/teleconsulta')) {
              window.history.pushState({}, '', '/');
            }
          }}
        />
      </Suspense>
    );
  }

  // Public Onboarding Activation Screen for Clube das Fundadoras (/ativar?token=...)
  if (showActivation) {
    return (
      <TenantActivationScreen
        onSuccess={(_token, _user) => {
          setShowActivation(false);
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
        onCancel={() => {
          setShowActivation(false);
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  // When user is not authenticated, render the dedicated PrimaryLoginScreen
  if (!user) {
    return (
      <Suspense fallback={<ModuleLoadingFallback />}>
        <PrimaryLoginScreen />
      </Suspense>
    );
  }

  // Mobile-First Experience for Psychologists (Synapsis Mobile PWA)
  if (isMobile) {
    return (
      <Suspense fallback={<ModuleLoadingFallback />}>
        <PsychologistMobileApp
          onSwitchToDesktop={toggleViewMode}
          onOpenTeleconsulta={(tokenOrSessionId) => {
            if (typeof tokenOrSessionId === 'string') {
              window.location.href = `/teleconsulta/${tokenOrSessionId}`;
            } else {
              window.location.href = `/teleconsulta?sessionId=${tokenOrSessionId}&role=psychologist`;
            }
          }}
        />
      </Suspense>
    );
  }

interface MainAppLayoutProps {
  activeTab: ActiveTab;
  setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;
  financialSubTab: 'revenues' | 'expenses' | 'billings' | 'invoices' | 'repasses' | 'carne-leao';
  setFinancialSubTab: React.Dispatch<React.SetStateAction<'revenues' | 'expenses' | 'billings' | 'invoices' | 'repasses' | 'carne-leao'>>;
  selectedPatientIdForClinical: number | null;
  setSelectedPatientIdForClinical: React.Dispatch<React.SetStateAction<number | null>>;
  initialClinicalAction: 'none' | 'new_evolution';
  setInitialClinicalAction: React.Dispatch<React.SetStateAction<'none' | 'new_evolution'>>;
  initialPatientTab: 'overview' | 'profile' | 'clinical';
  setInitialPatientTab: React.Dispatch<React.SetStateAction<'overview' | 'profile' | 'clinical'>>;
  initialClinicalSubTab: 'evolutions' | 'new_evolution' | 'confidential' | 'documents' | 'scales' | 'evaluations';
  setInitialClinicalSubTab: React.Dispatch<React.SetStateAction<'evolutions' | 'new_evolution' | 'confidential' | 'documents' | 'scales' | 'evaluations'>>;
  handleStartSession: (patientId: number, sessionId: number) => void;
  setShowTvView: React.Dispatch<React.SetStateAction<boolean>>;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  restrictedModalFeature: string | null;
  setRestrictedModalFeature: React.Dispatch<React.SetStateAction<string | null>>;
  handleRestrictedAttempt: (featureName: string) => void;
  passwordActionToken: string | null;
  passwordActionType: 'INVITE' | 'RESET';
  handleClosePasswordAction: () => void;
  user: any;
}

const MainAppLayout: React.FC<MainAppLayoutProps> = ({
  activeTab,
  setActiveTab,
  financialSubTab,
  setFinancialSubTab,
  selectedPatientIdForClinical,
  setSelectedPatientIdForClinical,
  initialClinicalAction,
  setInitialClinicalAction,
  initialPatientTab,
  setInitialPatientTab,
  initialClinicalSubTab,
  setInitialClinicalSubTab,
  handleStartSession,
  setShowTvView,
  isLoginModalOpen,
  setIsLoginModalOpen,
  restrictedModalFeature,
  setRestrictedModalFeature,
  handleRestrictedAttempt,
  passwordActionToken,
  passwordActionType,
  handleClosePasswordAction,
  user,
}) => {
  const { hasPermission } = useAuth();
  const { isSandboxActive } = useAcademy();
  const {
    isInspectorActive,
    inspectElement,
    closeInspector,
    clearActiveItem,
    activeHelpItem,
    registerNavigationHandler,
  } = useHelp();

  // Registra as ações de navegação rápida solicitadas pelo Copiloto IA
  useEffect(() => {
    registerNavigationHandler((action: string) => {
      if (action === 'OPEN_AGENDA') {
        setActiveTab('agenda');
      } else if (action === 'OPEN_FINANCIAL_INVOICES' || action === 'OPEN_INVOICES') {
        setActiveTab('financial');
        setFinancialSubTab('invoices');
      } else if (action === 'OPEN_FINANCIAL_EXPENSES' || action === 'OPEN_EXPENSES') {
        setActiveTab('financial');
        setFinancialSubTab('expenses');
      } else if (action === 'OPEN_FINANCIAL_CARNE_LEAO' || action === 'OPEN_CARNE_LEAO') {
        setActiveTab('financial');
        setFinancialSubTab('carne-leao');
      } else if (action === 'OPEN_FINANCIAL_REPASSES' || action === 'OPEN_REPASSES') {
        setActiveTab('financial');
        setFinancialSubTab('repasses');
      } else if (action === 'OPEN_FINANCIAL_BILLINGS' || action === 'OPEN_BILLINGS') {
        setActiveTab('financial');
        setFinancialSubTab('billings');
      } else if (action === 'OPEN_FINANCIAL_REVENUES' || action === 'OPEN_REVENUES') {
        setActiveTab('financial');
        setFinancialSubTab('revenues');
      } else if (action === 'OPEN_FINANCIAL') {
        setActiveTab('financial');
      } else if (action === 'OPEN_PATIENTS') {
        setActiveTab('patients');
      } else if (action === 'OPEN_REPORTS') {
        setActiveTab('reports');
      } else if (action === 'OPEN_COLLABORATORS') {
        setActiveTab('collaborators');
      } else if (action === 'OPEN_SETTINGS') {
        setActiveTab('settings');
      }
    });
  }, [registerNavigationHandler, setActiveTab, setFinancialSubTab]);

  // Interceptador Global do Modo de Ajuda & Inspeção (Somente Leitura)
  useEffect(() => {
    if (!isInspectorActive) return;

    const handleGlobalHelpCapture = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (!targetEl) return;

      // 1. Se clicou dentro da UI do inspetor ou modal de ajuda, permite interação normal
      if (targetEl.closest('[data-inspector-ui]')) return;

      // 2. Se clicou em um elemento com ID específico de ajuda pré-catalogado
      const targetWithHelp = targetEl.closest('[data-help-id]') as HTMLElement | null;
      if (targetWithHelp) {
        e.preventDefault();
        e.stopPropagation();
        const helpId = targetWithHelp.getAttribute('data-help-id');
        if (helpId) {
          const rect = targetWithHelp.getBoundingClientRect();
          inspectElement(helpId, rect);
        }
        return;
      }

      // 3. Navegação da barra lateral (Sidebar) permitida para ir de tela em tela
      const isSidebarNav = targetEl.closest('[data-sidebar-nav]');
      if (isSidebarNav) {
        return;
      }

      // 4. Modo Lente Inteligente Universal: intercepta qualquer outro controle interativo e analisa com IA
      const interactiveEl = targetEl.closest('button, input, select, textarea, [role="button"], form, a') as HTMLElement | null;
      if (interactiveEl) {
        e.preventDefault();
        e.stopPropagation();
        const rect = interactiveEl.getBoundingClientRect();
        const rawLabel = (
          interactiveEl.innerText ||
          interactiveEl.getAttribute('aria-label') ||
          interactiveEl.getAttribute('title') ||
          interactiveEl.getAttribute('placeholder') ||
          interactiveEl.getAttribute('name') ||
          ''
        ).trim();
        const tagName = interactiveEl.tagName;
        const safeId = `dynamic-${tagName.toLowerCase()}-${rawLabel.slice(0, 15).replace(/\s+/g, '-').toLowerCase()}`;

        inspectElement(safeId, rect, {
          tagName,
          innerText: rawLabel || undefined,
          ariaLabel: interactiveEl.getAttribute('aria-label') || undefined,
          title: interactiveEl.getAttribute('title') || undefined,
          module: activeTab,
          subTab: activeTab === 'financial' ? financialSubTab : undefined,
        });
      }
    };

    const handleGlobalChangeCapture = (e: Event) => {
      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.closest('[data-inspector-ui]')) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const handleGlobalSubmitCapture = (e: Event) => {
      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.closest('[data-inspector-ui]')) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeHelpItem) {
          clearActiveItem();
        } else {
          closeInspector();
        }
        return;
      }

      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.closest('[data-inspector-ui]')) return;

      // Impede digitação em inputs durante o modo de ajuda
      if (targetEl?.matches('input, textarea, select, [contenteditable="true"]')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('click', handleGlobalHelpCapture, true);
    window.addEventListener('change', handleGlobalChangeCapture, true);
    window.addEventListener('submit', handleGlobalSubmitCapture, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('click', handleGlobalHelpCapture, true);
      window.removeEventListener('change', handleGlobalChangeCapture, true);
      window.removeEventListener('submit', handleGlobalSubmitCapture, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isInspectorActive, activeHelpItem, inspectElement, clearActiveItem, closeInspector]);

  return (
    <>
      <SandboxBanner />
      <InspectorBanner />
      <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
        <Header onOpenLoginModal={() => setIsLoginModalOpen(true)} />

        {/* Manual Login Modal triggered from Header (e.g. Profile Switch) */}
        {isLoginModalOpen && (
          <Suspense fallback={null}>
            <LoginModal
              isOpen={isLoginModalOpen}
              isForced={false}
              onClose={() => setIsLoginModalOpen(false)}
            />
          </Suspense>
        )}

        <div className="flex-1 flex flex-col md:flex-row">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              setSelectedPatientIdForClinical(null);
              setInitialClinicalAction('none');
            }}
            financialSubTab={financialSubTab}
            onFinancialSubTabChange={(subTab) => {
              setFinancialSubTab(subTab);
              setActiveTab('financial');
            }}
            onRestrictedClick={handleRestrictedAttempt}
          />

          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 w-full max-w-[1700px]">
            <Suspense fallback={<ModuleLoadingFallback />}>
              {activeTab === 'dashboard' && (hasPermission('view_dashboard') || isSandboxActive) && (
                <Dashboard
                  onStartSession={handleStartSession}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'reception_tower' && (
                <ReceptionTowerModule
                  onStartSession={handleStartSession}
                  onOpenTv={() => setShowTvView(true)}
                />
              )}

              {activeTab === 'agenda' && (hasPermission('view_agenda') || isSandboxActive) && (
                <Agenda
                  onStartSession={handleStartSession}
                  onNavigateToPatient={(patientId, tab = 'profile') => {
                    setSelectedPatientIdForClinical(patientId);
                    setInitialPatientTab(tab);
                    setInitialClinicalAction('none');
                    setActiveTab('patients');
                  }}
                  onNavigateToFinancial={(subTab) => {
                    setFinancialSubTab(subTab);
                    setActiveTab('financial');
                  }}
                />
              )}

              {activeTab === 'patients' && (hasPermission('view_patients') || isSandboxActive) && (
                <PatientsAndRecords 
                  initialPatientId={selectedPatientIdForClinical} 
                  initialAction={initialClinicalAction}
                  initialTab={initialPatientTab}
                  initialClinicalSubTab={initialClinicalSubTab}
                />
              )}

              {activeTab === 'evaluations' && (hasPermission('view_evaluations') || isSandboxActive) && (
                <NeuropsychEvaluationsModule
                  onNavigateToPatient={(patientId, tab = 'clinical', subTab = 'evaluations') => {
                    setSelectedPatientIdForClinical(patientId);
                    setInitialPatientTab(tab);
                    setInitialClinicalSubTab(subTab);
                    setInitialClinicalAction('none');
                    setActiveTab('patients');
                  }}
                />
              )}

              {activeTab === 'productivity' && (
                <PsychologistProductivityModule />
              )}

              {activeTab === 'financial' && (hasPermission('view_financial') || isSandboxActive) && (
                <FinancialModule
                  initialSubTab={financialSubTab}
                  onSubTabChange={(subTab) => setFinancialSubTab(subTab)}
                />
              )}

              {activeTab === 'reports' && (hasPermission('view_financial') || isSandboxActive) && (
                <ReportsModule />
              )}

              {activeTab === 'collaborators' && (hasPermission('manage_users') || isSandboxActive) && (
                <CollaboratorsModule />
              )}

              {activeTab === 'settings' && (hasPermission('manage_users') || isSandboxActive) && (
                <SettingsModule />
              )}
            </Suspense>
          </main>
        </div>

        {/* Restricted Access Modal for Secretary */}
        {restrictedModalFeature && !isSandboxActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-indigo-200 bg-white p-6 shadow-2xl dark:border-indigo-900 dark:bg-slate-800">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <ShieldAlert className="h-6 w-6" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Acesso Restrito: {restrictedModalFeature}
                  </h3>
                </div>
                <button
                  onClick={() => setRestrictedModalFeature(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 dark:hover:bg-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                O perfil <strong>SECRETÁRIA</strong> possui permissão exclusiva para agendamentos, cadastro básico e baixa de pagamentos.
              </p>

              <div className="mt-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 p-3 text-xs text-indigo-950 dark:text-indigo-200">
                <strong>Fundamentação Legal:</strong> Conforme o Código de Ética Profissional do Psicólogo, Resoluções CFP 01/2009 e 06/2019, e a Lei Geral de Proteção de Dados (LGPD 13.709/2018), prontuários, hipóteses e testes clínicos são de sigilo absoluto exclusivo do profissional habilitado.
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setRestrictedModalFeature(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* URL-driven Direct Token Password Set / Activation Modal */}
        {passwordActionToken && (
          <Suspense fallback={null}>
            <PasswordActionModal
              isOpen={!!passwordActionToken}
              token={passwordActionToken}
              type={passwordActionType}
              onClose={handleClosePasswordAction}
              onSuccess={() => {
                handleClosePasswordAction();
                if (!user) {
                  setIsLoginModalOpen(true);
                }
              }}
            />
          </Suspense>
        )}
        <TourSpotlightOverlay />
        <AcademyCatalogModal />
        <InspectorPopover />
        <AiHelpCenterModal />
      </div>
    </>
  );
};

  const handleNavigateTabFromAcademy = (tab: ActiveTab, subTab?: string) => {
    setActiveTab(tab);
    if (subTab) {
      setFinancialSubTab(subTab as any);
    }
  };

  return (
    <AcademyProvider onNavigateTab={handleNavigateTabFromAcademy}>
      <MainAppLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        financialSubTab={financialSubTab}
        setFinancialSubTab={setFinancialSubTab}
        selectedPatientIdForClinical={selectedPatientIdForClinical}
        setSelectedPatientIdForClinical={setSelectedPatientIdForClinical}
        initialClinicalAction={initialClinicalAction}
        setInitialClinicalAction={setInitialClinicalAction}
        initialPatientTab={initialPatientTab}
        setInitialPatientTab={setInitialPatientTab}
        initialClinicalSubTab={initialClinicalSubTab}
        setInitialClinicalSubTab={setInitialClinicalSubTab}
        handleStartSession={handleStartSession}
        setShowTvView={setShowTvView}
        isLoginModalOpen={isLoginModalOpen}
        setIsLoginModalOpen={setIsLoginModalOpen}
        restrictedModalFeature={restrictedModalFeature}
        setRestrictedModalFeature={setRestrictedModalFeature}
        handleRestrictedAttempt={handleRestrictedAttempt}
        passwordActionToken={passwordActionToken}
        passwordActionType={passwordActionType}
        handleClosePasswordAction={handleClosePasswordAction}
        user={user}
      />
    </AcademyProvider>
  );
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  declare props: ErrorBoundaryProps;
  declare setState: (state: Partial<ErrorBoundaryState> | ((prevState: ErrorBoundaryState) => Partial<ErrorBoundaryState>)) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Uncaught Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center text-xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold">Ocorreu um erro inesperado</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              O sistema identificou uma falha ao renderizar a tela. Clique abaixo para recarregar o Synapsis Clínico.
            </p>
            {this.state.error && (
              <pre className="text-[10px] text-left p-3 rounded-xl bg-slate-950 text-rose-300 font-mono overflow-auto max-h-32 border border-slate-800">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition cursor-pointer"
            >
              Recarregar Plataforma
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <HelpProvider>
          <AppContent />
        </HelpProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
