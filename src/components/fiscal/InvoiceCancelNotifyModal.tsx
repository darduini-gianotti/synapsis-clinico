import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  MessageSquare,
  Copy,
  Check,
  Building2,
  Phone,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../services/api.js';

export const DEFAULT_INVOICE_CANCEL_TEMPLATE = `Olá, *{contabilidade}*! Tudo bem?

Gostaríamos de solicitar o *CANCELAMENTO IMEDIATO* da solicitação de emissão de Nota Fiscal (NFS-e) referente ao paciente abaixo:

👤 *Paciente:* {paciente}
💰 *Valor Total:* R$ {valor}
📅 *Data da Solicitação:* {data_solicitacao}
⚠️ *Motivo:* {motivo}

Favor desconsiderar a emissão deste documento junto à Prefeitura Municipal. Qualquer dúvida, estamos à disposição!`;

export interface InvoiceCancelNotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  totalAmount: number;
  requestDate?: string;
  reason?: string;
  accountingInfo?: {
    officeName?: string;
    phone?: string;
    email?: string;
    messageTemplateCancel?: string;
  } | null;
}

export const InvoiceCancelNotifyModal: React.FC<InvoiceCancelNotifyModalProps> = ({
  isOpen,
  onClose,
  patientName,
  totalAmount,
  requestDate,
  reason = 'Pagamento estornado/revertido no sistema financeiro da clínica.',
  accountingInfo: initialAccountingInfo,
}) => {
  const [accounting, setAccounting] = useState<any>(initialAccountingInfo || null);
  const [isLoadingAccounting, setIsLoadingAccounting] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [copied, setCopied] = useState(false);

  // Carregar dados contábeis caso não venham preenchidos por prop
  useEffect(() => {
    if (!isOpen) return;

    if (initialAccountingInfo) {
      setAccounting(initialAccountingInfo);
    } else {
      let isMounted = true;
      setIsLoadingAccounting(true);
      api.get('/settings/accounting')
        .then((res) => {
          if (isMounted && res.data?.accounting) {
            setAccounting(res.data.accounting);
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar dados da contabilidade:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingAccounting(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, initialAccountingInfo]);

  // Montar texto da mensagem substituindo variáveis dinâmicas
  useEffect(() => {
    if (!isOpen) return;

    const office = accounting?.officeName || 'Contabilidade';
    const rawTemplate =
      accounting?.messageTemplateCancel ||
      DEFAULT_INVOICE_CANCEL_TEMPLATE;

    const formattedDate = requestDate
      ? new Date(requestDate).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');

    const formattedAmount = Number(totalAmount || 0).toFixed(2);

    const generated = rawTemplate
      .replace(/{contabilidade}/g, office)
      .replace(/{paciente}/g, patientName || 'Paciente')
      .replace(/{valor}/g, formattedAmount)
      .replace(/{data_solicitacao}/g, formattedDate)
      .replace(/{motivo}/g, reason);

    setMessageText(generated);
  }, [isOpen, accounting, patientName, totalAmount, requestDate, reason]);

  const cleanPhone = useMemo(() => {
    const p = accounting?.phone;
    if (!p) return '';
    const digits = p.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 11) return `55${digits}`;
    return digits;
  }, [accounting?.phone]);

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    const encoded = encodeURIComponent(messageText);
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;

    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      window.location.href = url;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header com identidade WhatsApp + Alerta Fiscal */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Aviso para Contabilidade
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  Cancelamento NF
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Notifique seu contador para abortar a emissão na Prefeitura.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Card de Contato da Contabilidade */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                  {accounting?.officeName || 'Escritório de Contabilidade'}
                </p>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span>{accounting?.phone || 'Telefone não cadastrado'}</span>
                </div>
              </div>
            </div>

            {cleanPhone ? (
              <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[10px] shrink-0">
                WhatsApp Pronto
              </span>
            ) : (
              <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold text-[10px] shrink-0">
                Sem WhatsApp
              </span>
            )}
          </div>

          {!cleanPhone && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Nenhum telefone de WhatsApp foi cadastrado em <strong>Configurações &gt; Contabilidade &amp; NF</strong>. Você ainda pode usar o botão <strong>Copiar Mensagem</strong> para colar no e-mail ou chat com seu contador.
              </p>
            </div>
          )}

          {/* Área de visualização/edição da mensagem */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>Mensagem Pronta para Envio:</span>
                <span className="text-[10px] text-slate-400 font-normal">(Você pode editar antes de enviar)</span>
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar Texto</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              rows={8}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-xs text-slate-800 dark:text-slate-200 font-mono leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden resize-y"
            />
          </div>
        </div>

        {/* Footer com botões de ação */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            Agora Não / Concluir
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-xs"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-500" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-600/20 active:scale-[0.98]"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Enviar via WhatsApp</span>
              <ExternalLink className="h-3 w-3 opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
