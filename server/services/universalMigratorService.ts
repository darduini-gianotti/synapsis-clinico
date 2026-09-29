import { queryOne, execute, flushSaveDb } from '../db.js';

export interface BackendNormalizedPatient {
  fullName: string;
  cpf?: string;
  phone?: string;
  email?: string;
  birthDate?: string | null;
  groupType?: 'Criança' | 'Adolescente' | 'Adulto' | 'Idoso';
  rg?: string;
  gender?: string;
  profession?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
  };
  guardian?: {
    fullName: string;
    cpf?: string;
    phone?: string;
    relationship?: string;
  };
  financialResponsible?: {
    isSameAsGuardian?: boolean;
    fullName?: string;
    cpf?: string;
    phone?: string;
    relationship?: string;
  };
  notesBasic?: string;
  pendingDocs?: boolean;
}

export interface UniversalMigrationExecutionResult {
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

/**
 * Executa a persistência atômica da migração universal com merge não-destrutivo
 */
export function executeUniversalMigration(
  patients: BackendNormalizedPatient[],
  sourceSystem: string = 'Personalizado',
  psychologistId: number = 1
): UniversalMigrationExecutionResult {
  const result: UniversalMigrationExecutionResult = {
    success: true,
    totalRows: patients.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    pendingDocsCount: 0,
    sourceSystem,
    errors: [],
    samplePatients: [],
  };

  if (!patients || patients.length === 0) {
    result.success = false;
    result.errors.push({ row: 0, reason: 'Nenhum paciente enviado para migração.' });
    return result;
  }

  const consentDate = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Início da transação atômica
  execute('BEGIN TRANSACTION');

  try {
    let rowIndex = 0;

    for (const patient of patients) {
      rowIndex++;

      const fullName = (patient.fullName || '').trim();
      if (!fullName || fullName.length < 2) {
        result.skipped++;
        result.errors.push({
          row: rowIndex,
          reason: 'Linha ignorada: Nome do paciente inválido ou em branco.',
        });
        continue;
      }

      const formattedCpf = patient.cpf ? patient.cpf.trim() : null;
      const cleanDigits = formattedCpf ? formattedCpf.replace(/\D/g, '') : '';
      const hasValidCpf = cleanDigits.length === 11;

      if (!hasValidCpf) {
        result.pendingDocsCount++;
      }

      const birthDate = patient.birthDate || null;
      const groupType = patient.groupType || 'Adulto';
      const phone = patient.phone || null;
      const email = patient.email || null;
      const rg = patient.rg || null;
      const gender = patient.gender || null;
      const profession = patient.profession || null;
      const notesBasic = patient.notesBasic || null;

      const addressJson = patient.address ? JSON.stringify(patient.address) : null;
      const guardianJson = patient.guardian ? JSON.stringify(patient.guardian) : null;
      const financialResponsibleJson = patient.financialResponsible
        ? JSON.stringify(patient.financialResponsible)
        : guardianJson;

      // 1. Procura paciente pré-existente para merge não-destrutivo
      let existingPatient: any = null;
      if (hasValidCpf) {
        existingPatient = queryOne<any>('SELECT id, cpf, full_name FROM patients WHERE cpf = ?', [formattedCpf]);
      }
      if (!existingPatient) {
        existingPatient = queryOne<any>('SELECT id, cpf, full_name FROM patients WHERE LOWER(full_name) = ?', [
          fullName.toLowerCase(),
        ]);
      }

      if (existingPatient) {
        // MERGE NÃO-DESTRUTIVO: Atualiza apenas o que estava vazio/nulo
        execute(
          `UPDATE patients SET
             cpf = COALESCE(NULLIF(cpf, ''), ?),
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
            formattedCpf,
            phone,
            email,
            birthDate,
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

        if (result.samplePatients.length < 8) {
          result.samplePatients.push({
            name: fullName,
            cpf: formattedCpf || undefined,
            phone: phone || undefined,
            birthDate: birthDate || undefined,
            groupType,
            guardianName: patient.guardian?.fullName || undefined,
            status: 'ENRIQUECIDO',
          });
        }
      } else {
        // INSERÇÃO DE NOVO PACIENTE
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
            formattedCpf,
            phone,
            consentDate,
            birthDate,
            email,
            notesBasic,
            groupType,
            rg,
            gender,
            addressJson,
            profession,
            guardianJson,
            financialResponsibleJson,
          ]
        );

        result.imported++;

        if (result.samplePatients.length < 8) {
          result.samplePatients.push({
            name: fullName,
            cpf: formattedCpf || undefined,
            phone: phone || undefined,
            birthDate: birthDate || undefined,
            groupType,
            guardianName: patient.guardian?.fullName || undefined,
            status: hasValidCpf ? 'NOVO' : 'PENDENCIA',
          });
        }
      }
    }

    // Commit da transação atômica
    execute('COMMIT');
    flushSaveDb();
  } catch (err: any) {
    try {
      execute('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erro ao executar rollback:', rollbackErr);
    }
    console.error('Falha crítica na migração atômica de pacientes:', err);
    result.success = false;
    result.errors.push({
      row: 0,
      reason: `Falha na transação do banco de dados: ${err.message || String(err)}`,
    });
  }

  return result;
}
