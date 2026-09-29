import Papa from 'papaparse';
import { queryOne, queryAll, execute } from '../db.js';
import { isValidCPF } from '../validators.js';

export interface ImportPatientResult {
  success: boolean;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; name?: string; reason: string }>;
  samplePatients: Array<{
    name: string;
    cpf?: string;
    phone?: string;
    birthDate?: string;
    groupType: string;
    guardianName?: string;
  }>;
}

/**
 * Normaliza datas brasileiras DD/MM/YYYY ou ISO YYYY-MM-DD para YYYY-MM-DD
 */
function normalizeDate(rawDate?: string): string | null {
  if (!rawDate) return null;
  const cleaned = rawDate.trim();
  if (!cleaned) return null;

  // DD/MM/YYYY
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
 * Normaliza e formata CPF
 */
function cleanCpf(rawCpf?: string): string {
  if (!rawCpf) return '';
  const digits = rawCpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
  return rawCpf.trim();
}

/**
 * Calcula a faixa etária baseada na data de nascimento
 */
function determineGroupType(birthDateIso?: string | null): 'Criança' | 'Adolescente' | 'Adulto' | 'Idoso' {
  if (!birthDateIso) return 'Adulto';
  try {
    const bDate = new Date(birthDateIso);
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
 * Encontra a melhor chave correspondente no objeto do CSV independente de case ou acentos
 */
function findValue(row: Record<string, any>, possibleKeys: string[]): string {
  const rowKeys = Object.keys(row);
  for (const key of possibleKeys) {
    const normalizedKey = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const found = rowKeys.find(
      k => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalizedKey
    );
    if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
}

/**
 * Processa e importa arquivo CSV exportado do PsicoManager
 */
export function importPsicoManagerCsv(csvContent: string, psychologistId: number = 1): ImportPatientResult {
  const result: ImportPatientResult = {
    success: true,
    totalRows: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    samplePatients: [],
  };

  const parsed = Papa.parse<Record<string, any>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    delimiter: '', // Detecção automática de vírgula ou ponto e vírgula
  });

  if (parsed.errors && parsed.errors.length > 0) {
    const criticalError = parsed.errors.find(e => e.type === 'Delimiter');
    if (criticalError) {
      result.success = false;
      result.errors.push({ row: 0, reason: `Erro ao detectar delimitador do arquivo CSV: ${criticalError.message}` });
      return result;
    }
  }

  const rows = parsed.data || [];
  result.totalRows = rows.length;

  if (rows.length === 0) {
    result.success = false;
    result.errors.push({ row: 0, reason: 'O arquivo CSV está vazio ou não possui linhas de dados válidas.' });
    return result;
  }

  let rowIndex = 1;

  for (const row of rows) {
    rowIndex++;

    // Extrai nome do paciente
    const fullName = findValue(row, [
      'Nome',
      'Nome Completo',
      'Paciente',
      'Nome do Paciente',
      'full_name',
      'Cliente',
    ]);

    if (!fullName) {
      result.skipped++;
      result.errors.push({
        row: rowIndex,
        reason: 'Linha ignorada: coluna de Nome do Paciente não encontrada ou vazia.',
      });
      continue;
    }

    // Extrai dados cadastrais
    const rawCpf = findValue(row, ['CPF', 'Cpf', 'Documento']);
    const formattedCpf = cleanCpf(rawCpf);

    const rawBirthDate = findValue(row, ['Data de Nascimento', 'Nascimento', 'Data Nasc.', 'Data Nasc', 'birth_date']);
    const normalizedBirthDate = normalizeDate(rawBirthDate);
    const groupType = determineGroupType(normalizedBirthDate);

    const phone = findValue(row, ['Telefone', 'Celular', 'WhatsApp', 'Whats', 'Telefone Principal', 'Contato', 'phone']);
    const email = findValue(row, ['E-mail', 'Email', 'email']);
    const rg = findValue(row, ['RG', 'Rg', 'Identidade']);
    const gender = findValue(row, ['Gênero', 'Sexo', 'gender']);
    const profession = findValue(row, ['Profissão', 'Profissao', 'Ocupação', 'Cargo']);
    const notesBasic = findValue(row, ['Observações', 'Observacoes', 'Notas', 'Queixa', 'Anotações']);

    // Endereço
    const street = findValue(row, ['Endereço', 'Endereco', 'Logradouro', 'Rua']);
    const number = findValue(row, ['Número', 'Numero', 'Nº']);
    const complement = findValue(row, ['Complemento', 'Apto', 'Bloco']);
    const neighborhood = findValue(row, ['Bairro']);
    const city = findValue(row, ['Cidade', 'Município']);
    const state = findValue(row, ['Estado', 'UF', 'Uf']);
    const cep = findValue(row, ['CEP', 'Cep']);

    let addressJson: string | null = null;
    if (street || city || cep) {
      addressJson = JSON.stringify({
        street,
        number,
        complement,
        neighborhood,
        city: city || 'São Paulo',
        state: state || 'SP',
        cep,
      });
    }

    // Responsável (Pai / Mãe / Tutor para menores)
    const guardianName = findValue(row, [
      'Responsável',
      'Responsavel',
      'Nome do Responsável',
      'Nome Responsável',
      'Mãe',
      'Pai',
      'Tutor',
    ]);
    const guardianCpf = cleanCpf(findValue(row, ['CPF Responsável', 'CPF do Responsável', 'CPF Responsavel']));
    const guardianPhone = findValue(row, ['Telefone Responsável', 'Celular Responsável', 'Whats Responsável']);
    const guardianRelationship = findValue(row, ['Parentesco', 'Grau de Parentesco']) || (groupType === 'Criança' ? 'Mãe' : 'Responsável');

    let guardianJson: string | null = null;
    let financialResponsibleJson: string | null = null;

    if (guardianName) {
      const guardObj = {
        fullName: guardianName,
        cpf: guardianCpf || undefined,
        phone: guardianPhone || phone,
        relationship: guardianRelationship,
      };
      guardianJson = JSON.stringify(guardObj);

      financialResponsibleJson = JSON.stringify({
        isSameAsGuardian: true,
        fullName: guardianName,
        cpf: guardianCpf || undefined,
        phone: guardianPhone || phone,
        relationship: guardianRelationship,
      });
    }

    // Amostra para conferência visual na UI (primeiros 5)
    if (result.samplePatients.length < 5) {
      result.samplePatients.push({
        name: fullName,
        cpf: formattedCpf || undefined,
        phone: phone || undefined,
        birthDate: normalizedBirthDate || undefined,
        groupType,
        guardianName: guardianName || undefined,
      });
    }

    // Verifica se paciente já existe para não duplicar (busca por CPF se houver ou por Nome exato)
    let existingPatient: any = null;
    if (formattedCpf && formattedCpf.length >= 11) {
      existingPatient = queryOne<any>('SELECT id FROM patients WHERE cpf = ?', [formattedCpf]);
    }
    if (!existingPatient) {
      existingPatient = queryOne<any>('SELECT id FROM patients WHERE LOWER(full_name) = ?', [fullName.toLowerCase()]);
    }

    const consentDate = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (existingPatient) {
      // Atualiza campos cadastrais preservando dados já existentes
      execute(
        `UPDATE patients SET
           phone = COALESCE(NULLIF(phone, ''), ?),
           email = COALESCE(NULLIF(email, ''), ?),
           birth_date = COALESCE(NULLIF(birth_date, ''), ?),
           group_type = COALESCE(NULLIF(group_type, ''), ?),
           rg = COALESCE(NULLIF(rg, ''), ?),
           gender = COALESCE(NULLIF(gender, ''), ?),
           profession = COALESCE(NULLIF(profession, ''), ?),
           address_json = COALESCE(NULLIF(address_json, ''), ?),
           guardian_json = COALESCE(NULLIF(guardian_json, ''), ?),
           financial_responsible_json = COALESCE(NULLIF(financial_responsible_json, ''), ?)
         WHERE id = ?`,
        [
          phone,
          email,
          normalizedBirthDate,
          groupType,
          rg,
          gender,
          profession,
          addressJson,
          guardianJson,
          financialResponsibleJson,
          existingPatient.id,
        ]
      );
      result.updated++;
    } else {
      // Insere novo paciente
      execute(
        `INSERT INTO patients (
           psychologist_id, full_name, cpf, phone, status, lgpd_consent_at,
           birth_date, email, notes_basic, group_type, rg, gender,
           financial_plan_type, session_price, address_json, profession,
           guardian_json, financial_responsible_json
         ) VALUES (
           ?, ?, ?, ?, 'ACTIVE', ?,
           ?, ?, ?, ?, ?, ?,
           'Por Sessão', 180.00, ?, ?,
           ?, ?
         )`,
        [
          psychologistId,
          fullName,
          formattedCpf || null,
          phone || null,
          consentDate,
          normalizedBirthDate,
          email || null,
          notesBasic || null,
          groupType,
          rg || null,
          gender || null,
          addressJson,
          profession || null,
          guardianJson,
          financialResponsibleJson,
        ]
      );
      result.imported++;
    }
  }

  return result;
}
