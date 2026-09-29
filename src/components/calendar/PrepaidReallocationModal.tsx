import React from 'react';
import {
  X,
  Coins,
  ArrowRight,
  CheckCircle2,
  PlusCircle,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  Loader2,
  FileCheck,
} from 'lucide-react';

interface PrepaidReallocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  newSession: {
    startTime: string;
    endTime: string;
    price: number;
    psychologistName?: string;
  };
  suggestedDonorSession: {
    id: number;
    start_time: string;
    end_time: string;
    price: number;
    psychologist_name?: string;
    payment_method?: string;
    paid_at?: string;
    invoice_id?: number | null;
  };
  hasInvoiceLock?: boolean;
  onConfirmReallocation: () => void;
  onConfirmAdditionalSession: () => void;
  isLoading?: boolean;
}

const formatDateTime = (iso: string) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dateStr} às ${timeStr}`;
  } catch {
    return iso;
  }
};

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const PrepaidReallocationModal: React.FC<PrepaidReallocationModalProps> = ({
  isOpen,
  onClose,
  patientName,
  newSession,
  suggestedDonorSession,
  hasInvoiceLock = false,
  onConfirmReallocation,
  onConfirmAdditionalSession,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-100 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                  Crédito Pré-Pago Detectado
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                Realocar Pagamento de Sessão Futura?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paciente: <span className="font-semibold text-slate-800 dark:text-slate-200">{patientName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resumo da Ocorrência */}
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Identificamos que este paciente possui sessão futura no pacote já quitada. Como este agendamento ocorre em data anterior, você pode <strong>antecipar o crédito já pago</strong> ou registrá-lo como uma <strong>sessão extraordinária avulsa</strong>.
        </div>

        {/* Comparativo de Sessões */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Card 1: Nova Sessão */}
          <div className="p-4 rounded-2xl border-2 border-teal-500/60 bg-teal-50/40 dark:bg-teal-950/20 dark:border-teal-700/60 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 block mb-1">
                Novo Atendimento (Antecipado)
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white mt-1">
                <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>{formatDateTime(newSession.startTime)}</span>
              </div>
              {newSession.psychologistName && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{newSession.psychologistName}</span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-teal-200/60 dark:border-teal-900/60 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-teal-800 dark:text-teal-300">Ficará:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                PAGO (Quitado)
              </span>
            </div>
          </div>

          {/* Card 2: Sessão Futura Doadora */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-slate-700/80 dark:bg-slate-800/60 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Sessão Futura do Pacote
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>{formatDateTime(suggestedDonorSession.start_time)}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Valor: <span className="font-semibold">{formatCurrency(suggestedDonorSession.price)}</span>
                {suggestedDonorSession.payment_method && ` • ${suggestedDonorSession.payment_method}`}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500">Voltará a:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                PENDENTE (Renovar Pacote)
              </span>
            </div>
          </div>
        </div>

        {/* Trava Fiscal (Se houver Nota Fiscal emitida) */}
        {hasInvoiceLock && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-bold">Bloqueio Fiscal Ativo: </span>
              A sessão futura doadora já possui Nota Fiscal escriturada e transmitida à prefeitura. Por exigência legal, o pagamento não pode ser transferido. Selecione <strong>"Manter como Sessão Adicional"</strong> para faturamento avulso.
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            Voltar ao Formulário
          </button>

          <button
            type="button"
            onClick={onConfirmAdditionalSession}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Manter como Sessão Adicional</span>
          </button>

          <button
            type="button"
            onClick={onConfirmReallocation}
            disabled={isLoading || hasInvoiceLock}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
              hasInvoiceLock
                ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/30'
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>Realocar Crédito Pré-Pago</span>
          </button>
        </div>
      </div>
    </div>
  );
};
