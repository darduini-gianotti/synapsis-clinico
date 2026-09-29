import React from 'react';
import {
  Cake,
  Gift,
  Sparkles,
  MessageCircle,
} from 'lucide-react';

export interface BirthdayPatient {
  id: number;
  full_name: string;
  phone?: string | null;
  birth_date: string;
  psychologist_name?: string | null;
  turningAge: number;
  isToday: boolean;
  daysUntil: number;
  dayAndMonthText: string;
}

interface BirthdayWidgetProps {
  birthdays: BirthdayPatient[];
  clinicName: string;
  isLoading: boolean;
}

export const BirthdayWidget: React.FC<BirthdayWidgetProps> = ({
  birthdays,
  clinicName,
  isLoading,
}) => {
  const todayBirthdays = birthdays.filter((b) => b.isToday);
  const upcomingBirthdays = birthdays.filter((b) => !b.isToday);

  // Generate WhatsApp greeting link
  const getWhatsAppGreetingUrl = (b: BirthdayPatient) => {
    if (!b.phone) return '#';
    const rawPhone = b.phone.replace(/\D/g, '');
    if (rawPhone.length < 10) return '#';

    const firstName = b.full_name.split(' ')[0] || b.full_name;
    const psychText = b.psychologist_name
      ? ` e do(a) psicólogo(a) ${b.psychologist_name}`
      : '';

    const message = `Olá, ${firstName}! 🎉🎂\n\nEm nome de toda a equipe da ${clinicName}${psychText}, queremos lhe desejar um Feliz Aniversário!\n\nQue este novo ciclo traga muita saúde, serenidade, realizações e momentos felizes. Conte sempre conosco!\n\nUm caloroso abraço! ✨`;

    return `https://wa.me/55${rawPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <Cake className="h-4 w-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
            Aniversariantes
          </h3>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
          {birthdays.length} na semana
        </span>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-xs text-slate-400">
          Verificando datas comemorativas...
        </div>
      ) : birthdays.length === 0 ? (
        <div className="py-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <Gift className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Nenhum aniversariante nesta semana
          </p>
          <p className="text-[10.5px] text-slate-400">
            Mensagens de parabéns em dia!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* ======================================================== */}
          {/* 1. ANIVERSARIANTES DE HOJE (DESTAQUE MÁXIMO)             */}
          {/* ======================================================== */}
          {todayBirthdays.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>Aniversariante(s) de Hoje!</span>
              </span>

              {todayBirthdays.map((b) => {
                const url = getWhatsAppGreetingUrl(b);
                const hasPhone = b.phone && b.phone.replace(/\D/g, '').length >= 10;

                return (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl border border-amber-300/80 bg-amber-50/90 dark:border-amber-700/60 dark:bg-amber-950/30 space-y-2.5 shadow-2xs animate-in fade-in"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-amber-950 dark:text-amber-100">
                          {b.full_name}
                        </h4>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-500 text-white shadow-2xs">
                          HOJE! 🎂
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-900 dark:text-amber-200 mt-0.5">
                        Completa <strong>{b.turningAge} anos</strong>
                        {b.psychologist_name && ` • Terapeuta: ${b.psychologist_name}`}
                      </p>
                    </div>

                    {/* Botão de WhatsApp */}
                    <div>
                      {hasPhone ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                          title="Enviar mensagem calorosa pré-formatada no WhatsApp"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>Parabenizar no WhatsApp</span>
                        </a>
                      ) : (
                        <span className="block text-center text-[10.5px] text-amber-700 dark:text-amber-400 italic">
                          Telefone não cadastrado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. PRÓXIMOS ANIVERSARIANTES (7 DIAS)                    */}
          {/* ======================================================== */}
          {upcomingBirthdays.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Próximos nos Próximos 7 Dias
              </span>

              <div className="space-y-1.5">
                {upcomingBirthdays.map((b) => {
                  const url = getWhatsAppGreetingUrl(b);
                  const hasPhone = b.phone && b.phone.replace(/\D/g, '').length >= 10;

                  return (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-700/60 dark:bg-slate-800/60 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-semibold text-slate-800 dark:text-slate-200 truncate text-xs">
                            {b.full_name}
                          </h5>
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">
                            ({b.turningAge} anos)
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {b.daysUntil === 1 ? 'Amanhã' : `Em ${b.daysUntil} dias`} • {b.dayAndMonthText}
                        </p>
                      </div>

                      {hasPhone && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-400 transition shrink-0"
                          title="Enviar parabéns no WhatsApp"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
