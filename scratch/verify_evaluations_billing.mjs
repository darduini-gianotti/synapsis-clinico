// scratch/verify_evaluations_billing.mjs
const BASE_URL = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  console.log('🚀 Iniciando Testes de Cobranças de Avaliações e PIX...\n');

  // 1. Login Admin
  console.log('1. Autenticando como Administrador...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@psicogestao.com.br', password: 'senha123' }),
  });
  if (loginRes.status !== 200 || !loginRes.data?.token) {
    throw new Error(`Falha no login: ${JSON.stringify(loginRes.data)}`);
  }
  const adminToken = loginRes.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('✅ Admin autenticado com sucesso.\n');

  // 2. Atualizar PIX da Clínica
  console.log('2. Atualizando Chave PIX Oficial da Clínica...');
  const updatePixRes = await request('/clinic-settings', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      clinic_name: 'Clínica PsicoGestão SP',
      pix_key: 'financeiro@psicogestao.com.br',
      pix_key_type: 'EMAIL',
      pix_beneficiary: 'Clínica Integrada PsicoGestão Ltda',
      bank_info: 'Banco Cora (403) • Agência 0001 • C/C 88776-5',
    }),
  });
  if (updatePixRes.status !== 200) {
    throw new Error(`Erro ao atualizar PIX da clínica: ${JSON.stringify(updatePixRes.data)}`);
  }
  console.log('✅ Chave PIX atualizada via PUT /clinic-settings.\n');

  // 3. Verificar persistência do PIX
  console.log('3. Validando persistência via GET /clinic-settings...');
  const getSettingsRes = await request('/clinic-settings', { headers: adminHeaders });
  const settings = getSettingsRes.data?.settings;
  if (
    settings?.pix_key !== 'financeiro@psicogestao.com.br' ||
    settings?.pix_key_type !== 'EMAIL' ||
    settings?.pix_beneficiary !== 'Clínica Integrada PsicoGestão Ltda' ||
    settings?.bank_info !== 'Banco Cora (403) • Agência 0001 • C/C 88776-5'
  ) {
    throw new Error(`Dados de PIX retornados não conferem: ${JSON.stringify(settings)}`);
  }
  console.log('✅ Chave PIX e dados bancários validados no banco de dados SQLite.\n');

  // 4. Criar Paciente para Avaliação com Responsável Financeiro
  console.log('4. Criando paciente para teste de cobrança de avaliação...');
  const uniqueNum = Date.now().toString().slice(-4);
  const patientRes = await request('/patients', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      full_name: `Paciente Teste Avaliação ${uniqueNum}`,
      cpf: `999.888.777-${uniqueNum.slice(-2)}`,
      phone: '(11) 98888-1122',
      session_price: 200,
      financial_responsible: {
        name: 'Carla Responsável Financeira',
        cpf: '111.222.333-44',
        phone: '(11) 97777-3344',
        relationship: 'Mãe',
      },
      whatsapp_routing: {
        billing_target: 'FINANCIAL_RESPONSIBLE',
      },
    }),
  });
  if (patientRes.status !== 201 || !patientRes.data?.patient_id) {
    throw new Error(`Erro ao criar paciente: ${JSON.stringify(patientRes.data)}`);
  }
  const patientId = patientRes.data.patient_id;
  console.log(`✅ Paciente criado com ID #${patientId}.\n`);

  // 5. Criar Avaliação Neuropsicológica com 3 parcelas (1 Paga, 1 Vencida, 1 Preventiva)
  console.log('5. Criando Avaliação Neuropsicológica com cronograma de 3 parcelas...');
  const today = new Date();
  const pastPaidDate = new Date(today.getTime() - 15 * 24 * 3600 * 1000).toISOString().substring(0, 10);
  const overdueDate = new Date(today.getTime() - 6 * 24 * 3600 * 1000).toISOString().substring(0, 10);
  const preventiveDate = new Date(today.getTime() + 3 * 24 * 3600 * 1000).toISOString().substring(0, 10);

  const evalRes = await request('/neuropsych-evaluations', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      patient_id: patientId,
      psychologist_id: 1,
      title: 'Avaliação Neuropsicológica Infantil',
      total_price: 2400.00,
      payment_mode: 'PARCELADO',
      installments_count: 3,
      installments: [
        { installment_number: 1, amount: 800.00, due_date: pastPaidDate, status: 'PAID' },
        { installment_number: 2, amount: 800.00, due_date: overdueDate, status: 'PENDING' },
        { installment_number: 3, amount: 800.00, due_date: preventiveDate, status: 'PENDING' },
      ],
    }),
  });

  let evalId = evalRes.data?.evaluation_id || evalRes.data?.id;
  console.log(`✅ Avaliação criada com sucesso (ID #${evalId}).\n`);

  // 6. Consultar GET /financial/billings-summary e validar segregação e régua
  console.log('6. Consultando GET /financial/billings-summary e validando régua de vencimento...');
  const summaryRes = await request('/financial/billings-summary', { headers: adminHeaders });
  if (summaryRes.status !== 200) {
    throw new Error(`Erro ao consultar billings-summary: ${JSON.stringify(summaryRes.data)}`);
  }

  const evalBillings = summaryRes.data?.evaluation_billings || [];
  const myEval = evalBillings.find((e) => e.patient_id === patientId);

  if (!myEval) {
    throw new Error(`Avaliação do paciente #${patientId} não encontrada em evaluation_billings!`);
  }

  console.log(`  - Título: ${myEval.title}`);
  console.log(`  - Total do Contrato: R$ ${myEval.total_price}`);
  console.log(`  - Parcelas Pagas: ${myEval.paid_installments_count}/${myEval.total_installments} (R$ ${myEval.paid_amount})`);
  console.log(`  - Parcelas Vencidas: ${myEval.overdue_installments_count} (R$ ${myEval.overdue_amount})`);
  console.log(`  - Parcelas Preventivas: ${myEval.preventive_installments_count} (R$ ${myEval.preventive_amount})`);
  console.log(`  - Total Ativo a Cobrar: R$ ${myEval.active_amount}`);
  console.log(`  - Badge de Contato Inicial: ${myEval.contact_badge?.badge} (${myEval.contact_badge?.label})`);

  if (myEval.paid_installments_count !== 1) {
    throw new Error(`Esperado 1 parcela paga, obtido: ${myEval.paid_installments_count}`);
  }
  if (myEval.overdue_installments_count !== 1) {
    throw new Error(`Esperado 1 parcela vencida, obtido: ${myEval.overdue_installments_count}`);
  }
  if (myEval.preventive_installments_count !== 1) {
    throw new Error(`Esperado 1 parcela preventiva, obtido: ${myEval.preventive_installments_count}`);
  }
  if (myEval.active_amount !== 1600.00) {
    throw new Error(`Esperado R$ 1600.00 ativo, obtido: ${myEval.active_amount}`);
  }
  if (myEval.contact_badge?.badge !== 'NEVER_CONTACTED') {
    throw new Error(`Esperado NEVER_CONTACTED, obtido: ${myEval.contact_badge?.badge}`);
  }
  console.log('✅ Régua de vencimento e cálculo financeiro do contrato validados com 100% de precisão.\n');

  // 7. Registrar Contato e Promessa de Pagamento
  console.log('7. Registrando contato com promessa de pagamento (POST /financial/billings/contact-log)...');
  const promiseDate = new Date(today.getTime() + 4 * 24 * 3600 * 1000).toISOString().substring(0, 10);
  const contactLogRes = await request('/financial/billings/contact-log', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      patient_id: patientId,
      evaluation_id: myEval.evaluation_id,
      contact_channel: 'WHATSAPP',
      recipient_type: 'FINANCIAL_RESPONSIBLE',
      recipient_name: 'Carla Responsável Financeira',
      recipient_phone: '(11) 97777-3344',
      template_type: 'EVAL_FRIENDLY_OVERDUE',
      agreement_date: promiseDate,
      agreement_notes: 'Mãe confirmou que pagará a 2ª parcela via PIX até quinta-feira.',
    }),
  });
  if (contactLogRes.status !== 201) {
    throw new Error(`Erro ao registrar log de contato: ${JSON.stringify(contactLogRes.data)}`);
  }
  console.log('✅ Contato e acordo de pagamento registrados com sucesso.\n');

  // 8. Re-consultar summary e verificar badge atualizado
  console.log('8. Re-consultando billings-summary para verificar badge de acordo ativo...');
  const summaryRes2 = await request('/financial/billings-summary', { headers: adminHeaders });
  const myEval2 = (summaryRes2.data?.evaluation_billings || []).find((e) => e.patient_id === patientId);
  console.log(`  - Novo Badge: ${myEval2?.contact_badge?.badge} (${myEval2?.contact_badge?.label})`);
  console.log(`  - Notas do Acordo: "${myEval2?.contact_badge?.agreement_notes}"`);

  if (myEval2?.contact_badge?.badge !== 'AGREEMENT_PENDING') {
    throw new Error(`Esperado AGREEMENT_PENDING, obtido: ${myEval2?.contact_badge?.badge}`);
  }
  console.log('✅ Badge de acordo de pagamento validado.\n');

  // 9. Consultar Histórico de Contatos
  console.log('9. Consultando histórico de contatos (GET /financial/billings/contact-history)...');
  const historyRes = await request(`/financial/billings/contact-history?patient_id=${patientId}`, {
    headers: adminHeaders,
  });
  if (historyRes.status !== 200 || !historyRes.data?.contacts?.length) {
    throw new Error(`Histórico de contatos vazio ou falhou: ${JSON.stringify(historyRes.data)}`);
  }
  console.log(`✅ ${historyRes.data.contacts.length} registro(s) encontrado(s) no histórico de cobrança.`);
  console.log(`  - Registrado por: ${historyRes.data.contacts[0].created_by_name}`);
  console.log(`  - Canal: ${historyRes.data.contacts[0].contact_channel}\n`);

  // 10. Quitar Parcela Vencida via Quitação Rápida
  console.log('10. Efetuando baixa rápida na parcela vencida...');
  const overdueInst = myEval2.installments.find((i) => i.status === 'OVERDUE');
  const settleRes = await request('/financial/settle-sessions', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      patient_id: patientId,
      payment_date: new Date().toISOString().substring(0, 10),
      payment_method: 'PIX',
      notes: 'Quitação rápida da parcela 2 após acerto via WhatsApp',
      settlements: [
        {
          session_id: -overdueInst.transaction_id,
          amount: overdueInst.amount,
        },
      ],
    }),
  });
  if (settleRes.status !== 200) {
    throw new Error(`Erro ao quitar parcela: ${JSON.stringify(settleRes.data)}`);
  }
  console.log('✅ Parcela vencida quitada com sucesso via /financial/settle-sessions.\n');

  // 11. Re-conferir que parcela agora é PAGA
  const summaryRes3 = await request('/financial/billings-summary', { headers: adminHeaders });
  const myEval3 = (summaryRes3.data?.evaluation_billings || []).find((e) => e.patient_id === patientId);
  console.log(`11. Situação pós-quitação:`);
  console.log(`  - Parcelas Pagas: ${myEval3?.paid_installments_count}/3`);
  console.log(`  - Parcelas Vencidas: ${myEval3?.overdue_installments_count}`);
  console.log(`  - Parcelas Preventivas: ${myEval3?.preventive_installments_count}`);

  if (myEval3?.paid_installments_count !== 2 || myEval3?.overdue_installments_count !== 0) {
    throw new Error('Falha na atualização de quitação da parcela!');
  }
  console.log('✅ Parcela atualizada com sucesso para PAGA no cronograma.\n');

  console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NO TESTE:', err.message);
  process.exit(1);
});
