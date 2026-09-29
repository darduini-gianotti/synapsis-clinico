/**
 * TESTE DE PERFORMANCE & LATÊNCIA — PSICOGESTÃO SAAS
 * Medição precisa de percentis (p50, p95, p99), benchmarks de queries e payloads.
 */

import { getDb, queryAll, queryOne } from '../server/db.js';

const BASE_URL = 'http://localhost:3333/api';

interface BenchmarkMetric {
  endpoint: string;
  samples: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  payloadBytes: number;
  compressed: boolean;
}

async function login(email: string, password = 'senha123'): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login falhou: HTTP ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function benchmarkEndpoint(
  endpoint: string,
  token: string,
  iterations = 30
): Promise<BenchmarkMetric> {
  const latencies: number[] = [];
  let payloadBytes = 0;
  let compressed = false;

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });
    const t1 = performance.now();
    latencies.push(t1 - t0);

    if (i === 0) {
      const buffer = await res.arrayBuffer();
      payloadBytes = buffer.byteLength;
      compressed = res.headers.get('content-encoding') === 'gzip';
    } else {
      await res.blob();
    }
  }

  latencies.sort((a, b) => a - b);
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  return {
    endpoint,
    samples: iterations,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    p50: Math.round(p50 * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    p99: Math.round(p99 * 100) / 100,
    payloadBytes,
    compressed,
  };
}

export async function runPerformanceSuite(): Promise<{
  endpointMetrics: BenchmarkMetric[];
  dbQueryTimes: Record<string, number>;
}> {
  console.log('\n======================================================');
  console.log('🚀 INICIANDO SUÍTE DE TESTES DE PERFORMANCE & LATÊNCIA');
  console.log('======================================================\n');

  await getDb();
  const token = await login('admin@psicogestao.com.br');

  const endpointsToTest = [
    '/patients',
    '/financial/expenses?month=2026-09',
    '/financial/expenses/settlement-balance?month=2026-09',
    '/collaborators',
    '/sessions',
    '/clinic-settings',
    '/reception/waiting-room-calls',
  ];

  console.log('📊 [1/2] Benchmarking de Latência de Endpoints (30 amostras por endpoint)...');
  const endpointMetrics: BenchmarkMetric[] = [];

  for (const ep of endpointsToTest) {
    const metric = await benchmarkEndpoint(ep, token, 30);
    endpointMetrics.push(metric);
    console.log(
      `   ${metric.endpoint.padEnd(52)} | p50: ${metric.p50.toFixed(1).padStart(5)}ms | p95: ${metric.p95.toFixed(1).padStart(5)}ms | avg: ${metric.avg.toFixed(1).padStart(5)}ms | size: ${metric.payloadBytes}B`
    );
  }

  console.log('\n🗄️ [2/2] Benchmarking de Queries no SQLite...');
  const dbQueryTimes: Record<string, number> = {};

  const queryBenchmarks = [
    {
      name: 'Listar Pacientes com JOIN users',
      sql: `SELECT p.*, u.name as psychologist_name FROM patients p LEFT JOIN users u ON p.psychologist_id = u.id ORDER BY p.full_name ASC`,
      params: [],
    },
    {
      name: 'Filtrar Sessões por Mês (start_time)',
      sql: `SELECT s.*, p.full_name as patient_name, u.name as psychologist_name FROM sessions s JOIN patients p ON s.patient_id = p.id JOIN users u ON s.psychologist_id = u.id WHERE s.start_time LIKE ?`,
      params: ['2026-09%'],
    },
    {
      name: 'Filtrar Despesas por Vencimento e Escopo',
      sql: `SELECT e.*, u.name as payer_name FROM expenses e LEFT JOIN users u ON e.payer_user_id = u.id WHERE (e.due_date LIKE ? OR e.payment_date LIKE ?) AND (e.scope = 'SHARED' OR e.is_shared = 1)`,
      params: ['2026-09%', '2026-09%'],
    },
    {
      name: 'Transações Financeiras por Status',
      sql: `SELECT ft.*, p.full_name FROM financial_transactions ft JOIN patients p ON ft.patient_id = p.id WHERE ft.status = 'PENDING'`,
      params: [],
    },
    {
      name: 'Acertos de Contas (expense_settlements) por Competência',
      sql: `SELECT s.*, uf.name as from_user_name, ut.name as to_user_name FROM expense_settlements s JOIN users uf ON uf.id = s.from_user_id JOIN users ut ON ut.id = s.to_user_id WHERE s.competence_month = ?`,
      params: ['2026-09'],
    },
  ];

  for (const q of queryBenchmarks) {
    const times: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      queryAll(q.sql, q.params);
      const t1 = performance.now();
      times.push(t1 - t0);
    }
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)];
    dbQueryTimes[q.name] = Math.round(avg * 1000) / 1000;
    console.log(`   ${q.name.padEnd(52)} | avg: ${avg.toFixed(3)}ms | p95: ${p95.toFixed(3)}ms`);
  }

  console.log('\n======================================================');
  console.log('✅ TESTE DE PERFORMANCE CONCLUÍDO!');
  console.log('======================================================\n');

  return { endpointMetrics, dbQueryTimes };
}

if (import.meta.url.endsWith(process.argv[1])) {
  runPerformanceSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Falha no teste de performance:', err);
      process.exit(1);
    });
}
