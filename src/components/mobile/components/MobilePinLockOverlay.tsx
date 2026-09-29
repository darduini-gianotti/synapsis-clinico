import React, { useState, useEffect } from 'react';
import { Lock, Delete, Fingerprint, ShieldCheck } from 'lucide-react';

interface MobilePinLockOverlayProps {
  isLocked: boolean;
  onUnlock: () => void;
  correctPin: string;
}

export const MobilePinLockOverlay: React.FC<MobilePinLockOverlayProps> = ({
  isLocked,
  onUnlock,
  correctPin,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (enteredPin.length === 4) {
      if (enteredPin === correctPin) {
        onUnlock();
        setEnteredPin('');
        setIsError(false);
      } else {
        setIsError(true);
        setTimeout(() => {
          setEnteredPin('');
          setIsError(false);
        }, 500);
      }
    }
  }, [enteredPin, correctPin, onUnlock]);

  if (!isLocked) return null;

  const handleDigit = (digit: string) => {
    if (enteredPin.length < 4) {
      setEnteredPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950 p-6 select-none animate-in fade-in duration-200">
      {/* Topo: Logo & Mensagem de Bloqueio */}
      <div className="flex flex-col items-center text-center mt-8">
        <div className="h-16 w-16 rounded-3xl bg-teal-950/80 border border-teal-800/80 flex items-center justify-center text-teal-400 mb-3 shadow-lg shadow-teal-900/30">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-black text-white">Synapsis Clínico</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Acesso protegido por sigilo clínico (CFP/LGPD). Digite seu PIN de 4 dígitos para desbloquear.
        </p>

        {/* 4 Pontos de Indicador do PIN */}
        <div className={`flex items-center gap-4 mt-6 ${isError ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = enteredPin.length > idx;
            return (
              <div
                key={idx}
                className={`h-4 w-4 rounded-full transition-all duration-150 ${
                  isError
                    ? 'bg-rose-500 scale-110'
                    : isFilled
                    ? 'bg-teal-400 scale-110 shadow-md shadow-teal-400/50'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>
        {isError && (
          <p className="text-xs font-bold text-rose-400 mt-2 animate-in fade-in">
            PIN incorreto. Tente novamente.
          </p>
        )}
      </div>

      {/* Teclado Numérico Ergonômico de Polegar */}
      <div className="w-full max-w-xs mb-8">
        <div className="grid grid-cols-3 gap-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-teal-950 active:border-teal-500 border border-slate-800 text-xl font-black text-white shadow-sm transition cursor-pointer flex items-center justify-center"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={onUnlock}
            className="h-16 rounded-2xl bg-slate-900/40 border border-slate-800/40 text-slate-400 flex items-center justify-center cursor-pointer"
            title="Biometria"
          >
            <Fingerprint className="h-6 w-6 text-teal-400" />
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-teal-950 active:border-teal-500 border border-slate-800 text-xl font-black text-white shadow-sm transition cursor-pointer flex items-center justify-center"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-slate-900/40 border border-slate-800/40 text-slate-400 flex items-center justify-center active:text-rose-400 cursor-pointer"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
