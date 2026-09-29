import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Brain,
  X,
  FileSignature,
  Printer,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Eye,
  Edit3,
  Award,
  Calendar,
  User,
  Clock,
  Copy,
  Check,
  Download,
  Loader2,
  BarChart3,
  Plus,
  Trash2,
  Sliders,
  CheckSquare,
  Square,
  Activity,
  Layers,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { PsychometricTestScore } from '../../types.js';
import {
  DIAGNOSTIC_HYPOTHESES_CATALOG,
  COMMON_SATEPSI_TESTS,
  getPercentileClassification,
} from '../../data/neuropsychCatalog.js';
import { generateCognitiveProfileImage } from '../../utils/cognitiveChartGenerator.js';

interface EvaluationReportModalProps {
  evaluationId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onNavigateToPatientProntuario?: (patientId: number) => void;
}

// Helper formatting for Guardian and Financial Responsible
const formatGuardianStr = (g: any, fallbackRole = 'Responsável Legal') => {
  if (!g) return '';
  const name = g.fullName || g.name || '';
  if (!name.trim()) return '';
  const rel = g.relationship ? g.relationship.trim() : fallbackRole;
  const cpfPart = g.cpf ? ` - CPF: ${g.cpf.trim()}` : '';
  return `${name.trim()} (${rel}${cpfPart})`;
};

const formatFinRespStr = (f: any) => {
  if (!f) return '';
  const name = f.fullName || f.name || '';
  if (!name.trim()) return '';
  const rel = f.relationship ? f.relationship.trim() : 'Responsável Financeiro';
  const cpfPart = f.cpf ? ` - CPF: ${f.cpf.trim()}` : '';
  return `${name.trim()} (${rel}${cpfPart})`;
};

const formatClinicAddress = (addr: string | null | undefined) => {
  if (!addr) return '';
  try {
    const parsed = JSON.parse(addr);
    if (typeof parsed === 'object' && parsed !== null) {
      const parts = [
        parsed.street ? `${parsed.street}${parsed.number ? `, ${parsed.number}` : ''}` : '',
        parsed.neighborhood || '',
        parsed.city ? `${parsed.city}${parsed.state ? ` - ${parsed.state}` : ''}` : '',
        parsed.postal_code ? `CEP: ${parsed.postal_code}` : '',
      ].filter(Boolean);
      return parts.join(' • ');
    }
  } catch {}
  return addr;
};

export const EvaluationReportModal: React.FC<EvaluationReportModalProps> = ({
  evaluationId,
  isOpen,
  onClose,
  onSuccess,
  onNavigateToPatientProntuario,
}) => {
  const { clinicSettings } = useAuth();
  const [localClinicSettings, setLocalClinicSettings] = useState<any>(null);

  useEffect(() => {
    if (clinicSettings) {
      setLocalClinicSettings(clinicSettings);
    } else {
      api
        .get('/clinic-settings')
        .then((res) => {
          if (res.data?.settings) setLocalClinicSettings(res.data.settings);
        })
        .catch(() => {});
    }
  }, [clinicSettings]);

  const activeClinic = clinicSettings || localClinicSettings;
  const clinicAddressFormatted = formatClinicAddress(activeClinic?.address);

  const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showConfirmSignModal, setShowConfirmSignModal] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [responsavelPreset, setResponsavelPreset] = useState<string>('custom');

  // Evaluation Data
  const [evaluation, setEvaluation] = useState<any>(null);

  // Structured CFP 06/2019 Sections
  const [identificacao, setIdentificacao] = useState<any>({
    paciente: '',
    cpf: '',
    nascimento: '',
    responsavel: '',
    solicitante: 'Encaminhamento Clínico / Demanda Espontânea',
    finalidade: 'Avaliação do perfil cognitivo, atencional e das funções executivas para subsídio diagnóstico e terapêutico.',
    psicologo: '',
  });

  const [demanda, setDemanda] = useState('');
  const [procedimento, setProcedimento] = useState('');
  const [analise, setAnalise] = useState('');
  const [conclusao, setConclusao] = useState('');
  const [recomendacoes, setRecomendacoes] = useState('');

  // Psychometric Tests & Diagnostic Hypotheses
  const [psychometricTests, setPsychometricTests] = useState<PsychometricTestScore[]>([]);
  const [selectedHypotheses, setSelectedHypotheses] = useState<string[]>([]);
  const [chartPreviewUrl, setChartPreviewUrl] = useState<string | null>(null);

  // Status & Cryptographic seal
  const [isSigned, setIsSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [hashSha256, setHashSha256] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && evaluationId) {
      loadEvaluation(evaluationId);
    } else {
      setEvaluation(null);
      setFeedback(null);
    }
  }, [isOpen, evaluationId]);

  const loadEvaluation = async (id: number) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/evaluations/${id}`);
      const ev = res.data.evaluation;
      if (!ev) return;

      setEvaluation(ev);

      const doc = ev.draft_document;
      setIsSigned(Boolean(doc?.is_signed));
      setSignedAt(doc?.signed_at || null);
      setHashSha256(doc?.hash_sha256 || null);

      let content: any = {};
      if (doc?.content) {
        content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
      }

      // Load Psychometric Tests & Hypotheses
      const loadedTests = Array.isArray(content.psychometricTests) ? content.psychometricTests : [];
      setPsychometricTests(loadedTests);
      setSelectedHypotheses(Array.isArray(content.selectedHypotheses) ? content.selectedHypotheses : []);

      const gStr = formatGuardianStr(ev.patient_guardian, 'Responsável Legal');
      const fStr = formatFinRespStr(ev.patient_financial_responsible);
      const isMinor = ev.patient_group === 'Criança' || ev.patient_group === 'Adolescente';

      let currentResponsavel = content.identificacao?.responsavel;
      if (!currentResponsavel || currentResponsavel === 'O próprio / Responsável Legal') {
        if (gStr) {
          currentResponsavel = gStr;
        } else if (isMinor) {
          currentResponsavel = 'A definir (Responsável Legal)';
        } else {
          currentResponsavel = 'O próprio (Paciente)';
        }
      }

      if (gStr && currentResponsavel === gStr) {
        setResponsavelPreset('guardian');
      } else if (fStr && currentResponsavel === fStr) {
        setResponsavelPreset('financial');
      } else if (
        currentResponsavel === 'O próprio' ||
        currentResponsavel === 'O próprio (Paciente)' ||
        currentResponsavel === 'O próprio (Paciente maior de idade)' ||
        currentResponsavel === 'O próprio (Paciente autodeterminado)'
      ) {
        setResponsavelPreset('self');
      } else if (currentResponsavel === 'Não se aplica') {
        setResponsavelPreset('na');
      } else {
        setResponsavelPreset('custom');
      }

      setIdentificacao({
        paciente: content.identificacao?.paciente || ev.patient_name || 'Não informado',
        cpf: content.identificacao?.cpf || ev.patient_cpf || 'Não informado',
        nascimento: content.identificacao?.nascimento || ev.patient_birth_date || 'Não informado',
        responsavel: currentResponsavel,
        solicitante: content.identificacao?.solicitante || 'Encaminhamento Clínico / Demanda Espontânea',
        finalidade: content.identificacao?.finalidade || 'Avaliação do perfil cognitivo e das funções executivas para subsídio diagnóstico.',
        psicologo: content.identificacao?.psicologo || `${ev.psychologist_name} - ${ev.psychologist_crp || 'CRP Ativo'}`,
      });

      setDemanda(content.demanda || `Investigação neuropsicológica solicitada para compreensão de: ${ev.title}.`);
      setProcedimento(
        content.procedimento ||
          `O processo avaliativo prevê aproximadamente ${ev.estimated_sessions || 6} sessões de avaliação presencial e/ou remota, abrangendo:\n1. Entrevista de Anamnese e histórico neuropsicossocial;\n2. Aplicação de baterias neuropsicológicas padronizadas (SATEPSI/CFP);\n3. Observação clínica do comportamento e autorregulação;\n4. Devolutiva aos familiares/paciente com entrega do laudo conclusivo.`
      );
      setAnalise(
        content.analise ||
          `Resultados dos domínios neuropsicológicos investigados:\n- Eficiência Intelectual e Raciocínio Geral: [Preencher resultados dos testes]\n- Atenção Sustentada, Alternada e Concentrada: [Preencher resultados dos testes]\n- Funções Executivas e Flexibilidade Cognitiva: [Preencher resultados dos testes]\n- Memória de Trabalho e Memória de Longo Prazo: [Preencher resultados dos testes]\n- Aspectos Afetivos e Emocionais: [Preencher resultados dos testes]`
      );
      setConclusao(
        content.conclusao ||
          (ev.hypothesis_diagnosis
            ? `Síntese conclusiva correlacionando os dados psicométricos com a queixa inicial. Hipótese diagnóstica: ${ev.hypothesis_diagnosis}.`
            : `Síntese integrativa dos resultados quantitativos e qualitativos obtidos durante o processo avaliativo.`)
      );
      setRecomendacoes(
        content.recomendacoes ||
          `1. Recomendações de suporte escolar e adaptação pedagógica (se aplicável);\n2. Orientações aos familiares para rotinas diárias e autorregulação;\n3. Sugestões de acompanhamento multidisciplinar (Psicoterapia, Neurologia, Fonoaudiologia).`
      );

      // Se já estiver assinado, abre direto no Preview Timbrado
      if (doc?.is_signed) {
        setActiveView('preview');
      } else {
        setActiveView('edit');
      }
    } catch (err: any) {
      console.error('Failed to load evaluation report:', err);
      setFeedback({ message: 'Erro ao carregar dados do laudo.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (psychometricTests.length > 0) {
      try {
        const url = generateCognitiveProfileImage(psychometricTests, { width: 1000 });
        setChartPreviewUrl(url);
      } catch (err) {
        console.error('Error generating cognitive profile chart preview:', err);
      }
    } else {
      setChartPreviewUrl(null);
    }
  }, [psychometricTests]);

  const handleAddPsychometricTest = (presetName = '', presetDomain = '') => {
    if (isSigned) return;
    const defaultTest = presetName || 'WISC-IV';
    const foundPreset = COMMON_SATEPSI_TESTS.find((t) => t.testName === defaultTest);
    const defaultDomain = presetDomain || (foundPreset ? foundPreset.domains[0] : 'Função Cognitiva Geral');
    const newTest: PsychometricTestScore = {
      id: 'test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      testName: defaultTest,
      domain: defaultDomain,
      standardScore: 100,
      percentile: 50,
      classification: 'Médio',
    };
    setPsychometricTests((prev) => [...prev, newTest]);
  };

  const handleUpdateTest = (id: string, updates: Partial<PsychometricTestScore>) => {
    if (isSigned) return;
    setPsychometricTests((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };
        if (updates.percentile !== undefined) {
          const val = Math.max(0, Math.min(99.9, Number(updates.percentile) || 0));
          updated.percentile = val;
          const classInfo = getPercentileClassification(val);
          updated.classification = classInfo.label;
        }
        return updated;
      })
    );
  };

  const handleRemoveTest = (id: string) => {
    if (isSigned) return;
    setPsychometricTests((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleHypothesis = (hypoId: string) => {
    if (isSigned) return;
    setSelectedHypotheses((prev) =>
      prev.includes(hypoId) ? prev.filter((id) => id !== hypoId) : [...prev, hypoId]
    );
  };

  const handleApplyHypothesesToReport = () => {
    if (isSigned) return;
    if (selectedHypotheses.length === 0) {
      setFeedback({ message: 'Selecione ao menos uma hipótese diagnóstica para aplicar.', type: 'error' });
      return;
    }
    const items = DIAGNOSTIC_HYPOTHESES_CATALOG.filter((h) => selectedHypotheses.includes(h.id));
    if (items.length === 0) return;

    const combinedConclusion = items.map((h) => h.summary).join('\n\n');
    setConclusao(combinedConclusion);

    const allDirectives: string[] = [];
    items.forEach((h) => {
      h.directives.forEach((d) => {
        if (!allDirectives.includes(d)) allDirectives.push(d);
      });
    });
    const formattedDirectives = allDirectives.map((d, i) => `${i + 1}. ${d}`).join('\n');
    setRecomendacoes(formattedDirectives);

    setFeedback({
      message: `Síntese de ${items.length} hipótese(s) aplicada à Conclusão e Recomendações com sucesso!`,
      type: 'success',
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const getFullContentObject = () => ({
    identificacao,
    demanda,
    procedimento,
    analise,
    conclusao,
    recomendacoes,
    psychometricTests,
    selectedHypotheses,
  });

  const handleSaveDraft = async () => {
    if (!evaluationId) return;
    try {
      setIsSaving(true);
      const content = getFullContentObject();
      await api.put(`/evaluations/${evaluationId}`, {
        draft_report_content: content,
      });

      setFeedback({ message: 'Rascunho do Laudo salvo com sucesso!', type: 'success' });
      setTimeout(() => setFeedback(null), 4000);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Failed to save report draft:', err);
      setFeedback({ message: err.response?.data?.error || 'Erro ao salvar rascunho.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenSignModal = () => {
    if (!evaluationId) return;

    if (!demanda.trim() || !procedimento.trim() || !analise.trim() || !conclusao.trim()) {
      setFeedback({
        message: 'Preencha todas as seções obrigatórias antes de assinar o laudo conclusivo.',
        type: 'error',
      });
      return;
    }

    setShowConfirmSignModal(true);
  };

  const confirmCompleteAndSign = async () => {
    if (!evaluationId) return;

    try {
      setIsCompleting(true);
      const content = getFullContentObject();
      const res = await api.post(`/evaluations/${evaluationId}/complete`, {
        status: 'COMPLETED',
        final_report_content: content,
      });

      setIsSigned(true);
      setHashSha256(res.data.hash_sha256);
      setSignedAt(new Date().toISOString());
      setShowConfirmSignModal(false);
      setActiveView('preview');
      setFeedback({
        message: 'Avaliação concluída e Laudo Oficial assinado com sucesso!',
        type: 'success',
      });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Failed to complete evaluation:', err);
      setFeedback({ message: err.response?.data?.error || 'Erro ao assinar laudo.', type: 'error' });
    } finally {
      setIsCompleting(false);
    }
  };

  const handlePrint = () => {
    const sheet = document.getElementById('printable-laudo-sheet');
    if (!sheet) {
      window.print();
      return;
    }

    // Create an invisible isolated iframe to print strictly the document sheet
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((s) => s.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laudo Neuropsicológico - ${identificacao.paciente || 'Paciente'}</title>
          <meta charset="utf-8" />
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 12mm 15mm 12mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            }
            #printable-laudo-sheet {
              width: 100% !important;
              max-width: 100% !important;
              border: none !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 0 !important;
              background: transparent !important;
            }
            .section-avoid-break {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          <div id="printable-laudo-sheet">${sheet.innerHTML}</div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 400);
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPdf(true);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210
      const pageHeight = doc.internal.pageSize.getHeight(); // 297
      const margin = 16;
      const contentWidth = pageWidth - margin * 2; // 178
      let y = margin;

      const checkPageBreak = (needed: number) => {
        if (y + needed > pageHeight - margin) {
          doc.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // Header: Clinic logo (if available) + text
      const clinicName = activeClinic?.clinic_name || 'Espaço Integrare Psicologia e Neuropsicologia';
      const clinicPhone = activeClinic?.phone || '';
      const clinicCnpj = activeClinic?.cnpj ? `CNPJ: ${activeClinic.cnpj}` : '';
      const clinicEmail = activeClinic?.email || '';
      const addressFormatted = clinicAddressFormatted || '';

      if (activeClinic?.logo_base64) {
        try {
          doc.addImage(activeClinic.logo_base64, 'PNG', margin, y, 32, 13, undefined, 'FAST');
        } catch {
          // If image format is custom, fallback smoothly
        }
      }

      // Clinic title & details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(59, 7, 100); // purple-950
      doc.text(clinicName, pageWidth - margin, y + 4, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('Serviço Especializado de Avaliação e Diagnóstico Neuropsicológico Clínico', pageWidth - margin, y + 8, { align: 'right' });

      const subHeader = [clinicCnpj, clinicPhone ? `Telefone: ${clinicPhone}` : '', clinicEmail].filter(Boolean).join(' • ');
      if (subHeader) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(subHeader, pageWidth - margin, y + 12, { align: 'right' });
      }
      if (addressFormatted) {
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(addressFormatted, pageWidth - margin, y + 15.5, { align: 'right' });
      }

      y += 19;

      // Divider line
      doc.setDrawColor(88, 28, 135); // purple-900
      doc.setLineWidth(0.6);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      // Document Badge
      doc.setFillColor(245, 243, 255); // purple-50
      doc.roundedRect(pageWidth / 2 - 38, y, 76, 6.5, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(88, 28, 135);
      doc.text('LAUDO NEUROPSICOLÓGICO', pageWidth / 2, y + 4.5, { align: 'center' });
      y += 9.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 33, 168);
      doc.text('Conforme a Resolução do Conselho Federal de Psicologia (CFP) nº 06/2019', pageWidth / 2, y, { align: 'center' });
      y += 7;

      // Helper for numbered sections
      const renderSection = (title: string, content: string) => {
        checkPageBreak(16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(59, 7, 100);
        doc.text(title, margin, y);
        y += 1.5;
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);

        const lines = doc.splitTextToSize(content || 'Não informado.', contentWidth);
        for (const line of lines) {
          checkPageBreak(4.5);
          doc.text(line, margin, y);
          y += 3.8;
        }
        y += 3.5;
      };

      // 1. Identificação
      checkPageBreak(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(59, 7, 100);
      doc.text('1. IDENTIFICAÇÃO', margin, y);
      y += 1.5;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4.5;

      const col2X = margin + 90;
      const printField = (label: string, val: string, xPos: number, isRight = false) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(label, xPos, y);
        const lWidth = doc.getTextWidth(label) + 1.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        const maxW = isRight ? (pageWidth - margin - xPos - lWidth) : (col2X - xPos - lWidth - 2);
        const textVal = doc.splitTextToSize(val || '-', Math.max(30, maxW));
        doc.text(textVal[0] || '-', xPos + lWidth, y);
      };

      printField('Paciente:', identificacao.paciente || '-', margin);
      printField('CPF:', identificacao.cpf || '-', col2X, true);
      y += 4.2;

      printField('Data de Nascimento:', identificacao.nascimento || '-', margin);
      printField('Responsável:', identificacao.responsavel || 'Não se aplica', col2X, true);
      y += 4.2;

      printField('Solicitante:', identificacao.solicitante || '-', margin);
      printField('Finalidade:', identificacao.finalidade || '-', col2X, true);
      y += 4.2;

      printField('Psicólogo(a) Responsável:', identificacao.psicologo || '-', margin);
      y += 6;

      // 2. Demanda
      renderSection('2. DESCRIÇÃO DA DEMANDA', demanda);

      // 3. Procedimento
      renderSection('3. PROCEDIMENTO & INSTRUMENTOS', procedimento);

      // 4. Análise
      renderSection('4. ANÁLISE NEUROPSICOLÓGICA', analise);

      // Desempenho Psicométrico & Curva de Gauss no PDF (se houver testes)
      if (psychometricTests.length > 0) {
        checkPageBreak(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(59, 7, 100);
        doc.text('DESEMPENHO PSICOMÉTRICO NORMATIVO DOS TESTES:', margin, y);
        y += 4;

        // Cabeçalho da Tabela
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 5.5, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, y + 5.5, margin + contentWidth, y + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text('Instrumento / Bateria', margin + 2, y + 3.8);
        doc.text('Domínio Avaliado', margin + 45, y + 3.8);
        doc.text('EP', margin + 110, y + 3.8, { align: 'center' });
        doc.text('Percentil', margin + 130, y + 3.8, { align: 'center' });
        doc.text('Classificação', margin + 175, y + 3.8, { align: 'right' });
        y += 6;

        // Linhas da Tabela
        psychometricTests.forEach((t) => {
          checkPageBreak(5);
          const c = getPercentileClassification(t.percentile);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(15, 23, 42);
          doc.text(t.testName, margin + 2, y + 3.2);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(51, 65, 85);
          const domainTrim = t.domain.length > 38 ? t.domain.substring(0, 36) + '...' : t.domain;
          doc.text(domainTrim, margin + 45, y + 3.2);

          doc.text(t.standardScore ? String(t.standardScore) : '-', margin + 110, y + 3.2, { align: 'center' });

          doc.setFont('helvetica', 'bold');
          doc.text(`P${t.percentile}`, margin + 130, y + 3.2, { align: 'center' });

          doc.text(c.label, margin + 175, y + 3.2, { align: 'right' });

          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.1);
          doc.line(margin, y + 4.5, margin + contentWidth, y + 4.5);
          y += 4.5;
        });

        y += 3;

        // Inserção da Imagem da Curva Normal de Gauss
        try {
          const chartImg = generateCognitiveProfileImage(psychometricTests, { width: 1200 });
          if (chartImg) {
            const chartHeightMm = Math.min(84, Math.max(52, 30 + psychometricTests.length * 6));
            checkPageBreak(chartHeightMm + 8);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(59, 7, 100);
            doc.text('CURVA NORMAL & PERFIL COGNITIVO:', margin, y);
            y += 3.5;
            doc.addImage(chartImg, 'PNG', margin, y, contentWidth, chartHeightMm, undefined, 'FAST');
            y += chartHeightMm + 6;
          }
        } catch (chartErr) {
          console.error('Failed to embed cognitive profile chart into PDF:', chartErr);
        }
      }

      // 5. Conclusão
      renderSection('5. CONCLUSÃO & HIPÓTESE DIAGNÓSTICA', conclusao);

      // 6. Recomendações
      renderSection('6. RECOMENDAÇÕES TERAPÊUTICAS & ENCAMINHAMENTOS', recomendacoes);

      // Signature & Digital Seal
      checkPageBreak(30);
      y += 6;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(pageWidth / 2 - 35, y, pageWidth / 2 + 35, y);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(identificacao.psicologo || 'Psicólogo(a) Responsável', pageWidth / 2, y, { align: 'center' });
      y += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Psicólogo(a) Especialista em Neuropsicologia', pageWidth / 2, y, { align: 'center' });
      y += 6;

      if (isSigned && hashSha256) {
        doc.setDrawColor(110, 231, 183); // emerald-300
        doc.setFillColor(236, 253, 245); // emerald-50
        doc.roundedRect(margin, y, contentWidth, 11, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(6, 95, 70); // emerald-800
        doc.text('DOCUMENTO ASSINADO DIGITALMENTE (RESOLUÇÃO CFP 06/2019)', margin + 3, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`Assinado em: ${signedAt ? signedAt.split('T')[0] : ''}`, pageWidth - margin - 3, y + 4, { align: 'right' });

        doc.setFont('courier', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(4, 120, 87);
        doc.text(`Hash SHA-256: ${hashSha256}`, margin + 3, y + 8);
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('[Documento em elaboração - Rascunho não conclusivo]', pageWidth / 2, y + 4, { align: 'center' });
      }

      const cleanPatientName = (identificacao.paciente || 'Paciente')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');

      doc.save(`Laudo_Neuropsicologico_${cleanPatientName}.pdf`);
      setFeedback({
        message: 'Download do Laudo em PDF concluído com sucesso!',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Erro ao gerar PDF do laudo:', err);
      setFeedback({
        message: `Não foi possível gerar o arquivo PDF diretamente (${err?.message || 'erro inesperado'}). Tente o botão Imprimir.`,
        type: 'error',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyHash = () => {
    if (hashSha256) {
      navigator.clipboard.writeText(hashSha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const guardianStr = formatGuardianStr(evaluation?.patient_guardian, 'Responsável Legal');
  const finRespStr = formatFinRespStr(evaluation?.patient_financial_responsible);
  const isMinor = evaluation?.patient_group === 'Criança' || evaluation?.patient_group === 'Adolescente';

  const handlePresetChange = (preset: string) => {
    setResponsavelPreset(preset);
    if (preset === 'guardian' && guardianStr) {
      setIdentificacao((prev: any) => ({ ...prev, responsavel: guardianStr }));
    } else if (preset === 'financial' && finRespStr) {
      setIdentificacao((prev: any) => ({ ...prev, responsavel: finRespStr }));
    } else if (preset === 'self') {
      setIdentificacao((prev: any) => ({ ...prev, responsavel: 'O próprio (Paciente)' }));
    } else if (preset === 'na') {
      setIdentificacao((prev: any) => ({ ...prev, responsavel: 'Não se aplica' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-5xl my-4 sm:my-8 rounded-2xl border border-purple-200 bg-white shadow-2xl dark:border-purple-900/60 dark:bg-slate-900 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* ======================================================== */}
        {/* TOP BAR (HIDDEN IN PRINT) */}
        {/* ======================================================== */}
        <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm shrink-0">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Laudo Neuropsicológico
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Resolução CFP nº 06/2019
                </span>
                {isSigned ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Assinado Digitalmente</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <Clock className="h-3 w-3" />
                    <span>Rascunho em Elaboração</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Paciente: <strong>{evaluation?.patient_name}</strong> • Responsável:{' '}
                {evaluation?.psychologist_name} ({evaluation?.psychologist_crp || 'CRP Ativo'})
              </p>
            </div>
          </div>

          {/* Mode Switcher & Close */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveView('edit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeView === 'edit'
                    ? 'bg-white text-purple-700 shadow-xs dark:bg-slate-900 dark:text-purple-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Preenchimento</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('preview')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeView === 'preview'
                    ? 'bg-white text-purple-700 shadow-xs dark:bg-slate-900 dark:text-purple-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Laudo Timbrado</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="print:hidden px-6 pt-3">
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL BODY */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-24 text-center text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent mx-auto mb-3" />
              <p className="text-sm font-semibold">Carregando seções do Laudo Oficial...</p>
            </div>
          ) : activeView === 'edit' ? (
            /* ======================================================== */
            /* VIEW 1: PREENCHIMENTO ESTRUTURADO (CFP 06/2019) */
            /* ======================================================== */
            <div className="space-y-5">
              {/* Orientações CFP */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3.5 text-xs text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-200 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Estrutura Normativa Obrigatória (CFP nº 06/2019):</strong> O laudo psicológico/neuropsicológico é estruturado em 5 seções fundamentais: <em>1. Identificação</em>, <em>2. Descrição da Demanda</em>, <em>3. Procedimentos</em>, <em>4. Análise</em> e <em>5. Conclusão</em>. Preencha ou refine os campos abaixo e clique em <strong>Salvar Rascunho</strong> ou visualize o formato oficial timbrado na aba <strong>Laudo Timbrado</strong>.
                </div>
              </div>

              {/* Seção 1: Identificação */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2">
                  <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    1. Identificação do Documento & Partes
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Paciente:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {identificacao.paciente}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      CPF / Nascimento:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {identificacao.cpf} • {identificacao.nascimento}
                      </span>
                      {evaluation?.patient_group && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {evaluation.patient_group}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Psicólogo(a) Responsável:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {identificacao.psicologo}
                    </span>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1 space-y-1.5 rounded-xl border border-purple-100 dark:border-purple-900/40 bg-purple-50/25 dark:bg-purple-950/15 p-2.5">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Responsável Legal (se menor/curatelado):
                      </label>
                      {guardianStr ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          ✓ Ficha do Paciente
                        </span>
                      ) : isMinor ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Menor de Idade
                        </span>
                      ) : null}
                    </div>

                    {/* Seletor Rápido Dropdown */}
                    <div className="space-y-1.5">
                      <select
                        aria-label="Selecionar Responsável Legal"
                        value={responsavelPreset}
                        onChange={(e) => handlePresetChange(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/60 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:border-purple-500 focus:outline-hidden"
                      >
                        <option value="">-- Selecionar Responsável Legal --</option>
                        {guardianStr && (
                          <option value="guardian">
                            👤 Ficha: {guardianStr}
                          </option>
                        )}
                        {finRespStr && finRespStr !== guardianStr && (
                          <option value="financial">
                            💳 Ficha (Financeiro): {finRespStr}
                          </option>
                        )}
                        <option value="self">👤 O próprio (Paciente maior de idade)</option>
                        <option value="na">🚫 Não se aplica</option>
                        <option value="custom">✏️ Digitação livre / Personalizado</option>
                      </select>

                      {/* Input Editável com texto completo */}
                      <input
                        type="text"
                        value={identificacao.responsavel}
                        onChange={(e) => {
                          const val = e.target.value;
                          setIdentificacao((prev: any) => ({ ...prev, responsavel: val }));
                          if (guardianStr && val === guardianStr) setResponsavelPreset('guardian');
                          else if (finRespStr && val === finRespStr) setResponsavelPreset('financial');
                          else if (val === 'O próprio (Paciente)' || val === 'O próprio') setResponsavelPreset('self');
                          else if (val === 'Não se aplica') setResponsavelPreset('na');
                          else setResponsavelPreset('custom');
                        }}
                        placeholder="Nome do responsável (Parentesco - CPF: ...)"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:border-purple-500"
                      />
                    </div>

                    {guardianStr ? (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                        <span>Dados preenchidos da ficha cadastral.</span>
                        {identificacao.responsavel !== guardianStr && (
                          <button
                            type="button"
                            onClick={() => handlePresetChange('guardian')}
                            className="text-purple-600 hover:text-purple-700 dark:text-purple-400 font-bold hover:underline cursor-pointer"
                          >
                            Restaurar do cadastro
                          </button>
                        )}
                      </div>
                    ) : isMinor ? (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        ⚠️ Paciente menor sem responsável cadastrado na ficha geral. Digite diretamente acima se aplicável.
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Solicitante do Encaminhamento:
                    </label>
                    <input
                      type="text"
                      value={identificacao.solicitante}
                      onChange={(e) =>
                        setIdentificacao({ ...identificacao, solicitante: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Finalidade da Avaliação:
                    </label>
                    <input
                      type="text"
                      value={identificacao.finalidade}
                      onChange={(e) =>
                        setIdentificacao({ ...identificacao, finalidade: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 2: Descrição da Demanda */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black text-[10px]">
                      2
                    </span>
                    <span>Descrição da Demanda / Queixa Principal & Histórico</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Resolução CFP nº 06/2019 - Art. 13</span>
                </div>
                <textarea
                  rows={4}
                  value={demanda}
                  onChange={(e) => setDemanda(e.target.value)}
                  placeholder="Descreva as queixas relatadas, os motivos da consulta, histórico dos sintomas, desenvolvimento neuropsicomotor, histórico escolar/ocupacional e hipóteses iniciais..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-3 text-xs text-slate-900 dark:text-white leading-relaxed focus:outline-hidden focus:border-purple-500"
                />
              </div>

              {/* Seção 3: Procedimento */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black text-[10px]">
                      3
                    </span>
                    <span>Procedimento & Instrumentos Técnicos Aplicados</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Testes SATEPSI e Sessões</span>
                </div>
                <textarea
                  rows={5}
                  value={procedimento}
                  onChange={(e) => setProcedimento(e.target.value)}
                  placeholder="Número de sessões realizadas, instrumentos psicométricos e baterias administradas (ex: WISC-IV, WAIS-III, Neupsilin, BPA, FDT, Stroop, Columbia, BDEFS) e comportamento durante a aplicação..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-3 text-xs text-slate-900 dark:text-white leading-relaxed focus:outline-hidden focus:border-purple-500"
                />
              </div>

              {/* Seção 4: Análise Neuropsicológica */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black text-[10px]">
                      4
                    </span>
                    <span>Análise Neuropsicológica por Funções Cognitivas</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Interpretação Integrativa</span>
                </div>
                <textarea
                  rows={5}
                  value={analise}
                  onChange={(e) => setAnalise(e.target.value)}
                  placeholder="Apresente a síntese dos resultados por domínio: Eficiência Intelectual e Raciocínio, Atenção, Funções Executivas e Flexibilidade Cognitiva, Memória, Linguagem, Processamento Visoespacial..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-3 text-xs text-slate-900 dark:text-white leading-relaxed focus:outline-hidden focus:border-purple-500"
                />

                {/* Sub-bloco: Desempenho Normativo Psicométrico & Curva de Gauss */}
                <div className="rounded-xl border border-purple-100 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/10 p-4 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 dark:border-purple-900/40 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Testagem Psicométrica Normativa & Curva de Gauss
                        </h4>
                        {psychometricTests.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                            {psychometricTests.length} teste(s)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Lance os testes aplicados com escore e percentil. O sistema calcula a classificação e gera o perfil cognitivo com a Curva Normal.
                      </p>
                    </div>

                    {!isSigned && (
                      <button
                        type="button"
                        onClick={() => handleAddPsychometricTest()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Adicionar Teste</span>
                      </button>
                    )}
                  </div>

                  {/* Atalhos Rápidos para Baterias SATEPSI */}
                  {!isSigned && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Atalhos Rápidos de Instrumentos SATEPSI:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_SATEPSI_TESTS.map((t) => (
                          <button
                            key={t.testName}
                            type="button"
                            onClick={() => handleAddPsychometricTest(t.testName, t.domains[0])}
                            className="text-[10px] font-semibold px-2 py-1 rounded-md border border-purple-200 dark:border-purple-800/60 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-900 dark:text-purple-300 transition cursor-pointer"
                          >
                            + {t.testName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tabela de Testes Psicométricos */}
                  {psychometricTests.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-purple-200 dark:border-purple-800/60 rounded-xl bg-white/50 dark:bg-slate-900/30">
                      Nenhum teste psicométrico quantitativo lançado. Clique em "+ Adicionar Teste" ou nos atalhos acima para gerar o gráfico da Curva Normal.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <th className="p-2.5">Instrumento / Teste</th>
                            <th className="p-2.5">Domínio Cognitivo</th>
                            <th className="p-2.5 w-24">Escore Padrão</th>
                            <th className="p-2.5 w-24">Percentil (0-100)</th>
                            <th className="p-2.5">Classificação Normativa</th>
                            {!isSigned && <th className="p-2.5 w-10 text-center">Ações</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {psychometricTests.map((test) => {
                            const classInfo = getPercentileClassification(test.percentile);
                            return (
                              <tr key={test.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                <td className="p-2">
                                  <input
                                    type="text"
                                    disabled={isSigned}
                                    value={test.testName}
                                    onChange={(e) => handleUpdateTest(test.id, { testName: e.target.value })}
                                    placeholder="Ex: WISC-IV"
                                    className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    disabled={isSigned}
                                    value={test.domain}
                                    onChange={(e) => handleUpdateTest(test.id, { domain: e.target.value })}
                                    placeholder="Ex: Compreensão Verbal"
                                    className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    disabled={isSigned}
                                    value={test.standardScore ?? ''}
                                    onChange={(e) => handleUpdateTest(test.id, { standardScore: e.target.value ? Number(e.target.value) : undefined })}
                                    placeholder="Ex: 98"
                                    className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 text-center font-mono"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    disabled={isSigned}
                                    value={test.percentile}
                                    onChange={(e) => handleUpdateTest(test.id, { percentile: Number(e.target.value) })}
                                    placeholder="Ex: 45"
                                    className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white text-center font-mono"
                                  />
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${classInfo.badgeClass}`}>
                                      {classInfo.label}
                                    </span>
                                    <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden hidden sm:block">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${Math.max(4, Math.min(100, test.percentile))}%`, backgroundColor: classInfo.color }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                {!isSigned && (
                                  <td className="p-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTest(test.id)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                      title="Remover teste"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Prévia do Gráfico no Editor */}
                  {chartPreviewUrl && (
                    <div className="pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        Prévia do Gráfico de Perfil Psicométrico (Curva de Gauss):
                      </span>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 overflow-hidden shadow-xs">
                        <img
                          src={chartPreviewUrl}
                          alt="Perfil Psicométrico e Curva de Gauss"
                          className="w-full h-auto max-h-[360px] object-contain mx-auto rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção 5: Conclusão & Diagnóstico */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black text-[10px]">
                      5
                    </span>
                    <span>Conclusão & Hipótese Diagnóstica (CID-11 / DSM-5)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Síntese Diagnóstica</span>
                </div>

                {/* Sub-bloco: Catálogo Estruturado de Hipóteses Diagnósticas */}
                {!isSigned && (
                  <div className="rounded-xl border border-purple-100 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/10 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          <span>Catálogo Clínico de Hipóteses (CID-11 / DSM-5)</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Selecione as hipóteses clínicas e comorbidades para preencher a Conclusão e os Encaminhamentos.
                        </p>
                      </div>

                      {selectedHypotheses.length > 0 && (
                        <button
                          type="button"
                          onClick={handleApplyHypothesesToReport}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Aplicar ao Laudo ({selectedHypotheses.length})</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {DIAGNOSTIC_HYPOTHESES_CATALOG.map((h) => {
                        const isSelected = selectedHypotheses.includes(h.id);
                        return (
                          <div
                            key={h.id}
                            onClick={() => handleToggleHypothesis(h.id)}
                            className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-1 text-xs ${
                              isSelected
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-200 dark:hover:border-purple-800/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-bold">
                                {h.code}
                              </span>
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                              )}
                            </div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white leading-snug mt-1">
                              {h.title}
                            </span>
                            <span className="text-[10px] text-slate-400">{h.category}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <textarea
                  rows={5}
                  value={conclusao}
                  onChange={(e) => setConclusao(e.target.value)}
                  placeholder="Síntese conclusiva correlacionando o perfil psicométrico com a demanda inicial. Enquadramento CID-11 / DSM-5 e impacto funcional na vida diária..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-3 text-xs text-slate-900 dark:text-white leading-relaxed focus:outline-hidden focus:border-purple-500"
                />
              </div>

              {/* Seção 6: Recomendações Terapêuticas */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black text-[10px]">
                      6
                    </span>
                    <span>Recomendações Terapêuticas & Encaminhamentos</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Orientações Multidisciplinares</span>
                </div>
                <textarea
                  rows={4}
                  value={recomendacoes}
                  onChange={(e) => setRecomendacoes(e.target.value)}
                  placeholder="Orientações e adaptações pedagógicas/escolares, orientação aos familiares, encaminhamentos a médicos especialistas (Neurologia/Psiquiatria) e intervenções terapêuticas..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-3 text-xs text-slate-900 dark:text-white leading-relaxed focus:outline-hidden focus:border-purple-500"
                />
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* VIEW 2: LAUDO OFICIAL TIMBRADO (A4 PREVIEW & IMPRESSÃO) */
            /* ======================================================== */
            <div className="space-y-6">
              {/* Botões de Ação de Impressão e Download */}
              <div className="print:hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 text-xs">
                <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300">
                  <Sparkles className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                  <span>
                    Pré-visualização do Laudo Oficial diagramado no padrão timbrado para impressão A4 ou download direto em PDF.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingPdf ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-purple-300 bg-white hover:bg-purple-100/60 text-purple-900 dark:bg-slate-800 dark:border-slate-700 dark:text-purple-300 dark:hover:bg-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>

              {/* Folha A4 Timbrada */}
              <div
                id="printable-laudo-sheet"
                className="mx-auto max-w-[800px] bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg border border-slate-200 space-y-7 print:border-none print:shadow-none print:p-0 print:m-0"
              >
                {/* Cabeçalho Oficial Timbrado com Logo das Configurações */}
                <div className="border-b-2 border-purple-900 pb-4 space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 print:flex-row print:justify-between print:items-center">
                    {/* Logomarca da Clínica */}
                    <div className="shrink-0 flex items-center justify-center">
                      {activeClinic?.logo_base64 ? (
                        <img
                          src={activeClinic.logo_base64}
                          alt={activeClinic.clinic_name || 'Logo da Clínica'}
                          className="h-16 w-auto max-h-20 max-w-[220px] object-contain print:max-h-20"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-800 border border-purple-200">
                          <Brain className="h-7 w-7 text-purple-700" />
                        </div>
                      )}
                    </div>

                    {/* Dados Institucionais da Clínica */}
                    <div className="text-center sm:text-right print:text-right space-y-0.5 flex-1">
                      <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-purple-950">
                        {activeClinic?.clinic_name || 'Espaço Integrare Psicologia e Neuropsicologia'}
                      </h1>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Serviço Especializado de Avaliação e Diagnóstico Neuropsicológico Clínico
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {[
                          activeClinic?.cnpj ? `CNPJ: ${activeClinic.cnpj}` : null,
                          activeClinic?.phone ? `Telefone: ${activeClinic.phone}` : null,
                          activeClinic?.email ? activeClinic.email : null,
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                      {clinicAddressFormatted && (
                        <p className="text-[10px] text-slate-500">
                          {clinicAddressFormatted}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tarja do Documento */}
                  <div className="pt-2 text-center">
                    <span className="inline-block px-5 py-1 rounded-full bg-purple-50 text-purple-900 font-black text-xs uppercase tracking-widest border border-purple-200 shadow-2xs">
                      LAUDO NEUROPSICOLÓGICO
                    </span>
                    <p className="text-[9px] text-purple-800 font-semibold mt-1">
                      Conforme a Resolução do Conselho Federal de Psicologia (CFP) nº 06/2019
                    </p>
                  </div>
                </div>

                {/* 1. Identificação */}
                <div className="space-y-2 section-avoid-break">
                  <h2 className="text-xs font-black uppercase tracking-wider text-purple-950 border-b border-slate-200 pb-1">
                    1. IDENTIFICAÇÃO
                  </h2>
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
                    <div>
                      <strong className="text-slate-700">Paciente:</strong>{' '}
                      <span>{identificacao.paciente}</span>
                    </div>
                    <div>
                      <strong className="text-slate-700">CPF:</strong>{' '}
                      <span>{identificacao.cpf}</span>
                    </div>
                    <div>
                      <strong className="text-slate-700">Data de Nascimento:</strong>{' '}
                      <span>{identificacao.nascimento}</span>
                    </div>
                    <div>
                      <strong className="text-slate-700">Responsável:</strong>{' '}
                      <span>{identificacao.responsavel}</span>
                    </div>
                    <div>
                      <strong className="text-slate-700">Solicitante:</strong>{' '}
                      <span>{identificacao.solicitante}</span>
                    </div>
                    <div>
                      <strong className="text-slate-700">Finalidade:</strong>{' '}
                      <span>{identificacao.finalidade}</span>
                    </div>
                    <div className="col-span-2">
                      <strong className="text-slate-700">Psicólogo(a) Responsável:</strong>{' '}
                      <span>{identificacao.psicologo}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Descrição da Demanda */}
                <div className="space-y-2 section-avoid-break">
                  <h2 className="text-xs font-black uppercase tracking-wider text-purple-950 border-b border-slate-200 pb-1">
                    2. DESCRIÇÃO DA DEMANDA
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-line text-justify">
                    {demanda || 'Não informado.'}
                  </p>
                </div>

                {/* 3. Procedimento */}
                <div className="space-y-2 section-avoid-break">
                  <h2 className="text-xs font-black uppercase tracking-wider text-purple-950 border-b border-slate-200 pb-1">
                    3. PROCEDIMENTO & INSTRUMENTOS
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-line text-justify">
                    {procedimento || 'Não informado.'}
                  </p>
                </div>

                {/* 4. Análise */}
                <div className="space-y-3 section-avoid-break">
                  <h2 className="text-xs font-black uppercase tracking-wider text-purple-950 border-b border-slate-200 pb-1">
                    4. ANÁLISE NEUROPSICOLÓGICA
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-line text-justify">
                    {analise || 'Não informado.'}
                  </p>

                  {/* Tabela Psicométrica Estruturada e Curva Normal */}
                  {psychometricTests.length > 0 && (
                    <div className="pt-2 space-y-3">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
                        Resultados Psicométricos Quantitativos & Curva de Gauss:
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-slate-300">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                              <th className="p-2">Instrumento / Bateria</th>
                              <th className="p-2">Domínio Avaliado</th>
                              <th className="p-2 text-center">Escore Padrão</th>
                              <th className="p-2 text-center">Percentil</th>
                              <th className="p-2">Classificação Normativa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {psychometricTests.map((t, idx) => {
                              const c = getPercentileClassification(t.percentile);
                              return (
                                <tr key={t.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                  <td className="p-2 font-bold text-slate-900">{t.testName}</td>
                                  <td className="p-2 text-slate-700">{t.domain}</td>
                                  <td className="p-2 text-center font-mono">{t.standardScore ?? '-'}</td>
                                  <td className="p-2 text-center font-bold font-mono">P{t.percentile}</td>
                                  <td className="p-2">
                                    <span
                                      className="font-bold text-[10px] px-2 py-0.5 rounded border inline-block"
                                      style={{
                                        color: c.color,
                                        borderColor: c.color + '60',
                                        backgroundColor: c.color + '15',
                                      }}
                                    >
                                      {c.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {chartPreviewUrl && (
                        <div className="rounded-lg border border-slate-300 overflow-hidden bg-white p-1 text-center">
                          <img
                            src={chartPreviewUrl}
                            alt="Gráfico de Perfil Psicométrico e Curva de Gauss"
                            className="w-full max-h-[360px] object-contain mx-auto"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Conclusão */}
                <div className="space-y-2 section-avoid-break">
                  <h2 className="text-xs font-black uppercase tracking-wider text-purple-950 border-b border-slate-200 pb-1">
                    5. CONCLUSÃO & HIPÓTESE DIAGNÓSTICA
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-line text-justify font-medium">
                    {conclusao || 'Não informado.'}
                  </p>
                </div>

                {/* 6. Recomendações */}
                <div className="space-y-2 section-avoid-break">
                  <h2 className="text-xs font-black uppercase tracking-wider text-purple-950 border-b border-slate-200 pb-1">
                    6. RECOMENDAÇÕES TERAPÊUTICAS & ENCAMINHAMENTOS
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-line text-justify">
                    {recomendacoes || 'Não informado.'}
                  </p>
                </div>

                {/* Assinatura & Selo Criptográfico Digital */}
                <div className="pt-8 border-t border-slate-300 mt-8 space-y-4 section-avoid-break">
                  <div className="text-center space-y-1">
                    <div className="w-56 border-b border-slate-900 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-900">{identificacao.psicologo}</p>
                    <p className="text-[10px] text-slate-500">
                      Psicólogo(a) Especialista em Neuropsicologia
                    </p>
                  </div>

                  {isSigned && hashSha256 ? (
                    <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50/70 text-emerald-950 text-[10px] space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span>DOCUMENTO ASSINADO DIGITALMENTE (RESOLUÇÃO CFP 06/2019)</span>
                        </div>
                        <span>Assinado em: {signedAt ? signedAt.split('T')[0] : ''}</span>
                      </div>
                      <div className="font-mono text-[9px] break-all text-emerald-800">
                        Hash SHA-256: {hashSha256}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-center text-slate-400 italic">
                      [Documento em elaboração - Rascunho não conclusivo]
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* BOTTOM ACTION BUTTONS (HIDDEN IN PRINT) */}
        {/* ======================================================== */}
        <div className="print:hidden flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onNavigateToPatientProntuario && evaluation?.patient_id && (
              <button
                type="button"
                onClick={() => onNavigateToPatientProntuario(evaluation.patient_id)}
                className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 font-semibold cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Abrir Prontuário Clínico Completo</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Fechar
            </button>

            {!isSigned && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Rascunho'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenSignModal}
                  disabled={isCompleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Award className="h-3.5 w-3.5" />
                  <span>{isCompleting ? 'Assinando...' : 'Concluir & Assinar Laudo'}</span>
                </button>
              </>
            )}

            {isSigned && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-md shadow-purple-700/20 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimir Laudo</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Modal In-App de Confirmação para Assinatura Digital */}
        {showConfirmSignModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-purple-200 bg-white p-6 shadow-2xl dark:border-purple-900/60 dark:bg-slate-900 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 shadow-xs">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Concluir & Assinar Laudo Oficial
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Paciente: <strong>{identificacao.paciente}</strong>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3.5 text-xs text-purple-950 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-200 space-y-2 leading-relaxed">
                <p>
                  Conforme as <strong>Resoluções CFP nº 01/2009 e 06/2019</strong>, será gerada uma chave de autenticidade criptográfica <strong>SHA-256</strong> vinculando o seu CRP (<strong>{identificacao.psicologo}</strong>) e o conteúdo integral deste documento.
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-800 dark:text-purple-300">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Documento oficial com validade clínica e jurídica.</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmSignModal(false)}
                  disabled={isCompleting}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={confirmCompleteAndSign}
                  disabled={isCompleting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isCompleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Assinando...</span>
                    </>
                  ) : (
                    <>
                      <Award className="h-4 w-4" />
                      <span>Sim, Concluir & Assinar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
