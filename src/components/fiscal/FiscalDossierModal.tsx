import React, { useRef, useState } from 'react';
import { FiscalDossier } from '../../types.js';
import {
  FileText,
  X,
  Printer,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  User,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface FiscalDossierModalProps {
  dossier: FiscalDossier | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FiscalDossierModal: React.FC<FiscalDossierModalProps> = ({
  dossier,
  isOpen,
  onClose,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !dossier) return null;

  const handleCopyHash = () => {
    if (dossier.verification?.hashSha256) {
      navigator.clipboard.writeText(dossier.verification.hashSha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handlePrint = () => {
    const sheet = document.getElementById('fiscal-dossier-print-container');
    if (!sheet) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((s) => s.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dossiê Fiscal Carnê-Leão - ${dossier.psychologist.name} (${dossier.competence.label})</title>
          <meta charset="utf-8" />
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            }
            #fiscal-dossier-print-container {
              width: 100% !important;
              display: block !important;
            }
          </style>
        </head>
        <body>
          ${sheet.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 350);
  };

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
        {/* Header Modal Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Dossiê Fiscal & Livro-Caixa Digital (DARF 0190)
                <span className="text-xs px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 font-semibold font-mono">
                  {dossier.competence.label}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Documento de escrituração oficial e guarda probatória por 5 anos (RIR/2018 e IN RFB 1.500/2014)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper View */}
        <div
          ref={printContainerRef}
          id="fiscal-dossier-print-container"
          className="mt-6 rounded-xl border border-slate-300 bg-white p-6 sm:p-8 text-slate-900 shadow-xs print:border-none print:shadow-none print:p-0 print:m-0"
        >
          {/* Top Timbre */}
          <div className="border-b-2 border-slate-800 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {dossier.clinic.logo ? (
                <img
                  src={dossier.clinic.logo}
                  alt={dossier.clinic.name}
                  className="h-14 w-auto max-h-16 object-contain"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-lg border border-teal-200">
                  <Building2 className="h-6 w-6 text-teal-700" />
                </div>
              )}
              <div>
                <h1 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-snug">
                  {dossier.clinic.name}
                </h1>
                <p className="text-[11px] text-slate-600">
                  CNPJ: {dossier.clinic.cnpj} • {dossier.clinic.phone}
                </p>
                <p className="text-[10px] text-slate-500">
                  {dossier.clinic.address}
                </p>
              </div>
            </div>

            <div className="text-center sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0">
              <div className="inline-flex flex-col items-center sm:items-end px-3 py-1.5 rounded-lg bg-slate-900 text-white">
                <span className="text-[9px] uppercase font-semibold text-slate-300">Competência Fiscal</span>
                <span className="text-sm font-mono font-black">{dossier.competence.label}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">
                Vencimento DARF: <strong>{dossier.darf.dueDateFormatted}</strong>
              </p>
            </div>
          </div>

          {/* Identificação do Profissional */}
          <div className="my-4 p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-500 font-semibold text-[10px] uppercase block">Profissional Autônomo:</span>
              <span className="font-bold text-slate-900">{dossier.psychologist.name}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold text-[10px] uppercase block">Inscrição Profissional:</span>
              <span className="font-mono font-bold text-slate-800">{dossier.psychologist.crp}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold text-[10px] uppercase block">CPF do Titular:</span>
              <span className="font-mono font-bold text-slate-800">{dossier.psychologist.cpf}</span>
            </div>
          </div>

          {/* DRE Mini Resumo */}
          <div className="my-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">(+) Receitas Brutas</span>
              <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                {formatMoney(dossier.totalRevenues)}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">{dossier.revenues.length} consulta(s)</span>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-[10px] uppercase font-bold text-rose-800 block">(-) Despesas Livro-Caixa</span>
              <span className="text-base sm:text-lg font-black text-rose-700 font-mono">
                {formatMoney(dossier.totalDeductibleExpenses)}
              </span>
              <span className="text-[10px] text-rose-600 block mt-0.5">{dossier.expenses.length} item(ns) dedutíveis</span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[10px] uppercase font-bold text-blue-800 block">(-) Deduções Pessoais</span>
              <span className="text-base sm:text-lg font-black text-blue-700 font-mono">
                {formatMoney(dossier.totalPersonalDeductions)}
              </span>
              <span className="text-[10px] text-blue-600 block mt-0.5">INSS + Dependentes</span>
            </div>

            <div className="p-3 rounded-xl bg-teal-50 border border-teal-200">
              <span className="text-[10px] uppercase font-bold text-teal-800 block">(=) Base de Cálculo IRPF</span>
              <span className="text-base sm:text-lg font-black text-teal-800 font-mono">
                {formatMoney(dossier.taxBase)}
              </span>
              <span className="text-[10px] text-teal-600 block mt-0.5">Tributável no Mês</span>
            </div>
          </div>

          {/* Quadro de Apuração do DARF 0190 */}
          <div className="p-4 rounded-xl border-2 border-teal-600 bg-teal-50/50 my-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900 block">
                  Demonstrativo do Imposto de Renda Mensal (Código Receita 0190 - Carnê-Leão)
                </span>
                <p className="text-xs text-slate-700 mt-1">
                  Alíquota efetiva: <strong>{dossier.darf.aliquotPercent.toFixed(1)}%</strong> • Parcela a deduzir: <strong>{formatMoney(dossier.darf.deductionParcel)}</strong>
                </p>
                {dossier.carriedOverDeficitFromPreviousMonths > 0 && (
                  <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                    * Inclui {formatMoney(dossier.carriedOverDeficitFromPreviousMonths)} de saldo negativo do Livro-Caixa transportado de meses anteriores do mesmo ano civil.
                  </p>
                )}
                {dossier.darf.isBelowMinThreshold && (
                  <p className="text-[11px] text-rose-700 font-bold mt-0.5">
                    * {dossier.darf.notes}
                  </p>
                )}
              </div>

              <div className="text-center sm:text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-teal-900 block">Valor Final do DARF</span>
                <span className="text-2xl font-black text-teal-800 font-mono">
                  {formatMoney(dossier.darf.finalDarfAmount)}
                </span>
                <span className="text-[10px] text-slate-600 block font-medium">
                  Vencimento: {dossier.darf.dueDateFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Relação de Receitas do Mês */}
          <div className="mt-5">
            <h4 className="text-xs font-bold uppercase text-slate-700 pb-1 border-b border-slate-200 flex items-center justify-between">
              <span>1. Rendimentos de Prestação de Serviços a Pessoas Físicas (Receitas)</span>
              <span className="text-[10px] font-normal text-slate-500">
                Total: {formatMoney(dossier.totalRevenues)}
              </span>
            </h4>

            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100 font-semibold text-slate-600">
                  <tr>
                    <th className="py-1.5 px-2">Data</th>
                    <th className="py-1.5 px-2">Paciente / Beneficiário</th>
                    <th className="py-1.5 px-2">CPF Beneficiário</th>
                    <th className="py-1.5 px-2">Pagador / Titular</th>
                    <th className="py-1.5 px-2">CPF Pagador</th>
                    <th className="py-1.5 px-2 text-right">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dossier.revenues.map((r) => (
                    <tr key={r.id}>
                      <td className="py-1.5 px-2 whitespace-nowrap text-slate-600">{r.date}</td>
                      <td className="py-1.5 px-2 font-medium text-slate-900">{r.patientName}</td>
                      <td className="py-1.5 px-2 font-mono text-slate-600">{r.patientCpf}</td>
                      <td className="py-1.5 px-2 text-slate-800">{r.payerName}</td>
                      <td className="py-1.5 px-2 font-mono text-slate-600">{r.payerCpf}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-emerald-700">{formatMoney(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Relação de Despesas do Livro-Caixa */}
          <div className="mt-5">
            <h4 className="text-xs font-bold uppercase text-slate-700 pb-1 border-b border-slate-200 flex items-center justify-between">
              <span>2. Despesas Dedutíveis Escrituradas no Livro-Caixa Digital</span>
              <span className="text-[10px] font-normal text-slate-500">
                Total Dedutível: {formatMoney(dossier.totalDeductibleExpenses)}
              </span>
            </h4>

            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100 font-semibold text-slate-600">
                  <tr>
                    <th className="py-1.5 px-2">Data</th>
                    <th className="py-1.5 px-2">Descrição da Despesa</th>
                    <th className="py-1.5 px-2">Enquadramento / Conta RFB</th>
                    <th className="py-1.5 px-2">Origem / Rateio</th>
                    <th className="py-1.5 px-2 text-right">Valor Deduzido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dossier.expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="py-1.5 px-2 whitespace-nowrap text-slate-600">{e.date}</td>
                      <td className="py-1.5 px-2 font-medium text-slate-900">{e.title}</td>
                      <td className="py-1.5 px-2 text-slate-600 font-mono text-[10px]">{e.rfbAccountCode}</td>
                      <td className="py-1.5 px-2">
                        {e.origin === 'SHARED' ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                            Compartilhada ({e.splitPercent.toFixed(0)}%)
                          </span>
                        ) : e.origin === 'SUBLOCACAO_CLINICA' ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-semibold">
                            Taxa de Sala / Coworking
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                            Individual
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-rose-700">{formatMoney(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selo Criptográfico e Termos Legais */}
          <div className="mt-8 pt-4 border-t border-dashed border-slate-300">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-slate-500">
              <div className="flex items-center gap-1.5 text-teal-800 font-medium">
                <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0" />
                <span>Autenticidade Fiscal Criptografada (Art. 75 do RIR/2018 e IN RFB 1.500/2014)</span>
              </div>

              <div className="flex items-center gap-1 font-mono text-[9px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <span className="text-slate-400">Hash SHA-256:</span>
                <span>{dossier.verification.hashSha256}</span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="ml-1 text-slate-400 hover:text-slate-700 print:hidden cursor-pointer"
                  title="Copiar Hash"
                >
                  {copiedHash ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>

            <p className="mt-2 text-[9px] text-slate-400 text-justify leading-relaxed">
              {dossier.verification.legalTerms}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
