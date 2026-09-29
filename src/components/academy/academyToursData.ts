import { AcademyTour, AcademyModuleMeta } from './types.js';

export const ACADEMY_MODULES: AcademyModuleMeta[] = [
  {
    id: 'financial',
    title: 'Faturamento & Cobrança',
    shortDescription: 'Gestão de honorários, régua de cobrança e recebíveis.',
    accentColor: 'emerald',
    iconName: 'DollarSign',
  },
  {
    id: 'reception',
    title: 'Recepção & Espera',
    shortDescription: 'Torre de controle, check-in e chamada na TV da recepção.',
    accentColor: 'indigo',
    iconName: 'Radio',
  },
  {
    id: 'clinical',
    title: 'Prontuário & Clínica',
    shortDescription: 'Evoluções com sigilo CFP 06/2019 e prontuários estruturados.',
    accentColor: 'teal',
    iconName: 'Brain',
  },
  {
    id: 'agenda',
    title: 'Agenda Inteligente',
    shortDescription: 'Agendamentos rápidos, encaixes e confirmações de presença.',
    accentColor: 'sky',
    iconName: 'Calendar',
  },
  {
    id: 'scales',
    title: 'Escalas Psicológicas',
    shortDescription: 'Aplicação e correção de inventários clínicos (PHQ-9 / GAD-7).',
    accentColor: 'purple',
    iconName: 'Activity',
  },
];

export const ACADEMY_TOURS: AcademyTour[] = [
  // ==========================================
  // TRILHA 1: FATURAMENTO & COBRANÇA
  // ==========================================
  {
    id: 'tour-whatsapp-batch',
    title: 'Cobrança via WhatsApp em Lote',
    shortDescription:
      'Aprenda a filtrar honorários em atraso, selecionar inadimplentes e disparar lembretes via WhatsApp sem retrabalho.',
    category: 'financial',
    targetRole: 'ALL',
    estimatedMinutes: 3,
    badge: 'Mais Utilizado',
    steps: [
      {
        id: 'step-nav-financial',
        title: 'Passo 1: Acessar o Módulo Financeiro',
        description:
          'O primeiro passo para a gestão de recebíveis é acessar o módulo financeiro. Clique em "Financeiro & Carnê-Leão" no menu lateral.',
        targetSelector: '[data-tour="nav-financial"]',
        tabRequired: 'financial',
        placement: 'right',
        actionPrompt: 'Clique no menu Financeiro',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-subnav-billings',
        title: 'Passo 2: Abrir a Central de Cobranças',
        description:
          'No submenu financeiro, clique em "Cobranças / Inadimplência" para visualizar a lista unificada de honorários vencidos.',
        targetSelector: '[data-tour="subnav-billings"]',
        tabRequired: 'financial',
        financialSubTabRequired: 'billings',
        placement: 'right',
        actionPrompt: 'Clique em Cobranças / Inadimplência',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-click-batch-btn',
        title: 'Passo 3: Abrir Cobrança do Paciente',
        description:
          'Localize o paciente com honorários em aberto e clique no botão "Cobrança WhatsApp" para abrir o demonstrativo e gerador de mensagem.',
        targetSelector: '[data-tour="billings-whatsapp-batch-btn"]',
        tabRequired: 'financial',
        financialSubTabRequired: 'billings',
        placement: 'bottom',
        actionPrompt: 'Clique no botão Cobrança WhatsApp',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-select-all-billings',
        title: 'Passo 4: Seleção das Sessões em Aberto',
        description:
          'No painel de cobrança, você pode selecionar sessões específicas ou marcar todas. Clique em "Selecionar Todas" para incluir as pendências na régua.',
        targetSelector: '[data-tour="billings-select-all"]',
        tabRequired: 'financial',
        financialSubTabRequired: 'billings',
        placement: 'bottom',
        actionPrompt: 'Clique em Selecionar Todas',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-modal-confirm',
        title: 'Passo 5: Simulação de Envio Seguro',
        description:
          'Confira a mensagem formatada para o paciente ou responsável financeiro. Clique em "Enviar no WhatsApp" para concluir a simulação sem disparar mensagens reais.',
        targetSelector: '[data-tour="whatsapp-batch-confirm-btn"]',
        tabRequired: 'financial',
        financialSubTabRequired: 'billings',
        placement: 'top',
        actionPrompt: 'Clique em Enviar no WhatsApp',
        advanceOnTargetClick: true,
      },
    ],
  },

  // ==========================================
  // TRILHA 2: RECEPÇÃO & ATENDIMENTO
  // ==========================================
  {
    id: 'tour-reception-tower',
    title: 'Operação da Torre de Recepção & TV',
    shortDescription:
      'Aprenda a realizar o check-in de pacientes na recepção e acionar a chamada sonora/visual na TV da sala de espera.',
    category: 'reception',
    targetRole: 'SECRETARY',
    estimatedMinutes: 2,
    badge: 'Ao Vivo',
    steps: [
      {
        id: 'step-nav-tower',
        title: 'Passo 1: Acessar a Torre de Recepção',
        description:
          'A Torre de Recepção monitora em tempo real a chegada de pacientes e a ocupação dos consultórios. Clique em "Torre de Recepção" no menu lateral.',
        targetSelector: '[data-tour="nav-reception_tower"]',
        tabRequired: 'reception_tower',
        placement: 'right',
        actionPrompt: 'Clique em Torre de Recepção',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-tower-checkin',
        title: 'Passo 2: Registrar Check-in da Paciente',
        description:
          'A paciente Ana Paula acabou de se apresentar na recepção. Clique no botão de Check-in para confirmar que ela aguarda na recepção.',
        targetSelector: '[data-tour="tower-checkin-btn-702"]',
        tabRequired: 'reception_tower',
        placement: 'left',
        actionPrompt: 'Clique para fazer o Check-in',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-tower-call-tv',
        title: 'Passo 3: Chamar Paciente na TV da Sala de Espera',
        description:
          'O consultório está pronto! Clique em "Chamar na TV" para enviar a notificação na tela grande da sala de espera com aviso sonoro.',
        targetSelector: '[data-tour="tower-call-tv-btn-702"]',
        tabRequired: 'reception_tower',
        placement: 'left',
        actionPrompt: 'Clique em Chamar na TV',
        advanceOnTargetClick: true,
      },
    ],
  },

  // ==========================================
  // TRILHA 3: PRÁTICA CLÍNICA (PSICÓLOGO)
  // ==========================================
  {
    id: 'tour-clinical-evolution',
    title: 'Prontuário & Evolução CFP 06/2019',
    shortDescription:
      'Aprenda a abrir prontuários seguros, redigir evoluções com criptografia AES-256 e registrar registros de atendimento.',
    category: 'clinical',
    targetRole: 'PSYCHOLOGIST',
    estimatedMinutes: 3,
    badge: 'Sigilo CFP',
    steps: [
      {
        id: 'step-nav-patients',
        title: 'Passo 1: Pacientes & Prontuários',
        description:
          'Para acessar as informações clínicas dos pacientes, clique em "Pacientes & Prontuários" na barra lateral.',
        targetSelector: '[data-tour="nav-patients"]',
        tabRequired: 'patients',
        placement: 'right',
        actionPrompt: 'Clique em Pacientes & Prontuários',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-open-patient-record',
        title: 'Passo 2: Abrir Ficha do Paciente',
        description:
          'Localize o paciente na lista e clique em "Abrir Prontuário" para visualizar o histórico de sessões e anamnese.',
        targetSelector: '[data-tour="patient-open-btn-901"]',
        tabRequired: 'patients',
        placement: 'left',
        actionPrompt: 'Clique em Abrir Prontuário',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-click-new-evolution',
        title: 'Passo 3: Iniciar Nova Evolução Clínica',
        description:
          'Clique no botão "Nova Evolução". O Synapsis abrirá o formulário estruturado conforme a Resolução CFP 06/2019 com hash de imutabilidade SHA-256.',
        targetSelector: '[data-tour="patient-new-evolution-btn"]',
        tabRequired: 'patients',
        placement: 'bottom',
        actionPrompt: 'Clique em Nova Evolução',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-save-evolution-simulation',
        title: 'Passo 4: Salvar e Criptografar Registro',
        description:
          'Ao preencher o relato da sessão, o sistema gera o hash imutável e criptografa a evolução. Clique em "Salvar Evolução" para concluir o procedimento com total segurança.',
        targetSelector: '[data-tour="save-evolution-btn"]',
        tabRequired: 'patients',
        placement: 'top',
        actionPrompt: 'Clique em Salvar Evolução',
        advanceOnTargetClick: true,
      },
    ],
  },

  // ==========================================
  // LOTE 2 — TRILHA 4: AGENDA INTELIGENTE
  // ==========================================
  {
    id: 'tour-agenda-quick-booking',
    title: 'Agendamento Rápido & Gestão de Encaixes',
    shortDescription:
      'Aprenda a abrir a grade semanal, selecionar horário, vincular paciente e definir sala ou teleconsulta sem conflitos.',
    category: 'agenda',
    targetRole: 'ALL',
    estimatedMinutes: 2,
    badge: 'Rotina Essencial',
    steps: [
      {
        id: 'step-nav-agenda',
        title: 'Passo 1: Acessar a Agenda Inteligente',
        description:
          'A Agenda Inteligente centraliza a grade semanal de consultas presenciais e online. Clique em "Agenda Inteligente" no menu lateral.',
        targetSelector: '[data-tour="nav-agenda"]',
        tabRequired: 'agenda',
        placement: 'right',
        actionPrompt: 'Clique em Agenda Inteligente',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-agenda-new-btn',
        title: 'Passo 2: Iniciar Novo Agendamento',
        description:
          'Para marcar um novo atendimento na grade, clique no botão "+ Agendar sessão" no cabeçalho de controle.',
        targetSelector: '[data-tour="agenda-new-session-btn"]',
        tabRequired: 'agenda',
        placement: 'bottom',
        actionPrompt: 'Clique em + Agendar sessão',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-agenda-select-patient',
        title: 'Passo 3: Selecionar o Paciente',
        description:
          'No modal de agendamento, selecione o paciente para carregar automaticamente seus honorários cadastrados.',
        targetSelector: '[data-tour="agenda-modal-patient"]',
        tabRequired: 'agenda',
        placement: 'bottom',
        actionPrompt: 'Selecione o paciente no formulário',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-agenda-select-modality',
        title: 'Passo 4: Definir Modalidade & Consultório',
        description:
          'Escolha se o atendimento será Presencial no Consultório ou Online via Teleconsulta.',
        targetSelector: '[data-tour="agenda-modal-modality"]',
        tabRequired: 'agenda',
        placement: 'bottom',
        actionPrompt: 'Defina a modalidade do atendimento',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-agenda-save',
        title: 'Passo 5: Salvar Agendamento na Grade',
        description:
          'Confira a data e horários e clique em "Salvar Agendamento" para consolidar a sessão na grade com verificação de sobreposição.',
        targetSelector: '[data-tour="agenda-modal-save-btn"]',
        tabRequired: 'agenda',
        placement: 'top',
        actionPrompt: 'Clique em Salvar Agendamento',
        advanceOnTargetClick: true,
      },
    ],
  },

  // ==========================================
  // LOTE 2 — TRILHA 5: ESCALAS PSICOLÓGICAS
  // ==========================================
  {
    id: 'tour-scales-application',
    title: 'Aplicação & Interpretação de Escalas (PHQ-9 / GAD-7)',
    shortDescription:
      'Aprenda a aplicar inventários validados para rastreio de ansiedade e depressão com cálculo de escore e gravidade clínica em tempo real.',
    category: 'scales',
    targetRole: 'PSYCHOLOGIST',
    estimatedMinutes: 3,
    badge: 'Evidência Clínica',
    steps: [
      {
        id: 'step-nav-scales',
        title: 'Passo 1: Acessar Escalas Psicológicas',
        description:
          'O módulo de escalas reúne inventários clínicos padronizados. Clique em "Escalas (PHQ-9 / GAD-7)" na barra lateral.',
        targetSelector: '[data-tour="nav-scales"]',
        tabRequired: 'scales',
        placement: 'right',
        actionPrompt: 'Clique em Escalas (PHQ-9 / GAD-7)',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-scales-select-patient',
        title: 'Passo 2: Selecionar o Paciente',
        description:
          'Selecione a paciente Ana Paula Mendonça para aplicar o protocolo de avaliação de sintomas.',
        targetSelector: '[data-tour="scales-patient-select"]',
        tabRequired: 'scales',
        placement: 'bottom',
        actionPrompt: 'Selecione a paciente Ana Paula',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-scales-choose-instrument',
        title: 'Passo 3: Escolher o Instrumento (GAD-7 / PHQ-9)',
        description:
          'Selecione a escala GAD-7 (Ansiedade Generalizada) ou alterne para PHQ-9 (Rastreio de Depressão).',
        targetSelector: '[data-tour="scales-tab-gad7"]',
        tabRequired: 'scales',
        placement: 'bottom',
        actionPrompt: 'Clique na aba GAD-7',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-scales-answer-options',
        title: 'Passo 4: Registrar os Sintomas',
        description:
          'Marque a intensidade dos sintomas com base nas respostas do paciente para acompanhar a soma em tempo real.',
        targetSelector: '[data-tour="scales-options-group"]',
        tabRequired: 'scales',
        placement: 'left',
        actionPrompt: 'Selecione uma resposta para a pergunta',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-scales-submit',
        title: 'Passo 5: Salvar e Registrar Escore',
        description:
          'O Synapsis analisa o escore total e classifica a gravidade clínica imediatamente. Clique em "Salvar Avaliação" para concluir.',
        targetSelector: '[data-tour="scales-submit-btn"]',
        tabRequired: 'scales',
        placement: 'top',
        actionPrompt: 'Clique em Salvar Avaliação',
        advanceOnTargetClick: true,
      },
    ],
  },

  // ==========================================
  // LOTE 2 — TRILHA 6: FATURAMENTO & FISCAL
  // ==========================================
  {
    id: 'tour-fiscal-carne-leao',
    title: 'Carnê-Leão, Livro-Caixa & Dossiê Fiscal',
    shortDescription:
      'Aprenda a auditar receitas e despesas dedutíveis do consultório, gerar o Dossiê Fiscal do paciente e simular a exportação para a Receita Federal.',
    category: 'financial',
    targetRole: 'ALL',
    estimatedMinutes: 3,
    badge: 'Fiscal & IRPF',
    steps: [
      {
        id: 'step-nav-financial-fiscal',
        title: 'Passo 1: Acessar o Módulo Financeiro',
        description:
          'A gestão fiscal e o Livro-Caixa digital do consultório ficam integrados no módulo financeiro. Clique em "Financeiro & Carnê-Leão".',
        targetSelector: '[data-tour="nav-financial"]',
        tabRequired: 'financial',
        placement: 'right',
        actionPrompt: 'Clique no menu Financeiro',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-subnav-carne-leao',
        title: 'Passo 2: Abrir Carnê-Leão & Livro-Caixa',
        description:
          'No submenu financeiro, clique em "CARNÊ-LEÃO & LIVRO-CAIXA" para visualizar os lançamentos fiscais da competência.',
        targetSelector: '[data-tour="subnav-carne-leao"]',
        tabRequired: 'financial',
        financialSubTabRequired: 'carne-leao',
        placement: 'right',
        actionPrompt: 'Clique em CARNÊ-LEÃO & LIVRO-CAIXA',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-carne-leao-summary',
        title: 'Passo 3: Auditar Receitas & Deduções',
        description:
          'Confira os honorários computados pelo CPF dos pacientes e as despesas com sublocação e anuidade do CRP deduzidas da base de cálculo.',
        targetSelector: '[data-tour="carne-leao-summary-card"]',
        tabRequired: 'financial',
        financialSubTabRequired: 'carne-leao',
        placement: 'bottom',
        actionPrompt: 'Analise o painel do Livro-Caixa',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-carne-leao-dossier',
        title: 'Passo 4: Abrir Dossiê Fiscal do Paciente',
        description:
          'O Dossiê Fiscal consolida recibos e comprovantes para declaração do IRPF/DMED sem inconsistências. Clique em "Dossiê do Paciente".',
        targetSelector: '[data-tour="carne-leao-dossier-btn"]',
        tabRequired: 'financial',
        financialSubTabRequired: 'carne-leao',
        placement: 'left',
        actionPrompt: 'Clique em Dossiê do Paciente',
        advanceOnTargetClick: true,
      },
      {
        id: 'step-carne-leao-export',
        title: 'Passo 5: Simular Exportação Oficial (RFB)',
        description:
          'Clique em "Exportar Carnê-Leão" para gerar a estrutura de dados oficial compatível com a Receita Federal.',
        targetSelector: '[data-tour="carne-leao-export-btn"]',
        tabRequired: 'financial',
        financialSubTabRequired: 'carne-leao',
        placement: 'left',
        actionPrompt: 'Clique em Exportar Carnê-Leão',
        advanceOnTargetClick: true,
      },
    ],
  },
];
