export const replaceDocumentVariables = (
  html: string,
  patient: any,
  psychologist: any
): string => {
  if (!html) return '';

  const today = new Date().toLocaleDateString('pt-BR');
  
  let result = html;
  
  // Patient variables
  if (patient) {
    result = result.replace(/@paciente\.nome/g, patient.full_name || '');
    result = result.replace(/@paciente\.cpf/g, patient.cpf || 'N/A');
    
    if (patient.birth_date) {
      const birthDate = new Date(patient.birth_date);
      const age = new Date().getFullYear() - birthDate.getFullYear();
      result = result.replace(/@paciente\.data_nascimento/g, birthDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }));
      result = result.replace(/@paciente\.idade/g, age.toString());
    } else {
      result = result.replace(/@paciente\.data_nascimento/g, 'N/A');
      result = result.replace(/@paciente\.idade/g, 'N/A');
    }
  }

  // Clinic/Psychologist variables
  if (psychologist) {
    result = result.replace(/@clinica\.nome_profissional/g, psychologist.name || '');
    result = result.replace(/@clinica\.crp/g, psychologist.crp_number || 'N/A');
  }

  // Common variables
  result = result.replace(/@data\.hoje/g, today);

  return result;
};
