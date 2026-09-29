import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function seedCurrentWeekAgenda() {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.cwd(), 'psico_database.sqlite');
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Busca os pacientes existentes
  const patientsRes = db.exec("SELECT id, full_name FROM patients ORDER BY id ASC LIMIT 15;");
  if (!patientsRes.length || !patientsRes[0].values.length) {
    console.error('Nenhum paciente encontrado para vincular às sessões.');
    return;
  }
  const patients = patientsRes[0].values; // [id, full_name]

  // Limpa sessões da semana atual se houver alguma
  db.run("DELETE FROM sessions WHERE start_time >= '2026-09-28' AND start_time <= '2026-10-04';");

  // Sessões fictícias ricas para a semana atual (28/09/2026 a 02/10/2026)
  const sessionsToInsert = [
    // Segunda-feira (28/09/2026)
    { patIdx: 0, start: '2026-09-28T09:00:00', end: '2026-09-28T09:50:00', status: 'CONFIRMED', mod: 'PRESENTIAL', price: 220, type: 'Psicoterapia TCC', notes: 'Sessão 12 - Reestruturação Cognitiva', room: 'Consultório 1' },
    { patIdx: 1, start: '2026-09-28T10:30:00', end: '2026-09-28T11:20:00', status: 'CONFIRMED', mod: 'ONLINE', price: 200, type: 'Psicoterapia Adulto', notes: 'Atendimento via Synapsis VideoRoom', room: 'Sala Virtual 1' },
    { patIdx: 2, start: '2026-09-28T14:00:00', end: '2026-09-28T15:30:00', status: 'CONFIRMED', mod: 'PRESENTIAL', price: 350, type: 'Avaliação Neuropsicológica', notes: 'Aplicação Bateria WISC-IV - Sessão 3', room: 'Sala de Testes' },
    { patIdx: 3, start: '2026-09-28T16:00:00', end: '2026-09-28T16:50:00', status: 'SCHEDULED', mod: 'PRESENTIAL', price: 220, type: 'Psicoterapia Infantil', notes: 'Ludo-orientação com responsáveis', room: 'Consultório Kids' },
    
    // Terça-feira (29/09/2026)
    { patIdx: 4, start: '2026-09-29T08:30:00', end: '2026-09-29T09:20:00', status: 'CONFIRMED', mod: 'ONLINE', price: 250, type: 'Psicoterapia', notes: 'Manejo de ansiedade e mindfulness', room: 'Sala Virtual 2' },
    { patIdx: 5, start: '2026-09-29T10:00:00', end: '2026-09-29T11:00:00', status: 'CONFIRMED', mod: 'PRESENTIAL', price: 300, type: 'Devolutiva de Laudo', notes: 'Entrega formal de Laudo Neuropsicológico', room: 'Consultório 2' },
    { patIdx: 6, start: '2026-09-29T14:00:00', end: '2026-09-29T14:50:00', status: 'CONFIRMED', mod: 'PRESENTIAL', price: 200, type: 'Psicoterapia Individual', notes: 'Acompanhamento pós-devolutiva', room: 'Consultório 1' },
    { patIdx: 7, start: '2026-09-29T15:30:00', end: '2026-09-29T16:20:00', status: 'SCHEDULED', mod: 'ONLINE', price: 200, type: 'Psicoterapia Online', notes: 'Sessão quinzenal', room: 'Sala Virtual 1' },

    // Quarta-feira (30/09/2026)
    { patIdx: 8, start: '2026-09-30T09:00:00', end: '2026-09-30T10:30:00', status: 'CONFIRMED', mod: 'PRESENTIAL', price: 350, type: 'Investigação TDAH', notes: 'Bateria Atenção Concentrada e Memória', room: 'Sala de Testes' },
    { patIdx: 9, start: '2026-09-30T11:00:00', end: '2026-09-30T11:50:00', status: 'CONFIRMED', mod: 'PRESENTIAL', price: 220, type: 'Psicoterapia TCC', notes: 'Plano de ação comportamental', room: 'Consultório 1' },
    { patIdx: 10, start: '2026-09-30T14:00:00', end: '2026-09-30T14:50:00', status: 'CONFIRMED', mod: 'ONLINE', price: 200, type: 'Psicoterapia Adulto', notes: 'Sessão remota via link criptografado', room: 'Sala Virtual 1' },
    { patIdx: 11, start: '2026-09-30T16:00:00', end: '2026-09-30T16:50:00', status: 'SCHEDULED', mod: 'PRESENTIAL', price: 220, type: 'Psicoterapia', notes: 'Sessão regular', room: 'Consultório 2' },

    // Quinta-feira (01/10/2026)
    { patIdx: 12, start: '2026-10-01T09:30:00', end: '2026-10-01T10:20:00', status: 'CONFIRMED', mod: 'PRESENTIAL', price: 220, type: 'Psicoterapia', notes: 'Acompanhamento clínico', room: 'Consultório 1' },
    { patIdx: 13, start: '2026-10-01T11:00:00', end: '2026-10-01T12:00:00', status: 'CONFIRMED', mod: 'ONLINE', price: 280, type: 'Orientação Parental', notes: 'Alinhamento com responsáveis', room: 'Sala Virtual 2' },
    { patIdx: 14, start: '2026-10-01T15:00:00', end: '2026-10-01T16:00:00', status: 'CONFIRMED', mod: 'PRESENTIAL', price: 350, type: 'Avaliação TEA', notes: 'Protocolo ADOS-2', room: 'Sala de Testes' },

    // Sexta-feira (02/10/2026)
    { patIdx: 0, start: '2026-10-02T10:00:00', end: '2026-10-02T10:50:00', status: 'CONFIRMED', mod: 'ONLINE', price: 200, type: 'Psicoterapia Online', notes: 'Check-in semanal', room: 'Sala Virtual 1' },
    { patIdx: 1, start: '2026-10-02T14:00:00', end: '2026-10-02T14:50:00', status: 'SCHEDULED', mod: 'PRESENTIAL', price: 220, type: 'Psicoterapia TCC', notes: 'Fechamento de ciclo semanal', room: 'Consultório 1' }
  ];

  for (const s of sessionsToInsert) {
    const pat = patients[s.patIdx % patients.length];
    db.run(`
      INSERT INTO sessions (
        psychologist_id, patient_id, start_time, end_time, status, modality, price, notes, session_type, room_name, created_at
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
      );
    `, [pat[0], s.start, s.end, s.status, s.mod, s.price, s.notes, s.type, s.room]);
  }

  // Salva no disco
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log(`✅ Sucesso! Inseridas ${sessionsToInsert.length} sessões na semana atual (28/09 a 02/10/2026) para a psicóloga Helena Martins.`);
}

seedCurrentWeekAgenda().catch(console.error);
