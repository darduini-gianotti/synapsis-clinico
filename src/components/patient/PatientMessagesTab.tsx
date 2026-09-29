import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, ShieldAlert, Clock, Building2, User,
  HeartHandshake, AlertCircle, Sparkles, RefreshCw
} from 'lucide-react';
import { patientApi } from '../../services/patientApi';

export const PatientMessagesTab: React.FC = () => {
  const [channel, setChannel] = useState<'ADMINISTRATIVE' | 'CLINICAL'>('ADMINISTRATIVE');
  const [messages, setMessages] = useState<any[]>([]);
  const [channelStatus, setChannelStatus] = useState<any | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadStatusAndMessages = async () => {
    setLoading(true);
    try {
      const [statusRes, msgsRes] = await Promise.all([
        patientApi.getMessagesStatus(),
        patientApi.getMessages(channel)
      ]);
      setChannelStatus(statusRes);
      setMessages(msgsRes.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatusAndMessages();
  }, [channel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    // Otimista
    const tempMsg = {
      id: Date.now(),
      channel_type: channel,
      sender_type: 'PATIENT',
      message_text: textToSend,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await patientApi.sendMessage(channel, textToSend);
      loadStatusAndMessages();
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const isClinicalEnabled = channelStatus?.clinicalChannel?.enabled;
  const therapistName = channelStatus?.clinicalChannel?.therapistName || 'Meu Psicólogo';

  return (
    <div className="flex flex-col h-[75vh] max-h-[700px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-fade-in">
      
      {/* SELETOR DE CANAIS NO TOPO */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 shrink-0">
        <div className="grid grid-cols-2 gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setChannel('ADMINISTRATIVE')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              channel === 'ADMINISTRATIVE'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Recepção da Clínica</span>
          </button>

          <button
            type="button"
            onClick={() => setChannel('CLINICAL')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              channel === 'CLINICAL'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{therapistName}</span>
          </button>
        </div>

        {/* Subtítulo informativo */}
        <div className="pt-2 px-1 flex items-center justify-between text-[11px] text-slate-500">
          {channel === 'ADMINISTRATIVE' ? (
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Dúvidas de agenda, horários e pagamentos (Seg-Sex 08h às 18h)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <Sparkles className="w-3 h-3 text-purple-500" />
              <span>Canal terapêutico direto com {therapistName}</span>
            </span>
          )}
        </div>
      </div>

      {/* FEED DE MENSAGENS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
        
        {/* Caso o canal clínico esteja desabilitado */}
        {channel === 'CLINICAL' && !isClinicalEnabled ? (
          <div className="my-auto p-6 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-center space-y-3 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto">
              <User className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 dark:text-white text-sm">
              Mensagens Diretas com o Terapeuta Desativadas
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Para preservar a eficácia e o foco do seu tratamento, seu psicólogo optou por concentrar todas as reflexões e relatos diretamente durante suas sessões presenciais ou online.
            </p>
            <p className="text-[11px] text-slate-500">
              Para reagendamentos ou avisos de atraso, envie uma mensagem pelo canal da <strong>Recepção</strong>.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs space-y-1">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="font-bold">Nenhuma mensagem neste canal ainda</p>
            <p className="text-[11px]">Envie sua dúvida ou solicitação abaixo.</p>
          </div>
        ) : (
          messages.map((m: any, idx: number) => {
            const isPatient = m.sender_type === 'PATIENT';
            return (
              <div
                key={m.id || idx}
                className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'}`}
              >
                <div className="text-[10px] text-slate-400 mb-1 px-1">
                  {isPatient ? 'Você' : m.sender_type === 'RECEPTION' ? 'Recepção' : therapistName}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                    isPatient
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.message_text}</p>
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1">
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* SALVAGUARDA OBRIGATÓRIA CVV 188 (SAÚDE MENTAL) */}
      <div className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200/50 dark:border-rose-900/50 text-[10px] text-rose-800 dark:text-rose-300 flex items-center justify-between shrink-0">
        <span className="flex items-center gap-1 truncate">
          <HeartHandshake className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Este chat não realiza atendimento de emergência médica ou psicológica.</span>
        </span>
        <a href="tel:188" className="font-bold underline shrink-0 ml-1">Ligue 188 (CVV)</a>
      </div>

      {/* INPUT DE ENVIO */}
      {(channel === 'ADMINISTRATIVE' || isClinicalEnabled) && (
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            placeholder={channel === 'ADMINISTRATIVE' ? 'Digite sua mensagem para a recepção...' : `Mensagem para ${therapistName}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold transition-all shadow-md cursor-pointer shrink-0"
          >
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      )}

    </div>
  );
};
