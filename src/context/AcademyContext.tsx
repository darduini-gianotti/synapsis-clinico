import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../services/api.js';
import { useAuth } from './AuthContext.js';
import {
  AcademyContextType,
  AcademyTour,
  TourStep,
  UserAcademyProgress,
} from '../components/academy/types.js';
import { ACADEMY_TOURS } from '../components/academy/academyToursData.js';
import { ActiveTab } from '../components/Sidebar.js';

const AcademyContext = createContext<AcademyContextType | undefined>(undefined);

interface AcademyProviderProps {
  children: ReactNode;
  onNavigateTab?: (tab: ActiveTab, subTab?: string) => void;
}

export const AcademyProvider: React.FC<AcademyProviderProps> = ({ children, onNavigateTab }) => {
  const { user } = useAuth();
  const [isSandboxActive, setIsSandboxActive] = useState<boolean>(false);
  const [activeTour, setActiveTour] = useState<AcademyTour | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [userProgress, setUserProgress] = useState<Record<string, UserAcademyProgress>>(() => {
    try {
      const saved = localStorage.getItem('synapsis_academy_progress');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [isLoadingProgress, setIsLoadingProgress] = useState<boolean>(false);

  const activeStep: TourStep | null =
    activeTour && activeTour.steps[activeStepIndex] ? activeTour.steps[activeStepIndex] : null;

  // Load user progress from API and synchronize cache
  const refreshProgress = useCallback(async () => {
    try {
      setIsLoadingProgress(true);
      const res = await api.get('/academy/progress');
      if (res.data?.progress) {
        const progressMap: Record<string, UserAcademyProgress> = {};
        res.data.progress.forEach((p: UserAcademyProgress) => {
          progressMap[p.tour_id] = p;
        });
        setUserProgress((prev) => {
          const merged = { ...prev, ...progressMap };
          try {
            localStorage.setItem('synapsis_academy_progress', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      }
    } catch (err) {
      console.warn('Could not load academy progress from API, using cached state', err);
    } finally {
      setIsLoadingProgress(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshProgress();
    } else {
      setIsSandboxActive(false);
      setActiveTour(null);
    }
  }, [user, refreshProgress]);

  const openCatalog = useCallback(() => setIsCatalogOpen(true), []);

  const startTour = useCallback(
    (tourId: string) => {
      const tour = ACADEMY_TOURS.find((t) => t.id === tourId);
      if (!tour) return;

      setIsSandboxActive(true);
      setActiveTour(tour);
      setActiveStepIndex(0);
      setIsCatalogOpen(false);

      // Auto-navigate to required initial tab if configured
      const firstStep = tour.steps[0];
      if (firstStep?.tabRequired && onNavigateTab) {
        onNavigateTab(firstStep.tabRequired, firstStep.financialSubTabRequired);
      }
    },
    [onNavigateTab]
  );

  const advanceStep = useCallback(async () => {
    if (!activeTour) return;

    if (activeStepIndex + 1 < activeTour.steps.length) {
      const nextIndex = activeStepIndex + 1;
      setActiveStepIndex(nextIndex);

      const nextStep = activeTour.steps[nextIndex];
      if (nextStep?.tabRequired && onNavigateTab) {
        onNavigateTab(nextStep.tabRequired, nextStep.financialSubTabRequired);
      }
    } else {
      // Tour completed!
      const completedTour = activeTour;

      // 1. Optimistic update instantâneo no estado e cache local
      setUserProgress((prev) => {
        const existing = prev[completedTour.id];
        const newCount = (existing?.completed_count || 0) + 1;
        const updatedItem: UserAcademyProgress = {
          id: existing?.id || Date.now(),
          tour_id: completedTour.id,
          category: completedTour.category,
          completed_count: newCount,
          status: 'COMPLETED',
          last_completed_at: new Date().toISOString(),
        };
        const nextMap = { ...prev, [completedTour.id]: updatedItem };
        try {
          localStorage.setItem('synapsis_academy_progress', JSON.stringify(nextMap));
        } catch (e) {}
        return nextMap;
      });

      // 2. Transição para o modal de conclusão da trilha
      setActiveStepIndex(completedTour.steps.length);

      // 3. Persistência assíncrona no backend
      try {
        await api.post('/academy/progress', {
          tour_id: completedTour.id,
          category: completedTour.category,
        });
      } catch (err) {
        console.error('Failed to record tour completion in API, preserved in local cache', err);
      }
    }
  }, [activeTour, activeStepIndex, onNavigateTab]);

  const skipStep = useCallback(() => {
    advanceStep();
  }, [advanceStep]);

  const exitSandbox = useCallback(() => {
    setIsSandboxActive(false);
    setActiveTour(null);
    setActiveStepIndex(0);
    if (onNavigateTab) {
      onNavigateTab('dashboard');
    }
  }, [onNavigateTab]);

  const closeCatalog = useCallback(() => {
    setIsCatalogOpen(false);
    if (!activeTour) {
      exitSandbox();
    }
  }, [activeTour, exitSandbox]);

  const finishTourAndOpenCatalog = useCallback(async () => {
    setActiveTour(null);
    setActiveStepIndex(0);
    setIsCatalogOpen(true);
    await refreshProgress();
  }, [refreshProgress]);

  return (
    <AcademyContext.Provider
      value={{
        isSandboxActive,
        activeTour,
        activeStepIndex,
        activeStep,
        isCatalogOpen,
        userProgress,
        isLoadingProgress,
        openCatalog,
        closeCatalog,
        startTour,
        advanceStep,
        skipStep,
        exitSandbox,
        refreshProgress,
        finishTourAndOpenCatalog,
      }}
    >
      {children}
    </AcademyContext.Provider>
  );
};

export const useAcademy = () => {
  const context = useContext(AcademyContext);
  if (!context) {
    throw new Error('useAcademy must be used within an AcademyProvider');
  }
  return context;
};
