import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Patient, ScaleResult } from '../types.js';
import { useAcademy } from '../context/AcademyContext.js';
import { MOCK_SANDBOX_PATIENTS, MOCK_SANDBOX_SCALES } from './academy/mockData.js';
import {
  Activity,
  Plus,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface ScalesModuleProps {
  patientId?: number;
}

export const ScalesModule: React.FC<ScalesModuleProps> = ({ patientId }) => {
  const { isSandboxActive, advanceStep, activeTour } = useAcademy();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [scales, setScales] = useState<ScaleResult[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | ''>(patientId || '');
  const [activeScale, setActiveScale] = useState<'PHQ9' | 'GAD7'>('GAD7');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // If patientId prop changes (e.g. parent renders a different patient), update it
  useEffect(() => {
    if (patientId) {
      setSelectedPatientId(patientId);
    }
  }, [patientId]);

  const gad7Questions = [
    { id: 'q1', text: 'Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)' },
    { id: 'q2', text: 'Não ser capaz de impedir ou de controlar as preocupações' },
    { id: 'q3', text: 'Preocupar-se demais com diversas coisas' },
    { id: 'q4', text: 'Dificuldade para relaxar' },
    { id: 'q5', text: 'Ficar tão agitado(a) que se torna difícil ficar parado(a)' },
    { id: 'q6', text: 'Ficar facilmente irritado(a) ou chateado(a)' },
    { id: 'q7', text: 'Sentir medo como se algo horrível fosse acontecer' },
  ];

  const phq9Questions = [
    { id: 'q1', text: 'Pouco interesse ou prazer em fazer as coisas' },
    { id: 'q2', text: 'Sentir-se para baixo, deprimido(a) ou sem perspectiva' },
    { id: 'q3', text: 'Dificuldade para adormecer, continuar dormindo ou dormir demais' },
    { id: 'q4', text: 'Sentir-se cansado(a) ou com pouca energia' },
    { id: 'q5', text: 'Falta de apetite ou comer demais' },
    { id: 'q6', text: 'Sentir-se mal consigo mesmo(a) ou que é um fracasso' },
    { id: 'q7', text: 'Dificuldade para se concentrar nas coisas (ler, ver TV)' },
    { id: 'q8', text: 'Mover-se ou falar tão lentamente que os outros notam, ou o oposto' },
    { id: 'q9', text: 'Pensamentos de que seria melhor estar morto(a) ou de se ferir' },
  ];

  const answerOptions = [
    { value: 0, label: 'Nenhuma vez (0)' },
    { value: 1, label: 'Vários dias (1)' },
    { value: 2, label: 'Mais da metade dos dias (2)' },
    { value: 3, label: 'Quase todos os dias (3)' },
  ];

  const fetchData = async () => {
    try {
      const [patRes, scaRes] = await Promise.all([
        api.get('/patients'),
        api.get('/scales'),
      ]);
      let patList: Patient[] = patRes.data.patients || [];
      let scaList: ScaleResult[] = scaRes.data.scales || [];

      if (isSandboxActive) {
        const mergedPatients = [...patList];
        MOCK_SANDBOX_PATIENTS.forEach((mp) => {
          if (!mergedPatients.some((p) => p.id === mp.id)) {
            mergedPatients.unshift(mp as any);
          }
        });
        patList = mergedPatients;

        const mergedScales = [...scaList];
        MOCK_SANDBOX_SCALES.forEach((ms) => {
          if (!mergedScales.some((s) => s.id === ms.id)) {
            mergedScales.push(ms as any);
          }
        });
        scaList = mergedScales;
      }

      setPatients(patList);
      setScales(scaList);

      if (patList.length > 0 && selectedPatientId === '') {
        const anaPaula = patList.find((p) => p.id === 902);
        setSelectedPatientId(anaPaula ? anaPaula.id : patList[0].id);
      }
    } catch (err) {
      console.error('Failed to load scales:', err);
      if (isSandboxActive) {
        setPatients(MOCK_SANDBOX_PATIENTS as any);
        setScales(MOCK_SANDBOX_SCALES as any);
        setSelectedPatientId(902);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [isSandboxActive]);

  useEffect(() => {
    if (isSandboxActive && activeTour?.id === 'tour-scales-application') {
      const anaPaula = patients.find((p) => p.id === 902);
      if (anaPaula) {
        setSelectedPatientId(902);
      }
    }
  }, [isSandboxActive, activeTour?.id, patients]);

  const handleOptionSelect = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (isSandboxActive && activeTour?.id === 'tour-scales-application') {
      setTimeout(() => {
        advanceStep();
      }, 350);
    }
  };

  // Calculate realtime score
  const questions = activeScale === 'GAD7' ? gad7Questions : phq9Questions;
  const currentTotal = questions.reduce((sum, q) => sum + (answers[q.id] || 0), 0);

  const getSeverity = (scale: 'GAD7' | 'PHQ9', score: number) => {
    if (scale === 'GAD7') {
      if (score >= 15) return { label: 'Ansiedade Grave', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
      if (score >= 10) return { label: 'Ansiedade Moderada', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
      if (score >= 5) return { label: 'Ansiedade Leve', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' };
      return { label: 'Mínima / Normal', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
    } else {
      if (score >= 20) return { label: 'Depressão Grave', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
      if (score >= 15) return { label: 'Moderadamente Grave', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' };
      if (score >= 10) return { label: 'Depressão Moderada', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
      if (score >= 5) return { label: 'Depressão Leve', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' };
      return { label: 'Mínima / Remissão', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
    }
  };

  const currentSeverity = getSeverity(activeScale, currentTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    if (isSandboxActive) {
      // Sandbox: autopreenche perguntas faltantes se houver para fluidez da trilha
      const filledAnswers = { ...answers };
      questions.forEach((q) => {
        if (filledAnswers[q.id] === undefined) {
          filledAnswers[q.id] = 1;
        }
      });
      const simulatedTotal = questions.reduce((sum, q) => sum + (filledAnswers[q.id] || 0), 0);
      const sev = getSeverity(activeScale, simulatedTotal);
      const targetPatient = patients.find((p) => p.id === Number(selectedPatientId));

      const newSimulatedResult: ScaleResult = {
        id: Date.now(),
        patient_id: Number(selectedPatientId),
        psychologist_id: 1,
        scale_type: activeScale,
        answers: filledAnswers,
        total_score: simulatedTotal,
        severity: sev.label,
        created_at: new Date().toISOString(),
        patient_name: targetPatient?.full_name || 'Ana Paula Mendonça (Simulação)',
      };

      setScales((prev) => [newSimulatedResult, ...prev]);
      setFeedback(`[TREINAMENTO SANDBOX] Escala ${activeScale} registrada com sucesso! Escore: ${simulatedTotal} (${sev.label}). Sem impacto no banco.`);
      setAnswers({});
      advanceStep();
      setTimeout(() => setFeedback(null), 5000);
      return;
    }

    // Verify all answered
    const unanswered = questions.some((q) => answers[q.id] === undefined);
    if (unanswered) {
      alert('Por favor, responda a todas as questões da escala.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/scales', {
        patient_id: Number(selectedPatientId),
        scale_type: activeScale,
        answers,
      });

      setFeedback(`Escala ${activeScale} aplicada com sucesso! Escore: ${currentTotal} (${currentSeverity.label}).`);
      setAnswers({});
      fetchData();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao salvar escala.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-teal-600" />
            Escalas Psicométricas Clínicas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Inventários de rastreio clínico padronizados: GAD-7 (Ansiedade Generalizada) e PHQ-9 (Depressão).
          </p>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 p-3 text-xs text-teal-900 dark:border-teal-800 dark:bg-teal-950/80 dark:text-teal-200 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Two Column Layout: Left Form to Apply Scale, Right History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scale Application (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850 dark:bg-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-tour="scales-tab-gad7"
                  onClick={() => {
                    setActiveScale('GAD7');
                    setAnswers({});
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeScale === 'GAD7'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  GAD-7 (Ansiedade)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveScale('PHQ9');
                    setAnswers({});
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeScale === 'PHQ9'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  PHQ-9 (Depressão)
                </button>
              </div>

              {/* Patient Selector */}
              {!patientId && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Paciente:</span>
                  <select
                    data-tour="scales-patient-select"
                    value={selectedPatientId}
                    onChange={(e) => {
                      setSelectedPatientId(Number(e.target.value));
                      if (isSandboxActive && activeTour?.id === 'tour-scales-application') {
                        advanceStep();
                      }
                    }}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Scale Intro */}
            <div className="mb-4 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
              <span className="font-bold text-slate-800 dark:text-slate-200">Instruções para o Paciente: </span>
              Nas últimas 2 semanas, com que frequência você foi incomodado(a) por qualquer um dos seguintes problemas?
            </div>

            {/* Questions list */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-900/30 text-xs"
                  >
                    <p className="font-semibold text-slate-900 dark:text-white mb-2">
                      {idx + 1}. {q.text}
                    </p>
                    <div
                      className="grid grid-cols-2 sm:grid-cols-4 gap-1.5"
                      {...(idx === 0 ? { 'data-tour': 'scales-options-group' } : {})}
                    >
                      {answerOptions.map((opt) => {
                        const isSelected = answers[q.id] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleOptionSelect(q.id, opt.value)}
                            className={`p-2 rounded-lg text-left text-[11px] font-medium transition border ${
                              isSelected
                                ? 'border-teal-500 bg-teal-50 text-teal-900 font-bold dark:bg-teal-950 dark:text-teal-200 dark:border-teal-400'
                                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
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

              {/* Real-time score calculator */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500">Pontuação Total Calculada:</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {currentTotal} / {activeScale === 'GAD7' ? '21' : '27'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Severidade Clínica:</span>
                  <div>
                    <span className={`inline-block mt-0.5 px-3 py-1 rounded-full text-xs font-bold ${currentSeverity.color}`}>
                      {currentSeverity.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  data-tour="scales-submit-btn"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{isSubmitting ? 'Salvando...' : 'Salvar Resultado da Escala'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Historical Results (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850 dark:bg-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-3">
              Histórico de Aplicações
            </h3>

            {scales.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhum resultado registrado ainda.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {scales.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {s.patient_name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                        {s.scale_type}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Escore: {s.total_score} pts
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Classificação: {s.severity}
                      </span>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-1.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(s.created_at).toLocaleDateString('pt-BR')} às {new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
