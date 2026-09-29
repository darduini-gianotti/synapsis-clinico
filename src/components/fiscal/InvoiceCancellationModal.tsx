import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  FileText,
  Send,
  Copy,
  Check,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Receipt,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../services/api.js';

export interface InvoiceCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: any;
  mode: 'REQUEST' | 'COMPLETE';
}

const CANCELLATION_REASONS = [
  {
    code: 'ERRO_TOMADOR',
    label: 'Erro nos dados do Tomador (CPF, Nome, Endereço ou Convênio)',
    description: 'A nota foi emitida com dados cadastrais divergentes do pagador/convênio.',
  },
  {
    code: 'DUPLICIDADE',
    label: 'Emissão em Duplicidade',
    description: 'Foi gerada mais de uma nota fiscal para o mesmo atendimento clínico.',
  },
  {
    code: 'SERVICO_NAO_PRESTADO',
    label: 'Desistência / Não comparecimento (Serviço não prestado / Distrato)',
    description: 'O paciente desmarcou, não compareceu ou o pacote foi rescindido.',
  },
  {
    code: 'ERRO_VALOR',
    label: 'Erro de Digitação nos Valores ou Honorários',
    description: 'O valor lançado não corresponde ao honorário acordado com o paciente.',
  },
  {
    code: 'OUTRO',
    label: 'Outro Motivo Legal',
    description: 'Justificativa administrativa específica informada abaixo.',
  },
];

export const InvoiceCancellationModal: React.FC<InvoiceCancellationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  invoice,
  mode,
}) => {
  const [reasonCode, setReasonCode] = useState('ERRO_TOMADOR');
  const [customJustification, setCustomJustification] = useState('');
  const [accounting, setAccounting] = useState<any>(null);
  const [isLoadingAccounting, setIsLoadingAccounting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // States para o Modo COMPLETE
  const [protocolNumber, setProtocolNumber] = useState('');
  const [resolutionType, setResolutionType] = useState<'KEEP_AND_RELEASE' | 'ADJUST_PRICE' | 'REFUND_ZERO'>('KEEP_AND_RELEASE');
  const [adjustedPrice, setAdjustedPrice] = useState<number>(Number(invoice?.total_amount || 0));

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setCopied(false);
    setIsSubmitting(false);

    setIsLoadingAccounting(true);
    api.get('/settings/accounting')
      .then((res) => {
        if (res.data?.accounting) {
          setAccounting(res.data.accounting);
        }
      })
      .catch((err) => console.error('Erro ao carregar configurações contábeis:', err))
      .finally(() => setIsLoadingAccounting(false));
  }, [isOpen]);

  // Mensagem estruturada para o WhatsApp do contador
  const generatedMessage = useMemo(() => {
    if (!invoice) return '';
    const office = accounting?.officeName || 'Contabilidade';
    const reasonObj = CANCELLATION_REASONS.find(r => r.code === reasonCode);
    const reasonText = reasonObj ? reasonObj.label : 'Motivo não especificado';
    const detail = customJustification.trim() ? `\n📝 *Detalhes:* ${customJustification.trim()}` : '';
    const invoiceNum = invoice.invoice_number ? `#${invoice.invoice_number}` : `ID ${invoice.id}`;
    const formattedAmount = Number(invoice.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formattedDate = invoice.issued_at
      ? new Date(invoice.issued_at).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');

    return `Olá, *${office}*! Tudo bem?

Gostaríamos de solicitar o *CANCELAMENTO FORMAL JUNTO À PREFEITURA* da seguinte Nota Fiscal emitida:

📄 *Nota Fiscal:* NFS-e ${invoiceNum}
📅 *Data de Emissão:* ${formattedDate}
👤 *Tomador/Paciente:* ${invoice.patient_name || 'Paciente'} (CPF: ${invoice.patient_cpf || 'Não informado'})
💰 *Valor:* ${formattedAmount}
⚠️ *Motivo Legal:* ${reasonText}${detail}

Por favor, proceda com o cancelamento perante o portal municipal e nos informe o número de protocolo da baixa para os nossos registros.

Qualquer dúvida, estamos à disposição!`;
  }, [invoice, accounting, reasonCode, customJustification]);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    handleCopyMessage();
    const phone = accounting?.phone ? accounting.phone.replace(/\D/g, '') : '';
    const textEncoded = encodeURIComponent(generatedMessage);
    if (phone) {
      window.open(`https://api.whatsapp.com/send?phone=55${phone}&text=${textEncoded}`, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${textEncoded}`, '_blank');
    }
  };

  // Submissão da Etapa 1: Solicitar Cancelamento
  const handleRequestCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const selectedReasonObj = CANCELLATION_REASONS.find(r => r.code === reasonCode);
      const reasonLabel = selectedReasonObj ? selectedReasonObj.label : reasonCode;

      await api.post(`/invoices/${invoice.id}/request-cancellation`, {
        reason_code: reasonCode,
        reason_description: reasonLabel,
        custom_notes: customJustification.trim(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting cancellation request:', err);
      setErrorMessage(err.response?.data?.error || 'Erro ao registrar solicitação de cancelamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submissão da Etapa 2: Confirmar Baixa Efetivada
  const handleConfirmCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const adjustedPricesMap: Record<number, number> = {};
      if (resolutionType === 'ADJUST_PRICE' && invoice.items) {
        // Aplica proporção ou valor ajustado
        for (const item of invoice.items) {
          if (item.session_id) adjustedPricesMap[item.session_id] = adjustedPrice;
          if (item.transaction_id) adjustedPricesMap[item.transaction_id] = adjustedPrice;
        }
      }

      await api.post(`/invoices/${invoice.id}/confirm-cancellation`, {
        resolution_type: resolutionType,
        adjusted_prices: adjustedPricesMap,
        cancellation_protocol: protocolNumber.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error confirming cancellation:', err);
      setErrorMessage(err.response?.data?.error || 'Erro ao confirmar cancelamento da nota fiscal');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              mode === 'COMPLETE'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}>
              {mode === 'COMPLETE' ? <CheckCircle2 className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {mode === 'COMPLETE'
                    ? 'Confirmar Baixa da Nota Fiscal na Prefeitura'
                    : 'Solicitar Cancelamento de NFS-e à Contabilidade'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  mode === 'COMPLETE'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {mode === 'COMPLETE' ? 'Etapa 2 de 2 • Conclusão' : 'Etapa 1 de 2 • Solicitação'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                NFS-e {invoice.invoice_number ? `#${invoice.invoice_number}` : `ID ${invoice.id}`} • Paciente: <strong>{invoice.patient_name}</strong> • Valor: <strong>{Number(invoice.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'REQUEST' ? (
            /* ========================================================================= */
            /* MODO 1: SOLICITAÇÃO DE CANCELAMENTO AO CONTADOR VIA WHATSAPP             */
            /* ========================================================================= */
            <form id="form-cancel-request" onSubmit={handleRequestCancellation} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Procedimento Fiscal Conduzido pelo Escritório de Contabilidade
                </span>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                  Por exigência tributária municipal, a nota emitida deve ser cancelada diretamente perante a Prefeitura pelo seu contador parceiro para anulação do débito de ISS e exclusão do DAS do Simples Nacional.
                </p>
              </div>

              {/* Seletor do Motivo Legal */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Motivo Fiscal do Cancelamento *
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-amber-500"
                  required
                >
                  {CANCELLATION_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400">
                  {CANCELLATION_REASONS.find(r => r.code === reasonCode)?.description}
                </span>
              </div>

              {/* Justificativa Complementar */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Justificativa Complementar / Observações
                </label>
                <textarea
                  rows={2}
                  value={customJustification}
                  onChange={(e) => setCustomJustification(e.target.value)}
                  placeholder="Ex: Paciente solicitou emissão no CPF da mãe (convênio médico exige titular do plano)."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Dossiê Formatado para WhatsApp */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-emerald-500" />
                    Dossiê Pré-formatado para Envio ao Contador
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenWhatsApp}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-extrabold bg-[#25D366] text-white hover:bg-[#20bd5a] shadow-xs transition cursor-pointer"
                    >
                      <Send className="h-3 w-3" />
                      <span>Abrir WhatsApp do Contador</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                  {generatedMessage}
                </div>
              </div>
            </form>
          ) : (
            /* ========================================================================= */
            /* MODO 2: CONFIRMAÇÃO DA BAIXA CONCLUÍDA PELO CONTADOR                    */
            /* ========================================================================= */
            <form id="form-cancel-complete" onSubmit={handleConfirmCancellation} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirmação da Baixa Fiscal Efetivada
                </span>
                <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300">
                  O contador parceiro confirmou que a NFS-e foi cancelada perante a Prefeitura Municipal. Defina abaixo o destino financeiro dos atendimentos cobertos por esta nota.
                </p>
              </div>

              {/* Protocolo da Prefeitura */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Protocolo / Chave de Cancelamento da Prefeitura (Opcional)
                </label>
                <input
                  type="text"
                  value={protocolNumber}
                  onChange={(e) => setProtocolNumber(e.target.value)}
                  placeholder="Ex: PROT-2026-998877 ou Nº da anulação municipal"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Destino Financeiro dos Lançamentos */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="font-bold text-slate-800 dark:text-white block">
                  Destino Financeiro das Sessões / Parcelas Vinculadas:
                </label>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Opção 1: Liberar para Reemissão (Mesmo Valor) */}
                  <label className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                    resolutionType === 'KEEP_AND_RELEASE'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}>
                    <input
                      type="radio"
                      name="resolutionType"
                      checked={resolutionType === 'KEEP_AND_RELEASE'}
                      onChange={() => setResolutionType('KEEP_AND_RELEASE')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Liberar para Emissão de Nova Nota Fiscal (Recomendado)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Mantém o pagamento registrado no financeiro e libera os atendimentos para solicitar uma nova NFS-e corrigida (ex: alteração de CPF do titular ou convênio).
                      </span>
                    </div>
                  </label>

                  {/* Opção 2: Ajustar Valor */}
                  <label className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                    resolutionType === 'ADJUST_PRICE'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}>
                    <input
                      type="radio"
                      name="resolutionType"
                      checked={resolutionType === 'ADJUST_PRICE'}
                      onChange={() => setResolutionType('ADJUST_PRICE')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Corrigir Valor dos Honorários antes de Reemitir
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-2">
                        Ajusta o valor cobrado do paciente (ex: aplicação de desconto retroativo) e libera para emitir nova nota com o valor corrigido.
                      </span>

                      {resolutionType === 'ADJUST_PRICE' && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Novo Valor (R$):</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={adjustedPrice}
                            onChange={(e) => setAdjustedPrice(parseFloat(e.target.value) || 0)}
                            className="w-32 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Opção 3: Zerar Cobrança / Estorno */}
                  <label className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                    resolutionType === 'REFUND_ZERO'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}>
                    <input
                      type="radio"
                      name="resolutionType"
                      checked={resolutionType === 'REFUND_ZERO'}
                      onChange={() => setResolutionType('REFUND_ZERO')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Zerar Cobrança / Estorno do Atendimento
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        O atendimento não foi realizado ou o dinheiro foi devolvido ao paciente. O valor é zerado e não gera pendência tributária.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition cursor-pointer"
          >
            Voltar / Fechar
          </button>

          {mode === 'REQUEST' ? (
            <button
              type="submit"
              form="form-cancel-request"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              <span>Registrar Solicitação Enviada</span>
            </button>
          ) : (
            <button
              type="submit"
              form="form-cancel-complete"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>Confirmar Baixa Definitiva</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
