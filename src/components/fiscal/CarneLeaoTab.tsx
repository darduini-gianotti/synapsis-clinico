import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { CarneLeaoSummary, FiscalDossier } from '../../types.js';
import { useAcademy } from '../../context/AcademyContext.js';
import { MOCK_SANDBOX_CARNE_LEAO, MOCK_SANDBOX_DOSSIER } from '../academy/mockData.js';
import { CarneLeaoExportModal } from './CarneLeaoExportModal.js';
import { FiscalDossierModal } from './FiscalDossierModal.js';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  FileText,
  User,
  Users,
  Settings,
  Receipt,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const CarneLeaoTab: React.FC = () => {
  const { isSandboxActive, advanceStep, activeTour } = useAcademy();
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedPsychologistId, setSelectedPsychologistId] = useState<number>(1);
  const [psychologists, setPsychologists] = useState<any[]>([]);

  const [summary, setSummary] = useState<CarneLeaoSummary | null>(null);
  const [dossier, setDossier] = useState<FiscalDossier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<'revenues' | 'expenses'>('revenues');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);

  // Carregar lista de psicólogos para o seletor (se admin/multi-usuário)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/users');
        const psychs = (res.data || []).filter((u: any) => u.role === 'PSYCHOLOGIST' || u.role === 'ADMIN');
        setPsychologists(psychs);
        if (psychs.length > 0 && !psychs.some((p: any) => p.id === selectedPsychologistId)) {
          setSelectedPsychologistId(psychs[0].id);
        }
      } catch (err) {
        console.error('Error loading psychologists:', err);
      }
    };
    fetchUsers();
  }, []);

  // Carregar dados da competência
  const fetchSummary = async () => {
    if (isSandboxActive) {
      setSummary(MOCK_SANDBOX_CARNE_LEAO as any);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/fiscal/carne-leao-summary', {
        params: {
          year: selectedYear,
          month: selectedMonth,
          psychologistId: selectedPsychologistId,
        },
      });
      setSummary(res.data.summary);
    } catch (err: any) {
      console.error('Error fetching carne-leao summary:', err);
      setError(err.response?.data?.error || 'Erro ao carregar dados do Carnê-Leão');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedYear, selectedMonth, selectedPsychologistId, isSandboxActive]);

  // Carregar dossiê completo para visualização
  const handleOpenDossier = async () => {
    if (isSandboxActive) {
      setDossier(MOCK_SANDBOX_DOSSIER as any);
      setIsDossierModalOpen(true);
      if (activeTour?.id === 'tour-fiscal-carne-leao') {
        advanceStep();
      }
      return;
    }

    try {
      const res = await api.get('/fiscal/dossier-data', {
        params: {
          year: selectedYear,
          month: selectedMonth,
          psychologistId: selectedPsychologistId,
        },
      });
      setDossier(res.data.dossier);
      setIsDossierModalOpen(true);
    } catch (err: any) {
      console.error('Error fetching dossier:', err);
    }
  };

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ];

  const currentYear = today.getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Seletores de Competência */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Competência:</span>
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {psychologists.length > 1 && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <User className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <select
                value={selectedPsychologistId}
                onChange={(e) => setSelectedPsychologistId(Number(e.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-purple-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                {psychologists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.crp_number || 'Sem CRP'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={fetchSummary}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Recalcular competência"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Botões de Fechamento e Dossiê */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            data-tour="carne-leao-dossier-btn"
            onClick={handleOpenDossier}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Dossiê Fiscal (PDF)</span>
          </button>

          <button
            type="button"
            data-tour="carne-leao-export-btn"
            onClick={() => {
              setIsExportModalOpen(true);
              if (isSandboxActive && activeTour?.id === 'tour-fiscal-carne-leao') {
                advanceStep();
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Fechamento do Mês (Carnê-Leão)</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent mb-3" />
          <p>Apuração fiscal e cálculo do DARF 0190 em processamento...</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : summary ? (
        <>
          {/* Grid de Cards Superiores (Painel DRE & DARF) */}
          <div data-tour="carne-leao-summary-card" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Previsão de DARF (Cód 0190) */}
            <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border-2 border-teal-500 dark:border-teal-700 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wider">
                    Previsão de DARF (0190)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-200 text-teal-900 dark:bg-teal-900 dark:text-teal-200 font-bold font-mono">
                    IRPF Mensal
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-teal-800 dark:text-teal-200 mt-2 font-mono">
                  {formatMoney(summary.darf.finalDarfAmount)}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-teal-200 dark:border-teal-800 text-[11px] text-teal-950 dark:text-teal-300 space-y-0.5">
                <div className="flex justify-between">
                  <span>Alíquota Efetiva:</span>
                  <span className="font-bold">{summary.darf.aliquotPercent.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Vencimento:</span>
                  <span className="font-bold font-mono">{summary.darf.dueDateFormatted}</span>
                </div>
                {summary.darf.isBelowMinThreshold && (
                  <p className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold pt-1">
                    * Menor que R$ 10,00 (acumulado)
                  </p>
                )}
              </div>
            </div>

            {/* Card 2: Receitas Brutas */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    (+) Receitas Brutas
                  </span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
                  {formatMoney(summary.totalRevenues)}
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-500 flex justify-between">
                <span>Honorários recebidos:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{summary.revenues.length} consultas</span>
              </div>
            </div>

            {/* Card 3: Livro-Caixa Dedutível */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    (-) Livro-Caixa
                  </span>
                  <TrendingDown className="h-4 w-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">
                  {formatMoney(summary.totalDeductibleExpenses)}
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-500 flex justify-between">
                <span>Déficit anterior:</span>
                <span className="font-semibold text-amber-600">
                  {formatMoney(summary.carriedOverDeficitFromPreviousMonths)}
                </span>
              </div>
            </div>

            {/* Card 4: Deduções Pessoais & Base de Cálculo */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    (=) Base Tributável
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    - {formatMoney(summary.totalPersonalDeductions)} deduções
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">
                  {formatMoney(summary.taxBase)}
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-500 flex justify-between">
                <span>INSS ({summary.settings.inss_mode}):</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMoney(summary.inssDeduction)}</span>
              </div>
            </div>
          </div>

          {/* Banner de Conformidade Legal */}
          <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-xs text-teal-950 dark:text-teal-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-teal-600 shrink-0" />
              <span>
                <strong>Blindagem Fiscal Ativa:</strong> Todas as receitas identificam separadamente o CPF do Titular Pagador e do Paciente Beneficiário, prevenindo malha fina (IN RFB 1.531/2015).
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
              <span>CBO: <strong>{summary.psychologist.cboCode}</strong></span>
              <span>•</span>
              <span>CRP: <strong>{summary.psychologist.crp}</strong></span>
            </div>
          </div>

          {/* Navegação entre Rendimentos e Livro-Caixa */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveView('revenues')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeView === 'revenues'
                      ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-teal-300'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Rendimentos de Pacientes ({summary.revenues.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView('expenses')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeView === 'expenses'
                      ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-teal-300'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                  <span>Livro-Caixa e Despesas ({summary.expenses.length})</span>
                </button>
              </div>

              <span className="text-xs text-slate-500 font-medium">
                {activeView === 'revenues'
                  ? `Total de Honorários: ${formatMoney(summary.totalRevenues)}`
                  : `Total Dedutível no Mês: ${formatMoney(summary.totalDeductibleExpenses)}`}
              </span>
            </div>

            {/* Tabela de Rendimentos */}
            {activeView === 'revenues' ? (
              <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[320px]">
                <table className="w-full text-left text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 select-none">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">Data</th>
                      <th className="py-3 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">Paciente (Beneficiário)</th>
                      <th className="py-3 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">CPF Paciente</th>
                      <th className="py-3 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">Titular / Pagador</th>
                      <th className="py-3 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">CPF Pagador</th>
                      <th className="py-3 px-4 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">Valor Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary.revenues.length > 0 ? (
                      summary.revenues.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono">
                            {r.date}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {r.patientName}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                            {r.patientCpf}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {r.payerName}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                            {r.payerCpf}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatMoney(r.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                          Nenhum rendimento quitado encontrado nesta competência.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Tabela de Despesas do Livro-Caixa */
              <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[320px]">
                <table className="w-full text-left text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 select-none">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">Data</th>
                      <th className="py-3 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">Descrição da Despesa</th>
                      <th className="py-3 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">Conta RFB</th>
                      <th className="py-3 px-4 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">Enquadramento / Rateio</th>
                      <th className="py-3 px-4 text-right bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 shadow-2xs font-semibold uppercase text-[11px] text-slate-600 dark:text-slate-300">Valor Escriturado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary.expenses.length > 0 ? (
                      summary.expenses.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono">
                            {e.date}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {e.title}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                            {e.rfbAccountCode}
                          </td>
                          <td className="py-3 px-4">
                            {e.origin === 'SHARED' ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold text-[10px]">
                                Consultório Compartilhado ({e.splitPercent.toFixed(0)}%)
                              </span>
                            ) : e.origin === 'SUBLOCACAO_CLINICA' ? (
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold text-[10px]">
                                Taxa de Sala / Coworking
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                                Despesa Direta
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                            {formatMoney(e.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                          Nenhuma despesa dedutível encontrada para este profissional no mês.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Modais de Fechamento e Dossiê */}
      {isExportModalOpen && (
        <CarneLeaoExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          year={selectedYear}
          month={selectedMonth}
          psychologistId={selectedPsychologistId}
          summary={summary}
          onOpenDossier={() => {
            setIsExportModalOpen(false);
            handleOpenDossier();
          }}
        />
      )}

      {isDossierModalOpen && (
        <FiscalDossierModal
          isOpen={isDossierModalOpen}
          onClose={() => setIsDossierModalOpen(false)}
          dossier={dossier}
        />
      )}
    </div>
  );
};
