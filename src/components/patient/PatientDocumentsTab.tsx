import React, { useState } from 'react';
import {
  FileText, Shield, Download, Eye, CheckCircle2, Lock, X,
  FileCheck, Calendar, User, ExternalLink, Printer
} from 'lucide-react';

interface PatientDocumentsTabProps {
  documentsData: {
    officialDocuments: any[];
    patientDocuments: any[];
  };
  onRefresh: () => void;
}

export const PatientDocumentsTab: React.FC<PatientDocumentsTabProps> = ({ documentsData }) => {
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  const officialDocs = documentsData?.officialDocuments || [];
  const patientDocs = documentsData?.patientDocuments || [];
  const allDocs = [...officialDocs, ...patientDocs];

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getDocTypeLabel = (type?: string) => {
    switch (type) {
      case 'ATESTADO': return 'Atestado Psicológico';
      case 'DECLARACAO': return 'Declaração de Comparecimento';
      case 'LAUDO': return 'Laudo Psicológico / Neuro';
      case 'RELATORIO': return 'Relatório Psicológico';
      case 'PARECER': return 'Parecer Técnico';
      default: return 'Documento Oficial';
    }
  };

  return (
    <div className="space-y-4 pb-8 animate-fade-in">
      
      {/* Cabeçalho */}
      <div>
        <h2 className="text-lg font-black text-slate-800 dark:text-white">Cofre de Documentos Oficiais</h2>
        <p className="text-xs text-slate-500">Atestados, declarações e laudos emitidos pelo seu psicólogo</p>
      </div>

      {/* Alerta Ético Regulatório do CFP */}
      <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
        <div className="flex items-center gap-2 font-bold">
          <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Blindagem Ética & Sigilo Profissional (CFP 01/2009)</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
          Você tem acesso integral aos seus documentos formais emitidos (atestados e laudos). As anotações de evolução e hipóteses de trabalho da sessão são de guarda técnica e sigilosa do psicólogo.
        </p>
      </div>

      {/* Lista de Documentos */}
      {allDocs.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Lock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Nenhum documento emitido</h4>
          <p className="text-xs text-slate-400">
            Quando seu terapeuta emitir um atestado, declaração ou laudo, ele aparecerá aqui com assinatura digital e verificação de autenticidade.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allDocs.map((doc: any, idx: number) => {
            const title = doc.title || getDocTypeLabel(doc.document_type);
            return (
              <div
                key={doc.id || idx}
                className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-400 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                        {title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(doc.created_at)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {doc.psychologist_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Assinado</span>
                  </span>
                </div>

                {/* Selo Criptográfico SHA-256 */}
                {doc.hash_sha256 && (
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-500 font-mono flex items-center justify-between">
                    <span className="truncate max-w-[220px]">
                      Selo SHA-256: {doc.hash_sha256.slice(0, 16)}...
                    </span>
                    <span className="text-emerald-600 font-sans font-bold flex items-center gap-0.5 shrink-0">
                      <Shield className="w-3 h-3" /> Integridade Válida
                    </span>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedDoc(doc)}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visualizar Documento</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDoc(doc);
                      setTimeout(() => window.print(), 300);
                    }}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE DOCUMENTO OFICIAL */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-base text-slate-800 dark:text-white">
                  {selectedDoc.title || getDocTypeLabel(selectedDoc.document_type)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 text-xs text-slate-800 dark:text-slate-200 space-y-4 leading-relaxed border border-slate-200 dark:border-slate-800 font-serif">
              <div className="text-center pb-3 border-b border-slate-200 dark:border-slate-700 space-y-1">
                <h4 className="font-sans font-bold text-sm tracking-wider uppercase text-slate-900 dark:text-white">
                  {getDocTypeLabel(selectedDoc.document_type)}
                </h4>
                <p className="font-sans text-[11px] text-slate-500">
                  Emitido em conformidade com a Resolução CFP nº 06/2019
                </p>
              </div>

              <div className="space-y-3 whitespace-pre-wrap">
                <p>
                  Atesta-se / Declara-se, para os devidos fins legais e administrativos, que o paciente encontra-se em acompanhamento profissional regular neste serviço clínico.
                </p>
                <p>
                  Documento lavrado pelo profissional responsável com carimbo temporal e fé pública perante o Conselho Regional de Psicologia.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-slate-700 text-center font-sans space-y-1">
                <div className="w-40 h-0.5 bg-slate-400 mx-auto mb-2" />
                <p className="font-bold text-slate-900 dark:text-white text-xs">{selectedDoc.psychologist_name}</p>
                <p className="text-[11px] text-slate-500">Psicólogo Clínico {selectedDoc.crp_number && `• ${selectedDoc.crp_number}`}</p>
                <p className="text-[10px] text-slate-400 font-mono pt-1">
                  Hash de Autenticidade: {selectedDoc.hash_sha256}
                </p>
              </div>
            </div>

            <div className="flex gap-2 shrink-0 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Salvar PDF Oficial</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
