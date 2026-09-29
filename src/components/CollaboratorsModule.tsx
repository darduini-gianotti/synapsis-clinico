import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
  Key,
  Mail,
  Send,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  ExternalLink,
  Ban,
  Pencil,
  Check,
  GraduationCap,
  Award,
  X,
} from 'lucide-react';
import { EmailPreviewModal } from './auth/EmailPreviewModal.js';
import { PasswordActionModal } from './auth/PasswordActionModal.js';
import { ACADEMY_TOURS, ACADEMY_MODULES } from './academy/academyToursData.js';

interface Role {
  id: number;
  name: string;
  is_system: number;
  permissions: string[];
}

interface Collaborator {
  id: number;
  name: string;
  email: string;
  role_name: string;
  role_id: number;
  crp_number?: string | null;
  status?: 'ACTIVE' | 'PENDING_ACTIVATION' | 'BLOCKED';
  failed_login_attempts?: number;
  locked_until?: string | null;
  token_version?: number;
  repasse_mode?: 'PERCENTAGE' | 'FIXED_PER_SESSION';
  repasse_percentage?: number;
  repasse_eval_percentage?: number;
  repasse_fixed_amount?: number | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_info?: string | null;
  academy_progress?: Array<{
    tour_id: string;
    category: string;
    completed_count: number;
    status: string;
    last_completed_at: string;
  }>;
}

const getInitials = (name: string) => {
  const clean = name.replace(/^(Dr\.|Dra\.)\s*/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (clean[0] || 'U').toUpperCase();
};

const getRoleTheme = (roleName: string) => {
  const lower = (roleName || '').toLowerCase();
  if (lower.includes('admin')) {
    return {
      avatarBg: 'bg-amber-100 text-amber-800 border-amber-300/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
      badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    };
  }
  if (lower.includes('psicólog')) {
    return {
      avatarBg: 'bg-teal-100 text-teal-800 border-teal-300/80 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800',
      badge: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
    };
  }
  return {
    avatarBg: 'bg-indigo-100 text-indigo-800 border-indigo-300/80 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800',
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  };
};

export const CollaboratorsModule: React.FC = () => {
  const { clinicSettings } = useAuth();
  const isRepasseEnabled = clinicSettings?.repasse_enabled !== false;
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Invite Modal (Novo Colaborador por Convite Seguro)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role_id: 2, // Default: Psicólogo
    crp_number: '',
  });
  const [isInviting, setIsInviting] = useState(false);

  // Edit Modal (Alteração Cadastral)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: number;
    name: string;
    email: string;
    role_id: number;
    crp_number: string;
    repasse_mode: 'PERCENTAGE' | 'FIXED_PER_SESSION';
    repasse_percentage: number;
    repasse_eval_percentage: number;
    repasse_fixed_amount: number | '';
    pix_key: string;
    pix_key_type: string;
    bank_info: string;
  }>({
    id: 0,
    name: '',
    email: '',
    role_id: 3,
    crp_number: '',
    repasse_mode: 'PERCENTAGE',
    repasse_percentage: 50,
    repasse_eval_percentage: 60,
    repasse_fixed_amount: '',
    pix_key: '',
    pix_key_type: 'CPF',
    bank_info: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Email Preview Modal (Simulador em Tela)
  const [activeEmailPreview, setActiveEmailPreview] = useState<any | null>(null);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);

  // Password Action Modal (para testes diretos de ativação/reset)
  const [activePasswordToken, setActivePasswordToken] = useState<string | null>(null);
  const [activeTokenType, setActiveTokenType] = useState<'INVITE' | 'RESET'>('INVITE');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Academy Training Detail Modal
  const [selectedCollabForAcademy, setSelectedCollabForAcademy] = useState<Collaborator | null>(null);

  // Notifications / Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [collabsRes, rolesRes] = await Promise.all([
        api.get('/collaborators'),
        api.get('/roles'),
      ]);
      if (collabsRes.data.users) setCollaborators(collabsRes.data.users);
      if (rolesRes.data.roles) {
        setRoles(rolesRes.data.roles);
      }
    } catch (err) {
      console.error('Failed to fetch RBAC data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRoleChange = async (userId: number, roleId: number) => {
    try {
      await api.post(`/collaborators/${userId}/role`, { role_id: roleId });
      setEditingUserId(null);
      showNotification('Papel do colaborador atualizado com sucesso.');
      fetchData();
    } catch (err) {
      console.error('Error updating role', err);
      showNotification('Erro ao atualizar papel do colaborador.', 'error');
    }
  };

  const togglePermission = (perm: string) => {
    if (!editingRole) return;
    const current = editingRole.permissions || [];
    const updated = current.includes(perm)
      ? current.filter((p) => p !== perm)
      : [...current, perm];
    setEditingRole({ ...editingRole, permissions: updated });
  };

  const handleSavePermissions = async () => {
    if (!editingRole) return;
    try {
      await api.put(`/roles/${editingRole.id}/permissions`, {
        permissions: editingRole.permissions,
      });
      showNotification('Permissões da função salvas com sucesso!');
      setEditingRole(null);
      fetchData();
    } catch (err) {
      console.error('Error saving permissions', err);
      showNotification('Erro ao salvar permissões.', 'error');
    }
  };

  // 1. Enviar convite seguro (Novo Colaborador - DEC-01)
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsInviting(true);
      const res = await api.post('/collaborators/invite', inviteForm);
      showNotification(res.data.message || 'Convite enviado com sucesso!');
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', role_id: 2, crp_number: '' });
      fetchData();

      if (res.data.emailPreview) {
        setActiveEmailPreview(res.data.emailPreview);
        setIsEmailPreviewOpen(true);
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Erro ao enviar convite.', 'error');
    } finally {
      setIsInviting(false);
    }
  };

  // 2. Reenviar convite de 1º acesso
  const handleResendInvite = async (c: Collaborator) => {
    try {
      const res = await api.post(`/collaborators/${c.id}/resend-invite`);
      showNotification(res.data.message || `Novo convite enviado para ${c.email}`);
      if (res.data.emailPreview) {
        setActiveEmailPreview(res.data.emailPreview);
        setIsEmailPreviewOpen(true);
      }
      fetchData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Erro ao reenviar convite.', 'error');
    }
  };

  // 3. Disparar redefinição de senha assistida pelo Admin (DEC-03)
  const handleTriggerReset = async (c: Collaborator) => {
    try {
      const res = await api.post(`/collaborators/${c.id}/trigger-reset`);
      showNotification(res.data.message || `Link de redefinição enviado para ${c.email}`);
      if (res.data.emailPreview) {
        setActiveEmailPreview(res.data.emailPreview);
        setIsEmailPreviewOpen(true);
      }
      fetchData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Erro ao disparar redefinição.', 'error');
    }
  };

  // 4. Derrubar Credenciais / Revogar Acesso Imediatamente (Kill Switch - DEC-06)
  const handleRevokeAccess = async (c: Collaborator) => {
    const confirmed = window.confirm(
      `⚠️ Tem certeza que deseja suspender o acesso de ${c.name}?\n\nTodas as sessões ativas no computador e celular serão encerradas imediatamente.`
    );
    if (!confirmed) return;

    try {
      const res = await api.post(`/collaborators/${c.id}/revoke-access`);
      showNotification(res.data.message || `Acesso de ${c.name} suspenso.`);
      fetchData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Erro ao revogar acesso.', 'error');
    }
  };

  // 5. Desbloquear / Reativar Colaborador
  const handleUnlock = async (c: Collaborator) => {
    try {
      const res = await api.post(`/collaborators/${c.id}/unlock`);
      showNotification(res.data.message || `Conta de ${c.name} desbloqueada.`);
      fetchData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Erro ao desbloquear.', 'error');
    }
  };

  // 6. Editar dados cadastrais
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUpdating(true);
      const res = await api.put(`/collaborators/${editForm.id}`, editForm);
      showNotification(res.data.message || 'Dados atualizados com sucesso!');
      setShowEditModal(false);
      fetchData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Erro ao atualizar dados.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditModal = (c: Collaborator) => {
    setEditForm({
      id: c.id,
      name: c.name,
      email: c.email,
      role_id: c.role_id,
      crp_number: c.crp_number || '',
      repasse_mode: c.repasse_mode || 'PERCENTAGE',
      repasse_percentage: c.repasse_percentage !== undefined && c.repasse_percentage !== null ? c.repasse_percentage : 50,
      repasse_eval_percentage: c.repasse_eval_percentage !== undefined && c.repasse_eval_percentage !== null ? c.repasse_eval_percentage : 60,
      repasse_fixed_amount: c.repasse_fixed_amount !== undefined && c.repasse_fixed_amount !== null ? c.repasse_fixed_amount : '',
      pix_key: c.pix_key || '',
      pix_key_type: c.pix_key_type || 'CPF',
      bank_info: c.bank_info || '',
    });
    setShowEditModal(true);
  };

  if (loading) {
    return <div className="p-8 text-center animate-pulse">Carregando dados de acesso...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-teal-600" />
            Gestão de Acessos & Segurança (RBAC)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Controle de colaboradores, permissões granulares, convites de 1º acesso e política de senhas fortes.
          </p>
        </div>
      </div>

      {/* Floating Feedback Notification */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm animate-in slide-in-from-top duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colaboradores List */}
        <div className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2.5 text-slate-800 dark:text-white">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight">Colaboradores da Clínica</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {collaborators.length} colaborador{collaborators.length !== 1 ? 'es' : ''} cadastrado{collaborators.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setInviteForm({ name: '', email: '', role_id: 2, crp_number: '' });
                  setShowInviteModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>+ Convidar Novo Colaborador</span>
              </button>
            </div>

            <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[320px]">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 select-none">
                  <tr className="border-b border-slate-200/80 dark:border-slate-800">
                    <th className="px-3.5 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Colaborador</th>
                    <th className="px-3 py-3 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Perfil Atual</th>
                    <th className="px-3 py-3 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Status</th>
                    <th className="px-3 py-3 text-center bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Capacitação & POPs (Copiloto IA)</th>
                    <th className="px-3.5 py-3 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Ações de Segurança</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {collaborators.map((c) => {
                    const isBlocked = c.status === 'BLOCKED';
                    const isPending = c.status === 'PENDING_ACTIVATION';
                    const isNormalActive = !isBlocked && !isPending;
                    const theme = getRoleTheme(c.role_name);

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition group">
                        {/* Colaborador: Avatar + Nome + CRP + Email */}
                        <td className="px-3.5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs border shadow-xs ${theme.avatarBg}`}
                              title={`Perfil: ${c.role_name}`}
                            >
                              {getInitials(c.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(c)}
                                  className="font-semibold text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 hover:underline text-left text-sm whitespace-nowrap"
                                  title="Clique para editar cadastro"
                                >
                                  {c.name}
                                </button>
                                {c.crp_number && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                                    {c.crp_number}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                <span>{c.email}</span>
                                {c.role_name === 'Psicólogo' && isRepasseEnabled && (
                                  <span className="text-[10px] text-teal-700 dark:text-teal-300 font-medium bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-200/50 dark:border-teal-800/50">
                                    Repasse: {c.repasse_mode === 'FIXED_PER_SESSION' ? `R$ ${c.repasse_fixed_amount || 0}/sessão` : `${c.repasse_percentage ?? 50}%`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Perfil Atual */}
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          {editingUserId === c.id ? (
                            <select
                              className="rounded-lg border-slate-300 bg-white text-xs py-1 px-2 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              defaultValue={c.role_id}
                              onChange={(e) => handleRoleChange(c.id, Number(e.target.value))}
                              autoFocus
                              onBlur={() => setEditingUserId(null)}
                            >
                              {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingUserId(c.id)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer transition ${theme.badge}`}
                              title="Clique para alterar papel"
                            >
                              <span>{c.role_name}</span>
                              <Pencil className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
                            </button>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          {isPending && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>Convite Pendente</span>
                            </span>
                          )}
                          {isBlocked && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                              <Ban className="h-3 w-3 shrink-0" />
                              <span>Acesso Suspenso</span>
                            </span>
                          )}
                          {isNormalActive && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                              <Check className="h-3 w-3 shrink-0" />
                              <span>Ativo</span>
                            </span>
                          )}
                        </td>

                        {/* Capacitação Academy */}
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          {(() => {
                            const prog = c.academy_progress || [];
                            const totalTours = ACADEMY_TOURS.length || 1;
                            const completedCount = prog.filter((p) => p.status === 'COMPLETED').length;
                            const percent = Math.round((completedCount / totalTours) * 100);

                            return (
                              <button
                                type="button"
                                onClick={() => setSelectedCollabForAcademy(c)}
                                className="inline-flex flex-col items-center gap-1 group/acad cursor-pointer"
                                title="Clique para ver detalhes do treinamento e histórico de repetições por trilha"
                              >
                                <div className="flex items-center gap-1.5">
                                  <GraduationCap
                                    className={`h-4 w-4 ${
                                      percent === 100
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : percent > 0
                                        ? 'text-teal-600 dark:text-teal-400'
                                        : 'text-slate-400'
                                    }`}
                                  />
                                  <span
                                    className={`text-xs font-bold ${
                                      percent === 100
                                        ? 'text-emerald-700 dark:text-emerald-300'
                                        : percent > 0
                                        ? 'text-teal-700 dark:text-teal-300'
                                        : 'text-slate-400 dark:text-slate-500'
                                    }`}
                                  >
                                    {completedCount} de {totalTours} trilhas
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 mt-0.5 max-w-[220px] flex-wrap justify-center">
                                  {ACADEMY_TOURS.map((tour) => {
                                    const record = prog.find((p) => p.tour_id === tour.id);
                                    const count = record?.completed_count || 0;
                                    const shortLabel = tour.badge || tour.title.split(' ')[0];

                                    return (
                                      <span
                                        key={tour.id}
                                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium border ${
                                          count > 0
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 font-bold'
                                            : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                                        }`}
                                        title={`${tour.title}: ${count} práticas`}
                                      >
                                        {shortLabel}: {count}x
                                      </span>
                                    );
                                  })}
                                </div>
                              </button>
                            );
                          })()}
                        </td>

                        {/* Ações de Segurança */}
                        <td className="px-3.5 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleResendInvite(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold transition cursor-pointer"
                                title="Reenviar e-mail com novo token de 24h"
                              >
                                <Send className="h-3.5 w-3.5" />
                                <span>Reenviar Convite</span>
                              </button>
                            )}

                            {isNormalActive && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleTriggerReset(c)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:hover:bg-teal-950/30 dark:hover:text-teal-300 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                                  title="Disparar e-mail com link para redefinição de senha"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                                  <span>Reset Senha</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRevokeAccess(c)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:text-rose-300 text-xs font-semibold transition cursor-pointer"
                                  title="Derrubar credenciais e encerrar sessões ativas imediatamente (Kill Switch)"
                                >
                                  <Ban className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                  <span>Suspender</span>
                                </button>
                              </>
                            )}

                            {isBlocked && (
                              <button
                                type="button"
                                onClick={() => handleUnlock(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-semibold transition cursor-pointer"
                                title="Desbloquear acesso do colaborador"
                              >
                                <Unlock className="h-3.5 w-3.5" />
                                <span>Desbloquear</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEditModal(c)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
                              title="Editar Dados Cadastrais"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Perfis Detail (Matriz de Permissões) */}
        <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-800 dark:text-white">
              <Key className="h-5 w-5 text-emerald-500" />
              <h3 className="text-lg font-semibold">Matriz de Permissões</h3>
            </div>
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setEditingRole(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  editingRole?.id === r.id
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700/50'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>

          {editingRole ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <h4 className="font-semibold text-slate-800 dark:text-white">
                  Permissões: {editingRole.name}
                </h4>
                <button
                  onClick={handleSavePermissions}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Salvar
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {[
                  { key: 'view_dashboard', label: 'Visualizar Dashboard' },
                  { key: 'view_agenda', label: 'Visualizar Agenda' },
                  { key: 'create_appointments', label: 'Fazer Agendamentos (Consultas e Sessões)' },
                  { key: 'view_patients', label: 'Visualizar Pacientes' },
                  { key: 'create_patients', label: 'Cadastrar Novos Pacientes' },
                  { key: 'start_evaluations', label: 'Iniciar Nova Avaliação Neuropsicológica' },
                  { key: 'view_clinical_records', label: 'Visualizar Prontuários' },
                  { key: 'edit_clinical_records', label: 'Editar Prontuários' },
                  { key: 'view_documents', label: 'Emitir Documentos CFP' },
                  { key: 'edit_documents', label: 'Editar Modelos CFP' },
                  { key: 'view_scales', label: 'Visualizar Escalas (PHQ-9/GAD-7)' },
                  { key: 'edit_scales', label: 'Aplicar Escalas Clínicas' },
                  { key: 'view_financial', label: 'Visualizar Financeiro / Livro Caixa' },
                  { key: 'edit_financial', label: 'Lançar Receitas / Despesas' },
                  { key: 'view_invoices', label: 'Visualizar Notas Fiscais' },
                  { key: 'manage_invoices', label: 'Gerenciar & Emitir Notas Fiscais' },
                  { key: 'view_audit', label: 'Visualizar Trilha de Auditoria' },
                  { key: 'manage_users', label: 'Gerenciar Colaboradores (RBAC)' },
                ].map((p) => (
                  <label
                    key={p.key}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={editingRole.permissions?.includes(p.key) || false}
                      onChange={() => togglePermission(p.key)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">
              Selecione um papel acima para configurar a matriz de acessos.
            </p>
          )}

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <span className="font-bold block mb-0.5">Controle de Sigilo Profissional (CFP 06/2019)</span>
                Apenas psicólogos habilitados e administradores têm acesso a prontuários e anotações confidenciais. Secretárias possuem visão restrita a agendamentos e cobranças.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: NOVO COLABORADOR POR CONVITE SEGURO (DEC-01)    */}
      {/* ========================================================= */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Convidar Novo Colaborador
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  required
                  placeholder="ex: Dr. André Carvalho"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  E-mail Profissional *
                </label>
                <input
                  required
                  type="email"
                  placeholder="ex: andre.carvalho@psicogestao.com.br"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Perfil (Papel) *
                  </label>
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    value={inviteForm.role_id}
                    onChange={(e) => setInviteForm({ ...inviteForm, role_id: Number(e.target.value) })}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    No do CRP (opcional)
                  </label>
                  <input
                    placeholder="06/123456"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    value={inviteForm.crp_number}
                    onChange={(e) => setInviteForm({ ...inviteForm, crp_number: e.target.value })}
                  />
                </div>
              </div>

              {/* Informational Security Box */}
              <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-teal-600" />
                  Práticas de Segurança & 1º Acesso
                </span>
                <p className="text-[11px] leading-relaxed text-teal-800 dark:text-teal-300">
                  O colaborador receberá um e-mail com link e token criptográfico válido por 24 horas para definir sua própria senha forte, garantindo sigilo total e conformidade com a LGPD.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isInviting ? 'Disparando Convite...' : 'Enviar Convite de Acesso'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDITAR DADOS CADASTRAIS DO COLABORADOR          */}
      {/* ========================================================= */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Editar Dados do Colaborador
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  E-mail Profissional *
                </label>
                <input
                  required
                  type="email"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Perfil (Papel)
                  </label>
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    value={editForm.role_id}
                    onChange={(e) => setEditForm({ ...editForm, role_id: Number(e.target.value) })}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    No do CRP
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    value={editForm.crp_number}
                    onChange={(e) => setEditForm({ ...editForm, crp_number: e.target.value })}
                  />
                </div>
              </div>

              {/* Parâmetros de Repasse de Honorários & PIX */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="text-teal-600 dark:text-teal-400">💰</span> {isRepasseEnabled ? 'Parâmetros de Repasse & Pagamento' : 'Dados de Pagamento & PIX do Profissional'}
                  </h4>
                  {isRepasseEnabled && (
                    <span className="text-[10px] text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">Regime de Caixa</span>
                  )}
                </div>

                {isRepasseEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Modo de Cálculo
                        </label>
                        <select
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                          value={editForm.repasse_mode}
                          onChange={(e) => setEditForm({ ...editForm, repasse_mode: e.target.value as any })}
                        >
                          <option value="PERCENTAGE">Percentual (%) por Serviço</option>
                          <option value="FIXED_PER_SESSION">Valor Fixo (R$) por Sessão</option>
                        </select>
                      </div>

                      {editForm.repasse_mode === 'FIXED_PER_SESSION' ? (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Valor Fixo por Atendimento (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 90.00"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                            value={editForm.repasse_fixed_amount}
                            onChange={(e) => setEditForm({ ...editForm, repasse_fixed_amount: e.target.value ? Number(e.target.value) : '' })}
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            % Psicoterapia Geral
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden pr-7"
                              value={editForm.repasse_percentage}
                              onChange={(e) => setEditForm({ ...editForm, repasse_percentage: Number(e.target.value) })}
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {editForm.repasse_mode === 'PERCENTAGE' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          % Avaliação Neuropsicológica (Pacote / Laudo)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden pr-7"
                            value={editForm.repasse_eval_percentage}
                            onChange={(e) => setEditForm({ ...editForm, repasse_eval_percentage: Number(e.target.value) })}
                          />
                          <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">%</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Aplicado automaticamente a cada parcela paga pelo paciente na avaliação.
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tipo de Chave PIX
                    </label>
                    <select
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      value={editForm.pix_key_type}
                      onChange={(e) => setEditForm({ ...editForm, pix_key_type: e.target.value })}
                    >
                      <option value="CPF">CPF</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="EMAIL">E-mail</option>
                      <option value="PHONE">Celular</option>
                      <option value="EVP">Aleatória</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Chave PIX para Liquidação
                    </label>
                    <input
                      placeholder="Chave PIX do profissional..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-mono"
                      value={editForm.pix_key}
                      onChange={(e) => setEditForm({ ...editForm, pix_key: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                💡 <strong>Dica de Segurança:</strong> Por conformidade com o sigilo, administradores não alteram senhas diretamente. Para redefinir o acesso, utilize o botão <em>"Reset de Senha"</em> na tabela principal.
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: VISUALIZADOR DE E-MAIL TRANSACIONAL (SIMULADOR) */}
      {/* ========================================================= */}
      <EmailPreviewModal
        isOpen={isEmailPreviewOpen}
        emailPreview={activeEmailPreview}
        onClose={() => setIsEmailPreviewOpen(false)}
        onOpenActionUrl={(url) => {
          setIsEmailPreviewOpen(false);
          // Extrai o token da URL e abre o modal de ação diretamente
          const urlObj = new URL(url);
          const token = urlObj.searchParams.get('token');
          const type = (urlObj.searchParams.get('type') as any) || 'INVITE';
          if (token) {
            setActivePasswordToken(token);
            setActiveTokenType(type);
            setIsPasswordModalOpen(true);
          }
        }}
      />

      {/* ========================================================= */}
      {/* MODAL 4: DEFINIÇÃO DE SENHA FORTE (TESTE / ATIVAÇÃO)      */}
      {/* ========================================================= */}
      {activePasswordToken && (
        <PasswordActionModal
          isOpen={isPasswordModalOpen}
          token={activePasswordToken}
          type={activeTokenType}
          onClose={() => {
            setIsPasswordModalOpen(false);
            setActivePasswordToken(null);
          }}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            setActivePasswordToken(null);
            fetchData();
            showNotification('Senha cadastrada com sucesso! Conta do colaborador ativada.');
          }}
        />
      )}
      {/* ========================================================= */}
      {/* MODAL 5: DETALHES DE CAPACITAÇÃO DA SYNAPSIS ACADEMY     */}
      {/* ========================================================= */}
      {selectedCollabForAcademy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    POPs Clínicos & Capacitação: {selectedCollabForAcademy.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedCollabForAcademy.role_name} • {selectedCollabForAcademy.email}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCollabForAcademy(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Summary Breakdown per Track */}
              {(() => {
                const progressList = selectedCollabForAcademy.academy_progress || [];
                const totalTours = ACADEMY_TOURS.length || 1;
                const completedCount = progressList.filter((p) => p.status === 'COMPLETED').length;

                return (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Práticas por Trilha Realizada:
                      </span>
                      <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                        {completedCount} de {totalTours} trilhas concluídas
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
                      {ACADEMY_TOURS.map((tour) => {
                        const rec = progressList.find((p) => p.tour_id === tour.id);
                        const count = rec?.completed_count || 0;
                        const isDone = rec?.status === 'COMPLETED' || count > 0;

                        return (
                          <div
                            key={tour.id}
                            className={`rounded-xl border p-3 ${
                              isDone
                                ? 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/30'
                                : 'border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30'
                            }`}
                          >
                            <span
                              className="text-[11px] text-slate-600 dark:text-slate-400 block font-medium truncate"
                              title={tour.title}
                            >
                              {tour.title}
                            </span>
                            <strong
                              className={`text-lg font-extrabold block mt-0.5 ${
                                isDone
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {count} {count === 1 ? 'vez' : 'vezes'}
                            </strong>
                            <span
                              className={`text-[10px] font-bold block mt-0.5 ${
                                isDone ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'
                              }`}
                            >
                              {isDone ? 'Capacitado' : 'Pendente'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Procedures Detail List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  Histórico de Procedimentos & Repetições
                </h4>

                {ACADEMY_TOURS.map((tour) => {
                  const record = (selectedCollabForAcademy.academy_progress || []).find(
                    (p) => p.tour_id === tour.id
                  );
                  const isDone = record?.status === 'COMPLETED';

                  return (
                    <div
                      key={tour.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 p-3.5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-medium block">
                            {ACADEMY_MODULES.find((m) => m.id === tour.category)?.title || tour.category}
                          </span>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                            {tour.badge}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {tour.title}
                        </h5>
                        {isDone && record?.last_completed_at && (
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            Última realização: {new Date(record.last_completed_at).toLocaleDateString('pt-BR')} às {new Date(record.last_completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        {isDone ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" />
                              Concluído
                            </span>
                            <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 border border-teal-200/70 dark:border-teal-800 px-2 py-0.5 rounded-md">
                              🔁 Praticado {record.completed_count} {record.completed_count === 1 ? 'vez' : 'vezes'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                              Pendente
                            </span>
                            <span className="text-[10px] text-slate-400">
                              0 práticas
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Award className="h-4 w-4 text-teal-600 shrink-0" />
                <span>
                  O colaborador pode repetir os treinamentos a qualquer momento através do portal da Academy para aperfeiçoamento prático contínuo.
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCollabForAcademy(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition shadow-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
