import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  X,
  MessageSquare,
  Copy,
  Check,
  Send,
  Calendar,
  AlertCircle,
  FileText,
  User,
  CheckSquare,
  Square,
  Clock,
  Zap,
  Download,
  ShieldCheck,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { DEFAULT_SESSIONS_TEMPLATE, DEFAULT_EVALUATION_TEMPLATE, type AccountingSettings } from './SettingsModule.js';

interface SessionItem {
  id: number;
  start_time: string;
  end_time?: string;
  modality: string;
  price: number;
  is_paid?: number | boolean;
  status?: string;
}

interface EvaluationItem {
  transaction_id: number;
  evaluation_id: number;
  price: number;
  payment_method: string;
  paid_at?: string;
  transaction_date: string;
  installment_number: number;
  total_installments: number;
  evaluation_title: string;
  evaluation_status: string;
  is_paid: number;
}

interface PatientOption {
  id: number;
  full_name: string;
  cpf: string;
  phone: string;
  session_price?: number;
}

interface InvoiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (invoice?: any) => void;
  initialPatient?: PatientOption | null;
  initialSessions?: SessionItem[];
  initialEvaluationTransactionIds?: number[];
  existingInvoiceId?: number;
}

export const InvoiceRequestModal: React.FC<InvoiceRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatient,
  initialSessions,
  initialEvaluationTransactionIds,
  existingInvoiceId,
}) => {
  const { user } = useAuth();

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | ''>(initialPatient?.id || '');
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(initialPatient || null);

  const [paidSessions, setPaidSessions] = useState<SessionItem[]>([]);
  const [futureSessions, setFutureSessions] = useState<SessionItem[]>([]);
  const [paidEvaluations, setPaidEvaluations] = useState<EvaluationItem[]>([]);
  const [selectedSessionMap, setSelectedSessionMap] = useState<Record<number, boolean>>({});
  const [selectedEvalMap, setSelectedEvalMap] = useState<Record<number, boolean>>({});
  const [templateSelectionMode, setTemplateSelectionMode] = useState<'AUTO' | 'SESSIONS' | 'EVALUATION'>('AUTO');
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const [accounting, setAccounting] = useState<AccountingSettings | null>(null);
  const [fiscalCreds, setFiscalCreds] = useState<any>(null);
  const isDirectEmissionActive = Boolean(
    fiscalCreds?.is_active && accounting?.operational_mode !== 'MANUAL'
  );
  const [useGuardianTomador, setUseGuardianTomador] = useState(false);
  const [hasGuardian, setHasGuardian] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [guardianCpf, setGuardianCpf] = useState('');
  const [isEmittingDirect, setIsEmittingDirect] = useState(false);
  const [directEmissionSuccess, setDirectEmissionSuccess] = useState<any>(null);
  const [customNotes, setCustomNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setDirectEmissionSuccess(null);

    const loadInitialData = async () => {
      try {
        const [accRes, patRes, fiscalRes] = await Promise.all([
          api.get('/settings/accounting'),
          !initialPatient ? api.get('/patients') : Promise.resolve({ data: { patients: [] } }),
          api.get('/fiscal/credentials')
        ]);

        if (accRes.data.accounting) {
          setAccounting(accRes.data.accounting);
        }

        if (fiscalRes.data?.credentials) {
          setFiscalCreds(fiscalRes.data.credentials);
        }

        if (!initialPatient && patRes.data.patients) {
          setPatients(patRes.data.patients);
        }
      } catch (err) {
        console.error('Failed to load modal dependencies:', err);
      }
    };

    loadInitialData();
  }, [isOpen, initialPatient]);

  useEffect(() => {
    if (!selectedPatientId) {
      setHasGuardian(false);
      setGuardianName('');
      setGuardianCpf('');
      setUseGuardianTomador(false);
      return;
    }

    api.get(`/patients/${selectedPatientId}`)
      .then((res) => {
        const p = res.data.patient;
        if (p) {
          let gList: any[] = [];
          try {
            if (p.guardians) {
              gList = typeof p.guardians === 'string' ? JSON.parse(p.guardians) : p.guardians;
            }
          } catch (e) {}

          if (Array.isArray(gList) && gList.length > 0 && (gList[0]?.name || gList[0]?.fullName)) {
            setHasGuardian(true);
            setGuardianName(gList[0].fullName || gList[0].name);
            setGuardianCpf(gList[0].cpf || '');
            setUseGuardianTomador(true);
          } else {
            setHasGuardian(false);
            setGuardianName('');
            setGuardianCpf('');
            setUseGuardianTomador(false);
          }
        }
      })
      .catch((err) => console.warn('Erro ao carregar dados do paciente no modal:', err));
  }, [selectedPatientId]);

  useEffect(() => {
    if (initialPatient) {
      setSelectedPatient(initialPatient);
      setSelectedPatientId(initialPatient.id);
    }
  }, [initialPatient]);

  useEffect(() => {
    if (initialSessions && initialSessions.length > 0) {
      const map: Record<number, boolean> = {};
      initialSessions.forEach((s) => (map[s.id] = true));
      setSelectedSessionMap(map);
      setPaidSessions(initialSessions);
    }
  }, [initialSessions]);

  useEffect(() => {
    if (initialEvaluationTransactionIds && initialEvaluationTransactionIds.length > 0) {
      const evMap: Record<number, boolean> = {};
      initialEvaluationTransactionIds.forEach((id) => (evMap[id] = true));
      setSelectedEvalMap(evMap);
      setSelectedSessionMap({});
    }
  }, [initialEvaluationTransactionIds]);

  useEffect(() => {
    if (!selectedPatientId || (initialSessions && initialSessions.length > 0)) return;

    const fetchSessions = async () => {
      setIsLoadingSessions(true);
      setErrorMessage(null);
      try {
        const res = await api.get(`/invoices/available-sessions/${selectedPatientId}`);
        setPaidSessions(res.data.paidSessions || []);
        setFutureSessions(res.data.futureOrPendingSessions || []);
        setPaidEvaluations(res.data.paidEvaluations || []);

        const map: Record<number, boolean> = {};
        if (!initialEvaluationTransactionIds || initialEvaluationTransactionIds.length === 0) {
          (res.data.paidSessions || []).forEach((s: SessionItem) => (map[s.id] = true));
        }
        setSelectedSessionMap(map);

        const evMap: Record<number, boolean> = {};
        if (initialEvaluationTransactionIds && initialEvaluationTransactionIds.length > 0) {
          initialEvaluationTransactionIds.forEach((id) => (evMap[id] = true));
        } else {
          (res.data.paidEvaluations || []).forEach((ev: EvaluationItem) => (evMap[ev.transaction_id] = true));
        }
        setSelectedEvalMap(evMap);
      } catch (err: any) {
        console.error('Failed to fetch patient sessions for invoice:', err);
        setErrorMessage('Erro ao carregar sessões do paciente.');
      } finally {
        setIsLoadingSessions(false);
      }
    };

    fetchSessions();
  }, [selectedPatientId, initialSessions, initialEvaluationTransactionIds]);

  const handlePatientSelectChange = (pId: number) => {
    setSelectedPatientId(pId);
    const p = patients.find((item) => item.id === pId) || null;
    setSelectedPatient(p);
  };

  const allAvailableSessions = useMemo(() => {
    return [...paidSessions, ...futureSessions];
  }, [paidSessions, futureSessions]);

  const selectedSessions = useMemo(() => {
    return allAvailableSessions.filter((s) => selectedSessionMap[s.id]);
  }, [allAvailableSessions, selectedSessionMap]);

  const selectedEvaluations = useMemo(() => {
    return paidEvaluations.filter((ev) => selectedEvalMap[ev.transaction_id]);
  }, [paidEvaluations, selectedEvalMap]);

  const totalSelectedCount = selectedSessions.length + selectedEvaluations.length;

  const totalAmount = useMemo(() => {
    const sessSum = selectedSessions.reduce((sum, s) => sum + Number(s.price || 0), 0);
    const evalSum = selectedEvaluations.reduce((sum, ev) => sum + Number(ev.price || 0), 0);
    return sessSum + evalSum;
  }, [selectedSessions, selectedEvaluations]);

  const toggleSession = (id: number) => {
    setSelectedSessionMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleEval = (txId: number) => {
    setSelectedEvalMap((prev) => ({
      ...prev,
      [txId]: !prev[txId],
    }));
  };

  const selectAll = () => {
    const map: Record<number, boolean> = {};
    allAvailableSessions.forEach((s) => (map[s.id] = true));
    setSelectedSessionMap(map);

    const evMap: Record<number, boolean> = {};
    paidEvaluations.forEach((ev) => (evMap[ev.transaction_id] = true));
    setSelectedEvalMap(evMap);
  };

  const deselectAll = () => {
    setSelectedSessionMap({});
    setSelectedEvalMap({});
  };

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTimeStr = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('T')) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const effectiveTemplateType = useMemo<'SESSIONS' | 'EVALUATION'>(() => {
    if (templateSelectionMode !== 'AUTO') return templateSelectionMode;
    if (selectedEvaluations.length > 0 && selectedSessions.length === 0) return 'EVALUATION';
    if (selectedSessions.length > 0 && selectedEvaluations.length === 0) return 'SESSIONS';
    if (initialEvaluationTransactionIds && initialEvaluationTransactionIds.length > 0) return 'EVALUATION';
    return 'SESSIONS';
  }, [templateSelectionMode, selectedEvaluations, selectedSessions, initialEvaluationTransactionIds]);

  const generatedWhatsAppText = useMemo(() => {
    if (!selectedPatient) return '';

    const isEval = effectiveTemplateType === 'EVALUATION';
    const template = isEval
      ? (accounting?.messageTemplateEvaluation || DEFAULT_EVALUATION_TEMPLATE)
      : (accounting?.messageTemplateSessions || accounting?.messageTemplate || DEFAULT_SESSIONS_TEMPLATE);

    const serviceCode = isEval
      ? (accounting?.serviceCodeEvaluation || accounting?.serviceCode || 'Não informado')
      : (accounting?.serviceCodeSessions || accounting?.serviceCode || 'Não informado');

    const sessionLines = selectedSessions.map((s) => {
      const time = formatTimeStr(s.start_time);
      const mod = s.modality === 'ONLINE' ? 'Online' : 'Presencial';
      const futureTag = s.is_paid ? '' : ' *(Reembolso Convênio)*';
      return `• *${formatDateStr(s.start_time)}${time ? ` às ${time}` : ''}* (${mod}) — R$ ${Number(s.price).toFixed(2)}${futureTag}`;
    });

    const evalLines = selectedEvaluations.map((ev) => {
      const datePaidStr = formatDateStr(ev.paid_at || ev.transaction_date);
      const dateDueStr = formatDateStr(ev.transaction_date);
      const inst = `Parcela ${ev.installment_number || 1}/${ev.total_installments || 1}`;
      const paidInfo = ev.is_paid ? `(Quitada via ${ev.payment_method || 'PIX'} em ${datePaidStr})` : `(Vencimento: ${dateDueStr})`;
      return `• *${inst}* — R$ ${Number(ev.price).toFixed(2)} ${paidInfo}`;
    });

    const evalTitles = Array.from(new Set(selectedEvaluations.map((ev) => ev.evaluation_title))).filter(Boolean);
    const tituloAvaliacao = evalTitles.join(', ') || 'Avaliação Neuropsicológica';

    const allLines = [...sessionLines, ...evalLines].join('\n');
    const parcelasFormatted = evalLines.join('\n');

    let text = template
      .replace(/{contabilidade}/g, accounting?.officeName || 'Contabilidade')
      .replace(/{psicologo}/g, user?.name || 'Psicólogo(a)')
      .replace(/{crp}/g, user?.crp_number ? ` (${user.crp_number})` : '')
      .replace(/{paciente}/g, selectedPatient.full_name)
      .replace(/{cpf}/g, selectedPatient.cpf || 'Não informado')
      .replace(/{codigo_servico}/g, serviceCode)
      .replace(/{titulo_avaliacao}/g, tituloAvaliacao)
      .replace(/{parcelas_detalhe}/g, parcelasFormatted || allLines || '(Nenhuma parcela selecionada)')
      .replace(/{valor_total_contrato}/g, totalAmount.toFixed(2))
      .replace(/{datas_valores}/g, allLines || '(Nenhum atendimento ou avaliação selecionada)')
      .replace(/{total}/g, totalAmount.toFixed(2))
      .replace(/{cnpj_cpf}/g, accounting?.cnpj || '')
      .replace(
        /{observacoes}/g,
        customNotes.trim() ? `\n📝 *Observações Adicionais:*\n${customNotes.trim()}` : ''
      );

    return text;
  }, [
    selectedPatient,
    effectiveTemplateType,
    selectedSessions,
    selectedEvaluations,
    totalAmount,
    customNotes,
    accounting,
    user,
  ]);

  const cleanPhone = (phoneRaw?: string) => {
    let clean = (phoneRaw || '').replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length === 10 || clean.length === 11) {
      clean = '55' + clean;
    }
    return clean;
  };

  const handleCopyMessage = async () => {
    if (!generatedWhatsAppText) return;
    try {
      await navigator.clipboard.writeText(generatedWhatsAppText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleEmitDirectNfse = async () => {
    if (!selectedPatient || totalSelectedCount === 0) return;

    setIsEmittingDirect(true);
    setErrorMessage(null);

    try {
      let invId = existingInvoiceId;
      let finalInvoice: any = null;

      if (!invId) {
        const payload = {
          patient_id: selectedPatient.id,
          session_ids: selectedSessions.map((s) => s.id),
          evaluation_transaction_ids: selectedEvaluations.map((ev) => ev.transaction_id),
          notes: customNotes.trim(),
          auto_emit_direct: true,
          use_guardian_as_tomador: useGuardianTomador,
        };
        const res = await api.post('/invoices', payload);
        finalInvoice = res.data.invoice;
      } else {
        const res = await api.post(`/invoices/${invId}/emit-direct`, {
          use_guardian_as_tomador: useGuardianTomador,
        });
        finalInvoice = res.data.invoice;
      }

      setDirectEmissionSuccess(finalInvoice);
      if (onSuccess) {
        onSuccess(finalInvoice);
      }
    } catch (err: any) {
      console.error('Error emitting direct NFS-e:', err);
      setErrorMessage(err.response?.data?.error || 'Erro ao autorizar NFS-e na prefeitura.');
    } finally {
      setIsEmittingDirect(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedPatient || totalSelectedCount === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let invId = existingInvoiceId;

      if (!invId) {
        const payload = {
          patient_id: selectedPatient.id,
          session_ids: selectedSessions.map((s) => s.id),
          evaluation_transaction_ids: selectedEvaluations.map((ev) => ev.transaction_id),
          notes: customNotes.trim(),
          status: 'REQUESTED',
        };
        const res = await api.post('/invoices', payload);
        invId = res.data.invoice?.id;
      } else {
        await api.put(`/invoices/${invId}/status`, { status: 'REQUESTED' });
      }

      const accountingPhone = cleanPhone(accounting?.phone);
      const encodedText = encodeURIComponent(generatedWhatsAppText);

      let url = '';
      if (accountingPhone) {
        url = `https://api.whatsapp.com/send?phone=${accountingPhone}&text=${encodedText}`;
      } else {
        url = `https://api.whatsapp.com/send?text=${encodedText}`;
      }

      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (!newWindow) {
        window.location.href = url;
      }

      if (onSuccess) {
        onSuccess({ id: invId });
      }

      onClose();
    } catch (err: any) {
      console.error('Error dispatching invoice request:', err);
      setErrorMessage(err.response?.data?.error || 'Erro ao processar solicitação de NF.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isDirectEmissionActive ? 'Emissão de Nota Fiscal (NFS-e)' : 'Solicitação de Nota Fiscal à Contabilidade'}
                </h3>
                {isDirectEmissionActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" />
                    Emissão Direta Ativa
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isDirectEmissionActive ? (
                  <>Autorização imediata com prefeitura municipal ou envio à contabilidade.</>
                ) : accounting?.officeName ? (
                  <>Destinatário: <strong className="text-slate-700 dark:text-slate-200">{accounting.officeName}</strong> {accounting.phone ? `(${accounting.phone})` : ''}</>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">⚠️ Escritório de contabilidade ainda não configurado</span>
                )}
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

        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {directEmissionSuccess ? (
          <div className="py-8 text-center space-y-6 animate-in fade-in">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 uppercase tracking-wider">
                NFS-e Homologada & Autorizada
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-2">
                Nota Fiscal Emitida com Sucesso!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                NFS-e Nº <strong className="text-slate-800 dark:text-slate-200">{directEmissionSuccess.invoice_number}</strong> autorizada e vinculada automaticamente ao prontuário do paciente com selo digital SHA-256.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 max-w-lg mx-auto text-xs space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">Tomador:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {useGuardianTomador && guardianName ? `${guardianName} (Responsável)` : selectedPatient?.full_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Valor Total:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  R$ {Number(directEmissionSuccess.total_amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Autenticidade (SHA-256):</span>
                <span className="font-mono text-[10px] text-slate-500 truncate max-w-[260px]">
                  {directEmissionSuccess.hash_sha256 || 'Validada ICP-Brasil'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {directEmissionSuccess.file_data && (
                <a
                  href={directEmissionSuccess.file_data}
                  download={directEmissionSuccess.file_name || `NFSe_${directEmissionSuccess.invoice_number}.pdf`}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Baixar DANFSE (PDF)
                </a>
              )}
              <a
                href={`/api/invoices/${directEmissionSuccess.id}/xml`}
                download={`NFSe_${directEmissionSuccess.invoice_number}.xml`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-600 transition cursor-pointer"
              >
                <FileCheck className="h-4 w-4 text-teal-600" />
                Baixar XML Oficial
              </a>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-bold text-xs hover:bg-slate-900 transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
        <div className="py-4 space-y-5">
          {!initialPatient && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-teal-500" />
                Selecione o Paciente *
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => handlePatientSelectChange(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="">Selecione um paciente...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} {p.cpf ? `(CPF: ${p.cpf})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedPatient && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400 text-[11px] block">Paciente:</span>
                <strong className="text-slate-800 dark:text-slate-100 text-sm">{selectedPatient.full_name}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">CPF:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedPatient.cpf || 'Não cadastrado'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Telefone:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedPatient.phone || 'Não cadastrado'}</span>
              </div>
            </div>
          )}

          {/* Tomador da Nota Fiscal (Paciente vs. Responsável Financeiro de Menores) */}
          {selectedPatient && hasGuardian && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
              <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Tomador da Nota Fiscal (Reembolso de Convênio / Declaração IRPF):
              </span>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="radio"
                    name="tomadorSelection"
                    checked={!useGuardianTomador}
                    onChange={() => setUseGuardianTomador(false)}
                    className="text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span>No CPF do Paciente ({selectedPatient.full_name})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900 dark:text-amber-200">
                  <input
                    type="radio"
                    name="tomadorSelection"
                    checked={useGuardianTomador}
                    onChange={() => setUseGuardianTomador(true)}
                    className="text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span>No CPF do Responsável Financeiro ({guardianName} {guardianCpf ? `- CPF ${guardianCpf}` : ''})</span>
                </label>
              </div>
            </div>
          )}

          {selectedPatient && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {paidEvaluations.length > 0 && paidSessions.length === 0 && futureSessions.length === 0
                    ? 'Parcelas de Avaliação a incluir na Nota Fiscal:'
                    : 'Atendimentos / Sessões a incluir na Nota Fiscal:'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[11px] font-semibold text-teal-600 hover:underline cursor-pointer"
                  >
                    Selecionar Todas
                  </button>
                  <span className="text-slate-400">•</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-[11px] font-semibold text-slate-400 hover:underline cursor-pointer"
                  >
                    Desmarcar Todas
                  </button>
                </div>
              </div>

              {isLoadingSessions ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Carregando atendimentos disponíveis do paciente...
                </div>
              ) : allAvailableSessions.length === 0 && paidEvaluations.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                  Nenhum atendimento ou parcela de avaliação pendente de NF encontrada para este paciente.
                </div>
              ) : (
                <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
                  {paidSessions.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckSquare className="h-3.5 w-3.5" />
                        <span>Sessões Quitadas / Pagas ({paidSessions.length})</span>
                        <span className="text-[10px] font-normal text-slate-400">— Fechamento Mensal</span>
                      </div>
                      <div className="space-y-1">
                        {paidSessions.map((s) => {
                          const isSel = Boolean(selectedSessionMap[s.id]);
                          return (
                            <div
                              key={s.id}
                              onClick={() => toggleSession(s.id)}
                              className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                                isSel
                                  ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-900 dark:text-white'
                                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isSel ? (
                                  <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                ) : (
                                  <Square className="h-4 w-4 text-slate-400 shrink-0" />
                                )}
                                <span className="font-semibold">{formatDateStr(s.start_time)}</span>
                                {formatTimeStr(s.start_time) && (
                                  <span className="text-slate-400 text-[11px]">às {formatTimeStr(s.start_time)}</span>
                                )}
                                <span className="text-slate-400 text-[11px]">({s.modality === 'ONLINE' ? 'Online' : 'Presencial'})</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                                  Quitada
                                </span>
                              </div>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                R$ {Number(s.price).toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {paidEvaluations.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-700 dark:text-purple-400">
                        <CheckSquare className="h-3.5 w-3.5" />
                        <span>Avaliações Neuropsicológicas ({paidEvaluations.length})</span>
                        <span className="text-[10px] font-normal text-slate-400">— Parcelas Quitadas</span>
                      </div>
                      <div className="space-y-1">
                        {paidEvaluations.map((ev) => {
                          const isSel = Boolean(selectedEvalMap[ev.transaction_id]);
                          return (
                            <div
                              key={`eval-${ev.transaction_id}`}
                              onClick={() => toggleEval(ev.transaction_id)}
                              className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                                isSel
                                  ? 'bg-purple-500/10 border-purple-500/40 text-slate-900 dark:text-white'
                                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isSel ? (
                                  <CheckSquare className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                ) : (
                                  <Square className="h-4 w-4 text-slate-400 shrink-0" />
                                )}
                                <span className="font-semibold">{formatDateStr(ev.paid_at || ev.transaction_date)}</span>
                                <span className="text-purple-700 dark:text-purple-300 font-medium text-[11px]">
                                  Parcela {ev.installment_number || 1}/{ev.total_installments || 1}
                                </span>
                                <span className="text-slate-500 text-[11px] truncate max-w-xs">
                                  ({ev.evaluation_title})
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold">
                                  Avaliação Neuro
                                </span>
                              </div>
                              <span className="font-bold text-purple-600 dark:text-purple-400">
                                R$ {Number(ev.price).toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {futureSessions.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Sessões Futuras / Pendentes ({futureSessions.length})</span>
                        <span className="text-[10px] font-normal text-slate-400">— Reembolso Antecipado</span>
                      </div>
                      <div className="space-y-1">
                        {futureSessions.map((s) => {
                          const isSel = Boolean(selectedSessionMap[s.id]);
                          return (
                            <div
                              key={s.id}
                              onClick={() => toggleSession(s.id)}
                              className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                                isSel
                                  ? 'bg-sky-500/10 border-sky-500/40 text-slate-900 dark:text-white'
                                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isSel ? (
                                  <CheckSquare className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                                ) : (
                                  <Square className="h-4 w-4 text-slate-400 shrink-0" />
                                )}
                                <span className="font-semibold">{formatDateStr(s.start_time)}</span>
                                {formatTimeStr(s.start_time) && (
                                  <span className="text-slate-400 text-[11px]">às {formatTimeStr(s.start_time)}</span>
                                )}
                                <span className="text-slate-400 text-[11px]">({s.modality === 'ONLINE' ? 'Online' : 'Presencial'})</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-semibold">
                                  Futura / Reembolso
                                </span>
                              </div>
                              <span className="font-bold text-sky-600 dark:text-sky-400">
                                R$ {Number(s.price).toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Observação Adicional para a Contabilidade (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ex: Emitir com código de serviço específico para convênio Bradesco Saúde."
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                Prévia da Mensagem para a Contabilidade no WhatsApp:
              </span>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-medium">Modelo:</span>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-900 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setTemplateSelectionMode('SESSIONS')}
                    className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                      effectiveTemplateType === 'SESSIONS'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                    }`}
                  >
                    Psicoterapia
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateSelectionMode('EVALUATION')}
                    className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                      effectiveTemplateType === 'EVALUATION'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-purple-600 dark:hover:text-purple-400'
                    }`}
                  >
                    Avaliação Neuro
                  </button>
                </div>

                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                  {totalSelectedCount} item(ns) • R$ {totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#efeae2] dark:bg-[#0b141a] border border-slate-300 dark:border-slate-700 shadow-inner">
              <div className="max-w-2xl ml-auto bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 p-4 rounded-2xl rounded-tr-xs shadow-sm text-xs leading-relaxed font-sans whitespace-pre-wrap select-text">
                {generatedWhatsAppText || '(Selecione um paciente e ao menos uma sessão ou avaliação para visualizar a prévia)'}
              </div>
            </div>
          </div>
        </div>
        )}

        {!directEmissionSuccess && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyMessage}
                disabled={!generatedWhatsAppText || totalSelectedCount === 0}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-50 ${
                  copied
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                }`}
              >
                {copied ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Texto Copiado!' : 'Copiar Mensagem'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Fechar
              </button>

              {isDirectEmissionActive && (
                <button
                  type="button"
                  onClick={handleEmitDirectNfse}
                  disabled={totalSelectedCount === 0 || isEmittingDirect || isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {isEmittingDirect ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 text-amber-300" />
                  )}
                  <span>⚡ Emitir NFS-e Oficial Agora</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={totalSelectedCount === 0 || isSubmitting || isEmittingDirect}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                  isDirectEmissionActive
                    ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                    : 'bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold shadow-md'
                }`}
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4 text-emerald-500" />
                )}
                <span>{isDirectEmissionActive ? 'Solicitar via WhatsApp' : 'Enviar no WhatsApp'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};