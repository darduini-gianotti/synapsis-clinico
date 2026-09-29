import React, { useState, useEffect } from 'react';
import { MobileHeader } from './MobileHeader.js';
import { MobileBottomNav, MobileTab } from './MobileBottomNav.js';
import { MobileTodayTab } from './tabs/MobileTodayTab.js';
import { MobilePatientsTab } from './tabs/MobilePatientsTab.js';
import { MobileFinancialTab } from './tabs/MobileFinancialTab.js';
import { MobileProfileTab } from './tabs/MobileProfileTab.js';
import { MobileQuickEvolutionModal } from './components/MobileQuickEvolutionModal.js';
import { MobilePinLockOverlay } from './components/MobilePinLockOverlay.js';
import { MobileSessionItem } from './components/MobileSessionCard.js';

interface PsychologistMobileAppProps {
  onSwitchToDesktop: () => void;
  onOpenTeleconsulta: (tokenOrSessionId: string | number) => void;
}

export const PsychologistMobileApp: React.FC<PsychologistMobileAppProps> = ({
  onSwitchToDesktop,
  onOpenTeleconsulta,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('today');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  // Estado da evolução rápida por voz
  const [evolutionSession, setEvolutionSession] = useState<MobileSessionItem | null>(null);
  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);

  // Segurança: PIN e Bloqueio após 10 min
  const [configuredPin, setConfiguredPin] = useState<string>(() => {
    if (typeof window === 'undefined') return '1234';
    return localStorage.getItem('synapsis_mobile_pin') || '1234';
  });
  const [isLocked, setIsLocked] = useState(false);

  // Timer de inatividade de 10 minutos (600.000 ms)
  useEffect(() => {
    let timer: any;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIsLocked(true);
      }, 10 * 60 * 1000);
    };

    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('keydown', resetTimer);

    // Também bloqueia se o app for minimizado / aba ficar invisível
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Quando voltar após minimizado, pede o PIN
        setIsLocked(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resetTimer();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleStartVideo = (session: MobileSessionItem) => {
    if (session.teleconsulta_token) {
      onOpenTeleconsulta(session.teleconsulta_token);
    } else {
      onOpenTeleconsulta(session.id);
    }
  };

  const handleOpenEvolution = (session: MobileSessionItem) => {
    setEvolutionSession(session);
    setIsEvolutionOpen(true);
  };

  const handleOpenEvolutionForPatient = (patientId: number, patientName: string) => {
    setEvolutionSession({
      id: 0,
      patient_id: patientId,
      patient_name: patientName,
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      status: 'SCHEDULED',
      modality: 'IN_PERSON',
    });
    setIsEvolutionOpen(true);
  };

  const handleViewPatient = (patientId: number) => {
    setSelectedPatientId(patientId);
    setActiveTab('patients');
  };

  const handleConfigurePin = () => {
    const newPin = prompt('Digite um novo PIN de 4 dígitos para bloqueio do app móvel:', configuredPin);
    if (newPin && newPin.length === 4 && /^\d+$/.test(newPin)) {
      setConfiguredPin(newPin);
      localStorage.setItem('synapsis_mobile_pin', newPin);
      alert('Novo PIN de segurança configurado com sucesso!');
    } else if (newPin !== null) {
      alert('O PIN deve conter exatamente 4 números.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Topbar Fixa */}
      <MobileHeader onSwitchToDesktop={onSwitchToDesktop} />

      {/* Conteúdo da Aba Ativa */}
      <main className="flex-1 px-3 pt-3 pb-2 max-w-md w-full mx-auto">
        {activeTab === 'today' && (
          <MobileTodayTab
            onStartVideo={handleStartVideo}
            onOpenEvolution={handleOpenEvolution}
            onViewPatient={handleViewPatient}
          />
        )}

        {activeTab === 'patients' && (
          <MobilePatientsTab
            onOpenEvolutionForPatient={handleOpenEvolutionForPatient}
            selectedPatientId={selectedPatientId}
          />
        )}

        {activeTab === 'financial' && <MobileFinancialTab />}

        {activeTab === 'profile' && (
          <MobileProfileTab
            onSwitchToDesktop={onSwitchToDesktop}
            onConfigurePin={handleConfigurePin}
            isPinConfigured={Boolean(configuredPin)}
          />
        )}
      </main>

      {/* Barra de Navegação Inferior Fixa */}
      <MobileBottomNav activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* Drawer de Evolução com Ditado de Voz */}
      <MobileQuickEvolutionModal
        session={evolutionSession}
        isOpen={isEvolutionOpen}
        onClose={() => {
          setIsEvolutionOpen(false);
          setEvolutionSession(null);
        }}
        onSuccess={() => {
          alert('Evolução clínica registrada no prontuário com sucesso!');
        }}
      />

      {/* Overlay de Bloqueio por PIN */}
      <MobilePinLockOverlay
        isLocked={isLocked}
        onUnlock={() => setIsLocked(false)}
        correctPin={configuredPin}
      />
    </div>
  );
};
