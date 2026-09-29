import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  FileSignature,
} from 'lucide-react';
import { api } from '../../../services/api.js';
import { MobileSessionItem } from './MobileSessionCard.js';

interface MobileQuickEvolutionModalProps {
  session: MobileSessionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MobileQuickEvolutionModal: React.FC<MobileQuickEvolutionModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [content, setContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'pt-BR';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
            setContent((prev) => (prev ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim()));
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      } else {
        setSpeechSupported(false);
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Reconhecimento de voz não suportado neste navegador. Digite o texto manualmente.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setError(null);
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        setIsRecording(false);
      }
    }
  };

  const handleSave = async () => {
    if (!session || !content.trim()) {
      setError('Por favor, digite ou dite o registro da evolução.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Envia para a API de evoluções
      await api.post(`/patients/${session.patient_id}/evolutions`, {
        session_id: session.id,
        content: content.trim(),
        evolution_type: 'CONSULTATION',
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Falha ao salvar evolução:', err);
      setError(err.response?.data?.error || 'Erro ao registrar evolução no prontuário.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-4 max-w-md w-full mx-auto shadow-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Header do Drawer */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-800/60 text-purple-400">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-white">Evolução Clínica</h3>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30">
                  CFP 01/2009
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Paciente: <strong className="text-slate-200">{session.patient_name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Alerta de Erro */}
        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Botão de Ditado por Voz em Destaque */}
        <div className="mt-3.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleRecording}
              className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/50 animate-pulse scale-105'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30'
              }`}
            >
              {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1">
                <span>{isRecording ? 'Gravando e Transcrevendo...' : 'Ditar Evolução por Voz'}</span>
                {isRecording && <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />}
              </p>
              <p className="text-[10px] text-slate-400">
                {isRecording ? 'Fale normalmente; a IA pontua e formata.' : 'Toque no microfone para ditar o resumo.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-teal-400 bg-teal-950/50 px-2 py-1 rounded-lg border border-teal-800/50">
            <ShieldCheck className="h-3 w-3" />
            <span>SHA-256</span>
          </div>
        </div>

        {/* Textarea para Edição / Exibição */}
        <div className="mt-3 flex-1 min-h-[140px]">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite ou dite aqui o resumo clínico da sessão (ex: demandas trazidas, intervenções em TCC aplicadas, tarefa de casa acordada)..."
            className="w-full h-full min-h-[140px] p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none font-sans leading-relaxed"
          />
        </div>

        {/* Rodapé: Botões de Ação */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !content.trim()}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-purple-900/40 transition cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Salvando...' : 'Salvar no Prontuário'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
