import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  FolderPlus,
  FileCheck2,
  Send,
  Paperclip,
  Printer,
  Eye,
  Trash2,
  Plus,
  Search,
  ShieldCheck,
  Hash,
  Calendar,
  User,
  Copy,
  Check,
  AlertCircle,
  X,
  ExternalLink,
  Download,
  Loader2,
  Lock,
  Stethoscope,
  Brain,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Patient,
  PatientDocument,
  PatientDocumentCategory,
  AnamneseContent,
  EncaminhamentoContent,
  CFPContent,
} from '../types.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';

interface PatientDocumentsTabProps {
  patient: Patient;
  onDocumentCountChange?: (count: number) => void;
}

type FilterCategory = 'ALL' | 'ANAMNESE' | 'LAUDO' | 'ENCAMINHAMENTO' | 'DECLARACAO' | 'ANEXO_EXTERNO';

export const PatientDocumentsTab: React.FC<PatientDocumentsTabProps> = ({
  patient,
  onDocumentCountChange,
}) => {
  const { user } = useAuth();
  const isSecretary = user?.role === 'SECRETARY';

  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('ALL');

  // Modal states
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [newDocType, setNewDocType] = useState<PatientDocumentCategory>('ANAMNESE');
  const [previewDoc, setPreviewDoc] = useState<PatientDocument | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Form states for creating new document
  const [formTitle, setFormTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Anamnese Form State
  const [anamneseQueixa, setAnamneseQueixa] = useState('');
  const [anamneseHistorico, setAnamneseHistorico] = useState('');
  const [anamneseAntecedentesPessoais, setAnamneseAntecedentesPessoais] = useState('');
  const [anamneseAntecedentesFamiliares, setAnamneseAntecedentesFamiliares] = useState('');
  const [anamneseRotina, setAnamneseRotina] = useState('');
  const [anamneseHipoteses, setAnamneseHipoteses] = useState('');
  const [anamneseObjetivos, setAnamneseObjetivos] = useState('');

  // Encaminhamento Form State
  const [encEspecialidade, setEncEspecialidade] = useState('Psiquiatria');
  const [encProfissional, setEncProfissional] = useState('');
  const [encMotivo, setEncMotivo] = useState('');
  const [encSintese, setEncSintese] = useState('');
  const [encSolicitacao, setEncSolicitacao] = useState('');

  // CFP (Laudo / Relatório / Declaração / Atestado) Form State
  const [cfpIdentificacao, setCfpIdentificacao] = useState('');
  const [cfpDemanda, setCfpDemanda] = useState('');
  const [cfpProcedimento, setCfpProcedimento] = useState('');
  const [cfpAnalise, setCfpAnalise] = useState('');
  const [cfpConclusao, setCfpConclusao] = useState('');

  // Anexo Externo State
  const [anexoDescricao, setAnexoDescricao] = useState('');
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    type: string;
    dataUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    if (isSecretary) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/patient-documents?patient_id=${patient.id}`);
      const docs = res.data.documents || [];
      setDocuments(docs);
      if (onDocumentCountChange) {
        onDocumentCountChange(docs.length);
      }
    } catch (err) {
      console.error('Erro ao buscar documentos do paciente:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [patient.id]);

  const resetFormState = (type: PatientDocumentCategory) => {
    setNewDocType(type);
    setFormError(null);
    setAttachedFile(null);

    const defaultAuthor = `Autor(a): ${user?.name || 'Dr. Marcos Silveira'} (${user?.crp_number || 'CRP 06/128945-SP'})\nPaciente: ${patient.full_name}, CPF: ${patient.cpf}.`;

    if (type === 'ANAMNESE') {
      setFormTitle(`Anamnese Clínica - ${patient.full_name}`);
      setAnamneseQueixa('');
      setAnamneseHistorico('');
      setAnamneseAntecedentesPessoais('');
      setAnamneseAntecedentesFamiliares('');
      setAnamneseRotina('');
      setAnamneseHipoteses('');
      setAnamneseObjetivos('');
    } else if (type === 'ENCAMINHAMENTO') {
      setFormTitle(`Encaminhamento Interdisciplinar - ${patient.full_name}`);
      setEncEspecialidade('Psiquiatria');
      setEncProfissional('');
      setEncMotivo('');
      setEncSintese('');
      setEncSolicitacao('');
    } else if (type === 'LAUDO' || type === 'RELATORIO') {
      setFormTitle(`${type === 'LAUDO' ? 'Laudo Psicológico' : 'Relatório Psicológico'} - ${patient.full_name}`);
      setCfpIdentificacao(defaultAuthor);
      setCfpDemanda('');
      setCfpProcedimento('Atendimento clínico psicoterápico continuado em sessões de 50 minutos.');
      setCfpAnalise('');
      setCfpConclusao('');
    } else if (type === 'DECLARACAO' || type === 'ATESTADO') {
      setFormTitle(`${type === 'DECLARACAO' ? 'Declaração de Acompanhamento' : 'Atestado Psicológico'} - ${patient.full_name}`);
      setCfpIdentificacao(defaultAuthor);
      setCfpDemanda('Comprovação de acompanhamento para finalidades administrativas ou laborais.');
      setCfpProcedimento('Atendimento clínico semanal regular.');
      setCfpAnalise('Paciente demonstra adesão e comparecimento assíduo ao tratamento.');
      setCfpConclusao(`Declara-se que ${patient.full_name} está sob acompanhamento psicoterápico neste consultório.`);
    } else {
      setFormTitle(`Anexo Clínico - ${patient.full_name}`);
      setAnexoDescricao('');
    }
  };

  const handleOpenNewDoc = (category: PatientDocumentCategory = 'ANAMNESE') => {
    resetFormState(category);
    setIsNewDocModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setFormError('O arquivo selecionado excede o limite de 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl: reader.result as string,
      });
      if (!formTitle || formTitle.includes('Anexo Clínico')) {
        setFormTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitNewDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Por favor, informe um título para o documento.');
      return;
    }

    let contentPayload: any = {};

    if (newDocType === 'ANAMNESE') {
      if (!anamneseQueixa.trim()) {
        setFormError('A Queixa Principal é obrigatória na Anamnese.');
        return;
      }
      contentPayload = {
        queixa_principal: anamneseQueixa,
        historico_sintomas: anamneseHistorico,
        antecedentes_pessoais: anamneseAntecedentesPessoais,
        antecedentes_familiares: anamneseAntecedentesFamiliares,
        rotina_habitos: anamneseRotina,
        hipoteses_diagnosticas: anamneseHipoteses,
        objetivos_terapeuticos: anamneseObjetivos,
      };
    } else if (newDocType === 'ENCAMINHAMENTO') {
      if (!encMotivo.trim() || !encSintese.trim() || !encSolicitacao.trim()) {
        setFormError('Motivo, Síntese do Caso e Solicitação são obrigatórios no Encaminhamento.');
        return;
      }
      contentPayload = {
        especialidade_destino: encEspecialidade,
        profissional_destino: encProfissional,
        motivo_encaminhamento: encMotivo,
        sintese_caso: encSintese,
        solicitacao: encSolicitacao,
      };
    } else if (['LAUDO', 'RELATORIO', 'DECLARACAO', 'ATESTADO', 'PARECER'].includes(newDocType)) {
      if (!cfpIdentificacao.trim() || !cfpDemanda.trim() || !cfpConclusao.trim()) {
        setFormError('Identificação, Demanda e Conclusão são campos obrigatórios.');
        return;
      }
      contentPayload = {
        identificacao: cfpIdentificacao,
        demanda: cfpDemanda,
        procedimento: cfpProcedimento,
        analise: cfpAnalise,
        conclusao: cfpConclusao,
      };
    } else {
      // Anexo Externo / Outro
      if (!attachedFile && !anexoDescricao.trim()) {
        setFormError('Envie um arquivo ou forneça uma descrição detalhada do anexo.');
        return;
      }
      contentPayload = {
        description: anexoDescricao,
        category_label: 'Anexo Externo / Documento Digitalizado',
      };
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      await api.post('/patient-documents', {
        patient_id: patient.id,
        title: formTitle.trim(),
        category: newDocType,
        document_type: newDocType,
        content: contentPayload,
        file_name: attachedFile?.name || null,
        file_size: attachedFile?.size || null,
        file_type: attachedFile?.type || null,
        file_data: attachedFile?.dataUrl || null,
      });

      await fetchDocuments();
      setIsNewDocModalOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Erro ao salvar o documento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    try {
      await api.delete(`/patient-documents/${id}`);
      setDeleteConfirmId(null);
      if (previewDoc?.id === id) setPreviewDoc(null);
      await fetchDocuments();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir documento');
    }
  };

  const copyHashToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter and search
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'ANAMNESE') return doc.category === 'ANAMNESE';
    if (selectedFilter === 'LAUDO') return ['LAUDO', 'RELATORIO', 'PARECER'].includes(doc.category);
    if (selectedFilter === 'ENCAMINHAMENTO') return doc.category === 'ENCAMINHAMENTO';
    if (selectedFilter === 'DECLARACAO') return ['DECLARACAO', 'ATESTADO'].includes(doc.category);
    if (selectedFilter === 'ANEXO_EXTERNO') return ['ANEXO_EXTERNO', 'OUTRO'].includes(doc.category) || Boolean(doc.file_name);

    return true;
  });

  const getCategoryBadge = (category: PatientDocumentCategory) => {
    switch (category) {
      case 'ANAMNESE':
        return {
          label: 'Anamnese Clínica',
          color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800',
          icon: <Brain className="h-3.5 w-3.5" />,
        };
      case 'ENCAMINHAMENTO':
        return {
          label: 'Encaminhamento',
          color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
          icon: <Send className="h-3.5 w-3.5" />,
        };
      case 'LAUDO':
        return {
          label: 'Laudo Psicológico',
          color: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800',
          icon: <FileCheck2 className="h-3.5 w-3.5" />,
        };
      case 'RELATORIO':
        return {
          label: 'Relatório Psicológico',
          color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
          icon: <FileText className="h-3.5 w-3.5" />,
        };
      case 'DECLARACAO':
        return {
          label: 'Declaração',
          color: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800',
          icon: <FileSignatureIcon className="h-3.5 w-3.5" />,
        };
      case 'ATESTADO':
        return {
          label: 'Atestado Psicológico',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
          icon: <ShieldCheck className="h-3.5 w-3.5" />,
        };
      case 'ANEXO_EXTERNO':
      case 'OUTRO':
      default:
        return {
          label: 'Anexo / Externo',
          color: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          icon: <Paperclip className="h-3.5 w-3.5" />,
        };
    }
  };

  // If secretary, show privacy shield
  if (isSecretary) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-8 text-center dark:border-indigo-900 dark:bg-indigo-950/40">
        <Lock className="mx-auto h-12 w-12 text-indigo-600 dark:text-indigo-400" />
        <h3 className="mt-3 text-base font-bold text-indigo-950 dark:text-indigo-100">
          Sigilo Profissional Estrito (Resolução CFP 01/2009 e LGPD)
        </h3>
        <p className="mt-2 text-xs text-indigo-800 dark:text-indigo-300 max-w-md mx-auto leading-relaxed">
          Usuários com perfil de <strong>SECRETÁRIA</strong> possuem autorização legal restrita ao agendamento e controle financeiro. Anamneses, laudos emitidos e encaminhamentos contêm dados de saúde estritamente confidenciais.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Documentos Clínicos & Anexos
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-semibold border border-teal-200 dark:border-teal-800">
              {documents.length} {documents.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Anamnese, laudos emitidos, relatórios, encaminhamentos e anexos externos com assinatura digital SHA-256
          </p>
        </div>

        {/* Quick Action Add Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-add-anamnese-quick"
            type="button"
            onClick={() => handleOpenNewDoc('ANAMNESE')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 transition"
          >
            <Brain className="h-3.5 w-3.5" />
            <span>+ Anamnese</span>
          </button>

          <button
            id="btn-add-encaminhamento-quick"
            type="button"
            onClick={() => handleOpenNewDoc('ENCAMINHAMENTO')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span>+ Encaminhamento</span>
          </button>

          <button
            id="btn-add-laudo-quick"
            type="button"
            onClick={() => handleOpenNewDoc('LAUDO')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition"
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>+ Laudo / CFP</span>
          </button>

          <button
            id="btn-add-anexo-quick"
            type="button"
            onClick={() => handleOpenNewDoc('ANEXO_EXTERNO')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo Documento / Anexo</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              selectedFilter === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Todos ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('ANAMNESE')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              selectedFilter === 'ANAMNESE'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Anamneses
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('ENCAMINHAMENTO')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              selectedFilter === 'ENCAMINHAMENTO'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Encaminhamentos
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('LAUDO')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              selectedFilter === 'LAUDO'
                ? 'bg-rose-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Laudos & Relatórios
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('DECLARACAO')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              selectedFilter === 'DECLARACAO'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Declarações & Atestados
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('ANEXO_EXTERNO')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              selectedFilter === 'ANEXO_EXTERNO'
                ? 'bg-slate-700 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Anexos / Exames Externos
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Documents Grid / List */}
      {loading ? (
        <div className="py-12 text-center text-slate-500">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-teal-600" />
          <p className="mt-2 text-xs">Carregando documentos do paciente...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <FolderPlus className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
          <h4 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
            Nenhum documento encontrado
          </h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchTerm || selectedFilter !== 'ALL'
              ? 'Nenhum documento corresponde ao filtro selecionado.'
              : 'Este paciente ainda não possui anamnese, laudos ou encaminhamentos arquivados.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenNewDoc('ANAMNESE')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition"
            >
              <Brain className="h-3.5 w-3.5" />
              <span>Iniciar Anamnese</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenNewDoc('ENCAMINHAMENTO')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Criar Encaminhamento</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocuments.map((doc) => {
            const badge = getCategoryBadge(doc.category);
            const isDeleting = deleteConfirmId === doc.id;

            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  {/* Top row: Category badge + Date */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold border ${badge.color}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <div className="flex items-center gap-1 text-2xs text-slate-400">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(doc.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Document Title */}
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {doc.title}
                  </h4>

                  {/* Author / Professional */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-400" />
                    <span>
                      {doc.psychologist_name || 'Dr. Marcos Silveira'} ({doc.psychologist_crp || 'CRP 06/128945-SP'})
                    </span>
                  </p>

                  {/* Summary Snippet depending on category */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300">
                    {doc.category === 'ANAMNESE' && (
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">Queixa Principal:</strong>{' '}
                        <span className="line-clamp-2">
                          {(doc.content as AnamneseContent).queixa_principal || 'Não informada'}
                        </span>
                      </div>
                    )}

                    {doc.category === 'ENCAMINHAMENTO' && (
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">
                          Para: {(doc.content as EncaminhamentoContent).especialidade_destino}
                        </strong>
                        <p className="line-clamp-2 mt-0.5">
                          {(doc.content as EncaminhamentoContent).motivo_encaminhamento}
                        </p>
                      </div>
                    )}

                    {['LAUDO', 'RELATORIO', 'DECLARACAO', 'ATESTADO', 'PARECER'].includes(doc.category) && (
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">Conclusão / Parecer:</strong>{' '}
                        <span className="line-clamp-2">
                          {(doc.content as CFPContent).conclusao || (doc.content as CFPContent).demanda || 'Documento emitido'}
                        </span>
                      </div>
                    )}

                    {(doc.category === 'ANEXO_EXTERNO' || doc.category === 'OUTRO') && (
                      <div>
                        {doc.file_name ? (
                          <div className="flex items-center gap-2 font-medium text-teal-700 dark:text-teal-300">
                            <Paperclip className="h-3.5 w-3.5" />
                            <span className="truncate">{doc.file_name}</span>
                            {doc.file_size && (
                              <span className="text-slate-400 text-2xs">
                                ({(doc.file_size / 1024).toFixed(0)} KB)
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="line-clamp-2 italic">
                            {(doc.content as any).description || 'Documento anexado ao dossiê clínico.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hash SHA-256 Badge */}
                  {doc.hash_sha256 && (
                    <div className="mt-2.5 flex items-center justify-between text-2xs text-slate-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                      <div className="flex items-center gap-1 truncate mr-2">
                        <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="truncate font-mono">
                          SHA-256: {doc.hash_sha256.substring(0, 16)}...
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyHashToClipboard(doc.hash_sha256!)}
                        className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 font-semibold shrink-0"
                        title="Copiar Hash SHA-256 de autenticidade"
                      >
                        {copiedHash === doc.hash_sha256 ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Visualizar</span>
                    </button>

                    {doc.file_data && (
                      <a
                        href={doc.file_data}
                        download={doc.file_name || `documento-${doc.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-xs font-semibold transition border border-teal-200 dark:border-teal-800"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Baixar Anexo</span>
                      </a>
                    )}
                  </div>

                  {/* Delete button or confirmation */}
                  {isDeleting ? (
                    <div className="flex items-center gap-1">
                      <span className="text-2xs text-rose-600 dark:text-rose-400 font-medium">
                        Confirmar?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1 rounded bg-rose-600 text-white text-2xs hover:bg-rose-700"
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="p-1 rounded bg-slate-200 text-slate-700 text-2xs hover:bg-slate-300"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(doc.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Excluir documento"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NOVO DOCUMENTO (ANAMNESE / LAUDO / ENCAMINHAMENTO) */}
      {/* ======================================================== */}
      {isNewDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Adicionar Documento ao Cadastro
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paciente: <strong>{patient.full_name}</strong> (CPF: {patient.cpf})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewDocModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Document Type Selector Tabs */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Tipo de Documento:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => resetFormState('ANAMNESE')}
                  className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition border ${
                    newDocType === 'ANAMNESE'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Brain className="h-4 w-4" />
                  <span>Anamnese Clínica</span>
                </button>

                <button
                  type="button"
                  onClick={() => resetFormState('ENCAMINHAMENTO')}
                  className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition border ${
                    newDocType === 'ENCAMINHAMENTO'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Send className="h-4 w-4" />
                  <span>Encaminhamento</span>
                </button>

                <button
                  type="button"
                  onClick={() => resetFormState('LAUDO')}
                  className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition border ${
                    newDocType === 'LAUDO'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                  }`}
                >
                  <FileCheck2 className="h-4 w-4" />
                  <span>Laudo / CFP</span>
                </button>

                <button
                  type="button"
                  onClick={() => resetFormState('ANEXO_EXTERNO')}
                  className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition border ${
                    newDocType === 'ANEXO_EXTERNO'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Paperclip className="h-4 w-4" />
                  <span>Anexo Externo</span>
                </button>
              </div>
            </div>

            {/* Document Form */}
            <form onSubmit={handleSubmitNewDocument} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Document Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Título do Documento *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Anamnese Inicial, Encaminhamento Psiquiátrico, etc."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* SUB-FORM: 1. ANAMNESE */}
              {newDocType === 'ANAMNESE' && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      1. Queixa Principal & Demanda Inicial *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={anamneseQueixa}
                      onChange={(e) => setAnamneseQueixa(e.target.value)}
                      placeholder="Descreva a queixa que motivou a procura pelo atendimento clínico..."
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      2. Histórico dos Sintomas e Evolução do Problema
                    </label>
                    <textarea
                      rows={2}
                      value={anamneseHistorico}
                      onChange={(e) => setAnamneseHistorico(e.target.value)}
                      placeholder="Início dos sintomas, fatores desencadeantes, frequência e intensidade..."
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        3. Antecedentes Pessoais / Médicos
                      </label>
                      <textarea
                        rows={2}
                        value={anamneseAntecedentesPessoais}
                        onChange={(e) => setAnamneseAntecedentesPessoais(e.target.value)}
                        placeholder="Comorbidades clínicas, internações, medicamentos em uso, tratamentos prévios..."
                        className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        4. Histórico e Dinâmica Familiar
                      </label>
                      <textarea
                        rows={2}
                        value={anamneseAntecedentesFamiliares}
                        onChange={(e) => setAnamneseAntecedentesFamiliares(e.target.value)}
                        placeholder="Histórico psiquiátrico na família, dinâmica com pais/cônjuge, vínculos..."
                        className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      5. Rotina, Sono e Hábitos de Vida
                    </label>
                    <textarea
                      rows={2}
                      value={anamneseRotina}
                      onChange={(e) => setAnamneseRotina(e.target.value)}
                      placeholder="Padrão de sono, alimentação, substâncias (álcool/tabaco/café), trabalho e lazer..."
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        6. Hipóteses Diagnósticas Iniciais (CID / DSM)
                      </label>
                      <input
                        type="text"
                        value={anamneseHipoteses}
                        onChange={(e) => setAnamneseHipoteses(e.target.value)}
                        placeholder="Ex: Transtorno de Ansiedade Generalizada (CID-11 6B00)"
                        className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        7. Objetivos Terapêuticos
                      </label>
                      <input
                        type="text"
                        value={anamneseObjetivos}
                        onChange={(e) => setAnamneseObjetivos(e.target.value)}
                        placeholder="Ex: Psicoeducação, treino de regulação emocional e TCC"
                        className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-FORM: 2. ENCAMINHAMENTO */}
              {newDocType === 'ENCAMINHAMENTO' && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Especialidade de Destino *
                      </label>
                      <select
                        value={encEspecialidade}
                        onChange={(e) => setEncEspecialidade(e.target.value)}
                        className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Psiquiatria">Psiquiatria</option>
                        <option value="Neurologia / Neuropsicologia">Neurologia / Neuropsicologia</option>
                        <option value="Nutrição Clínica">Nutrição Clínica</option>
                        <option value="Fonoaudiologia">Fonoaudiologia</option>
                        <option value="Terapia Ocupacional">Terapia Ocupacional</option>
                        <option value="Clínica Médica Geral">Clínica Médica Geral</option>
                        <option value="Psicopedagogia">Psicopedagogia</option>
                        <option value="Outro Serviço de Saúde">Outro Serviço de Saúde</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Nome do Profissional / Serviço (Opcional)
                      </label>
                      <input
                        type="text"
                        value={encProfissional}
                        onChange={(e) => setEncProfissional(e.target.value)}
                        placeholder="Ex: Dr(a). Psiquiatra, CAPS ou Ambulatório"
                        className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Motivo do Encaminhamento *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={encMotivo}
                      onChange={(e) => setEncMotivo(e.target.value)}
                      placeholder="Ex: Avaliação para introdução de suporte psicofarmacológico associado à psicoterapia..."
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Breve Síntese Clínica do Caso *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={encSintese}
                      onChange={(e) => setEncSintese(e.target.value)}
                      placeholder="Resuma o quadro observado nas sessões, resposta terapêutica e impacto funcional..."
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Solicitação Específica ao Profissional *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={encSolicitacao}
                      onChange={(e) => setEncSolicitacao(e.target.value)}
                      placeholder="Ex: Solicito avaliação especializada com vistas ao manejo farmacológico, mantendo contato para conduta integrada..."
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SUB-FORM: 3. CFP (LAUDO / RELATÓRIO / DECLARAÇÃO) */}
              {['LAUDO', 'RELATORIO', 'DECLARACAO', 'ATESTADO', 'PARECER'].includes(newDocType) && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-2xs border border-amber-200 dark:border-amber-900">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>
                      Em conformidade com a <strong>Resolução CFP nº 06/2019</strong>. Todos os 5 itens normativos serão assinados com hash criptográfico SHA-256.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      1. Identificação *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={cfpIdentificacao}
                      onChange={(e) => setCfpIdentificacao(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      2. Descrição da Demanda *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={cfpDemanda}
                      onChange={(e) => setCfpDemanda(e.target.value)}
                      placeholder="Razões e objetivos que justificam a emissão do documento..."
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      3. Procedimento Clínico *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={cfpProcedimento}
                      onChange={(e) => setCfpProcedimento(e.target.value)}
                      placeholder="Instrumentos, testes, sessões e recursos técnico-científicos utilizados..."
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      4. Análise Psicológica *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={cfpAnalise}
                      onChange={(e) => setCfpAnalise(e.target.value)}
                      placeholder="Exposição fundamentada dos dados colhidos, dinâmica psicológica e evolução..."
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      5. Conclusão *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={cfpConclusao}
                      onChange={(e) => setCfpConclusao(e.target.value)}
                      placeholder="Parecer final, encaminhamento ou resposta à demanda inicial formulada..."
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SUB-FORM: 4. ANEXO EXTERNO / ARQUIVO */}
              {newDocType === 'ANEXO_EXTERNO' && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Arquivo (PDF, Imagem ou Documento até 5MB)
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      className="hidden"
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center cursor-pointer hover:border-teal-500 dark:hover:border-teal-400 bg-slate-50 dark:bg-slate-950/40 transition"
                    >
                      {attachedFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <Paperclip className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                              {attachedFile.name}
                            </p>
                            <p className="text-2xs text-slate-400">
                              {(attachedFile.size / 1024).toFixed(1)} KB • Clique para trocar de arquivo
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Paperclip className="mx-auto h-8 w-8 text-slate-400" />
                          <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                            Clique ou arraste um arquivo para anexar
                          </p>
                          <p className="text-2xs text-slate-400 mt-0.5">
                            Laudos externos, exames de neuroimagem, contratos ou termos assinados
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Descrição / Observações do Anexo
                    </label>
                    <textarea
                      rows={3}
                      value={anexoDescricao}
                      onChange={(e) => setAnexoDescricao(e.target.value)}
                      placeholder="Ex: Laudo neurológico trazido pelo paciente em consulta realizada em 15/02..."
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewDocModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Salvando & Assinando...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      <span>Salvar & Assinar Documento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: VISUALIZAÇÃO FORMATADA / IMPRESSÃO EM TIMBRADO    */}
      {/* ======================================================== */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white text-slate-900 rounded-3xl shadow-2xl my-8 overflow-hidden">
            {/* Action Bar (Top) */}
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-400" />
                <span className="text-xs font-bold truncate max-w-md">
                  {previewDoc.title}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimir / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Paper */}
            <div className="p-8 sm:p-12 space-y-6 bg-white text-slate-900 print:p-0">
              {/* Header Letterhead */}
              <div className="text-center border-b-2 border-slate-800 pb-5">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                  {user?.clinic_name || 'Clínica PsicoGestão'}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Atendimento Psicológico Especializado • Registro Regulatório CFP
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  {previewDoc.psychologist_name || user?.name || 'Dr. Marcos Silveira'} — {previewDoc.psychologist_crp || user?.crp_number || 'CRP 06/128945-SP'}
                </p>
              </div>

              {/* Title */}
              <div className="text-center my-4">
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                  {previewDoc.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paciente: <strong>{patient.full_name}</strong> • CPF: {patient.cpf}
                </p>
              </div>

              {/* Content Render based on Category */}
              {previewDoc.category === 'ANAMNESE' && (
                <div className="space-y-4 text-xs leading-relaxed text-slate-800">
                  {Boolean((previewDoc.content as AnamneseContent).queixa_principal) && (
                    <div>
                      <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                        1. Queixa Principal & Demanda
                      </h4>
                      <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                        {(previewDoc.content as AnamneseContent).queixa_principal}
                      </p>
                    </div>
                  )}

                  {Boolean((previewDoc.content as AnamneseContent).historico_sintomas) && (
                    <div>
                      <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                        2. Histórico e Evolução dos Sintomas
                      </h4>
                      <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                        {(previewDoc.content as AnamneseContent).historico_sintomas}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Boolean((previewDoc.content as AnamneseContent).antecedentes_pessoais) && (
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                          3. Antecedentes Pessoais / Médicos
                        </h4>
                        <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                          {(previewDoc.content as AnamneseContent).antecedentes_pessoais}
                        </p>
                      </div>
                    )}

                    {Boolean((previewDoc.content as AnamneseContent).antecedentes_familiares) && (
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                          4. Histórico Familiar
                        </h4>
                        <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                          {(previewDoc.content as AnamneseContent).antecedentes_familiares}
                        </p>
                      </div>
                    )}
                  </div>

                  {Boolean((previewDoc.content as AnamneseContent).rotina_habitos) && (
                    <div>
                      <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                        5. Rotina, Sono e Hábitos
                      </h4>
                      <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                        {(previewDoc.content as AnamneseContent).rotina_habitos}
                      </p>
                    </div>
                  )}

                  {Boolean((previewDoc.content as AnamneseContent).hipoteses_diagnosticas) && (
                    <div>
                      <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                        6. Hipóteses Diagnósticas & Objetivos Terapêuticos
                      </h4>
                      <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                        {(previewDoc.content as AnamneseContent).hipoteses_diagnosticas}
                        {(previewDoc.content as AnamneseContent).objetivos_terapeuticos &&
                          ` • ${(previewDoc.content as AnamneseContent).objetivos_terapeuticos}`}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {previewDoc.category === 'ENCAMINHAMENTO' && (
                <div className="space-y-4 text-xs leading-relaxed text-slate-800">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="font-bold text-blue-900">
                      Ao(À) Colega Especialista em: {(previewDoc.content as EncaminhamentoContent).especialidade_destino}
                    </p>
                    {(previewDoc.content as EncaminhamentoContent).profissional_destino && (
                      <p className="text-blue-800 text-xs mt-0.5">
                        Att: {(previewDoc.content as EncaminhamentoContent).profissional_destino}
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                      1. Motivo do Encaminhamento
                    </h4>
                    <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {(previewDoc.content as EncaminhamentoContent).motivo_encaminhamento}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                      2. Breve Síntese Clínica do Caso
                    </h4>
                    <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {(previewDoc.content as EncaminhamentoContent).sintese_caso}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                      3. Solicitação Específica
                    </h4>
                    <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {(previewDoc.content as EncaminhamentoContent).solicitacao}
                    </p>
                  </div>
                </div>
              )}

              {['LAUDO', 'RELATORIO', 'DECLARACAO', 'ATESTADO', 'PARECER'].includes(previewDoc.category) && (
                <div className="space-y-4 text-xs leading-relaxed text-slate-800">
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                      1. Identificação
                    </h4>
                    <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {(previewDoc.content as CFPContent).identificacao}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                      2. Descrição da Demanda
                    </h4>
                    <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {(previewDoc.content as CFPContent).demanda}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                      3. Procedimento
                    </h4>
                    <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {(previewDoc.content as CFPContent).procedimento}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                      4. Análise
                    </h4>
                    <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {(previewDoc.content as CFPContent).analise}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                      5. Conclusão
                    </h4>
                    <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {(previewDoc.content as CFPContent).conclusao}
                    </p>
                  </div>
                </div>
              )}

              {(previewDoc.category === 'ANEXO_EXTERNO' || previewDoc.category === 'OUTRO') && (
                <div className="space-y-4 text-xs text-slate-800">
                  {Boolean((previewDoc.content as any).description) && (
                    <div>
                      <h4 className="font-bold text-slate-900 uppercase text-2xs mb-1">
                        Descrição do Documento Anexo
                      </h4>
                      <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                        {(previewDoc.content as any).description}
                      </p>
                    </div>
                  )}

                  {previewDoc.file_data && (
                    <div className="border border-slate-200 rounded-xl p-4 text-center bg-slate-50">
                      <p className="font-bold text-xs text-slate-900 mb-2">
                        Arquivo Anexado: {previewDoc.file_name}
                      </p>
                      {previewDoc.file_type?.startsWith('image/') ? (
                        <img
                          src={previewDoc.file_data}
                          alt="Anexo"
                          className="max-h-96 mx-auto rounded-lg shadow-xs"
                        />
                      ) : (
                        <a
                          href={previewDoc.file_data}
                          download={previewDoc.file_name || 'anexo'}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold"
                        >
                          <Download className="h-4 w-4" />
                          <span>Baixar Arquivo ({((previewDoc.file_size || 0) / 1024).toFixed(1)} KB)</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Signature & Cryptographic Stamp */}
              <div className="mt-8 pt-8 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
                <div className="text-center sm:text-left">
                  <p className="text-xs text-slate-500">Local e Data de Emissão:</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">
                    São Paulo - SP, {new Date(previewDoc.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                <div className="text-center border-t border-slate-800 pt-2 sm:border-t-0 sm:pt-0">
                  <div className="border-t border-slate-400 pt-2 w-56 mx-auto">
                    <p className="text-xs font-bold text-slate-900">
                      {previewDoc.psychologist_name || 'Dr. Marcos Silveira'}
                    </p>
                    <p className="text-2xs text-slate-600">
                      Psicólogo Clínico — {previewDoc.psychologist_crp || 'CRP 06/128945-SP'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Digital authenticity footer */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-2xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-mono truncate">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">Hash SHA-256: {previewDoc.hash_sha256}</span>
                </div>
                <span className="shrink-0 font-sans">
                  Assinado Digitalmente • Imutabilidade Garantida
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function FileSignatureIcon(props: React.SVGProps<SVGSVGElement>) {
  return <FileText {...props} />;
}
