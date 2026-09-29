import React, { useState } from 'react';
import {
  CreditCard, QrCode, Copy, Check, ShieldCheck, Download,
  Receipt, FileCheck, AlertCircle, X, Sparkles, Clock
} from 'lucide-react';

interface PatientFinancialTabProps {
  financialData: {
    pending: any[];
    paid: any[];
    totalPending: number;
    clinicPix: any;
  };
  onRefresh: () => void;
}

export const PatientFinancialTab: React.FC<PatientFinancialTabProps> = ({ financialData, onRefresh }) => {
  const [filter, setFilter] = useState<'PENDING' | 'PAID'>('PENDING');
  const [selectedPixPayment, setSelectedPixPayment] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);

  const pendingList = financialData?.pending || [];
  const paidList = financialData?.paid || [];
  const clinicPix = financialData?.clinicPix || {};

  const handleCopyPix = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-4 pb-8 animate-fade-in">
      
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white">Financeiro & PIX</h2>
          <p className="text-xs text-slate-500">Pagamentos instantâneos e recibos para IRPF</p>
        </div>

        <div className="flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'PENDING'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Pendentes ({pendingList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('PAID')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'PAID'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Quitadas ({paidList.length})
          </button>
        </div>
      </div>

      {/* Card Resumo de Saldo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
            A Pagar
          </span>
          <span className="text-xl font-black text-amber-900 dark:text-amber-100 mt-1 block">
            R$ {Number(financialData?.totalPending || 0).toFixed(2).replace('.', ',')}
          </span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5">
            {pendingList.length} fatura(s) em aberto
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
            Quitadas no Ano
          </span>
          <span className="text-xl font-black text-emerald-900 dark:text-emerald-100 mt-1 block">
            R$ {paidList.reduce((acc, c) => acc + Number(c.amount || 0), 0).toFixed(2).replace('.', ',')}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
            {paidList.length} recibos disponíveis
          </span>
        </div>
      </div>

      {/* LISTAGEM: PENDENTES */}
      {filter === 'PENDING' && (
        <div className="space-y-3">
          {pendingList.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-slate-800 dark:text-white text-sm">Tudo em dia!</h4>
              <p className="text-xs text-slate-500">Você não possui faturas pendentes no momento.</p>
            </div>
          ) : (
            pendingList.map((item: any) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                      Sessão de Psicoterapia
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold">
                      Aguardando PIX
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data: {formatDate(item.transaction_date || item.start_time)}
                  </p>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-1">
                    R$ {Number(item.amount).toFixed(2).replace('.', ',')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPixPayment(item)}
                  className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Pagar PIX</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* LISTAGEM: QUITADAS & RECIBOS IRPF */}
      {filter === 'PAID' && (
        <div className="space-y-3">
          {paidList.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <Receipt className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Nenhum pagamento registrado</h4>
              <p className="text-xs text-slate-500">Seus comprovantes e recibos de IRPF ficarão salvos aqui.</p>
            </div>
          ) : (
            paidList.map((item: any) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                      Sessão de Psicoterapia
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Pago</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data da Sessão: {formatDate(item.transaction_date || item.start_time)}
                  </p>
                  <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">
                    R$ {Number(item.amount).toFixed(2).replace('.', ',')}
                  </p>
                  {item.invoice_number && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 text-[10px] font-bold">
                      NFSe #{item.invoice_number}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setViewingReceipt(item)}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Recibo IRPF</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL PIX COPIA E COLA & QR CODE DINÂMICO */}
      {selectedPixPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                <span>Pagar com PIX</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPixPayment(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Valor da Consulta</span>
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                R$ {Number(selectedPixPayment.amount).toFixed(2).replace('.', ',')}
              </div>
              <p className="text-xs text-slate-400">
                Beneficiário: <strong>{clinicPix.pix_beneficiary || clinicPix.clinic_name || 'Clínica PsicoGestão'}</strong>
              </p>
            </div>

            {/* QR Code Ilustrado Dinâmico */}
            <div className="p-4 rounded-2xl bg-white border-2 border-indigo-100 dark:border-indigo-900/40 inline-block shadow-inner mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(selectedPixPayment.pixCopyPaste)}`}
                alt="QR Code PIX"
                className="w-44 h-44 mx-auto rounded-lg"
              />
            </div>

            {/* Botão Copiar Código PIX */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleCopyPix(selectedPixPayment.pixCopyPaste)}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Código PIX Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Chave Copia e Cola</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-400">
                Abra o aplicativo do seu banco, escolha <strong>PIX Copia e Cola</strong> e confirme a transferência.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>A confirmação é imediata no sistema da clínica</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECIBO TIMBRADO PARA IRPF */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-slate-800 dark:text-white">
                  Recibo de Atendimento Psicológico
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 text-xs text-slate-700 dark:text-slate-300 space-y-2 border border-slate-200 dark:border-slate-800 leading-relaxed font-mono">
              <p className="font-bold text-center border-b pb-2 text-slate-900 dark:text-white">
                {clinicPix.clinic_name || 'CLÍNICA DE PSICOLOGIA SYNAPSIS'}
              </p>
              <p><strong>Recibo Nº:</strong> REC-2026-00{viewingReceipt.id}</p>
              <p><strong>Valor:</strong> R$ {Number(viewingReceipt.amount).toFixed(2).replace('.', ',')}</p>
              <p><strong>Data da Sessão:</strong> {formatDate(viewingReceipt.transaction_date)}</p>
              <p><strong>Serviço:</strong> Sessão de Avaliação / Atendimento Psicológico Clínico</p>
              <p><strong>Status:</strong> Efetivamente Quitado via PIX</p>
              <p className="pt-2 border-t text-[11px] text-slate-500">
                Documento emitido para fins de comprovação junto à Receita Federal (Declaração de IRPF / DMED).
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Imprimir / Salvar PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
