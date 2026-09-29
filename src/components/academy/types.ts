import { ActiveTab } from '../Sidebar.js';

export type TourCategory =
  | 'financial'
  | 'reception'
  | 'clinical'
  | 'agenda'
  | 'scales'
  | 'evaluations'
  | 'collaborators';

export interface AcademyModuleMeta {
  id: TourCategory;
  title: string;
  shortDescription: string;
  accentColor: 'emerald' | 'indigo' | 'teal' | 'sky' | 'purple' | 'amber';
  iconName: 'DollarSign' | 'Radio' | 'Brain' | 'Calendar' | 'Activity' | 'Lock' | 'Layers';
}

export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string; // CSS selector or [data-tour="..."]
  tabRequired?: ActiveTab;
  financialSubTabRequired?: 'revenues' | 'expenses' | 'billings' | 'invoices' | 'repasses' | 'carne-leao';
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  actionPrompt?: string; // Hint like "Clique para avançar" or "Selecione o paciente"
  advanceOnTargetClick?: boolean;
}

export interface AcademyTour {
  id: string;
  title: string;
  shortDescription: string;
  category: TourCategory;
  targetRole: 'ALL' | 'SECRETARY' | 'PSYCHOLOGIST' | 'ADMIN';
  estimatedMinutes: number;
  badge: string;
  steps: TourStep[];
}

export interface UserAcademyProgress {
  id?: number;
  user_id?: number;
  tour_id: string;
  category: TourCategory;
  completed_count: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  last_completed_at?: string;
}

export interface AcademyContextType {
  isSandboxActive: boolean;
  activeTour: AcademyTour | null;
  activeStepIndex: number;
  activeStep: TourStep | null;
  isCatalogOpen: boolean;
  userProgress: Record<string, UserAcademyProgress>;
  isLoadingProgress: boolean;
  openCatalog: () => void;
  closeCatalog: () => void;
  startTour: (tourId: string) => void;
  advanceStep: () => void;
  skipStep: () => void;
  exitSandbox: () => void;
  refreshProgress: () => Promise<void>;
  finishTourAndOpenCatalog: () => void;
}
