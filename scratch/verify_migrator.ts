import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { detectSystemPreset, generateInitialColumnMapping } from '../src/services/migrator/presets.js';
import {
  sanitizeAndFormatCpf,
  normalizeDate,
  normalizePhone,
  determineGroupType,
  normalizeRowsWithMapping,
} from '../src/services/migrator/universalParser.js';
import { executeUniversalMigration } from '../server/services/universalMigratorService.js';
import { getDb, queryAll, queryOne } from '../server/db.js';

async function runTests() {
  console.log('🚀 Iniciando bateria de testes do Migrador Universal v2.4...');

  // 1. GERAÇÃO DE FIXTURES DE TESTE SINTÉTICAS
  const scratchDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  // A) PsicoManager CSV Fixture
  const psicoCsvContent = [
    'Nome,CPF,Telefone Principal,Data de Nascimento,E-mail,Responsável,CPF Responsável,Grau de Parentesco,Observações',
    'Mariana Silva,12345678909,(11) 98765-4321,15/05/1990,mariana@email.com,,,,Atendimento adulto padrão',
    'Lucas Mendes,,(11) 97777-8888,10/08/2018,lucas@email.com,Clara Mendes,98765432100,Mãe,Queixa escolar - menor de idade',
    'João Oliveira,01234567890,11966665555,1955-03-20,joao@email.com,,,,Paciente idoso hipertenso',
  ].join('\n');
  fs.writeFileSync(path.join(scratchDir, 'test_psicomanager.csv'), psicoCsvContent, 'utf8');

  // B) Doctoralia / iClinic XLSX Fixture
  const iclinicData = [
    {
      'Nome Completo': 'Camila Rodrigues',
      'CPF': '23456789012',
      'Celular': '(11) 95555-4444',
      'Data Nascimento': 44927, // 01/01/2023 - Serial Excel
      'Email': 'camila@email.com',
      'Nome da Mãe': 'Beatriz Rodrigues',
      'Prontuário': 'IC-10023',
      'Convênio': 'Particular',
    },
    {
      'Nome Completo': 'Rafael Costa',
      'CPF': '34567890123',
      'Celular': '11944443333',
      'Data Nascimento': '22/11/1985',
      'Email': 'rafael@email.com',
      'Nome da Mãe': '',
      'Prontuário': 'IC-10024',
      'Convênio': 'Bradesco',
    },
  ];
  const wbIclinic = XLSX.utils.book_new();
  const wsIclinic = XLSX.utils.json_to_sheet(iclinicData);
  XLSX.utils.book_append_sheet(wbIclinic, wsIclinic, 'Pacientes');
  XLSX.writeFile(wbIclinic, path.join(scratchDir, 'test_iclinic.xlsx'));

  // C) Feegow Clinic XLSX Fixture
  const feegowData = [
    {
      'Paciente': 'Gabriela Fernandes',
      'CPF/Documento': '45678901234',
      'Telefone 1': '(21) 98888-1111',
      'Dt Nasc': '05/12/2010',
      'E-mail': 'gabriela@email.com',
      'Responsável Legal': 'Fernanda Fernandes',
      'Cartão Nacional Saúde': '898000112233',
    },
  ];
  const wbFeegow = XLSX.utils.book_new();
  const wsFeegow = XLSX.utils.json_to_sheet(feegowData);
  XLSX.utils.book_append_sheet(wbFeegow, wsFeegow, 'Cadastros');
  XLSX.writeFile(wbFeegow, path.join(scratchDir, 'test_feegow.xlsx'));

  // D) Zenklub CSV Fixture
  const zenklubCsv = [
    'Cliente,CPF,Telefone,E-mail Corporativo,Data de Nascimento,Status Atendimento,Benefício',
    'Thiago Santos,56789012345,11933332222,thiago@empresa.com,14/07/1988,Ativo,TotalPass',
  ].join('\n');
  fs.writeFileSync(path.join(scratchDir, 'test_zenklub.csv'), zenklubCsv, 'utf8');

  // E) Custom Excel Fixture
  const customData = [
    {
      'Cliente da Clínica': 'Priscila Alencar',
      'Doc': '67890123456',
      'WhatsApp Contato': '11922221111',
      'Nasc': '30/09/1995',
      'Correio': 'priscila@email.com',
    },
  ];
  const wbCustom = XLSX.utils.book_new();
  const wsCustom = XLSX.utils.json_to_sheet(customData);
  XLSX.utils.book_append_sheet(wbCustom, wsCustom, 'Clientes');
  XLSX.writeFile(wbCustom, path.join(scratchDir, 'test_custom.xlsx'));

  console.log('✅ Fixtures sintéticas criadas com sucesso em scratch/');

  // 2. TESTE DE DETECÇÃO AUTOMÁTICA DE PRESETS
  console.log('\n🔍 Testando algoritmo de detecção de Presets Homologados...');

  const headersPsico = ['Nome', 'CPF', 'Telefone Principal', 'Data de Nascimento', 'E-mail', 'Responsável', 'CPF Responsável', 'Grau de Parentesco'];
  const detPsico = detectSystemPreset(headersPsico);
  console.log(`- PsicoManager detectado: ${detPsico.preset.name} (Confiança: ${(detPsico.confidence * 100).toFixed(0)}%, Auto: ${detPsico.isAutoMatched})`);
  if (detPsico.preset.id !== 'psicomanager' || !detPsico.isAutoMatched) {
    throw new Error('Falha na detecção do preset PsicoManager!');
  }

  const headersIclinic = ['Nome Completo', 'CPF', 'Celular', 'Data Nascimento', 'Email', 'Nome da Mãe', 'Prontuário'];
  const detIclinic = detectSystemPreset(headersIclinic);
  console.log(`- iClinic detectado: ${detIclinic.preset.name} (Confiança: ${(detIclinic.confidence * 100).toFixed(0)}%, Auto: ${detIclinic.isAutoMatched})`);
  if (detIclinic.preset.id !== 'iclinic' || !detIclinic.isAutoMatched) {
    throw new Error('Falha na detecção do preset iClinic!');
  }

  const headersFeegow = ['Paciente', 'CPF/Documento', 'Telefone 1', 'Dt Nasc', 'E-mail', 'Responsável Legal', 'Cartão Nacional Saúde'];
  const detFeegow = detectSystemPreset(headersFeegow);
  console.log(`- Feegow detectado: ${detFeegow.preset.name} (Confiança: ${(detFeegow.confidence * 100).toFixed(0)}%, Auto: ${detFeegow.isAutoMatched})`);
  if (detFeegow.preset.id !== 'feegow' || !detFeegow.isAutoMatched) {
    throw new Error('Falha na detecção do preset Feegow!');
  }

  const headersZenklub = ['Cliente', 'CPF', 'Telefone', 'E-mail Corporativo', 'Data de Nascimento', 'Status Atendimento'];
  const detZenklub = detectSystemPreset(headersZenklub);
  console.log(`- Zenklub detectado: ${detZenklub.preset.name} (Confiança: ${(detZenklub.confidence * 100).toFixed(0)}%, Auto: ${detZenklub.isAutoMatched})`);
  if (detZenklub.preset.id !== 'zenklub' || !detZenklub.isAutoMatched) {
    throw new Error('Falha na detecção do preset Zenklub!');
  }

  const headersCustom = ['Cliente da Clínica', 'Doc', 'WhatsApp Contato', 'Nasc'];
  const detCustom = detectSystemPreset(headersCustom);
  console.log(`- Personalizado detectado: ${detCustom.preset.name} (Auto: ${detCustom.isAutoMatched})`);
  if (detCustom.preset.id !== 'generic') {
    throw new Error('Planilha customizada não deve ser forçada para preset de terceiro!');
  }

  // 3. TESTE DE NORMALIZAÇÃO DE CASOS DE BORDA (DATAS SERIAIS EXCEL & CPFS COM ZERO À ESQUERDA)
  console.log('\n🧪 Testando casos de borda de higienização e saneamento...');

  // Data serial do Excel
  const parsedDate = normalizeDate(44927);
  console.log(`- Data serial Excel 44927 normalizada para: ${parsedDate}`);
  if (parsedDate !== '2023-01-01') {
    throw new Error(`Erro na conversão de data serial do Excel: esperava 2023-01-01, obteve ${parsedDate}`);
  }

  // CPF com zero à esquerda cortado pelo Excel
  const cpfPad = sanitizeAndFormatCpf('1234567890'); // 10 dígitos -> 01234567890
  console.log(`- CPF 10 dígitos recompletado: ${cpfPad.formatted} (clean: ${cpfPad.cleanDigits})`);
  if (cpfPad.cleanDigits !== '01234567890') {
    throw new Error('Falha ao recompletar zero à esquerda de CPF cortado pelo Excel!');
  }

  // Faixa etária de menor
  const groupChild = determineGroupType('2018-05-10');
  console.log(`- Nasc 2018-05-10 classificado como: ${groupChild}`);
  if (groupChild !== 'Criança') {
    throw new Error(`Esperava Criança, obteve ${groupChild}`);
  }

  // 4. TESTE DA TRANSAÇÃO ATÔMICA E MERGE NÃO-DESTRUTIVO NO BANCO DE DADOS
  console.log('\n💾 Testando persistência atômica e merge não-destrutivo no SQLite...');
  await getDb();
  const { execute } = await import('../server/db.js');
  execute("DELETE FROM patients WHERE cpf = '111.444.777-35' OR full_name IN ('Teste Paciente Alfa', 'Menina Sofia Teste')");

  const testPatients = [
    {
      fullName: 'Teste Paciente Alfa',
      cpf: '111.444.777-35',
      phone: '(11) 99999-1111',
      birthDate: '1992-04-15',
      groupType: 'Adulto' as const,
      email: 'alfa@teste.com',
      profession: 'Engenheiro',
    },
    {
      fullName: 'Menina Sofia Teste',
      cpf: undefined, // Sem CPF -> Documentação pendente
      phone: '(11) 98888-2222',
      birthDate: '2020-02-10',
      groupType: 'Criança' as const,
      guardian: {
        fullName: 'Helena Teste Mãe',
        phone: '(11) 98888-2222',
        relationship: 'Mãe',
      },
    },
  ];

  // Inserção inicial
  const res1 = executeUniversalMigration(testPatients, 'TesteHomologacao', 1);
  console.log(`- Execução 1: ${res1.imported} criados, ${res1.updated} atualizados, pendências: ${res1.pendingDocsCount}`);
  if (res1.imported < 2) {
    throw new Error('Falha ao importar pacientes na execução 1!');
  }

  // Execução subsequente com dados complementares (Merge não-destrutivo)
  const testPatientsMerge = [
    {
      fullName: 'Teste Paciente Alfa',
      cpf: '111.444.777-35',
      phone: '(11) 99999-1111',
      rg: '12.345.678-9', // Novo campo preenchido
      address: {
        city: 'Campinas',
        state: 'SP',
      },
    },
  ];

  const res2 = executeUniversalMigration(testPatientsMerge, 'TesteMerge', 1);
  console.log(`- Execução 2 (Merge): ${res2.imported} criados, ${res2.updated} enriquecidos`);
  if (res2.updated !== 1) {
    throw new Error('Falha no merge não-destrutivo: paciente existente deveria ter sido atualizado!');
  }

  // Verifica no banco se o campo novo entrou e o antigo se manteve
  const pInDb = queryOne<any>('SELECT email, rg, address_json FROM patients WHERE cpf = ?', ['111.444.777-35']);
  console.log(`- Registro no banco após merge: Email preservado="${pInDb.email}", Novo RG="${pInDb.rg}"`);
  if (pInDb.email !== 'alfa@teste.com' || pInDb.rg !== '12.345.678-9') {
    throw new Error('Dados pré-existentes foram corrompidos no merge!');
  }

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! O Migrador Universal v2.4 está HOMOLOGADO.');
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NOS TESTES:', err);
  process.exit(1);
});
