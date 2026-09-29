export interface NormalizedAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
}

export interface NormalizedGuardian {
  fullName: string;
  cpf?: string;
  phone?: string;
  relationship?: string;
}

export interface NormalizedFinancialResponsible {
  isSameAsGuardian?: boolean;
  fullName?: string;
  cpf?: string;
  phone?: string;
  relationship?: string;
}

export interface NormalizedPatientData {
  fullName: string;
  cpf?: string;
  phone?: string;
  email?: string;
  birthDate?: string | null; // ISO YYYY-MM-DD
  groupType: 'Criança' | 'Adolescente' | 'Adulto' | 'Idoso';
  rg?: string;
  gender?: string;
  profession?: string;
  address?: NormalizedAddress;
  guardian?: NormalizedGuardian;
  financialResponsible?: NormalizedFinancialResponsible;
  notesBasic?: string;
  pendingDocs?: boolean;
  missingGuardian?: boolean;
  sourceRowIndex?: number;
}

export interface SystemPreset {
  id: string;
  name: string;
  description: string;
  badgeColor: string;
  matchHeaders: string[];
  columnAliases: Record<keyof StandardPatientFields, string[]>;
}

export interface StandardPatientFields {
  fullName: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string;
  rg: string;
  gender: string;
  profession: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  guardianName: string;
  guardianPhone: string;
  guardianCpf: string;
  guardianRelationship: string;
  notes: string;
}

export interface ColumnMappingConfig {
  [standardFieldKey: string]: string; // standardFieldKey -> fileHeader
}

export interface DryRunMetrics {
  totalRows: number;
  validPatients: NormalizedPatientData[];
  newPatientsCount: number;
  enrichedCount: number;
  pendingDocsCount: number;
  childrenCount: number;
  detectedSystem: {
    id: string;
    name: string;
    confidence: number;
    badgeColor: string;
  };
  samplePatients: NormalizedPatientData[];
  warnings: Array<{ row: number; name?: string; message: string }>;
  headers: string[];
  rawRowsCount: number;
}

export interface MigrationExecutionResult {
  success: boolean;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  pendingDocsCount: number;
  sourceSystem: string;
  errors: Array<{ row: number; name?: string; reason: string }>;
  samplePatients: Array<{
    name: string;
    cpf?: string;
    phone?: string;
    birthDate?: string;
    groupType: string;
    guardianName?: string;
    status: 'NOVO' | 'ENRIQUECIDO' | 'PENDENCIA';
  }>;
}
