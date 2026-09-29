import type { SystemPreset, StandardPatientFields } from './types.js';

export function normalizeHeaderString(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export const SYSTEM_PRESETS: SystemPreset[] = [
  {
    id: 'psicomanager',
    name: 'PsicoManager',
    description: 'Exportação padrão de pacientes em CSV/XLSX do PsicoManager',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    matchHeaders: [
      'telefone principal',
      'whats',
      'responsavel',
      'observacoes',
      'cpf responsavel',
      'grau de parentesco'
    ],
    columnAliases: {
      fullName: ['nome', 'nome completo', 'paciente', 'nome do paciente', 'cliente'],
      cpf: ['cpf', 'documento', 'cpf do paciente'],
      phone: ['telefone principal', 'celular', 'whatsapp', 'whats', 'telefone', 'contato'],
      email: ['e-mail', 'email', 'correio eletronico'],
      birthDate: ['data de nascimento', 'nascimento', 'data nasc', 'data nasc.', 'dt nascimento'],
      rg: ['rg', 'identidade', 'registro geral'],
      gender: ['genero', 'sexo'],
      profession: ['profissao', 'ocupacao', 'cargo'],
      street: ['endereco', 'logradouro', 'rua'],
      number: ['numero', 'nº', 'num'],
      complement: ['complemento', 'apto', 'bloco'],
      neighborhood: ['bairro'],
      city: ['cidade', 'municipio'],
      state: ['estado', 'uf'],
      cep: ['cep', 'codigo postal'],
      guardianName: ['responsavel', 'nome do responsavel', 'mae', 'nome da mae', 'pai', 'tutor'],
      guardianPhone: ['telefone responsavel', 'celular responsavel', 'whats responsavel', 'telefone da mae'],
      guardianCpf: ['cpf responsavel', 'cpf do responsavel', 'cpf da mae'],
      guardianRelationship: ['parentesco', 'grau de parentesco', 'vinculo'],
      notes: ['observacoes', 'notas', 'anotacoes', 'queixa', 'historico']
    }
  },
  {
    id: 'iclinic',
    name: 'Doctoralia / iClinic',
    description: 'Exportação oficial de cadastros da plataforma Doctoralia e iClinic',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    matchHeaders: [
      'nome completo',
      'celular',
      'nome da mae',
      'prontuario',
      'convenio',
      'codigo do paciente'
    ],
    columnAliases: {
      fullName: ['nome completo', 'nome', 'paciente', 'cliente'],
      cpf: ['cpf', 'cpf/cnpj', 'documento'],
      phone: ['celular', 'telefone celular', 'telefone', 'whatsapp', 'telefone 1'],
      email: ['email', 'e-mail'],
      birthDate: ['data nascimento', 'data de nascimento', 'dt. nascimento', 'nascimento'],
      rg: ['rg', 'identidade'],
      gender: ['sexo', 'genero'],
      profession: ['profissao', 'ocupacao'],
      street: ['endereco', 'logradouro', 'rua'],
      number: ['numero', 'n'],
      complement: ['complemento'],
      neighborhood: ['bairro'],
      city: ['cidade'],
      state: ['estado', 'uf'],
      cep: ['cep'],
      guardianName: ['nome da mae', 'nome do pai', 'responsavel', 'responsavel legal'],
      guardianPhone: ['telefone da mae', 'celular da mae', 'telefone do responsavel', 'celular responsavel'],
      guardianCpf: ['cpf da mae', 'cpf do responsavel'],
      guardianRelationship: ['parentesco', 'relacao'],
      notes: ['observacao', 'observacoes', 'anotacoes', 'observacoes gerais']
    }
  },
  {
    id: 'feegow',
    name: 'Feegow Clinic',
    description: 'Exportação de prontuários e pacientes Feegow Clinic',
    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    matchHeaders: [
      'paciente',
      'telefone 1',
      'responsavel legal',
      'cpf/documento',
      'dt nasc',
      'cartao nacional saude'
    ],
    columnAliases: {
      fullName: ['paciente', 'nome do paciente', 'nome'],
      cpf: ['cpf', 'documento', 'cpf/documento'],
      phone: ['telefone 1', 'celular 1', 'telefone celular', 'whatsapp', 'telefone principal'],
      email: ['e-mail', 'email'],
      birthDate: ['dt nasc', 'data nasc', 'data de nascimento', 'nascimento'],
      rg: ['rg', 'documento identidade'],
      gender: ['sexo', 'genero'],
      profession: ['profissao', 'cargo'],
      street: ['logradouro', 'endereco', 'rua'],
      number: ['numero', 'num'],
      complement: ['complemento'],
      neighborhood: ['bairro'],
      city: ['cidade', 'municipio'],
      state: ['uf', 'estado'],
      cep: ['cep'],
      guardianName: ['responsavel legal', 'responsavel', 'nome responsavel', 'mae'],
      guardianPhone: ['telefone responsavel', 'celular responsavel'],
      guardianCpf: ['cpf responsavel', 'documento responsavel'],
      guardianRelationship: ['grau parentesco', 'parentesco'],
      notes: ['observacoes', 'obs', 'anotacoes adicionais']
    }
  },
  {
    id: 'zenklub',
    name: 'Zenklub / Vittude',
    description: 'Exportação de atendidos de plataformas de telepsicologia',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    matchHeaders: [
      'cliente',
      'e-mail corporativo',
      'plano',
      'beneficio',
      'empresa',
      'status atendimento'
    ],
    columnAliases: {
      fullName: ['cliente', 'nome completo', 'nome', 'paciente'],
      cpf: ['cpf', 'documento'],
      phone: ['telefone', 'whatsapp', 'celular', 'contato'],
      email: ['e-mail', 'email', 'e-mail corporativo'],
      birthDate: ['data de nascimento', 'nascimento', 'data nasc'],
      rg: ['rg'],
      gender: ['genero', 'sexo'],
      profession: ['cargo', 'profissao', 'ocupacao'],
      street: ['endereco', 'rua'],
      number: ['numero'],
      complement: ['complemento'],
      neighborhood: ['bairro'],
      city: ['cidade'],
      state: ['uf', 'estado'],
      cep: ['cep'],
      guardianName: ['responsavel', 'tutor'],
      guardianPhone: ['telefone responsavel', 'celular responsavel'],
      guardianCpf: ['cpf responsavel'],
      guardianRelationship: ['parentesco'],
      notes: ['observacoes', 'notas']
    }
  }
];

export const GENERIC_PRESET: SystemPreset = {
  id: 'generic',
  name: 'Planilha Personalizada (Excel / CSV)',
  description: 'Mapeamento inteligente de colunas customizadas',
  badgeColor: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  matchHeaders: [],
  columnAliases: {
    fullName: ['nome', 'paciente', 'cliente', 'nome completo', 'full name', 'fullname'],
    cpf: ['cpf', 'documento', 'doc', 'tax id'],
    phone: ['telefone', 'celular', 'whatsapp', 'whats', 'contato', 'tel', 'phone', 'mobile'],
    email: ['email', 'e-mail', 'mail'],
    birthDate: ['nascimento', 'data nascimento', 'data de nascimento', 'dt nasc', 'birth date', 'dob'],
    rg: ['rg', 'identidade', 'documento identidade'],
    gender: ['sexo', 'genero', 'gender'],
    profession: ['profissao', 'ocupacao', 'cargo', 'profession'],
    street: ['endereco', 'logradouro', 'rua', 'address', 'street'],
    number: ['numero', 'nº', 'num', 'number'],
    complement: ['complemento', 'apto', 'complement'],
    neighborhood: ['bairro', 'neighborhood'],
    city: ['cidade', 'municipio', 'city'],
    state: ['estado', 'uf', 'state'],
    cep: ['cep', 'codigo postal', 'zip', 'postal code'],
    guardianName: ['responsavel', 'mae', 'pai', 'tutor', 'guardian', 'parent'],
    guardianPhone: ['telefone responsavel', 'celular responsavel', 'guardian phone'],
    guardianCpf: ['cpf responsavel', 'guardian cpf'],
    guardianRelationship: ['parentesco', 'relationship'],
    notes: ['observacoes', 'obs', 'notas', 'anotacoes', 'notes']
  }
};

/**
 * Detecta o preset mais provável com base nos cabeçalhos da planilha
 */
export function detectSystemPreset(fileHeaders: string[]): {
  preset: SystemPreset;
  confidence: number;
  isAutoMatched: boolean;
} {
  const normalizedFileHeaders = fileHeaders.map(normalizeHeaderString);

  let bestPreset = GENERIC_PRESET;
  let maxScore = 0;

  for (const preset of SYSTEM_PRESETS) {
    if (preset.matchHeaders.length === 0) continue;

    let matchedSpecific = 0;
    for (const matchH of preset.matchHeaders) {
      const normMatch = normalizeHeaderString(matchH);
      if (normalizedFileHeaders.some(h => h.includes(normMatch) || normMatch.includes(h))) {
        matchedSpecific++;
      }
    }

    // Calcula cobertura de cabeçalhos de assinatura do software
    const specificRatio = matchedSpecific / preset.matchHeaders.length;

    // Também verifica se tem colunas essenciais
    let essentialMatches = 0;
    const essentials: Array<keyof StandardPatientFields> = ['fullName', 'cpf', 'phone', 'birthDate'];
    for (const field of essentials) {
      const aliases = preset.columnAliases[field].map(normalizeHeaderString);
      if (normalizedFileHeaders.some(fh => aliases.includes(fh))) {
        essentialMatches++;
      }
    }
    const essentialRatio = essentialMatches / essentials.length;

    const totalScore = specificRatio * 0.7 + essentialRatio * 0.3;

    if (totalScore > maxScore) {
      maxScore = totalScore;
      bestPreset = preset;
    }
  }

  // Se atingir 60% ou mais de confiança nos identificadores, considera auto-reconhecido
  const isAutoMatched = maxScore >= 0.55 && bestPreset.id !== 'generic';

  return {
    preset: isAutoMatched ? bestPreset : GENERIC_PRESET,
    confidence: Math.min(1, Math.round(maxScore * 100) / 100),
    isAutoMatched
  };
}

/**
 * Monta o mapeamento inicial de colunas para um conjunto de cabeçalhos
 */
export function generateInitialColumnMapping(
  fileHeaders: string[],
  preset: SystemPreset
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedFileHeaders = fileHeaders.map(h => ({
    original: h,
    normalized: normalizeHeaderString(h)
  }));

  const allFields = Object.keys(preset.columnAliases) as Array<keyof StandardPatientFields>;

  for (const field of allFields) {
    const aliases = preset.columnAliases[field].map(normalizeHeaderString);
    const found = normalizedFileHeaders.find(h => aliases.includes(h.normalized));
    if (found) {
      mapping[field] = found.original;
    } else {
      // Tenta correspondência parcial
      const partial = normalizedFileHeaders.find(h =>
        aliases.some(alias => h.normalized.includes(alias) || (alias.length > 3 && alias.includes(h.normalized)))
      );
      if (partial) {
        mapping[field] = partial.original;
      }
    }
  }

  return mapping;
}
