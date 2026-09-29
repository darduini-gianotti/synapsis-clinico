import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import {
  X,
  CheckCircle2,
  FileCheck,
  Upload,
  AlertCircle,
  Calendar,
  Hash,
  FileText,
  Send,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { WhatsAppRecipientSelector } from './whatsapp/WhatsAppRecipientSelector';
import {
  resolveAvailableRecipients,
  getDefaultRecipientType,
  WhatsAppRecipientType,
  cleanWhatsAppPhone,
  buildWhatsAppLink,
} from '../utils/whatsappRouting';

interface InvoiceCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: {
    id: number;
    patient_id: number;
    patient_name: string;
    patient_phone?: string;
    total_amount: number;
    invoice_number?: string;
    requested_at: string;
  } | null;
}

export const InvoiceCompleteModal: React.FC<InvoiceCompleteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  invoice,
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado de Sucesso / Envio ao Paciente pós-conclusão
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedData, setCompletedData] = useState<{
    invoiceNumber: string;
    issuedAt: string;
  } | null>(null);

  const [patientData, setPatientData] = useState<any | null>(null);
  const [selectedRecipientType, setSelectedRecipientType] = useState<WhatsAppRecipientType>('PATIENT');

  useEffect(() => {
    if (isOpen && invoice) {
      setInvoiceNumber(invoice.invoice_number || '');
      setIssuedAt(new Date().toISOString().split('T')[0]);
      setNotes('');
      setSelectedFile(null);
      setFileBase64(null);
      setError(null);
      setIsCompleted(false);
      setCompletedData(null);

      // Carregar dados completos do paciente para suporte a responsáveis
      api.get(`/patients/${invoice.patient_id}`)
        .then((res) => {
          const p = res.data.patient;
          setPatientData(p);
          const def = getDefaultRecipientType(p, 'INVOICE');
          setSelectedRecipientType(def);
        })
        .catch((err) => {
          console.warn('Não foi possível carregar detalhes do paciente para roteamento:', err);
        });
    }
  }, [isOpen, invoice]);

  const modalRecipients = React.useMemo(() => {
    if (!patientData) {
      const pPhone = invoice?.patient_phone || '';
      const pClean = cleanWhatsAppPhone(pPhone);
      return [
        {
          type: 'PATIENT' as WhatsAppRecipientType,
          label: 'Paciente',
          fullName: invoice?.patient_name || 'Paciente',
          phone: pPhone,
          cleanPhone: pClean,
          hasPhone: Boolean(pClean && pClean.length >= 10),
        },
      ];
    }
    return resolveAvailableRecipients(patientData, 'INVOICE');
  }, [patientData, invoice]);

  const activeRecipient = React.useMemo(() => {
    return modalRecipients.find((r) => r.type === selectedRecipientType) || modalRecipients[0];
  }, [modalRecipients, selectedRecipientType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setError('Por favor, selecione um arquivo no formato PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('O arquivo deve ter no máximo 10MB.');
      return;
    }

    setError(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.onerror = () => {
      setError('Falha ao ler o arquivo PDF.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    if (!invoiceNumber.trim()) {
      setError('Informe o número da Nota Fiscal.');
      return;
    }

    if (!issuedAt) {
      setError('Informe a data de emissão da NF.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const payload = {
        invoice_number: invoiceNumber.trim(),
        issued_at: issuedAt,
        notes: notes.trim(),
        file_name: selectedFile?.name || `NF_${invoiceNumber.trim()}.pdf`,
        file_size: selectedFile?.size || 0,
        file_type: selectedFile?.type || 'application/pdf',
        file_data: fileBase64,
      };

      await api.post(`/invoices/${invoice.id}/complete`, payload);

      setCompletedData({
        invoiceNumber: invoiceNumber.trim(),
        issuedAt,
      });
      setIsCompleted(true);
      onSuccess();
    } catch (err: any) {
      console.error('Error completing invoice:', err);
      setError(err.response?.data?.error || 'Erro ao registrar emissão da NF.');
    } finally {
      setIsUploading(false);
    }
  };

  const cleanPhone = (phoneRaw?: string) => {
    let clean = (phoneRaw || '').replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length === 10 || clean.length === 11) {
      clean = '55' + clean;
    }
    return clean;
  };

  const handleSendToPatientWhatsApp = () => {
    if (!invoice || !completedData) return;

    const formattedDate = new Date(completedData.issuedAt + 'T12:00:00').toLocaleDateString('pt-BR');
    const totalStr = Number(invoice.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const isGuardian = activeRecipient?.type === 'GUARDIAN' || activeRecipient?.type === 'FINANCIAL_RESPONSIBLE';
    const recipientFirstName = activeRecipient?.fullName ? activeRecipient.fullName.split(' ')[0] : invoice.patient_name.split(' ')[0];

    const greeting = `Olá, *${recipientFirstName}*! Tudo bem? Esperamos que sim! 😊`;
    const context = isGuardian
      ? `Passando para compartilhar a confirmação de emissão da *Nota Fiscal de Prestação de Serviços de Psicoterapia* referente aos atendimentos de *${invoice.patient_name}*:`
      : `Passando para compartilhar a confirmação de emissão da sua *Nota Fiscal de Prestação de Serviços de Psicoterapia*:`;

    const message = `${greeting}

${context}

📄 *Nota Fiscal Eletrônica:* Nº ${completedData.invoiceNumber}
🗓️ *Data de Emissão:* ${formattedDate}
💰 *Valor Total:* R$ ${totalStr}

O documento oficial foi emitido com sucesso pela nossa contabilidade e já está devidamente arquivado no prontuário clínico.

Se você precisar do arquivo em PDF para solicitar o reembolso junto ao plano de saúde ou para fins de declaração, por favor nos avise que encaminhamos diretamente por aqui!

Qualquer dúvida estamos à disposição!`;

    const targetPhone = activeRecipient?.cleanPhone || cleanPhone(invoice.patient_phone);
    const url = buildWhatsAppLink(targetPhone, message);

    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.href = url;
    }
  };

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isCompleted ? 'NF Concluída com Sucesso!' : 'Anotar Emissão de Nota Fiscal'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paciente: <strong className="text-slate-700 dark:text-slate-200">{invoice.patient_name}</strong> • R$ {Number(invoice.total_amount).toFixed(2)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isCompleted ? (
          /* Estado pós-sucesso com opção de envio ao paciente */
          <div className="py-6 space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Nota Fiscal nº {completedData?.invoiceNumber} Registrada!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                O arquivo PDF foi anexado à pasta de <strong>Documentos do Paciente</strong> e o status foi atualizado para <strong>Emitida</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-left space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <MessageSquare className="h-4 w-4" />
                <span>Próximo passo recomendado:</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Notifique sobre a emissão da nota fiscal para facilitar o pedido de reembolso no convênio:
              </p>

              <WhatsAppRecipientSelector
                recipients={modalRecipients}
                selectedType={selectedRecipientType}
                onSelectRecipient={(t) => setSelectedRecipientType(t)}
                patientName={invoice.patient_name}
              />

              <button
                type="button"
                onClick={handleSendToPatientWhatsApp}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs shadow-md transition cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>Enviar Notificação da NF via WhatsApp</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        ) : (
          /* Formulário de Conclusão */
          <form onSubmit={handleSubmit} className="py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-slate-400" />
                  Número da Nota Fiscal *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 2026/00142"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Data da Emissão *
                </label>
                <input
                  type="date"
                  required
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Upload do Arquivo PDF */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-emerald-500" />
                Anexar Arquivo da Nota Fiscal (PDF)
              </label>
              
              <div className="mt-1 flex justify-center px-6 pt-4 pb-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-emerald-500 transition cursor-pointer relative bg-slate-50/50 dark:bg-slate-900/40">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-8 w-8 text-slate-400" />
                  {selectedFile ? (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        Clique para selecionar ou arraste o PDF da NF aqui
                      </p>
                      <p className="text-[10px] text-slate-400">PDF até 10MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Observações adicionais */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Observação Interna (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Recebido da contabilidade no dia 14/09 via e-mail."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isUploading || !invoiceNumber.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Salvar e Concluir Emissão</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};