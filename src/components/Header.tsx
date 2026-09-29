import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useHelp } from '../contexts/HelpContext.js';
import { SuperAdminModal } from './superadmin/SuperAdminModal.js';
import {
  ShieldCheck,
  Lock,
  Moon,
  Sun,
  LogOut,
  UserCheck,
  Sparkles,
  ChevronDown,
  HelpCircle,
  Smartphone,
  Crown,
} from 'lucide-react';

export const Header: React.FC<{
  onOpenLoginModal: () => void;
}> = ({ onOpenLoginModal }) => {
  const { user, switchUserQuick, logout, isSecretary, isPsychologist, isAdmin, theme, toggleTheme, clinicSettings } = useAuth();
  const { isInspectorActive, toggleHelpCenter, isHelpCenterOpen } = useHelp();
  const [showSwitchDropdown, setShowSwitchDropdown] = useState(false);
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);

  const isSuperAdmin = Boolean(
    user?.is_superadmin ||
    user?.role === 'SUPERADMIN' ||
    user?.email === 'admin@psicogestao.com.br' ||
    user?.email === 'sergio@psicogestao.com.br'
  );

  const getRoleBadge = () => {
    if (isAdmin) {
      return {
        label: 'ADMINISTRADOR',
        color: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
        icon: ShieldCheck,
      };
    }
    if (isPsychologist) {
      return {
        label: 'PSICÓLOGO CLÍNICO',
        color: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
        icon: UserCheck,
      };
    }
    return {
      label: 'SECRETARIA (ACESSO RESTRITO)',
      color: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800',
      icon: Lock,
    };
  };

  const badge = getRoleBadge();
  const BadgeIcon = badge.icon;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 transition-colors">
      <div className="flex h-16 items-center justify-between pr-4 sm:pr-6">
        {/* Left Branding */}
        <div className="flex items-center h-full">
          <div className="w-full md:w-64 flex shrink-0 items-center justify-center h-full px-4 border-r border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <img
                src="/landing/synapsi_brain1.png"
                alt="Synapsis Logo"
                className="h-9 w-auto drop-shadow-sm"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">Synapsis</span>
                  <span className="font-light text-teal-600 dark:text-teal-400 text-base tracking-tight">Clínico</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex pl-4 sm:pl-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tracking-tight text-slate-900 dark:text-white text-base sm:text-lg">
                  {clinicSettings?.clinic_name || 'Consultório'}
                </span>

                {clinicSettings?.logo_base64 && (
                  <img
                    src={clinicSettings.logo_base64}
                    alt="Logo do Consultório"
                    className="h-8 w-auto max-w-[150px] object-contain rounded-md"
                  />
                )}

                <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  CFP 06/2019
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Gestão Clínica • Criptografia AES-256 (LGPD) • Prontuário Imutável SHA-256
              </p>
            </div>
          </div>
        </div>

        {/* Center/Right Actions & RBAC Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick RBAC Switcher dropdown for instant demo evaluation */}
          <div className="relative">
            <button
              id="rbac-quick-switch-btn"
              data-help-id="header-rbac-switcher"
              onClick={() => setShowSwitchDropdown(!showSwitchDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition"
              title="Alternar perfil para testar as regras de acesso (RBAC)"
            >
              <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="hidden md:inline">Testar Perfil:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {user ? user.name.split(' ')[0] : 'Selecionar'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {showSwitchDropdown && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-850 dark:bg-slate-800 z-50 animate-in fade-in zoom-in-95">
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                  Troca Rápida de Usuário (RBAC)
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      switchUserQuick('marcos@psicogestao.com.br');
                      setShowSwitchDropdown(false);
                    }}
                    className="w-full text-left p-2 rounded-lg text-xs hover:bg-teal-50 dark:hover:bg-slate-700/60 transition flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                      <span>Dr. Marcos Silveira</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        PSICÓLOGO
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px]">CRP 06/128945-SP (Acesso total ao prontuário)</span>
                  </button>

                  <button
                    onClick={() => {
                      switchUserQuick('ana@psicogestao.com.br');
                      setShowSwitchDropdown(false);
                    }}
                    className="w-full text-left p-2 rounded-lg text-xs hover:bg-indigo-50 dark:hover:bg-slate-700/60 transition flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                      <span>Ana Beatriz Lima</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        SECRETÁRIA
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px]">Agenda e Financeiro (Bloqueio a dados clínicos)</span>
                  </button>

                  <button
                    onClick={() => {
                      switchUserQuick('admin@psicogestao.com.br');
                      setShowSwitchDropdown(false);
                    }}
                    className="w-full text-left p-2 rounded-lg text-xs hover:bg-amber-50 dark:hover:bg-slate-700/60 transition flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                      <span>Dra. Helena Martins</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        ADMIN
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px]">Gestão clínica, financeira e trilha LGPD</span>
                  </button>

                  <button
                    onClick={() => {
                      switchUserQuick('sandra@psicogestao.com.br');
                      setShowSwitchDropdown(false);
                    }}
                    className="w-full text-left p-2 rounded-lg text-xs hover:bg-amber-50 dark:hover:bg-slate-700/60 transition flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                      <span>Dra. Sandra Sorgatti D'Arduini</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
                        👑 FUNDADORA
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px]">CRP 06/162626 (Psicóloga Titular VIP Isenta)</span>
                  </button>

                  <button
                    onClick={() => {
                      switchUserQuick('sergio@psicogestao.com.br');
                      setShowSwitchDropdown(false);
                    }}
                    className="w-full text-left p-2 rounded-lg text-xs hover:bg-amber-50 dark:hover:bg-slate-700/60 transition flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                      <span>Sergio D'Arduini</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
                        SUPERADMIN
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px]">Gestão da plataforma e aprovação de fundadoras</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SuperAdmin Access Button */}
          {isSuperAdmin && (
            <button
              onClick={() => setIsSuperAdminModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold transition"
              title="Abrir Painel SuperAdmin (Clube das Fundadoras e Gestão Multi-Tenant)"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">SuperAdmin</span>
            </button>
          )}

          {/* User profile capsule */}
          {user && (
            <div
              data-help-id="header-user-profile"
              className="hidden lg:flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 justify-end">
                  {user.name}
                  {user.crp_number && (
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({user.crp_number})
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded border ${badge.color}`}
                  >
                    <BadgeIcon className="h-2.5 w-2.5" />
                    {badge.label}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Botão Central de Ajuda com IA & Copiloto Clínico */}
          <button
            id="ai-help-center-toggle-btn"
            data-help-id="header-help-btn"
            onClick={toggleHelpCenter}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition cursor-pointer ${
              isHelpCenterOpen || isInspectorActive
                ? 'bg-gradient-to-r from-teal-500 to-indigo-600 text-white border-teal-400 shadow-md shadow-indigo-500/25 ring-2 ring-teal-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400'
            }`}
            title="Abrir Central de Ajuda & Copiloto Clínico com IA (F1)"
          >
            <Sparkles className={`h-4 w-4 ${isHelpCenterOpen || isInspectorActive ? 'text-white' : 'text-teal-500 dark:text-teal-400'}`} />
            <span className="hidden sm:inline">{isInspectorActive ? 'Modo Lente Ativo' : 'Ajuda IA'}</span>
          </button>

          {/* Alternar para Visão Móvel */}
          <button
            onClick={() => {
              localStorage.setItem('synapsis_view_mode', 'mobile');
              window.location.reload();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-teal-400 hover:text-teal-500 transition cursor-pointer"
            title="Alternar para o Synapsis Mobile (PWA)"
          >
            <Smartphone className="h-4 w-4 text-teal-500" />
            <span className="hidden lg:inline text-[11px]">Versão Móvel</span>
          </button>

          {/* Dark / Light Toggle */}
          <button
            id="theme-toggle-btn"
            data-help-id="header-theme-toggle"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
            title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Login or Logout */}
          {user ? (
            <button
              id="logout-btn"
              data-help-id="header-logout"
              onClick={logout}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              title="Encerrar sessão"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 transition"
            >
              Entrar
            </button>
          )}
        </div>
      </div>

      <SuperAdminModal
        isOpen={isSuperAdminModalOpen}
        onClose={() => setIsSuperAdminModalOpen(false)}
      />
    </header>
  );
};
