import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Building2, Users, CheckCircle2, Copy, Check, MessageSquare, Shield, ShieldCheck, RefreshCw, AlertCircle, ExternalLink, Award, UserX, RotateCcw, XCircle } from 'lucide-react';
import { api } from '../../services/api.js';

interface Lead {
  id: number;
  name: string;
  whatsapp: string;
  email: string;
  profile: string;
  current_software: string;
  interested_plan: string;
  status: string;
  created_at: string;
  invite_token?: string;
  invite_status?: string;
  invite_is_vip?: number;
  invite_expires_at?: string;
}

interface Clinic {
  id: number;
  clinic_name: string;
  cnpj?: string;
  phone?: string;
  email: string;
  plan: string;
  billing_cycle: string;
  subscription_status: string;
  trial_ends_at?: string;
  is_vip_exempt: number;
  patient_count: number;
  user_count: number;
  owner_name?: string;
  created_at: string;
}

interface SuperAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SuperAdminModal: React.FC<SuperAdminModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'leads' | 'clinics'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isApprovingId, setIsApprovingId] = useState<number | null>(null);
  const [isCancellingId, setIsCancellingId] = useState<number | null>(null);
  const [isReopeningId, setIsReopeningId] = useState<number | null>(null);
  const [approveVipMap, setApproveVipMap] = useState<Record<number, boolean>>({});
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState<number | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [leadsRes, clinicsRes] = await Promise.all([
        api.get<any>('/superadmin/leads'),
        api.get<any>('/superadmin/clinics'),
      ]);
      setLeads(leadsRes.data.leads || []);
      setClinics(clinicsRes.data.clinics || []);
    } catch (err) {
      console.error('Erro ao buscar dados do SuperAdmin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleApproveLead = async (lead: Lead) => {
    try {
      setIsApprovingId(lead.id);
      const isVip = approveVipMap[lead.id] ?? (lead.email.includes('sandra') || lead.name.toLowerCase().includes('sandra'));
      const res = await api.post<any>(`/superadmin/leads/${lead.id}/approve`, {
        is_vip_exempt: isVip,
        trial_days: 90,
      });

      setActionSuccess(`Convite gerado com sucesso para ${lead.name}!`);
      setTimeout(() => setActionSuccess(null), 4000);

      // Copia link ou mensagem
      if (res.data.whatsappMessage) {
        navigator.clipboard.writeText(res.data.whatsappMessage);
        setCopiedWhatsapp(lead.id);
        setTimeout(() => setCopiedWhatsapp(null), 3000);
      }

      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao aprovar lead');
    } finally {
      setIsApprovingId(null);
    }
  };

  const handleCancelLead = async (lead: Lead) => {
    const confirmCancel = window.confirm(
      `Deseja registrar a desistência/cancelamento para "${lead.name}"?\n\nO status será marcado como Cancelado e o link de convite atual (caso exista) será invalidado imediatamente.`
    );
    if (!confirmCancel) return;

    try {
      setIsCancellingId(lead.id);
      const res = await api.post<any>(`/superadmin/leads/${lead.id}/cancel`, {});
      setActionSuccess(res.data.message || `Desistência registrada para ${lead.name}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao registrar desistência');
    } finally {
      setIsCancellingId(null);
    }
  };

  const handleReopenLead = async (lead: Lead) => {
    const confirmReopen = window.confirm(
      `Deseja reativar o lead "${lead.name}" e retorná-lo para a lista de espera?\n\nVocê poderá aprovar e gerar um novo convite a qualquer momento.`
    );
    if (!confirmReopen) return;

    try {
      setIsReopeningId(lead.id);
      const res = await api.post<any>(`/superadmin/leads/${lead.id}/reopen`, {});
      setActionSuccess(res.data.message || `Lead ${lead.name} reativado na lista de espera.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao reativar lead');
    } finally {
      setIsReopeningId(null);
    }
  };

  const handleToggleVip = async (clinic: Clinic) => {
    try {
      const res = await api.patch<any>(`/superadmin/clinics/${clinic.id}/toggle-vip`, {});
      setActionSuccess(res.data.message);
      setTimeout(() => setActionSuccess(null), 3000);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar status VIP');
    }
  };

  const handleCopyLink = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/ativar?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleCopyMessage = (lead: Lead) => {
    const origin = window.location.origin;
    const inviteUrl = `${origin}/ativar?token=${lead.invite_token}`;
    const firstName = lead.name.split(' ')[0];
    const isVip = lead.invite_is_vip === 1;

    const msg = `Olá, ${firstName}! 🌟 Aqui é da equipe do Synapsis Clínico.

Boas notícias: sua inscrição no Clube das Fundadoras foi aprovada!
${isVip ? '👑 Como membro VIP Fundadora, seu acesso é vitalício e 100% gratuito.' : '🌟 Liberamos seu acesso exclusivo com 90 dias de cortesia para você experimentar todas as ferramentas no seu consultório.'}

👉 Para criar sua senha e ativar o ambiente exclusivo do seu consultório, basta clicar no link abaixo:
${inviteUrl}

Se tiver qualquer dúvida ou precisar de suporte no primeiro acesso, estamos à disposição!`;

    navigator.clipboard.writeText(msg);
    setCopiedWhatsapp(lead.id);
    setTimeout(() => setCopiedWhatsapp(null), 3000);
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Painel SuperAdmin</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  PLATFORM OWNER
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gestão de Leads da Landing Page, Convites do Clube das Fundadoras e Clínicas Multi-Tenant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action feedback */}
        {actionSuccess && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-2.5 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-5">
          <button
            onClick={() => setActiveTab('leads')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'leads'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Leads do Clube das Fundadoras
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {leads.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('clinics')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'clinics'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4 text-teal-400" />
            Clínicas Ativas & Assinaturas
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {clinics.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs">Carregando dados...</p>
            </div>
          ) : activeTab === 'leads' ? (
            <div>
              {leads.length === 0 ? (
                <div className="text-center py-16 bg-slate-800/40 rounded-xl border border-slate-800">
                  <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-300 text-sm font-medium">Nenhum lead registrado na lista de espera ainda.</p>
                  <p className="text-slate-500 text-xs mt-1">Os cadastros da Landing Page aparecerão aqui automaticamente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leads.map((lead) => {
                    const isCancelled = lead.status === 'CANCELLED' || lead.invite_status === 'CANCELLED';
                    const isAccepted = !isCancelled && lead.invite_status === 'ACCEPTED';
                    const isApproved = !isCancelled && lead.invite_status === 'PENDING';
                    const isPending = !isCancelled && lead.status === 'PENDING' && !lead.invite_token;
                    const isVipChecked = approveVipMap[lead.id] ?? (lead.email.includes('sandra') || lead.name.toLowerCase().includes('sandra'));

                    return (
                      <div
                        key={lead.id}
                        className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                          isCancelled
                            ? 'bg-slate-900/40 border-rose-900/30 opacity-75 hover:opacity-100'
                            : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{lead.name}</span>
                            {isPending && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                ⏳ Aguardando Aprovação
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                ✉️ Convite Enviado
                              </span>
                            )}
                            {isAccepted && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                🎉 Consultório Ativado
                              </span>
                            )}
                            {isCancelled && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-rose-400" />
                                <span>Desistência / Cancelado</span>
                              </span>
                            )}
                            {lead.invite_is_vip === 1 && !isCancelled && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300">
                                👑 VIP Isento
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>📱 {lead.whatsapp}</span>
                            <span>✉️ {lead.email}</span>
                            <span>💼 {lead.profile}</span>
                            <span>💻 Usa: {lead.current_software}</span>
                            <span className="text-teal-400">Plano: {lead.interested_plan}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isCancelled && (
                            <button
                              onClick={() => handleReopenLead(lead)}
                              disabled={isReopeningId === lead.id}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 hover:border-teal-500/50 rounded-lg text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                              title="Reabrir lead e retornar para a lista de espera"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${isReopeningId === lead.id ? 'animate-spin' : ''}`} />
                              <span>Reativar Lead</span>
                            </button>
                          )}

                          {isPending && (
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 text-xs text-amber-300 cursor-pointer bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                                <input
                                  type="checkbox"
                                  checked={isVipChecked}
                                  onChange={(e) =>
                                    setApproveVipMap((prev) => ({ ...prev, [lead.id]: e.target.checked }))
                                  }
                                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                                />
                                <span>VIP Free</span>
                              </label>

                              <button
                                onClick={() => handleApproveLead(lead)}
                                disabled={isApprovingId === lead.id}
                                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-teal-900/30 disabled:opacity-50"
                              >
                                {isApprovingId === lead.id ? (
                                  <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Gerando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Aprovar & Gerar Link</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => handleCancelLead(lead)}
                                disabled={isCancellingId === lead.id}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition disabled:opacity-50"
                                title="Registrar desistência / Cancelar processo"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {isApproved && lead.invite_token && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCopyMessage(lead)}
                                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                                title="Copiar mensagem personalizada com link para WhatsApp"
                              >
                                {copiedWhatsapp === lead.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Copiar p/ WhatsApp</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => handleCopyLink(lead.invite_token!)}
                                className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                                title="Copiar URL direta de ativação"
                              >
                                {copiedToken === lead.invite_token ? (
                                  <Check className="w-3.5 h-3.5 text-teal-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span className="hidden sm:inline">Link</span>
                              </button>

                              <button
                                onClick={() => handleCancelLead(lead)}
                                disabled={isCancellingId === lead.id}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition disabled:opacity-50"
                                title="Registrar desistência / Cancelar convite"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {isAccepted && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setActiveTab('clinics')}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                              >
                                <Building2 className="w-3.5 h-3.5 text-teal-400" />
                                <span>Ver Clínica</span>
                              </button>
                              <button
                                onClick={() => handleCancelLead(lead)}
                                disabled={isCancellingId === lead.id}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition disabled:opacity-50"
                                title="Registrar cancelamento/desistência"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Tab Clínicas */}
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/60 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Clínica / Consultório</th>
                      <th className="py-3 px-4">Titular / Contato</th>
                      <th className="py-3 px-4">Plano</th>
                      <th className="py-3 px-4">Pacientes</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">VIP Isento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {clinics.map((clinic) => {
                      const isVip = clinic.is_vip_exempt === 1;
                      return (
                        <tr key={clinic.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{clinic.clinic_name}</div>
                            <div className="text-[10px] text-slate-500">ID #{clinic.id}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div>{clinic.owner_name || 'Responsável'}</div>
                            <div className="text-[11px] text-slate-500">{clinic.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                              {clinic.plan}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-slate-400">
                              <Users className="w-3.5 h-3.5 text-teal-400" />
                              <span>{clinic.patient_count} pacientes</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isVip ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                👑 VIP Isento Vitalício
                              </span>
                            ) : clinic.subscription_status === 'ACTIVE' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                                ✅ Ativa
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300">
                                ⏳ Período de Teste
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleVip(clinic)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 border ${
                                isVip
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                              }`}
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>{isVip ? 'Remover VIP' : 'Tornar VIP Free'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
