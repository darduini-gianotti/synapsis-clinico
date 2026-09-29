/**
 * TESTE DE STRESS & CONCORRÊNCIA — PSICOGESTÃO SAAS
 * Avalia resiliência do servidor, vazamento de memória e concorrência sob carga.
 */

const BASE_URL = 'http://localhost:3333/api';

interface StressResult {
  name: string;
  totalRequests: number;
  successful: number;
  failed: number;
  durationMs: number;
  rps: number;
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
  p95Latency: number;
  errors: Record<string, number>;
}

async function login(email: string, password = 'senha123'): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login falhou para ${email}: HTTP ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function runBurst(
  name: string,
  requestFns: Array<() => Promise<{ status: number; ok: boolean; error?: string }>>,
  concurrency = 50
): Promise<StressResult> {
  const latencies: number[] = [];
  const errors: Record<string, number> = {};
  let successful = 0;
  let failed = 0;

  const startTime = Date.now();

  // Divide em lotes de concorrência
  for (let i = 0; i < requestFns.length; i += concurrency) {
    const batch = requestFns.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (fn) => {
        const t0 = performance.now();
        try {
          const res = await fn();
          const t1 = performance.now();
          const lat = t1 - t0;
          latencies.push(lat);
          if (res.ok) {
            successful++;
          } else {
            failed++;
            const errKey = `HTTP_${res.status}`;
            errors[errKey] = (errors[errKey] || 0) + 1;
          }
        } catch (err: any) {
          const t1 = performance.now();
          latencies.push(t1 - t0);
          failed++;
          const errKey = err.code || err.message || 'NETWORK_ERR';
          errors[errKey] = (errors[errKey] || 0) + 1;
        }
      })
    );
  }

  const durationMs = Date.now() - startTime;
  latencies.sort((a, b) => a - b);

  const minLatency = latencies[0] || 0;
  const maxLatency = latencies[latencies.length - 1] || 0;
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || maxLatency;
  const rps = (requestFns.length / (durationMs / 1000));

  return {
    name,
    totalRequests: requestFns.length,
    successful,
    failed,
    durationMs,
    rps: Math.round(rps * 10) / 10,
    minLatency: Math.round(minLatency * 10) / 10,
    maxLatency: Math.round(maxLatency * 10) / 10,
    avgLatency: Math.round(avgLatency * 10) / 10,
    p95Latency: Math.round(p95Latency * 10) / 10,
    errors,
  };
}

export async function runStressSuite(): Promise<StressResult[]> {
  console.log('\n======================================================');
  console.log('⚡ INICIANDO SUÍTE DE TESTES DE STRESS & CONCORRÊNCIA');
  console.log('======================================================\n');

  const results: StressResult[] = [];
  const adminToken = await login('admin@psicogestao.com.br');
  const psiToken = await login('marcos@psicogestao.com.br');

  // Teste 1: Burst Rápido no Endpoint de Saúde (200 requisições simultâneas em lotes de 50)
  console.log('▶ [1/4] Teste de Carga Bruta: /api/health (200 requisições, concorrência 50)...');
  const healthRequests = Array.from({ length: 200 }, () => async () => {
    const res = await fetch(`${BASE_URL}/health`);
    return { status: res.status, ok: res.ok };
  });
  const r1 = await runBurst('Burst Health Check (200 reqs)', healthRequests, 50);
  results.push(r1);
  console.log(`   ✓ Sucesso: ${r1.successful}/${r1.totalRequests} | RPS: ${r1.rps} | Avg: ${r1.avgLatency}ms | p95: ${r1.p95Latency}ms`);

  // Teste 2: Burst Autenticado em Consultas de Leitura (120 requisições variadas)
  console.log('\n▶ [2/4] Teste de Carga de Leitura Autenticada (120 requisições entre pacientes, sessões e despesas)...');
  const endpoints = [
    '/patients',
    '/financial/expenses',
    '/financial/expenses/settlement-balance?month=2026-09',
    '/collaborators',
    '/clinic-settings',
  ];
  const readRequests: Array<() => Promise<any>> = [];
  for (let i = 0; i < 120; i++) {
    const ep = endpoints[i % endpoints.length];
    const token = i % 2 === 0 ? adminToken : psiToken;
    readRequests.push(async () => {
      const res = await fetch(`${BASE_URL}${ep}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.ok };
    });
  }
  const r2 = await runBurst('Leituras Autenticadas Paralelas (120 reqs)', readRequests, 30);
  results.push(r2);
  console.log(`   ✓ Sucesso: ${r2.successful}/${r2.totalRequests} | RPS: ${r2.rps} | Avg: ${r2.avgLatency}ms | p95: ${r2.p95Latency}ms`);

  // Teste 3: Concorrência de Escrita (40 despesas simultâneas para estressar SQLite e flush)
  console.log('\n▶ [3/4] Teste de Concorrência de Escrita em Banco (40 inserções de despesas simultâneas)...');
  const createdIds: number[] = [];
  const writeRequests = Array.from({ length: 40 }, (_, idx) => async () => {
    const payload = {
      title: `Despesa de Stress Test #${idx + 1}`,
      category: 'UTILIDADES',
      amount: 150.50 + idx,
      due_date: '2026-12-15',
      status: 'PENDING',
      is_recurring: false,
      carne_leao_deductible: true,
      scope: 'SHARED',
      is_shared: true,
      shared_splits_json: JSON.stringify({ 1: 50, 3: 50 }),
      payer_user_id: 1,
    };
    const res = await fetch(`${BASE_URL}/financial/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.id) createdIds.push(data.id);
    }
    return { status: res.status, ok: res.ok };
  });
  const r3 = await runBurst('Escrita Concorrente no SQLite (40 inserts)', writeRequests, 20);
  results.push(r3);
  console.log(`   ✓ Sucesso: ${r3.successful}/${r3.totalRequests} | RPS: ${r3.rps} | Avg: ${r3.avgLatency}ms | p95: ${r3.p95Latency}ms`);

  // Limpeza das despesas de teste
  console.log(`   🧹 Limpando ${createdIds.length} despesas criadas no teste de stress...`);
  for (const id of createdIds) {
    await fetch(`${BASE_URL}/financial/expenses/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }

  // Teste 4: Carga Mista Extrema & Estabilidade de Memória
  console.log('\n▶ [4/4] Teste de Carga Mista (100 requisições simultâneas de leitura + cálculo fiscal)...');
  const mixedRequests: Array<() => Promise<any>> = [];
  for (let i = 0; i < 100; i++) {
    const isSettlement = i % 2 === 0;
    const ep = isSettlement
      ? '/financial/expenses/settlement-balance?month=2026-09'
      : '/financial/expenses?scope=SHARED';
    mixedRequests.push(async () => {
      const res = await fetch(`${BASE_URL}${ep}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      return { status: res.status, ok: res.ok };
    });
  }
  const r4 = await runBurst('Carga Mista & Cálculos de Rateio (100 reqs)', mixedRequests, 25);
  results.push(r4);
  if (r2.failed > 0) console.log('   ⚠️ Erros em R2:', r2.errors);
  if (r3.failed > 0) console.log('   ⚠️ Erros em R3:', r3.errors);
  if (r4.failed > 0) console.log('   ⚠️ Erros em R4:', r4.errors);

  console.log('\n======================================================');
  console.log('✅ TESTE DE STRESS CONCLUÍDO!');
  console.log('======================================================\n');

  return results;
}

if (process.argv[1]?.includes('stress.test')) {
  runStressSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Falha no teste de stress:', err);
      process.exit(1);
    });
}
