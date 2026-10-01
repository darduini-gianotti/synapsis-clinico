import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  CreditCard,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  FileText,
  Printer,
  Copy,
  Check,
  Clock,
  ChevronRight,
  RefreshCw,
  Edit2,
  Trash2,
  AlertCircle,
  HelpCircle,
  FileCheck,
  Stethoscope,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { Patient, HealthInsurance, TussProcedure, PatientAuthorization, InsuranceExtensionReport } from '../../types.js';

interface PatientInsuranceTabProps {
  patient: Patient;
  onUpdatePatient?: (updated: Patient) => void;
}

export const PatientInsuranceTab: React.FC<PatientInsuranceTabProps> = ({
  patient,
  onUpdatePatient,
}) => {
  const [authorizations, setAuthorizations] = useState<PatientAuthorization[]>([]);
  const [insurances, setInsurances] = useState<HealthInsurance[]>([]);
  const [tussList, setTussList] = useState<TussProcedure[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal de Nova / Editar Guia
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [editingAuth, setEditingAuth] = useState<PatientAuthorization | null>(null);
  const [authForm, setAuthForm] = useState({
    insurance_id: patient.insurance_id || 1,
    tuss_id: 1,
    card_number: patient.insurance_card_number || '',
    card_validity: patient.insurance_card_validity || '',
    plan_name: patient.insurance_plan_name || '',
    guide_number: '',
    auth_date: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    total_sessions_authorized: 10,
    executed_sessions_count: 0,
    doctor_referral_crm: '',
    doctor_referral_name: '',
    doctor_referral_cid: 'F41.1',
    notes: '',
  });

  // Modal de Relatório de Prorrogação com IA
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportTargetAuth, setReportTargetAuth] = useState<PatientAuthorization | null>(null);
  const [reportParams, setReportParams] = useState({
    requestedSessionsCount: 12,
    frequency: '1x por semana (50 minutos)',
    clinicalGoalsSummary: 'Consolidação de estratégias de regulação emocional, redução de sintomas ansiosos e prevenção de recaídas funcionais.',
    cidOverride: '',
  });
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [generatedReport, setGeneratedReport] = useState<InsuranceExtensionReport | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [authRes, insRes, tussRes] = await Promise.all([
        api.get<PatientAuthorization[]>(`/patient-authorizations?patientId=${patient.id}`),
        api.get<HealthInsurance[]>('/health-insurances'),
        api.get<TussProcedure[]>('/tuss-procedures'),
      ]);

      setAuthorizations(authRes.data || []);
      setInsurances(insRes.data || []);
      setTussList(tussRes.data || []);

      if (insRes.data?.length > 0 && !patient.insurance_id) {
        setAuthForm((prev) => ({ ...prev, insurance_id: insRes.data[0].id }));
      }
      if (tussRes.data?.length > 0) {
        setAuthForm((prev) => ({ ...prev, tuss_id: tussRes.data[0].id }));
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados de convênio do paciente:', err);
      setFeedback({ type: 'error', message: 'Falha ao carregar autorizações e convênios' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [patient.id]);

  // Abrir Modal de Guia
  const handleOpenAuthModal = (auth?: PatientAuthorization) => {
    if (auth) {
      setEditingAuth(auth);
      setAuthForm({
        insurance_id: auth.insurance_id,
        tuss_id: auth.tuss_id || (tussList[0]?.id || 1),
        card_number: auth.card_number,
        card_validity: auth.card_validity || '',
        plan_name: auth.plan_name || '',
        guide_number: auth.guide_number,
        auth_date: auth.auth_date || new Date().toISOString().split('T')[0],
        valid_until: auth.valid_until,
        total_sessions_authorized: auth.total_sessions_authorized,
        executed_sessions_count: auth.executed_sessions_count,
        doctor_referral_crm: auth.doctor_referral_crm || '',
        doctor_referral_name: auth.doctor_referral_name || '',
        doctor_referral_cid: auth.doctor_referral_cid || '',
        notes: auth.notes || '',
      });
    } else {
      setEditingAuth(null);
      setAuthForm({
        insurance_id: patient.insurance_id || (insurances[0]?.id || 1),
        tuss_id: tussList[0]?.id || 1,
        card_number: patient.insurance_card_number || '',
        card_validity: patient.insurance_card_validity || '',
        plan_name: patient.insurance_plan_name || '',
        guide_number: '',
        auth_date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total_sessions_authorized: 10,
        executed_sessions_count: 0,
        doctor_referral_crm: '',
        doctor_referral_name: '',
        doctor_referral_cid: 'F41.1',
        notes: '',
      });
    }
    setIsAuthModalOpen(true);
  };

  const handleSaveAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.guide_number.trim() || !authForm.valid_until) return;

    try {
      if (editingAuth) {
        await api.put(`/patient-authorizations/${editingAuth.id}`, authForm);
        setFeedback({ type: 'success', message: 'Guia de autorização atualizada com sucesso!' });
      } else {
        await api.post('/patient-authorizations', {
          ...authForm,
          patient_id: patient.id,
        });
        setFeedback({ type: 'success', message: 'Nova guia de autorização registrada com sucesso!' });
      }
      setIsAuthModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('Erro ao salvar autorização:', err);
      setFeedback({ type: 'error', message: 'Falha ao salvar guia de autorização' });
    }
  };

  const handleIncrementExecutedSession = async (auth: PatientAuthorization) => {
    const nextCount = auth.executed_sessions_count + 1;
    try {
      await api.put(`/patient-authorizations/${auth.id}`, {
        executed_sessions_count: nextCount,
      });
      setFeedback({ type: 'success', message: `Sessão computada na guia ${auth.guide_number} (${nextCount}/${auth.total_sessions_authorized})` });
      await fetchData();
    } catch (err: any) {
      console.error('Erro ao atualizar sessão:', err);
      setFeedback({ type: 'error', message: 'Falha ao computar sessão na guia' });
    }
  };

  const handleDeleteAuth = async (authId: number) => {
    if (!window.confirm('Tem certeza de que deseja remover esta guia de autorização?')) return;
    try {
      await api.delete(`/patient-authorizations/${authId}`);
      setFeedback({ type: 'success', message: 'Guia de autorização removida.' });
      await fetchData();
    } catch (err: any) {
      console.error('Erro ao excluir guia:', err);
      setFeedback({ type: 'error', message: 'Falha ao remover guia' });
    }
  };

  // Abrir Gerador de Relatório Técnico Sanitizado com IA
  const handleOpenReportModal = (auth?: PatientAuthorization) => {
    setReportTargetAuth(auth || authorizations[0] || null);
    setReportParams({
      requestedSessionsCount: 12,
      frequency: '1x por semana (50 minutos)',
      clinicalGoalsSummary: 'Consolidação de estratégias de regulação emocional, manejo adaptativo de ansiedade e prevenção de recaídas funcionais.',
      cidOverride: auth?.doctor_referral_cid || 'F41.1',
    });
    setGeneratedReport(null);
    setIsReportModalOpen(true);
  };

  const handleGenerateReport = async () => {
    try {
      setIsGeneratingReport(true);
      const res = await api.post<InsuranceExtensionReport>('/ai/generate-insurance-report', {
        patientId: patient.id,
        authorizationId: reportTargetAuth?.id,
        requestedSessionsCount: reportParams.requestedSessionsCount,
        frequency: reportParams.frequency,
        clinicalGoalsSummary: reportParams.clinicalGoalsSummary,
        cidOverride: reportParams.cidOverride,
      });
      setGeneratedReport(res.data);
    } catch (err: any) {
      console.error('Erro ao gerar relatório com IA:', err);
      setFeedback({ type: 'error', message: 'Falha ao gerar relatório de convênio' });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCopyReport = () => {
    if (!generatedReport) return;
    navigator.clipboard.writeText(generatedReport.formattedFullDocument);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const handlePrintReport = () => {
    if (!generatedReport) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${generatedReport.reportTitle}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            h1 { font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #0f766e; padding-bottom: 8px; color: #0f766e; }
            h2, h3 { font-size: 14px; margin-top: 20px; color: #334155; }
            hr { border: 0; border-top: 1px solid #cbd5e1; margin: 20px 0; }
            blockquote { background: #f8fafc; border-left: 4px solid #0f766e; margin: 20px 0; padding: 12px 16px; font-size: 12px; color: #64748b; font-style: italic; }
            pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; }
          </style>
        </head>
        <body>
          <pre>${generatedReport.formattedFullDocument}</pre>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const currentInsurance = insurances.find((i) => i.id === patient.insurance_id) || insurances[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner de Identificação do Convênio do Paciente */}
      <div className="rounded-2xl border border-teal-200/80 bg-linear-to-r from-teal-50 via-white to-emerald-50/50 p-5 shadow-xs dark:border-teal-900/50 dark:from-slate-900 dark:via-slate-900/90 dark:to-teal-950/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-teal-600 text-white shadow-xs shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {currentInsurance?.name || 'Convênio & Saúde Suplementar'}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 uppercase tracking-wider">
                  {patient.financial_plan_type === 'Convênio' ? 'Atendimento por Plano' : 'Reembolso Assistido'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Carteirinha: <strong>{patient.insurance_card_number || 'Não informada'}</strong>
                {patient.insurance_plan_name ? ` • Plano: ${patient.insurance_plan_name}` : ''}
                {patient.insurance_card_validity ? ` • Validade: ${patient.insurance_card_validity}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleOpenReportModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              title="Gerar justificativa técnica para prorrogação com Inteligência Artificial"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Relatório de Prorrogação (IA)</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAuthModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Guia / Senha</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] font-bold underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Seção de Guias Ativas e Saldo Preditivo */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Autorizações & Saldo Regressivo de Sessões
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Controle automático de senhas autorizadas, prazos de validade e contagem regressiva para evitar glosas.
            </p>
          </div>
        </div>

        {authorizations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center text-slate-400 bg-white/50 dark:bg-slate-900/30">
            <FileCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nenhuma guia de autorização registrada para este paciente
            </p>
            <p className="text-xs mt-1 max-w-md mx-auto">
              Cadastre a primeira autorização ou senha fornecida pelo convênio para acompanhar o saldo de sessões em tempo real.
            </p>
            <button
              type="button"
              onClick={() => handleOpenAuthModal()}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Primeira Guia</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {authorizations.map((auth) => {
              const remaining = auth.total_sessions_authorized - auth.executed_sessions_count;
              const isCritical = remaining <= 2 && remaining > 0;
              const isExhausted = remaining <= 0;
              const progressPct = Math.min(100, (auth.executed_sessions_count / auth.total_sessions_authorized) * 100);

              return (
                <div
                  key={auth.id}
                  className={`rounded-2xl border p-5 transition-all relative ${
                    isCritical
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-xs'
                      : isExhausted
                      ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-90'
                      : 'bg-white dark:bg-slate-900/80 border-teal-200 dark:border-teal-900/40 shadow-xs'
                  }`}
                >
                  {/* Top Bar do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                          Guia nº {auth.guide_number}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {auth.insurance_name}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1">
                        {auth.tuss_code ? `TUSS ${auth.tuss_code} — ` : ''}
                        {auth.tuss_description || 'Atendimento Psicológico'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenAuthModal(auth)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Editar Guia"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAuth(auth.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="Excluir Guia"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Informações Médicas e Validade */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Validade:{' '}
                        <strong>
                          {new Date(auth.valid_until + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span>
                        CID: <strong>{auth.doctor_referral_cid || 'Não especificado'}</strong>
                      </span>
                    </div>

                    {auth.doctor_referral_name && (
                      <div className="col-span-2 text-[10px] text-slate-500">
                        Médico: {auth.doctor_referral_name} {auth.doctor_referral_crm ? `(CRM: ${auth.doctor_referral_crm})` : ''}
                      </div>
                    )}
                  </div>

                  {/* Barra de Progresso e Saldo */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-300">
                        Sessões Executadas: {auth.executed_sessions_count} / {auth.total_sessions_authorized}
                      </span>
                      <span
                        className={
                          isExhausted
                            ? 'text-rose-600 dark:text-rose-400'
                            : isCritical
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-teal-600 dark:text-teal-400'
                        }
                      >
                        {isExhausted
                          ? 'Esgotada (0 restantes)'
                          : `${remaining} restante${remaining > 1 ? 's' : ''}`}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isExhausted
                            ? 'bg-rose-500'
                            : isCritical
                            ? 'bg-amber-500'
                            : 'bg-teal-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Alerta Preditivo Inteligente */}
                  {isCritical && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Saldo Crítico (Restam {remaining} sessões):</strong> Solicite o relatório de prorrogação com IA agora para que a operadora libere a nova autorização sem interrupção do cuidado.
                      </div>
                    </div>
                  )}

                  {/* Botões de Ação na Guia */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isExhausted}
                      onClick={() => handleIncrementExecutedSession(auth)}
                      className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 text-teal-800 dark:text-teal-200 text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+1 Sessão Executada</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenReportModal(auth)}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>Prorrogar com IA</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Cadastro / Edição de Guia */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <span>{editingAuth ? 'Editar Guia de Autorização' : 'Nova Guia / Senha do Convênio'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAuth} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Operadora de Saúde *
                  </label>
                  <select
                    value={authForm.insurance_id}
                    onChange={(e) => setAuthForm({ ...authForm, insurance_id: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden"
                  >
                    {insurances.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Procedimento TUSS *
                  </label>
                  <select
                    value={authForm.tuss_id}
                    onChange={(e) => setAuthForm({ ...authForm, tuss_id: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden"
                  >
                    {tussList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} - {t.description.substring(0, 32)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Número da Carteirinha
                  </label>
                  <input
                    type="text"
                    placeholder="Número da Carteira"
                    value={authForm.card_number}
                    onChange={(e) => setAuthForm({ ...authForm, card_number: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Número da Guia / Senha *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 84930219"
                    value={authForm.guide_number}
                    onChange={(e) => setAuthForm({ ...authForm, guide_number: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-mono font-bold text-teal-700 dark:text-teal-300 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sessões Autorizadas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={authForm.total_sessions_authorized}
                    onChange={(e) => setAuthForm({ ...authForm, total_sessions_authorized: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Já Executadas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={authForm.executed_sessions_count}
                    onChange={(e) => setAuthForm({ ...authForm, executed_sessions_count: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Válida Até *
                  </label>
                  <input
                    type="date"
                    required
                    value={authForm.valid_until}
                    onChange={(e) => setAuthForm({ ...authForm, valid_until: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-hidden dark:[color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Informações do Encaminhamento Médico */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Encaminhamento Médico (Obrigatório para Convênio):
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nome do Médico Solicitante"
                    value={authForm.doctor_referral_name}
                    onChange={(e) => setAuthForm({ ...authForm, doctor_referral_name: e.target.value })}
                    className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-850 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="CRM/UF"
                      value={authForm.doctor_referral_crm}
                      onChange={(e) => setAuthForm({ ...authForm, doctor_referral_crm: e.target.value })}
                      className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-850 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="CID-10/11"
                      value={authForm.doctor_referral_cid}
                      onChange={(e) => setAuthForm({ ...authForm, doctor_referral_cid: e.target.value })}
                      className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-850 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {editingAuth ? 'Salvar Guia' : 'Cadastrar Guia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gerador de Relatório Técnico de Prorrogação Sanitizado por IA */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Gerador de Relatório de Prorrogação (IA Sanitizada)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Blindado pelas Resoluções CFP nº 01/2009 e 06/2019 e RN ANS nº 501/2022
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1 text-xs">
              {!generatedReport ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40 text-teal-900 dark:text-teal-200 text-[11px] leading-relaxed">
                    A IA sintetiza a justificativa funcional de continuidade do tratamento psicoterapêutico para liberação de novo lote de sessões sem expor informações confidenciais do prontuário ou intimidades do paciente.
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Sessões Solicitadas
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={reportParams.requestedSessionsCount}
                        onChange={(e) => setReportParams({ ...reportParams, requestedSessionsCount: parseInt(e.target.value) || 12 })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Frequência Sugerida
                      </label>
                      <input
                        type="text"
                        value={reportParams.frequency}
                        onChange={(e) => setReportParams({ ...reportParams, frequency: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Metas Clínicas Técnicas para o Próximo Bloco
                    </label>
                    <textarea
                      rows={3}
                      value={reportParams.clinicalGoalsSummary}
                      onChange={(e) => setReportParams({ ...reportParams, clinicalGoalsSummary: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 p-3 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Visualizador do Relatório Gerado */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 font-sans">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                      <span className="font-bold text-teal-700 dark:text-teal-400 text-xs uppercase tracking-wider">
                        {generatedReport.reportTitle}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date().toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <div className="space-y-2 text-slate-700 dark:text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                      <p><strong>Justificativa Técnica:</strong> {generatedReport.clinicalJustification}</p>
                      <div>
                        <strong>Metas do Novo Ciclo:</strong>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {generatedReport.therapeuticGoalsNextCycle.map((g, idx) => (
                            <li key={idx}>{g}</li>
                          ))}
                        </ul>
                      </div>
                      <p><strong>Sessões Solicitadas:</strong> {generatedReport.requestedSessions} sessões ({generatedReport.suggestedFrequency})</p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 italic">
                      {generatedReport.ethicalNotice}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Fechar
              </button>

              {!generatedReport ? (
                <button
                  type="button"
                  disabled={isGeneratingReport}
                  onClick={handleGenerateReport}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isGeneratingReport ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{isGeneratingReport ? 'Gerando com IA...' : 'Gerar Relatório'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedReport ? 'Copiado!' : 'Copiar Texto'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir / PDF</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
