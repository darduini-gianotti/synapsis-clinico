import React, { useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Info
} from 'lucide-react';
import Papa from 'papaparse';
import { api } from '../../services/api.js';

interface PsicoManagerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PsicoManagerImportModal: React.FC<PsicoManagerImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<Array<Record<string, string>>>([]);
  const [totalRowsDetected, setTotalRowsDetected] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Relatório de importação
  const [importResult, setImportResult] = useState<{
    totalRows: number;
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; reason: string }>;
  } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith('.csv') && !selected.name.endsWith('.txt')) {
      setErrorMessage('Por favor, selecione um arquivo em formato CSV (.csv) exportado do PsicoManager.');
      return;
    }

    setFile(selected);
    setErrorMessage(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setCsvContent(text);

      // Gera preview rápido das primeiras 5 linhas
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        preview: 5,
        skipEmptyLines: true,
      });
      setPreviewRows(parsed.data || []);

      // Conta linhas aproximadas
      const lineCount = text.split('\n').filter((l) => l.trim().length > 0).length;
      setTotalRowsDetected(Math.max(0, lineCount - 1));
    };
    reader.readAsText(selected, 'UTF-8');
  };

  const handleExecuteImport = async () => {
    if (!csvContent) {
      setErrorMessage('Nenhum conteúdo de arquivo CSV encontrado.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await api.post('/patients/import-psicomanager', {
        csvContent,
      });

      if (res.data) {
        setImportResult({
          totalRows: res.data.totalRows || totalRowsDetected,
          imported: res.data.imported || 0,
          updated: res.data.updated || 0,
          skipped: res.data.skipped || 0,
          errors: res.data.errors || [],
        });
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Erro ao processar a importação dos pacientes.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setCsvContent('');
    setPreviewRows([]);
    setTotalRowsDetected(0);
    setErrorMessage(null);
    setImportResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Importador de Pacientes (PsicoManager)</h3>
              <p className="text-xs text-blue-100 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Migração assistida sem perda de dados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {!importResult ? (
            <>
              {/* Instruções */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <div>
                  <span className="font-bold">Como exportar do PsicoManager:</span>
                  <p className="mt-0.5 opacity-90">
                    No seu PsicoManager atual, acesse a aba de <strong>Pacientes</strong>, clique no botão de exportação e selecione o formato <strong>CSV (.csv)</strong>. Carregue o arquivo abaixo para importar a base completa.
                  </p>
                </div>
              </div>

              {/* Upload Dropzone */}
              {!file ? (
                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl bg-slate-50 dark:bg-slate-700/30 cursor-pointer transition-all">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full mb-3">
                    <Upload className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Selecione ou arraste a planilha CSV aqui
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Formato .csv (separado por vírgula ou ponto-e-vírgula)
                  </span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700 rounded-xl">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{file.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {totalRowsDetected} registros detectados • {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      Trocar Arquivo
                    </button>
                  </div>

                  {/* Preview da tabela */}
                  {previewRows.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Pré-visualização das Primeiras Linhas:
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Total aproximado: {totalRowsDetected} pacientes
                        </span>
                      </div>
                      <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl max-h-48">
                        <table className="w-full text-[11px] text-left text-slate-700 dark:text-slate-300 border-separate border-spacing-0">
                          <thead className="sticky top-0 z-10 select-none">
                            <tr>
                              {Object.keys(previewRows[0] || {}).slice(0, 5).map((h, i) => (
                                <th key={i} className="p-2 bg-slate-100/95 dark:bg-slate-700/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-600 shadow-2xs font-semibold text-slate-800 dark:text-slate-200">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, idx) => (
                              <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/50">
                                {Object.values(row).slice(0, 5).map((v, i) => (
                                  <td key={i} className="p-2 truncate max-w-[140px]">
                                    {v || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Relatório de Sucesso */
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Importação Concluída com Sucesso!</h4>
                  <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">
                    A base de pacientes do PsicoManager foi processada e sincronizada na plataforma.
                  </p>
                </div>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 text-center">
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {importResult.imported}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                    Novos Pacientes
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 text-center">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {importResult.updated}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                    Cadastros Atualizados
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 text-center">
                  <div className="text-xl font-bold text-slate-500 dark:text-slate-400">
                    {importResult.skipped}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                    Linhas Ignoradas
                  </div>
                </div>
              </div>

              {/* Erros detalhados se houver */}
              {importResult.errors.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
                  <div className="font-semibold mb-1">Avisos de processamento:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] max-h-24 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((e, idx) => (
                      <li key={idx}>Linha {e.row}: {e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700">
          {!importResult ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={!file || isProcessing}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Processando Planilha...
                  </>
                ) : (
                  <>
                    <Users className="h-3.5 w-3.5" />
                    Importar Base de Pacientes
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all cursor-pointer"
            >
              Concluir & Atualizar Pacientes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
