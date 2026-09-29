/**
 * Utilitário central de roteamento, higienização e geração de mensagens WhatsApp
 * para Pacientes, Responsáveis Legais e Responsáveis Financeiros.
 */

export type WhatsAppRecipientType = 'PATIENT' | 'GUARDIAN' | 'FINANCIAL_RESPONSIBLE';

export interface WhatsAppRecipientInfo {
  type: WhatsAppRecipientType;
  label: string;
  fullName: string;
  phone: string;
  cleanPhone: string;
  relationship?: string;
  hasPhone: boolean;
  isDefault?: boolean;
}

/**
 * Remove caracteres não numéricos e garante o DDI 55 do Brasil
 */
export function cleanWhatsAppPhone(rawPhone?: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return digits;
}

/**
 * Resolve todos os destinatários disponíveis para um paciente de acordo com a finalidade
 */
export function resolveAvailableRecipients(
  patient: any,
  purpose: 'APPOINTMENT' | 'BILLING' | 'INVOICE'
): WhatsAppRecipientInfo[] {
  if (!patient) return [];

  const list: WhatsAppRecipientInfo[] = [];

  // 1. Paciente
  const patientPhone = patient.phone || '';
  const patientClean = cleanWhatsAppPhone(patientPhone);
  list.push({
    type: 'PATIENT',
    label: 'Paciente',
    fullName: patient.full_name || patient.patient_name || 'Paciente',
    phone: patientPhone,
    cleanPhone: patientClean,
    hasPhone: Boolean(patientClean && patientClean.length >= 10),
  });

  // 2. Responsável Legal
  const guardian = patient.guardian;
  if (guardian && (guardian.fullName || guardian.phone)) {
    const gPhone = guardian.phone || '';
    const gClean = cleanWhatsAppPhone(gPhone);
    list.push({
      type: 'GUARDIAN',
      label: 'Responsável Legal',
      fullName: guardian.fullName || 'Responsável Legal',
      phone: gPhone,
      cleanPhone: gClean,
      relationship: guardian.relationship || 'Responsável',
      hasPhone: Boolean(gClean && gClean.length >= 10),
    });
  }

  // 3. Responsável Financeiro (apenas para Cobrança ou Nota Fiscal)
  if (purpose === 'BILLING' || purpose === 'INVOICE') {
    const finResp = patient.financial_responsible;
    if (finResp && !finResp.isSameAsGuardian && (finResp.fullName || finResp.phone)) {
      const fPhone = finResp.phone || '';
      const fClean = cleanWhatsAppPhone(fPhone);
      list.push({
        type: 'FINANCIAL_RESPONSIBLE',
        label: 'Responsável Financeiro',
        fullName: finResp.fullName || 'Responsável Financeiro',
        phone: fPhone,
        cleanPhone: fClean,
        relationship: finResp.relationship || 'Financeiro',
        hasPhone: Boolean(fClean && fClean.length >= 10),
      });
    }
  }

  // Determinar qual é o padrão configurado
  const defaultType = getDefaultRecipientType(patient, purpose);
  return list.map((item) => ({
    ...item,
    isDefault: item.type === defaultType,
  }));
}

/**
 * Retorna o tipo de destinatário padrão de acordo com as preferências ou fallback inteligente
 */
export function getDefaultRecipientType(
  patient: any,
  purpose: 'APPOINTMENT' | 'BILLING' | 'INVOICE'
): WhatsAppRecipientType {
  if (!patient) return 'PATIENT';

  const routing = patient.whatsapp_routing;
  const hasGuardian = Boolean(patient.guardian?.phone && patient.guardian.phone.trim());
  const isMinor = patient.group === 'Criança' || patient.group === 'Adolescente';

  if (purpose === 'APPOINTMENT') {
    if (routing?.appointmentChannel) {
      return routing.appointmentChannel;
    }
    return isMinor && hasGuardian ? 'GUARDIAN' : 'PATIENT';
  }

  // Cobrança ou NF
  if (routing?.financialChannel) {
    return routing.financialChannel;
  }
  return isMinor && hasGuardian ? 'GUARDIAN' : 'PATIENT';
}

/**
 * Monta o link do WhatsApp para abertura via Web ou Desktop
 */
export function buildWhatsAppLink(cleanPhone: string, message: string): string {
  const encodedText = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}
