import React from 'react';
import { User, ShieldCheck, Briefcase, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { WhatsAppRecipientInfo, WhatsAppRecipientType } from '../../utils/whatsappRouting';

interface WhatsAppRecipientSelectorProps {
  recipients: WhatsAppRecipientInfo[];
  selectedType: WhatsAppRecipientType;
  onSelectRecipient: (type: WhatsAppRecipientType) => void;
  patientName?: string;
  className?: string;
}

export const WhatsAppRecipientSelector: React.FC<WhatsAppRecipientSelectorProps> = ({
  recipients,
  selectedType,
  onSelectRecipient,
  patientName,
  className = '',
}) => {
  if (!recipients || recipients.length <= 1) {
    return null;
  }

  const selectedRecipient = recipients.find((r) => r.type === selectedType) || recipients[0];

  return (
    <div className={`space-y-2 p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          Destinatário do WhatsApp:
        </span>
        {selectedRecipient.isDefault && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
            Canal Padrão do Cadastro
          </span>
        )}
      </div>

      {/* Recipient Selection Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {recipients.map((rec) => {
          const isSelected = rec.type === selectedType;
          const Icon = rec.type === 'PATIENT' ? User : rec.type === 'GUARDIAN' ? ShieldCheck : Briefcase;

          return (
            <button
              key={rec.type}
              type="button"
              onClick={() => onSelectRecipient(rec.type)}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                isSelected
                  ? 'bg-white dark:bg-slate-800 border-emerald-500 shadow-xs ring-1 ring-emerald-500/40'
                  : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  isSelected
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold truncate ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    {rec.label}
                  </span>
                  {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {rec.fullName} {rec.relationship ? `(${rec.relationship})` : ''}
                </p>

                <p className={`text-[11px] font-mono mt-0.5 ${rec.hasPhone ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-600 dark:text-amber-400'}`}>
                  {rec.phone ? rec.phone : 'Sem telefone'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Warning if selected recipient has no phone */}
      {!selectedRecipient.hasPhone && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300 animate-in fade-in">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {selectedRecipient.label} não possui número de telefone válido. Verifique o cadastro ou selecione outro contato.
          </span>
        </div>
      )}
    </div>
  );
};
