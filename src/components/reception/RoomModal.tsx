import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Room } from '../../types.js';
import { Building, X, Check, Trash2, AlertCircle, Palette, Tag } from 'lucide-react';

interface RoomModalProps {
  isOpen: boolean;
  roomToEdit?: Room | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_COLORS = [
  '#0d9488', // Teal
  '#0284c7', // Sky
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#64748b', // Slate
];

const ROOM_TYPES = [
  { value: 'CLINICAL', label: 'Clínico Geral / TCC' },
  { value: 'NEURO', label: 'Neuropsicologia / Avaliação' },
  { value: 'PLAY_THERAPY', label: 'Infantil / Ludoterapia' },
  { value: 'ONLINE', label: 'Teleconsulta / Híbrido' },
];

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  roomToEdit,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [initials, setInitials] = useState('');
  const [roomType, setRoomType] = useState('CLINICAL');
  const [colorCode, setColorCode] = useState('#0d9488');
  const [status, setStatus] = useState('AVAILABLE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roomToEdit) {
      setName(roomToEdit.name || '');
      setInitials(roomToEdit.initials || '');
      setRoomType(roomToEdit.room_type || 'CLINICAL');
      setColorCode(roomToEdit.color_code || '#0d9488');
      setStatus(roomToEdit.status || 'AVAILABLE');
    } else {
      setName('');
      setInitials('');
      setRoomType('CLINICAL');
      setColorCode('#0d9488');
      setStatus('AVAILABLE');
    }
    setError(null);
  }, [roomToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('O nome do consultório é obrigatório.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (roomToEdit) {
        await api.put(`/reception/rooms/${roomToEdit.id}`, {
          name: name.trim(),
          initials: initials.trim().toUpperCase(),
          room_type: roomType,
          color_code: colorCode,
          status,
        });
      } else {
        await api.post('/reception/rooms', {
          name: name.trim(),
          initials: initials.trim().toUpperCase(),
          room_type: roomType,
          color_code: colorCode,
          status,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving room:', err);
      setError(err?.response?.data?.error || 'Erro ao salvar consultório.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!roomToEdit) return;
    if (!confirm(`Deseja realmente inativar o consultório "${roomToEdit.name}"?`)) return;

    try {
      setIsLoading(true);
      setError(null);
      await api.delete(`/reception/rooms/${roomToEdit.id}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error deleting room:', err);
      setError(err?.response?.data?.error || 'Erro ao inativar consultório.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: colorCode }}
            >
              <Building className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {roomToEdit ? 'Editar Consultório Físico' : 'Novo Consultório Físico'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure a sala para gestão na Torre de Recepção e na Agenda.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/80">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Nome da Sala */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Nome do Consultório *</span>
              <span className="text-[10px] text-slate-400 font-normal">Ex: Consultório 1 - Adulto</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Consultório 1 - TCC & Adulto"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition"
            />
          </div>

          {/* Sigla / Código Curto para a Grade da Agenda */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Sigla da Sala (Padrão para a Grade da Agenda)</span>
              <span className="text-[10px] text-slate-400 font-normal">Ex: C1, C2, INF, NEURO</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                placeholder="Ex: C1"
                className="w-28 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition text-center"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Aparecerá de forma compacta no bloco de agendamento na Agenda (ex: <strong className="text-teal-500 font-mono">{initials || 'C1'}</strong>).
              </span>
            </div>
          </div>

          {/* Tipo / Especialidade */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              <span>Finalidade / Especialidade</span>
            </label>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition"
            >
              {ROOM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Cor da Tag */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-slate-400" />
                <span>Cor de Identificação na Agenda</span>
              </span>
              <div
                className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600"
                style={{ backgroundColor: colorCode }}
              />
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColorCode(c)}
                  className={`w-7 h-7 rounded-full border-2 transition transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                    colorCode === c ? 'border-slate-900 dark:border-white scale-110 shadow-md' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {colorCode === c && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
              <input
                type="color"
                value={colorCode}
                onChange={(e) => setColorCode(e.target.value)}
                className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                title="Escolher cor personalizada"
              />
            </div>
          </div>

          {/* Status Inicial / Operacional */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Status Operacional Atual
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition"
            >
              <option value="AVAILABLE">Disponível (Pronto para uso)</option>
              <option value="OCCUPIED">Ocupado (Em atendimento)</option>
              <option value="CLEANING">Higienização / Limpeza</option>
              <option value="MAINTENANCE">Manutenção / Interditado</option>
            </select>
          </div>

          {/* Botões de Ação */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            {roomToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Inativar</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition cursor-pointer flex items-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Salvar Consultório</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
