import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { ShieldCheck, UserCheck, Lock, ArrowRight, ArrowLeft, KeyRound, AlertCircle, Sparkles, X, Mail, Send, CheckCircle2 } from 'lucide-react';
import { EmailPreviewModal } from './auth/EmailPreviewModal.js';
import { PasswordActionModal } from './auth/PasswordActionModal.js';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  isForced?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, isForced = false }) => {
  const { login, switchUserQuick } = useAuth();
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Self-service Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<any | null>(null);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);

  // In-modal Password Action (Direct Reset)
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      if (onClose) onClose();
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
      if (onClose) onClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
        {!isForced && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-500/25 font-bold text-2xl">
            Ψ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">PsicoGestão</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800">
                SaaS Saúde
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Autenticação Segura • AES-256 (LGPD) • Normativas CFP
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {view === 'login' ? (
          <>
            {/* 1-Click Profile Selection for Demo & Evaluation */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  Acesso Rápido por Perfil (1 Clique)
                </span>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickSelect('marcos@psicogestao.com.br')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-teal-500 bg-slate-50/50 hover:bg-teal-50/40 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-teal-500/50 dark:hover:bg-teal-950/20 text-left transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Dr. Marcos Silveira
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Psicólogo Clínico • CRP 06/128945-SP (Acesso Clínico Integral)
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition" />
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickSelect('ana@psicogestao.com.br')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-950/20 text-left transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Ana Beatriz Lima
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Secretária • Agenda e Cobrança (Bloqueio Clínico CFP)
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" />
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickSelect('admin@psicogestao.com.br')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/40 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-amber-500/50 dark:hover:bg-amber-950/20 text-left transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Dra. Helena Martins
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Administradora • Gestão Integral e Trilha LGPD
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition" />
                </button>
              </div>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-white px-2 text-slate-400 dark:bg-slate-900">Ou entrar com credenciais</span>
              </div>
            </div>

            {/* Manual Login Form */}
            <form onSubmit={handleManualLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Profissional
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex: marcos@psicogestao.com.br"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setView('forgot');
                      setError(null);
                      setForgotSuccess(null);
                    }}
                    className="text-[11px] text-teal-600 hover:text-teal-700 dark:text-teal-400 font-medium hover:underline cursor-pointer"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha de acesso"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                <span>{isLoading ? 'Autenticando...' : 'Acessar Consultório'}</span>
              </button>
            </form>

            <p className="mt-5 text-[11px] text-center text-slate-400 dark:text-slate-500">
              Credencial padrão de demonstração: senha <strong>senha123</strong>
            </p>
          </>
        ) : (
          /* Forgot Password View */
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setError(null);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para o Login
              </button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Recuperação de Senha
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Digite seu e-mail profissional cadastrado. Enviaremos um link de uso único e criptografado com validade de 1 hora para você redefinir sua senha.
              </p>
            </div>

            {forgotSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs space-y-2.5">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{forgotSuccess}</span>
                </div>
                {emailPreview && (
                  <button
                    type="button"
                    onClick={() => setIsEmailPreviewOpen(true)}
                    className="w-full mt-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Visualizar E-mail Disparado (Modo Demonstração)</span>
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  E-mail Profissional
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="ex: marcos@psicogestao.com.br"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition"
                />
              </div>

              <button
                type="submit"
                disabled={isForgotLoading}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span>{isForgotLoading ? 'Disparando Link...' : 'Enviar Link de Redefinição'}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Email Preview Modal */}
      {isEmailPreviewOpen && emailPreview && (
        <EmailPreviewModal
          isOpen={isEmailPreviewOpen}
          emailPreview={emailPreview}
          onClose={() => setIsEmailPreviewOpen(false)}
          onOpenActionUrl={() => {
            setActiveToken(emailPreview.token);
            setIsEmailPreviewOpen(false);
            setIsPasswordModalOpen(true);
          }}
        />
      )}

      {/* Direct Password Action Modal from Preview */}
      {isPasswordModalOpen && activeToken && (
        <PasswordActionModal
          isOpen={isPasswordModalOpen}
          token={activeToken}
          type="RESET"
          onClose={() => setIsPasswordModalOpen(false)}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            setView('login');
            setEmail(forgotEmail);
          }}
        />
      )}
    </div>
  );
};
