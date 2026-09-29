import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Monitor, Sun, Moon, ShieldCheck } from 'lucide-react';

interface MobileHeaderProps {
  onSwitchToDesktop: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onSwitchToDesktop }) => {
  const { user } = useAuth();
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return document.documentElement.classList.contains('dark');
  });

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('synapsis_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('synapsis_theme', 'light');
    }
  };

  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 select-none">
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center gap-2.5">
          <img
            src="/landing/synapsi_brain1.png"
            alt="Synapsis Logo"
            className="h-8 w-auto object-contain drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-white tracking-tight">Synapsis</span>
              <span className="text-sm font-light text-teal-400 tracking-tight">Mobile</span>
              <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30">
                <ShieldCheck className="h-2.5 w-2.5" />
                <span>CFP</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 capitalize">
              {todayFormatted} • Olá, {user?.name?.split(' ')[0] || 'Psicólogo(a)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
            title="Alternar Tema"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-400" />}
          </button>

          <button
            onClick={onSwitchToDesktop}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-[11px] font-semibold border border-slate-700/60 transition cursor-pointer"
            title="Ver versão completa de computador"
          >
            <Monitor className="h-3.5 w-3.5 text-teal-400" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
        </div>
      </div>
    </header>
  );
};
