import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  X,
  User,
  ShieldCheck,
  AlertCircle,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { cleanWhatsAppPhone } from '../../utils/whatsappRouting.js';
import { Session } from '../../types.js';

interface WhatsAppSessionReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
}

export const WhatsAppSessionReminderModal: React.FC<WhatsAppSessionReminderModalProps> = ({
  isOpen,
  onClose,
  session,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientType, setRecipientType] = useState<'PATIENT' | 'GUARDIAN'>('PATIENT');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [patientName, setPatientName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [hasGuardian, setHasGuardian] = useState(false);
  const [guardianName, setGuardianName] = useState<string | null>(null);
  const [guardianPhone, setGuardianPhone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isOpen && session) {
      loadReminderData();
    } else {
      setMessageText('');
      setError(null);
      setCopied(false);
      setIsEditing(false);
    }
  }, [isOpen, session?.id]);

  const loadReminderData = async (targetOverride?: 'PATIENT' | 'GUARDIAN') => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const target = targetOverride || recipientType;
      const res = await api.post(`/sessions/${session.id}/whatsapp-reminder`, {
        recipientOverride: target,
      });

      const data = res.data;
      setPatientName(data.patientName || session.patient_name || '');
      setRecipientName(data.recipientName || data.patientName || '');
      setRecipientPhone(data.recipientPhone || '');
      setRecipientType(data.recipientType || 'PATIENT');
      setMessageText(data.messageText || '');
      setHasGuardian(Boolean(data.hasGuardian));
      setGuardianName(data.guardianName || null);
      setGuardianPhone(data.guardianPhone || null);
    } catch (err: any) {
      console.error('Erro ao carregar lembrete do WhatsApp:', err);
      setError(err.response?.data?.error || 'Erro ao gerar mensagem de lembrete.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRecipient = (type: 'PATIENT' | 'GUARDIAN') => {
    setRecipientType(type);
    loadReminderData(type);
  };

  const handleCopy = async () => {
    if (!messageText) return;
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Falha ao copiar:', e);
    }
  };

  const handleSend = () => {
    if (!messageText) return;
    const cleanDigits = cleanWhatsAppPhone(recipientPhone);
    const encodedText = encodeURIComponent(messageText);
    const url = cleanDigits
      ? `https://wa.me/${cleanDigits}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl text-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Lembrete de Consulta</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-mono font-medium">
                  WhatsApp
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Prévia da mensagem que será enviada para o paciente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Seleção de Destinatário (quando há Responsável Legal) */}
          {hasGuardian && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider text-[11px]">
                Enviar mensagem para:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleRecipient('PATIENT')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 ${
                    recipientType === 'PATIENT'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-xs'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold block truncate">Paciente</span>
                    <span className="text-[10px] text-slate-400 block truncate">{patientName}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleRecipient('GUARDIAN')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 ${
                    recipientType === 'GUARDIAN'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-xs'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold block truncate">Responsável Legal</span>
                    <span className="text-[10px] text-slate-400 block truncate">{guardianName || 'Responsável'}</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Dados do Destinatário */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/70 border border-slate-700/80 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Destinatário: {recipientType === 'GUARDIAN' ? 'Responsável' : 'Paciente'}
              </span>
              <strong className="text-white font-semibold">{recipientName || patientName}</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Número</span>
              <span className="font-mono text-emerald-400 font-bold">
                {recipientPhone || session.patient_phone || 'Sem número'}
              </span>
            </div>
          </div>

          {/* Prévia Autêntica do WhatsApp */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                Prévia da Mensagem no WhatsApp:
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Edit3 className="h-3 w-3" />
                <span>{isEditing ? 'Concluir Edição' : 'Personalizar Texto'}</span>
              </button>
            </div>

            {loading ? (
              <div className="p-8 rounded-2xl bg-[#0b141a] border border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                <span>Gerando texto do lembrete...</span>
              </div>
            ) : isEditing ? (
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={5}
                className="w-full p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/50 text-xs text-slate-100 font-sans leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                placeholder="Digite a mensagem do lembrete..."
              />
            ) : (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0b141a] border border-slate-800/90 shadow-inner">
                <div className="max-w-md ml-auto bg-[#005c4b] text-slate-100 p-3.5 rounded-2xl rounded-tr-xs shadow-md text-xs leading-relaxed whitespace-pre-wrap select-text border border-emerald-600/30">
                  {messageText}
                </div>
              </div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            ℹ️ Mensagem em conformidade ética com o CFP: neutra, objetiva e com opções de resposta rápida (1 para Confirmar, 2 para Remarcar).
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!messageText}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
              copied
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Mensagem Copiada!' : 'Copiar Mensagem'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={!messageText || !recipientPhone}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition cursor-pointer"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Enviar via WhatsApp</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
