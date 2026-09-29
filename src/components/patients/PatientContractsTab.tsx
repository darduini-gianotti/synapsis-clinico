import React from 'react';
import { Patient } from '../../types.js';

interface PatientContractsTabProps {
  patient: Patient;
}

export const PatientContractsTab: React.FC<PatientContractsTabProps> = ({ patient }) => {
  return (
    <div className="p-6 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">4. Contratos & Pacotes</h2>
      <p className="text-sm text-slate-500 mt-2">Módulo em construção. Aqui você poderá definir pacotes de avaliação neuropsicológica e sessões de psicoterapia para {patient.full_name}.</p>
    </div>
  );
};
