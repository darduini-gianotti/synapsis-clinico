import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { ShieldCheck, UserCheck, Lock, ArrowRight, ArrowLeft, KeyRound, AlertCircle, Sparkles, Mail, Send, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { EmailPreviewModal } from './EmailPreviewModal.js';
import { PasswordActionModal } from './PasswordActionModal.js';

export const PrimaryLoginScreen: React.FC = () => {
  const { login, switchUserQuick, clinicSettings } = useAuth();
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Self-service Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<any | null>(null);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);

  // In-screen Password Action (Direct Reset)
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Email ou senha inválidos.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSelect = async (selectedEmail: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await switchUserQuick(selectedEmail);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao conectar perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotSuccess(null);
    setEmailPreview(null);
    setIsForgotLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotSuccess(
        res.data.message ||
          'Caso o e-mail esteja registrado, enviamos um link seguro válido por 1 hora.'
      );
      if (res.data.previewAvailable && res.data.emailPreview) {
        setEmailPreview(res.data.emailPreview);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          'Erro ao processar recuperação de senha. Verifique os dados e tente novamente.'
      );
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 selection:bg-teal-500 selection:text-white relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* ==================== COLUNA ESQUERDA: SHOWCASE INSTITUCIONAL SYNAPSIS CLÍNICO ==================== */}
        <div className="lg:col-span-6 p-8 sm:p-12 bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950/40 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative">
          <div className="space-y-8">
            {/* Top Brand Mark */}
            <div className="flex items-center gap-3.5">
              <img
                src="/landing/synapsi_brain1.png"
                alt="Synapsis Clínico"
                className="h-14 w-auto drop-shadow-[0_0_25px_rgba(45,212,191,0.35)]"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold text-white tracking-tight">Synapsis</span>
                  <span className="text-2xl font-light text-teal-400 tracking-tight">Clínico</span>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase block">
                  Psicologia • Neuropsicologia • Gestão
                </span>
              </div>
            </div>

            {/* Slogan & Value Props */}
            <div className="space-y-4 pt-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                Ciência Clínica, Neuropsicologia e Gestão em{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-cyan-300 to-indigo-400">
                  Perfeita Sintonia
                </span>.
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Ambiente de alta segurança jurídica para psicólogos e neuropsicólogos. Prontuários com prova criptográfica SHA-256 e repasses blindados.
              </p>
            </div>

            {/* Clinic Custom Welcome Banner (if configured) */}
            {clinicSettings?.clinic_name && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-750 flex items-center gap-3.5">
                {clinicSettings?.logo_base64 ? (
                  <img src={clinicSettings.logo_base64} alt="Clinic Logo" className="h-10 w-auto max-w-[120px] object-contain rounded-lg" />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-teal-600/20 text-teal-300 font-bold flex items-center justify-center text-base border border-teal-500/30">
                    Ψ
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Ambiente Clínico</span>
                  <p className="text-sm font-bold text-white leading-tight">{clinicSettings.clinic_name}</p>
                </div>
              </div>
            )}
          </div>

          {/* Legal & Security Trust Badges */}
          <div className="space-y-2.5 pt-8 mt-8 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Resolução CFP 06/2019 (Prontuário Imutável)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Lock className="h-4 w-4 text-teal-400 shrink-0" />
              <span>Criptografia AES-256-GCM em Repouso</span>
            </div>
          </div>
        </div>

        {/* ==================== COLUNA DIREITA: FORMULÁRIO DE AUTENTICAÇÃO ==================== */}
        <div className="lg:col-span-6 p-8 sm:p-12 bg-slate-900 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                {view === 'login' ? 'Acessar Consultório' : 'Recuperação de Senha'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {view === 'login'
                  ? 'Insira suas credenciais para entrar na plataforma clínica'
                  : 'Informe seu e-mail cadastrado para redefinir sua senha de acesso'}
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-950/60 text-rose-300 border border-rose-900/80 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {view === 'login' ? (
              <form onSubmit={handleManualLogin} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">E-mail Profissional</label>
                  <input
                    type="email"
                    required
                    disabled={isLoading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@consultorio.com.br"
                    className="w-full p-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-semibold text-slate-300">Senha de Acesso</label>
                    <button
                      type="button"
                      onClick={() => {
                        setView('forgot');
                        setError(null);
                      }}
                      className="text-[11px] text-teal-400 hover:text-teal-300 hover:underline cursor-pointer"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      disabled={isLoading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full p-3.5 pr-10 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3.5 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm shadow-lg shadow-teal-500/25 transition transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar na Plataforma</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
                {forgotSuccess ? (
                  <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                      <p className="text-xs leading-relaxed">{forgotSuccess}</p>
                    </div>
                    {emailPreview && (
                      <div className="pt-2 border-t border-emerald-900/60 flex items-center justify-between">
                        <span className="text-[11px] text-emerald-200">Demonstração: E-mail gerado</span>
                        <button
                          type="button"
                          onClick={() => setIsEmailPreviewOpen(true)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                        >
                          Visualizar E-mail
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-300">Seu E-mail Cadastrado</label>
                      <input
                        type="email"
                        required
                        disabled={isForgotLoading}
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="seu.email@consultorio.com.br"
                        className="w-full p-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isForgotLoading}
                      className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isForgotLoading ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Enviar Link de Recuperação</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setError(null);
                    setForgotSuccess(null);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer font-semibold"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Voltar para o Login</span>
                </button>
              </form>
            )}

            {/* Quick Profiles for Demo/Evaluation (Hidden in Production) */}
            {view === 'login' && (typeof window !== 'undefined' && !window.location.hostname.startsWith('app.')) && (
              <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                    Acesso Rápido para Avaliação (1 Clique)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleQuickSelect('marcos@psicogestao.com.br')}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-left border border-slate-700/80 transition cursor-pointer hover:border-teal-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Dr. Marcos</span>
                      <span className="text-[10px] text-emerald-400 font-semibold">Psicólogo</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Clínica &amp; Neuro</span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleQuickSelect('secretaria@psicogestao.com.br')}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-left border border-slate-700/80 transition cursor-pointer hover:border-indigo-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Recepção</span>
                      <span className="text-[10px] text-indigo-400 font-semibold">Secretária</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Acesso Restrito</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-2 pt-2">
            <span>🔒 Conexão Criptografada SSL/TLS</span>
            <span>•</span>
            <span>CFP 06/2019 Compliance</span>
          </div>
        </div>

      </div>

      {/* Auxiliary Modals for Password Flows */}
      {emailPreview && (
        <EmailPreviewModal
          isOpen={isEmailPreviewOpen}
          preview={emailPreview}
          onClose={() => setIsEmailPreviewOpen(false)}
          onSimulateClick={(token) => {
            setIsEmailPreviewOpen(false);
            setActiveToken(token);
            setIsPasswordModalOpen(true);
          }}
        />
      )}

      {activeToken && (
        <PasswordActionModal
          isOpen={isPasswordModalOpen}
          token={activeToken}
          actionType="RESET"
          onClose={() => {
            setIsPasswordModalOpen(false);
            setActiveToken(null);
            setView('login');
            setError(null);
          }}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            setActiveToken(null);
            setView('login');
            setError(null);
          }}
        />
      )}
    </div>
  );
};
