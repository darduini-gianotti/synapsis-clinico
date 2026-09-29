import { queryAll, queryOne, execute } from './db.js';
import { generateSHA256 } from './crypto.js';

export interface FiscalSettings {
  id?: number;
  user_id: number;
  cpf: string;
  crp: string;
  cbo_code: string;
  dependents_count: number;
  inss_mode: 'NONE' | 'STANDARD_20' | 'SIMPLIFIED_11' | 'CUSTOM_FIXED';
  inss_custom_amount: number;
  use_simplified_deduction: number;
}

export interface CarneLeaoRevenueItem {
  id: number;
  date: string; // YYYY-MM-DD
  amount: number;
  patientId: number;
  patientName: string;
  patientCpf: string;
  payerName: string;
  payerCpf: string;
  cboCode: string;
  description: string;
  receiptNumber?: string;
}

export interface CarneLeaoExpenseItem {
  id: number;
  date: string; // YYYY-MM-DD
  amount: number; // calculated quota for this psychologist
  originalAmount: number;
  title: string;
  category: string;
  rfbAccountCode: string;
  isShared: boolean;
  splitPercent: number;
  notes?: string;
  origin: 'DIRECT' | 'SHARED' | 'SUBLOCACAO_CLINICA';
}

export interface CarneLeaoSummary {
  psychologist: {
    id: number;
    name: string;
    crp: string;
    cpf: string;
    cboCode: string;
  };
  competence: {
    year: number;
    month: number;
    label: string; // e.g., '09/2026'
  };
  settings: FiscalSettings;
  revenues: CarneLeaoRevenueItem[];
  totalRevenues: number;
  expenses: CarneLeaoExpenseItem[];
  totalDeductibleExpenses: number;
  coworkingRoomDeductions: number;
  carriedOverDeficitFromPreviousMonths: number;
  netLivroCaixaBalance: number;
  nextMonthCarryOverDeficit: number;
  inssDeduction: number;
  dependentsDeduction: number;
  totalPersonalDeductions: number;
  totalCombinedDeductions: number;
  taxBase: number;
  darf: {
    taxableAmount: number;
    aliquotPercent: number;
    deductionParcel: number;
    calculatedTax: number;
    isBelowMinThreshold: boolean;
    finalDarfAmount: number;
    revenueCode: string; // '0190'
    dueDate: string; // YYYY-MM-DD
    dueDateFormatted: string; // DD/MM/AAAA
    notes: string;
  };
}

/**
 * Retorna o último dia útil do mês subsequente (vencimento oficial do DARF 0190)
 */
export function getLastBusinessDayOfNextMonth(year: number, month: number): { iso: string; formatted: string } {
  // Próximo mês
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  // Último dia do próximo mês
  const lastDay = new Date(nextYear, nextMonth, 0).getDate();
  let dateObj = new Date(nextYear, nextMonth - 1, lastDay);

  // Se cair no sábado (6), volta para sexta (5)
  // Se cair no domingo (0), volta para sexta (5)
  const dayOfWeek = dateObj.getDay();
  if (dayOfWeek === 6) {
    dateObj.setDate(dateObj.getDate() - 1);
  } else if (dayOfWeek === 0) {
    dateObj.setDate(dateObj.getDate() - 2);
  }

  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');

  return {
    iso: `${yyyy}-${mm}-${dd}`,
    formatted: `${dd}/${mm}/${yyyy}`,
  };
}

/**
 * Tabela Progressiva Mensal do IRPF (Receita Federal)
 */
export function applyProgressiveTableIRPF(taxBase: number): {
  aliquotPercent: number;
  deductionParcel: number;
  calculatedTax: number;
} {
  const base = Math.max(0, taxBase);

  // Faixas oficiais IRPF
  if (base <= 2259.20) {
    return { aliquotPercent: 0, deductionParcel: 0, calculatedTax: 0 };
  } else if (base <= 2826.65) {
    const tax = base * 0.075 - 169.44;
    return { aliquotPercent: 7.5, deductionParcel: 169.44, calculatedTax: Math.max(0, tax) };
  } else if (base <= 3751.05) {
    const tax = base * 0.15 - 381.44;
    return { aliquotPercent: 15.0, deductionParcel: 381.44, calculatedTax: Math.max(0, tax) };
  } else if (base <= 4664.68) {
    const tax = base * 0.225 - 662.77;
    return { aliquotPercent: 22.5, deductionParcel: 662.77, calculatedTax: Math.max(0, tax) };
  } else {
    const tax = base * 0.275 - 896.00;
    return { aliquotPercent: 27.5, deductionParcel: 896.00, calculatedTax: Math.max(0, tax) };
  }
}

/**
 * Busca ou gera perfil fiscal padrão do psicólogo
 */
export function getFiscalSettings(psychologistId: number): FiscalSettings {
  const row = queryOne<any>(
    `SELECT * FROM user_fiscal_settings WHERE user_id = ?`,
    [psychologistId]
  );

  if (row) {
    return {
      id: row.id,
      user_id: row.user_id,
      cpf: row.cpf,
      crp: row.crp,
      cbo_code: row.cbo_code || '2251-05',
      dependents_count: Number(row.dependents_count) || 0,
      inss_mode: row.inss_mode || 'STANDARD_20',
      inss_custom_amount: Number(row.inss_custom_amount) || 0,
      use_simplified_deduction: Number(row.use_simplified_deduction) || 0,
    };
  }

  // Fallback baseado nos dados de users
  const user = queryOne<any>(`SELECT name, crp_number FROM users WHERE id = ?`, [psychologistId]) || {};
  return {
    user_id: psychologistId,
    cpf: psychologistId === 1 ? '123.456.789-00' : '987.654.321-99',
    crp: user.crp_number || 'CRP 06/128945-SP',
    cbo_code: '2251-05',
    dependents_count: 0,
    inss_mode: 'STANDARD_20',
    inss_custom_amount: 0,
    use_simplified_deduction: 0,
  };
}

/**
 * Salva ou atualiza configurações fiscais
 */
export function saveFiscalSettings(psychologistId: number, data: Partial<FiscalSettings>): FiscalSettings {
  const existing = queryOne<any>(`SELECT id FROM user_fiscal_settings WHERE user_id = ?`, [psychologistId]);

  if (existing) {
    execute(
      `UPDATE user_fiscal_settings
       SET cpf = COALESCE(?, cpf),
           crp = COALESCE(?, crp),
           cbo_code = COALESCE(?, cbo_code),
           dependents_count = COALESCE(?, dependents_count),
           inss_mode = COALESCE(?, inss_mode),
           inss_custom_amount = COALESCE(?, inss_custom_amount),
           use_simplified_deduction = COALESCE(?, use_simplified_deduction),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [
        data.cpf,
        data.crp,
        data.cbo_code,
        data.dependents_count,
        data.inss_mode,
        data.inss_custom_amount,
        data.use_simplified_deduction,
        psychologistId,
      ]
    );
  } else {
    execute(
      `INSERT INTO user_fiscal_settings
       (user_id, cpf, crp, cbo_code, dependents_count, inss_mode, inss_custom_amount, use_simplified_deduction)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        psychologistId,
        data.cpf || '000.000.000-00',
        data.crp || 'CRP 06/000000',
        data.cbo_code || '2251-05',
        data.dependents_count || 0,
        data.inss_mode || 'STANDARD_20',
        data.inss_custom_amount || 0,
        data.use_simplified_deduction || 0,
      ]
    );
  }

  return getFiscalSettings(psychologistId);
}

/**
 * Busca receitas pagas no mês com extração inteligente de Titular Pagador vs Beneficiário
 */
export function getRevenuesForMonth(psychologistId: number, year: number, month: number): CarneLeaoRevenueItem[] {
  const monthStr = String(month).padStart(2, '0');
  const filterPrefix = `${year}-${monthStr}`;

  const rows = queryAll<any>(
    `SELECT t.id, 
            COALESCE(t.paid_at, t.transaction_date) as data_pagamento, 
            t.amount as valor,
            t.evaluation_id,
            p.id as patient_id,
            p.full_name as patient_name,
            p.cpf as patient_cpf,
            p.guardian_json,
            p.financial_responsible_json,
            s.psychologist_id as session_psychologist_id,
            ne.psychologist_id as eval_psychologist_id,
            p.psychologist_id as patient_psychologist_id
     FROM financial_transactions t
     JOIN patients p ON t.patient_id = p.id
     LEFT JOIN sessions s ON t.session_id = s.id
     LEFT JOIN neuropsych_evaluations ne ON t.evaluation_id = ne.id
     WHERE t.status = 'PAID'
       AND (COALESCE(t.paid_at, t.transaction_date) LIKE ?)
     ORDER BY data_pagamento ASC, t.id ASC`,
    [`${filterPrefix}%`]
  );

  const revenues: CarneLeaoRevenueItem[] = [];

  for (const r of rows) {
    // Verificar se pertence a este psicólogo
    const ownerId = r.session_psychologist_id || r.eval_psychologist_id || r.patient_psychologist_id || 1;
    if (ownerId !== psychologistId) {
      continue;
    }

    // Extração precisa do Pagador/Titular
    let payerName = r.patient_name;
    let payerCpf = r.patient_cpf || '00000000000';

    if (r.financial_responsible_json) {
      try {
        const finResp = typeof r.financial_responsible_json === 'string' 
          ? JSON.parse(r.financial_responsible_json) 
          : r.financial_responsible_json;
        if (finResp && finResp.fullName) {
          payerName = finResp.fullName;
          payerCpf = finResp.cpf || payerCpf;
        }
      } catch {}
    } else if (r.guardian_json) {
      try {
        const guard = typeof r.guardian_json === 'string'
          ? JSON.parse(r.guardian_json)
          : r.guardian_json;
        if (guard && guard.fullName) {
          payerName = guard.fullName;
          payerCpf = guard.cpf || payerCpf;
        }
      } catch {}
    }

    // Limpar CPFs de pontuações
    const cleanPayerCpf = payerCpf.replace(/\D/g, '') || '00000000000';
    const cleanPatientCpf = (r.patient_cpf || cleanPayerCpf).replace(/\D/g, '') || cleanPayerCpf;

    const dateOnly = (r.data_pagamento || '').split(' ')[0] || `${filterPrefix}-01`;
    const desc = r.evaluation_id 
      ? 'Honorários de Avaliação Neuropsicológica Clínica' 
      : 'Honorários de Serviços Psicológicos / Psicoterapia';

    revenues.push({
      id: r.id,
      date: dateOnly,
      amount: Number(r.valor) || 0,
      patientId: r.patient_id,
      patientName: r.patient_name,
      patientCpf: cleanPatientCpf,
      payerName,
      payerCpf: cleanPayerCpf,
      cboCode: '2251-05',
      description: desc,
      receiptNumber: r.evaluation_id ? `REC-EVAL-${r.evaluation_id}-T${r.id}` : `REC-SESS-${r.id}`,
    });
  }

  return revenues;
}

/**
 * Busca despesas dedutíveis do psicólogo no mês (diretas + cota de compartilhadas + taxas de sublocação)
 */
export function getExpensesForMonth(psychologistId: number, year: number, month: number): CarneLeaoExpenseItem[] {
  const monthStr = String(month).padStart(2, '0');
  const filterPrefix = `${year}-${monthStr}`;

  // 1. Despesas Diretas e Compartilhadas
  const rows = queryAll<any>(
    `SELECT e.id, 
            COALESCE(e.payment_date, e.due_date) as data_despesa,
            e.amount,
            e.title,
            e.category,
            e.rfb_account_code,
            e.is_shared,
            e.shared_splits_json,
            e.scope,
            e.payer_user_id,
            e.psychologist_id,
            e.notes
     FROM expenses e
     WHERE e.status = 'PAID' 
       AND e.carne_leao_deductible = 1
       AND (COALESCE(e.payment_date, e.due_date) LIKE ?)
     ORDER BY data_despesa ASC`,
    [`${filterPrefix}%`]
  );

  const expenses: CarneLeaoExpenseItem[] = [];

  for (const exp of rows) {
    const isShared = exp.scope === 'SHARED' || Boolean(exp.is_shared);
    const originalAmount = Number(exp.amount) || 0;
    const dateOnly = (exp.data_despesa || '').split(' ')[0] || `${filterPrefix}-01`;

    if (isShared) {
      // Analisar o rateio
      let splitPercent = 0;
      if (exp.shared_splits_json) {
        try {
          const splits = typeof exp.shared_splits_json === 'string'
            ? JSON.parse(exp.shared_splits_json)
            : exp.shared_splits_json;
          if (Array.isArray(splits)) {
            const mySplit = splits.find((s: any) => Number(s.userId || s.user_id) === psychologistId);
            if (mySplit) {
              splitPercent = Number(mySplit.percent || mySplit.percentage) || 0;
            }
          } else if (typeof splits === 'object' && splits !== null) {
            splitPercent = Number(splits[psychologistId] ?? splits[String(psychologistId)]) || 0;
          }
        } catch {}
      } else {
        // Se compartilhado sem json explícito, divide igualmente entre usuários ativos
        const totalUsers = queryAll<any>(`SELECT count(*) as count FROM users WHERE role IN ('PSYCHOLOGIST', 'ADMIN')`)[0]?.count || 2;
        splitPercent = totalUsers > 0 ? 100 / totalUsers : 50;
      }

      if (splitPercent > 0) {
        const quotaAmount = (originalAmount * splitPercent) / 100;
        expenses.push({
          id: exp.id,
          date: dateOnly,
          amount: quotaAmount,
          originalAmount,
          title: `${exp.title} (Cota ${splitPercent.toFixed(0)}%)`,
          category: exp.category,
          rfbAccountCode: exp.rfb_account_code || 'ALUGUEL_CONDOMINIO',
          isShared: true,
          splitPercent,
          notes: exp.notes,
          origin: 'SHARED',
        });
      }
    } else if (exp.scope !== 'CLINIC' && exp.psychologist_id === psychologistId) {
      // Despesa direta/individual do psicólogo
      expenses.push({
        id: exp.id,
        date: dateOnly,
        amount: originalAmount,
        originalAmount,
        title: exp.title,
        category: exp.category,
        rfbAccountCode: exp.rfb_account_code || 'DESPESAS_GERAIS',
        isShared: false,
        splitPercent: 100,
        notes: exp.notes,
        origin: 'DIRECT',
      });
    }
  }

  // 2. Taxas de Sublocação / Espaço deduzidas nos lotes de Repasse fechados
  const repasseBatches = queryAll<any>(
    `SELECT rb.id, rb.batch_number, rb.period_start, rb.period_end, rb.payment_date,
            rb.total_sessions_count, rb.gross_total_amount, rb.net_repasse_amount
     FROM repasse_batches rb
     WHERE rb.psychologist_id = ?
       AND rb.status = 'PAID'
       AND (rb.payment_date LIKE ? OR (rb.payment_date IS NULL AND rb.period_end LIKE ?))`,
    [psychologistId, `${filterPrefix}%`, `${filterPrefix}%`]
  );

  for (const batch of repasseBatches) {
    const retained = Math.max(0, Number(batch.gross_total_amount || 0) - Number(batch.net_repasse_amount || 0));
    if (retained > 0) {
      const pDate = (batch.payment_date || batch.period_end || `${filterPrefix}-28`).split(' ')[0];
      expenses.push({
        id: 900000 + batch.id,
        date: pDate,
        amount: retained,
        originalAmount: retained,
        title: `Taxa de Sublocação e Uso de Espaço Clínico (${batch.batch_number || `Lote #${batch.id}`})`,
        category: 'SUBLOCACAO_CLINICA',
        rfbAccountCode: 'ALUGUEL_SUBLOCACAO',
        isShared: false,
        splitPercent: 100,
        notes: `Retenção contratual de sala referente ao Lote de Repasse de Honorários`,
        origin: 'SUBLOCACAO_CLINICA',
      });
    }
  }

  return expenses;
}

/**
 * Calcula a competência mensal completa do Carnê-Leão com transporte de prejuízo do ano
 */
export function calculateCarneLeaoCompetence(psychologistId: number, year: number, month: number): CarneLeaoSummary {
  const user = queryOne<any>(`SELECT id, name, crp_number FROM users WHERE id = ?`, [psychologistId]) || {
    id: psychologistId,
    name: 'Psicólogo Responsável',
    crp_number: 'CRP 06/128945-SP',
  };

  const settings = getFiscalSettings(psychologistId);

  // 1. Processar transporte de prejuízo de Janeiro até o mês anterior (mesmo ano-calendário)
  let carriedOverDeficit = 0;

  for (let m = 1; m < month; m++) {
    const prevRevenues = getRevenuesForMonth(psychologistId, year, m);
    const prevExpenses = getExpensesForMonth(psychologistId, year, m);

    const prevTotalRev = prevRevenues.reduce((acc, r) => acc + r.amount, 0);
    const prevTotalExp = prevExpenses.reduce((acc, e) => acc + e.amount, 0);

    // Saldo do mês anterior considerando o déficit que já vinha antes
    const netPrev = prevTotalRev - (prevTotalExp + carriedOverDeficit);
    if (netPrev < 0) {
      carriedOverDeficit = Math.abs(netPrev);
    } else {
      carriedOverDeficit = 0;
    }
  }

  // 2. Apurar mês atual
  const revenues = getRevenuesForMonth(psychologistId, year, month);
  const expenses = getExpensesForMonth(psychologistId, year, month);

  const totalRevenues = revenues.reduce((acc, r) => acc + r.amount, 0);
  const totalDeductibleExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  const coworkingRoomDeductions = expenses
    .filter((e) => e.origin === 'SUBLOCACAO_CLINICA')
    .reduce((acc, e) => acc + e.amount, 0);

  // Saldo operacional do livro caixa
  const netLivroCaixaBalance = totalRevenues - (totalDeductibleExpenses + carriedOverDeficit);

  // Déficit para o próximo mês (se mês for Dezembro/12, a lei não permite transportar para o ano seguinte)
  const nextMonthCarryOverDeficit = month === 12 ? 0 : Math.max(0, -netLivroCaixaBalance);

  // 3. Deduções Pessoais Legais
  // INSS Autônomo
  let inssDeduction = 0;
  if (settings.inss_mode === 'STANDARD_20') {
    // 20% sobre o rendimento bruto, limitado ao teto do INSS (R$ 7.786,02 -> R$ 1.557,20 em 2024/2025/2026)
    const baseInss = Math.min(totalRevenues, 7786.02);
    inssDeduction = baseInss * 0.20;
  } else if (settings.inss_mode === 'SIMPLIFIED_11') {
    // 11% sobre o salário mínimo (R$ 1.412,00 -> R$ 155,32)
    inssDeduction = 1412.00 * 0.11;
  } else if (settings.inss_mode === 'CUSTOM_FIXED') {
    inssDeduction = settings.inss_custom_amount || 0;
  }

  // Dependentes Legais: R$ 189,59 por dependente
  const dependentsDeduction = (settings.dependents_count || 0) * 189.59;
  const totalPersonalDeductions = inssDeduction + dependentsDeduction;

  // Base de Cálculo do IRPF
  const totalLivroCaixaAbatido = Math.min(totalRevenues, totalDeductibleExpenses + carriedOverDeficit);
  const taxableAfterLivroCaixa = Math.max(0, totalRevenues - totalLivroCaixaAbatido);
  const taxBase = Math.max(0, taxableAfterLivroCaixa - totalPersonalDeductions);

  const totalCombinedDeductions = totalLivroCaixaAbatido + totalPersonalDeductions;

  // 4. Aplicação da Tabela Progressiva do IRPF
  const irpfCalc = applyProgressiveTableIRPF(taxBase);
  const isBelowMinThreshold = irpfCalc.calculatedTax > 0 && irpfCalc.calculatedTax < 10.00;
  const finalDarfAmount = isBelowMinThreshold ? 0 : irpfCalc.calculatedTax;

  const dueDateObj = getLastBusinessDayOfNextMonth(year, month);

  const monthFormatted = String(month).padStart(2, '0');

  return {
    psychologist: {
      id: user.id,
      name: user.name,
      crp: settings.crp || user.crp_number || 'CRP 06/128945-SP',
      cpf: settings.cpf || '000.000.000-00',
      cboCode: settings.cbo_code || '2251-05',
    },
    competence: {
      year,
      month,
      label: `${monthFormatted}/${year}`,
    },
    settings,
    revenues,
    totalRevenues,
    expenses,
    totalDeductibleExpenses,
    coworkingRoomDeductions,
    carriedOverDeficitFromPreviousMonths: carriedOverDeficit,
    netLivroCaixaBalance,
    nextMonthCarryOverDeficit,
    inssDeduction,
    dependentsDeduction,
    totalPersonalDeductions,
    totalCombinedDeductions,
    taxBase,
    darf: {
      taxableAmount: taxBase,
      aliquotPercent: irpfCalc.aliquotPercent,
      deductionParcel: irpfCalc.deductionParcel,
      calculatedTax: irpfCalc.calculatedTax,
      isBelowMinThreshold,
      finalDarfAmount,
      revenueCode: '0190',
      dueDate: dueDateObj.iso,
      dueDateFormatted: dueDateObj.formatted,
      notes: isBelowMinThreshold 
        ? 'Imposto apurado inferior a R$ 10,00. Pela regra da Receita Federal, o valor deve ser acumulado para recolhimento na próxima competência em que atingir R$ 10,00.'
        : `DARF para recolhimento do IRPF Mensal Carnê-Leão até ${dueDateObj.formatted}.`,
    },
  };
}

/**
 * Gera arquivo CSV oficial de Rendimentos homologado para o Carnê-Leão Web (e-CAC)
 */
export function generateRendimentosCsv(summary: CarneLeaoSummary): string {
  const headers = [
    'Data do Lancamento',
    'Codigo do Rendimento',
    'Codigo da Ocupacao',
    'Valor Recebido',
    'Valor da Deducao',
    'Historico',
    'Recebido de',
    'CPF do Titular do Pagamento',
    'CNPJ',
    'CPF do Beneficiario do Servico',
  ].join(';');

  const rows = summary.revenues.map((r) => {
    // Data DD/MM/AAAA
    const parts = r.date.split('-');
    const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : r.date;
    const valorFormatted = r.amount.toFixed(2).replace('.', ',');
    const desc = (r.description || 'Honorarios de Servicos Psicologicos').replace(/;/g, ' ');

    return [
      dateFormatted,
      '1', // Código rendimento trabalho não assalariado
      summary.psychologist.cboCode || '2251-05',
      valorFormatted,
      '0,00',
      desc,
      'PF',
      r.payerCpf,
      '', // CNPJ vazio para PF
      r.patientCpf || r.payerCpf,
    ].join(';');
  });

  return [headers, ...rows].join('\r\n');
}

/**
 * Gera arquivo CSV oficial de Despesas/Pagamentos homologado para o Carnê-Leão Web (e-CAC)
 */
export function generateDespesasCsv(summary: CarneLeaoSummary): string {
  const headers = [
    'Data do Pagamento',
    'Codigo da Conta',
    'Valor Pago',
    'Historico',
    'CPF/CNPJ do Favorecido',
  ].join(';');

  const rows = summary.expenses.map((e) => {
    const parts = e.date.split('-');
    const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : e.date;
    const valorFormatted = e.amount.toFixed(2).replace('.', ',');
    const desc = (e.title || 'Despesa Escriturada Livro-Caixa').replace(/;/g, ' ');

    // Mapeamento para contas oficiais do Carnê-Leão Web
    let rfbCode = '3000'; // Despesas gerais de custeio
    if (e.rfbAccountCode === 'ALUGUEL_SUBLOCACAO' || e.rfbAccountCode === 'ALUGUEL_CONDOMINIO') {
      rfbCode = '3010'; // Aluguel e condomínio
    } else if (e.rfbAccountCode === 'ENERGIA_AGUA_TEL') {
      rfbCode = '3020'; // Água, luz, telefone, internet
    } else if (e.rfbAccountCode === 'CRP_ANUIDADE') {
      rfbCode = '3040'; // Contribuições a conselhos profissionais
    } else if (e.rfbAccountCode === 'HONORARIOS_SECRETARIA') {
      rfbCode = '3050'; // Remuneração de terceiros com vínculo empregatício
    }

    return [
      dateFormatted,
      rfbCode,
      valorFormatted,
      desc,
      '00000000000', // Documento padrão do fornecedor
    ].join(';');
  });

  return [headers, ...rows].join('\r\n');
}

/**
 * Gera payload completo do Dossiê Fiscal com Selo Criptográfico SHA-256
 */
export function generateDossierData(summary: CarneLeaoSummary, clinicSettings: any) {
  const hashRaw = `${summary.psychologist.cpf}|${summary.competence.label}|${summary.totalRevenues.toFixed(2)}|${summary.totalDeductibleExpenses.toFixed(2)}|${summary.darf.finalDarfAmount.toFixed(2)}|${summary.darf.dueDate}`;
  const sha256 = generateSHA256(hashRaw);

  return {
    ...summary,
    clinic: {
      name: clinicSettings?.clinic_name || 'PsicoGestão Consultórios',
      cnpj: clinicSettings?.cnpj || '00.000.000/0001-00',
      address: clinicSettings?.address || 'São Paulo - SP',
      phone: clinicSettings?.phone || '(11) 99999-9999',
      logo: clinicSettings?.logo_base64 || null,
    },
    verification: {
      hashSha256: sha256,
      generatedAt: new Date().toISOString(),
      legalTerms: 'Demonstrativo e Livro-Caixa digital apurado em conformidade com o Decreto Federal nº 9.580/2018 (RIR/2018, Art. 75), Instrução Normativa RFB nº 1.500/2014 e Instrução Normativa RFB nº 1.531/2015 para fins de recolhimento do Carnê-Leão e guarda fiscal obrigatória por 5 (cinco) anos.',
    },
  };
}
