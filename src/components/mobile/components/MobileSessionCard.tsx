import React, { useState } from 'react';
import {
  Video,
  MessageCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react';

export interface MobileSessionItem {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_phone?: string;
  start_time: string;
  end_time: string;
  status: string;
  modality: 'ONLINE' | 'IN_PERSON';
  teleconsulta_token?: string;
  price?: number;
  payment_status?: string;
  notes?: string;
}

interface MobileSessionCardProps {
  session: MobileSessionItem;
  onStartVideo: (session: MobileSessionItem) => void;
  onOpenEvolution: (session: MobileSessionItem) => void;
  onViewPatient: (patientId: number) => void;
}

export const MobileSessionCard: React.FC<MobileSessionCardProps> = ({
  session,
  onStartVideo,
  onOpenEvolution,
  onViewPatient,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);

  const startTimeStr = new Date(session.start_time).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTimeStr = new Date(session.end_time).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isConfirmed = session.status === 'CONFIRMED' || session.status === 'SCHEDULED';
  const isCompleted = session.status === 'COMPLETED';
  const isOnline = session.modality === 'ONLINE';

  // Geradores de links WhatsApp de 1 toque
  const cleanPhone = (session.patient_phone || '').replace(/\D/g, '');
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://synapsisclinico.com.br';
  const teleconsultaUrl = session.teleconsulta_token
    ? `${baseUrl}/teleconsulta/${session.teleconsulta_token}`
    : `${baseUrl}/teleconsulta?sessionId=${session.id}`;

  const openWhatsApp = (msg: string) => {
    if (!cleanPhone) {
      alert('Paciente sem telefone cadastrado.');
      return;
    }
    const fullNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const url = `https://wa.me/${fullNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    setIsMenuOpen(false);
  };

  const handleSendReminder = () => {
    const msg = `Olá ${session.patient_name.split(' ')[0]}, tudo bem? Confirmando nossa sessão de hoje às ${startTimeStr} pelo Synapsis Clínico. Até breve!`;
    openWhatsApp(msg);
  };

  const handleSendTeleconsultaLink = () => {
    const msg = `Olá ${session.patient_name.split(' ')[0]}, segue o seu link exclusivo e seguro para nossa sessão online hoje às ${startTimeStr}:\n\n🔗 ${teleconsultaUrl}\n\nBasta tocar no link no horário agendado. Qualquer dúvida, estou à disposição!`;
    openWhatsApp(msg);
  };

  const handleSendPixBill = () => {
    const priceStr = session.price ? `R$ ${Number(session.price).toFixed(2)}` : 'R$ 150,00';
    const msg = `Olá ${session.patient_name.split(' ')[0]}, segue a chave Pix para acerto dos honorários da sessão (${priceStr}):\n\n🔑 Chave Pix: contato@synapsisclinico.com.br\n\nAssim que realizar a transferência, por gentileza envie o comprovante. Muito obrigado!`;
    openWhatsApp(msg);
  };

  return (
    <div className="bg-slate-900/80 dark:bg-slate-900/90 rounded-2xl border border-slate-800 p-3.5 shadow-sm transition hover:border-slate-700">
      {/* Topo do Card: Horário, Modalidade e Status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-black text-white bg-slate-800/80 px-2 py-0.8 rounded-lg border border-slate-700/60">
            <Clock className="h-3 w-3 text-teal-400" />
            <span>{startTimeStr} - {endTimeStr}</span>
          </div>

          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isOnline
                ? 'bg-sky-950/60 text-sky-400 border-sky-800/60'
                : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
            }`}
          >
            {isOnline ? 'Online' : 'Presencial'}
          </span>
        </div>

        <div>
          {isCompleted ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-800/40 px-2 py-0.5 rounded-full border border-slate-800">
              <CheckCircle2 className="h-2.5 w-2.5 text-slate-400" />
              <span>Realizada</span>
            </span>
          ) : isConfirmed ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-800/60">
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>Confirmada</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/60">
              <AlertCircle className="h-2.5 w-2.5" />
              <span>Pendente</span>
            </span>
          )}
        </div>
      </div>

      {/* Nome do Paciente & Acesso Rápido ao Prontuário */}
      <div className="mb-3">
        <button
          onClick={() => onViewPatient(session.patient_id)}
          className="text-left font-bold text-sm text-slate-100 hover:text-teal-400 transition cursor-pointer flex items-center gap-1"
        >
          <span>{session.patient_name}</span>
        </button>
        {session.notes && (
          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 italic">
            "{session.notes}"
          </p>
        )}
      </div>

      {/* Barra de Ações Rápidas de 1 Toque */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
        {/* Ação 1: Entrar na Teleconsulta (ou iniciar sessão) */}
        {isOnline ? (
          <button
            onClick={() => onStartVideo(session)}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold shadow-xs shadow-teal-900/30 transition cursor-pointer"
          >
            <Video className="h-3.5 w-3.5" />
            <span>Sala de Vídeo</span>
          </button>
        ) : (
          <button
            onClick={() => onViewPatient(session.patient_id)}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 transition cursor-pointer"
          >
            <Clock className="h-3.5 w-3.5 text-teal-400" />
            <span>Presencial</span>
          </button>
        )}

        {/* Ação 2: WhatsApp Menu de 1 Toque */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-full flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 text-[11px] font-bold border border-emerald-800/80 transition cursor-pointer"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>WhatsApp</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {/* Dropdown Flutuante de Mensagens Rápidas */}
          {isMenuOpen && (
            <div className="absolute left-0 bottom-full mb-2 w-56 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95">
              <div className="p-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Disparo Rápido WhatsApp
              </div>
              <button
                onClick={handleSendReminder}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                <span>Lembrar Sessão de Hoje</span>
              </button>
              {isOnline && (
                <button
                  onClick={handleSendTeleconsultaLink}
                  className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  <span>Enviar Link da Sala</span>
                </button>
              )}
              <button
                onClick={handleSendPixBill}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Enviar Cobrança Pix</span>
              </button>
            </div>
          )}
        </div>

        {/* Ação 3: Evolução Rápida (com voz) */}
        <button
          onClick={() => onOpenEvolution(session)}
          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 text-[11px] font-bold border border-purple-800/80 transition cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Evolução</span>
        </button>
      </div>
    </div>
  );
};
