// Verification test for Neuropsychological Structured Reports, Psychometrics and CID-11 Hypotheses
import { getPercentileClassification } from '../src/data/neuropsychCatalog.js';
import { DIAGNOSTIC_HYPOTHESES_CATALOG, COMMON_SATEPSI_TESTS } from '../src/data/neuropsychCatalog.js';

async function runTests() {
  console.log('--- 1. Testing Psychometric Classification Engine ---');
  
  const testCases = [
    { p: 99, expected: 'Muito Superior' },
    { p: 94, expected: 'Superior' },
    { p: 80, expected: 'Médio Superior' },
    { p: 50, expected: 'Médio' },
    { p: 15, expected: 'Médio Inferior' },
    { p: 5, expected: 'Limítrofe' },
    { p: 1, expected: 'Deficitário / Muito Baixo' },
  ];

  for (const tc of testCases) {
    const res = getPercentileClassification(tc.p);
    console.log(`Percentil ${tc.p} => ${res.label} (color: ${res.color})`);
    if (res.label !== tc.expected) {
      throw new Error(`Expected ${tc.expected}, got ${res.label}`);
    }
  }
  console.log('✓ All classification ranges verified successfully!\n');

  console.log('--- 2. Testing Diagnostic Catalog & SATEPSI Presets ---');
  console.log(`Loaded ${DIAGNOSTIC_HYPOTHESES_CATALOG.length} diagnostic hypotheses in catalog.`);
  console.log(`Loaded ${COMMON_SATEPSI_TESTS.length} SATEPSI battery presets.`);
  if (DIAGNOSTIC_HYPOTHESES_CATALOG.length < 5 || COMMON_SATEPSI_TESTS.length < 5) {
    throw new Error('Catalog is missing expected items');
  }
  console.log('✓ Catalogs verified!\n');

  console.log('--- 3. Testing API End-to-End Persistence ---');
  // Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@psicogestao.com.br', password: 'senha123' })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) throw new Error('Login failed');
  const token = loginData.token;
  console.log('✓ Admin authenticated successfully.');

  // Create a patient or find one
  const patientsRes = await fetch('http://localhost:3000/api/patients', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const patientsData = await patientsRes.json();
  const patient = patientsData.patients?.[0];
  if (!patient) throw new Error('No patients found in DB');

  // Create test evaluation
  const createRes = await fetch('http://localhost:3000/api/evaluations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      patient_id: patient.id,
      title: 'Avaliação Neuropsicológica Teste - Automação',
      total_price: 2500,
      payment_mode: 'A_VISTA',
      estimated_sessions: 6,
      hypothesis_diagnosis: 'TDAH Desatento (CID-11: 6A05.0)',
      installments: [{ installment_number: 1, amount: 2500, due_date: '2026-09-30', payment_method: 'PIX' }]
    })
  });
  const createData = await createRes.json();
  if (!createData.evaluation_id) throw new Error('Failed to create evaluation: ' + JSON.stringify(createData));
  const evalId = createData.evaluation_id;
  console.log(`✓ Test Evaluation created with ID: #${evalId}`);

  // Save Draft with psychometric tests and hypotheses
  const psychometricTests = [
    {
      id: 'test_1',
      testName: 'WISC-IV',
      domain: 'Compreensão Verbal (ICV)',
      standardScore: 98,
      percentile: 45,
      classification: 'Médio'
    },
    {
      id: 'test_2',
      testName: 'WISC-IV',
      domain: 'Memória Operacional (IMO)',
      standardScore: 76,
      percentile: 6,
      classification: 'Limítrofe'
    },
    {
      id: 'test_3',
      testName: 'BPA',
      domain: 'Atenção Concentrada (AC)',
      standardScore: 92,
      percentile: 30,
      classification: 'Médio'
    }
  ];

  const draftPayload = {
    draft_report_content: {
      identificacao: {
        paciente: patient.full_name,
        cpf: patient.cpf || '123.456.789-00',
        nascimento: '2015-05-10',
        responsavel: 'Responsável Legal Teste',
        solicitante: 'Encaminhamento Pediátrico',
        finalidade: 'Investigação de atenção e aprendizagem'
      },
      demanda: 'Dificuldades atencionais e desorganização.',
      procedimento: 'Baterias WISC-IV e BPA aplicadas.',
      analise: 'Análise detalhada por domínios cognitivos.',
      conclusao: 'Quadro compatível com TDAH Desatento (CID-11: 6A05.0).',
      recomendacoes: '1. Adaptações pedagógicas.\n2. Treino executivo.',
      psychometricTests,
      selectedHypotheses: ['tdah-desatento']
    }
  };

  const updateRes = await fetch(`http://localhost:3000/api/evaluations/${evalId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(draftPayload)
  });
  const updateData = await updateRes.json();
  if (!updateData.success) throw new Error('Failed to update evaluation draft');
  console.log('✓ Draft saved with psychometric tests and hypotheses.');

  // Fetch back and verify
  const getRes = await fetch(`http://localhost:3000/api/evaluations/${evalId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const getData = await getRes.json();
  const loadedContent = getData.evaluation?.draft_document?.content;
  if (!loadedContent) throw new Error('No draft_document content returned');
  if (loadedContent.psychometricTests?.length !== 3) {
    throw new Error(`Expected 3 psychometric tests, found ${loadedContent.psychometricTests?.length}`);
  }
  if (!loadedContent.selectedHypotheses?.includes('tdah-desatento')) {
    throw new Error('Hypothesis tdah-desatento not persisted');
  }
  console.log(`✓ Verification confirmed: 3 psychometric tests and hypotheses loaded correctly.`);

  // Complete and Sign
  const completeRes = await fetch(`http://localhost:3000/api/evaluations/${evalId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      status: 'COMPLETED',
      final_report_content: draftPayload.draft_report_content
    })
  });
  const completeData = await completeRes.json();
  if (!completeData.success || !completeData.hash_sha256) {
    throw new Error('Completion and signing failed: ' + JSON.stringify(completeData));
  }
  console.log(`✓ Evaluation #${evalId} successfully completed and signed!`);
  console.log(`✓ Cryptographic SHA-256 Seal: ${completeData.hash_sha256}`);

  // Clean up
  const deleteRes = await fetch(`http://localhost:3000/api/evaluations/${evalId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('✓ Test evaluation cleaned up.\n');
  console.log('🎉 ALL AUTOMATED TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
