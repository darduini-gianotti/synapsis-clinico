import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.js';
import {
  User,
  Shield,
  Smartphone,
  Monitor,
  LogOut,
  KeyRound,
  Fingerprint,
  CheckCircle2,
  ExternalLink,
  Info,
} from 'lucide-react';

interface MobileProfileTabProps {
  onSwitchToDesktop: () => void;
  onConfigurePin: () => void;
  isPinConfigured: boolean;
}

export const MobileProfileTab: React.FC<MobileProfileTabProps> = ({
  onSwitchToDesktop,
  onConfigurePin,
  isPinConfigured,
}) => {
  const { user, logout } = useAuth();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const [selectedOsTab, setSelectedOsTab] = useState<'ios' | 'android'>(() => {
    if (typeof window !== 'undefined') {
      const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && (navigator as any).maxTouchPoints > 1;
      return isApple ? 'ios' : 'android';
    }
    return 'ios';
  });

  return (
    <div className="space-y-4 pb-24">
      {/* Cartão do Perfil Profissional */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
        <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-base shadow-md shadow-teal-900/40">
          {user?.name
            ?.split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('') || 'PS'}
        </div>
        <div>
          <h3 className="text-sm font-black text-white">{user?.name || 'Psicólogo(a)'}</h3>
          <p className="text-xs text-teal-400 font-semibold">{user?.crp || 'CRP Ativo'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Bloco 1: Segurança e Bloqueio de Tela */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden divide-y divide-slate-800/80">
        <div className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-800/60 text-purple-400">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">PIN de 4 Dígitos & Face ID</h4>
              <p className="text-[10px] text-slate-400">Bloqueio automático após 10 min</p>
            </div>
          </div>

          <button
            onClick={onConfigurePin}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition cursor-pointer"
          >
            {isPinConfigured ? 'Alterar PIN' : 'Configurar'}
          </button>
        </div>

        <div className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-950/80 border border-teal-800/60 text-teal-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Sigilo CFP 06/2019 & LGPD</h4>
              <p className="text-[10px] text-slate-400">Prontuário com hash SHA-256 ativo</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-800/60">
            <CheckCircle2 className="h-2.5 w-2.5" />
            <span>Blindado</span>
          </span>
        </div>
      </div>

      {/* Bloco 2: Instalação PWA na Tela Inicial (iOS e Android) */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden">
        <button
          onClick={() => setShowInstallGuide(!showInstallGuide)}
          className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-950/80 border border-sky-800/60 text-sky-400">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Instalar App no Smartphone</h4>
              <p className="text-[10px] text-slate-400">Ícone na tela de início para iOS e Android</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-sky-400">
            {showInstallGuide ? 'Ocultar' : 'Como instalar'}
          </span>
        </button>

        {showInstallGuide && (
          <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-300 space-y-3 animate-in fade-in">
            {/* Seletor de Sistema Operacional */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedOsTab('ios')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedOsTab === 'ios'
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🍎 iPhone (iOS)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOsTab('android')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedOsTab === 'android'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🤖 Android</span>
              </button>
            </div>

            {/* Conteúdo do iOS (iPhone / iPad) */}
            {selectedOsTab === 'ios' && (
              <div className="space-y-2.5 animate-in fade-in">
                <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-800/60 text-sky-200 text-[11px] flex items-center gap-2">
                  <Info className="h-4 w-4 text-sky-400 shrink-0" />
                  <span>Importante: Abra o Synapsis pelo navegador <strong>Safari</strong> do seu iPhone para instalar.</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 font-black text-[10px]">
                      1
                    </span>
                    <div>
                      <p className="font-bold text-slate-200">
                        Toque no botão <span className="text-sky-400">Compartilhar</span>
                      </p>
                      <p className="text-slate-400 text-[10px] mt-0.5">
                        É o ícone de um <strong>quadrado com uma seta para cima</strong> (⎋), localizado na barra inferior do Safari.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 font-black text-[10px]">
                      2
                    </span>
                    <div>
                      <p className="font-bold text-slate-200">
                        Selecione <span className="text-sky-400">"Adicionar à Tela de Início"</span>
                      </p>
                      <p className="text-slate-400 text-[10px] mt-0.5">
                        Role as opções do menu do iPhone para baixo até encontrar o ícone de <strong>[+] Adicionar à Tela de Início</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 font-black text-[10px]">
                      3
                    </span>
                    <div>
                      <p className="font-bold text-slate-200">
                        Toque em <span className="text-teal-400 font-black">"Adicionar"</span> no topo direito
                      </p>
                      <p className="text-slate-400 text-[10px] mt-0.5">
                        O ícone oficial do Synapsis será criado na tela inicial do seu iPhone e abrirá como aplicativo nativo em tela cheia!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo do Android */}
            {selectedOsTab === 'android' && (
              <div className="space-y-2.5 animate-in fade-in">
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-400 font-black text-[10px]">
                      1
                    </span>
                    <div>
                      <p className="font-bold text-slate-200">
                        Toque no menu de <span className="text-teal-400">3 pontinhos</span> (⋮)
                      </p>
                      <p className="text-slate-400 text-[10px] mt-0.5">
                        Localizado no canto superior direito do navegador Chrome.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-400 font-black text-[10px]">
                      2
                    </span>
                    <div>
                      <p className="font-bold text-slate-200">
                        Toque em <span className="text-teal-400">"Instalar aplicativo"</span> ou <span className="text-teal-400">"Adicionar à tela inicial"</span>
                      </p>
                      <p className="text-slate-400 text-[10px] mt-0.5">
                        Confirme a instalação para ter o app disponível direto entre seus aplicativos com ícone na tela inicial.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bloco 3: Alternância para Desktop & Logout */}
      <div className="space-y-2">
        <button
          onClick={onSwitchToDesktop}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
        >
          <Monitor className="h-4 w-4 text-teal-400" />
          <span>Acessar Versão Completa (Desktop)</span>
        </button>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-950/30 hover:bg-rose-950/50 text-rose-400 text-xs font-bold border border-rose-900/40 transition cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </div>
  );
};
