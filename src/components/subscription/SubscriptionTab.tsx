import React, { useState, useEffect } from 'react';
import { Sparkles, Crown, CheckCircle2, ShieldCheck, CreditCard, QrCode, ArrowRight, Zap, RefreshCw, AlertCircle, Building, Users } from 'lucide-react';
import { api } from '../../services/api.js';

interface SubscriptionStatus {
  success: boolean;
  clinic_id: number;
  clinic_name: string;
  plan: string;
  billing_cycle: string;
  subscription_status: string;
  trial_ends_at?: string;
  is_vip_exempt: boolean;
  days_remaining: number;
  asaas_customer_id?: string;
  asaas_subscription_id?: string;
}

export const SubscriptionTab: React.FC = () => {
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [selectedPlan, setSelectedPlan] = useState<string>('PARCERIA');
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'PIX'>('CREDIT_CARD');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<SubscriptionStatus>('/subscription/status');
      setSubStatus(res.data);
      setSelectedPlan(res.data.plan || 'PARCERIA');
      setBillingCycle((res.data.billing_cycle as any) || 'MONTHLY');
    } catch (err) {
      console.error('Erro ao buscar status da assinatura:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCheckout = async (planKey: string) => {
    try {
      setIsUpdating(true);
      setFeedback(null);
      const res = await api.post<any>('/subscription/checkout', {
        plan: planKey,
        billing_cycle: billingCycle,
        payment_method: paymentMethod,
      });

      setFeedback({
        type: 'success',
        message: res.data.message || 'Plano atualizado com sucesso!',
      });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Erro ao processar assinatura.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando informações da sua assinatura...</p>
      </div>
    );
  }

  const isVip = Boolean(subStatus?.is_vip_exempt);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
      {/* Banner de Status Atual */}
      {isVip ? (
        <div className="rounded-2xl p-6 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-teal-500/10 border border-amber-500/30 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                <Crown className="w-7 h-7 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400">
                    Membro VIP Fundadora
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    ISENÇÃO VITALÍCIA
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  Acesso Perpétuo e Gratuito Liberado
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
                  Seu consultório faz parte do grupo honorário do Clube das Fundadoras. Você possui acesso ilimitado a todas as ferramentas, emissão de notas, teleconsulta e prontuário sem cobranças recorrentes.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" /> 100% Isento
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-6 bg-gradient-to-r from-teal-500/15 via-cyan-500/10 to-slate-900/40 border border-teal-500/30 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-600/30 shrink-0 text-white">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    Clube das Fundadoras • Período de Cortesia
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30">
                    90 DIAS FREE
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  Restam <span className="text-teal-600 dark:text-teal-400 font-extrabold">{subStatus?.days_remaining ?? 90} dias</span> de teste gratuito
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
                  Aproveite todas as funcionalidades no seu consultório. Você só precisará cadastrar sua forma de pagamento ao final dos 90 dias caso deseje continuar.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Plano Atual</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">{subStatus?.plan}</span>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20'
              : 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/20'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Switcher de Periodicidade */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Planos do Synapsis Clínico</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Escolha a estrutura que melhor atende à sua rotina profissional</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setBillingCycle('MONTHLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              billingCycle === 'MONTHLY'
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('ANNUAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              billingCycle === 'ANNUAL'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Anual</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-400 text-slate-950 font-bold">
              20% OFF
            </span>
          </button>
        </div>
      </div>

      {/* Grid de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plano Solo */}
        <div
          className={`rounded-2xl p-6 border transition flex flex-col justify-between ${
            selectedPlan === 'SOLO'
              ? 'border-teal-500 bg-teal-500/5 ring-2 ring-teal-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Solo</span>
              {selectedPlan === 'SOLO' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400">
                  SEU PLANO
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                R$ {billingCycle === 'ANNUAL' ? '55' : '69'}
              </span>
              <span className="text-xs text-slate-500">/mês</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Para psicólogas que atendem de forma autônoma e individual.</p>

            <ul className="mt-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> 1 Psicóloga Titular
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Prontuário CFP Blindado ilimitado
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Agenda clínica & lembretes
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Teleconsulta HD nativa
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Atestados e receitas digitais
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => handleCheckout('SOLO')}
              disabled={isUpdating || (selectedPlan === 'SOLO' && isVip)}
              className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-900 dark:text-white transition disabled:opacity-50"
            >
              {selectedPlan === 'SOLO' ? 'Plano Selecionado' : 'Mudar para Solo'}
            </button>
          </div>
        </div>

        {/* Plano Parceria PJ (Destaque) */}
        <div
          className={`rounded-2xl p-6 border transition flex flex-col justify-between relative shadow-xl ${
            selectedPlan === 'PARCERIA'
              ? 'border-teal-500 bg-gradient-to-b from-teal-500/10 via-teal-500/5 to-transparent ring-2 ring-teal-500/30'
              : 'border-teal-500/40 bg-white dark:bg-slate-800/60'
          }`}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md uppercase tracking-wider">
              MAIS ESCOLHIDO NO CLUBE
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 mt-1">
              <span className="text-xs font-bold uppercase text-teal-600 dark:text-teal-400">Parceria PJ</span>
              {selectedPlan === 'PARCERIA' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400">
                  SEU PLANO
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                R$ {billingCycle === 'ANNUAL' ? '79' : '99'}
              </span>
              <span className="text-xs text-slate-500">/mês</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Para consultórios em parceria ou que contam com secretária.</p>

            <ul className="mt-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2 font-medium text-teal-600 dark:text-teal-300">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Até 3 profissionais inclusos
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Split de repasse automático (%)
              </li>
              <li className="flex items-center gap-2 font-medium text-teal-600 dark:text-teal-300">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Emissão direta de NFS-e municipal
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Portal do Paciente & Atividades
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Cobrança via PIX e Cartão Asaas
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => handleCheckout('PARCERIA')}
              disabled={isUpdating || (selectedPlan === 'PARCERIA' && isVip)}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition shadow-lg shadow-teal-900/30 disabled:opacity-50"
            >
              {selectedPlan === 'PARCERIA' ? 'Plano Selecionado' : 'Mudar para Parceria PJ'}
            </button>
          </div>
        </div>

        {/* Plano Clínica Multi-Salas */}
        <div
          className={`rounded-2xl p-6 border transition flex flex-col justify-between ${
            selectedPlan === 'CLINICA'
              ? 'border-teal-500 bg-teal-500/5 ring-2 ring-teal-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Clínica Multi-Salas</span>
              {selectedPlan === 'CLINICA' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400">
                  SEU PLANO
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                R$ {billingCycle === 'ANNUAL' ? '103' : '129'}
              </span>
              <span className="text-xs text-slate-500">/mês</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Para clínicas com múltiplos consultórios e recepção presencial.</p>

            <ul className="mt-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Gestão visual de salas de atendimento
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Torre de recepção com check-in
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Painel TV de chamada na sala de espera
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Multi-usuários e secretárias ilimitados
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" /> Suporte com onboarding guiado
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => handleCheckout('CLINICA')}
              disabled={isUpdating || (selectedPlan === 'CLINICA' && isVip)}
              className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-900 dark:text-white transition disabled:opacity-50"
            >
              {selectedPlan === 'CLINICA' ? 'Plano Selecionado' : 'Mudar para Clínica Multi-Salas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
