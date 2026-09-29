import React, { useState, useEffect } from 'react';
import {
  Video, ShieldCheck, CheckCircle2, AlertTriangle, Clock,
  User, Lock, Sparkles, PhoneOff, ExternalLink, HeartHandshake, EyeOff
} from 'lucide-react';
import axios from 'axios';
import { LiveScratchpadPanel } from './LiveScratchpadPanel.js';

interface StandaloneVideoRoomProps {
  token?: string; // Token público do paciente
  sessionId?: number; // ID da sessão para o psicólogo (quando aberto em popup)
  role?: 'patient' | 'psychologist';
  onExit?: () => void;
}

export const StandaloneVideoRoom: React.FC<StandaloneVideoRoomProps> = ({
  token,
  sessionId,
  role = 'patient',
  onExit,
}) => {
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tcleAccepted, setTcleAccepted] = useState(false);
  const [tcleCheckbox, setTcleCheckbox] = useState(false);
  const [isSubmittingTcle, setIsSubmittingTcle] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showScratchpad, setShowScratchpad] = useState(role === 'psychologist');

  // Carrega informações da sessão
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        if (token) {
          const res = await axios.get(`/api/public/video-session/${token}`);
          setSessionData(res.data);
          setTcleAccepted(Boolean(res.data.tcleAccepted));
        } else if (sessionId) {
          // Acesso via popup do psicólogo
          const authUser = localStorage.getItem('user');
          const tokenStr = localStorage.getItem('token');
          const res = await axios.get(`/api/sessions?id=${sessionId}`, {
            headers: tokenStr ? { Authorization: `Bearer ${tokenStr}` } : {},
          });
          const found = Array.isArray(res.data) ? res.data.find((s: any) => s.id === sessionId) : null;
          if (found) {
            setSessionData({
              valid: true,
              sessionId: found.id,
              patientId: found.patient_id,
              patientName: found.patient_name,
              psychologistName: found.psychologist_name,
              crpNumber: found.psychologist_crp || 'CRP Ativo',
              epsiCode: found.psychologist_epsi,
              videoRoomId: found.video_room_id,
              videoProvider: found.video_provider,
              videoExternalUrl: found.video_external_url,
              tcleAccepted: true,
            });
            setTcleAccepted(true);
          }
        }
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.response?.data?.error || 'Não foi possível carregar a sala de teleatendimento.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token, sessionId]);

  // Registra entrada do paciente
  useEffect(() => {
    if (token && tcleAccepted && !hasJoined) {
      axios.post(`/api/public/video-session/${token}/join`)
        .then(() => setHasJoined(true))
        .catch((e) => console.warn('Erro ao registrar entrada:', e));
    }
  }, [token, tcleAccepted, hasJoined]);

  // Timer de atendimento
  useEffect(() => {
    if (tcleAccepted) {
      const timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [tcleAccepted]);

  const handleAcceptTcle = async () => {
    if (!token || !tcleCheckbox) return;
    setIsSubmittingTcle(true);
    try {
      await axios.post(`/api/public/video-session/${token}/accept-tcle`);
      setTcleAccepted(true);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao registrar aceite do termo.');
    } finally {
      setIsSubmittingTcle(false);
    }
  };

  const formatTimer = (total: number) => {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center animate-spin">
          <Video className="w-6 h-6" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-300">Carregando sala de teleatendimento seguro...</p>
      </div>
    );
  }

  if (errorMessage || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Sala Indisponível</h2>
        <p className="text-sm text-slate-400 text-center max-w-md mb-6">{errorMessage || 'Esta consulta online não foi localizada ou já foi encerrada.'}</p>
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Voltar
          </button>
        )}
      </div>
    );
  }

  // Se o paciente ainda não aceitou o TCLE do CFP nº 11/2018
  if (!tcleAccepted && role === 'patient') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white">
                Termo de Atendimento Psicológico Online
              </h1>
              <p className="text-xs text-slate-400">
                {sessionData.clinicName} • Resolução CFP nº 11/2018
              </p>
            </div>
          </div>

          {/* Dados do Atendimento */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Profissional:</span>
              <span className="font-bold text-teal-300">{sessionData.psychologistName}</span>
              <span className="text-slate-400 block text-[10.5px] mt-0.5">{sessionData.crpNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Paciente:</span>
              <span className="font-bold text-white">{sessionData.patientName}</span>
              <span className="text-emerald-400 flex items-center gap-1 text-[10.5px] mt-0.5">
                <ShieldCheck className="w-3 h-3" />
                Sala Criptografada
              </span>
            </div>
          </div>

          {/* Corpo do TCLE */}
          <div className="space-y-3 text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60 max-h-60 overflow-y-auto">
            <p className="font-semibold text-white">
              Prezado(a) paciente, em conformidade com as diretrizes do Conselho Federal de Psicologia:
            </p>
            <ul className="space-y-2 list-disc pl-4 text-slate-400">
              <li>
                <strong className="text-slate-200">Privacidade do Ambiente:</strong> Comprometo-me a estar em local reservado, seguro e sem interrupções de terceiros durante o atendimento.
              </li>
              <li>
                <strong className="text-slate-200">Sigilo e Vedação de Gravação:</strong> As sessões são estritamente sigilosas. É expressamente vedada qualquer gravação em áudio, vídeo ou foto por qualquer das partes sem prévio consentimento formal mútuo (Código de Ética do Psicólogo).
              </li>
              <li>
                <strong className="text-slate-200">Meios Tecnológicos:</strong> A comunicação é criptografada e não há retenção de gravação da chamada pelo sistema.
              </li>
              <li>
                <strong className="text-slate-200">Contato de Emergência:</strong> Havendo instabilidade de conexão, o profissional restabelecerá o contato pelo telefone ou WhatsApp cadastrado.
              </li>
            </ul>
          </div>

          {/* Checkbox de Aceite */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-teal-950/20 border border-teal-800/40 cursor-pointer">
            <input
              type="checkbox"
              checked={tcleCheckbox}
              onChange={(e) => setTcleCheckbox(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-700 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-xs text-teal-200 font-medium leading-snug">
              Li e concordo com os termos e condições do teleatendimento psicológico conforme a Resolução CFP nº 11/2018.
            </span>
          </label>

          {/* Botão de Entrada */}
          <button
            type="button"
            onClick={handleAcceptTcle}
            disabled={!tcleCheckbox || isSubmittingTcle}
            className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold shadow-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Video className="w-4 h-4" />
            <span>{isSubmittingTcle ? 'Acessando...' : 'Concordar e Entrar na Consulta Online'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Nome da sala e URL segura do Jitsi
  const jitsiRoomName = sessionData.videoRoomId || `psico-${sessionData.sessionId}`;
  const displayName = role === 'psychologist' ? sessionData.psychologistName : sessionData.patientName;
  const jitsiIframeSrc = `https://meet.jit.si/${encodeURIComponent(jitsiRoomName)}#userInfo.displayName="${encodeURIComponent(displayName || 'Participante')}"&config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableDeepLinking=true&config.disablePictureInPicture=true&interfaceConfig.TOOLBAR_BUTTONS=['microphone','camera','desktop','fullscreen','hangup']`;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
            <Video className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">
                {role === 'psychologist' ? `Atendimento: ${sessionData.patientName}` : `Consulta com ${sessionData.psychologistName}`}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Conectado
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              <span className="flex items-center gap-1 font-mono text-teal-300">
                <Clock className="w-3.5 h-3.5" />
                {formatTimer(elapsedSeconds)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>{sessionData.crpNumber} {sessionData.epsiCode ? `• e-Psi: ${sessionData.epsiCode}` : ''}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {role === 'psychologist' && (
            <button
              type="button"
              onClick={() => setShowScratchpad(!showScratchpad)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                showScratchpad
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-teal-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700'
              }`}
              title="Anotações Rápidas e Consolidação por IA"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{showScratchpad ? 'Ocultar Anotações' : 'Anotações & IA'}</span>
            </button>
          )}

          {sessionData.videoProvider === 'EXTERNAL' && sessionData.videoExternalUrl && (
            <a
              href={sessionData.videoExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs"
            >
              <span>Abrir no Google Meet / Zoom</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Sair da Sala</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Video Area with Optional Side Scratchpad */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-black">
          <iframe
            src={jitsiIframeSrc}
            allow="camera; microphone; display-capture; autoplay; clipboard-write; picture-in-picture 'none'"
            className="w-full h-full border-0 absolute inset-0"
            title={`Teleatendimento PsicoGestão - ${sessionData.patientName}`}
          />
        </div>

        {/* Live Scratchpad Lateral para o Psicólogo (2º Monitor) */}
        {role === 'psychologist' && showScratchpad && sessionData && (
          <div className="w-[380px] xl:w-[440px] border-l border-slate-800 bg-slate-900 flex flex-col shrink-0 animate-in slide-in-from-right-2 overflow-y-auto">
            <LiveScratchpadPanel
              patientId={sessionData.patientId || sessionData.sessionId}
              patientName={sessionData.patientName}
              sessionId={sessionData.sessionId}
              className="h-full border-0 rounded-none shadow-none"
            />
          </div>
        )}
      </div>

      {/* Footer com Aviso Ético CFP */}
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <span className="flex items-center gap-1.5">
          <EyeOff className="w-3.5 h-3.5 text-teal-400" />
          <span>Sessão privativa protegida pelo sigilo profissional (Art. 9º do Código de Ética). Gravação desativada.</span>
        </span>
        <span className="text-[11px] text-slate-500 font-mono">
          PsicoGestão SaaS • CFP nº 11/2018
        </span>
      </div>
    </div>
  );
};
