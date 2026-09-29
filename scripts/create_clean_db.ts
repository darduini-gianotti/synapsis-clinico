import fs from 'fs';
import path from 'path';

// Force clean mode
process.env.APP_MODE = 'clean';
process.env.SEED_DEMO_DATA = 'false';

const targetDbFile = process.env.TARGET_DB || 'psico_clean.sqlite';
const targetPath = path.isAbsolute(targetDbFile) ? targetDbFile : path.join(process.cwd(), targetDbFile);
process.env.DB_FILE_PATH = targetPath;

async function run() {
  console.log(`\n=================================================`);
  console.log(`🧹 GERADOR DE BANCO EM BRANCO - SYNAPSIS CLÍNICO`);
  console.log(`=================================================`);
  console.log(`📁 Arquivo destino: ${targetPath}`);

  if (fs.existsSync(targetPath)) {
    console.log(`⚠️  Arquivo existente detectado. Removendo para gerar cópia 100% nova...`);
    fs.unlinkSync(targetPath);
  }

  // Import after setting env vars
  const { getDb, queryOne, queryAll } = await import('../server/db.js');

  const db = await getDb();

  // Run audit checks on clean DB
  const userCount = queryOne('SELECT COUNT(*) as count FROM users');
  const patientCount = queryOne('SELECT COUNT(*) as count FROM patients');
  const sessionCount = queryOne('SELECT COUNT(*) as count FROM sessions');
  const txCount = queryOne('SELECT COUNT(*) as count FROM financial_transactions');
  const rolesCount = queryOne('SELECT COUNT(*) as count FROM roles');
  const templatesCount = queryOne('SELECT COUNT(*) as count FROM document_templates');

  const admin = queryOne('SELECT id, name, email, role, crp_number FROM users LIMIT 1');
  const clinic = queryOne('SELECT id, clinic_name, email FROM clinic_settings LIMIT 1');

  console.log(`\n✅ Banco em branco gerado com sucesso!`);
  console.log(`-------------------------------------------------`);
  console.log(`👤 Usuário Administrador Inicial:`);
  console.log(`   - Nome:  ${admin?.name}`);
  console.log(`   - Email: ${admin?.email}`);
  console.log(`   - Role:  ${admin?.role}`);
  console.log(`   - CRP:   ${admin?.crp_number}`);
  console.log(`   - Senha padrão: admin123 (recomenda-se alterar no primeiro login)`);
  console.log(`🏢 Consultório: ${clinic?.clinic_name}`);
  console.log(`-------------------------------------------------`);
  console.log(`📊 Estatísticas do Banco:`);
  console.log(`   - Perfis de Acesso (Roles): ${rolesCount?.count}`);
  console.log(`   - Templates CFP (Atestado/Declaração): ${templatesCount?.count}`);
  console.log(`   - Pacientes: ${patientCount?.count} (TOTALMENTE EM BRANCO)`);
  console.log(`   - Sessões / Agenda: ${sessionCount?.count} (TOTALMENTE EM BRANCO)`);
  console.log(`   - Transações Financeiras: ${txCount?.count} (TOTALMENTE EM BRANCO)`);
  console.log(`-------------------------------------------------`);
  console.log(`💡 Para rodar localmente com esta cópia limpa:`);
  console.log(`   $env:DB_FILE_PATH="${targetDbFile}"; npm run dev`);
  console.log(`=================================================\n`);

  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Erro ao criar banco limpo:', err);
  process.exit(1);
});
