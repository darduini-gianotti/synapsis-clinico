import React, { useState } from 'react';
import {
  FileText, CheckCircle2, Clock, Sparkles, HelpCircle,
  ArrowRight, X, RefreshCw, Send, Brain
} from 'lucide-react';
import { patientApi } from '../../services/patientApi';

interface PatientActivitiesTabProps {
  activitiesData: any[];
  onRefresh: () => void;
}

const GAD7_QUESTIONS = [
  'Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)',
  'Não ser capaz de impedir ou de controlar as preocupações',
  'Preocupar-se demais com diversas coisas',
  'Dificuldade para relaxar',
  'Ficar tão agitado(a) que se torna difícil permanecer sentado(a)',
  'Ficar facilmente irritado(a) ou chateado(a)',
  'Sentir medo como se algo terrível fosse acontecer'
];

const SCALE_OPTIONS = [
  { label: 'Nenhuma vez', value: 0 },
  { label: 'Vários dias', value: 1 },
  { label: 'Mais da metade dos dias', value: 2 },
  { label: 'Quase todos os dias', value: 3 },
];

export const PatientActivitiesTab: React.FC<PatientActivitiesTabProps> = ({ activitiesData, onRefresh }) => {
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [scaleAnswers, setScaleAnswers] = useState<Record<string, number>>({});
  const [diaryAnswers, setDiaryAnswers] = useState({ situacao: '', emocao: '', pensamento: '' });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleOpenActivity = (act: any) => {
    setSelectedActivity(act);
    setSuccessMsg('');
    setScaleAnswers({});
    setDiaryAnswers({ situacao: '', emocao: '', pensamento: '' });
  };

  const handleAnswerScale = (qIndex: number, val: number) => {
    setScaleAnswers(prev => ({ ...prev, [`q${qIndex + 1}`]: val }));
  };

  const handleSubmit = async () => {
    if (!selectedActivity) return;
    setSubmitting(true);
    try {
      const payload = selectedActivity.activity_type.startsWith('SCALE')
        ? scaleAnswers
        : diaryAnswers;

      await patientApi.submitActivity(selectedActivity.id, payload);
      setSuccessMsg('Respostas enviadas com sucesso ao seu psicólogo!');
      setTimeout(() => {
        setSelectedActivity(null);
        onRefresh();
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar respostas');
    } finally {
      setSubmitting(false);
    }
  };

  const isScaleComplete = GAD7_QUESTIONS.every((_, idx) => scaleAnswers[`q${idx + 1}`] !== undefined);

  return (
    <div className="space-y-4 pb-8 animate-fade-in">
      
      {/* Cabeçalho */}
      <div>
        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
          <span>Atividades & Escalas</span>
          <Brain className="w-5 h-5 text-indigo-600" />
        </h2>
        <p className="text-xs text-slate-500">Questionários e registros entre sessões recomendados pelo seu terapeuta</p>
      </div>

      {/* Lista de Atividades */}
      {activitiesData.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h4 className="font-bold text-slate-800 dark:text-white text-sm">Nenhuma tarefa pendente!</h4>
          <p className="text-xs text-slate-400">
            Você está em dia com todas as atividades e escalas atribuídas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activitiesData.map((act) => {
            const isCompleted = act.status === 'COMPLETED';
            return (
              <div
                key={act.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      isCompleted 
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">{act.title}</h4>
                      <p className="text-xs text-slate-500">{act.description}</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {isCompleted ? 'Respondido' : 'Pendente'}
                  </span>
                </div>

                {!isCompleted && (
                  <button
                    type="button"
                    onClick={() => handleOpenActivity(act)}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>Preencher Questionário</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE PREENCHIMENTO */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-white">
                {selectedActivity.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedActivity(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {successMsg ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-slate-800 dark:text-white text-base">Obrigado!</h4>
                <p className="text-xs text-slate-500">{successMsg}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Nas últimas duas semanas, com que frequência você foi incomodado(a) pelos seguintes problemas?
                </p>

                {/* Questionário GAD-7 */}
                {selectedActivity.activity_type.startsWith('SCALE') ? (
                  <div className="space-y-4">
                    {GAD7_QUESTIONS.map((q, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 space-y-2 border border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {idx + 1}. {q}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {SCALE_OPTIONS.map((opt) => {
                            const isSelected = scaleAnswers[`q${idx + 1}`] === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleAnswerScale(idx, opt.value)}
                                className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold transition-all text-left ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Diário Terapêutico */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        1. Qual foi a situação ou gatilho?
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Ex: Reunião no trabalho, conversa com familiar..."
                        value={diaryAnswers.situacao}
                        onChange={(e) => setDiaryAnswers(prev => ({ ...prev, situacao: e.target.value }))}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        2. O que você sentiu no corpo e nas emoções?
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Ex: Coração acelerado, aperto no peito, medo de falhar..."
                        value={diaryAnswers.emocao}
                        onChange={(e) => setDiaryAnswers(prev => ({ ...prev, emocao: e.target.value }))}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        3. Que pensamento automático surgiu na sua mente?
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Ex: 'Não vou dar conta', 'Todos estão me julgando'..."
                        value={diaryAnswers.pensamento}
                        onChange={(e) => setDiaryAnswers(prev => ({ ...prev, pensamento: e.target.value }))}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(null)}
                    className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Salvar e Continuar Depois
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || (selectedActivity.activity_type.startsWith('SCALE') && !isScaleComplete)}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
                  >
                    {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar ao Psicólogo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
