/**
 * EXECUTOR GERAL DE TESTES: STRESS, PERFORMANCE E SEGURANÇA
 * Executa as 3 suítes em sequência e emite relatório executivo.
 */

import { runStressSuite } from './stress.test.js';
import { runPerformanceSuite } from './performance.test.js';
import { runSecuritySuite } from './security.test.js';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   PSICOGESTÃO SAAS — BATERIA DE HOMOLOGAÇÃO COMPLETA     ║');
  console.log('║   1. Stress | 2. Performance | 3. Segurança & LGPD       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const tStart = Date.now();

  // 1. Stress
  const stressResults = await runStressSuite();

  // 2. Performance
  const perfResults = await runPerformanceSuite();

  // 3. Segurança
  const secResults = await runSecuritySuite();

  const totalTime = ((Date.now() - tStart) / 1000).toFixed(2);

  // Consolidação de métricas
  const totalStressReqs = stressResults.reduce((sum, r) => sum + r.totalRequests, 0);
  const totalStressSuccess = stressResults.reduce((sum, r) => sum + r.successful, 0);
  const stressSuccessRate = ((totalStressSuccess / totalStressReqs) * 100).toFixed(1);

  const avgP95 = (
    perfResults.endpointMetrics.reduce((sum, m) => sum + m.p95, 0) / perfResults.endpointMetrics.length
  ).toFixed(1);

  const secPassed = secResults.filter((r) => r.passed).length;
  const secTotal = secResults.length;
  const secRate = ((secPassed / secTotal) * 100).toFixed(1);

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║               RESUMO EXECUTIVO DA AVALIAÇÃO               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`⏱️  Tempo Total de Execução: ${totalTime}s\n`);

  console.log(`🔥 1. TESTE DE STRESS:`);
  console.log(`   - Requisições Totais: ${totalStressReqs}`);
  console.log(`   - Taxa de Sucesso: ${stressSuccessRate}% (${totalStressSuccess}/${totalStressReqs})`);
  console.log(`   - Status: ${Number(stressSuccessRate) >= 99 ? '🟢 APROVADO COM EXCELÊNCIA' : '🟡 ALERTA DE CARGA'}\n`);

  console.log(`⚡ 2. TESTE DE PERFORMANCE:`);
  console.log(`   - Média de Latência p95: ${avgP95}ms`);
  console.log(`   - Endpoints Avaliados: ${perfResults.endpointMetrics.length}`);
  console.log(`   - Status: ${Number(avgP95) < 100 ? '🟢 ALTAMENTE RESPONSIVO (< 100ms)' : '🟡 ADEQUADO'}\n`);

  console.log(`🛡️ 3. TESTE DE SEGURANÇA:`);
  console.log(`   - Controles Inspecionados: ${secTotal}`);
  console.log(`   - Controles em Conformidade: ${secPassed}/${secTotal} (${secRate}%)`);
  console.log(`   - Status: ${secPassed === secTotal ? '🟢 100% BLINDADO E CONFORME LGPD/CFP' : '🔴 VULNERABILIDADE DETECTADA'}\n`);
}

main().catch((err) => {
  console.error('Falha geral no executor de testes:', err);
  process.exit(1);
});
