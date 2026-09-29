import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileSignature,
  Calendar,
  MessageSquare,
  ShieldCheck,
  Plus,
} from 'lucide-react';

interface QuickRemindersWidgetProps {
  userRole: string;
  onNavigateToTab: (tab: string) => void;
}

export const QuickRemindersWidget: React.FC<QuickRemindersWidgetProps> = ({
  userRole,
  onNavigateToTab,
}) => {
  const [reminders, setReminders] = useState([
    {
      id: 1,
      text: 'Reunião clínica de equipe agendada para quinta-feira às 18:00.',
      type: 'info',
      tag: 'Geral',
    },
    {
      id: 2,
      text: 'Higienização e reposição de materiais terapêuticos nas salas 1 e 2.',
      type: 'routine',
      tag: 'Consultório',
    },
  ]);

  const [newReminderText, setNewReminderText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;
    setReminders((prev) => [
      {
        id: Date.now(),
        text: newReminderText.trim(),
        type: 'info',
        tag: 'Recado',
      },
      ...prev,
    ]);
    setNewReminderText('');
    setIsAdding(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <Bell className="h-4 w-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
            Avisos & Lembretes
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isAdding ? 'Fechar' : 'Novo'}</span>
        </button>
      </div>

      {/* Add reminder inline form */}
      {isAdding && (
        <form onSubmit={handleAddReminder} className="space-y-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 animate-in fade-in">
          <input
            type="text"
            placeholder="Digite o recado para a equipe..."
            value={newReminderText}
            onChange={(e) => setNewReminderText(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white focus:outline-hidden"
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2.5 py-1 rounded-lg text-[11px] text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold"
            >
              Publicar
            </button>
          </div>
        </form>
      )}

      {/* Reminders list */}
      <div className="space-y-2 text-xs">
        {/* Compliance / Security note */}
        <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80 dark:bg-teal-950/30 dark:border-teal-900/60 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-teal-950 dark:text-teal-200 text-[11px] block">
              Conformidade CFP 06/2019 Ativa
            </span>
            <p className="text-[10.5px] text-teal-800 dark:text-teal-300 leading-snug">
              Evoluções clínicas assinadas com hash SHA-256 e criptografia AES-256-GCM.
            </p>
          </div>
        </div>

        {/* Notices */}
        {reminders.map((r) => (
          <div
            key={r.id}
            className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-850 space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                {r.tag}
              </span>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
              {r.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
