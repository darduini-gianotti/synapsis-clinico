import React, { useState, useMemo } from 'react';
import { useAcademy } from '../../context/AcademyContext.js';
import { ACADEMY_TOURS, ACADEMY_MODULES } from './academyToursData.js';
import { TourCategory } from './types.js';
import {
  GraduationCap,
  X,
  Play,
  RotateCcw,
  Check,
  Clock,
  ShieldCheck,
  Radio,
  Brain,
  Calendar,
  Activity,
  Layers,
  DollarSign,
  Lock,
  Search,
  Sparkles,
} from 'lucide-react';

export const AcademyCatalogModal: React.FC = () => {
  const { isCatalogOpen, closeCatalog, startTour, userProgress } = useAcademy();
  const [selectedCategory, setSelectedCategory] = useState<TourCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter modules that have at least one tour registered
  const activeModules = useMemo(() => {
    return ACADEMY_MODULES.filter((m) =>
      ACADEMY_TOURS.some((t) => t.category === m.id)
    );
  }, []);

  // Calculate overall stats
  const totalTours = ACADEMY_TOURS.length;
  const completedTotal = ACADEMY_TOURS.filter((t) => userProgress[t.id]?.status === 'COMPLETED').length;
  const percentComplete = totalTours > 0 ? Math.round((completedTotal / totalTours) * 100) : 0;

  // Filter tours by category and search keyword
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTours = useMemo(() => {
    return ACADEMY_TOURS.filter((tour) => {
      if (selectedCategory !== 'all' && tour.category !== selectedCategory) {
        return false;
      }
      if (normalizedQuery) {
        const matchTitle = tour.title.toLowerCase().includes(normalizedQuery);
        const matchDesc = tour.shortDescription.toLowerCase().includes(normalizedQuery);
        const matchBadge = tour.badge?.toLowerCase().includes(normalizedQuery) || false;
        const parentModule = ACADEMY_MODULES.find((m) => m.id === tour.category);
        const matchModule = parentModule?.title.toLowerCase().includes(normalizedQuery) || false;
        return matchTitle || matchDesc || matchBadge || matchModule;
      }
      return true;
    });
  }, [selectedCategory, normalizedQuery]);

  // Modules to display based on filtered tours
  const displayedModules = useMemo(() => {
    return activeModules.filter((m) =>
      filteredTours.some((t) => t.category === m.id)
    );
  }, [activeModules, filteredTours]);

  if (!isCatalogOpen) return null;

  const renderModuleIcon = (iconName: string, className = 'h-4 w-4') => {
    switch (iconName) {
      case 'DollarSign':
        return <DollarSign className={className} />;
      case 'Radio':
        return <Radio className={className} />;
      case 'Brain':
        return <Brain className={className} />;
      case 'Calendar':
        return <Calendar className={className} />;
      case 'Activity':
        return <Activity className={className} />;
      case 'Lock':
        return <Lock className={className} />;
      default:
        return <Layers className={className} />;
    }
  };

  const getAccentBadgeStyles = (color: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'indigo':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'teal':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border-teal-200 dark:border-teal-800';
      case 'sky':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      case 'purple':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Premium com Gradiente & Atmosfera Visual */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-[#0c242b] to-slate-900 border-b border-teal-500/25 p-5 sm:p-6 shadow-md">
          {/* Efeitos de luz suave decorativa no fundo */}
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 right-20 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Logo & Textos */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-white shadow-lg shadow-teal-500/30 ring-2 ring-teal-400/20 shrink-0">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    Synapsis Academy
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/40 text-[10px] sm:text-[11px] font-bold shadow-xs backdrop-blur-xs shrink-0">
                    <Sparkles className="h-3 w-3 text-teal-300 animate-pulse" />
                    Aprenda Enquanto Faz
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 font-normal mt-1 leading-relaxed max-w-xl">
                  Capacitação interativa em ambiente simulado. Pratique procedimentos sem alterar dados reais da clínica.
                </p>
              </div>
            </div>

            {/* HUD de Progresso Geral & Botão Fechar */}
            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <div className="flex items-center gap-3 bg-slate-800/90 dark:bg-slate-950/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-teal-500/30 shadow-lg shadow-black/30">
                <span className="text-xs font-semibold text-slate-200 hidden md:inline">Progresso Geral:</span>
                <div className="w-20 sm:w-24 bg-slate-700/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-600/40">
                  <div
                    className="bg-gradient-to-r from-teal-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-xs shadow-teal-500/50"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
                <strong className="text-emerald-400 font-black text-sm tracking-tight">{percentComplete}%</strong>
                <span className="text-[11px] text-slate-400 font-mono">({completedTotal}/{totalTours})</span>
              </div>

              <button
                onClick={closeCatalog}
                className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
                title="Fechar catálogo"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar and Quick Search */}
        <div className="p-3.5 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800/90 bg-slate-100/90 dark:bg-slate-850/90 backdrop-blur-xs space-y-3">
          {/* Categories Tabs com 100% de largura livre para rolagem horizontal e contornos visíveis */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 w-full">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-sm shadow-teal-600/30 border border-teal-500'
                  : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/90 shadow-2xs'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Todos os Módulos</span>
            </button>

            {activeModules.map((m) => {
              const isSelected = selectedCategory === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedCategory(m.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-sm shadow-teal-600/30 border border-teal-500'
                      : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/90 shadow-2xs'
                  }`}
                >
                  {renderModuleIcon(m.iconName, 'h-3.5 w-3.5')}
                  <span>{m.title}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom Row: Quick Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar procedimento por palavra-chave (ex: WhatsApp, DARF, GAD-7, Agendamento, Check-in)..."
              className="w-full pl-10 pr-9 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 shadow-2xs transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Procedures List Grouped by Modules (1 Trilha por Linha / Compact Rows) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-5">
          {searchQuery && (
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>
                Mostrando <strong>{filteredTours.length}</strong> de <strong>{totalTours}</strong> procedimentos para "<em>{searchQuery}</em>"
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold cursor-pointer"
              >
                Limpar busca
              </button>
            </div>
          )}

          {displayedModules.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-3">
              <Search className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Nenhum procedimento encontrado com os filtros atuais.
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Tente buscar por outro termo ou selecione "Todos os Módulos" para ver o catálogo completo.
              </p>
              {(searchQuery || selectedCategory !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-200 dark:border-teal-800 hover:bg-teal-100 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Restaurar Catálogo</span>
                </button>
              )}
            </div>
          ) : (
            displayedModules.map((moduleMeta) => {
              const moduleTours = filteredTours.filter((t) => t.category === moduleMeta.id);
              if (moduleTours.length === 0) return null;

              const totalModuleToursInCatalog = ACADEMY_TOURS.filter((t) => t.category === moduleMeta.id);
              const moduleCompleted = totalModuleToursInCatalog.filter(
                (t) => userProgress[t.id]?.status === 'COMPLETED'
              ).length;
              const modulePct = Math.round((moduleCompleted / totalModuleToursInCatalog.length) * 100);
              const isModuleFull = moduleCompleted === totalModuleToursInCatalog.length;

              return (
                <div
                  key={moduleMeta.id}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 p-3 sm:p-4 space-y-2.5"
                >
                  {/* Compact Module Section Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60 dark:border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${getAccentBadgeStyles(
                          moduleMeta.accentColor
                        )}`}
                      >
                        {renderModuleIcon(moduleMeta.iconName, 'h-3.5 w-3.5')}
                      </div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {moduleMeta.title}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isModuleFull
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {moduleCompleted} de {totalModuleToursInCatalog.length} concluídas
                        </span>
                      </div>
                    </div>

                    {/* Module Mini Progress Bar */}
                    <div className="flex items-center gap-2 self-start sm:self-auto bg-white dark:bg-slate-850 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Domínio:</span>
                      <div className="w-14 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isModuleFull ? 'bg-emerald-500' : 'bg-teal-500'
                          }`}
                          style={{ width: `${modulePct}%` }}
                        />
                      </div>
                      <strong
                        className={`text-[11px] font-bold ${
                          isModuleFull ? 'text-emerald-600 dark:text-emerald-400' : 'text-teal-600 dark:text-teal-400'
                        }`}
                      >
                        {modulePct}%
                      </strong>
                    </div>
                  </div>

                  {/* Module Tours List: 1 Trilha por Linha (Horizontal Slim Rows) */}
                  <div className="space-y-1.5">
                    {moduleTours.map((tour) => {
                      const progress = userProgress[tour.id];
                      const isCompleted = progress?.status === 'COMPLETED';
                      const repCount = progress?.completed_count || 0;

                      return (
                        <div
                          key={tour.id}
                          className={`rounded-xl border p-2.5 sm:px-3.5 sm:py-2.5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-2.5 group ${
                            isCompleted
                              ? 'border-emerald-200/80 dark:border-emerald-900/60 bg-white dark:bg-slate-850 shadow-2xs hover:border-emerald-400 dark:hover:border-emerald-700'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-2xs hover:border-teal-500/60 dark:hover:border-teal-500/60'
                          }`}
                        >
                          {/* Left: Indicator + Title + Badge + Short Description */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Semaforo Status */}
                            {isCompleted ? (
                              <div
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs ring-2 ring-emerald-200 dark:ring-emerald-950"
                                title="Procedimento Concluído"
                              >
                                <Check className="h-3 w-3 stroke-[3]" />
                              </div>
                            ) : (
                              <div
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                                title="Procedimento Pendente"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition truncate">
                                  {tour.title}
                                </h4>

                                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                                  {tour.badge}
                                </span>

                                {isCompleted ? (
                                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shrink-0">
                                    <RotateCcw className="h-2.5 w-2.5" />
                                    {repCount}x praticado
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                                    Pendente
                                  </span>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-2xl">
                                {tour.shortDescription}
                              </p>
                            </div>
                          </div>

                          {/* Right: Meta Info + Direct Action Button */}
                          <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-1.5 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {tour.estimatedMinutes} min
                              </span>
                              <span>•</span>
                              <span>{tour.steps.length} etapas</span>
                            </div>

                            <button
                              onClick={() => startTour(tour.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs shrink-0 ${
                                isCompleted
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700'
                                  : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
                              }`}
                            >
                              {isCompleted ? (
                                <>
                                  <RotateCcw className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                                  <span>Praticar</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5 fill-current" />
                                  <span>Iniciar</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="p-3 sm:px-5 sm:py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0" />
          <span>
            <strong>Ambiente 100% Protegido:</strong> Os procedimentos rodam em modo simulado. Você pode errar, praticar e repetir quantas vezes quiser sem alterar dados reais da clínica.
          </span>
        </div>
      </div>
    </div>
  );
};
