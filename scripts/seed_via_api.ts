import axios from 'axios';

async function main() {
  const baseURL = 'http://127.0.0.1:3333/api';
  console.log('Autenticando como Admin...');
  const loginRes = await axios.post(`${baseURL}/auth/login`, {
    email: 'admin@psicogestao.com.br',
    password: 'senha123'
  });
  const token = loginRes.data.token;
  const user = loginRes.data.user;
  console.log(`Logado como: ${user.name} (id: ${user.id})`);

  const headers = { Authorization: `Bearer ${token}` };

  // Busca pacientes
  const patRes = await axios.get(`${baseURL}/patients`, { headers });
  const patients = patRes.data.patients || patRes.data;
  console.log(`Encontrados ${patients.length} pacientes.`);

  const sessionsToCreate = [
    // Segunda 28/09
    { patIdx: 0, start_time: '2026-09-28T08:30:00', end_time: '2026-09-28T09:20:00', modality: 'PRESENTIAL', price: 220, session_type: 'PSYCHOTHERAPY', room_name: 'Consultório 1', notes: 'Psicoterapia TCC - Sessão 08' },
    { patIdx: 1, start_time: '2026-09-28T10:00:00', end_time: '2026-09-28T10:50:00', modality: 'ONLINE', price: 200, session_type: 'PSYCHOTHERAPY', room_name: 'Sala Virtual 1', notes: 'Atendimento Online - Regulação Emocional' },
    { patIdx: 2, start_time: '2026-09-28T14:00:00', end_time: '2026-09-28T15:30:00', modality: 'PRESENTIAL', price: 380, session_type: 'EVALUATION', room_name: 'Sala de Testes', notes: 'Bateria Neuropsicológica WISC-IV' },
    { patIdx: 3, start_time: '2026-09-28T16:00:00', end_time: '2026-09-28T16:50:00', modality: 'PRESENTIAL', price: 220, session_type: 'PSYCHOTHERAPY', room_name: 'Consultório 2', notes: 'Psicoterapia Infantil' },

    // Terça 29/09
    { patIdx: 4, start_time: '2026-09-29T09:00:00', end_time: '2026-09-29T09:50:00', modality: 'PRESENTIAL', price: 250, session_type: 'PSYCHOTHERAPY', room_name: 'Consultório 1', notes: 'Manejo de Burnout e Estresse' },
    { patIdx: 5, start_time: '2026-09-29T10:30:00', end_time: '2026-09-29T11:45:00', modality: 'PRESENTIAL', price: 320, session_type: 'EVALUATION', room_name: 'Consultório 1', notes: 'Devolutiva de Laudo Neuropsicológico' },
    { patIdx: 6, start_time: '2026-09-29T14:00:00', end_time: '2026-09-29T14:50:00', modality: 'ONLINE', price: 200, session_type: 'PSYCHOTHERAPY', room_name: 'Sala Virtual 2', notes: 'Sessão remota via Synapsis VideoRoom' },
    { patIdx: 7, start_time: '2026-09-29T16:00:00', end_time: '2026-09-29T16:50:00', modality: 'PRESENTIAL', price: 220, session_type: 'PSYCHOTHERAPY', room_name: 'Consultório 2', notes: 'Psicoterapia de Casal' },

    // Quarta 30/09
    { patIdx: 8, start_time: '2026-09-30T08:30:00', end_time: '2026-09-30T10:00:00', modality: 'PRESENTIAL', price: 350, session_type: 'EVALUATION', room_name: 'Sala de Testes', notes: 'Investigação TDAH Adulto' },
    { patIdx: 9, start_time: '2026-09-30T10:30:00', end_time: '2026-09-30T11:20:00', modality: 'ONLINE', price: 200, session_type: 'PSYCHOTHERAPY', room_name: 'Sala Virtual 1', notes: 'Acompanhamento pós-férias' },
    { patIdx: 10, start_time: '2026-09-30T14:00:00', end_time: '2026-09-30T14:50:00', modality: 'PRESENTIAL', price: 220, session_type: 'PSYCHOTHERAPY', room_name: 'Consultório 1', notes: 'Psicoterapia Comportamental' },
    { patIdx: 11, start_time: '2026-09-30T15:30:00', end_time: '2026-09-30T16:20:00', modality: 'PRESENTIAL', price: 220, session_type: 'PSYCHOTHERAPY', room_name: 'Consultório 1', notes: 'Treino de Habilidades Sociais' },

    // Quinta 01/10
    { patIdx: 12, start_time: '2026-10-01T09:00:00', end_time: '2026-10-01T09:50:00', modality: 'PRESENTIAL', price: 220, session_type: 'PSYCHOTHERAPY', room_name: 'Consultório 1', notes: 'Orientação de Pais' },
    { patIdx: 13, start_time: '2026-10-01T10:30:00', end_time: '2026-10-01T11:20:00', modality: 'ONLINE', price: 200, session_type: 'PSYCHOTHERAPY', room_name: 'Sala Virtual 2', notes: 'Psicoterapia Focada em Esquemas' },
    { patIdx: 14, start_time: '2026-10-01T14:00:00', end_time: '2026-10-01T15:30:00', modality: 'PRESENTIAL', price: 380, session_type: 'EVALUATION', room_name: 'Sala de Testes', notes: 'Bateria Neuropsicológica TEA / ADOS' },
    { patIdx: 15, start_time: '2026-10-01T16:00:00', end_time: '2026-10-01T16:50:00', modality: 'PRESENTIAL', price: 220, session_type: 'PSYCHOTHERAPY', room_name: 'Consultório 2', notes: 'Sessão Individual' },

    // Sexta 02/10
    { patIdx: 0, start_time: '2026-10-02T09:30:00', end_time: '2026-10-02T10:20:00', modality: 'ONLINE', price: 200, session_type: 'PSYCHOTHERAPY', room_name: 'Sala Virtual 1', notes: 'Psicoterapia Online' },
    { patIdx: 1, start_time: '2026-10-02T11:00:00', end_time: '2026-10-02T11:50:00', modality: 'PRESENTIAL', price: 220, session_type: 'PSYCHOTHERAPY', room_name: 'Consultório 1', notes: 'Fechamento de Caso e Metas' },
    { patIdx: 2, start_time: '2026-10-02T14:00:00', end_time: '2026-10-02T15:00:00', modality: 'PRESENTIAL', price: 300, session_type: 'EVALUATION', room_name: 'Consultório 2', notes: 'Devolutiva Intermediária' }
  ];

  let created = 0;
  for (const s of sessionsToCreate) {
    const pat = patients[s.patIdx % patients.length];
    try {
      await axios.post(`${baseURL}/sessions`, {
        patient_id: pat.id,
        psychologist_id: user.id,
        start_time: s.start_time,
        end_time: s.end_time,
        modality: s.modality,
        price: s.price,
        session_type: s.session_type,
        room_name: s.room_name,
        notes: s.notes
      }, { headers });
      created++;
    } catch (err: any) {
      console.warn(`Erro ao criar sessão: ${err.response?.data?.error || err.message}`);
    }
  }

  console.log(`🎉 Sucesso! Criadas ${created} sessões completas na semana de 28/09 a 02/10/2026.`);
}

main().catch(console.error);
