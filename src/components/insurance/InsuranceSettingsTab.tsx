import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  Sparkles,
  Shield,
  HelpCircle,
  Search,
  Check,
  Percent,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { HealthInsurance, TussProcedure, HealthInsurancePrice } from '../../types.js';

export const InsuranceSettingsTab: React.FC = () => {
  const [insurances, setInsurances] = useState<HealthInsurance[]>([]);
  const [tussProcedures, setTussProcedures] = useState<TussProcedure[]>([]);
  const [selectedInsurance, setSelectedInsurance] = useState<HealthInsurance | null>(null);
  const [prices, setPrices] = useState<HealthInsurancePrice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal de Operadora
  const [isInsuranceModalOpen, setIsInsuranceModalOpen] = useState<boolean>(false);
  const [editingInsurance, setEditingInsurance] = useState<HealthInsurance | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    ans_code: '',
    cnpj: '',
    payment_deadline_days: 30,
    submission_cut_day: 25,
    repasse_default_mode: 'FIXED' as 'FIXED' | 'PERCENTAGE',
    repasse_default_value: 50.0,
    notes: '',
  });

  // Modal de Preço TUSS
  const [editingPriceTuss, setEditingPriceTuss] = useState<TussProcedure | null>(null);
  const [priceForm, setPriceForm] = useState({
    agreed_price: 150.0,
    copay_price: 0.0,
    repasse_fixed_amount: 50.0,
  });
  const [isSavingPrice, setIsSavingPrice] = useState<boolean>(false);

  // Carregar dados iniciais
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [insurancesRes, tussRes] = await Promise.all([
        api.get<HealthInsurance[]>('/health-insurances'),
        api.get<TussProcedure[]>('/tuss-procedures'),
      ]);

      setInsurances(insurancesRes.data || []);
      setTussProcedures(tussRes.data || []);

      if (insurancesRes.data && insurancesRes.data.length > 0) {
        const initial = selectedInsurance
          ? insurancesRes.data.find((i) => i.id === selectedInsurance.id) || insurancesRes.data[0]
          : insurancesRes.data[0];
        setSelectedInsurance(initial);
        fetchPrices(initial.id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar convênios e TUSS:', err);
      setFeedback({ type: 'error', message: 'Falha ao carregar lista de operadoras e procedimentos' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrices = async (insuranceId: number) => {
    try {
      setIsLoadingPrices(true);
      const res = await api.get<HealthInsurancePrice[]>(`/health-insurances/${insuranceId}/prices`);
      setPrices(res.data || []);
    } catch (err: any) {
      console.error('Erro ao buscar preços acordados:', err);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectInsurance = (ins: HealthInsurance) => {
    setSelectedInsurance(ins);
    fetchPrices(ins.id);
  };

  // Abrir Modal para Nova Operadora ou Edição
  const handleOpenInsuranceModal = (ins?: HealthInsurance) => {
    if (ins) {
      setEditingInsurance(ins);
      setFormData({
        name: ins.name,
        ans_code: ins.ans_code || '',
        cnpj: ins.cnpj || '',
        payment_deadline_days: ins.payment_deadline_days || 30,
        submission_cut_day: ins.submission_cut_day || 25,
        repasse_default_mode: ins.repasse_default_mode || 'FIXED',
        repasse_default_value: ins.repasse_default_value || 50.0,
        notes: ins.notes || '',
      });
    } else {
      setEditingInsurance(null);
      setFormData({
        name: '',
        ans_code: '',
        cnpj: '',
        payment_deadline_days: 30,
        submission_cut_day: 25,
        repasse_default_mode: 'FIXED',
        repasse_default_value: 50.0,
        notes: '',
      });
    }
    setIsInsuranceModalOpen(true);
  };

  const handleSaveInsurance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingInsurance) {
        await api.put(`/health-insurances/${editingInsurance.id}`, formData);
        setFeedback({ type: 'success', message: 'Operadora atualizada com sucesso!' });
      } else {
        await api.post('/health-insurances', formData);
        setFeedback({ type: 'success', message: 'Nova operadora cadastrada com sucesso!' });
      }
      setIsInsuranceModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('Erro ao salvar operadora:', err);
      setFeedback({ type: 'error', message: 'Falha ao salvar operadora' });
    }
  };

  // Abrir Edição de Preço Acordado
  const handleOpenPriceModal = (tuss: TussProcedure) => {
    setEditingPriceTuss(tuss);
    const existing = prices.find((p) => p.tuss_id === tuss.id);
    if (existing) {
      setPriceForm({
        agreed_price: existing.agreed_price,
        copay_price: existing.copay_price || 0.0,
        repasse_fixed_amount: existing.repasse_fixed_amount !== null && existing.repasse_fixed_amount !== undefined
          ? existing.repasse_fixed_amount
          : (selectedInsurance?.repasse_default_value || 50.0),
      });
    } else {
      setPriceForm({
        agreed_price: tuss.default_suggested_price || 150.0,
        copay_price: 0.0,
        repasse_fixed_amount: selectedInsurance?.repasse_default_value || 50.0,
      });
    }
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsurance || !editingPriceTuss) return;

    try {
      setIsSavingPrice(true);
      await api.post(`/health-insurances/${selectedInsurance.id}/prices`, {
        tuss_id: editingPriceTuss.id,
        agreed_price: priceForm.agreed_price,
        copay_price: priceForm.copay_price,
        repasse_fixed_amount: priceForm.repasse_fixed_amount,
      });

      setFeedback({ type: 'success', message: `Tabela TUSS ${editingPriceTuss.code} atualizada para ${selectedInsurance.name}!` });
      setEditingPriceTuss(null);
      await fetchPrices(selectedInsurance.id);
    } catch (err: any) {
      console.error('Erro ao salvar preço negociado:', err);
      setFeedback({ type: 'error', message: 'Falha ao salvar preço negociado' });
    } finally {
      setIsSavingPrice(false);
    }
  };

  const filteredProcedures = tussProcedures.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.code.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner Informativo Ultra Premium */}
      <div className="rounded-2xl border border-teal-200/80 bg-linear-to-r from-teal-50 via-white to-emerald-50/50 p-5 shadow-xs dark:border-teal-900/50 dark:from-slate-900 dark:via-slate-900/90 dark:to-teal-950/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-teal-600 text-white shadow-xs shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Hub de Convênios & Tabela TUSS Multidisciplinar
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 uppercase tracking-wider">
                  Fase 1 • Operadoras & Guias
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Centralize o cadastro de operadoras de planos de saúde, tabelas de honorários por código TUSS (Psicologia, Neuropsicologia, Fonoaudiologia, Terapia Ocupacional) e regras automatizadas de repasse aos profissionais parceiros.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenInsuranceModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Operadora</span>
          </button>
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

      {/* Grid Principal: Lista de Operadoras à Esquerda e Tabela TUSS à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda (4 colunas): Cartões de Operadoras */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Operadoras Cadastradas ({insurances.length})
            </h4>
            <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
              ANS Ativas
            </span>
          </div>

          <div className="space-y-2.5">
            {insurances.map((ins) => {
              const isSelected = selectedInsurance?.id === ins.id;
              return (
                <div
                  key={ins.id}
                  onClick={() => handleSelectInsurance(ins)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-white dark:bg-slate-850 border-teal-500 shadow-md ring-2 ring-teal-500/20'
                      : 'bg-white/70 hover:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {ins.name}
                        </span>
                        {ins.status === 'ACTIVE' ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Ativo" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" title="Inativo" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {ins.ans_code ? `Registro ANS: ${ins.ans_code}` : 'ANS Não Informado'}
                        {ins.cnpj ? ` • CNPJ: ${ins.cnpj}` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenInsuranceModal(ins);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Editar Operadora"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Detalhes de Ciclo Financeiro */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span>Receb: <strong>D+{ins.payment_deadline_days}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Corte: <strong>Dia {ins.submission_cut_day}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 col-span-2">
                      <Percent className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Repasse Padrão:{' '}
                        <strong>
                          {ins.repasse_default_mode === 'FIXED'
                            ? `R$ ${Number(ins.repasse_default_value || 50).toFixed(2)}/sessão`
                            : `${ins.repasse_default_value || 60}% do valor`}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Badges de Guias */}
                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="font-medium">
                      {ins.negotiated_procedures_count || 0} procedimentos mapeados
                    </span>
                    {ins.active_guides_count !== undefined && ins.active_guides_count > 0 && (
                      <span className="px-2 py-0.5 rounded-full font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                        {ins.active_guides_count} guias ativas
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna Direita (8 colunas): Tabela de Preços e Catálogo TUSS */}
        <div className="lg:col-span-8 space-y-4">
          {selectedInsurance ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Tabela de Procedimentos Negociados:</span>
                    <span className="text-teal-600 dark:text-teal-400">{selectedInsurance.name}</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Defina o valor acordado com a operadora e o valor de repasse ao profissional para cada código TUSS.
                  </p>
                </div>

                {/* Campo de Busca Rápida */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Buscar código TUSS..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Tabela de Procedimentos TUSS */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <th className="pb-2.5 font-bold">Código TUSS</th>
                      <th className="pb-2.5 font-bold">Procedimento / Especialidade</th>
                      <th className="pb-2.5 font-bold text-right">Valor Acordado</th>
                      <th className="pb-2.5 font-bold text-right">Repasse Profissional</th>
                      <th className="pb-2.5 font-bold text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredProcedures.map((tuss) => {
                      const negotiated = prices.find((p) => p.tuss_id === tuss.id);
                      const agreedVal = negotiated ? negotiated.agreed_price : null;
                      const repasseVal = negotiated?.repasse_fixed_amount !== null && negotiated?.repasse_fixed_amount !== undefined
                        ? negotiated.repasse_fixed_amount
                        : selectedInsurance.repasse_default_value;

                      return (
                        <tr key={tuss.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition">
                          <td className="py-3 font-mono font-bold text-teal-700 dark:text-teal-400">
                            {tuss.code}
                          </td>
                          <td className="py-3">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {tuss.description}
                            </p>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {tuss.category} • {tuss.standard_session_minutes} min
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {agreedVal !== null ? (
                              <span className="font-bold text-slate-900 dark:text-white">
                                R$ {Number(agreedVal).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Padrão R$ {Number(tuss.default_suggested_price).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              R$ {Number(repasseVal || 50).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenPriceModal(tuss)}
                              className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 text-teal-700 dark:text-teal-300 font-bold text-[11px] transition cursor-pointer"
                            >
                              {agreedVal !== null ? 'Ajustar' : 'Definir'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">Nenhuma operadora selecionada</p>
              <p className="text-xs mt-1">Selecione uma operadora à esquerda ou cadastre uma nova para gerenciar valores.</p>
            </div>
          )}

          {/* Dica de Blindagem Ética & Conformidade ANS */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950 dark:text-amber-100">
                Regulamentação ANS (RN nº 501/2022) & Blindagem Ética CFP (01/2009 e 06/2019)
              </p>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                O Synapsis Clínico garante que nenhum dado íntimo de prontuário seja exportado para as operadoras de saúde. Os relatórios de prorrogação gerados pela IA focam estritamente em justificativas funcionais e códigos TUSS, resguardando o sigilo profissional da equipe terapêutica.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Cadastro / Edição de Operadora de Saúde */}
      {isInsuranceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                <span>{editingInsurance ? 'Editar Operadora' : 'Nova Operadora de Convênio'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsInsuranceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInsurance} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Operadora / Plano *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Bradesco Saúde, Amil, SulAmérica..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Código de Registro ANS
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 005711"
                    value={formData.ans_code}
                    onChange={(e) => setFormData({ ...formData, ans_code: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    CNPJ da Operadora
                  </label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Prazo Médio de Recebimento
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={formData.payment_deadline_days}
                      onChange={(e) => setFormData({ ...formData, payment_deadline_days: parseInt(e.target.value) || 30 })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden"
                    />
                    <span className="text-slate-500 font-bold">dias</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dia de Corte de Envio
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold">Dia</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.submission_cut_day}
                      onChange={(e) => setFormData({ ...formData, submission_cut_day: parseInt(e.target.value) || 25 })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Regra de Repasse Padrão ao Terapeuta:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="repasse_mode"
                      value="FIXED"
                      checked={formData.repasse_default_mode === 'FIXED'}
                      onChange={() => setFormData({ ...formData, repasse_default_mode: 'FIXED' })}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Valor Fixo por Sessão (R$)</span>
                  </label>
                  <label className="flex items-center gap-2 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="repasse_mode"
                      value="PERCENTAGE"
                      checked={formData.repasse_default_mode === 'PERCENTAGE'}
                      onChange={() => setFormData({ ...formData, repasse_default_mode: 'PERCENTAGE' })}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Percentual do Acordado (%)</span>
                  </label>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.repasse_default_value}
                  onChange={(e) => setFormData({ ...formData, repasse_default_value: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-850 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInsuranceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {editingInsurance ? 'Salvar Alterações' : 'Cadastrar Operadora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ajustar Preço e Repasse TUSS */}
      {editingPriceTuss && selectedInsurance && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                  TUSS {editingPriceTuss.code}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingPriceTuss.description}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPriceTuss(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePrice} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 text-[11px]">
                Operadora: <strong>{selectedInsurance.name}</strong> • Modalidade: <strong>{editingPriceTuss.category}</strong>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valor Acordado com a Operadora (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={priceForm.agreed_price}
                  onChange={(e) => setPriceForm({ ...priceForm, agreed_price: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Copagamento a ser cobrado do Paciente (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceForm.copay_price}
                  onChange={(e) => setPriceForm({ ...priceForm, copay_price: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Normalmente R$ 0,00 quando 100% coberto pelo plano.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valor de Repasse ao Profissional por Sessão (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceForm.repasse_fixed_amount}
                  onChange={(e) => setPriceForm({ ...priceForm, repasse_fixed_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPriceTuss(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPrice}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingPrice && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Preço</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
