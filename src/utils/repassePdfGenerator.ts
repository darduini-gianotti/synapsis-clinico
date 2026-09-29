import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface RepassePdfData {
  batch: {
    id: number;
    batch_number: string;
    psychologist_name?: string;
    psychologist_crp?: string;
    psychologist_pix_key?: string;
    psychologist_pix_key_type?: string;
    period_start: string;
    period_end: string;
    status: string;
    total_sessions_count: number;
    gross_total_amount?: number | null;
    repasse_subtotal: number;
    deductions_amount: number;
    additions_amount: number;
    net_repasse_amount: number;
    notes?: string | null;
    closed_at?: string | null;
    paid_at?: string | null;
    payment_date?: string | null;
    payment_method?: string | null;
  };
  items: Array<{
    id?: number;
    service_date: string;
    patient_name?: string;
    service_label?: string;
    service_type: string;
    gross_amount?: number | null;
    repasse_rate: number;
    repasse_amount: number;
  }>;
  adjustments?: Array<{
    id?: number;
    adjustment_type: 'DEDUCTION' | 'ADDITION';
    description: string;
    amount: number;
  }>;
  clinic_settings?: {
    clinic_name?: string;
    cnpj?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
}

const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
};

export function generateRepassePdf(data: RepassePdfData) {
  const { batch, items, adjustments = [], clinic_settings } = data;
  const doc = new jsPDF();

  const clinicName = clinic_settings?.clinic_name || 'PsicoGestão Clínica';
  const clinicCnpj = clinic_settings?.cnpj ? `CNPJ: ${clinic_settings.cnpj}` : '';
  const clinicPhone = clinic_settings?.phone ? `Tel: ${clinic_settings.phone}` : '';
  const clinicEmail = clinic_settings?.email ? `Email: ${clinic_settings.email}` : '';

  // 1. Cabeçalho Institucional
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(clinicName.toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // Slate-300
  const clinicContactLine = [clinicCnpj, clinicPhone, clinicEmail].filter(Boolean).join('  •  ');
  if (clinicContactLine) {
    doc.text(clinicContactLine, 14, 18);
  }
  doc.text('SISTEMA DE GESTÃO CLÍNICA & REPASSE DE HONORÁRIOS', 14, 23);

  // 2. Título do Documento & Metadados
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('DEMONSTRATIVO DE REPASSE DE HONORÁRIOS', 14, 35);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  // Status Badge
  const statusLabel = batch.status === 'PAID' ? 'PAGO / LIQUIDADO' : batch.status === 'CLOSED' ? 'FECHADO / AGUARDANDO PAGAMENTO' : 'EM ABERTO';
  doc.setFont('helvetica', 'bold');
  doc.text(`Lote: ${batch.batch_number}  |  Situação: ${statusLabel}`, 14, 41);

  // Caixa de Informações do Profissional
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 46, 182, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Profissional: ${batch.psychologist_name || 'Psicólogo Parceiro'}`, 18, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Registro Profissional: ${batch.psychologist_crp || 'Não informado'}`, 18, 58);
  doc.text(`Competência: ${formatDate(batch.period_start)} até ${formatDate(batch.period_end)}`, 18, 64);

  const pixText = batch.psychologist_pix_key
    ? `Chave PIX (${batch.psychologist_pix_key_type || 'PIX'}): ${batch.psychologist_pix_key}`
    : 'Chave PIX não informada';
  doc.text(pixText, 110, 52);

  const paymentText = batch.status === 'PAID'
    ? `Data do Pagamento: ${formatDate(batch.payment_date || batch.paid_at)} via ${batch.payment_method || 'PIX'}`
    : `Data de Emissão: ${formatDate(new Date().toISOString())}`;
  doc.text(paymentText, 110, 58);

  // 3. Tabela Analítica de Atendimentos
  const hasGross = batch.gross_total_amount !== null && batch.gross_total_amount !== undefined;

  const tableHeaders = hasGross
    ? ['Data', 'Paciente', 'Serviço', 'Valor Base', 'Rateio', 'Repasse']
    : ['Data', 'Paciente', 'Serviço', 'Rateio', 'Repasse'];

  const tableBody = items.map((item) => {
    const sDate = formatDate(item.service_date);
    const pName = item.patient_name || 'Paciente';
    const sLabel = item.service_label || (item.service_type === 'NEUROPSYCH_EVALUATION' ? 'Avaliação Neuropsicológica' : 'Psicoterapia');
    const rateText = item.repasse_rate > 100 ? formatCurrency(item.repasse_rate) : `${item.repasse_rate}%`;
    const repValue = formatCurrency(item.repasse_amount);

    if (hasGross) {
      return [sDate, pName, sLabel, formatCurrency(item.gross_amount), rateText, repValue];
    }
    return [sDate, pName, sLabel, rateText, repValue];
  });

  autoTable(doc, {
    startY: 74,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
    },
    headStyles: {
      fillColor: [13, 148, 136], // Teal-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: hasGross
      ? {
          0: { cellWidth: 22 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 16, halign: 'center' },
          5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        }
      : {
          0: { cellWidth: 24 },
          1: { cellWidth: 68 },
          2: { cellWidth: 50 },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        },
  });

  let currentY = (doc as any).lastAutoTable?.finalY || 120;

  // 4. Tabela de Ajustes / Deduções (se houver)
  if (adjustments && adjustments.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    } else {
      currentY += 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('Ajustes, Deduções & Acréscimos do Lote', 14, currentY);
    currentY += 3;

    const adjHeaders = ['Tipo', 'Descrição', 'Valor'];
    const adjBody = adjustments.map((adj) => [
      adj.adjustment_type === 'DEDUCTION' ? '(-) Dedução' : '(+) Bônus',
      adj.description,
      `${adj.adjustment_type === 'DEDUCTION' ? '-' : '+'} ${formatCurrency(adj.amount)}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [adjHeaders],
      body: adjBody,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
      },
      headStyles: {
        fillColor: [71, 85, 105], // Slate-600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 125 },
        2: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY || currentY + 20;
  }

  // 5. Quadro Resumo de Totais
  if (currentY > 235) {
    doc.addPage();
    currentY = 20;
  } else {
    currentY += 8;
  }

  doc.setFillColor(241, 245, 249); // Slate-100
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(100, currentY, 96, hasGross ? 38 : 32, 2, 2, 'FD');

  let rowY = currentY + 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text(`Total de Atendimentos:`, 105, rowY);
  doc.text(`${batch.total_sessions_count} sessões`, 190, rowY, { align: 'right' });
  rowY += 5.5;

  if (hasGross) {
    doc.text(`Total Faturado pela Clínica:`, 105, rowY);
    doc.text(formatCurrency(batch.gross_total_amount), 190, rowY, { align: 'right' });
    rowY += 5.5;
  }

  doc.text(`Subtotal de Repasse dos Atendimentos:`, 105, rowY);
  doc.text(formatCurrency(batch.repasse_subtotal), 190, rowY, { align: 'right' });
  rowY += 5.5;

  if (batch.deductions_amount > 0) {
    doc.setTextColor(225, 29, 72); // Rose
    doc.text(`(-) Deduções / Adiantamentos:`, 105, rowY);
    doc.text(`- ${formatCurrency(batch.deductions_amount)}`, 190, rowY, { align: 'right' });
    rowY += 5.5;
    doc.setTextColor(71, 85, 105);
  }

  if (batch.additions_amount > 0) {
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(`(+) Acréscimos / Bônus:`, 105, rowY);
    doc.text(`+ ${formatCurrency(batch.additions_amount)}`, 190, rowY, { align: 'right' });
    rowY += 5.5;
    doc.setTextColor(71, 85, 105);
  }

  // Linha Líquida
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(13, 148, 136); // Teal-600
  doc.text(`VALOR LÍQUIDO A REPASSAR:`, 105, rowY + 1);
  doc.text(formatCurrency(batch.net_repasse_amount), 190, rowY + 1, { align: 'right' });

  // 6. Termo de Quitação e Assinatura
  const sigY = Math.max(currentY + 46, rowY + 12);
  if (sigY < 275) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(
      'Documento de apuração contábil gerado eletronicamente pelo PsicoGestão SaaS em conformidade com as diretrizes do CFP.',
      14,
      sigY
    );
    doc.text(
      `Declaro ter conferido e estar ciente dos atendimentos e valores discriminados neste lote de honorários.`,
      14,
      sigY + 4
    );

    doc.setDrawColor(203, 213, 225);
    doc.line(14, sigY + 16, 95, sigY + 16);
    doc.text(`${batch.psychologist_name || 'Profissional Responsável'}`, 14, sigY + 20);
    doc.text(`Assinatura do Profissional`, 14, sigY + 23);

    doc.line(115, sigY + 16, 196, sigY + 16);
    doc.text(`${clinicName}`, 115, sigY + 20);
    doc.text(`Administração / Financeiro`, 115, sigY + 23);
  }

  doc.save(`demonstrativo_repasse_${batch.batch_number}.pdf`);
}
