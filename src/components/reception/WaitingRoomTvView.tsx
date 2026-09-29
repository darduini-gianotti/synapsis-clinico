import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.js';
import {
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Clock,
  Building,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Shield,
} from 'lucide-react';

interface WaitingRoomTvViewProps {
  onBackToApp?: () => void;
}

export const WaitingRoomTvView: React.FC<WaitingRoomTvViewProps> = ({ onBackToApp }) => {
  const [activeCall, setActiveCall] = useState<any>(null);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [clinicName, setClinicName] = useState('Synapsis Clínico');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastCallIdRef = useRef<number | null>(null);

  // Clock ticker every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio API Gentle Chime Generator (Two calm sine tones: 528Hz and 660Hz)
  const playGentleChime = () => {
    if (isMuted) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      const now = ctx.currentTime;

      // Note 1: 528Hz (Harmony)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(528, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 1.2);

      // Note 2: 660Hz (Ascending chime)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(660, now + 0.25);
      gain2.gain.setValueAtTime(0, now + 0.25);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 1.6);
    } catch (e) {
      console.warn('Audio play restricted by browser autoplay policy:', e);
    }
  };

  // Poll TV display endpoint every 3.5 seconds
  const fetchTvData = async () => {
    try {
      const res = await api.get('/reception/tv-display');
      if (res.data) {
        const newActive = res.data.active_call;
        setRecentCalls(res.data.recent_calls || []);
        if (res.data.clinic_name) setClinicName(res.data.clinic_name);
        if (res.data.logo_base64) setLogoBase64(res.data.logo_base64);

        // Check if there is a newly arrived call
        if (newActive && newActive.id !== lastCallIdRef.current) {
          lastCallIdRef.current = newActive.id;
          setActiveCall(newActive);
          playGentleChime();
        } else if (!newActive) {
          setActiveCall(null);
        }
      }
    } catch (err) {
      console.error('Error fetching TV data:', err);
    }
  };

  useEffect(() => {
    fetchTvData();
    const interval = setInterval(fetchTvData, 3500);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formattedDate = currentTime.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Top Header */}
      <header className="px-10 py-6 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-5">
          {logoBase64 ? (
            <img src={logoBase64} alt="Clinic Logo" className="h-14 w-auto object-contain" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-white shadow-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">{clinicName}</h1>
                <span className="text-xs text-teal-400 font-semibold tracking-wider uppercase">
                  Synapsis Clínico • Painel de Espera
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Big Digital Clock */}
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-4xl font-mono font-black text-white tracking-wider">
              {formattedTime}
            </div>
            <div className="text-xs text-slate-400 font-medium capitalize mt-0.5">
              {formattedDate}
            </div>
          </div>

          {/* Quick controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title={isMuted ? 'Ativar Som' : 'Silenciar'}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5 text-teal-400" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Alternar Tela Cheia"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition cursor-pointer"
              >
                Voltar ao Sistema
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Center Display Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 max-w-6xl mx-auto w-full">
        {activeCall ? (
          <div className="w-full bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 border-2 border-teal-500/80 rounded-3xl p-12 shadow-2xl shadow-teal-500/20 text-center space-y-8 animate-in zoom-in-95 duration-500">
            <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-sm font-extrabold uppercase tracking-widest animate-pulse">
              <Sparkles className="h-4 w-4" />
              Por Favor, Dirigir-se ao Consultório
            </div>

            {/* Room Name Big */}
            <div className="space-y-3">
              <span className="text-xl md:text-2xl font-bold uppercase tracking-wider text-slate-400">
                Consultório
              </span>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight bg-gradient-to-r from-teal-400 via-cyan-300 to-teal-200 bg-clip-text text-transparent">
                {activeCall.room_name}
              </h2>
            </div>

            {/* Patient Name (CFP / LGPD Truncated) */}
            <div className="py-6 px-10 rounded-2xl bg-slate-800/80 border border-slate-700 max-w-3xl mx-auto space-y-1">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                Paciente
              </span>
              <div className="text-4xl md:text-5xl font-black text-white tracking-wide">
                {activeCall.patient_display_name}
              </div>
            </div>

            {/* Psychologist Name */}
            <div className="text-lg md:text-xl text-slate-300 font-medium">
              Atendimento com <strong className="text-teal-400 font-bold">{activeCall.psychologist_name}</strong>
            </div>
          </div>
        ) : (
          /* Idle Screen */
          <div className="text-center space-y-6 max-w-2xl">
            <div className="h-28 w-28 mx-auto rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-teal-400 shadow-xl shadow-teal-500/10">
              <Clock className="h-14 w-14 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Seja bem-vindo(a) ao nosso consultório
              </h2>
              <p className="text-base text-slate-400 leading-relaxed">
                Por favor, aguarde na recepção com tranquilidade. Seu nome e consultório aparecerão nesta tela assim que seu atendimento for chamado.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <Shield className="h-3.5 w-3.5 text-teal-500" />
              <span>Privacidade e sigilo preservados conforme normas éticas do CFP e LGPD</span>
            </div>
          </div>
        )}

        {/* Recent Calls Horizontal Ticker */}
        {recentCalls.length > 0 && (
          <div className="w-full mt-10 pt-6 border-t border-slate-800/70">
            <div className="flex items-center justify-between mb-3 text-xs uppercase tracking-wider text-slate-400 font-bold">
              <span>Chamadas Recentes</span>
              <span>Avisos de Sala</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {recentCalls.slice(0, 5).map((call, idx) => (
                <div
                  key={call.id || idx}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-200">{call.patient_display_name}</div>
                    <div className="text-[11px] text-teal-400 truncate max-w-[140px]">{call.room_name}</div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {call.called_at ? call.called_at.substring(11, 16) : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-10 py-4 border-t border-slate-850 bg-slate-900/40 text-center text-xs text-slate-400 flex items-center justify-between">
        <span>{clinicName}</span>
        <span className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-teal-500" />
          Synapsis Clínico • Conexão Definitiva entre Ciência e Gestão
        </span>
        <span>© 2026</span>
      </footer>
    </div>
  );
};
