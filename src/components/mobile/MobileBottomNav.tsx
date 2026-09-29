import React from 'react';
import { Calendar, Users, DollarSign, User } from 'lucide-react';

export type MobileTab = 'today' | 'patients' | 'financial' | 'profile';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onChangeTab: (tab: MobileTab) => void;
  pendingCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onChangeTab,
  pendingCount = 0,
}) => {
  const tabs = [
    {
      id: 'today' as MobileTab,
      label: 'Hoje',
      icon: Calendar,
      badge: null,
    },
    {
      id: 'patients' as MobileTab,
      label: 'Pacientes',
      icon: Users,
      badge: null,
    },
    {
      id: 'financial' as MobileTab,
      label: 'Cobranças',
      icon: DollarSign,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    {
      id: 'profile' as MobileTab,
      label: 'Menu',
      icon: User,
      badge: null,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 pt-1 pb-[max(env(safe-area-inset-bottom),10px)] select-none">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer relative ${
                isActive
                  ? 'text-teal-400 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-slate-900">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] tracking-tight mt-1 ${isActive ? 'font-black' : 'font-medium'}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 w-8 h-0.5 rounded-full bg-teal-400 shadow-sm shadow-teal-400/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
