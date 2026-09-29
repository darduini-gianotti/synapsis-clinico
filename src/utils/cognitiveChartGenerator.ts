import { PsychometricTestScore } from '../types.js';
import { getPercentileClassification } from '../data/neuropsychCatalog.js';

/**
 * Utilitário de Geração do Gráfico de Perfil Cognitivo & Curva Normal (Gaussiana)
 * Desenha em HTML5 Canvas de alta resolução (300 DPI) para injeção no jsPDF e no DOM
 */

export interface ChartOptions {
  width?: number;
  height?: number;
  clinicColor?: string;
}

/**
 * Calcula a densidade da distribuição normal padrão: f(z) = (1 / sqrt(2*PI)) * exp(-0.5 * z^2)
 */
function gaussian(z: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z);
}

/**
 * Gera o Canvas com a Curva Normal e as Barras de Percentil dos testes
 */
export function generateCognitiveProfileCanvas(
  tests: PsychometricTestScore[],
  options: ChartOptions = {}
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  const validTests = (tests || []).filter((t) => t && t.testName && t.domain);
  if (validTests.length === 0) return null;

  const width = options.width || 1200;
  // Altura proporcional à quantidade de testes para evitar aperto
  const headerHeight = 240; // Espaço para a Curva de Gauss
  const rowHeight = 44;
  const bottomLegendHeight = 60;
  const calculatedHeight = Math.max(520, headerHeight + validTests.length * rowHeight + bottomLegendHeight);
  const height = options.height || calculatedHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fundo branco sólido para impressão nítida
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Moldura estética externa com bordas arredondadas suaves
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // 1. TÍTULO DO GRÁFICO
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PERFIL PSICOMÉTRICO & DISTRIBUIÇÃO NORMATIVA (CURVA DE GAUSS)', 32, 42);

  ctx.fillStyle = '#64748b';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Padronização psicométrica conforme faixas de desvio-padrão (CFP / SATEPSI)', 32, 60);

  // 2. DESENHO DA CURVA DE GAUSS (TOPO)
  const curveLeft = 140;
  const curveRight = width - 80;
  const curveWidth = curveRight - curveLeft;
  const curveBaseY = 190;
  const curveMaxHeight = 100;
  const maxGaussian = gaussian(0); // ~0.3989

  // Faixas de fundo sombreadas sob a curva
  const zToX = (z: number) => curveLeft + ((z + 3.2) / 6.4) * curveWidth;

  // Zonas: Deficitário (< -1.5), Médio (-1.5 a +1.5), Superior (> +1.5)
  // Sombra Deficitário (< -1.5)
  ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
  ctx.beginPath();
  ctx.moveTo(zToX(-3.2), curveBaseY);
  for (let z = -3.2; z <= -1.5; z += 0.05) {
    const x = zToX(z);
    const y = curveBaseY - (gaussian(z) / maxGaussian) * curveMaxHeight;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(zToX(-1.5), curveBaseY);
  ctx.closePath();
  ctx.fill();

  // Sombra Médio (-1.5 a +1.5)
  ctx.fillStyle = 'rgba(99, 102, 241, 0.06)';
  ctx.beginPath();
  ctx.moveTo(zToX(-1.5), curveBaseY);
  for (let z = -1.5; z <= 1.5; z += 0.05) {
    const x = zToX(z);
    const y = curveBaseY - (gaussian(z) / maxGaussian) * curveMaxHeight;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(zToX(1.5), curveBaseY);
  ctx.closePath();
  ctx.fill();

  // Sombra Superior (> +1.5)
  ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
  ctx.beginPath();
  ctx.moveTo(zToX(1.5), curveBaseY);
  for (let z = 1.5; z <= 3.2; z += 0.05) {
    const x = zToX(z);
    const y = curveBaseY - (gaussian(z) / maxGaussian) * curveMaxHeight;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(zToX(3.2), curveBaseY);
  ctx.closePath();
  ctx.fill();

  // Linha do traçado da Curva de Sino
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let z = -3.2; z <= 3.2; z += 0.05) {
    const x = zToX(z);
    const y = curveBaseY - (gaussian(z) / maxGaussian) * curveMaxHeight;
    if (z === -3.2) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Linha de base da curva
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(curveLeft, curveBaseY);
  ctx.lineTo(curveRight, curveBaseY);
  ctx.stroke();

  // Linhas verticais e marcações de Desvio Padrão
  const zMarks = [
    { z: -3, label: '-3σ (P0.1)', sub: 'Deficitário' },
    { z: -2, label: '-2σ (P2)', sub: 'Limítrofe' },
    { z: -1, label: '-1σ (P16)', sub: 'Médio Inf.' },
    { z: 0, label: '0 (P50)', sub: 'Média (μ)' },
    { z: 1, label: '+1σ (P84)', sub: 'Médio Sup.' },
    { z: 2, label: '+2σ (P98)', sub: 'Superior' },
    { z: 3, label: '+3σ (P99.9)', sub: 'M. Superior' },
  ];

  zMarks.forEach((m) => {
    const x = zToX(m.z);
    // Linha tracejada suave
    ctx.strokeStyle = m.z === 0 ? '#6366f1' : '#e2e8f0';
    ctx.lineWidth = m.z === 0 ? 2 : 1;
    ctx.setLineDash(m.z === 0 ? [3, 3] : [2, 3]);
    ctx.beginPath();
    ctx.moveTo(x, curveBaseY);
    ctx.lineTo(x, curveBaseY - (gaussian(m.z) / maxGaussian) * curveMaxHeight);
    ctx.stroke();
    ctx.setLineDash([]); // Reset

    // Ticks e labels no eixo X
    ctx.fillStyle = m.z === 0 ? '#4338ca' : '#475569';
    ctx.font = m.z === 0 ? 'bold 11px sans-serif' : '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, x, curveBaseY + 16);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.fillText(m.sub, x, curveBaseY + 28);
  });

  // Plotar pontos/marcadores dos testes na curva normal
  validTests.forEach((t) => {
    const classInfo = getPercentileClassification(t.percentile);
    const z = Math.max(-3, Math.min(3, classInfo.zScore));
    const x = zToX(z);
    const y = curveBaseY - (gaussian(z) / maxGaussian) * curveMaxHeight;

    // Marcador circular
    ctx.fillStyle = classInfo.color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Divisória sutil entre curva e barras
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(32, curveBaseY + 42);
  ctx.lineTo(width - 32, curveBaseY + 42);
  ctx.stroke();

  // 3. SEÇÃO INFERIOR: BARRAS HORIZONTAIS DE PERCENTIL POR TESTE
  const barStartY = curveBaseY + 70;
  const labelColWidth = 360;
  const barAreaLeft = labelColWidth + 20;
  const barAreaWidth = width - barAreaLeft - 180;

  // Cabeçalho da grade de barras
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('INSTRUMENTO / DOMÍNIO COGNITIVO', 32, barStartY - 10);
  ctx.fillText('PERCENTIL OBTIDO (0 A 100)', barAreaLeft, barStartY - 10);
  ctx.textAlign = 'right';
  ctx.fillText('CLASSIFICAÇÃO', width - 40, barStartY - 10);

  // Linhas dos testes
  validTests.forEach((test, idx) => {
    const y = barStartY + 14 + idx * rowHeight;
    const classInfo = getPercentileClassification(test.percentile);

    // Linha de fundo alternada sutil
    if (idx % 2 === 0) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(24, y - 18, width - 48, rowHeight - 4);
    }

    // Nome do Teste e Domínio
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${test.testName}:`, 32, y);

    ctx.fillStyle = '#334155';
    ctx.font = '11px sans-serif';
    const testNameWidth = ctx.measureText(`${test.testName}: `).width;
    // Trunca se muito longo
    let domainStr = test.domain;
    if (domainStr.length > 34) domainStr = domainStr.substring(0, 32) + '...';
    ctx.fillText(domainStr, 32 + testNameWidth, y);

    // Trilho de fundo da barra de percentil
    const barHeight = 14;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(barAreaLeft, y - 11, barAreaWidth, barHeight, 4);
    ctx.fill();

    // Linha central da mediana (P50) tracejada no trilho
    const medianX = barAreaLeft + barAreaWidth * 0.5;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(medianX, y - 14);
    ctx.lineTo(medianX, y + 5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Preenchimento da barra colorida com base no percentil
    const pValue = Math.max(1, Math.min(100, Number(test.percentile) || 0));
    const fillWidth = Math.max(8, (pValue / 100) * barAreaWidth);

    ctx.fillStyle = classInfo.color;
    ctx.beginPath();
    ctx.roundRect(barAreaLeft, y - 11, fillWidth, barHeight, 4);
    ctx.fill();

    // Valor do Percentil sobre ou ao lado da barra
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    const pText = `P${pValue}${test.standardScore ? ` (EP ${test.standardScore})` : ''}`;
    ctx.fillText(pText, barAreaLeft + barAreaWidth + 12, y);

    // Pílula / Badge da Classificação Qualitativa à direita
    ctx.textAlign = 'right';
    ctx.fillStyle = classInfo.color;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(classInfo.label, width - 40, y);
  });

  // 4. LEGENDA NORMATIVA NO RODAPÉ
  const footerY = height - 24;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Legenda de Classificação: ', 32, footerY);

  const legendItems = [
    { label: 'Deficitário (<P2)', color: '#e11d48' },
    { label: 'Limítrofe (P2-P8)', color: '#ea580c' },
    { label: 'Médio (P9-P90)', color: '#6366f1' },
    { label: 'Superior (>P90)', color: '#059669' },
  ];

  let legendX = 180;
  legendItems.forEach((item) => {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(legendX, footerY - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, legendX + 8, footerY);
    legendX += ctx.measureText(item.label).width + 26;
  });

  return canvas;
}

/**
 * Converte o Canvas do Gráfico Cognitivo em string Base64 PNG de alta definição
 */
export function generateCognitiveProfileImage(
  tests: PsychometricTestScore[],
  options: ChartOptions = {}
): string | null {
  const canvas = generateCognitiveProfileCanvas(tests, options);
  if (!canvas) return null;
  return canvas.toDataURL('image/png', 0.95);
}
