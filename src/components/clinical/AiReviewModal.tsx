import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  Upload,
  Camera,
  RefreshCw,
  ShieldCheck,
  FileText,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Eye,
} from 'lucide-react';

export type AiModalMode = 'FORMAT_TEXT' | 'OCR_HANDWRITING' | 'COMPARATIVE_EVOLUTION';

export interface AiReviewModalProps {
  isOpen: boolean;
  mode: AiModalMode;
  onClose: () => void;
  patientName?: string;
  patientId?: number;
  initialText?: string;
  onApplyText?: (formattedText: string) => void;
  onApplyEvolution?: (evolution: {
    dap?: { dados: string; avaliacao: string; plano: string };
    soap?: { subjetivo: string; objetivo: string; avaliacao: string; plano: string };
    freeText?: string;
  }) => void;
  apiClient: any;
}

export const AiReviewModal: React.FC<AiReviewModalProps> = ({
  isOpen,
  mode,
  onClose,
  patientName,
  patientId,
  initialText = '',
  onApplyText,
  onApplyEvolution,
  apiClient,
}) => {
  // Format state (padrão: Correção Gramatical & Ortográfica; 2ª opção: Polimento Clínico)
  const [formatMode, setFormatMode] = useState<'CLINICAL_POLISH' | 'SPELLING_ONLY'>('SPELLING_ONLY');
  const [originalText, setOriginalText] = useState(initialText);
  const [suggestedText, setSuggestedText] = useState('');
  const [changesSummary, setChangesSummary] = useState('');
  const [isFormatting, setIsFormatting] = useState(false);

  // OCR state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [ocrRaw, setOcrRaw] = useState('');
  const [ocrStructured, setOcrStructured] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<'ALTA' | 'MEDIA' | 'BAIXA'>('ALTA');
  const [ocrNotes, setOcrNotes] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [ocrActiveView, setOcrActiveView] = useState<'structured' | 'raw'>('structured');

  // Evolution state
  const [evolutionDap, setEvolutionDap] = useState<{ dados: string; avaliacao: string; plano: string } | null>(null);
  const [evolutionSoap, setEvolutionSoap] = useState<{ subjetivo: string; objetivo: string; avaliacao: string; plano: string } | null>(null);
  const [evolutionFreeText, setEvolutionFreeText] = useState<string>('');
  const [evolutionSummary, setEvolutionSummary] = useState<string>('');
  const [evolutionDates, setEvolutionDates] = useState<{ previous?: string; current?: string }>({});
  const [isGeneratingEvolution, setIsGeneratingEvolution] = useState(false);
  const [evolutionFormat, setEvolutionFormat] = useState<'DAP' | 'SOAP' | 'FREE'>('DAP');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initialText when modal opens in FORMAT_TEXT mode (sempre inicia em SPELLING_ONLY como padrão)
  React.useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (mode === 'FORMAT_TEXT') {
        setFormatMode('SPELLING_ONLY');
        setOriginalText(initialText);
        setSuggestedText('');
        setChangesSummary('');
        if (initialText.trim().length > 3) {
          handleExecuteFormat(initialText, 'SPELLING_ONLY');
        }
      } else if (mode === 'COMPARATIVE_EVOLUTION') {
        handleExecuteEvolution(initialText, evolutionFormat);
      }
    }
  }, [isOpen, mode]);

  // 1. Executa Formatação
  const handleExecuteFormat = async (textToFormat: string, targetMode: 'CLINICAL_POLISH' | 'SPELLING_ONLY') => {
    if (!textToFormat.trim()) {
      setErrorMessage('Digite ou cole algum texto antes de formatar.');
      return;
    }
    try {
      setIsFormatting(true);
      setErrorMessage(null);
      const res = await apiClient.post('/ai/format-notes', {
        text: textToFormat,
        mode: targetMode,
        patientId,
      });
      setSuggestedText(res.data.formatted || res.data.formattedText || '');
      setChangesSummary(res.data.changesSummary || '');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.response?.data?.error || 'Erro ao processar formatação com IA.');
    } finally {
      setIsFormatting(false);
    }
  };

  // 2. Executa OCR
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP).');
      return;
    }

    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      setSelectedImage(result);
      setOcrRaw('');
      setOcrStructured('');
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteOcr = async () => {
    if (!selectedImage) {
      setErrorMessage('Carregue uma imagem ou foto antes de digitalizar.');
      return;
    }
    try {
      setIsScanning(true);
      setErrorMessage(null);
      const cleanBase64 = selectedImage.includes(',') ? selectedImage.split(',')[1] : selectedImage;
      const res = await apiClient.post('/ai/ocr-notes', {
        imageBase64: cleanBase64,
        mimeType: imageMime,
        organizeClinically: true,
        patientId,
      });
      setOcrRaw(res.data.rawTranscription);
      setOcrStructured(res.data.structuredText);
      setOcrConfidence(res.data.confidence || 'MEDIA');
      setOcrNotes(res.data.notes || '');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.response?.data?.error || 'Erro ao digitalizar imagem com IA.');
    } finally {
      setIsScanning(false);
    }
  };

  // 3. Executa Evolução Comparativa
  const handleExecuteEvolution = async (currentDraft: string, targetFormat: 'DAP' | 'SOAP' | 'FREE') => {
    if (!patientId) {
      setErrorMessage('ID do paciente não identificado para consultar histórico.');
      return;
    }
    try {
      setIsGeneratingEvolution(true);
      setErrorMessage(null);
      const res = await apiClient.post('/ai/generate-evolution', {
        patientId,
        currentNotes: currentDraft,
        modelType: targetFormat,
      });

      setEvolutionDap(res.data.dap || null);
      setEvolutionSoap(res.data.soap || null);
      setEvolutionFreeText(res.data.freeText || '');
      setEvolutionSummary(res.data.summary || '');
      setEvolutionDates({
        previous: res.data.previousSessionDate,
        current: res.data.currentSessionDate,
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.response?.data?.error || 'Erro ao gerar evolução comparativa.');
    } finally {
      setIsGeneratingEvolution(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-linear-to-r from-teal-50/80 via-white to-indigo-50/60 dark:from-teal-950/30 dark:via-slate-900 dark:to-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md shadow-teal-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {mode === 'FORMAT_TEXT' && 'Apoio de Formatação & Polimento Clínico'}
                  {mode === 'OCR_HANDWRITING' && 'Digitalização de Anotações Manuscritas'}
                  {mode === 'COMPARATIVE_EVOLUTION' && 'Gerador de Evolução Comparativa CFP (N-1 vs N)'}
                </h3>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950/80 dark:text-teal-300">
                  Synapsis IA
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {patientName ? `Paciente: ${patientName}` : 'Assistente de Prontuário Ético'} • Resolução CFP 06/2019
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ======================================================== */}
          {/* 1. MODO: FORMAT_TEXT */}
          {/* ======================================================== */}
          {mode === 'FORMAT_TEXT' && (
            <div className="space-y-4">
              {/* Seletor de Modo */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Modo de Aprimoramento:
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormatMode('SPELLING_ONLY');
                      handleExecuteFormat(originalText, 'SPELLING_ONLY');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      formatMode === 'SPELLING_ONLY'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>📝 Correção Gramatical Apenas</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      formatMode === 'SPELLING_ONLY'
                        ? 'bg-teal-700 text-teal-100'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      Padrão
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormatMode('CLINICAL_POLISH');
                      handleExecuteFormat(originalText, 'CLINICAL_POLISH');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      formatMode === 'CLINICAL_POLISH'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    ✨ Polimento Clínico CFP (3ª pessoa)
                  </button>
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coluna Esquerda: Original / Ditado */}
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      Texto Original / Ditado
                    </label>
                    <button
                      type="button"
                      onClick={() => handleExecuteFormat(originalText, formatMode)}
                      disabled={isFormatting}
                      className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${isFormatting ? 'animate-spin' : ''}`} />
                      Reprocessar
                    </button>
                  </div>
                  <textarea
                    rows={10}
                    value={originalText}
                    onChange={(e) => setOriginalText(e.target.value)}
                    placeholder="Digite ou dite o texto que deseja aprimorar..."
                    className="w-full flex-1 rounded-xl border border-slate-200 p-3 text-xs leading-relaxed dark:border-slate-700 dark:bg-slate-950 dark:text-white focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Coluna Direita: Sugestão IA (Editável pelo profissional) */}
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Sugestão da IA (Revisável)
                    </label>
                    {isFormatting && (
                      <span className="text-[11px] text-teal-600 dark:text-teal-400 animate-pulse font-medium">
                        Refinando termos...
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={10}
                    value={suggestedText}
                    onChange={(e) => setSuggestedText(e.target.value)}
                    placeholder={isFormatting ? 'Aguarde a IA processar...' : 'O texto formatado aparecerá aqui.'}
                    className="w-full flex-1 rounded-xl border border-teal-300 bg-teal-50/20 p-3 text-xs leading-relaxed dark:border-teal-700/60 dark:bg-slate-950 dark:text-white focus:border-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Changes Summary badge */}
              {changesSummary && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Resumo dos Ajustes: </span>
                    {changesSummary}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. MODO: OCR_HANDWRITING */}
          {/* ======================================================== */}
          {mode === 'OCR_HANDWRITING' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coluna Esquerda: Upload e Imagem */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-teal-600" />
                    Foto do Bloco / Anotação Clínica
                  </label>

                  {!selectedImage ? (
                    <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 dark:hover:bg-slate-800/50 transition">
                      <Upload className="h-10 w-10 text-slate-400 mb-2" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Clique para anexar foto ou arraste aqui
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        JPG, PNG ou WEBP (fotos de caderno, folhas de prontuário físico)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-64 flex items-center justify-center bg-slate-900">
                        <img
                          src={selectedImage}
                          alt="Anotação manuscrita"
                          className="object-contain max-h-64 w-full"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer font-semibold underline">
                          Trocar imagem
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleExecuteOcr}
                          disabled={isScanning}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          <Sparkles className={`h-3 w-3 ${isScanning ? 'animate-spin' : ''}`} />
                          {isScanning ? 'Digitalizando com IA...' : 'Decifrar Manuscrito'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna Direita: Resultado OCR */}
                <div className="space-y-3 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setOcrActiveView('structured')}
                        className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                          ocrActiveView === 'structured'
                            ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Versão Organizada
                      </button>
                      <button
                        type="button"
                        onClick={() => setOcrActiveView('raw')}
                        className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                          ocrActiveView === 'raw'
                            ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Transcrição Literal
                      </button>
                    </div>

                    {ocrConfidence && ocrStructured && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Legibilidade: {ocrConfidence}
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={10}
                    value={ocrActiveView === 'structured' ? ocrStructured : ocrRaw}
                    onChange={(e) => {
                      if (ocrActiveView === 'structured') {
                        setOcrStructured(e.target.value);
                      } else {
                        setOcrRaw(e.target.value);
                      }
                    }}
                    placeholder={
                      isScanning
                        ? 'A IA está lendo o manuscrito e decifrando a caligrafia...'
                        : 'A transcrição do seu manuscrito aparecerá aqui pronta para revisão.'
                    }
                    className="w-full flex-1 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white p-3 text-xs leading-relaxed focus:border-teal-500 focus:outline-hidden"
                  />

                  {ocrNotes && (
                    <p className="text-[11px] text-slate-500 italic">
                      ℹ️ {ocrNotes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. MODO: COMPARATIVE_EVOLUTION */}
          {/* ======================================================== */}
          {mode === 'COMPARATIVE_EVOLUTION' && (
            <div className="space-y-4">
              {/* Header com modelo e datas */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/60">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-teal-900 dark:text-teal-200">
                    Comparação Sequencial de Sessões
                  </div>
                  <div className="text-[11px] text-teal-700 dark:text-teal-400">
                    Sessão Anterior: <span className="font-semibold">{evolutionDates.previous || 'Registro anterior'}</span> → Sessão Atual: <span className="font-semibold">{evolutionDates.current || 'Hoje'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEvolutionFormat('DAP');
                      handleExecuteEvolution(initialText, 'DAP');
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      evolutionFormat === 'DAP'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    DAP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEvolutionFormat('SOAP');
                      handleExecuteEvolution(initialText, 'SOAP');
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      evolutionFormat === 'SOAP'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    SOAP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEvolutionFormat('FREE');
                      handleExecuteEvolution(initialText, 'FREE');
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      evolutionFormat === 'FREE'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Texto Livre
                  </button>
                </div>
              </div>

              {/* Resumo executivo */}
              {evolutionSummary && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-teal-700 dark:text-teal-400">Síntese da Evolução: </span>
                  {evolutionSummary}
                </div>
              )}

              {/* Campos DAP */}
              {evolutionFormat === 'DAP' && evolutionDap && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
                      [D] DADOS (Síntese e Comparação com a Sessão Anterior)
                    </label>
                    <textarea
                      rows={3}
                      value={evolutionDap.dados}
                      onChange={(e) => setEvolutionDap({ ...evolutionDap, dados: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white p-3 text-xs leading-relaxed focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
                      [A] AVALIAÇÃO (Análise Clínica da Evolução do Quadro)
                    </label>
                    <textarea
                      rows={3}
                      value={evolutionDap.avaliacao}
                      onChange={(e) => setEvolutionDap({ ...evolutionDap, avaliacao: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white p-3 text-xs leading-relaxed focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
                      [P] PLANO (Encaminhamentos e Próximos Passos Terapêuticos)
                    </label>
                    <textarea
                      rows={2}
                      value={evolutionDap.plano}
                      onChange={(e) => setEvolutionDap({ ...evolutionDap, plano: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white p-3 text-xs leading-relaxed focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Campos SOAP */}
              {evolutionFormat === 'SOAP' && evolutionSoap && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
                      [S] SUBJETIVO (Relatos do Paciente)
                    </label>
                    <textarea
                      rows={2}
                      value={evolutionSoap.subjetivo}
                      onChange={(e) => setEvolutionSoap({ ...evolutionSoap, subjetivo: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white p-3 text-xs leading-relaxed focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
                      [O] OBJETIVO (Sinais Clínicos Observados)
                    </label>
                    <textarea
                      rows={2}
                      value={evolutionSoap.objetivo}
                      onChange={(e) => setEvolutionSoap({ ...evolutionSoap, objetivo: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white p-3 text-xs leading-relaxed focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
                      [A] AVALIAÇÃO (Evolução Comparativa Técnica)
                    </label>
                    <textarea
                      rows={3}
                      value={evolutionSoap.avaliacao}
                      onChange={(e) => setEvolutionSoap({ ...evolutionSoap, avaliacao: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white p-3 text-xs leading-relaxed focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
                      [P] PLANO (Condutas Clínicas)
                    </label>
                    <textarea
                      rows={2}
                      value={evolutionSoap.plano}
                      onChange={(e) => setEvolutionSoap({ ...evolutionSoap, plano: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white p-3 text-xs leading-relaxed focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Texto Livre */}
              {evolutionFormat === 'FREE' && (
                <div>
                  <label className="block text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
                    Registro de Evolução Completo (Resolução CFP 06/2019)
                  </label>
                  <textarea
                    rows={8}
                    value={evolutionFreeText}
                    onChange={(e) => setEvolutionFreeText(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white p-3 text-xs leading-relaxed focus:border-teal-500 focus:outline-hidden"
                  />
                </div>
              )}

              {isGeneratingEvolution && (
                <div className="py-8 text-center text-xs text-teal-600 animate-pulse font-medium">
                  Analisando histórico de sessões anteriores e elaborando registro comparativo...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer com Aviso Ético CFP e Ações */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 px-6 py-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Apoio documental. A análise clínica e assinatura continuam sob sua inteira responsabilidade técnica.
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>

            {mode === 'FORMAT_TEXT' && (
              <button
                type="button"
                onClick={() => {
                  if (onApplyText) onApplyText(suggestedText || originalText);
                  onClose();
                }}
                disabled={!suggestedText && !originalText}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>Aplicar no Prontuário</span>
              </button>
            )}

            {mode === 'OCR_HANDWRITING' && (
              <button
                type="button"
                onClick={() => {
                  const textToUse = ocrActiveView === 'structured' ? ocrStructured : ocrRaw;
                  if (onApplyText) onApplyText(textToUse);
                  onClose();
                }}
                disabled={!ocrStructured && !ocrRaw}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>Aplicar no Prontuário</span>
              </button>
            )}

            {mode === 'COMPARATIVE_EVOLUTION' && (
              <button
                type="button"
                onClick={() => {
                  if (onApplyEvolution) {
                    onApplyEvolution({
                      dap: evolutionDap || undefined,
                      soap: evolutionSoap || undefined,
                      freeText: evolutionFreeText || undefined,
                    });
                  }
                  onClose();
                }}
                disabled={isGeneratingEvolution || (!evolutionDap && !evolutionSoap && !evolutionFreeText)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>Aplicar na Evolução</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
