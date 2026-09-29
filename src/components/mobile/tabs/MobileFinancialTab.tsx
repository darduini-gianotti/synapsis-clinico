import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.js';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Send,
  Check,
  RefreshCw,
} from 'lucide-react';

export const MobileFinancialTab: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettlingId, setIsSettlingId] = useState<number | null>(null);

  const fetchFinancials = async () => {
    try {
      setIsLoading(true);
      // Busca as sessões com status pendente
      const res = await api.get('/sessions', {
        params: {
          limit: 50,
        },
      });

      const list = res.data.sessions || res.data || [];
      const pending = list.filter(
        (s: any) => s.payment_status !== 'PAID' && Number(s.price || 0) > 0
      );
      setSessions(pending);
    } catch (err) {
      console.error('Erro ao buscar financeiro:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const handleSettle = async (session: any) => {
    try {
      setIsSettlingId(session.id);
      await api.post('/financial/settle', {
        patient_id: session.patient_id,
        payment_date: new Date().toISOString().substring(0, 10),
        payment_method: 'PIX',
        notes: 'Baixa rápida realizada via Synapsis Mobile',
        settlements: [
          {
            session_id: session.id,
            amount: Number(session.price || 0),
          },
        ],
      });

      // Remove da lista
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (err) {
      console.error('Erro ao dar baixa:', err);
      alert('Erro ao dar baixa na sessão.');
    } finally {
      setIsSettlingId(null);
    }
  };

  const handleSendPix = (session: any) => {
    const cleanPhone = (session.patient_phone || session.phone || '').replace(/\D/g, '');
    const priceStr = Number(session.price || 150).toFixed(2);
    const msg = `Olá ${session.patient_name?.split(' ')[0] || ''}, tudo bem? Segue a chave Pix para acerto da nossa sessão de psicologia (R$ ${priceStr}):\n\n🔑 Chave Pix: contato@synapsisclinico.com.br\n\nApós o pagamento, envie o comprovante por aqui. Muito obrigado!`;

    if (!cleanPhone) {
      navigator.clipboard.writeText(msg);
      alert('Mensagem copiada para a área de transferência! (Paciente sem telefone cadastrado)');
      return;
    }

    const fullNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${fullNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const totalPending = sessions.reduce((sum, s) => sum + Number(s.price || 0), 0);

  return (
    <div className="space-y-4 pb-24">
      {/* Resumo Financeiro em Cards Rápidos */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/60">
          <div className="flex items-center gap-1.5 text-amber-400 mb-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">A Receber</span>
          </div>
          <div className="text-lg font-black text-amber-300">
            R$ {totalPending.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">
            {sessions.length} atendimento(s) em aberto
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-teal-950/40 border border-teal-800/60">
          <div className="flex items-center gap-1.5 text-teal-400 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Forma Rápida</span>
          </div>
          <div className="text-lg font-black text-teal-300">PIX Direto</div>
          <span className="text-[10px] text-slate-400">Baixa em 1 toque</span>
        </div>
      </div>

      {/* Lista de Cobranças Pendentes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-300">Sessões Pendentes de Pagamento</h3>
          <button
            onClick={fetchFinancials}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Carregando pendências...
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-12 px-4 text-center bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 text-slate-500 text-xs">
            <CheckCircle2 className="h-8 w-8 text-teal-500 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-slate-300">Todas as sessões estão em dia!</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Nenhum honorário pendente no momento.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-100">{session.patient_name}</h4>
                <p className="text-[10px] text-slate-400">
                  {new Date(session.start_time).toLocaleDateString('pt-BR')} •{' '}
                  <strong className="text-amber-400">
                    R$ {Number(session.price || 0).toFixed(2)}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleSendPix(session)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/80 text-[10px] font-bold transition cursor-pointer"
                  title="Cobrar via WhatsApp"
                >
                  <Send className="h-3 w-3" />
                  <span>Cobrar</span>
                </button>

                <button
                  onClick={() => handleSettle(session)}
                  disabled={isSettlingId === session.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                  title="Dar Baixa"
                >
                  <Check className="h-3 w-3" />
                  <span>{isSettlingId === session.id ? '...' : 'Baixa'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
