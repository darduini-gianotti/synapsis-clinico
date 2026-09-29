import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type {
  NormalizedPatientData,
  DryRunMetrics,
  NormalizedAddress,
  NormalizedGuardian,
  NormalizedFinancialResponsible,
} from './types.js';

/**
 * Validação matemática algorítmica de CPF (Módulo 11)
 */
export function isValidCPF(cpf: string): boolean {
  if (!cpf) return false;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;

  // Rejeita sequências repetidas (000.000.000-00, etc.)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(10), 10)) return false;

  return true;
}

/**
 * Saneia CPF, recompleta zeros cortados pelo Excel e formata XXX.XXX.XXX-XX
 */
export function sanitizeAndFormatCpf(rawCpf?: any): {
  formatted?: string;
  cleanDigits?: string;
  isValid: boolean;
} {
  if (!rawCpf) return { isValid: false };
  const str = String(rawCpf).trim();
  let digits = str.replace(/\D/g, '');

  if (!digits) return { isValid: false };

  // Recompleta zero à esquerda cortado pelo Excel caso tenha entre 9 e 10 dígitos
  if (digits.length >= 9 && digits.length < 11) {
    digits = digits.padStart(11, '0');
  }

  if (digits.length === 11) {
    const valid = isValidCPF(digits);
    return {
      formatted: `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`,
      cleanDigits: digits,
      isValid: valid,
    };
  }

  return {
    formatted: str,
    cleanDigits: digits,
    isValid: false,
  };
}

/**
 * Normaliza datas do Excel (número serial ou strings DD/MM/YYYY, YYYY-MM-DD)
 */
export function normalizeDate(rawDate?: any): string | null {
  if (rawDate === undefined || rawDate === null || rawDate === '') return null;

  // Número serial do Excel (ex: 44927 -> 01/01/2023)
  if (typeof rawDate === 'number' || (!isNaN(Number(rawDate)) && !String(rawDate).includes('/') && !String(rawDate).includes('-'))) {
    const serial = Number(rawDate);
    if (serial > 1000 && serial < 80000) {
      // 25569 é o offset entre 01/01/1970 e 01/01/1900 no Excel
      const utcDays = serial - 25569;
      const date = new Date(utcDays * 86400 * 1000);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const cleaned = String(rawDate).trim();
  if (!cleaned) return null;

  // DD/MM/YYYY ou D/M/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
    const parts = cleaned.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.substring(0, 10);
  }

  return null;
}

/**
 * Normaliza telefone para formato brasileiro legível
 */
export function normalizePhone(rawPhone?: any): string | undefined {
  if (!rawPhone) return undefined;
  const str = String(rawPhone).trim();
  const digits = str.replace(/\D/g, '');

  // Remove DDI 55 se houver (12 ou 13 dígitos começando com 55)
  let localDigits = digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    localDigits = digits.substring(2);
  }

  if (localDigits.length === 11) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
  }
  if (localDigits.length === 10) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
  }

  return str || undefined;
}

/**
 * Determina faixa etária baseada na data de nascimento
 */
export function determineGroupType(birthDateIso?: string | null): 'Criança' | 'Adolescente' | 'Adulto' | 'Idoso' {
  if (!birthDateIso) return 'Adulto';
  try {
    const bDate = new Date(birthDateIso);
    if (isNaN(bDate.getTime())) return 'Adulto';
    const today = new Date();
    let age = today.getFullYear() - bDate.getFullYear();
    const m = today.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
      age--;
    }
    if (age < 12) return 'Criança';
    if (age < 18) return 'Adolescente';
    if (age >= 60) return 'Idoso';
    return 'Adulto';
  } catch {
    return 'Adulto';
  }
}

/**
 * Lê o arquivo bruto (.xlsx, .xls, .csv, .txt) e devolve a lista de cabeçalhos e linhas brutas
 */
export async function parseRawFile(file: File): Promise<{
  headers: string[];
  rawRows: Array<Record<string, any>>;
  fileName: string;
  fileType: 'xlsx' | 'csv';
}> {
  const isExcel =
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel');

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: false, // Vamos converter datas seriais com precisão manualmente
    });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
      raw: true,
    });

    if (rawRows.length === 0) {
      return { headers: [], rawRows: [], fileName: file.name, fileType: 'xlsx' };
    }

    const headers = Object.keys(rawRows[0] || {});
    return { headers, rawRows, fileName: file.name, fileType: 'xlsx' };
  } else {
    // CSV / TXT / TSV
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, any>>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        dynamicTyping: false,
        delimiter: '', // auto-detect
        complete: (results) => {
          const rawRows = results.data || [];
          const headers = results.meta.fields || (rawRows[0] ? Object.keys(rawRows[0]) : []);
          resolve({ headers, rawRows, fileName: file.name, fileType: 'csv' });
        },
        error: (err) => {
          reject(new Error(`Falha ao ler arquivo CSV: ${err.message}`));
        },
      });
    });
  }
}

/**
 * Converte linhas brutas da planilha em pacientes normalizados segundo o mapeamento De-Para
 */
export function normalizeRowsWithMapping(
  rawRows: Array<Record<string, any>>,
  mapping: Record<string, string>
): {
  normalizedPatients: NormalizedPatientData[];
  warnings: Array<{ row: number; name?: string; message: string }>;
  pendingDocsCount: number;
  childrenCount: number;
} {
  const normalizedPatients: NormalizedPatientData[] = [];
  const warnings: Array<{ row: number; name?: string; message: string }> = [];
  let pendingDocsCount = 0;
  let childrenCount = 0;

  let rowIndex = 1;

  for (const row of rawRows) {
    rowIndex++;

    // Obtém valor a partir do header mapeado
    const getValue = (key: string): string => {
      const headerName = mapping[key];
      if (!headerName || row[headerName] === undefined || row[headerName] === null) return '';
      return String(row[headerName]).trim();
    };

    const fullName = getValue('fullName');

    // Se a linha não tiver nome, ignora com aviso
    if (!fullName || fullName.length < 2) {
      warnings.push({
        row: rowIndex,
        message: 'Linha ignorada: coluna de Nome do Paciente vazia.',
      });
      continue;
    }

    // CPF
    const rawCpf = getValue('cpf');
    const cpfResult = sanitizeAndFormatCpf(rawCpf);

    let pendingDocs = false;
    if (!cpfResult.isValid) {
      pendingDocs = true;
      pendingDocsCount++;
    }

    // Data de Nascimento & Faixa Etária
    const rawBirthDate = getValue('birthDate');
    const normalizedBirthDate = normalizeDate(rawBirthDate);
    const groupType = determineGroupType(normalizedBirthDate);

    if (groupType === 'Criança' || groupType === 'Adolescente') {
      childrenCount++;
    }

    // Telefones & Contatos
    const phone = normalizePhone(getValue('phone'));
    const email = getValue('email') || undefined;
    const rg = getValue('rg') || undefined;
    const gender = getValue('gender') || undefined;
    const profession = getValue('profession') || undefined;
    const notesBasic = getValue('notes') || undefined;

    // Endereço
    const street = getValue('street');
    const number = getValue('number');
    const complement = getValue('complement');
    const neighborhood = getValue('neighborhood');
    const city = getValue('city');
    const state = getValue('state');
    const cep = getValue('cep');

    let address: NormalizedAddress | undefined = undefined;
    if (street || city || cep || neighborhood) {
      address = {
        street: street || undefined,
        number: number || undefined,
        complement: complement || undefined,
        neighborhood: neighborhood || undefined,
        city: city || 'São Paulo',
        state: state || 'SP',
        cep: cep || undefined,
      };
    }

    // Responsável
    const guardianName = getValue('guardianName');
    const guardianPhone = normalizePhone(getValue('guardianPhone')) || phone;
    const guardianCpfResult = sanitizeAndFormatCpf(getValue('guardianCpf'));
    const guardianRelationship = getValue('guardianRelationship') || (groupType === 'Criança' ? 'Mãe' : 'Responsável');

    let guardian: NormalizedGuardian | undefined = undefined;
    let financialResponsible: NormalizedFinancialResponsible | undefined = undefined;

    let missingGuardian = false;
    if (guardianName) {
      guardian = {
        fullName: guardianName,
        cpf: guardianCpfResult.formatted || undefined,
        phone: guardianPhone,
        relationship: guardianRelationship,
      };
      financialResponsible = {
        isSameAsGuardian: true,
        fullName: guardianName,
        cpf: guardianCpfResult.formatted || undefined,
        phone: guardianPhone,
        relationship: guardianRelationship,
      };
    } else if (groupType === 'Criança') {
      missingGuardian = true;
      warnings.push({
        row: rowIndex,
        name: fullName,
        message: 'Paciente menor de 12 anos sem indicação explícita de responsável na planilha.',
      });
    }

    normalizedPatients.push({
      fullName,
      cpf: cpfResult.formatted || undefined,
      phone,
      email,
      birthDate: normalizedBirthDate,
      groupType,
      rg,
      gender,
      profession,
      address,
      guardian,
      financialResponsible,
      notesBasic,
      pendingDocs,
      missingGuardian,
      sourceRowIndex: rowIndex,
    });
  }

  return {
    normalizedPatients,
    warnings,
    pendingDocsCount,
    childrenCount,
  };
}

/**
 * Calcula a telemetria de simulação (Dry Run) comparando com a base de pacientes já cadastrados
 */
export function buildDryRunMetrics(
  rawRows: Array<Record<string, any>>,
  headers: string[],
  mapping: Record<string, string>,
  detectedSystem: { id: string; name: string; confidence: number; badgeColor: string },
  existingPatientsList: Array<{ cpf?: string; full_name?: string }> = []
): DryRunMetrics {
  const { normalizedPatients, warnings, pendingDocsCount, childrenCount } = normalizeRowsWithMapping(rawRows, mapping);

  // Indexa existentes por CPF limpo e por nome em minúsculo
  const existingCpfs = new Set<string>();
  const existingNames = new Set<string>();

  for (const p of existingPatientsList) {
    if (p.cpf) {
      const clean = p.cpf.replace(/\D/g, '');
      if (clean) existingCpfs.add(clean);
    }
    if (p.full_name) {
      existingNames.add(p.full_name.trim().toLowerCase());
    }
  }

  let newPatientsCount = 0;
  let enrichedCount = 0;

  for (const patient of normalizedPatients) {
    const cleanCpf = patient.cpf ? patient.cpf.replace(/\D/g, '') : '';
    const nameNorm = patient.fullName.trim().toLowerCase();

    const isExisting = (cleanCpf && existingCpfs.has(cleanCpf)) || existingNames.has(nameNorm);
    if (isExisting) {
      enrichedCount++;
    } else {
      newPatientsCount++;
    }
  }

  return {
    totalRows: normalizedPatients.length,
    validPatients: normalizedPatients,
    newPatientsCount,
    enrichedCount,
    pendingDocsCount,
    childrenCount,
    detectedSystem,
    samplePatients: normalizedPatients.slice(0, 5),
    warnings,
    headers,
    rawRowsCount: rawRows.length,
  };
}
