import { smoothClick, showOutroSplash } from '../screenRecorder.js';
import { TourScene } from './overview-60s.js';

export const NEURO_TOUR_SCENES: TourScene[] = [
  {
    id: 'scene-1-hub-avaliacoes',
    title: 'Central de Avaliações Neuropsicológicas',
    narration: 'Na prática neuropsicológica, organizar protocolos, calcular escores e redigir laudos periciais pode consumir dias de trabalho. Com o Synapsis Clínico, você centraliza todo o fluxo avaliativo com agilidade e total respaldo ético.',
    tab: 'evaluations',
    actions: async (page) => {
      // 1. Garante que qualquer modal esteja fechado
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // 2. Destaca e acessa a aba Avaliações
      await smoothClick(page, 'button:has-text("Avaliações"), [data-tour="nav-evaluations"]', {
        label: 'Hub de Avaliações',
        waitAfter: 1500,
      });

      // 3. Move o cursor suavemente sobre os cards de métricas (Em Andamento, Aguardando Devolutiva, Concluídas)
      await page.mouse.move(500, 180);
      await page.waitForTimeout(1000);

      // 4. Rola suavemente para visualizar a grade de pacientes em avaliação
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(1800);
    },
  },
  {
    id: 'scene-2-testes-satepsi',
    title: 'Baterias SATEPSI & Apuração Automatizada',
    narration: 'Registre baterias psicométricas padronizadas e testes aprovados pelo SATEPSI. O sistema calcula automaticamente os percentis, Z-scores e desvios-padrão a partir dos escores brutos, eliminando qualquer risco de inconsistência estatística.',
    tab: 'evaluations',
    actions: async (page) => {
      // 1. Localiza e clica no botão "Laudo" da avaliação da Juliana Castro Ribeiro
      const laudoBtn = page.locator('button[data-help-id="avaliacao-laudo"], button:has-text("Laudo")').first();
      await smoothClick(page, laudoBtn, { label: 'Editor do Laudo Pericial', waitAfter: 1800 });

      // 2. Garante que está no modo de preenchimento
      const editBtn = page.locator('button:has-text("Preenchimento")').first();
      if (await editBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await editBtn.click({ force: true }).catch(() => {});
      }
      await page.waitForTimeout(800);

      // 3. Rola até a tabela de testes psicométricos aplicados (WISC-IV, TEACO, FDT)
      const modalScrollable = page.locator('.overflow-y-auto').last();
      await modalScrollable.evaluate((el: HTMLElement) => {
        el.scrollBy({ top: 380, behavior: 'smooth' });
      });
      await page.waitForTimeout(2800);
    },
  },
  {
    id: 'scene-3-perfil-gauss',
    title: 'Curva Normal de Gauss & Perfil Cognitivo',
    narration: 'Gere instantaneamente o gráfico da Curva Normal de Gauss e a visualização do perfil cognitivo em alta resolução, evidenciando áreas de preservação e rebaixamento com clareza clínica cristalina.',
    tab: 'evaluations',
    actions: async (page) => {
      // 1. Clica no botão "Laudo Timbrado" para alternar para a visualização pericial formatada
      const previewBtn = page.locator('button:has-text("Laudo Timbrado")').first();
      await smoothClick(page, previewBtn, { label: 'Visualizar Laudo Timbrado', waitAfter: 2000 });

      // 2. Rola a folha do laudo timbrado para enquadrar o Gráfico da Curva de Gauss e os domínios avaliados
      const modalScrollable = page.locator('.overflow-y-auto').last();
      await modalScrollable.evaluate((el: HTMLElement) => {
        el.scrollBy({ top: 480, behavior: 'smooth' });
      });
      await page.waitForTimeout(3000);
    },
  },
  {
    id: 'scene-4-laudo-oficial-pdf',
    title: 'Laudo Oficial CFP 06/2019 & Prova Pericial',
    narration: 'Emita o laudo técnico completo em total conformidade com a Resolução CFP 06/2019: com fundamentação diagnóstica DSM-5 e CID-11, diretrizes interventivas, assinatura digital e exportação direta em PDF.',
    tab: 'evaluations',
    actions: async (page) => {
      // 1. Rola mais abaixo na folha do laudo até a síntese diagnóstica, hipótese e bloco de assinatura pericial
      const modalScrollable = page.locator('.overflow-y-auto').last();
      await modalScrollable.evaluate((el: HTMLElement) => {
        el.scrollBy({ top: 460, behavior: 'smooth' });
      });
      await page.waitForTimeout(2000);

      // 2. Destaca visualmente o botão de Exportar PDF / Imprimir no rodapé ou cabeçalho do documento
      const exportPdfBtn = page.locator('button:has-text("Exportar PDF"), button:has-text("Imprimir")').first();
      if (await exportPdfBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await smoothClick(page, exportPdfBtn, { label: 'Exportar Laudo Oficial em PDF', waitAfter: 1600 });
      } else {
        await page.waitForTimeout(1600);
      }

      // 3. Fecha o modal de laudo de forma suave
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    },
  },
  {
    id: 'scene-5-encerramento',
    title: 'Encerramento & Clube das Fundadoras',
    narration: 'Synapsis Clínico: mais segurança ética para sua clínica, mais tempo para seus pacientes. Acesse synapsisclinico.com.br e garanta seu acesso ao Clube das Fundadoras.',
    tab: 'dashboard',
    actions: async (page) => {
      await page.keyboard.press('Escape');

      // 1. Retorna ao Dashboard Geral com os indicadores
      await smoothClick(page, 'button:has-text("Dashboard Geral"), button:has-text("Dashboard"), [data-tour="nav-dashboard"]', {
        label: 'Dashboard Geral',
        waitAfter: 1200,
      });

      // 2. Vinheta final com Logo Synapsis Clínico e CTA oficial do Clube das Fundadoras
      await showOutroSplash(page, 4500);
    },
  },
];
