import { smoothClick, showOutroSplash } from '../screenRecorder.js';

export interface TourScene {
  id: string;
  title: string;
  narration: string;
  tab: string;
  subTab?: string;
  actions: (page: any) => Promise<void>;
}

export const OVERVIEW_TOUR_SCENES: TourScene[] = [
  {
    id: 'scene-1-agenda',
    title: 'Abertura & Agenda Inteligente',
    narration: 'Bem-vindo ao Synapsis Clínico, o ecossistema completo para psicólogos e clínicas de saúde mental. Gerencie sua agenda inteligente com confirmação automática de sessões.',
    tab: 'agenda',
    actions: async (page) => {
      // Como a Vinheta Oficial Cyber abre o vídeo com impacto, a tela do sistema já abre direto na Agenda cheia!
      await smoothClick(page, 'button:has-text("Agenda"), [data-tour="nav-agenda"]', { label: 'Agenda Semanal', waitAfter: 1500 });

      // Clica em uma das sessões agendadas na grade para abrir os detalhes do atendimento
      await smoothClick(page, '.rbc-event, [data-event-id], .cursor-pointer', { label: 'Sessão Confirmada', waitAfter: 2800 });

      // Fecha o modal da sessão suavemente
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  },
  {
    id: 'scene-2-prontuario',
    title: 'Prontuário & Conformidade CFP/LGPD',
    narration: 'Tenha um prontuário eletrônico em total conformidade com as resoluções do CFP e a LGPD: evoluções clínicas seguras, documentos criptografados e assinatura digital.',
    tab: 'patients',
    actions: async (page) => {
      await page.keyboard.press('Escape');

      // 1. Imediato: Destaca e clica na aba Pacientes
      await smoothClick(page, 'button:has-text("Pacientes"), [data-tour="nav-patients"]', { label: 'Pacientes', waitAfter: 1000 });

      // 2. Destaca e seleciona o paciente da lista
      await smoothClick(page, 'tr.cursor-pointer, table tbody tr, [data-patient-row]', { label: 'Ficha do Paciente', waitAfter: 1200 });

      // 3. Abre expressamente a subaba 3. Prontuário Clínico no momento em que fala das evoluções
      await smoothClick(page, 'button[data-tour="patient-tab-clinical"], button:has-text("Prontuário Clínico"), button:has-text("3. Prontuário Clínico")', { label: 'Prontuário Clínico (CFP/LGPD)', waitAfter: 1800 });

      // 4. Rola suavemente para visualizar as evoluções clínicas e a prova pericial SHA-256
      await page.mouse.wheel(0, 320);
      await page.waitForTimeout(2500);

      // 5. Fecha antes da próxima cena
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  },
  {
    id: 'scene-3-avaliacoes',
    title: 'Avaliação Neuropsicológica & Laudos',
    narration: 'Simplifique suas avaliações neuropsicológicas: registro de protocolos padronizados, apuração de testes e geração de laudos completos em poucos cliques.',
    tab: 'evaluations',
    actions: async (page) => {
      await page.keyboard.press('Escape');

      // 1. Imediato: Destaca e clica em Avaliações
      await smoothClick(page, 'button:has-text("Avaliações"), [data-tour="nav-evaluations"]', { label: 'Avaliações Neuropsicológicas', waitAfter: 1500 });

      // 2. Destaca e clica no botão de Laudo para exibir a curva normal e escores
      await smoothClick(page, 'button[data-help-id="avaliacao-laudo"], button:has-text("Laudo"), button:has-text("Ver"), button:has-text("Novo")', { label: 'Laudo Pericial', waitAfter: 3000 });

      // 3. Fecha o modal de Laudo para liberar a transição
      const closeLaudoBtn = page.locator('button:has-text("Fechar"), button:has(svg.lucide-x), button:has([data-lucide="x"])').first();
      if (await closeLaudoBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeLaudoBtn.click({ force: true }).catch(() => {});
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  },
  {
    id: 'scene-4-financeiro',
    title: 'Gestão Financeira & Carnê-Leão',
    narration: 'Automatize suas finanças: emissão de notas fiscais, controle de recebimentos e cálculo automático do Carnê-Leão e DARF sem complicações.',
    tab: 'financial',
    subTab: 'carne-leao',
    actions: async (page) => {
      await page.keyboard.press('Escape');

      // 1. Imediato: Destaca e clica em Financeiro
      await smoothClick(page, 'button:has-text("Financeiro"), [data-tour="nav-financial"]', { label: 'Financeiro', waitAfter: 1800 });

      // 2. Destaca e clica na sub-aba Carnê-Leão
      await smoothClick(page, 'button:has-text("Carnê-Leão"), button:has-text("Carne-Leao")', { label: 'Carnê-Leão & DARF', waitAfter: 2800 });
      await page.keyboard.press('Escape');
    }
  },
  {
    id: 'scene-5-encerramento',
    title: 'Encerramento & Chamada para Ação',
    narration: 'Synapsis Clínico: mais segurança ética para sua clínica, mais tempo para seus pacientes. Acesse synapsisclinico.com.br e garanta seu acesso ao Clube das Fundadoras.',
    tab: 'dashboard',
    actions: async (page) => {
      await page.keyboard.press('Escape');

      // 1. Retorna ao Dashboard Geral com os indicadores
      await smoothClick(page, 'button:has-text("Dashboard Geral"), button:has-text("Dashboard"), [data-tour="nav-dashboard"]', { label: 'Dashboard Geral', waitAfter: 1200 });

      // 2. Vinheta final cinematográfica com Logo Synapsis Clínico e CTA synapsisclinico.com.br
      await showOutroSplash(page, 4500);
    }
  }
];
