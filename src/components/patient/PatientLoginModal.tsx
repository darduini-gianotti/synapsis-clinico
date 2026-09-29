import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, MessageCircle, KeyRound, ArrowRight, RefreshCw, CheckCircle2, Lock, UserCheck } from 'lucide-react';
import { patientApi, PatientUser, Dependent } from '../../services/patientApi';

interface PatientLoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (patient: PatientUser, dependents: Dependent[]) => void;
}

export const PatientLoginModal: React.FC<PatientLoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [step, setStep] = useState<'CPF' | 'OTP' | 'PIN' | 'INVITE'>('CPF');
  const [cpf, setCpf] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pin, setPin] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasPinRegistered, setHasPinRegistered] = useState(false);

  // Invite Flow State
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitePatient, setInvitePatient] = useState<{
    id: number;
    fullName: string;
    firstName: string;
    phoneMasked: string;
    email: string;
    hasPin: boolean;
    isFirstAccess: boolean;
  } | null>(null);
  const [invitePin, setInvitePin] = useState('');
  const [invitePinConfirm, setInvitePinConfirm] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('invite');
    if (token) {
      setInviteToken(token);
      checkInvite(token);
    }
  }, []);

  const checkInvite = async (token: string) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await patientApi.verifyInvite(token);
      if (res.valid && res.patient) {
        setInvitePatient(res.patient);
        setStep('INVITE');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Link de convite inválido ou expirado.');
      setStep('CPF');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteInvite = async () => {
    if (!inviteToken) return;
    if (!invitePin || invitePin.length !== 4) {
      setErrorMessage('O PIN deve conter exatamente 4 números.');
      return;
    }
    if (invitePin !== invitePinConfirm) {
      setErrorMessage('Os números do PIN não coincidem.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await patientApi.setInitialPin(inviteToken, invitePin);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/paciente');
      }
      onLoginSuccess(res.patient, res.dependents);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao registrar PIN de acesso.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatCpf = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpf(e.target.value));
    setErrorMessage('');
  };

  const handleRequestOtp = async (targetCpf?: string) => {
    const rawCpf = targetCpf || cpf;
    const clean = rawCpf.replace(/\D/g, '');
    if (clean.length !== 11) {
      setErrorMessage('Digite um CPF válido com 11 dígitos.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await patientApi.requestOtp(clean);
      setMaskedPhone(res.phoneMasked || '');
      setDevOtp(res.devOtp || null);
      setStep('OTP');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao enviar código de acesso.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      setErrorMessage('Digite o código de 6 dígitos.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await patientApi.verifyOtp(cpf.replace(/\D/g, ''), otpCode.trim());
      onLoginSuccess(res.patient, res.dependents);
    } catch (err: any) {
      setErrorMessage(err.message || 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!pin || pin.length !== 4) {
      setErrorMessage('Digite seu PIN de 4 dígitos.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await patientApi.verifyPin(cpf.replace(/\D/g, ''), pin);
      onLoginSuccess(res.patient, res.dependents);
    } catch (err: any) {
      setErrorMessage(err.message || 'PIN incorreto.');
    } finally {
      setLoading(false);
    }
  };

  const quickFillTestCpf = (testCpf: string) => {
    const formatted = formatCpf(testCpf);
    setCpf(formatted);
    handleRequestOtp(formatted);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Cabeçalho Acolhedor */}
        <div className="relative p-6 pb-5 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md mb-3 border border-white/20 shadow-inner">
            <Sparkles className="w-7 h-7 text-amber-300" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Synapsis Paciente</h2>
          <p className="text-sm text-indigo-100 mt-1">Seu portal de saúde mental, agenda e bem-estar</p>
          
          <div className="absolute top-4 right-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
              <Shield className="w-3.5 h-3.5" />
              <span>Ambiente Seguro</span>
            </div>
          </div>
        </div>

        {/* Corpo do Login */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-800 flex items-start gap-2.5">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* PASSO 1: INFORMAR CPF */}
          {step === 'CPF' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Informe seu CPF
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCpfChange}
                    className="w-full px-4 py-3.5 text-lg font-semibold tracking-wider text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    maxLength={14}
                    autoFocus
                  />
                  <Lock className="w-5 h-5 text-slate-400 absolute right-3.5 top-4" />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Se você é responsável por um menor, digite o seu CPF cadastrado na clínica.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleRequestOtp()}
                disabled={loading || cpf.replace(/\D/g, '').length !== 11}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Entrar com Código WhatsApp</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Botões de Demonstração Rápida */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-2">
                  Atalhos de Demonstração Rápida:
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => quickFillTestCpf('11144477735')}
                    className="text-left px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between transition-colors"
                  >
                    <span><strong>Lucas / Juliana</strong> (CPF 111.444.777-35 • Titular & Mãe de Enzo)</span>
                    <UserCheck className="w-4 h-4 text-indigo-500 shrink-0 ml-2" />
                  </button>
                  <button
                    type="button"
                    onClick={() => quickFillTestCpf('22255588846')}
                    className="text-left px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-xs text-purple-700 dark:text-purple-300 flex items-center justify-between transition-colors"
                  >
                    <span><strong>Mariana Alves</strong> (CPF 222.555.888-46 • Adulto)</span>
                    <UserCheck className="w-4 h-4 text-purple-500 shrink-0 ml-2" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 2: CÓDIGO OTP VIA WHATSAPP */}
          {step === 'OTP' && (
            <div className="space-y-4">
              <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                <MessageCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-800 dark:text-white">Código de 6 dígitos enviado</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Enviamos via WhatsApp para o número <strong>{maskedPhone || 'cadastrado'}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 text-center">
                  Digite o código de verificação
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full text-center tracking-[0.4em] text-2xl font-extrabold px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  maxLength={6}
                  autoFocus
                />
              </div>

              {devOtp && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs flex items-center justify-between">
                  <span className="text-amber-800 dark:text-amber-300">
                    Código de teste gerado: <strong>{devOtp}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtpCode(devOtp)}
                    className="px-2 py-1 text-[11px] font-bold bg-amber-600 text-white rounded hover:bg-amber-700"
                  >
                    Preencher
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading || otpCode.length < 6}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Confirmar e Acessar'}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('CPF')}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Trocar CPF
                </button>
                <button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  className="text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Reenviar código
                </button>
              </div>
            </div>
          )}

          {/* PASSO 3: DESBLOQUEIO POR PIN RÁPIDO */}
          {step === 'PIN' && (
            <div className="space-y-4">
              <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/50">
                <KeyRound className="w-7 h-7 text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-800 dark:text-white">Acesso Rápido por PIN</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Digite seu PIN de 4 números para desbloquear o portal
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 text-center">
                  PIN de 4 dígitos
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full text-center tracking-[0.6em] text-3xl font-extrabold px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  maxLength={4}
                  autoFocus
                />
              </div>

              <button
                type="button"
                onClick={handleVerifyPin}
                disabled={loading || pin.length !== 4}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Desbloquear Portal'}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('CPF')}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Trocar CPF
                </button>
                <button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  className="text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Esqueci meu PIN (Entrar via WhatsApp)
                </button>
              </div>
            </div>
          )}

          {/* PASSO 4: ATIVAÇÃO DE CONVITE (MAGIC LINK) */}
          {step === 'INVITE' && invitePatient && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800/50">
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto mb-2 shadow-md">
                  <Sparkles className="w-6 h-6 text-amber-300" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Olá, {invitePatient.firstName}! 👋
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Seu terapeuta disponibilizou seu acesso exclusivo ao <strong>Synapsis Paciente</strong>.
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-300 font-medium mt-2">
                  Para entrar com praticidade nos próximos acessos, cadastre um <strong>PIN de 4 dígitos</strong>:
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 text-center">
                  Novo PIN de 4 números
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={invitePin}
                  onChange={(e) => setInvitePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full text-center tracking-[0.6em] text-2xl font-extrabold px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  maxLength={4}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 text-center">
                  Confirme o PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={invitePinConfirm}
                  onChange={(e) => setInvitePinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full text-center tracking-[0.6em] text-2xl font-extrabold px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  maxLength={4}
                />
              </div>

              <button
                type="button"
                onClick={handleCompleteInvite}
                disabled={loading || invitePin.length !== 4 || invitePinConfirm.length !== 4}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : (
                  <>
                    <span>Criar PIN e Acessar Portal</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setStep('CPF')}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Entrar com CPF e WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé LGPD */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-500" />
            <span>Seus dados de saúde protegidos sob a LGPD e o Código de Ética do CFP</span>
          </p>
        </div>

      </div>
    </div>
  );
};
