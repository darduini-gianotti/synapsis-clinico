import path from 'path';
import fs from 'fs';
import { OVERVIEW_TOUR_SCENES } from './tours/overview-60s.js';
import { generateTourAudio } from './ttsService.js';
import { recordTourScreen } from './screenRecorder.js';
import { composeDualFormatVideos } from './videoCompositor.js';

async function main() {
  const startTime = Date.now();
  console.log(`🚀 [Synapsis Clínico] Iniciando Pipeline de Geração Automática de Vídeos...`);

  const rootDir = process.cwd();
  const workDir = path.join(rootDir, 'temp_video_build');
  const publicVideosDir = path.join(rootDir, 'public', 'videos');

  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }
  if (!fs.existsSync(publicVideosDir)) {
    fs.mkdirSync(publicVideosDir, { recursive: true });
  }

  // 1. Gera áudio e legendas cronometradas
  const audioResult = await generateTourAudio(OVERVIEW_TOUR_SCENES, workDir, 'pt-BR-FranciscaNeural');

  // 2. Grava a tela real com Playwright no timing exato de cada cena
  const screenResult = await recordTourScreen(OVERVIEW_TOUR_SCENES, audioResult.sceneDurations, workDir);

  if (!screenResult.rawVideoPath || !fs.existsSync(screenResult.rawVideoPath)) {
    throw new Error('Gravação de tela não encontrada para processamento.');
  }

  // 3. Composição final em 16:9 e 9:16
  const output16x9Path = path.join(publicVideosDir, 'synapsis_overview_16x9.mp4');
  const output9x16Path = path.join(publicVideosDir, 'synapsis_overview_9x16.mp4');

  composeDualFormatVideos({
    rawVideoPath: screenResult.rawVideoPath,
    audioPath: audioResult.fullAudioPath,
    srtPath: audioResult.srtPath,
    output16x9Path,
    output9x16Path,
    startOffsetSec: screenResult.startOffsetSec,
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Pipeline concluído com sucesso em ${durationSec}s!`);
  console.log(`📁 Vídeo 16:9: ${output16x9Path} (${(fs.statSync(output16x9Path).size / 1024 / 1024).toFixed(2)} MB)`);
  if (fs.existsSync(output9x16Path)) {
    console.log(`📁 Vídeo 9:16: ${output9x16Path} (${(fs.statSync(output9x16Path).size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

main().catch((err) => {
  console.error('❌ Falha na geração do vídeo:', err);
  process.exit(1);
});
