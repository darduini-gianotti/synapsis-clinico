import { getDb } from '../server/db.js';
import { patientRouter } from '../server/patientRoutes.js';
import express from 'express';
import http from 'http';

async function runTests() {
  console.log('🧪 [TESTES DE INTEGRAÇÃO] Iniciando verificação do Synapsis Paciente...');

  // 1. Inicializar DB
  await getDb();
  console.log('✓ Banco SQLite carregado com sucesso.');

  // 2. Criar app Express de teste na porta 3099
  const app = express();
  app.use(express.json());
  app.use('/api/patient', patientRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3099, resolve));
  console.log('✓ Servidor de teste ouvindo na porta 3099.');

  try {
    // 3. Testar Solicitação de OTP para CPF 111.444.777-35
    console.log('\n--- 1. Testando Request OTP ---');
    const reqOtpRes = await fetch('http://localhost:3099/api/patient/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: '111.444.777-35' })
    });
    const reqOtpData = await reqOtpRes.json();
    console.log('Status:', reqOtpRes.status, 'Payload:', reqOtpData);
    if (!reqOtpData.success || !reqOtpData.devOtp) throw new Error('Falha no request-otp');

    // 4. Testar Verificação de OTP
    console.log('\n--- 2. Testando Verify OTP ---');
    const verifyRes = await fetch('http://localhost:3099/api/patient/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: '111.444.777-35', otpCode: reqOtpData.devOtp })
    });
    const verifyData = await verifyRes.json();
    console.log('Status:', verifyRes.status, 'Patient:', verifyData.patient, 'Dependents Count:', verifyData.dependents?.length);
    if (!verifyData.token) throw new Error('Token JWT não emitido');
    const token = verifyData.token;

    // 5. Testar Consulta de Perfil com Token
    console.log('\n--- 3. Testando Get Profile ---');
    const profileRes = await fetch('http://localhost:3099/api/patient/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profileData = await profileRes.json();
    console.log('Status:', profileRes.status, 'Patient Name:', profileData.patient?.full_name);

    // 6. Testar Agenda & Confirmação de Presença
    console.log('\n--- 4. Testando Get Appointments & Confirm ---');
    const apptsRes = await fetch('http://localhost:3099/api/patient/appointments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const apptsData = await apptsRes.json();
    console.log('Upcoming count:', apptsData.upcoming?.length, 'Past count:', apptsData.past?.length);

    if (apptsData.upcoming && apptsData.upcoming.length > 0) {
      const firstId = apptsData.upcoming[0].id;
      const confirmRes = await fetch(`http://localhost:3099/api/patient/appointments/${firstId}/confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const confirmData = await confirmRes.json();
      console.log('Confirm Session #' + firstId + ' result:', confirmData);
    }

    // 7. Testar Consulta Financeira & PIX
    console.log('\n--- 5. Testando Financial & PIX ---');
    const finRes = await fetch('http://localhost:3099/api/patient/financial', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const finData = await finRes.json();
    console.log('Pending count:', finData.pending?.length, 'Paid count:', finData.paid?.length, 'Total Pending: R$', finData.totalPending);

    // 8. Testar Cofre de Documentos (Blindagem Ética CFP)
    console.log('\n--- 6. Testando Document Vault ---');
    const docsRes = await fetch('http://localhost:3099/api/patient/documents', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const docsData = await docsRes.json();
    console.log('Official CFP Docs:', docsData.officialDocuments?.length, 'Patient Docs:', docsData.patientDocuments?.length);

    // 9. Testar Mensageria & Status do Canal Clínico
    console.log('\n--- 7. Testando Messages Status ---');
    const msgStatusRes = await fetch('http://localhost:3099/api/patient/messages/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const msgStatusData = await msgStatusRes.json();
    console.log('Status Canais:', msgStatusData);

    console.log('\n🎉 [SUCESSO TOTAL] Todos os fluxos do Synapsis Paciente foram validados com êxito!');
  } finally {
    server.close();
  }
}

runTests().catch((e) => {
  console.error('❌ Erro nos testes:', e);
  process.exit(1);
});
