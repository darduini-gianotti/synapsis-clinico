import React, { useState } from 'react';
import { useHelp } from '../../contexts/HelpContext.js';
import { api } from '../../services/api.js';
import {
  Sparkles, X, Send, Search, Compass, BookOpen, ShieldCheck,
  ChevronRight, ArrowRight, CornerDownLeft, Loader2,
  Calendar, DollarSign, Users, FileText, CheckCircle2,
  AlertTriangle, Crosshair, BrainCircuit, Video, Download,
  Smartphone, Monitor, PlayCircle, Youtube, ExternalLink, Layers
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  recommendedAction?: string;
  actionLabel?: string;
  timestamp: string;
}

const FREQUENT_QUESTIONS = [
  {
    title: 'Rateio de despesas entre psicólogos',
    query: 'Como funciona o rateio de despesas compartilhadas entre psicólogos da clínica?',
    icon: DollarSign,
    color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
  },
  {
    title: 'Assinatura e Hash SHA-256 (CFP 06/2019)',
    query: 'Como assinar uma evolução com hash SHA-256 e cumprir o CFP 06/2019?',
    icon: ShieldCheck,
    color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
  },
  {
    title: 'Carnê-Leão e Livro-Caixa (DARF 0190)',
    query: 'Como gerar o Livro-Caixa e calcular o Carnê-Leão para o psicólogo autônomo?',
    icon: FileText,
    color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
  },
  {
    title: 'Cobrança de falta de paciente (No-Show)',
    query: 'Como registrar falta de paciente e quando é permitido cobrar honorários pelo CFP?',
    icon: Calendar,
    color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
  },
  {
    title: 'Emissão de Notas e Fila Contábil',
    query: 'Como funciona a solicitação e envio de Notas Fiscais para a contabilidade?',
    icon: CheckCircle2,
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
  },
];

export interface VideoTutorialItem {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: 'overview' | 'financial' | 'patients' | 'evaluations' | 'agenda';
  categoryLabel: string;
  youtubeId?: string; // ID do YouTube (ex: dQw4w9WgXcQ) quando publicado
  local16x9Url: string;
  local9x16Url: string;
  badge: string;
}

const VIDEO_TUTORIALS: VideoTutorialItem[] = [
  {
    id: 'overview-complete',
    title: 'Visão Geral do Synapsis Clínico',
    description: 'Tour guiado completo de 55 segundos: Agenda Inteligente, Prontuário CFP/LGPD, Avaliações Neuropsicológicas, Laudos e Gestão Financeira com Carnê-Leão.',
    duration: '55s',
    category: 'overview',
    categoryLabel: 'Visão Geral',
    youtubeId: '', // Suporta ID do YouTube ou reprodução local automática
    local16x9Url: '/videos/assets/synapsis_intro_16x9.mp4',
    local9x16Url: '/videos/assets/synapsis_intro_9x16.mp4',
    badge: 'Tour Completo (55s)',
  },
  {
    id: 'financial-carne-leao',
    title: 'Gestão Financeira, Carnê-Leão e DARF',
    description: 'Como controlar recebimentos de pacientes, gerar o Livro-Caixa digital e apurar a previsão de DARF 0190 com deduções fiscais.',
    duration: '1 min',
    category: 'financial',
    categoryLabel: 'Financeiro',
    youtubeId: '',
    local16x9Url: '/videos/assets/synapsis_intro_16x9.mp4',
    local9x16Url: '/videos/assets/synapsis_intro_9x16.mp4',
    badge: 'DARF 0190 & IRPF',
  },
  {
    id: 'clinical-records-cfp',
    title: 'Prontuário Imutável e Resolução CFP 01/2009',
    description: 'Registro de evoluções com criptografia AES-256 em repouso, blindagem contra adulteração e assinatura digital com hash SHA-256.',
    duration: '1 min',
    category: 'patients',
    categoryLabel: 'Prontuário',
    youtubeId: '',
    local16x9Url: '/videos/assets/synapsis_intro_16x9.mp4',
    local9x16Url: '/videos/assets/synapsis_intro_9x16.mp4',
    badge: 'CFP 01/2009 & LGPD',
  },
  {
    id: 'neuropsych-evaluations',
    title: 'Avaliações Neuropsicológicas e Laudos',
    description: 'Aplicação de protocolos padronizados, apuração de testes normatizados pelo SATEPSI e geração automática de laudos e pareceres.',
    duration: '1 min',
    category: 'evaluations',
    categoryLabel: 'Avaliações',
    youtubeId: '',
    local16x9Url: '/videos/assets/synapsis_intro_16x9.mp4',
    local9x16Url: '/videos/assets/synapsis_intro_9x16.mp4',
    badge: 'CFP 06/2019',
  },
  {
    id: 'smart-agenda-whatsapp',
    title: 'Agenda Inteligente e Confirmações',
    description: 'Gestão de horários com envio de lembretes e confirmações automáticas por WhatsApp, reduzindo faltas e no-show.',
    duration: '1 min',
    category: 'agenda',
    categoryLabel: 'Agenda',
    youtubeId: '',
    local16x9Url: '/videos/assets/synapsis_intro_16x9.mp4',
    local9x16Url: '/videos/assets/synapsis_intro_9x16.mp4',
    badge: 'No-Show Zero',
  },
];

export const AiHelpCenterModal: React.FC = () => {
  const {
    isHelpCenterOpen,
    closeHelpCenter,
    openInspector,
    triggerNavigation,
  } = useHelp();

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'copilot' | 'guides' | 'videos'>('copilot');
  const [videoFormat, setVideoFormat] = useState<'16x9' | '9x16'>('16x9');
  const [selectedTutorialId, setSelectedTutorialId] = useState<string>('overview-complete');
  const [tutorialCategory, setTutorialCategory] = useState<'all' | 'overview' | 'financial' | 'patients' | 'evaluations' | 'agenda'>('all');
  const [playerMode, setPlayerMode] = useState<'auto' | 'youtube' | 'local'>('auto');


  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'copilot',
      text: `### Olá! Sou o seu Copiloto Clínico & Especialista Synapsi.

Posso te orientar em tempo real sobre qualquer rotina da clínica, dúvidas operacionais e conformidade com as Resoluções do **CFP (01/2009 e 06/2019)**, **LGPD** e **Carnê-Leão**.

Você pode digitar uma dúvida livremente abaixo ou clicar em uma das sugestões rápidas!`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  if (!isHelpCenterOpen) return null;

  const handleSendQuery = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
        text: m.text,
      }));

      const res = await api.post('/ai/copilot', {
        question: q,
        currentScreen: 'Central de Ajuda',
        history: historyPayload,
      });

      const copilotMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'copilot',
        text: res.data.answer,
        recommendedAction: res.data.recommendedAction,
        actionLabel: res.data.actionLabel,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, copilotMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'copilot',
        text: 'Desculpe, tive uma instabilidade temporária ao consultar o motor de IA. Por favor, tente novamente.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendQuery();
    }
  };

  const handleActionClick = (action: string) => {
    triggerNavigation(action);
  };

  return (
    <div
      data-inspector-ui="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* CABEÇALHO */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-teal-500/10 via-indigo-500/10 to-purple-500/10 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-teal-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Copiloto Clínico & Central de Ajuda Synapsi
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  IA Generativa
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Respostas operacionais em passo a passo, embasadas no CFP, LGPD e rotinas fiscais.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* BOTÃO ATIVAR MODO LENTE */}
            <button
              type="button"
              onClick={openInspector}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition shadow-2xs cursor-pointer"
              title="Ative a mira para apontar e clicar em qualquer botão da tela"
            >
              <Crosshair className="h-3.5 w-3.5 text-teal-500" />
              <span>Modo Lente (Apontar)</span>
            </button>

            <button
              type="button"
              onClick={closeHelpCenter}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Fechar (ESC)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="px-6 py-2 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('copilot')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'copilot'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Copiloto com IA</span>
            </button>
            <button
              onClick={() => setActiveTab('guides')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'guides'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Procedimentos Rápidos (POPs)</span>
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'videos'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              <span>Vídeos Rápidos (1 min)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 hidden md:block">
            Pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">F1</kbd> a qualquer momento para abrir
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'copilot' ? (
            <>
              {/* SUGESTÕES RÁPIDAS (SE TIVER APENAS A MSG INICIAL) */}
              {messages.length === 1 && (
                <div className="space-y-2 mb-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Perguntas Frequentes da Clínica:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {FREQUENT_QUESTIONS.map((q, idx) => {
                      const Icon = q.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendQuery(q.query)}
                          className="flex items-start gap-2.5 p-3 rounded-2xl border text-left transition hover:scale-[1.01] hover:shadow-sm cursor-pointer bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-teal-400"
                        >
                          <div className={`p-1.5 rounded-xl shrink-0 ${q.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                              {q.title}
                            </span>
                            <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {q.query}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LISTA DE MENSAGENS */}
              <div className="space-y-4">
                {messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="h-8 w-8 rounded-2xl bg-gradient-to-tr from-teal-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                          <BrainCircuit className="h-4 w-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-3xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed ${
                          isUser
                            ? 'bg-teal-600 text-white rounded-br-xs shadow-md shadow-teal-600/20'
                            : 'bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 rounded-bl-xs shadow-2xs'
                        }`}
                      >
                        <div className="space-y-3 whitespace-pre-line font-normal">
                          {msg.text}
                        </div>

                        {/* BOTÃO DE AÇÃO DIRETA DA IA */}
                        {!isUser && msg.recommendedAction && (
                          <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] text-slate-400 font-medium">
                              Atalho direto para esta rotina:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleActionClick(msg.recommendedAction!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                            >
                              <span>{msg.actionLabel || 'Ir para a Tela'}</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="mt-2 text-right">
                          <span className={`text-[10px] ${isUser ? 'text-teal-200' : 'text-slate-400'}`}>
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-2xl bg-gradient-to-tr from-teal-600 to-indigo-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                      <BrainCircuit className="h-4 w-4" />
                    </div>
                    <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin text-teal-600 dark:text-teal-400" />
                      <span>O Copiloto está consultando os procedimentos da clínica e normas do CFP...</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : activeTab === 'guides' ? (
            /* GUIA DE PROCEDIMENTOS POPs */
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Procedimentos Operacionais Padrão (POPs Clínicos):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <h4 className="text-xs font-black text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-1">
                    1. Fechamento de Atendimento & Prontuário
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                    Toda sessão deve ser concluída com evolução em modelo DAP ou SOAP e assinada com hash SHA-256 no mesmo dia do atendimento.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSendQuery('Qual o procedimento padrão para evolução e assinatura com hash no prontuário?')}
                    className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Ver passo a passo detalhado →
                  </button>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
                    2. Despesas Compartilhadas e Rateio
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                    Custos divididos entre psicólogos sócios (aluguel, testes, secretária) são apurados automaticamente no balanço mensal de compensação.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSendQuery('Como funciona o acerto de contas de despesas compartilhadas no final do mês?')}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Ver passo a passo detalhado →
                  </button>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                    3. Livro-Caixa e Carnê-Leão (DARF 0190)
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                    Exportação consolidada mensal com deduções permitidas pela Receita Federal, pronta para escrituração pelo psicólogo ou contador.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSendQuery('Quais despesas posso deduzir no Livro-Caixa e como emitir o Carnê-Leão?')}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Ver passo a passo detalhado →
                  </button>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <h4 className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">
                    4. Recepção com Fila de TV e LGPD
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                    Chamada de pacientes na tela de espera da clínica sem expor sobrenome ou especialidade diagnóstica (conforme Art. 11 da LGPD).
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSendQuery('Como configurar a TV da sala de espera para chamar pacientes com sigilo?')}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    Ver passo a passo detalhado →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ABA DE VÍDEOS RÁPIDOS & CANAL YOUTUBE */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* BANNER DO CANAL OFICIAL YOUTUBE */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-red-500/10 via-rose-500/5 to-teal-500/10 border border-red-200/80 dark:border-red-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-red-600/30">
                    <Youtube className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Canal Oficial Synapsis Clínico no YouTube
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                        Oficial
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tutoriais práticos em 1 minuto, rotinas de Carnê-Leão e novidades regulatórias do CFP.
                    </p>
                  </div>
                </div>

                <a
                  href="https://www.youtube.com/@synapsisclinico"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/20 transition cursor-pointer shrink-0"
                >
                  <Youtube className="h-4 w-4" />
                  <span>Inscrever-se / Acessar Canal</span>
                  <ExternalLink className="h-3 w-3 opacity-80" />
                </a>
              </div>

              {/* BARRA DE FILTROS DE CATEGORIA */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {(
                  [
                    { id: 'all', label: 'Todos os Tutoriais' },
                    { id: 'overview', label: 'Visão Geral' },
                    { id: 'financial', label: 'Financeiro & DARF' },
                    { id: 'patients', label: 'Prontuário CFP' },
                    { id: 'evaluations', label: 'Avaliações' },
                    { id: 'agenda', label: 'Agenda Inteligente' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setTutorialCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                      tutorialCategory === cat.id
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* CARD DO PLAYER EM DESTAQUE */}
              {(() => {
                const currentTutorial =
                  VIDEO_TUTORIALS.find((t) => t.id === selectedTutorialId) || VIDEO_TUTORIALS[0];
                const isYouTube =
                  (playerMode === 'youtube' || (playerMode === 'auto' && Boolean(currentTutorial.youtubeId))) &&
                  Boolean(currentTutorial.youtubeId);

                return (
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
                    {/* TOPO DO PLAYER */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                            {currentTutorial.badge}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            Duração: {currentTutorial.duration}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-slate-900 dark:text-white mt-1">
                          {currentTutorial.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {currentTutorial.description}
                        </p>
                      </div>

                      {/* CONTROLES DO PLAYER (FORMATO E FONTE) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {currentTutorial.youtubeId && (
                          <div className="flex items-center bg-white dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => setPlayerMode('youtube')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                isYouTube
                                  ? 'bg-red-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                              }`}
                            >
                              <Youtube className="h-3.5 w-3.5" />
                              <span>YouTube</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPlayerMode('local')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                !isYouTube
                                  ? 'bg-teal-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                              }`}
                            >
                              <Video className="h-3.5 w-3.5" />
                              <span>Local HD</span>
                            </button>
                          </div>
                        )}

                        {!isYouTube && (
                          <div className="flex items-center bg-white dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => setVideoFormat('16x9')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                videoFormat === '16x9'
                                  ? 'bg-teal-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                              }`}
                            >
                              <Monitor className="h-3.5 w-3.5" />
                              <span>16:9</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setVideoFormat('9x16')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                videoFormat === '9x16'
                                  ? 'bg-teal-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                              }`}
                            >
                              <Smartphone className="h-3.5 w-3.5" />
                              <span>9:16 (Shorts)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* REPRODUTOR DE VÍDEO (IFRAME OU LOCAL) */}
                    <div className="flex flex-col items-center justify-center bg-black/95 rounded-2xl overflow-hidden border border-slate-800 shadow-xl p-2 sm:p-3">
                      {isYouTube ? (
                        <div className="w-full aspect-video max-h-[420px]">
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${currentTutorial.youtubeId}?rel=0&modestbranding=1&playsinline=1`}
                            title={currentTutorial.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="w-full h-full rounded-xl border-0 shadow-md"
                          />
                        </div>
                      ) : (
                        <video
                          key={`${currentTutorial.id}-${videoFormat}`}
                          controls
                          preload="metadata"
                          playsInline
                          className={`rounded-xl shadow-md max-h-[380px] w-auto ${
                            videoFormat === '9x16' ? 'aspect-[9/16]' : 'aspect-video w-full'
                          }`}
                        >
                          <source
                            src={
                              videoFormat === '16x9'
                                ? currentTutorial.local16x9Url
                                : currentTutorial.local9x16Url
                            }
                            type="video/mp4"
                          />
                          Seu navegador não suporta a reprodução de vídeo.
                        </video>
                      )}
                    </div>

                    {/* METADADOS & DOWNLOAD LOCAL */}
                    <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 flex-wrap text-slate-500 dark:text-slate-400 text-[11px]">
                        <span className="font-bold text-teal-600 dark:text-teal-400">
                          1080p 60fps Full HD
                        </span>
                        <span>•</span>
                        <span>Locução Neural PT-BR</span>
                        <span>•</span>
                        <span>Legendas Rápidas</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={currentTutorial.local16x9Url}
                          download={`${currentTutorial.id}_16x9.mp4`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition shadow-2xs cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Baixar 16:9</span>
                        </a>
                        <a
                          href={currentTutorial.local9x16Url}
                          download={`${currentTutorial.id}_9x16.mp4`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Baixar 9:16 Shorts</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CATÁLOGO DE TUTORIAIS EM GRADE */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Catálogo de Tutoriais Rápidos:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Clique em um vídeo para carregar no player
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(tutorialCategory === 'all'
                    ? VIDEO_TUTORIALS
                    : VIDEO_TUTORIALS.filter((t) => t.category === tutorialCategory)
                  ).map((tutorial) => {
                    const isSelected = tutorial.id === selectedTutorialId;

                    return (
                      <div
                        key={tutorial.id}
                        onClick={() => setSelectedTutorialId(tutorial.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
                          isSelected
                            ? 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 hover:shadow-xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {tutorial.categoryLabel}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {tutorial.duration}
                            </span>
                          </div>

                          <h5 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                            {tutorial.title}
                          </h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {tutorial.description}
                          </p>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                          {isSelected ? (
                            <span className="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                              <PlayCircle className="h-3.5 w-3.5" />
                              <span>Em reprodução</span>
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 group-hover:text-teal-600">
                              <PlayCircle className="h-3.5 w-3.5" />
                              <span>Assistir vídeo</span>
                            </span>
                          )}

                          {tutorial.youtubeId ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-bold">
                              <Youtube className="h-3 w-3" />
                              <span>YouTube</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">
                              HD Local
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BARRA DE ENTRADA / PERGUNTA */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Como ratear o aluguel? Onde assino o prontuário? O que fazer se o paciente faltar?"
                className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                disabled={isLoading}
              />
              <Search className="h-4 w-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputQuery.trim()}
              className="px-4.5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-md shadow-teal-600/20 transition flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <span>Perguntar</span>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
