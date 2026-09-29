import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  DollarSign,
  Lock,
  TrendingUp,
  Settings,
  Brain,
  Percent,
  Radio,
  GraduationCap,
} from 'lucide-react';
import { useAcademy } from '../context/AcademyContext.js';

export type ActiveTab =
  | 'dashboard'
  | 'reception_tower'
  | 'agenda'
  | 'patients'
  | 'evaluations'
  | 'scales'
  | 'productivity'
  | 'financial'
  | 'reports'
  | 'audit'
  | 'collaborators'
  | 'settings';


interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onRestrictedClick?: (featureName: string) => void;
  financialSubTab?: 'revenues' | 'expenses' | 'billings' | 'invoices' | 'repasses' | 'carne-leao';
  onFinancialSubTabChange?: (subTab: 'revenues' | 'expenses' | 'billings' | 'invoices' | 'repasses' | 'carne-leao') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onRestrictedClick,
  financialSubTab = 'revenues',
  onFinancialSubTabChange,
}) => {
  const { isSecretary, isAdmin, user, hasPermission, clinicSettings } = useAuth();
  const { openCatalog, isSandboxActive } = useAcademy();
  const isRepasseEnabled = clinicSettings?.repasse_enabled !== false;
  const isReceptionTowerEnabled = clinicSettings?.reception_tower_enabled !== false;
  const isCollaboratorsEnabled = clinicSettings?.collaborators_enabled !== false;

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard Geral',
      icon: LayoutDashboard,
      restricted: isSandboxActive ? false : !hasPermission('view_dashboard'),
      badge: null,
    },
    ...(isReceptionTowerEnabled
      ? [
          {
            id: 'reception_tower' as ActiveTab,
            label: 'Torre de Recepção',
            icon: Radio,
            restricted: false,
            badge: 'Ao Vivo',
          },
        ]
      : []),
    {
      id: 'agenda' as ActiveTab,
      label: 'Agenda Inteligente',
      icon: Calendar,
      restricted: isSandboxActive ? false : !hasPermission('view_agenda'),
      badge: 'Hoje',
    },
    {
      id: 'patients' as ActiveTab,
      label: 'Pacientes',
      icon: Users,
      restricted: isSandboxActive ? false : !hasPermission('view_patients'),
      badge: hasPermission('view_clinical_records') ? 'Clínico' : 'Básico',
    },
    {
      id: 'evaluations' as ActiveTab,
      label: 'Avaliações Neuro',
      icon: Brain,
      restricted: isSandboxActive ? false : !hasPermission('view_evaluations'),
      badge: 'CFP 06/19',
    },
    ...((user?.role === 'PSYCHOLOGIST' || user?.role === 'ADMIN' || user?.role === 'SECRETARY') && isRepasseEnabled
      ? [
          {
            id: 'productivity' as ActiveTab,
            label: user?.role === 'PSYCHOLOGIST' ? 'Minha Produtividade' : 'Controle Repasses',
            icon: Percent,
            restricted: false,
            badge: null,
          },
        ]
      : []),
    {
      id: 'financial' as ActiveTab,
      label: 'Financeiro',
      icon: DollarSign,
      restricted: isSandboxActive ? false : !hasPermission('view_financial'),
      badge: null,
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Relatórios Financeiros',
      icon: TrendingUp,
      restricted: isSandboxActive ? false : !hasPermission('view_financial'),
      badge: null,
    },
    ...(isCollaboratorsEnabled
      ? [
          {
            id: 'collaborators' as ActiveTab,
            label: 'Colaboradores',
            icon: Lock,
            restricted: isSandboxActive ? false : !hasPermission('manage_users'),
            badge: 'RBAC',
          },
        ]
      : []),
    {
      id: 'settings' as ActiveTab,
      label: 'Configurações',
      icon: Settings,
      restricted: isSandboxActive ? false : !hasPermission('manage_users'),
      badge: null,
    },
  ];

  const handleItemClick = (item: typeof navItems[0]) => {
    if (item.restricted && !isSandboxActive) {
      if (onRestrictedClick) {
        onRestrictedClick(item.label);
      }
      return;
    }
    setActiveTab(item.id);
  };

  return (
    <aside className="w-full md:w-64 shrink-0 border-r border-slate-200 bg-slate-50/70 p-3 md:min-h-[calc(100vh-4rem)] dark:border-slate-800 dark:bg-slate-900/50">
      {/* RBAC Notice */}
      {!hasPermission('view_clinical_records') && (
        <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50/70 p-2.5 text-xs text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-200">
          <div className="flex items-center gap-1.5 font-semibold">
            <Lock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Perfil Restrito
          </div>
          <p className="mt-1 text-[11px] leading-tight text-indigo-700 dark:text-indigo-300">
            Acesso a prontuários e documentos clínicos restrito pelo sigilo profissional.
          </p>
        </div>
      )}

      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isBlocked = item.restricted;

          return (
            <React.Fragment key={item.id}>
              <button
                id={`nav-${item.id}`}
                data-tour={`nav-${item.id}`}
                data-sidebar-nav="true"
                onClick={() => handleItemClick(item)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20 dark:bg-teal-600'
                    : isBlocked
                    ? 'opacity-60 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/40 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : ''}`} />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isBlocked && (
                    <span title="Acesso bloqueado por sigilo profissional">
                      <Lock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    </span>
                  )}
                  {item.badge && !isBlocked && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Synapsis Academy Interactive Card */}
      <div className="mt-6 rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/80 to-emerald-50/50 p-3.5 shadow-xs dark:border-teal-800/60 dark:bg-slate-800 dark:bg-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-white">
            <GraduationCap className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Synapsis Academy</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            Prática
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
          Treinamento interativo em ambiente simulado seguro.
        </p>
        <button
          id="sidebar-academy-btn"
          onClick={openCatalog}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <span>Abrir Trilhas</span>
        </button>
      </div>

      {/* Compliance Information Pill */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
          <FileText className="h-4 w-4 text-teal-600" />
          <span>Conformidade Ativa</span>
        </div>
        <ul className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>LGPD: AES-256-GCM At-Rest</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>CFP 06/2019: 5 seções obrigatórias</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Imutabilidade: Hash SHA-256</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>RBAC: Trilha de Auditoria</span>
          </li>
        </ul>
      </div>

      {/* Synapsis Clínico Platform Badge */}
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <img src="/landing/synapsi_brain1.png" alt="Synapsis Logo" className="h-5 w-auto" />
          <div className="flex items-center gap-1">
            <span className="font-extrabold text-slate-800 dark:text-white text-xs tracking-tight">Synapsis</span>
            <span className="font-light text-teal-600 dark:text-teal-400 text-xs tracking-tight">Clínico</span>
          </div>
        </div>
        <span className="font-mono text-[10px] text-slate-400 font-medium">v2.4</span>
      </div>
    </aside>
  );
};
