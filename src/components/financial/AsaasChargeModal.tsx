import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  QrCode,
  CheckCircle2,
  Copy,
  Check,
  Send,
  ExternalLink,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
  UserCheck
} from 'lucide-react';
import { api } from '../../services/api.js';

export interface AsaasChargeSelectableItem {
  id: number;
  title: string;
  subtitle?: string;
  amount: number;
  isSelected?: boolean;
}

interface AsaasChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  patientCpf?: string;
  patientPhone?: string;
  guardianName?: string;
  guardianPhone?: string;
  financialResponsibleName?: string;
  financialResponsiblePhone?: string;
  transactionId?: number;
  sessionId?: number;
  evaluationId?: number;
  chargeType?: 'PSYCHOTHERAPY' | 'EVALUATION';
  items?: AsaasChargeSelectableItem[];
  defaultAmount?: number;
  defaultDescription?: string;
  isEvaluation?: boolean;
  onSuccess?: (data: any) => void;
}

export const AsaasChargeModal: React.FC<AsaasChargeModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientCpf,
  patientPhone,
  guardianName,
  guardianPhone,
  financialResponsibleName,
  financialResponsiblePhone,
  transactionId,
  sessionId,
  evaluationId,
  chargeType,
  items,
  defaultAmount = 180.0,
  defaultDescription = '',
  isEvaluation = false,
  onSuccess,
}) => {
  const [step, setStep] = useState<'FORM' | 'SUCCESS'>('FORM');
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [description, setDescription] = useState<string>(
    defaultDescription || (isEvaluation ? `Avaliação Neuropsicológica - ${patientName}` : `Sessão de Psicoterapia - ${patientName}`)
  );
  const [billingType, setBillingType] = useState<'UNDEFINED' | 'PIX' | 'CREDIT_CARD'>('UNDEFINED');
  const [installments, setInstallments] = useState<number>(1);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });

  // Tomador
  const hasResponsible = Boolean(financialResponsibleName || guardianName);
  const [payerType, setPayerType] = useState<'PATIENT' | 'RESPONSIBLE'>(hasResponsible ? 'RESPONSIBLE' : 'PATIENT');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Seleção de itens
  const [selectedMap, setSelectedMap] = useState<Record<number, boolean>>({});

  // Resultado do Asaas
  const [chargeResult, setChargeResult] = useState<{
    paymentId: string;
    invoiceUrl: string;
    pixCopyPaste?: string;
    pixQrCodeBase64?: string;
    amount: number;
    payerName: string;
  } | null>(null);

  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const recalcFromMap = (map: Record<number, boolean>, currentItems: AsaasChargeSelectableItem[]) => {
    const selected = currentItems.filter((it) => map[it.id]);
    const total = selected.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
    setAmount(total);
    const count = selected.length;
    if (isEvaluation || chargeType === 'EVALUATION') {
      setDescription(`Honorários de Avaliação (${count} parcela(s)) - ${patientName}`);
    } else {
      setDescription(`Honorários de Psicoterapia (${count} sessão(ões)) - ${patientName}`);
    }
  };

  const handleToggleItem = (id: number) => {
    if (!items) return;
    const nextMap = { ...selectedMap, [id]: !selectedMap[id] };
    setSelectedMap(nextMap);
    recalcFromMap(nextMap, items);
  };

  const handleSelectAllItems = () => {
    if (!items) return;
    const nextMap: Record<number, boolean> = {};
    items.forEach((it) => (nextMap[it.id] = true));
    setSelectedMap(nextMap);
    recalcFromMap(nextMap, items);
  };

  const handleUnselectAllItems = () => {
    if (!items) return;
    const nextMap: Record<number, boolean> = {};
    items.forEach((it) => (nextMap[it.id] = false));
    setSelectedMap(nextMap);
    recalcFromMap(nextMap, items);
  };

  useEffect(() => {
    if (isOpen) {
      setStep('FORM');
      setErrorMessage(null);
      setChargeResult(null);
      setCopiedPix(false);
      setCopiedLink(false);
      setPayerType(hasResponsible ? 'RESPONSIBLE' : 'PATIENT');

      if (items && items.length > 0) {
        const initialMap: Record<number, boolean> = {};
        items.forEach((it) => {
          initialMap[it.id] = it.isSelected !== false;
        });
        setSelectedMap(initialMap);

        const total = items
          .filter((it) => initialMap[it.id])
          .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
        setAmount(total);

        const count = items.filter((it) => initialMap[it.id]).length;
        if (isEvaluation || chargeType === 'EVALUATION') {
          setDescription(`Honorários de Avaliação (${count} parcela(s)) - ${patientName}`);
        } else {
          setDescription(`Honorários de Psicoterapia (${count} sessão(ões)) - ${patientName}`);
        }
      } else {
        setAmount(defaultAmount);
        setDescription(
          defaultDescription || (isEvaluation ? `Avaliação Neuropsicológica - ${patientName}` : `Sessão de Psicoterapia - ${patientName}`)
        );
      }
    }
  }, [isOpen, items, defaultAmount, defaultDescription, isEvaluation, chargeType, patientName, hasResponsible]);

  if (!isOpen) return null;

  const targetPayerName =
    payerType === 'RESPONSIBLE'
      ? financialResponsibleName || guardianName || patientName
      : patientName;

  const targetPayerPhone =
    payerType === 'RESPONSIBLE'
      ? financialResponsiblePhone || guardianPhone || patientPhone || ''
      : patientPhone || '';

  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const selectedList = (items || []).filter((it) => selectedMap[it.id]);
    if (items && items.length > 0 && selectedList.length === 0) {
      setErrorMessage('Selecione pelo menos um item para emitir a cobrança.');
      setIsLoading(false);
      return;
    }

    try {
      const payload: any = {
        patientId,
        amount: Number(amount),
        dueDate,
        description,
        billingType,
        installments: installments > 1 ? installments : undefined,
        chargeType: isEvaluation || chargeType === 'EVALUATION' ? 'EVALUATION' : 'PSYCHOTHERAPY',
      };

      if (items && items.length > 0) {
        if (isEvaluation || chargeType === 'EVALUATION') {
          payload.installmentItems = selectedList.map((it) => ({
            transactionId: it.id,
            amount: Number(it.amount),
          }));
        } else {
          payload.sessionItems = selectedList.map((it) => ({
            sessionId: it.id,
            amount: Number(it.amount),
          }));
        }
      } else {
        payload.transactionId = transactionId;
        payload.sessionId = sessionId;
        payload.evaluationId = evaluationId;
      }

      const res = await api.post('/financial/asaas/charge', payload);

      if (res.data?.success) {
        setChargeResult({
          paymentId: res.data.paymentId,
          invoiceUrl: res.data.invoiceUrl,
          pixCopyPaste: res.data.pixCopyPaste,
          pixQrCodeBase64: res.data.pixQrCodeBase64,
          amount: res.data.amount,
          payerName: res.data.payerName || targetPayerName,
        });
        setStep('SUCCESS');
        if (onSuccess) {
          onSuccess(res.data);
        }
      } else {
        setErrorMessage(res.data?.error || 'Não foi possível emitir a cobrança no Asaas.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Erro ao conectar com o serviço do Asaas.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (chargeResult?.pixCopyPaste) {
      navigator.clipboard.writeText(chargeResult.pixCopyPaste);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  const handleCopyLink = () => {
    if (chargeResult?.invoiceUrl) {
      navigator.clipboard.writeText(chargeResult.invoiceUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleSendWhatsApp = () => {
    if (!chargeResult) return;

    const formattedAmount = chargeResult.amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    let message = `Olá, *${targetPayerName}*! Tudo bem?\n\n`;
    message += `Aqui é da clínica *PsicoGestão / Synapsi*.\n`;
    message += `Segue o link seguro para o acerto referente a *${description}* no valor de *${formattedAmount}*:\n\n`;
    message += `🔗 *Link da Fatura:* ${chargeResult.invoiceUrl}\n\n`;

    if (chargeResult.pixCopyPaste) {
      message += `Caso prefira realizar via *PIX Copia e Cola*, utilize a chave abaixo:\n`;
      message += `\`${chargeResult.pixCopyPaste}\`\n\n`;
    }

    message += `Assim que o pagamento for realizado, a baixa e o comprovante são confirmados automaticamente em nosso sistema.\n\n`;
    message += `Qualquer dúvida, estamos à disposição!`;

    const cleanPhone = targetPayerPhone.replace(/\D/g, '');
    const phoneParam = cleanPhone.length >= 10 ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : '';
    const encoded = encodeURIComponent(message);
    const waUrl = phoneParam ? `https://wa.me/${phoneParam}?text=${encoded}` : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/10 rounded-xl">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Cobrança Inteligente & Conciliação</h3>
              <p className="text-xs text-teal-100 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Baixa automática via Webhook Asaas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Não foi possível gerar a cobrança:</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {step === 'FORM' ? (
            <form onSubmit={handleCreateCharge} className="space-y-4">
              {/* Seletor de Pagador / Tomador Inteligente */}
              {hasResponsible && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    Destinatário da Cobrança (Tomador):
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPayerType('RESPONSIBLE')}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        payerType === 'RESPONSIBLE'
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-900 dark:text-teal-200 font-medium'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="font-semibold">Responsável Financeiro</div>
                      <div className="truncate text-[11px] opacity-80">
                        {financialResponsibleName || guardianName}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayerType('PATIENT')}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        payerType === 'PATIENT'
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-900 dark:text-teal-200 font-medium'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="font-semibold">Próprio Paciente</div>
                      <div className="truncate text-[11px] opacity-80">{patientName}</div>
                    </button>
                  </div>
                </div>
              )}
              {items && items.length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      <span>{isEvaluation || chargeType === 'EVALUATION' ? 'Parcelas a Incluir:' : 'Sessões a Incluir:'}</span>
                      <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">
                        ({(items || []).filter((it) => selectedMap[it.id]).length} de {items.length})
                      </span>
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={handleSelectAllItems}
                        className="font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                      >
                        Todas
                      </button>
                      <span className="text-slate-400">•</span>
                      <button
                        type="button"
                        onClick={handleUnselectAllItems}
                        className="font-semibold text-slate-400 hover:underline cursor-pointer"
                      >
                        Nenhuma
                      </button>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {items.map((it) => {
                      const isSelected = Boolean(selectedMap[it.id]);
                      return (
                        <div
                          key={it.id}
                          onClick={() => handleToggleItem(it.id)}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500/40 text-teal-900 dark:text-teal-100 font-medium'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 pointer-events-none"
                            />
                            <div className="truncate">
                              <span className="font-semibold text-slate-900 dark:text-white">{it.title}</span>
                              {it.subtitle && (
                                <span className="text-[11px] text-slate-400 ml-1.5">• {it.subtitle}</span>
                              )}
                            </div>
                          </div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                            {it.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Paciente e Descrição */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição do Serviço:
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              {/* Grid: Valor e Vencimento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor Total (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Vencimento:
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              {/* Forma de Pagamento e Parcelamento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Opção de Pagamento:
                  </label>
                  <select
                    value={billingType}
                    onChange={(e: any) => setBillingType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="UNDEFINED">PIX e Cartão (Fatura Completa)</option>
                    <option value="PIX">Apenas PIX</option>
                    <option value="CREDIT_CARD">Apenas Cartão de Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Parcelas:
                  </label>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  >
                    <option value={1}>À vista (1x de R$ {amount.toFixed(2)})</option>
                    <option value={2}>2x de R$ {(amount / 2).toFixed(2)}</option>
                    <option value={3}>3x de R$ {(amount / 3).toFixed(2)}</option>
                    <option value={4}>4x de R$ {(amount / 4).toFixed(2)}</option>
                    <option value={5}>5x de R$ {(amount / 5).toFixed(2)}</option>
                    <option value={6}>6x de R$ {(amount / 6).toFixed(2)}</option>
                  </select>
                </div>
              </div>

              {/* Dica de conciliação */}
              <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl text-cyan-800 dark:text-cyan-300 text-[11px] flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                <span>
                  Ao pagar via PIX ou Cartão, o status muda automaticamente para <strong>PAGO</strong> na sua agenda em menos de 2 segundos.
                </span>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Gerando Cobrança...
                    </>
                  ) : (
                    <>
                      <QrCode className="h-3.5 w-3.5" />
                      Gerar Cobrança com Baixa Automática
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {/* Banner de Sucesso */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold">Cobrança Gerada no Asaas com Sucesso!</span>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    O Webhook está aguardando o pagamento para conciliar automaticamente.
                  </p>
                </div>
              </div>

              {/* QR Code PIX */}
              {chargeResult?.pixQrCodeBase64 ? (
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-600">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    QR Code PIX Dinâmico:
                  </p>
                  <img
                    src={`data:image/png;base64,${chargeResult.pixQrCodeBase64}`}
                    alt="QR Code PIX Asaas"
                    className="w-44 h-44 rounded-lg bg-white p-2 border border-slate-200 shadow-sm"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Vencimento: {dueDate} • Valor: R$ {chargeResult.amount.toFixed(2)}
                  </p>
                </div>
              ) : null}

              {/* Chave PIX Copia e Cola */}
              {chargeResult?.pixCopyPaste && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Código PIX Copia e Cola:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={chargeResult.pixCopyPaste}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                        copiedPix
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
                      }`}
                    >
                      {copiedPix ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedPix ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Link da Fatura */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Link da Fatura (PIX e Cartão):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={chargeResult?.invoiceUrl || ''}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
                    }`}
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedLink ? 'Copiado!' : 'Copiar'}
                  </button>
                  <a
                    href={chargeResult?.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 flex items-center"
                    title="Abrir fatura em nova aba"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* Disparo de WhatsApp em 1 clique */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  Disparar Mensagem com Link e PIX via WhatsApp
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
