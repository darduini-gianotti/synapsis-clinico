import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Upload,
  Headphones,
  ShieldCheck,
  AlertCircle,
  Check,
  X,
  Sparkles,
  FileText,
  Clock,
  Volume2,
  Lock,
  ArrowRight,
  ListOrdered,
} from 'lucide-react';
import { SessionAudioTranscriptionResponse } from '../../../server/aiService.js';

interface SessionAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: number;
  patientName?: string;
  apiClient: any;
  onApplyToEvolution?: (draft: {
    dap?: { dados: string; avaliacao: string; plano: string };
    soap?: { subjetivo: string; objetivo: string; avaliacao: string; plano: string };
    summary?: string;
  }) => void;
}

export const SessionAudioModal: React.FC<SessionAudioModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  apiClient,
  onApplyToEvolution,
}) => {
  const [sessionType, setSessionType] = useState<'PRESENCIAL' | 'ONLINE'>('PRESENCIAL');
  const [tcleConfirmed, setTcleConfirmed] = useState<boolean>(false);

  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string>('audio/webm');

  // Processing state
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SessionAudioTranscriptionResponse | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'dap' | 'topics' | 'soap'>('dap');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setAudioBlob(null);
      setAudioUrl(null);
      setResult(null);
      setErrorMessage(null);
      setRecordingSeconds(0);
      setIsRecording(false);
    } else {
      stopRecordingCleanup();
    }
  }, [isOpen]);

  // Timer for recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startRecording = async () => {
    if (!tcleConfirmed) {
      setErrorMessage('Por favor, confirme a ciência e consentimento ético do paciente antes de iniciar a gravação.');
      return;
    }
    try {
      setErrorMessage(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      setAudioMime(mimeType);
      
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(fullBlob);
        setAudioUrl(URL.createObjectURL(fullBlob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingSeconds(0);
    } catch (err: any) {
      console.error('Failed to access microphone:', err);
      setErrorMessage('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i)) {
      setErrorMessage('Selecione um arquivo de áudio válido (MP3, WAV, M4A, WEBM, OGG).');
      return;
    }

    setErrorMessage(null);
    setAudioMime(file.type || 'audio/webm');
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        resolve(res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleProcessAudio = async () => {
    if (!audioBlob) {
      setErrorMessage('Nenhum áudio disponível para transcrever.');
      return;
    }
    if (!tcleConfirmed) {
      setErrorMessage('O consentimento ético (TCLE) é obrigatório para processar o áudio.');
      return;
    }

    try {
      setIsTranscribing(true);
      setErrorMessage(null);

      const base64Data = await blobToBase64(audioBlob);

      const res = await apiClient.post('/ai/transcribe-session', {
        audioBase64: base64Data,
        mimeType: audioMime,
        sessionType,
        tcleConfirmed: true,
        patientId,
      });

      setResult(res.data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.response?.data?.error || 'Erro ao processar transcrição da sessão com IA.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-linear-to-r from-teal-50/80 via-white to-indigo-50/60 dark:from-teal-950/30 dark:via-slate-900 dark:to-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-teal-600 text-white shadow-md shadow-indigo-500/20">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Transcrição Clínica de Sessão (Zero-Retention)
                </h3>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
                  Synapsis IA • Fase 2
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {patientName ? `Paciente: ${patientName}` : 'Atendimento Psicológico'} • Resoluções CFP 01/2009 e 06/2019
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Seletor de Modalidade & TCLE */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Modalidade de Atendimento:
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSessionType('PRESENCIAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    sessionType === 'PRESENCIAL'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  🏢 Consulta Presencial
                </button>
                <button
                  type="button"
                  onClick={() => setSessionType('ONLINE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    sessionType === 'ONLINE'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  🌐 Telepsicologia (Online)
                </button>
              </div>
            </div>

            {/* Checkbox de Consentimento Ético (TCLE) */}
            <label className="flex items-start gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={tcleConfirmed}
                onChange={(e) => setTcleConfirmed(e.target.checked)}
                className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                <strong>Confirmação de Consentimento Ético (TCLE):</strong> Confirmo que o paciente foi informado e deu consentimento formal/verbal para o registro e transcrição clínica nos termos do Código de Ética Profissional e da LGPD.
              </span>
            </label>
          </div>

          {/* Se ainda não processou o áudio: Interface de Gravação / Upload */}
          {!result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Coluna 1: Gravação em Tempo Real */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-center space-y-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full transition-all ${
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                      : 'bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400'
                  }`}
                >
                  <Mic className="h-8 w-8" />
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {isRecording ? 'Gravando Sessão...' : 'Gravar com Microfone'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isRecording
                      ? `Tempo decorrido: ${formatTimer(recordingSeconds)}`
                      : 'Capte o áudio do ambiente ou dispositivo'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={!tcleConfirmed}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mic className="h-4 w-4" />
                      <span>Iniciar Gravação</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition cursor-pointer"
                    >
                      <Square className="h-4 w-4 fill-current" />
                      <span>Parar Gravação ({formatTimer(recordingSeconds)})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Coluna 2: Upload de Arquivo Pré-Gravado */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Upload className="h-8 w-8" />
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Carregar Áudio Pré-Gravado
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    MP3, WAV, M4A, WEBM ou OGG gravado no celular
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-2xs transition cursor-pointer">
                  <Upload className="h-4 w-4 text-indigo-500" />
                  <span>Escolher Arquivo de Áudio</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Player de áudio pronto para transcrição */}
          {audioUrl && !result && (
            <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Volume2 className="h-5 w-5 text-teal-600 shrink-0" />
                <audio controls src={audioUrl} className="h-8 max-w-full" />
              </div>

              <button
                type="button"
                onClick={handleProcessAudio}
                disabled={isTranscribing || !tcleConfirmed}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`h-4 w-4 ${isTranscribing ? 'animate-spin' : ''}`} />
                <span>{isTranscribing ? 'Transcrevendo com IA...' : 'Sintetizar & Gerar Evolução'}</span>
              </button>
            </div>
          )}

          {/* Banner de Garantia Zero-Retention */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
            <Lock className="h-4 w-4 text-teal-600 shrink-0" />
            <span>
              <strong>Protocolo LGPD Zero-Retention:</strong> O áudio é sintetizado exclusivamente em memória volátil e é <strong>imediatamente descartado</strong>. Nenhum dado biométrico de voz é persistido em disco ou na nuvem.
            </span>
          </div>

          {/* Visualização dos Resultados Estruturados da Transcrição */}
          {result && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Resumo Executivo */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide block mb-1">
                  Síntese Clínica Executiva:
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                  {result.executiveSummary}
                </p>
                {result.patientAffect && (
                  <span className="inline-block mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    🎭 <strong>Afeto & Postura:</strong> {result.patientAffect}
                  </span>
                )}
              </div>

              {/* Seletor de visualização do resultado */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveResultTab('dap')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeResultTab === 'dap'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  📋 Estrutura DAP (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveResultTab('topics')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeResultTab === 'topics'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  📑 Tópicos & Tarefas Acordadas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveResultTab('soap')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeResultTab === 'soap'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  📝 Estrutura SOAP
                </button>
              </div>

              {/* Aba DAP */}
              {activeResultTab === 'dap' && result.dapDraft && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      [D] Dados Factuais & Relatos:
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {result.dapDraft.dados}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      [A] Avaliação Clínica & Hipóteses:
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {result.dapDraft.avaliacao}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      [P] Plano Terapêutico & Encaminhamentos:
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {result.dapDraft.plano}
                    </p>
                  </div>
                </div>
              )}

              {/* Aba Tópicos & Tarefas */}
              {activeResultTab === 'topics' && (
                <div className="space-y-3 text-xs">
                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      Principais Temas Explorados:
                    </h5>
                    {result.mainTopics.map((topic, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
                      >
                        <span className="font-bold text-slate-800 dark:text-slate-100 block mb-0.5">
                          {topic.title}
                        </span>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                          {topic.details}
                        </p>
                      </div>
                    ))}
                  </div>

                  {result.agreementsAndHomework && result.agreementsAndHomework.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                      <span className="font-bold text-amber-900 dark:text-amber-200 block mb-1.5">
                        📌 Tarefas e Combinações para a Próxima Sessão:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                        {result.agreementsAndHomework.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Aba SOAP */}
              {activeResultTab === 'soap' && result.soapDraft && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      [S] Subjetivo:
                    </span>
                    <p className="text-slate-600 dark:text-slate-300">{result.soapDraft.subjetivo}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      [O] Objetivo:
                    </span>
                    <p className="text-slate-600 dark:text-slate-300">{result.soapDraft.objetivo}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      [A] Avaliação:
                    </span>
                    <p className="text-slate-600 dark:text-slate-300">{result.soapDraft.avaliacao}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      [P] Plano:
                    </span>
                    <p className="text-slate-600 dark:text-slate-300">{result.soapDraft.plano}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Apoio documental estenográfico. Revisão clínica privativa do profissional (CFP 09/2024).
          </span>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Fechar
            </button>

            {result && onApplyToEvolution && (
              <button
                type="button"
                onClick={() => {
                  onApplyToEvolution({
                    dap: result.dapDraft,
                    soap: result.soapDraft,
                    summary: result.executiveSummary,
                  });
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>Aplicar no Prontuário (DAP)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
