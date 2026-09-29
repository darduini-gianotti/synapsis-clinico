import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api.js';
import { Patient, MedicalRecord, ConfidentialNote, RecordType, ScaleResult, Session } from '../../types.js';
import { useAcademy } from '../../context/AcademyContext.js';
import { PatientDocumentsTab } from '../PatientDocumentsTab.js';
import { PatientEvaluationsSubTab } from './PatientEvaluationsSubTab.js';
import { AiClinicalToolbar } from '../clinical/AiClinicalToolbar.js';
import { SessionPrepCard } from '../clinical/SessionPrepCard.js';
import { VideoDockPanel } from '../clinical/VideoDockPanel.js';
import {
  FileText,
  Plus,
  Lock,
  FileSignature,
  EyeOff,
  FolderPlus,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Sparkles,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  User,
  HeartPulse,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Brain,
  RotateCcw,
  Video,
  PhoneOff,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface PatientClinicalTabProps {
  patient: Patient;
  initialSubTab?: 'evolutions' | 'new_evolution' | 'confidential' | 'documents' | 'scales' | 'evaluations';
  onEvolutionCreated?: () => void;
}

export const PatientClinicalTab: React.FC<PatientClinicalTabProps> = ({
  patient,
  initialSubTab = 'evolutions',
  onEvolutionCreated,
}) => {
  const { isSandboxActive, advanceStep } = useAcademy();
  // Sub-tabs
  const [subTab, setSubTab] = useState<'evolutions' | 'confidential' | 'documents' | 'scales' | 'evaluations'>(
    initialSubTab === 'new_evolution' ? 'evolutions' : initialSubTab
  );

  // Evolutions state
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [evolutionSearch, setEvolutionSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'DAP' | 'BIRP' | 'FREE'>('ALL');
  const [filterSigned, setFilterSigned] = useState<'ALL' | 'SIGNED' | 'UNSIGNED'>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(initialSubTab === 'new_evolution');
  const [copiedRecordId, setCopiedRecordId] = useState<number | null>(null);

  // New Evolution form state
  const [recordType, setRecordType] = useState<RecordType>('DAP');
  const [dapDados, setDapDados] = useState('');
  const [dapAvaliacao, setDapAvaliacao] = useState('');
  const [dapPlano, setDapPlano] = useState('');
  const [birpBehavior, setBirpBehavior] = useState('');
  const [birpIntervention, setBirpIntervention] = useState('');
  const [birpResponse, setBirpResponse] = useState('');
  const [birpPlan, setBirpPlan] = useState('');
  const [freeText, setFreeText] = useState('');
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);

  // Confidential notes state
  const [confidentialNotes, setConfidentialNotes] = useState<ConfidentialNote[]>([]);
  const [isLoadingConfidential, setIsLoadingConfidential] = useState(false);
  const [newConfidentialText, setNewConfidentialText] = useState('');
  const [isSavingConfidential, setIsSavingConfidential] = useState(false);

  // Documents count
  const [patientDocCount, setPatientDocCount] = useState<number>(0);

  // Neuropsych Evaluations count
  const [evaluationCount, setEvaluationCount] = useState<number>(0);

  // Scales state
  const [scales, setScales] = useState<ScaleResult[]>([]);
  const [isLoadingScales, setIsLoadingScales] = useState(false);
  const [isApplyingScale, setIsApplyingScale] = useState(false);
  const [activeScaleType, setActiveScaleType] = useState<'GAD7' | 'PHQ9'>('GAD7');
  const [scaleAnswers, setScaleAnswers] = useState<Record<string, number>>({});
  const [isSubmittingScale, setIsSubmittingScale] = useState(false);

  // Global Feedback
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'info' | 'error' = 'success', durationMs = 5000) => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), durationMs);
  };

  // Fetch Clinical Records
  const fetchRecords = async () => {
    try {
      setIsLoadingRecords(true);
      const res = await api.get(`/medical-records?patient_id=${patient.id}`);
      setMedicalRecords(res.data.records || []);
    } catch (err) {
      console.error('Failed to load medical records:', err);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // Fetch Confidential Notes
  const fetchConfidential = async () => {
    try {
      setIsLoadingConfidential(true);
      const res = await api.get(`/confidential-notes?patient_id=${patient.id}`);
      setConfidentialNotes(res.data.notes || []);
    } catch (err) {
      console.error('Failed to load confidential notes:', err);
    } finally {
      setIsLoadingConfidential(false);
    }
  };

  // Fetch Scales
  const fetchScales = async () => {
    try {
      setIsLoadingScales(true);
      const res = await api.get(`/scales?patient_id=${patient.id}`);
      setScales(res.data.scales || []);
    } catch (err) {
      console.error('Failed to load psychological scales:', err);
    } finally {
      setIsLoadingScales(false);
    }
  };

  // Fetch Evaluations Count
  const fetchEvaluationsCount = async () => {
    try {
      const res = await api.get(`/evaluations/patient/${patient.id}`);
      setEvaluationCount((res.data.evaluations || []).length);
    } catch {
      // ignore
    }
  };

  // Teleatendimento Online state (Resolução CFP nº 11/2018)
  const [onlineSession, setOnlineSession] = useState<Session | null>(null);
  const [isVideoDockOpen, setIsVideoDockOpen] = useState(false);
  const [isSplitScreen, setIsSplitScreen] = useState(true);
  const [videoPatientLink, setVideoPatientLink] = useState('');
  const [videoWhatsappUrl, setVideoWhatsappUrl] = useState('');
  const [isActivatingVideo, setIsActivatingVideo] = useState(false);

  // Fetch Online Sessions for today or active
  const fetchOnlineSession = async () => {
    try {
      const res = await api.get(`/sessions?patient_id=${patient.id}`);
      const sessions: Session[] = Array.isArray(res.data) ? res.data : (res.data?.sessions || []);
      // 1. Prioriza sessão com sala de vídeo já aberta ou ativa
      let found = sessions.find((s) => s.status !== 'CANCELED' && (s.video_status === 'OPEN' || s.video_status === 'ACTIVE'));
      // 2. Ou sessão agendada para hoje
      if (!found) {
        found = sessions.find((s) => s.status !== 'CANCELED' && new Date(s.start_time).toDateString() === new Date().toDateString());
      }
      if (found) {
        setOnlineSession(found);
        if (found.video_status === 'OPEN' || found.video_status === 'ACTIVE') {
          if (found.patient_access_token) {
            const origin = window.location.origin;
            setVideoPatientLink(`${origin}/teleconsulta/${found.patient_access_token}`);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to check online sessions:', err);
    }
  };

  const handleActivateVideo = async (provider: 'NATIVE' | 'WHATSAPP' = 'NATIVE') => {
    setIsActivatingVideo(true);
    try {
      if (onlineSession) {
        const res = await api.post(`/sessions/${onlineSession.id}/activate-video`, { provider });
        setOnlineSession((prev) => ({
          ...(prev || {}),
          ...res.data,
          modality: 'ONLINE',
          video_provider: provider,
          video_status: 'OPEN',
        } as Session));
        setVideoPatientLink(res.data.patientLink);
        setVideoWhatsappUrl(res.data.whatsappUrl);
        setIsVideoDockOpen(true);
        if (provider === 'WHATSAPP' && res.data.whatsappUrl) {
          window.open(res.data.whatsappUrl, '_blank');
          showFeedback('Atendimento via WhatsApp Vídeo iniciado! Cronômetro e prontuário ativados.', 'success');
        } else {
          showFeedback('Sala de teleatendimento ativada com sucesso! Link seguro gerado.', 'success');
        }
      } else {
        const res = await api.post('/sessions/instant-video', { patientId: patient.id, provider });
        setOnlineSession({
          ...(res.data.session || {}),
          modality: 'ONLINE',
          video_provider: provider,
          video_status: 'OPEN',
        } as Session);
        setVideoPatientLink(res.data.patientLink);
        setVideoWhatsappUrl(res.data.whatsappUrl);
        setIsVideoDockOpen(true);
        if (provider === 'WHATSAPP' && res.data.whatsappUrl) {
          window.open(res.data.whatsappUrl, '_blank');
          showFeedback('Atendimento via WhatsApp Vídeo iniciado! Cronômetro e prontuário ativados.', 'success');
        } else {
          showFeedback('Teleatendimento iniciado com sucesso! Link seguro gerado.', 'success');
        }
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(err.response?.data?.error || 'Erro ao ativar atendimento online.', 'error');
    } finally {
      setIsActivatingVideo(false);
    }
  };

  // Rascunho de Anotações do Scratchpad (Auto-save)
  const [savedScratchpadText, setSavedScratchpadText] = useState<string>(() => {
    try {
      return localStorage.getItem(`psicogestao_scratchpad_${patient.id}`) || '';
    } catch {
      return '';
    }
  });
  const [isConsolidatingScratchpad, setIsConsolidatingScratchpad] = useState(false);

  useEffect(() => {
    try {
      const text = localStorage.getItem(`psicogestao_scratchpad_${patient.id}`) || '';
      setSavedScratchpadText(text);
    } catch {}
  }, [patient.id, isFormOpen, subTab, isVideoDockOpen]);

  const handleEndVideo = async () => {
    if (!onlineSession) return;
    try {
      await api.post(`/sessions/${onlineSession.id}/end-video`);
      setOnlineSession((prev) => (prev ? { ...prev, video_status: 'FINISHED' } : null));
      setIsVideoDockOpen(false);
      showFeedback('Atendimento online encerrado com sucesso. Registre a evolução da sessão abaixo.', 'info');
      // Transição automática para o formulário de evolução do prontuário
      setSubTab('evolutions');
      setIsFormOpen(true);
      try {
        const text = localStorage.getItem(`psicogestao_scratchpad_${patient.id}`) || '';
        setSavedScratchpadText(text);
      } catch {}
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleConsolidateFromScratchpad = async (text: string) => {
    if (!text.trim()) return;
    setIsConsolidatingScratchpad(true);
    try {
      const res = await api.post('/ai/generate-evolution', {
        patientId: patient.id,
        currentNotes: text.trim(),
        modelType: 'DAP',
      });
      if (res.data?.dap) {
        setRecordType('DAP');
        setDapDados(res.data.dap.dados || '');
        setDapAvaliacao(res.data.dap.avaliacao || '');
        setDapPlano(res.data.dap.plano || '');
        setIsFormOpen(true);
        setSubTab('evolutions');
        showFeedback('Minuta de evolução gerada pela IA com sucesso a partir das anotações do Scratchpad!', 'success');
      }
    } catch (err: any) {
      console.error(err);
      showFeedback('Falha ao consolidar rascunho com IA.', 'error');
    } finally {
      setIsConsolidatingScratchpad(false);
    }
  };

  const handleApplyConsolidatedEvolution = (dap: { dados: string; avaliacao: string; plano: string }) => {
    setRecordType('DAP');
    setDapDados(dap.dados);
    setDapAvaliacao(dap.avaliacao);
    setDapPlano(dap.plano);
    setIsFormOpen(true);
    setSubTab('evolutions');
    showFeedback('Evolução preenchida com sucesso a partir das anotações da consulta online!', 'success');
  };

  // Notificação de presença em tempo real: verifica se o paciente acabou de entrar na sala
  useEffect(() => {
    if (!onlineSession || onlineSession.video_status !== 'OPEN') return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/sessions?patient_id=${patient.id}`);
        const sessions: Session[] = Array.isArray(res.data) ? res.data : (res.data?.sessions || []);
        const found = sessions.find((s) => s.id === onlineSession.id);
        if (found && (found.video_status === 'ACTIVE' || found.patient_joined_at)) {
          setOnlineSession(found);
          showFeedback(`🟢 ${patient.full_name} acabou de entrar na sala de teleatendimento!`, 'info', 7000);
        }
      } catch {}
    }, 8000);
    return () => clearInterval(interval);
  }, [onlineSession?.id, onlineSession?.video_status, patient.id, patient.full_name]);

  useEffect(() => {
    fetchRecords();
    fetchConfidential();
    fetchScales();
    fetchEvaluationsCount();
    fetchOnlineSession();
  }, [patient.id]);

  // If initialSubTab changes
  useEffect(() => {
    if (initialSubTab === 'new_evolution') {
      setSubTab('evolutions');
      setIsFormOpen(true);
    } else if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Clinical Quick Templates
  const applyTemplate = (templateName: string) => {
    if (templateName === 'tcc_padrao') {
      setRecordType('DAP');
      setDapDados('Paciente compareceu pontualmente à sessão. Humor eutímico, relato de ansiedade situacional moderada durante a semana em contexto acadêmico/profissional. Apresentou o RPD preenchido com 3 situações gatilho.');
      setDapAvaliacao('Identificou distorções cognitivas de catastrofização e leitura mental. Boa receptividade à técnica de reestruturação cognitiva e exame de evidências lógicas.');
      setDapPlano('1. Continuar monitoramento semanal com RPD;\n2. Prática diária de respiração diafragmática (5 min pela manhã);\n3. Próxima sessão: dessensibilização sistemática do gatilho principal.');
    } else if (templateName === 'acolhimento') {
      setRecordType('DAP');
      setDapDados('Primeira sessão de acolhimento e escuta terapêutica. Paciente refere queixa principal de sobrecarga emocional persistente há cerca de 3 meses. Expressão facial tensa, discurso coerente.');
      setDapAvaliacao('Estabelecido bom vínculo inicial e esclarecido o enquadre terapêutico (sigilo CFP, periodicidade, cancelamentos e honorários).');
      setDapPlano('Coleta de dados da história de vida na próxima sessão (Anamnese semidirigida) e aplicação da escala GAD-7 para rastreio de ansiedade.');
    } else if (templateName === 'crise') {
      setRecordType('BIRP');
      setBirpBehavior('Paciente chegou à sessão visivelmente abalado(a), choro fácil, tremores finos e hiperventilação. Relatou episódio agudo de ansiedade na noite anterior.');
      setBirpIntervention('Intervenção com técnicas de ancoragem sensorial (5-4-3-2-1), respiração diafragmática pausada e psicoeducação sobre a fisiologia do pânico.');
      setBirpResponse('Houve redução progressiva da ativação fisiológica ao longo de 25 minutos. Paciente conseguiu reestabelecer clareza do discurso e reportou sensação de alívio e segurança.');
      setBirpPlan('Elaboração de cartão de enfrentamento para momentos de crise; alinhamento de contato da rede de apoio familiar; sessão extraordinária agendada caso necessário.');
    } else if (templateName === 'alta') {
      setRecordType('DAP');
      setDapDados('Sessão final de avaliação de processo psicoterápico. Paciente relata manutenção consistente das metas alcançadas nos últimos 6 meses, sem recaídas incapacitantes.');
      setDapAvaliacao('Consolidação da autonomia, flexibilidade cognitiva e habilidades de resolução de problemas desenvolvidas ao longo do processo. Critérios de alta terapêutica atingidos com sucesso.');
      setDapPlano('Alta terapêutica formal acordada. Sessão de follow-up opcional após 90 dias ou conforme demanda espontânea.');
    }
  };

  // Active field for targeted AI dictation & formatting
  const [activeClinicalField, setActiveClinicalField] = useState<
    'dados' | 'avaliacao' | 'plano' | 'behavior' | 'intervention' | 'response' | 'plan' | 'free'
  >('dados');

  const currentFieldText = useMemo(() => {
    switch (activeClinicalField) {
      case 'dados':
        return dapDados;
      case 'avaliacao':
        return dapAvaliacao;
      case 'plano':
        return dapPlano;
      case 'behavior':
        return birpBehavior;
      case 'intervention':
        return birpIntervention;
      case 'response':
        return birpResponse;
      case 'plan':
        return birpPlan;
      case 'free':
        return freeText;
      default:
        return dapDados;
    }
  }, [
    activeClinicalField,
    dapDados,
    dapAvaliacao,
    dapPlano,
    birpBehavior,
    birpIntervention,
    birpResponse,
    birpPlan,
    freeText,
  ]);

  const activeFieldLabel = useMemo(() => {
    switch (activeClinicalField) {
      case 'dados':
        return '[D] Dados';
      case 'avaliacao':
        return '[A] Avaliação';
      case 'plano':
        return '[P] Plano';
      case 'behavior':
        return '[B] Behavior';
      case 'intervention':
        return '[I] Intervention';
      case 'response':
        return '[R] Response';
      case 'plan':
        return '[P] Plan';
      case 'free':
        return 'Evolução Livre';
      default:
        return '[D] Dados';
    }
  }, [activeClinicalField]);

  const handleActiveFieldTextChange = (newText: string) => {
    switch (activeClinicalField) {
      case 'dados':
        setDapDados(newText);
        break;
      case 'avaliacao':
        setDapAvaliacao(newText);
        break;
      case 'plano':
        setDapPlano(newText);
        break;
      case 'behavior':
        setBirpBehavior(newText);
        break;
      case 'intervention':
        setBirpIntervention(newText);
        break;
      case 'response':
        setBirpResponse(newText);
        break;
      case 'plan':
        setBirpPlan(newText);
        break;
      case 'free':
        setFreeText(newText);
        break;
    }
  };

  const clearEvolutionFields = () => {
    setDapDados('');
    setDapAvaliacao('');
    setDapPlano('');
    setBirpBehavior('');
    setBirpIntervention('');
    setBirpResponse('');
    setBirpPlan('');
    setFreeText('');
    setActiveClinicalField('dados');
    showFeedback('Campos limpos. O formulário está em branco.', 'info', 2500);
  };

  // Submit Evolution
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSandboxActive) {
      showFeedback('🎓 [Simulação Academy]: Evolução psicoterápica criptografada e salva em modo simulado! Nenhum dado real foi alterado.', 'success');
      setDapDados('');
      setDapAvaliacao('');
      setDapPlano('');
      setBirpBehavior('');
      setBirpIntervention('');
      setBirpResponse('');
      setBirpPlan('');
      setFreeText('');
      setIsFormOpen(false);
      advanceStep();
      return;
    }

    let contentPayload: any = {};
    if (recordType === 'DAP') {
      if (!dapDados.trim() && !dapAvaliacao.trim() && !dapPlano.trim()) {
        showFeedback('Preencha os campos do modelo DAP.', 'error');
        return;
      }
      contentPayload = {
        dados: dapDados,
        avaliacao: dapAvaliacao,
        plano: dapPlano,
      };
    } else if (recordType === 'BIRP') {
      if (!birpBehavior.trim() && !birpIntervention.trim() && !birpResponse.trim() && !birpPlan.trim()) {
        showFeedback('Preencha os campos do modelo BIRP.', 'error');
        return;
      }
      contentPayload = {
        behavior: birpBehavior,
        intervention: birpIntervention,
        response: birpResponse,
        plano: birpPlan,
      };
    } else {
      if (!freeText.trim()) {
        showFeedback('Digite o texto da evolução livre.', 'error');
        return;
      }
      contentPayload = {
        raw: freeText,
      };
    }

    try {
      setIsSubmittingRecord(true);
      await api.post('/medical-records', {
        patient_id: patient.id,
        record_type: recordType,
        content: contentPayload,
      });

      showFeedback('Evolução clínica registrada e criptografada com sucesso (AES-256-GCM).', 'success');

      // Reset form
      setDapDados('');
      setDapAvaliacao('');
      setDapPlano('');
      setBirpBehavior('');
      setBirpIntervention('');
      setBirpResponse('');
      setBirpPlan('');
      setFreeText('');
      setIsFormOpen(false);

      // Limpa o rascunho do scratchpad após registrar no prontuário definitivo
      try {
        localStorage.removeItem(`psicogestao_scratchpad_${patient.id}`);
        setSavedScratchpadText('');
      } catch {}

      fetchRecords();
      if (onEvolutionCreated) onEvolutionCreated();
    } catch (err: any) {
      showFeedback(err.response?.data?.error || 'Erro ao registrar evolução clínica.', 'error');
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  // Sign Evolution
  const handleSignRecord = async (recordId: number) => {
    if (
      !confirm(
        'Deseja assinar digitalmente este registro clínico? Esta ação é irreversível e gerará um carimbo criptográfico SHA-256 em conformidade com a Resolução CFP nº 06/2019.'
      )
    ) {
      return;
    }

    try {
      const res = await api.post(`/medical-records/${recordId}/sign`);
      showFeedback(
        `Evolução assinada com sucesso! Hash SHA-256: ${res.data.hash_sha256?.substring(0, 16)}...`,
        'success',
        7000
      );
      fetchRecords();
    } catch (err: any) {
      showFeedback(err.response?.data?.error || 'Erro ao assinar registro clínico.', 'error');
    }
  };

  // Copy Evolution to clipboard
  const handleCopyRecord = (record: MedicalRecord) => {
    let text = `Evolução Clínica - Paciente: ${patient.full_name}\nData: ${new Date(
      record.created_at
    ).toLocaleString('pt-BR')}\nModelo: ${record.record_type}\n`;

    if (record.record_type === 'DAP') {
      text += `\n[D] DADOS:\n${record.content?.dados || ''}\n\n[A] AVALIAÇÃO:\n${record.content?.avaliacao || ''}\n\n[P] PLANO:\n${record.content?.plano || ''}`;
    } else if (record.record_type === 'BIRP') {
      text += `\n[B] BEHAVIOR:\n${record.content?.behavior || ''}\n\n[I] INTERVENTION:\n${record.content?.intervention || ''}\n\n[R] RESPONSE:\n${record.content?.response || ''}\n\n[P] PLAN:\n${record.content?.plano || ''}`;
    } else {
      text += `\n${record.content?.raw || ''}`;
    }

    navigator.clipboard.writeText(text);
    setCopiedRecordId(record.id);
    setTimeout(() => setCopiedRecordId(null), 2000);
  };

  // Confidential Notes Submit
  const handleSaveConfidential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConfidentialText.trim()) return;

    try {
      setIsSavingConfidential(true);
      await api.post('/confidential-notes', {
        patient_id: patient.id,
        content: newConfidentialText,
      });

      setNewConfidentialText('');
      showFeedback(
        'Anotação confidencial gravada sob sigilo estrito do terapeuta (Resolução CFP nº 01/2009).',
        'success'
      );
      fetchConfidential();
    } catch (err: any) {
      showFeedback(err.response?.data?.error || 'Erro ao salvar anotação confidencial.', 'error');
    } finally {
      setIsSavingConfidential(false);
    }
  };

  // GAD-7 & PHQ-9 Questions
  const gad7Questions = [
    { id: 'q1', text: '1. Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)' },
    { id: 'q2', text: '2. Não ser capaz de impedir ou de controlar as preocupações' },
    { id: 'q3', text: '3. Preocupar-se demais com diversas coisas' },
    { id: 'q4', text: '4. Dificuldade para relaxar' },
    { id: 'q5', text: '5. Ficar tão agitado(a) que se torna difícil ficar parado(a)' },
    { id: 'q6', text: '6. Ficar facilmente irritado(a) ou chateado(a)' },
    { id: 'q7', text: '7. Sentir medo como se algo horrível fosse acontecer' },
  ];

  const phq9Questions = [
    { id: 'q1', text: '1. Pouco interesse ou prazer em fazer as coisas' },
    { id: 'q2', text: '2. Sentir-se para baixo, deprimido(a) ou sem perspectiva' },
    { id: 'q3', text: '3. Dificuldade para adormecer, continuar dormindo ou dormir demais' },
    { id: 'q4', text: '4. Sentir-se cansado(a) ou com pouca energia' },
    { id: 'q5', text: '5. Falta de apetite ou comer demais' },
    { id: 'q6', text: '6. Sentir-se mal consigo mesmo(a) ou achar que é um fracasso' },
    { id: 'q7', text: '7. Dificuldade para se concentrar nas coisas (ler notícias ou ver TV)' },
    { id: 'q8', text: '8. Mover-se ou falar tão devagar que os outros notam, ou estar inquieto(a)' },
    { id: 'q9', text: '9. Pensamentos de que seria melhor estar morto(a) ou de se ferir de algum modo' },
  ];

  const answerOptions = [
    { value: 0, label: 'Nenhuma vez (0)' },
    { value: 1, label: 'Vários dias (1)' },
    { value: 2, label: 'Mais da metade dos dias (2)' },
    { value: 3, label: 'Quase todos os dias (3)' },
  ];

  const activeQuestions = activeScaleType === 'GAD7' ? gad7Questions : phq9Questions;
  const currentTotalScore = activeQuestions.reduce((sum, q) => sum + (scaleAnswers[q.id] || 0), 0);

  const getScaleSeverity = (type: 'GAD7' | 'PHQ9', score: number) => {
    if (type === 'GAD7') {
      if (score >= 15) return { label: 'Ansiedade Grave', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
      if (score >= 10) return { label: 'Ansiedade Moderada', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
      if (score >= 5) return { label: 'Ansiedade Leve', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' };
      return { label: 'Mínima / Normal', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
    } else {
      if (score >= 20) return { label: 'Depressão Grave', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
      if (score >= 15) return { label: 'Moderadamente Grave', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' };
      if (score >= 10) return { label: 'Depressão Moderada', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
      if (score >= 5) return { label: 'Depressão Leve', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' };
      return { label: 'Mínima / Remissão', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
    }
  };

  const handleScaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const unanswered = activeQuestions.some((q) => scaleAnswers[q.id] === undefined);
    if (unanswered) {
      showFeedback('Por favor, responda a todos os itens da escala para calcular o escore fidedigno.', 'error');
      return;
    }

    try {
      setIsSubmittingScale(true);
      await api.post('/scales', {
        patient_id: patient.id,
        scale_type: activeScaleType,
        answers: scaleAnswers,
      });

      const sev = getScaleSeverity(activeScaleType, currentTotalScore);
      showFeedback(
        `Escala ${activeScaleType} gravada com sucesso! Escore: ${currentTotalScore} (${sev.label}).`,
        'success'
      );
      setScaleAnswers({});
      setIsApplyingScale(false);
      fetchScales();
    } catch (err: any) {
      showFeedback(err.response?.data?.error || 'Erro ao registrar escala.', 'error');
    } finally {
      setIsSubmittingScale(false);
    }
  };

  // Filtered Evolutions
  const filteredRecords = useMemo(() => {
    return medicalRecords.filter((rec) => {
      // Filter by type
      if (filterType !== 'ALL' && rec.record_type !== filterType) return false;
      // Filter by signed
      if (filterSigned === 'SIGNED' && !rec.is_signed) return false;
      if (filterSigned === 'UNSIGNED' && rec.is_signed) return false;
      // Search text
      if (evolutionSearch.trim()) {
        const query = evolutionSearch.toLowerCase();
        const contentStr = JSON.stringify(rec.content || '').toLowerCase();
        const psych = (rec.psychologist_name || '').toLowerCase();
        return contentStr.includes(query) || psych.includes(query) || String(rec.id).includes(query);
      }
      return true;
    });
  }, [medicalRecords, filterType, filterSigned, evolutionSearch]);

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-2 p-3.5 rounded-xl border text-xs font-semibold shadow-xs animate-in fade-in transition ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800'
              : 'bg-teal-50 text-teal-900 border-teal-300 dark:bg-teal-950/80 dark:text-teal-200 dark:border-teal-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : feedback.type === 'error' ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Teleatendimento Online Banner (Resolução CFP nº 11/2018) */}
      <div className="p-4 rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-teal-500/10 dark:from-teal-950/40 dark:via-cyan-950/20 dark:to-teal-950/40 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Teleatendimento Psicológico Online
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  CFP 11/2018 (e-Psi)
                </span>
                {onlineSession?.video_status === 'ACTIVE' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Paciente Conectado
                  </span>
                )}
                {onlineSession?.video_status === 'OPEN' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                    {onlineSession?.video_provider === 'WHATSAPP' ? 'WhatsApp Vídeo Ativo' : 'Sala Aberta (Aguardando)'}
                  </span>
                )}
                {onlineSession?.video_status === 'FINISHED' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Encerrado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {onlineSession?.start_time
                  ? `Horário agendado: ${new Date(onlineSession.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Teleatendimento em conformidade CFP 11/2018`
                  : 'Sessão de videochamada privativa e criptografada com suporte a Sala Synapsis ou WhatsApp Vídeo.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onlineSession?.video_status === 'OPEN' || onlineSession?.video_status === 'ACTIVE' ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsVideoDockOpen(!isVideoDockOpen)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>{isVideoDockOpen ? 'Ocultar Painel de Vídeo' : 'Exibir Painel de Vídeo'}</span>
                </button>

                {onlineSession?.video_provider !== 'WHATSAPP' && (
                  <button
                    type="button"
                    onClick={() => window.open(`/teleconsulta/room?sessionId=${onlineSession.id}&role=psychologist`, `Teleconsulta_${onlineSession.id}`, 'width=1100,height=750')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
                    title="Abrir em janela destacada (ideal para monitor secundário)"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Janela Destacada</span>
                  </button>
                )}

                {videoPatientLink && onlineSession?.video_provider !== 'WHATSAPP' && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(videoPatientLink);
                      showFeedback('Link seguro do paciente copiado para a área de transferência!', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs transition cursor-pointer"
                    title="Copiar link de acesso para o paciente"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </button>
                )}

                {videoWhatsappUrl && (
                  <a
                    href={videoWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs"
                    title={onlineSession?.video_provider === 'WHATSAPP' ? 'Abrir conversa / chamada no WhatsApp' : 'Enviar link seguro no WhatsApp do paciente'}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{onlineSession?.video_provider === 'WHATSAPP' ? 'Abrir WhatsApp Web' : 'WhatsApp'}</span>
                  </a>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleActivateVideo('NATIVE')}
                  disabled={isActivatingVideo}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                  title="Abrir sala privativa Synapsis com câmera e anotações integradas"
                >
                  <Video className="w-4 h-4" />
                  <span>{isActivatingVideo ? 'Iniciando...' : 'Iniciar Sala Virtual Synapsis'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleActivateVideo('WHATSAPP')}
                  disabled={isActivatingVideo}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                  title="Chamar paciente via WhatsApp Vídeo com anotações e cronômetro ativos"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Atender via WhatsApp Vídeo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Split-screen wrapper when video dock is open and split-screen mode is active */}
      <div className={isVideoDockOpen && isSplitScreen ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 items-start' : 'space-y-6'}>
        <div className="space-y-6 min-w-0">
          {/* Clinical Sub-Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('evolutions')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'evolutions'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Evoluções Clínicas</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                subTab === 'evolutions'
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {medicalRecords.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('confidential')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'confidential'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
            }`}
          >
            <EyeOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Anotações Confidenciais (CFP)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                subTab === 'confidential'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
              }`}
            >
              {confidentialNotes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('documents')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'documents'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-900 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
            }`}
          >
            <FolderPlus className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Documentos & Anamnese</span>
            {patientDocCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  subTab === 'documents'
                    ? 'bg-purple-700 text-white'
                    : 'bg-purple-200/70 text-purple-900 dark:bg-purple-900/60 dark:text-purple-200'
                }`}
              >
                {patientDocCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('scales')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'scales'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 text-sky-900 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60'
            }`}
          >
            <Activity className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span>Escalas & Rastreio</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                subTab === 'scales'
                  ? 'bg-sky-700 text-white'
                  : 'bg-sky-200/70 text-sky-900 dark:bg-sky-900/60 dark:text-sky-200'
              }`}
            >
              {scales.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('evaluations')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'evaluations'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-900 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
            }`}
          >
            <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Avaliações & Laudos</span>
            {evaluationCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  subTab === 'evaluations'
                    ? 'bg-purple-700 text-white'
                    : 'bg-purple-200/70 text-purple-900 dark:bg-purple-900/60 dark:text-purple-200'
                }`}
              >
                {evaluationCount}
              </span>
            )}
          </button>
        </div>

        {/* Action Button for Current SubTab */}
        {subTab === 'evolutions' && (
          <button
            type="button"
            data-help-id="prontuario-evolution"
            data-tour="patient-new-evolution-btn"
            onClick={() => {
              setIsFormOpen(!isFormOpen);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            {isFormOpen ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{isFormOpen ? 'Fechar Formulário' : 'Nova Evolução'}</span>
          </button>
        )}

        {subTab === 'scales' && (
          <button
            type="button"
            onClick={() => setIsApplyingScale(!isApplyingScale)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            {isApplyingScale ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{isApplyingScale ? 'Fechar Questionário' : 'Aplicar Nova Escala'}</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. SUBTAB: EVOLUÇÕES CLÍNICAS */}
      {/* ========================================================= */}
      {subTab === 'evolutions' && (
        <div className="space-y-6">
          {/* Preparação da Próxima Sessão (Synapsis IA - Fase 2) */}
          <SessionPrepCard
            patientId={patient.id}
            patientName={patient.full_name}
            apiClient={api}
            onStartEvolution={(initialFocus) => {
              setIsFormOpen(true);
              if (initialFocus && !dapDados) {
                setDapDados(initialFocus);
              }
            }}
          />

          {/* New Evolution Collapsible Form */}
          {isFormOpen && (
            <div className="rounded-2xl border-2 border-teal-500/50 bg-white p-5 shadow-md dark:border-teal-500/40 dark:bg-slate-900 animate-in fade-in slide-in-from-top-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                    <FileSignature className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Registrar Nova Evolução Psicoterápica
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Criptografado at-rest com algoritmo AES-256-GCM.
                    </p>
                  </div>
                </div>

                {/* Record Type Selector */}
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setRecordType('DAP');
                      setActiveClinicalField('dados');
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      recordType === 'DAP'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    DAP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordType('BIRP');
                      setActiveClinicalField('behavior');
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      recordType === 'BIRP'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    BIRP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordType('FREE');
                      setActiveClinicalField('free');
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      recordType === 'FREE'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    Texto Livre
                  </button>
                </div>
              </div>

              {/* Scratchpad Notice & 1-Click Import */}
              {savedScratchpadText.trim() && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/10 border border-teal-500/30 dark:border-teal-500/20 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-teal-200">
                          Anotações do Live Scratchpad Disponíveis
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300">
                          {savedScratchpadText.length} caracteres
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 max-w-md">
                        "{savedScratchpadText}"
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleConsolidateFromScratchpad(savedScratchpadText)}
                      disabled={isConsolidatingScratchpad}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {isConsolidatingScratchpad ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Sintetizando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Estruturar no Prontuário com IA</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.removeItem(`psicogestao_scratchpad_${patient.id}`);
                        } catch {}
                        setSavedScratchpadText('');
                        showFeedback('Rascunho do Scratchpad descartado.', 'info');
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Descartar rascunho do Scratchpad"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Template Chips */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Modelos Rápidos:
                  </span>
                  <button
                    type="button"
                    onClick={() => applyTemplate('tcc_padrao')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
                  >
                    Sessão TCC / RPD
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('acolhimento')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
                  >
                    Acolhimento / Inicial
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('crise')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
                  >
                    Manejo de Crise
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('alta')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
                  >
                    Encerramento / Alta
                  </button>
                </div>

                {/* Botão Reverter / Limpar Campos em Branco */}
                {(dapDados || dapAvaliacao || dapPlano || birpBehavior || birpIntervention || birpResponse || birpPlan || freeText) && (
                  <button
                    type="button"
                    onClick={clearEvolutionFields}
                    title="Limpar todos os campos e deixar o prontuário em branco"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 transition cursor-pointer animate-in fade-in"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Limpar Campos (Em Branco)</span>
                  </button>
                )}
              </div>

              {/* Barra de Inteligência Clínica (Synapsis IA) */}
              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <AiClinicalToolbar
                  patientId={patient.id}
                  patientName={patient.full_name}
                  activeFieldName={activeFieldLabel}
                  activeText={currentFieldText}
                  onTextChange={handleActiveFieldTextChange}
                  onApplyEvolutionFields={(evo) => {
                    if (evo.dap) {
                      setRecordType('DAP');
                      setActiveClinicalField('dados');
                      setDapDados(evo.dap.dados);
                      setDapAvaliacao(evo.dap.avaliacao);
                      setDapPlano(evo.dap.plano);
                      showFeedback('Evolução DAP preenchida com apoio da IA. Revise os campos antes de assinar.', 'info');
                    } else if (evo.freeText) {
                      setRecordType('FREE');
                      setActiveClinicalField('free');
                      setFreeText(evo.freeText);
                      showFeedback('Evolução em Texto Livre preenchida com apoio da IA. Revise antes de assinar.', 'info');
                    }
                  }}
                  apiClient={api}
                  showEvolutionGenerator={true}
                />
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreateRecord} noValidate={isSandboxActive} className="mt-4 space-y-4">
                {/* DAP Form */}
                {recordType === 'DAP' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-800 dark:text-slate-200">
                          [D] DADOS (Relato subjetivo do paciente e observações clínicas objetivas) *
                        </label>
                        {activeClinicalField === 'dados' && (
                          <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                            ● Campo focado para IA / Ditado
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        placeholder="Ex: Paciente relata melhora na ansiedade durante reuniões de trabalho..."
                        value={dapDados}
                        onFocus={() => setActiveClinicalField('dados')}
                        onChange={(e) => setDapDados(e.target.value)}
                        className={`w-full rounded-xl border p-3 dark:bg-slate-950 dark:text-white focus:outline-hidden leading-relaxed transition ${
                          activeClinicalField === 'dados'
                            ? 'border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-400'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                        required={!isSandboxActive}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-800 dark:text-slate-200">
                          [A] AVALIAÇÃO (Análise técnica, hipóteses e respostas às intervenções) *
                        </label>
                        {activeClinicalField === 'avaliacao' && (
                          <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                            ● Campo focado para IA / Ditado
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        placeholder="Ex: Demonstra maior insight sobre pensamentos automáticos de autocobrança..."
                        value={dapAvaliacao}
                        onFocus={() => setActiveClinicalField('avaliacao')}
                        onChange={(e) => setDapAvaliacao(e.target.value)}
                        className={`w-full rounded-xl border p-3 dark:bg-slate-950 dark:text-white focus:outline-hidden leading-relaxed transition ${
                          activeClinicalField === 'avaliacao'
                            ? 'border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-400'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                        required={!isSandboxActive}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-800 dark:text-slate-200">
                          [P] PLANO (Metas terapêuticas, tarefas intersessões e encaminhamentos) *
                        </label>
                        {activeClinicalField === 'plano' && (
                          <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                            ● Campo focado para IA / Ditado
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        placeholder="Ex: Registro de pensamentos disfuncionais diário; continuação do protocolo de regulação emocional..."
                        value={dapPlano}
                        onFocus={() => setActiveClinicalField('plano')}
                        onChange={(e) => setDapPlano(e.target.value)}
                        className={`w-full rounded-xl border p-3 dark:bg-slate-950 dark:text-white focus:outline-hidden leading-relaxed transition ${
                          activeClinicalField === 'plano'
                            ? 'border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-400'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                        required={!isSandboxActive}
                      />
                    </div>
                  </div>
                )}

                {/* BIRP Form */}
                {recordType === 'BIRP' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-800 dark:text-slate-200">
                          [B] BEHAVIOR (Comportamento observado e relato da queixa) *
                        </label>
                        {activeClinicalField === 'behavior' && (
                          <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                            ● Campo focado para IA / Ditado
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={birpBehavior}
                        onFocus={() => setActiveClinicalField('behavior')}
                        onChange={(e) => setBirpBehavior(e.target.value)}
                        className={`w-full rounded-xl border p-3 dark:bg-slate-950 dark:text-white focus:outline-hidden leading-relaxed transition ${
                          activeClinicalField === 'behavior'
                            ? 'border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-400'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                        required={!isSandboxActive}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-800 dark:text-slate-200">
                          [I] INTERVENTION (Intervenções técnicas do psicólogo) *
                        </label>
                        {activeClinicalField === 'intervention' && (
                          <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                            ● Campo focado para IA / Ditado
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={birpIntervention}
                        onFocus={() => setActiveClinicalField('intervention')}
                        onChange={(e) => setBirpIntervention(e.target.value)}
                        className={`w-full rounded-xl border p-3 dark:bg-slate-950 dark:text-white focus:outline-hidden leading-relaxed transition ${
                          activeClinicalField === 'intervention'
                            ? 'border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-400'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                        required={!isSandboxActive}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-800 dark:text-slate-200">
                          [R] RESPONSE (Resposta do paciente às intervenções) *
                        </label>
                        {activeClinicalField === 'response' && (
                          <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                            ● Campo focado para IA / Ditado
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={birpResponse}
                        onFocus={() => setActiveClinicalField('response')}
                        onChange={(e) => setBirpResponse(e.target.value)}
                        className={`w-full rounded-xl border p-3 dark:bg-slate-950 dark:text-white focus:outline-hidden leading-relaxed transition ${
                          activeClinicalField === 'response'
                            ? 'border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-400'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                        required={!isSandboxActive}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-800 dark:text-slate-200">
                          [P] PLAN (Plano para as próximas sessões) *
                        </label>
                        {activeClinicalField === 'plan' && (
                          <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                            ● Campo focado para IA / Ditado
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={birpPlan}
                        onFocus={() => setActiveClinicalField('plan')}
                        onChange={(e) => setBirpPlan(e.target.value)}
                        className={`w-full rounded-xl border p-3 dark:bg-slate-950 dark:text-white focus:outline-hidden leading-relaxed transition ${
                          activeClinicalField === 'plan'
                            ? 'border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-400'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                        required={!isSandboxActive}
                      />
                    </div>
                  </div>
                )}

                {/* Free Text Form */}
                {recordType === 'FREE' && (
                  <div className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800 dark:text-slate-200">
                        Evolução Clínica Livre *
                      </label>
                      {activeClinicalField === 'free' && (
                        <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                          ● Campo focado para IA / Ditado
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={6}
                      placeholder="Redija a evolução da sessão detalhadamente..."
                      value={freeText}
                      onFocus={() => setActiveClinicalField('free')}
                      onChange={(e) => setFreeText(e.target.value)}
                      className={`w-full rounded-xl border p-3 dark:bg-slate-950 dark:text-white focus:outline-hidden leading-relaxed transition ${
                        activeClinicalField === 'free'
                          ? 'border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-400'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      required={!isSandboxActive}
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    data-tour="save-evolution-btn"
                    formNoValidate={isSandboxActive}
                    disabled={isSubmittingRecord}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition cursor-pointer"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>{isSubmittingRecord ? 'Criptografando...' : 'Salvar Criptografado (AES-256)'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar nas evoluções (conteúdo, data, CRP)..."
                value={evolutionSearch}
                onChange={(e) => setEvolutionSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-950 dark:text-white focus:border-teal-500 focus:outline-hidden"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 focus:border-teal-500 focus:outline-hidden cursor-pointer shadow-2xs"
              >
                <option value="ALL">Todos os Formatos</option>
                <option value="DAP">Apenas DAP</option>
                <option value="BIRP">Apenas BIRP</option>
                <option value="FREE">Apenas Texto Livre</option>
              </select>

              {/* Signed Filter */}
              <select
                value={filterSigned}
                onChange={(e) => setFilterSigned(e.target.value as any)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 focus:border-teal-500 focus:outline-hidden cursor-pointer shadow-2xs"
              >
                <option value="ALL">Todas as Assinaturas</option>
                <option value="SIGNED">Apenas Assinados (SHA-256)</option>
                <option value="UNSIGNED">Pendentes de Assinatura</option>
              </select>
            </div>
          </div>

          {/* Records Timeline List */}
          {isLoadingRecords ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              <span>Decriptando registros com chave AES-256-GCM...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-3">
              <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {medicalRecords.length === 0
                  ? 'Nenhuma evolução registrada para este paciente até o momento.'
                  : 'Nenhuma evolução corresponde aos filtros de busca aplicados.'}
              </p>
              {medicalRecords.length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsFormOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Cadastrar Primeira Evolução</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecords.map((record) => (
                <div
                  key={record.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                >
                  {/* Top Bar of Record */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                        {record.record_type}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Sessão #{record.id}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(record.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Copy record button */}
                      <button
                        type="button"
                        onClick={() => handleCopyRecord(record)}
                        title="Copiar texto da evolução"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                      >
                        {copiedRecordId === record.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {/* Signature status / action */}
                      {record.is_signed ? (
                        <div
                          data-help-id="prontuario-sha256"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 cursor-pointer"
                          title="Prontuário assinado digitalmente com SHA-256"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Assinado Digitalmente</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          data-help-id="prontuario-sha256"
                          onClick={() => handleSignRecord(record.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-2xs transition cursor-pointer"
                          title="Assinar com carimbo SHA-256 e selo CRP"
                        >
                          <FileSignature className="h-3.5 w-3.5" />
                          <span>Assinar e Bloquear</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="mt-4 space-y-3 text-xs leading-relaxed">
                    {record.record_type === 'DAP' && (
                      <div className="space-y-2.5">
                        <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-3 border border-slate-100 dark:border-slate-800">
                          <span className="font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide text-[10px] block mb-1">
                            [D] DADOS (Relato / Observações):
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                            {record.content?.dados || 'Sem dados informados'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-3 border border-slate-100 dark:border-slate-800">
                          <span className="font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide text-[10px] block mb-1">
                            [A] AVALIAÇÃO (Interpretação Clínica):
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                            {record.content?.avaliacao || 'Sem avaliação informada'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-3 border border-slate-100 dark:border-slate-800">
                          <span className="font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide text-[10px] block mb-1">
                            [P] PLANO (Próximos Passos):
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                            {record.content?.plano || 'Sem plano informado'}
                          </p>
                        </div>
                      </div>
                    )}

                    {record.record_type === 'BIRP' && (
                      <div className="space-y-2.5">
                        <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-3 border border-slate-100 dark:border-slate-800">
                          <span className="font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide text-[10px] block mb-1">
                            [B] BEHAVIOR (Comportamento):
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                            {record.content?.behavior || 'Sem dados informados'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-3 border border-slate-100 dark:border-slate-800">
                          <span className="font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide text-[10px] block mb-1">
                            [I] INTERVENTION (Intervenção):
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                            {record.content?.intervention || 'Sem intervenção informada'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-3 border border-slate-100 dark:border-slate-800">
                          <span className="font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide text-[10px] block mb-1">
                            [R] RESPONSE (Resposta):
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                            {record.content?.response || 'Sem resposta informada'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-3 border border-slate-100 dark:border-slate-800">
                          <span className="font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide text-[10px] block mb-1">
                            [P] PLAN (Plano):
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                            {record.content?.plano || 'Sem plano informado'}
                          </p>
                        </div>
                      </div>
                    )}

                    {record.record_type === 'FREE' && (
                      <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-3 border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {record.content?.raw || ''}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer Bar: Terapeuta, CRP, Hash SHA-256 */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <User className="h-3 w-3 text-slate-400" />
                      <span>
                        Terapeuta: <strong className="text-slate-700 dark:text-slate-200">{record.psychologist_name}</strong>
                      </span>
                      <span>({record.psychologist_crp || 'CRP Ativo'})</span>
                    </div>

                    {record.hash_sha256 ? (
                      <div className="inline-flex items-center gap-1 font-mono text-[10px] bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 max-w-xs truncate">
                        <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>SHA256: {record.hash_sha256}</span>
                      </div>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium text-[10px]">
                        Pendente de assinatura digital (editável)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. SUBTAB: ANOTAÇÕES CONFIDENCIAIS (CFP 01/2009) */}
      {/* ========================================================= */}
      {subTab === 'confidential' && (
        <div className="space-y-6">
          {/* Banner Explicativo de Sigilo CFP */}
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-4.5 text-xs text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100 text-sm">
              <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Anotações Confidenciais do Terapeuta — Resolução CFP nº 01/2009 & Art. 9º</span>
            </div>
            <p className="leading-relaxed text-amber-900/90 dark:text-amber-200/90">
              Espaço de <strong>sigilo profissional absoluto</strong> privativo do psicólogo responsável. Utilizado para impressões subjetivas, formulação de hipóteses diagnósticas e anotações para supervisão clínica.
              <strong className="block mt-1">
                Atenção: Estas notas NÃO integram o prontuário público fornecido ao paciente e NÃO são expedidas em atestados, laudos ou relatórios.
              </strong>
            </p>
          </div>

          {/* New Note Composer */}
          <form
            onSubmit={handleSaveConfidential}
            className="rounded-2xl border border-amber-200 bg-white p-5 shadow-xs dark:border-amber-900/60 dark:bg-slate-900/80 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Nova Anotação Confidencial (Criptografada e protegida):
              </label>
              <AiClinicalToolbar
                patientId={patient.id}
                patientName={patient.full_name}
                activeText={newConfidentialText}
                onTextChange={setNewConfidentialText}
                apiClient={api}
                showEvolutionGenerator={false}
              />
            </div>
            <textarea
              rows={4}
              placeholder="Ex: Hipóteses preliminares sobre histórico vincular, dinâmicas transferenciais a discutir em supervisão clínica..."
              value={newConfidentialText}
              onChange={(e) => setNewConfidentialText(e.target.value)}
              className="w-full rounded-xl border border-amber-200 bg-amber-50/20 p-3.5 text-xs dark:border-amber-900 dark:bg-slate-950 dark:text-white focus:border-amber-500 focus:outline-hidden leading-relaxed"
              required
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSavingConfidential}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>{isSavingConfidential ? 'Gravando...' : 'Gravar com Sigilo Absoluto'}</span>
              </button>
            </div>
          </form>

          {/* Timeline of Confidential Notes */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <EyeOff className="h-3.5 w-3.5 text-amber-600" />
              <span>Histórico de Anotações Confidenciais Guardadas ({confidentialNotes.length})</span>
            </h4>

            {isLoadingConfidential ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Carregando notas confidenciais...
              </div>
            ) : confidentialNotes.length === 0 ? (
              <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-xs text-slate-400 italic">
                Nenhuma anotação confidencial registrada para este paciente ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {confidentialNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4.5 text-xs dark:border-amber-900/50 dark:bg-amber-950/20 space-y-2"
                  >
                    <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                    <div className="pt-2 border-t border-amber-100 dark:border-amber-900/40 flex items-center justify-between text-[10px] text-amber-800 dark:text-amber-400">
                      <span>Registrado em: {new Date(note.created_at).toLocaleString('pt-BR')}</span>
                      <span className="font-bold flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Privativo do Terapeuta Autor
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SUBTAB: DOCUMENTOS & ANAMNESE */}
      {/* ========================================================= */}
      {subTab === 'documents' && (
        <div className="animate-in fade-in">
          <PatientDocumentsTab
            patient={patient}
            onDocumentCountChange={setPatientDocCount}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SUBTAB: ESCALAS & RASTREIO (PHQ-9 / GAD-7) */}
      {/* ========================================================= */}
      {subTab === 'scales' && (
        <div className="space-y-6">
          {/* Applying New Scale Questionnaire */}
          {isApplyingScale && (
            <div className="rounded-2xl border-2 border-sky-500/50 bg-white p-5 shadow-md dark:border-sky-500/40 dark:bg-slate-900 animate-in fade-in slide-in-from-top-3 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Aplicação de Instrumento Psicométrico
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Rastreio padronizado com pontuação em tempo real.
                    </p>
                  </div>
                </div>

                {/* Scale Switcher */}
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveScaleType('GAD7');
                      setScaleAnswers({});
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      activeScaleType === 'GAD7'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    GAD-7 (Ansiedade)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveScaleType('PHQ9');
                      setScaleAnswers({});
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      activeScaleType === 'PHQ9'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    PHQ-9 (Depressão)
                  </button>
                </div>
              </div>

              {/* Running Score Meter */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Escore Calculado:
                  </span>
                  <span className="text-base font-extrabold text-sky-700 dark:text-sky-300 font-mono">
                    {currentTotalScore}
                  </span>
                  <span className="text-xs text-slate-400">
                    / {activeScaleType === 'GAD7' ? '21' : '27'}
                  </span>
                </div>
                <div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      getScaleSeverity(activeScaleType, currentTotalScore).badge
                    }`}
                  >
                    {getScaleSeverity(activeScaleType, currentTotalScore).label}
                  </span>
                </div>
              </div>

              {/* Questions Form */}
              <form onSubmit={handleScaleSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                  Nas últimas 2 semanas, com que frequência você tem sido incomodado(a) por qualquer um dos seguintes problemas?
                </p>

                <div className="space-y-3">
                  {activeQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40 space-y-2"
                    >
                      <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {q.text}
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {answerOptions.map((opt) => {
                          const isSelected = scaleAnswers[q.id] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setScaleAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition cursor-pointer ${
                                isSelected
                                  ? 'border-sky-600 bg-sky-600 text-white shadow-xs font-bold'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsApplyingScale(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingScale}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{isSubmittingScale ? 'Salvando...' : 'Gravar Resultado no Histórico'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Past Scales History */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-sky-600" />
              <span>Histórico de Aplicações de Escalas ({scales.length})</span>
            </h4>

            {isLoadingScales ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Carregando histórico de escalas psicométricas...
              </div>
            ) : scales.length === 0 ? (
              <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-xs text-slate-400 italic">
                Nenhuma escala aplicada para este paciente ainda. Clique em "Aplicar Nova Escala" para iniciar.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scales.map((s) => {
                  const severity = getScaleSeverity(s.scale_type as any, s.total_score);
                  return (
                    <div
                      key={s.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            {s.scale_type}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Aplicação #{s.id}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${severity.badge}`}>
                          {s.severity || severity.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Pontuação Total:</span>
                        <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                          {s.total_score} pts
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Data: {new Date(s.created_at).toLocaleString('pt-BR')}</span>
                        <span className="text-teal-600 dark:text-teal-400 font-semibold">CFP Conforme</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SUBTAB: AVALIAÇÕES NEUROPSICOLÓGICAS & LAUDOS FECHADOS */}
      {/* ========================================================= */}
      {subTab === 'evaluations' && (
        <div className="animate-in fade-in">
          <PatientEvaluationsSubTab patient={patient} />
        </div>
      )}
        </div>

        {/* Right Column: VideoDockPanel when Split Screen is active */}
        {isVideoDockOpen && isSplitScreen && onlineSession && (
          <div className="sticky top-6">
            <VideoDockPanel
              key={`dock_${onlineSession.id}_${onlineSession.video_provider || 'NATIVE'}`}
              session={onlineSession}
              onClose={() => setIsVideoDockOpen(false)}
              onEndVideo={handleEndVideo}
              patientLink={videoPatientLink}
              whatsappUrl={videoWhatsappUrl}
              isSplitScreen={isSplitScreen}
              onToggleSplitScreen={() => setIsSplitScreen(false)}
              onApplyEvolution={handleApplyConsolidatedEvolution}
            />
          </div>
        )}
      </div>

      {/* Floating Picture-in-Picture when Split Screen is toggled off */}
      {isVideoDockOpen && !isSplitScreen && onlineSession && (
        <div className="fixed bottom-6 right-6 z-50 w-[460px] max-w-[90vw] shadow-2xl rounded-2xl overflow-hidden border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <VideoDockPanel
            key={`float_${onlineSession.id}_${onlineSession.video_provider || 'NATIVE'}`}
            session={onlineSession}
            onClose={() => setIsVideoDockOpen(false)}
            onEndVideo={handleEndVideo}
            patientLink={videoPatientLink}
            whatsappUrl={videoWhatsappUrl}
            isSplitScreen={isSplitScreen}
            onToggleSplitScreen={() => setIsSplitScreen(true)}
            onApplyEvolution={handleApplyConsolidatedEvolution}
          />
        </div>
      )}
    </div>
  );
};
