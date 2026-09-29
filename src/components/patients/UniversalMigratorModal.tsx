import React, { useState, useEffect } from 'react';
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
  Info,
  Sparkles,
  Download,
  Check,
  FileText,
  Layers,
  Settings2,
  Rocket,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type {
  NormalizedPatientData,
  DryRunMetrics,
  MigrationExecutionResult,
} from '../../services/migrator/types.js';
import {
  SYSTEM_PRESETS,
  GENERIC_PRESET,
  detectSystemPreset,
  generateInitialColumnMapping,
} from '../../services/migrator/presets.js';
import {
  parseRawFile,
  buildDryRunMetrics,
} from '../../services/migrator/universalParser.js';

interface UniversalMigratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'success';

export const UniversalMigratorModal: React.FC<UniversalMigratorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, any>>>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [detectedPreset, setDetectedPreset] = useState<any>(GENERIC_PRESET);
  const [isAutoMatched, setIsAutoMatched] = useState<boolean>(false);
  const [confidence, setConfidence] = useState<number>(0);

  // Lista de pacientes já existentes para simular merge
  const [existingPatients, setExistingPatients] = useState<Array<{ cpf?: string; full_name?: string }>>([]);

  // Telemetria do Dry-Run
  const [dryRunMetrics, setDryRunMetrics] = useState<DryRunMetrics | null>(null);

  // Estado de carregamento e erros
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessingMigration, setIsProcessingMigration] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resultado da migração
  const [migrationResult, setMigrationResult] = useState<MigrationExecutionResult | null>(null);

  // Confirmação de digitação MIGRAR (segurança D9)
  const [confirmationText, setConfirmationText] = useState<string>('');

  // Preview de valores por coluna no De-Para Visual (D10)
  const getColumnPreview = (colName: string): string[] => {
    if (!colName || !rawRows.length) return [];
    return rawRows
      .slice(0, 3)
      .map((row) => String(row[colName] ?? '').trim())
      .filter(Boolean);
  };

  // Carrega lista de pacientes atuais para cálculo de duplicidade
  useEffect(() => {
    if (isOpen) {
      api
        .get('/patients')
        .then((res) => {
          if (Array.isArray(res.data)) {
            setExistingPatients(
              res.data.map((p: any) => ({
                cpf: p.cpf,
                full_name: p.full_name,
              }))
            );
          }
        })
        .catch(() => {
          // silencioso
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setFileHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setDetectedPreset(GENERIC_PRESET);
    setIsAutoMatched(false);
    setConfidence(0);
    setDryRunMetrics(null);
    setErrorMessage(null);
    setMigrationResult(null);
    setConfirmationText('');
  };

  const handleFileProcess = async (selectedFile: File) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { headers, rawRows: rows } = await parseRawFile(selectedFile);

      if (rows.length === 0) {
        setErrorMessage('O arquivo selecionado não contém linhas de dados válidas.');
        setIsLoading(false);
        return;
      }

      setFile(selectedFile);
      setFileHeaders(headers);
      setRawRows(rows);

      // Detecta preset
      const detection = detectSystemPreset(headers);
      setDetectedPreset(detection.preset);
      setIsAutoMatched(detection.isAutoMatched);
      setConfidence(detection.confidence);

      // Gera mapeamento de colunas
      const initialMap = generateInitialColumnMapping(headers, detection.preset);
      setColumnMapping(initialMap);

      // Constrói simulação prévia (Dry-Run)
      const metrics = buildDryRunMetrics(
        rows,
        headers,
        initialMap,
        {
          id: detection.preset.id,
          name: detection.preset.name,
          confidence: detection.confidence,
          badgeColor: detection.preset.badgeColor,
        },
        existingPatients
      );

      setDryRunMetrics(metrics);

      // Se reconhecido automaticamente com confiança, vai direto para a simulação (1 clique real)
      if (detection.isAutoMatched) {
        setStep('preview');
      } else {
        // Se genérico ou baixa confiança, abre o assistente De-Para para conferência
        setStep('mapping');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao ler e processar o arquivo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileProcess(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      handleFileProcess(selected);
    }
  };

  const handleMappingChange = (fieldKey: string, headerSelected: string) => {
    const updated = { ...columnMapping, [fieldKey]: headerSelected };
    setColumnMapping(updated);

    if (rawRows.length > 0) {
      const metrics = buildDryRunMetrics(
        rawRows,
        fileHeaders,
        updated,
        {
          id: detectedPreset.id,
          name: detectedPreset.name,
          confidence,
          badgeColor: detectedPreset.badgeColor,
        },
        existingPatients
      );
      setDryRunMetrics(metrics);
    }
  };

  const handleExecuteMigration = async () => {
    if (!dryRunMetrics || dryRunMetrics.validPatients.length === 0) {
      setErrorMessage('Nenhum paciente válido para migrar.');
      return;
    }

    if (confirmationText.trim() !== 'MIGRAR') {
      setErrorMessage('Digite MIGRAR no campo de confirmação para prosseguir.');
      return;
    }

    setIsProcessingMigration(true);
    setErrorMessage(null);

    try {
      const res = await api.post('/patients/universal-import', {
        patients: dryRunMetrics.validPatients,
        sourceSystem: detectedPreset.name,
      });

      if (res.data && res.data.success) {
        setMigrationResult(res.data);
        setStep('success');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setErrorMessage(res.data?.error || 'Erro ao executar a migração.');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Falha na comunicação com o servidor.');
    } finally {
      setIsProcessingMigration(false);
    }
  };

  const handleDownloadReport = () => {
    if (!migrationResult) return;
    const header = 'Nome,CPF,Telefone,Status,Faixa Etaria,Responsavel\n';
    const rows = migrationResult.samplePatients
      .map(
        (p) =>
          `"${p.name}","${p.cpf || ''}","${p.phone || ''}","${p.status}","${p.groupType}","${p.guardianName || ''}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_migracao_${detectedPreset.id}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Premium com Gradiente Clínico */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white border-b border-teal-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-2xl shadow-inner">
                <Rocket className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg tracking-tight text-white">Migrador Universal v2.4</h3>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                    Art. 18 LGPD
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
                  Troca sem Dor • CSV & XLSX com Saneamento Algorítmico
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stepper Superior */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <div className={`flex items-center gap-1.5 ${step === 'upload' ? 'text-teal-300 font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'upload' ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>1</span>
              <span>Upload</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <div className={`flex items-center gap-1.5 ${step === 'mapping' ? 'text-teal-300 font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'mapping' ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>2</span>
              <span>De-Para</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <div className={`flex items-center gap-1.5 ${step === 'preview' ? 'text-teal-300 font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'preview' ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>3</span>
              <span>Simulação</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <div className={`flex items-center gap-1.5 ${step === 'success' ? 'text-teal-300 font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'success' ? 'bg-emerald-500 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}>4</span>
              <span>Conclusão</span>
            </div>
          </div>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5 animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="block font-bold">Atenção na importação</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 1: UPLOAD & DETECÇÃO DE PRESETS                                     */}
          {/* ========================================================================= */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Presets Homologados Chips */}
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                  Presets Homologados em 1 Clique:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SYSTEM_PRESETS.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="relative border-2 border-dashed border-teal-500/40 hover:border-teal-500 rounded-3xl p-8 sm:p-10 text-center transition-all bg-teal-50/20 dark:bg-teal-950/10 hover:bg-teal-50/40 group cursor-pointer"
              >
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv, .txt, .tsv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isLoading}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-2xl group-hover:scale-105 transition-transform">
                    {isLoading ? (
                      <RefreshCw className="h-8 w-8 animate-spin" />
                    ) : (
                      <Upload className="h-8 w-8" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {isLoading ? 'Analisando planilha...' : 'Arraste e solte o arquivo aqui ou clique para selecionar'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Suporta planilhas oficiais <strong>.XLSX</strong>, <strong>.XLS</strong> ou <strong>.CSV</strong> (até 15MB)
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/60 px-3 py-1 rounded-full border border-teal-500/30">
                    <Sparkles className="h-3 w-3" /> Auto-reconhecimento inteligente de colunas
                  </span>
                </div>
              </div>

              {/* Informações de Apoio */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Info className="h-4 w-4 text-teal-500" />
                  Como exportar do seu software atual:
                </div>
                <p className="text-[11px] leading-relaxed">
                  No seu sistema anterior (PsicoManager, iClinic, Feegow, Zenklub ou similar), acesse o menu de <strong>Pacientes / Clientes</strong>, clique no botão <strong>Exportar</strong> e escolha o formato Excel (.xlsx) ou CSV. Você não precisa alterar nenhuma coluna antes de subir.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: ASSISTENTE VISUAL DE-PARA (QUANDO GENÉRICO OU MANUAL)            */}
          {/* ========================================================================= */}
          {step === 'mapping' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs text-slate-500 block">Arquivo Carregado:</span>
                  <strong className="text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-teal-500" />
                    {file?.name} ({rawRows.length} linhas detectadas)
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Preset Identificado:</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${detectedPreset.badgeColor}`}>
                    {detectedPreset.name}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Mapeamento de Colunas (De-Para):
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Confirme quais colunas do seu arquivo correspondem a cada dado cadastral no Synapsis:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {[
                    { key: 'fullName', label: 'Nome do Paciente', required: true },
                    { key: 'cpf', label: 'CPF', required: false },
                    { key: 'birthDate', label: 'Data de Nascimento', required: false },
                    { key: 'phone', label: 'WhatsApp / Telefone', required: false },
                    { key: 'email', label: 'E-mail', required: false },
                    { key: 'guardianName', label: 'Responsável (Mãe/Pai)', required: false },
                    { key: 'guardianPhone', label: 'WhatsApp do Responsável', required: false },
                    { key: 'guardianCpf', label: 'CPF do Responsável', required: false },
                    { key: 'street', label: 'Endereço / Logradouro', required: false },
                    { key: 'city', label: 'Cidade', required: false },
                    { key: 'notes', label: 'Observações / Queixa', required: false },
                  ].map((field) => (
                    <div
                      key={field.key}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </span>
                        {columnMapping[field.key] && (
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-0.5">
                            <Check className="h-3 w-3" /> Mapeado
                          </span>
                        )}
                      </div>

                      <select
                        value={columnMapping[field.key] || ''}
                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                        className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-teal-500 outline-none"
                      >
                        <option value="">-- Ignorar / Deixar em Branco --</option>
                        {fileHeaders.map((header) => (
                          <option key={header} value={header}>
                            Coluna: {header}
                          </option>
                        ))}
                      </select>

                      {columnMapping[field.key] && (
                        <div className="pt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">Exemplos: </span>
                          {getColumnPreview(columnMapping[field.key]).length > 0 ? (
                            <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded">
                              {getColumnPreview(columnMapping[field.key]).join(' • ')}
                            </span>
                          ) : (
                            <span className="italic text-slate-400 text-[10px]">(coluna sem valores nas primeiras linhas)</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Voltar para Upload
                </button>

                <button
                  type="button"
                  onClick={() => setStep('preview')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 transition shadow-md shadow-teal-500/20 flex items-center gap-2"
                >
                  <span>Avançar para Simulação (Dry-Run)</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: TELEMETRIA & SIMULAÇÃO (DRY-RUN)                                  */}
          {/* ========================================================================= */}
          {step === 'preview' && dryRunMetrics && (
            <div className="space-y-5">
              {/* Badge do Preset */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-500/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping"></div>
                  <div>
                    <span className="text-[11px] text-teal-800 dark:text-teal-300 font-semibold block">
                      Sistema de Origem Homologado:
                    </span>
                    <strong className="text-xs text-teal-950 dark:text-white font-extrabold">
                      {detectedPreset.name} {isAutoMatched && '• Reconhecido em 1 Clique'}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="text-xs font-bold text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-1"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Revisar Mapeamento
                </button>
              </div>

              {/* Os 4 Cards de Telemetria (Estilo Landing Page) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[11px] text-slate-500 block">Total Identificado</span>
                  <strong className="text-xl font-black text-slate-800 dark:text-slate-100">
                    {dryRunMetrics.totalRows}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">pacientes na base</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 text-center">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">Novos Cadastros</span>
                  <strong className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    +{dryRunMetrics.newPatientsCount}
                  </strong>
                  <span className="text-[10px] text-emerald-500/80 block mt-0.5">serão criados</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-500/30 text-center">
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 block">Merge Não-Destrutivo</span>
                  <strong className="text-xl font-black text-blue-600 dark:text-blue-400">
                    {dryRunMetrics.enrichedCount}
                  </strong>
                  <span className="text-[10px] text-blue-500/80 block mt-0.5">serão enriquecidos</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30 text-center">
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 block">Doc. Pendente</span>
                  <strong className="text-xl font-black text-amber-600 dark:text-amber-400">
                    {dryRunMetrics.pendingDocsCount}
                  </strong>
                  <span className="text-[10px] text-amber-500/80 block mt-0.5">sem travar a clínica</span>
                </div>
              </div>

              {/* Amostra Visual dos Primeiros 5 Pacientes */}
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                  Amostra dos Pacientes Higienizados ({dryRunMetrics.samplePatients.length} de {dryRunMetrics.totalRows}):
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {dryRunMetrics.samplePatients.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 font-bold flex items-center justify-center shrink-0">
                          {p.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong className="text-slate-800 dark:text-slate-200 block">{p.fullName}</strong>
                          <span className="text-slate-500 text-[11px]">
                            CPF: {p.cpf || <em className="text-amber-500">Pendente</em>} • Tel: {p.phone || 'N/I'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {p.groupType}
                        </span>
                        {p.guardian && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-300 border border-teal-500/30">
                            Resp: {p.guardian.fullName}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Avisos não-bloqueantes */}
              {dryRunMetrics.warnings.length > 0 && (
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-500/30 rounded-2xl text-[11px] text-amber-700 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Observações de Saneamento:</span>
                  </div>
                  <p>
                    {dryRunMetrics.warnings.length} registro(s) possuem ressalvas (ex.: linhas em branco ou dados incompletos). O sistema cuidará da higienização sem interromper o processo.
                  </p>
                </div>
              )}

              {/* Confirmação de Digitação MIGRAR (Segurança D9) */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Confirmação de Segurança Requerida (Exclusivo Administrador)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Esta operação criará ou enriquecerá <strong>{dryRunMetrics.totalRows} pacientes</strong> na base. Para liberar a gravação definitiva, digite <strong className="font-mono bg-amber-200/60 dark:bg-amber-900/50 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-200">MIGRAR</strong> no campo abaixo:
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value.toUpperCase())}
                    placeholder="Digite MIGRAR"
                    disabled={isProcessingMigration}
                    className="w-48 px-3 py-2 text-xs font-mono font-bold tracking-widest uppercase rounded-xl border border-amber-400/60 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {confirmationText.trim() === 'MIGRAR' ? (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Liberado para execução
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Aguardando confirmação...
                    </span>
                  )}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isProcessingMigration}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Trocar Arquivo
                </button>

                <button
                  type="button"
                  onClick={handleExecuteMigration}
                  disabled={isProcessingMigration || confirmationText.trim() !== 'MIGRAR'}
                  className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 transition shadow-lg shadow-teal-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isProcessingMigration ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Gravando no Banco de Dados...</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" />
                      <span>Confirmar e Migrar em 1 Clique</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 4: SUCESSO & SUMÁRIO EXECUTIVO                                      */}
          {/* ========================================================================= */}
          {step === 'success' && migrationResult && (
            <div className="space-y-6 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mx-auto animate-bounce-subtle">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Migração Concluída com Sucesso!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  A base de pacientes do <strong>{migrationResult.sourceSystem}</strong> foi processada e gravada de forma atômica no banco de dados.
                </p>
              </div>

              {/* Métricas Finais */}
              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-semibold">Novos Criados</span>
                  <strong className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {migrationResult.imported}
                  </strong>
                </div>
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-500/30">
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 block font-semibold">Enriquecidos</span>
                  <strong className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {migrationResult.updated}
                  </strong>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30">
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 block font-semibold">Pendências</span>
                  <strong className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {migrationResult.pendingDocsCount}
                  </strong>
                </div>
              </div>

              {/* Botões de Ação Final */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Download className="h-4 w-4 text-teal-500" />
                  <span>Baixar Relatório de Migração (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    handleReset();
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-md shadow-teal-500/20 cursor-pointer"
                >
                  Ver Lista de Pacientes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
