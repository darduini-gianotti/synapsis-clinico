const { execSync } = require('child_process');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlPath = 'C:/Projetos/Psicogestão/scratch/guia_impressao.html';
const pdf2p = 'C:/Projetos/Psicogestão/docs/GUIA_DECISAO_COMERCIAL_SYNAPSIS_VS_PSICOMANAGER_2PAGINAS.pdf';
execSync(`"${chromePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${pdf2p}" "file:///${htmlPath}"`);
console.log('Versão 2 páginas gerada com sucesso em:', pdf2p);
