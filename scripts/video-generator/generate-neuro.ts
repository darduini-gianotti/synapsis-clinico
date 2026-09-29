import path from 'path';
import fs from 'fs';
import { NEURO_TOUR_SCENES } from './tours/neuro-laudos-60s.js';
import { generateTourAudio } from './ttsService.js';
import { recordTourScreen } from './screenRecorder.js';
import { composeDualFormatVideos } from './videoCompositor.js';

async function main() {
  const startTime = Date.now();
  console.log(`🧠 [Synapsis Clínico] Iniciando Geração do Vídeo 2: Módulo Neuropsicológico & Laudos...`);

  const rootDir = process.cwd();
  const workDir = path.join(rootDir, 'temp_video_build_neuro');
  const publicVideosDir = path.join(rootDir, 'public', 'videos');

  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }
  if (!fs.existsSync(publicVideosDir)) {
    fs.mkdirSync(publicVideosDir, { recursive: true });
  }

  // 1. Gera narração de voz neural (FranciscaNeural) e marcações de tempo
  console.log(`\n🎙️  Etapa 1: Sintetizando narração neural e cronometrando cenas...`);
  const audioResult = await generateTourAudio(NEURO_TOUR_SCENES, workDir, 'pt-BR-FranciscaNeural');

  // 2. Grava a tela real com Playwright no timing exato de cada cena
  console.log(`\n🎥 Etapa 2: Capturando gravação de tela de alta precisão via Playwright...`);
  const screenResult = await recordTourScreen(NEURO_TOUR_SCENES, audioResult.sceneDurations, workDir);

  if (!screenResult.rawVideoPath || !fs.existsSync(screenResult.rawVideoPath)) {
    throw new Error('Gravação de tela não encontrada para processamento.');
  }

  // 3. Composição final em 16:9 (YouTube) e 9:16 (Shorts/Reels) com Vinheta Oficial Cyber
  console.log(`\n🎬 Etapa 3: Compondo vídeos em 16:9 e 9:16 com Vinheta Cyber Oficial...`);
  const output16x9Path = path.join(publicVideosDir, 'synapsis_neuro_16x9.mp4');
  const output9x16Path = path.join(publicVideosDir, 'synapsis_neuro_9x16.mp4');

  composeDualFormatVideos({
    rawVideoPath: screenResult.rawVideoPath,
    audioPath: audioResult.fullAudioPath,
    srtPath: audioResult.srtPath,
    output16x9Path,
    output9x16Path,
    startOffsetSec: screenResult.startOffsetSec,
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Vídeo 2 concluído com sucesso em ${durationSec}s!`);
  console.log(`📁 Vídeo 16:9: ${output16x9Path} (${(fs.statSync(output16x9Path).size / 1024 / 1024).toFixed(2)} MB)`);
  if (fs.existsSync(output9x16Path)) {
    console.log(`📁 Vídeo 9:16: ${output9x16Path} (${(fs.statSync(output9x16Path).size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

main().catch((err) => {
  console.error('❌ Falha na geração do Vídeo 2:', err);
  process.exit(1);
});
