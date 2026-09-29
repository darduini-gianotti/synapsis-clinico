import React, { useState } from 'react';
import { CarneLeaoSummary } from '../../types.js';
import { api } from '../../services/api.js';
import { useAcademy } from '../../context/AcademyContext.js';
import {
  Download,
  FileText,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Building,
  UploadCloud,
} from 'lucide-react';

interface CarneLeaoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  psychologistId: number;
  summary: CarneLeaoSummary | null;
  onOpenDossier: () => void;
}

export const CarneLeaoExportModal: React.FC<CarneLeaoExportModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  psychologistId,
  summary,
  onOpenDossier,
}) => {
  const { isSandboxActive } = useAcademy();
  const [downloadingRendimentos, setDownloadingRendimentos] = useState(false);
  const [downloadingDespesas, setDownloadingDespesas] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);

  if (!isOpen || !summary) return null;

  const handleDownloadRendimentos = async () => {
    if (isSandboxActive) {
      const csvHeader = 'Data;CPF Titular;Nome Titular;CPF Beneficiario;Nome Beneficiario;CBO;Valor\r\n';
      const csvRows = summary.revenues
        .map(
          (r) =>
            `${r.date};${r.payerCpf};${r.payerName};${r.patientCpf};${r.patientName};${r.cboCode};${r.amount.toFixed(2)}`
        )
        .join('\r\n');
      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rendimentos_carne_leao_${year}_${String(month).padStart(2, '0')}_simulado.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    try {
      setDownloadingRendimentos(true);
      const res = await api.get('/fiscal/export-rendimentos-csv', {
        params: { year, month, psychologistId },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rendimentos_carne_leao_${year}_${String(month).padStart(2, '0')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download rendimentos CSV:', err);
    } finally {
      setDownloadingRendimentos(false);
    }
  };

  const handleDownloadDespesas = async () => {
    if (isSandboxActive) {
      const csvHeader = 'Data;Codigo Conta RFB;Descricao;Valor Dedutivel\r\n';
      const csvRows = summary.expenses
        .map((e) => `${e.date};${e.rfbAccountCode};${e.title};${e.amount.toFixed(2)}`)
        .join('\r\n');
      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `despesas_livro_caixa_${year}_${String(month).padStart(2, '0')}_simulado.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    try {
      setDownloadingDespesas(true);
      const res = await api.get('/fiscal/export-despesas-csv', {
        params: { year, month, psychologistId },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `despesas_livro_caixa_${year}_${String(month).padStart(2, '0')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download despesas CSV:', err);
    } finally {
      setDownloadingDespesas(false);
    }
  };

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Fechamento do Mês • Exportação Oficial Carnê-Leão Web
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Competência <strong>{summary.competence.label}</strong> • {summary.psychologist.name} ({summary.psychologist.crp})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resumo da Competência */}
        <div className="mt-5 p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-[11px] font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wide">
              Resumo da Apuração Mensal
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs text-teal-950 dark:text-teal-300 font-medium">
              <span>Receitas: <strong>{formatMoney(summary.totalRevenues)}</strong></span>
              <span>•</span>
              <span>Livro-Caixa: <strong>{formatMoney(summary.totalDeductibleExpenses)}</strong></span>
              <span>•</span>
              <span>Deduções Pessoais: <strong>{formatMoney(summary.totalPersonalDeductions)}</strong></span>
            </div>
          </div>

          <div className="text-center sm:text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-teal-800 dark:text-teal-300 block">
              Previsão de DARF (Cód. 0190)
            </span>
            <span className="text-xl font-extrabold text-teal-700 dark:text-teal-300 font-mono">
              {formatMoney(summary.darf.finalDarfAmount)}
            </span>
            <span className="text-[10px] text-slate-500 block">
              Vencimento: {summary.darf.dueDateFormatted}
            </span>
          </div>
        </div>

        {/* Bloco dos 3 Arquivos de Entrega */}
        <div className="mt-6 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            1. Arquivos Homologados para Download em 1 Clique
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: Rendimentos CSV */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-teal-600" />
                    CSV de Rendimentos (e-CAC)
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
                    {summary.revenues.length} consultas
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Formatado rigorosamente com CPF do Pagador vs. Beneficiário e código de ocupação 2251-05.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadRendimentos}
                disabled={downloadingRendimentos || summary.revenues.length === 0}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{downloadingRendimentos ? 'Baixando...' : 'Baixar CSV de Rendimentos'}</span>
              </button>
            </div>

            {/* Card 2: Despesas Livro-Caixa CSV */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-purple-600" />
                    CSV de Despesas (Livro-Caixa)
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    {summary.expenses.length} lançamentos
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Contém despesas diretas, cota-parte rateada de consultório e retenções de sala mapeadas no plano da RFB.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadDespesas}
                disabled={downloadingDespesas || summary.expenses.length === 0}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{downloadingDespesas ? 'Baixando...' : 'Baixar CSV de Despesas'}</span>
              </button>
            </div>
          </div>

          {/* Card 3: Dossiê Fiscal Completo em PDF */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Dossiê / DRE Fiscal em PDF Timbrado com Selo SHA-256
              </span>
              <p className="text-[11px] text-blue-900 dark:text-blue-300 mt-0.5">
                Documento contábil formal com memória de cálculo do DARF para envio à contabilidade e guarda por 5 anos.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenDossier}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Visualizar / Imprimir Dossiê</span>
            </button>
          </div>
        </div>

        {/* Guia Visual Passo a Passo de Importação no e-CAC */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <UploadCloud className="h-4 w-4 text-teal-600" />
              2. Como Importar no Portal e-CAC da Receita Federal
            </h4>
            <a
              href="https://cav.receita.fazenda.gov.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1"
            >
              <span>Abrir Portal e-CAC</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-xs space-y-1">
              <span className="h-5 w-5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 font-bold flex items-center justify-center text-[10px] mb-1">
                1
              </span>
              <p className="font-bold text-slate-900 dark:text-white">Acesse com sua Conta gov.br</p>
              <p className="text-[11px] text-slate-500">
                Entre no Portal e-CAC da Receita Federal (nível prata ou ouro) e clique em <strong>"Meu Imposto de Renda"</strong>.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-xs space-y-1">
              <span className="h-5 w-5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 font-bold flex items-center justify-center text-[10px] mb-1">
                2
              </span>
              <p className="font-bold text-slate-900 dark:text-white">Vá em Carnê-Leão &gt; Escrituração</p>
              <p className="text-[11px] text-slate-500">
                No menu lateral esquerdo do Carnê-Leão Web, selecione <strong>"Escrituração"</strong> e depois <strong>"Importar Escrituração"</strong>.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-xs space-y-1">
              <span className="h-5 w-5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 font-bold flex items-center justify-center text-[10px] mb-1">
                3
              </span>
              <p className="font-bold text-slate-900 dark:text-white">Suba os Arquivos CSV</p>
              <p className="text-[11px] text-slate-500">
                Faça o upload do CSV de <strong>Rendimentos</strong> e depois do CSV de <strong>Despesas</strong>. Seus dados e o DARF estarão prontos!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            Concluir e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
