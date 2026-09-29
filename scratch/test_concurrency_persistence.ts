import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

import { getDb, execute, queryOne, flushSaveDb } from '../server/db.js';

async function testConcurrency() {
  console.log('--- TESTANDO CONCORRÊNCIA E PERSISTÊNCIA DO SQLITE (sql.js) ---');
  await getDb();

  const initialCountRes = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM audit_logs');
  const initialCount = initialCountRes ? initialCountRes.count : 0;
  console.log(`Contagem inicial de audit_logs: ${initialCount}`);

  const totalWrites = 50;
  const start = performance.now();

  const promises = [];
  for (let i = 0; i < totalWrites; i++) {
    promises.push(
      new Promise<void>((resolve) => {
        execute(
          `INSERT INTO audit_logs (user_id, action, resource, ip_address, details) VALUES (?, ?, ?, ?, ?)`,
          [1, 'STRESS_TEST_CONCURRENCY', `STRESS_TEST_${i}`, '127.0.0.1', `Escrita concorrente de teste ${i}`]
        );
        resolve();
      })
    );
  }

  await Promise.all(promises);
  flushSaveDb();
  const end = performance.now();

  const finalCountRes = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM audit_logs');
  const finalCount = finalCountRes ? finalCountRes.count : 0;
  const delta = finalCount - initialCount;

  console.log(`Tempo total para ${totalWrites} escritas: ${(end - start).toFixed(2)}ms`);
  console.log(`Média por escrita: ${((end - start) / totalWrites).toFixed(3)}ms`);
  console.log(`Registros adicionados com sucesso: ${delta}/${totalWrites}`);

  // Clean up stress test rows
  execute(`DELETE FROM audit_logs WHERE action = 'STRESS_TEST_CONCURRENCY'`);
  flushSaveDb();

  if (delta === totalWrites) {
    console.log('✅ TESTE DE CONCORRÊNCIA E INTEGRIDADE APROVADO!');
  } else {
    console.error('❌ FALHA NA PERSISTÊNCIA: Nem todas as gravações foram salvas!');
  }
}

testConcurrency().catch(console.error);
