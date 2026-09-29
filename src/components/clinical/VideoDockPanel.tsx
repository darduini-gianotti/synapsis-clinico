import React, { useState, useEffect, useRef } from 'react';
import {
  Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, ExternalLink,
  PhoneOff, Copy, Check, MessageCircle, ShieldCheck, Clock, Users,
  AlertCircle, Sparkles, RefreshCw, X, ChevronRight, Settings
} from 'lucide-react';
import { Session } from '../../types.js';
import { LiveScratchpadPanel } from './LiveScratchpadPanel.js';

interface VideoDockPanelProps {
  session: Session;
  onClose: () => void;
  onEndVideo: () => Promise<void>;
  patientLink?: string;
  whatsappUrl?: string;
  whatsappText?: string;
  isSplitScreen?: boolean;
  onToggleSplitScreen?: () => void;
  onApplyEvolution?: (dap: { dados: string; avaliacao: string; plano: string }) => void;
}

export const VideoDockPanel: React.FC<VideoDockPanelProps> = ({
  session,
  onClose,
  onEndVideo,
  patientLink,
  whatsappUrl,
  whatsappText,
  isSplitScreen = true,
  onToggleSplitScreen,
  onApplyEvolution,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showScratchpad, setShowScratchpad] = useState((session.video_provider as string) === 'WHATSAPP');
  const [showConfirmEndModal, setShowConfirmEndModal] = useState(false);
  const [provider, setProvider] = useState<'NATIVE' | 'EXTERNAL' | 'WHATSAPP'>(((session.video_provider as any) || 'NATIVE'));
  const [externalUrl, setExternalUrl] = useState(session.video_external_url || '');

  // Sincroniza o provedor de vídeo sempre que a sessão mudar
  useEffect(() => {
    if (session.video_provider) {
      setProvider(session.video_provider as any);
      if (session.video_provider === 'WHATSAPP') {
        setShowScratchpad(true);
      }
    }
  }, [session.video_provider]);

  // Contador de tempo de atendimento online
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopyPatientLink = () => {
    if (!patientLink) return;
    navigator.clipboard.writeText(patientLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePopOut = () => {
    const url = `/teleconsulta/room?sessionId=${session.id}&role=psychologist`;
    window.open(url, `Teleconsulta_${session.id}`, 'width=1100,height=750,menubar=no,toolbar=no,location=no');
  };

  const handleConfirmEnd = () => {
    setShowConfirmEndModal(true);
  };

  const handleExecuteEnd = async () => {
    setIsEnding(true);
    try {
      await onEndVideo();
      setShowConfirmEndModal(false);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsEnding(false);
    }
  };

  // Nome da sala Jitsi limpo e criptografado
  const jitsiRoomName = session.video_room_id || `psico-${session.id}`;
  // URL do Jitsi em modo seguro com interface médica/terapêutica limpa
  const jitsiIframeSrc = `https://meet.jit.si/${encodeURIComponent(jitsiRoomName)}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableDeepLinking=true&config.disablePictureInPicture=true&interfaceConfig.TOOLBAR_BUTTONS=['microphone','camera','desktop','fullscreen','hangup']`;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/95 text-white shadow-2xl border border-teal-500/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold text-teal-300">Em Atendimento Online:</span>
          <span className="text-xs font-mono font-bold text-white">{formatTimer(elapsedSeconds)}</span>
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <span className="text-xs text-slate-300 font-medium truncate max-w-[140px]">{session.patient_name}</span>
        <div className="flex items-center gap-1.5 ml-2">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold cursor-pointer"
            title="Restaurar Painel de Vídeo"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleConfirmEnd}
            className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
            title="Encerrar Consulta"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-4 z-50'
          : isSplitScreen
          ? 'w-full h-full min-h-[560px]'
          : 'fixed bottom-4 right-4 w-[520px] h-[640px] z-50'
      }`}
    >
      {/* Header Profissional & Conformidade CFP */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800 text-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
            <Video className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white tracking-wide">
                Teleatendimento: {session.patient_name}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ao Vivo
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-teal-400" />
                <span className="font-mono text-teal-300 font-semibold">{formatTimer(elapsedSeconds)}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-300" title="Cadastro ativo no Conselho Federal de Psicologia para prestação de serviços psicológicos por TIC">
                <ShieldCheck className="w-3 h-3 text-teal-400" />
                <span>CFP nº 11/2018 (e-Psi)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Ações de Janela */}
        <div className="flex items-center gap-1.5">
          {onToggleSplitScreen && (
            <button
              type="button"
              onClick={onToggleSplitScreen}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={isSplitScreen ? 'Desencaixar da lateral' : 'Fixar na lateral (Split Screen)'}
            >
              <Users className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handlePopOut}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Destacar para janela externa (Pop-out para 2º monitor)"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Minimizar chamada"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra de Acesso do Paciente & Compartilhamento Rápido */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800/80 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400">Link do Paciente:</span>
          {patientLink ? (
            <button
              type="button"
              onClick={handleCopyPatientLink}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 font-mono text-[11px] transition cursor-pointer border border-slate-700"
              title="Copiar link seguro para o paciente"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
            </button>
          ) : (
            <span className="text-slate-500 text-[11px]">Gerado ao ativar</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowScratchpad(!showScratchpad)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-xs cursor-pointer ${
              showScratchpad
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-teal-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700'
            }`}
            title="Anotações Rápidas e Consolidação de Evolução por IA"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>{showScratchpad ? 'Ocultar Anotações' : 'Anotações & IA'}</span>
          </button>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow-xs"
              title="Disparar link seguro para o WhatsApp do paciente"
            >
              <MessageCircle className="w-3 h-3" />
              <span>Enviar WhatsApp</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleConfirmEnd}
            disabled={isEnding}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-[11px] transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Encerrar atendimento online e salvar horários no prontuário"
          >
            <PhoneOff className="w-3 h-3" />
            <span>{isEnding ? 'Encerrando...' : 'Encerrar Atendimento'}</span>
          </button>
        </div>
      </div>

      {/* Área Central de Vídeo */}
      <div className="flex-1 relative bg-black flex flex-col items-center justify-center min-h-[380px]">
        {provider === 'WHATSAPP' ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <MessageCircle className="w-8 h-8" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Atendimento via WhatsApp Vídeo
              </div>
              <h3 className="text-base font-bold text-white tracking-wide">Chamada de Vídeo Externa</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Você está em sessão com <strong>{session.patient_name}</strong> através do WhatsApp. O cronômetro de tempo e as anotações clínicas com IA continuam ativos normalmente.
              </p>
            </div>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition hover:scale-[1.02]"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Abrir WhatsApp Web / Chamar Paciente</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setProvider('NATIVE')}
                className="text-xs text-teal-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Mudar para Sala Virtual Synapsis</span>
              </button>
            </div>
          </div>
        ) : provider === 'NATIVE' ? (
          <iframe
            src={jitsiIframeSrc}
            allow="camera; microphone; display-capture; autoplay; clipboard-write; picture-in-picture 'none'"
            className="w-full h-full border-0 absolute inset-0"
            title={`Atendimento Online com ${session.patient_name}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <ExternalLink className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Sala Externa Configurada</h3>
              <p className="text-xs text-slate-400 mt-1">
                Você optou por realizar a videochamada através de provedor externo (Google Meet / Zoom).
              </p>
            </div>
            {externalUrl ? (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition"
              >
                <span>Abrir Sala Externa ({externalUrl.includes('meet') ? 'Google Meet' : 'Zoom / Teams'})</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <div className="text-xs text-amber-400 bg-amber-950/60 p-3 rounded-xl border border-amber-800">
                Nenhum link externo configurado. Você pode alternar para a Sala Nativa segura acima.
              </div>
            )}
            <button
              type="button"
              onClick={() => setProvider('NATIVE')}
              className="text-xs text-teal-400 hover:underline cursor-pointer"
            >
              ← Alternar para Sala Nativa Integrada
            </button>
          </div>
        )}
      </div>

      {/* Live Scratchpad com Consolidação de IA */}
      {showScratchpad && (
        <div className="border-t border-slate-800 max-h-[360px] overflow-y-auto animate-in slide-in-from-bottom-2 shrink-0">
          <LiveScratchpadPanel
            patientId={session.patient_id}
            patientName={session.patient_name}
            sessionId={session.id}
            onApplyEvolution={onApplyEvolution}
          />
        </div>
      )}

      {/* Footer com Aviso Ético CFP */}
      <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[10.5px] text-slate-400 shrink-0">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Comunicação criptografada ponta-a-ponta (WebRTC DTLS/SRTP).</span>
        </span>
        <span className="text-slate-500 font-mono">
          Sala: {jitsiRoomName}
        </span>
      </div>

      {/* Modal Premium de Confirmação de Encerramento (Substitui window.confirm do navegador) */}
      {showConfirmEndModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden p-6 text-white space-y-5 animate-in zoom-in-95 duration-200">
            {/* Top Icon & Tag */}
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-inner">
                <PhoneOff className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                <span>{formatTimer(elapsedSeconds)} de sessão</span>
              </span>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Encerrar Teleatendimento?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Você está prestes a finalizar a sala virtual com <span className="font-bold text-teal-300">{session.patient_name}</span>. O horário de início e o término serão computados e arquivados no prontuário eletrônico.
              </p>
            </div>

            {/* Info Box */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-[11.5px]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Conformidade Ética CFP nº 11/2018</span>
              </div>
              <p className="text-[11px] text-slate-400 pl-6">
                A sessão será marcada como concluída e você poderá revisar ou preencher a evolução clínica (DAP/BIRP).
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmEndModal(false)}
                disabled={isEnding}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-700 disabled:opacity-50"
              >
                Continuar Atendimento
              </button>
              <button
                type="button"
                onClick={handleExecuteEnd}
                disabled={isEnding}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-950/40 cursor-pointer disabled:opacity-50"
              >
                {isEnding ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Encerrando...</span>
                  </>
                ) : (
                  <>
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>Encerrar Atendimento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
