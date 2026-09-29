import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('psico_database.sqlite'));
  const users = db.exec("SELECT id, name, email, role FROM users;");
  console.log('Usuários:', users[0].values);

  const countHelena = db.exec("SELECT count(*) FROM sessions WHERE psychologist_id = 1;");
  console.log('Sessões de Helena (id: 1):', countHelena[0].values[0][0]);

  const weekSessions = db.exec("SELECT s.id, s.psychologist_id, s.start_time, p.full_name FROM sessions s JOIN patients p ON s.patient_id = p.id WHERE s.start_time >= '2026-09-28' AND s.start_time <= '2026-10-04';");
  console.log('Total de sessões nesta semana no banco:', weekSessions[0]?.values?.length);
  console.log('Sessões da semana:', weekSessions[0]?.values);
}

main().catch(console.error);
