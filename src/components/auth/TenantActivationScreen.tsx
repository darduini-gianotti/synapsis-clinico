import React, { useState, useEffect } from 'react';
import { Sparkles, Shield, CheckCircle2, Lock, Building, Phone, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api } from '../../services/api.js';

interface InviteDetails {
  valid: boolean;
  name: string;
  email: string;
  whatsapp: string;
  plan: string;
  is_vip_exempt: boolean;
  trial_days: number;
}

interface TenantActivationScreenProps {
  onSuccess: (token: string, user: any) => void;
  onCancel: () => void;
}

export const TenantActivationScreen: React.FC<TenantActivationScreenProps> = ({ onSuccess, onCancel }) => {
  const [token, setToken] = useState<string>('');
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [clinicName, setClinicName] = useState<string>('');
  const [crpNumber, setCrpNumber] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token') || '';
    setToken(urlToken);

    if (!urlToken) {
      setError('Token de ativação não encontrado no link. Verifique a URL fornecida.');
      setIsLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        setIsLoading(true);
        const res = await api.get<InviteDetails>(`/public/invite/${urlToken}`);
        setInvite(res.data);
        setClinicName(`Consultório ${res.data.name.split(' ')[0]}`);
        setPhone(res.data.whatsapp || '');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Link de convite inválido ou expirado.');
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!clinicName.trim()) {
      setSubmitError('Por favor, informe o nome do seu consultório ou clínica.');
      return;
    }

    if (password.length < 6) {
      setSubmitError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('As senhas digitadas não coincidem.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post<any>(`/public/invite/${token}/activate`, {
        password,
        clinic_name: clinicName.trim(),
        crp_number: crpNumber.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      if (res.data.token && res.data.user) {
        localStorage.setItem('psico_token', res.data.token);
        localStorage.setItem('psico_user', JSON.stringify(res.data.user));
        onSuccess(res.data.token, res.data.user);
      } else {
        throw new Error('Resposta inesperada do servidor.');
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Erro ao ativar consultório. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/80 border border-slate-700 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-12 h-12 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-white text-lg font-semibold">Validando seu convite VIP...</h2>
          <p className="text-slate-400 text-sm mt-1">Conectando ao Clube das Fundadoras Synapsis</p>
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/80 border border-red-500/30 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-white text-lg font-semibold">Link de Acesso Inválido</h2>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">{error}</p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => { window.location.href = '/landing'; }}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xl transition text-sm shadow-lg shadow-teal-900/30"
            >
              Ir para Página Inicial
            </button>
            <button
              onClick={onCancel}
              className="w-full py-2 text-slate-400 hover:text-white text-sm transition"
            >
              Fazer Login com Outra Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 flex items-center justify-center p-4 sm:p-6 py-12">
      <div className="w-full max-w-xl bg-slate-900/90 border border-teal-500/20 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-teal-950/50">
        {/* Header Badge */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                Clube das Fundadoras 👑
              </span>
              <h1 className="text-lg font-bold text-white tracking-tight">Ativação do seu Consultório</h1>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
              {invite.is_vip_exempt ? '👑 Acesso VIP Vitalício' : `⏳ ${invite.trial_days} Dias Grátis`}
            </span>
          </div>
        </div>

        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-teal-950/60 to-slate-800/60 border border-teal-500/30 rounded-2xl p-4 mb-6">
          <p className="text-sm text-slate-200">
            Olá, <strong className="text-teal-300">{invite.name}</strong>! Seu convite exclusivo para o plano{' '}
            <strong className="text-white">{invite.plan}</strong> foi validado com sucesso.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-teal-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Prontuário CFP Blindado
            </span>
            <span className="flex items-center gap-1 text-teal-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Emissão Direta NFS-e
            </span>
            <span className="flex items-center gap-1 text-teal-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Portal do Paciente
            </span>
            <span className="flex items-center gap-1 text-teal-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sem fidelidade
            </span>
          </div>
        </div>

        {submitError && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Activation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-teal-400" /> Nome do seu Consultório ou Clínica
            </label>
            <input
              type="text"
              required
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="Ex: Consultório de Psicologia Dra. Marina"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Este nome aparecerá nos cabeçalhos de prontuários, atestados e faturas.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-teal-400" /> Registro CRP (Opcional)
              </label>
              <input
                type="text"
                value={crpNumber}
                onChange={(e) => setCrpNumber(e.target.value)}
                placeholder="Ex: CRP 06/123456"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-400" /> WhatsApp de Contato
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-teal-400" /> Crie sua Senha
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-200 text-[11px]"
                >
                  {showPassword ? <EyeOff className="w-3 h-3 inline" /> : <Eye className="w-3 h-3 inline" />}
                </button>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-teal-400" /> Confirmar Senha
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-semibold rounded-xl transition duration-200 shadow-xl shadow-teal-950/60 flex items-center justify-center gap-2 group disabled:opacity-50 text-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Configurando seu ambiente seguro...</span>
                </>
              ) : (
                <>
                  <span>Ativar Meu Consultório e Acessar</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </>
              )}
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-500">
              Seus dados estão protegidos com criptografia AES-256 e conformidade com as Resoluções CFP 01/2009, 06/2019 e LGPD.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
