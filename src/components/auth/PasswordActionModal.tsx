import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';

interface PasswordActionModalProps {
  isOpen: boolean;
  token: string;
  type?: 'INVITE' | 'RESET';
  onClose: () => void;
  onSuccess?: () => void;
}

export const PasswordActionModal: React.FC<PasswordActionModalProps> = ({
  isOpen,
  token,
  type = 'INVITE',
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{
    name: string;
    email: string;
    role_name: string;
    tokenType: 'INVITE' | 'RESET';
  } | null>(null);

  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Criteria checks
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Strength score (0 to 4)
  const strengthScore = [
    hasMinLength,
    hasUpperCase && hasLowerCase,
    hasNumber,
    hasSpecial,
  ].filter(Boolean).length;

  const isAllValid =
    hasMinLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumber &&
    hasSpecial &&
    passwordsMatch;

  useEffect(() => {
    if (!isOpen || !token) return;

    const verifyToken = async () => {
      try {
        setIsLoading(true);
        setTokenError(null);
        const res = await api.get(`/auth/verify-token?token=${token}`);
        setTokenInfo({
          name: res.data.user.name,
          email: res.data.user.email,
          role_name: res.data.user.role_name,
          tokenType: res.data.tokenType,
        });
      } catch (err: any) {
        setTokenError(
          err.response?.data?.error ||
            'Link de acesso inválido, já utilizado ou expirado.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllValid) return;

    try {
      setIsSubmitting(true);
      setFormError(null);
      const res = await api.post('/auth/set-password', {
        token,
        password,
        confirmPassword,
      });

      setSubmitSuccess(res.data.message || 'Senha cadastrada com sucesso!');
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err: any) {
      setFormError(
        err.response?.data?.error || 'Erro ao definir senha. Tente novamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInvite = (tokenInfo?.tokenType || type) === 'INVITE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8 text-slate-900 dark:text-slate-100">
        {/* Brand & Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white font-bold text-xl shadow-md shadow-teal-500/20">
            Ψ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isInvite ? 'Ativação de 1º Acesso' : 'Redefinição de Senha'}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800">
                Segurança
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              PsicoGestão • Gestão Clínica em Saúde Mental
            </p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center space-y-3">
            <div className="h-8 w-8 mx-auto rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Validando autenticidade do link de acesso...
            </p>
          </div>
        )}

        {/* Token Error State */}
        {!isLoading && tokenError && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-4 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-rose-600 dark:text-rose-400 mx-auto" />
              <h3 className="font-bold text-sm text-rose-900 dark:text-rose-200">
                Link de Acesso Inválido ou Expirado
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                {tokenError}
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Para obter um novo link, solicite à administração da clínica ou utilize a opção <strong>"Esqueci minha senha"</strong> na tela de login.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              Voltar para o Login
            </button>
          </div>
        )}

        {/* Success State */}
        {!isLoading && !tokenError && submitSuccess && (
          <div className="space-y-4 text-center py-4 animate-in fade-in">
            <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isInvite ? 'Acesso Ativado com Sucesso!' : 'Senha Redefinida com Sucesso!'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {submitSuccess}
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onSuccess) onSuccess();
              }}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Acessar o Consultório</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form State */}
        {!isLoading && !tokenError && !submitSuccess && tokenInfo && (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* User identification badge */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  {tokenInfo.name}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                  {tokenInfo.role_name}
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                {tokenInfo.email}
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Password input */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Crie uma senha forte"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Strength Meter Bar */}
            {password.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Força da Senha:</span>
                  <span
                    className={`font-bold ${
                      strengthScore <= 2
                        ? 'text-rose-500'
                        : strengthScore === 3
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                    }`}
                  >
                    {strengthScore <= 2 ? 'Fraca' : strengthScore === 3 ? 'Média' : 'Forte (Excelente)'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex gap-1">
                  <div
                    className={`h-full flex-1 rounded-full transition-all duration-300 ${
                      strengthScore >= 1
                        ? strengthScore <= 2
                          ? 'bg-rose-500'
                          : strengthScore === 3
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                        : 'bg-transparent'
                    }`}
                  />
                  <div
                    className={`h-full flex-1 rounded-full transition-all duration-300 ${
                      strengthScore >= 2
                        ? strengthScore === 3
                          ? 'bg-amber-500'
                          : strengthScore === 4
                          ? 'bg-emerald-500'
                          : 'bg-rose-500'
                        : 'bg-transparent'
                    }`}
                  />
                  <div
                    className={`h-full flex-1 rounded-full transition-all duration-300 ${
                      strengthScore >= 3
                        ? strengthScore === 4
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                        : 'bg-transparent'
                    }`}
                  />
                  <div
                    className={`h-full flex-1 rounded-full transition-all duration-300 ${
                      strengthScore === 4 ? 'bg-emerald-500' : 'bg-transparent'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Checklist of 4 Security Criteria */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Critérios de Segurança (CFP / LGPD):
              </span>

              <div className="grid grid-cols-1 gap-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  {hasMinLength ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 font-bold" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-slate-400 dark:border-slate-600 shrink-0" />
                  )}
                  <span className={hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500'}>
                    Mínimo de 8 caracteres
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasUpperCase && hasLowerCase ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 font-bold" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-slate-400 dark:border-slate-600 shrink-0" />
                  )}
                  <span className={hasUpperCase && hasLowerCase ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500'}>
                    Letras maiúsculas (A-Z) e minúsculas (a-z)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasNumber ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 font-bold" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-slate-400 dark:border-slate-600 shrink-0" />
                  )}
                  <span className={hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500'}>
                    Pelo menos 1 número (0-9)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasSpecial ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 font-bold" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-slate-400 dark:border-slate-600 shrink-0" />
                  )}
                  <span className={hasSpecial ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500'}>
                    Caractere especial (@, #, $, %, &, *, etc.)
                  </span>
                </div>
              </div>
            </div>

            {/* Confirm Password input */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confirmar Senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha digitada"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[11px] text-rose-500 mt-1">
                  As senhas digitadas não conferem.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!isAllValid || isSubmitting}
                className="w-2/3 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="h-4 w-4" />
                <span>{isSubmitting ? 'Salvando...' : isInvite ? 'Ativar e Salvar Senha' : 'Redefinir Senha'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
