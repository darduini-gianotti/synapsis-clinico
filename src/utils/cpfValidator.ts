import { PatientGroup, FinancialPlanType, GenderOption, EducationOption, RaceOption } from '../types.js';

/**
 * Validação do número de CPF de acordo com o algoritmo oficial da Receita Federal do Brasil (Módulo 11)
 */
export function validateCPF(cpfRaw: string | undefined | null): boolean {
  if (!cpfRaw) return false;
  
  // Limpa caracteres não numéricos
  const clean = cpfRaw.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  
  // Rejeita sequências com todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // Cálculo do 1º Dígito Verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let firstCheck = (sum * 10) % 11;
  if (firstCheck === 10 || firstCheck === 11) firstCheck = 0;
  if (firstCheck !== parseInt(clean.charAt(9), 10)) return false;

  // Cálculo do 2º Dígito Verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  let secondCheck = (sum * 10) % 11;
  if (secondCheck === 10 || secondCheck === 11) secondCheck = 0;
  if (secondCheck !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

/**
 * Máscara visual para CPF (000.000.000-00)
 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Máscara visual para Celular/WhatsApp ((00) 00000-0000 ou (00) 0000-0000)
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Máscara visual para CEP (00000-000)
 */
export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Formatação de moeda BRL (R$ 0,00)
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'R$ 0,00';
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Cálculo automático da Idade conforme a Data de Nascimento e sugestão de Grupo
 */
export function calculateAge(birthDateStr?: string | null): {
  years: number;
  months: number;
  text: string;
  suggestedGroup: PatientGroup;
} | null {
  if (!birthDateStr) return null;
  const parts = birthDateStr.split('-');
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const birth = new Date(year, month, day);
  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    years--;
  }

  if (years < 0) return null;

  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) {
    months--;
  }
  months = Math.max(0, months);

  let text = '';
  if (years === 0) {
    text = months <= 1 ? `${months} mês` : `${months} meses`;
  } else if (years === 1) {
    text = '1 ano';
  } else {
    text = `${years} anos`;
  }

  let suggestedGroup: PatientGroup = 'Adulto';
  if (years < 12) {
    suggestedGroup = 'Criança';
  } else if (years >= 12 && years <= 17) {
    suggestedGroup = 'Adolescente';
  } else if (years >= 60) {
    suggestedGroup = 'Idoso';
  } else {
    suggestedGroup = 'Adulto';
  }

  return { years, months, text, suggestedGroup };
}

// Opções pré-definidas conforme normas clínicas e conselhos
export const PATIENT_GROUPS: PatientGroup[] = ['Criança', 'Adolescente', 'Adulto', 'Idoso'];

export const FINANCIAL_PLANS: FinancialPlanType[] = ['Por Sessão', 'Mensal', 'Convênio', 'Isento'];

export const GENDER_OPTIONS: GenderOption[] = [
  'Mulher cisgênero',
  'Homem cisgênero',
  'Mulher transgênero',
  'Homem transgênero',
  'Não-binário',
  'Travesti',
  'Agênero',
  'Outro',
  'Prefiro não informar',
];

export const EDUCATION_OPTIONS: EducationOption[] = [
  'Não alfabetizado',
  'Ensino Fundamental Incompleto',
  'Ensino Fundamental Completo',
  'Ensino Médio Incompleto',
  'Ensino Médio Completo',
  'Ensino Superior Incompleto',
  'Ensino Superior Completo',
  'Pós-graduação / Especialização',
  'Mestrado',
  'Doutorado',
];

export const RACE_OPTIONS: RaceOption[] = [
  'Branca',
  'Preta',
  'Parda',
  'Amarela',
  'Indígena',
  'Outra / Não declarada',
];
