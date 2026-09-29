import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Camera,
  Sparkles,
  Zap,
  Headphones,
} from 'lucide-react';
import { AiReviewModal, AiModalMode } from './AiReviewModal.js';
import { SessionAudioModal } from './SessionAudioModal.js';

export interface AiClinicalToolbarProps {
  patientId: number;
  patientName: string;
  activeText: string;
  onTextChange: (newText: string) => void;
  activeFieldName?: string;
  onApplyEvolutionFields?: (evolution: {
    dap?: { dados: string; avaliacao: string; plano: string };
    soap?: { subjetivo: string; objetivo: string; avaliacao: string; plano: string };
    freeText?: string;
  }) => void;
  apiClient: any;
  showEvolutionGenerator?: boolean;
  className?: string;
}

export const AiClinicalToolbar: React.FC<AiClinicalToolbarProps> = ({
  patientId,
  patientName,
  activeText,
  onTextChange,
  activeFieldName,
  onApplyEvolutionFields,
  apiClient,
  showEvolutionGenerator = true,
  className = '',
}) => {
  // Voice Dictation state
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');

  // Modal review state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<AiModalMode>('FORMAT_TEXT');
  const [audioModalOpen, setAudioModalOpen] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const toggleRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        'O recurso de Ditado por Voz utiliza a Web Speech API, suportada nativamente no Google Chrome, Microsoft Edge e Safari. Para usar o microfone, acesse por um desses navegadores.'
      );
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;

      // Captura o texto atual exato do campo antes de iniciar a fala
      const current = (activeText || '').trim();
      baseTextRef.current = current ? current + ' ' : '';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }

        if (transcript) {
          onTextChange(baseTextRef.current + transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Permissão de acesso ao microfone negada no navegador. Por favor, habilite o microfone nas permissões da página.');
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsRecording(false);
    }
  };

  const openFormatModal = () => {
    setModalMode('FORMAT_TEXT');
    setModalOpen(true);
  };

  const openOcrModal = () => {
    setModalMode('OCR_HANDWRITING');
    setModalOpen(true);
  };

  const openEvolutionModal = () => {
    setModalMode('COMPARATIVE_EVOLUTION');
    setModalOpen(true);
  };

  return (
    <>
      <div
        className={`flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 ${className}`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 px-2 text-[10px] font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
            <Sparkles className="h-3 w-3 text-teal-600 dark:text-teal-400" />
            Synapsis IA
          </span>

          {activeFieldName && (
            <span className="px-2 py-0.5 rounded-md bg-teal-100/70 text-teal-900 dark:bg-teal-950 dark:text-teal-200 text-[10px] font-semibold">
              Destino: <strong>{activeFieldName}</strong>
            </span>
          )}

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* 1. Botão Ditar por Voz */}
          <button
            type="button"
            onClick={toggleRecording}
            title={
              isRecording
                ? 'Clique para parar a gravação'
                : `Ditar com voz ${activeFieldName ? `no campo ${activeFieldName}` : ''}`
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-500/30'
                : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 shadow-2xs'
            }`}
          >
            {isRecording ? (
              <>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <MicOff className="h-3.5 w-3.5" />
                <span>Gravando {activeFieldName ? `(${activeFieldName})` : ''}...</span>
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5 text-rose-500" />
                <span>Ditar {activeFieldName ? `(${activeFieldName})` : ''}</span>
              </>
            )}
          </button>

          {/* 2. Botão Escanear Manuscrito */}
          <button
            type="button"
            onClick={openOcrModal}
            title="Digitalizar foto de anotação manuscrita ou prontuário físico com IA"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/70 dark:border-slate-700 shadow-2xs transition cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5 text-indigo-500" />
            <span>Escanear Foto</span>
          </button>

          {/* 3. Botão Formatar Texto */}
          <button
            type="button"
            onClick={openFormatModal}
            title={`Revisar e aprimorar texto ${activeFieldName ? `de ${activeFieldName}` : ''} com padrão CFP`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/70 dark:border-slate-700 shadow-2xs transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Formatar com IA</span>
          </button>

          {/* 4. Botão Transcrever Sessão Completa (Fase 2) */}
          <button
            type="button"
            onClick={() => setAudioModalOpen(true)}
            title="Gravar ou carregar áudio da sessão para transcrição estruturada com política Zero-Retention"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/70 dark:border-slate-700 shadow-2xs transition cursor-pointer"
          >
            <Headphones className="h-3.5 w-3.5 text-indigo-500" />
            <span>Transcrever Sessão</span>
          </button>
        </div>

        {/* 5. Botão Gerar Evolução CFP (N-1 vs N) */}
        {showEvolutionGenerator && onApplyEvolutionFields && (
          <button
            type="button"
            onClick={openEvolutionModal}
            title="Comparar com a sessão anterior e gerar rascunho de evolução nos campos do prontuário"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs shadow-teal-600/20 transition cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            <span>Gerar Evolução CFP</span>
          </button>
        )}
      </div>

      {/* Modal de Revisão & Aprovação Profissional */}
      <AiReviewModal
        isOpen={modalOpen}
        mode={modalMode}
        onClose={() => setModalOpen(false)}
        patientName={patientName}
        patientId={patientId}
        initialText={activeText}
        onApplyText={(formatted) => {
          onTextChange(formatted);
        }}
        onApplyEvolution={(evolution) => {
          if (onApplyEvolutionFields) {
            onApplyEvolutionFields(evolution);
          }
        }}
        apiClient={apiClient}
      />

      {/* Modal de Transcrição de Sessão (Zero-Retention) */}
      <SessionAudioModal
        isOpen={audioModalOpen}
        onClose={() => setAudioModalOpen(false)}
        patientName={patientName}
        patientId={patientId}
        apiClient={apiClient}
        onApplyToEvolution={(draft) => {
          if (onApplyEvolutionFields && (draft.dap || draft.soap)) {
            onApplyEvolutionFields({
              dap: draft.dap,
              soap: draft.soap,
              freeText: draft.summary,
            });
          }
        }}
      />
    </>
  );
};
