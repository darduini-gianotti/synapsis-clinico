import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.js';
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
} from 'lucide-react';

interface EvaluationReceiptModalProps {
  evaluationId?: number | null;
  transactionId?: number | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatClinicAddress = (addr: any) => {
  if (!addr) return '';
  let obj = addr;
  if (typeof addr === 'string') {
    try {
      obj = JSON.parse(addr);
    } catch {
      return addr;
    }
  }
  if (typeof obj !== 'object') return String(obj);
  const parts = [
    obj.street,
    obj.number ? `nº ${obj.number}` : null,
    obj.complement,
    obj.neighborhood,
    obj.city && obj.state ? `${obj.city} - ${obj.state}` : (obj.city || obj.state),
    obj.cep ? `CEP: ${obj.cep}` : null,
  ].filter(Boolean);
  return parts.join(' • ');
};

export const EvaluationReceiptModal: React.FC<EvaluationReceiptModalProps> = ({
  evaluationId,
  transactionId,
  isOpen,
  onClose,
}) => {
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || (!evaluationId && !transactionId)) return;

    const fetchReceipt = async () => {
      try {
        setIsLoading(true);
        setError(null);
        let url = '';
        if (transactionId) {
          url = `/receipts/transaction/${transactionId}`;
        } else if (evaluationId) {
          url = `/evaluations/${evaluationId}/receipt-data`;
        }

        const res = await api.get(url);
        setReceiptData(res.data.receipt);
      } catch (err: any) {
        console.error('Error fetching receipt data:', err);
        setError(err.response?.data?.error || 'Erro ao emitir dados do recibo');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReceipt();
  }, [isOpen, evaluationId, transactionId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const sheet = document.getElementById('receipt-print-container');
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
          <title>Recibo - ${receiptData?.patient?.name || 'Paciente'}</title>
          <meta charset="utf-8" />
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 15mm;
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
            #receipt-print-container {
              width: 100% !important;
              max-width: 100% !important;
              border: none !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 0 !important;
              background: transparent !important;
            }
          </style>
        </head>
        <body>
          <div id="receipt-print-container">${sheet.innerHTML}</div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 400);
  };

  const handleCopyHash = () => {
    if (receiptData?.hash_sha256) {
      navigator.clipboard.writeText(receiptData.hash_sha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[95vh] overflow-y-auto">
        {/* Actions bar (hidden in print) */}
        <div className="print:hidden flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recibo Profissional para Convênio / Reembolso
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !!error}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent mb-3" />
            <p>Gerando recibo criptografado...</p>
          </div>
        ) : error ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          /* Recibo Timbrado Imprimível */
          <div
            ref={receiptRef}
            id="receipt-print-container"
            className="mt-4 rounded-xl border border-slate-300 bg-white p-6 sm:p-8 text-slate-800 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0"
          >
            {/* Cabeçalho da Clínica */}
            <div className="border-b-2 border-slate-800 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 print:flex-row print:items-center print:justify-between">
              {/* 1) Ponta Esquerda: Logo no topo e Nome da Clínica logo abaixo (centralizados entre si) */}
              <div className="flex flex-col items-center text-center max-w-[200px] shrink-0 print:max-w-[190px]">
                {receiptData.clinic?.logo_base64 ? (
                  <img
                    src={receiptData.clinic.logo_base64}
                    alt={receiptData.clinic.clinic_name || 'Logo da Clínica'}
                    className="h-14 w-auto max-h-16 max-w-[170px] object-contain print:max-h-16 mb-1.5"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-800 border border-purple-200 mb-1.5">
                    <Building2 className="h-6 w-6 text-purple-700" />
                  </div>
                )}
                <h1 className="text-xs sm:text-[13px] font-black tracking-tight text-slate-900 uppercase leading-snug">
                  {receiptData.clinic.clinic_name}
                </h1>
              </div>

              {/* 2) Ao Centro: Informações e Endereço Completo Formatado */}
              <div className="flex-1 text-center px-2 sm:px-4 space-y-1 print:flex-1 print:text-center">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  {receiptData.receipt_type === 'SESSION'
                    ? 'Serviço Especializado de Psicologia Clínica'
                    : 'Serviço Especializado de Psicologia e Neuropsicologia'}
                </p>
                <p className="text-[10px] text-slate-600 font-medium">
                  {[
                    receiptData.clinic.cnpj ? `CNPJ: ${receiptData.clinic.cnpj}` : null,
                    receiptData.clinic.phone ? `Tel: ${receiptData.clinic.phone}` : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
                {formatClinicAddress(receiptData.clinic.address) && (
                  <p className="text-[10px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                    {formatClinicAddress(receiptData.clinic.address)}
                  </p>
                )}
                {receiptData.clinic.email && (
                  <p className="text-[10px] text-slate-500">
                    {receiptData.clinic.email}
                  </p>
                )}
              </div>

              {/* 3) Ponta Direita: Numeração em Quadro Azul */}
              <div className="flex flex-col items-center sm:items-end shrink-0 print:items-end print:text-right">
                <div className="inline-flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-blue-600 text-white shadow-xs border border-blue-700 print:bg-blue-600 print:text-white">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-blue-100">
                    Nº do Recibo
                  </span>
                  <span className="font-mono text-xs font-black tracking-wider">
                    {receiptData.receipt_number}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                  Emitido em: {new Date(receiptData.issued_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {/* Título do Documento */}
            <div className="text-center my-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">
                {receiptData.document_title || (receiptData.receipt_type === 'SESSION'
                  ? 'Recibo de Prestação de Serviços de Psicoterapia Clínica'
                  : 'Recibo de Prestação de Serviços Psicológicos / Neuropsicológicos')}
              </h2>
              <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-purple-50 border border-purple-200 px-5 py-2 text-purple-900">
                <span className="text-xs font-medium uppercase tracking-wider">Valor:</span>
                <span className="text-lg font-extrabold">
                  R$ {Number(receiptData.amount).toFixed(2)}
                </span>
                <span className="text-xs text-purple-700 font-medium">({receiptData.installment_info})</span>
              </div>
            </div>

            {/* Corpo Declaratório Legal (CFP 01/2009 & Receita Federal) */}
            <div className="space-y-4 text-xs leading-relaxed text-slate-700 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <p className="text-justify font-serif text-[13px] leading-6 text-slate-900">
                {receiptData.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                <div>
                  <span className="font-semibold text-slate-900">Paciente / Beneficiário: </span>
                  {receiptData.patient.name}
                  {receiptData.patient.cpf ? ` (CPF: ${receiptData.patient.cpf})` : ''}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Pagador / Titular: </span>
                  {receiptData.payer.name} (CPF: {receiptData.payer.cpf})
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Forma de Pagamento: </span>
                  {receiptData.payment_method}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Data de Liquidação: </span>
                  {new Date(receiptData.payment_date).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>

            {/* Assinatura Profissional */}
            <div className="mt-8 pt-4 flex flex-col items-center justify-center text-center">
              <div className="w-64 border-b border-slate-400 pb-1 font-serif text-sm font-bold text-slate-900">
                {receiptData.psychologist.name}
              </div>
              <p className="text-xs font-semibold text-slate-700 mt-1">
                {receiptData.psychologist.crp || 'Conselho Regional de Psicologia'}
              </p>
              <p className="text-[10px] text-slate-500">
                {receiptData.psychologist?.specialty || (receiptData.receipt_type === 'SESSION' ? 'Psicologia Clínica' : 'Especialista em Neuropsicologia Clínica')}
              </p>
            </div>

            {/* Selo de Autenticidade e Hash SHA-256 */}
            <div className="mt-8 pt-3 border-t border-dashed border-slate-300 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 gap-2">
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Autenticidade Verificável (Resolução CFP nº 01/2009 e 06/2019)</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[9px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <span className="text-slate-400">SHA-256:</span>
                <span>{receiptData.hash_sha256}</span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="ml-1 text-slate-400 hover:text-slate-600 print:hidden cursor-pointer"
                  title="Copiar Hash"
                >
                  {copiedHash ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
