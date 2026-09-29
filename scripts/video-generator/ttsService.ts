import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';
import { TourScene } from './tours/overview-60s.js';

const ffmpegPath = ffmpegStatic as string;

export interface AudioGenerationResult {
  fullAudioPath: string;
  srtPath: string;
  sceneDurations: number[];
  totalDuration: number;
}

export async function generateTourAudio(
  scenes: TourScene[],
  outputDir: string,
  voice: string = 'pt-BR-FranciscaNeural'
): Promise<AudioGenerationResult> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const segmentAudioPaths: string[] = [];
  const sceneDurations: number[] = [];
  let currentTime = 0;
  const srtEntries: string[] = [];

  const formatSrtTime = (sec: number) => {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(Math.floor(sec % 60)).padStart(2, '0');
    const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, '0');
    return `${h}:${m}:${s},${ms}`;
  };

  console.log(`🎙️ Sintetizando narração neural em Português (${voice})...`);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const segmentAudio = path.join(outputDir, `segment_${i}.mp3`);
    const cleanText = scene.narration.replace(/"/g, '\\"');

    // Executa edge-tts para o segmento
    execSync(`python -m edge_tts --voice ${voice} --text "${cleanText}" --write-media "${segmentAudio}"`, {
      stdio: 'pipe',
    });

    // Mede duração com ffmpeg (saída de info)
    let durationOutput = '';
    try {
      durationOutput = execSync(`"${ffmpegPath}" -i "${segmentAudio}" -f null - 2>&1`, { encoding: 'utf8' });
    } catch (e: any) {
      durationOutput = (e.stdout || '') + (e.stderr || '') + (e.output ? e.output.join('\n') : '');
    }
    const match = durationOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    let durationSeconds = 8; // fallback padrão
    if (match) {
      const hours = parseFloat(match[1]);
      const minutes = parseFloat(match[2]);
      const seconds = parseFloat(match[3]);
      durationSeconds = hours * 3600 + minutes * 60 + seconds;
    }

    // Adiciona uma pequena pausa de 0.8s entre as cenas para transição natural
    const pauseSeconds = 0.8;
    const totalSegmentDuration = durationSeconds + pauseSeconds;

    segmentAudioPaths.push(segmentAudio);
    sceneDurations.push(totalSegmentDuration);

    // Divide o texto em fragmentos curtos de 5 a 7 palavras para legendas limpas e discretas
    const words = scene.narration.split(' ');
    const chunkSize = 6;
    const chunks: string[] = [];
    for (let w = 0; w < words.length; w += chunkSize) {
      chunks.push(words.slice(w, w + chunkSize).join(' '));
    }
    const chunkDuration = durationSeconds / chunks.length;

    for (let c = 0; c < chunks.length; c++) {
      const chunkStart = currentTime + c * chunkDuration;
      const chunkEnd = chunkStart + chunkDuration - 0.1;
      const entryIndex = srtEntries.length + 1;
      srtEntries.push(`${entryIndex}\n${formatSrtTime(chunkStart)} --> ${formatSrtTime(chunkEnd)}\n${chunks[c]}\n`);
    }

    currentTime += totalSegmentDuration;

    console.log(`  -> Bloco ${i + 1} (${scene.title}): ${durationSeconds.toFixed(1)}s [${chunks.length} legendas curtas]`);
  }

  // Gera lista de concatenação com silêncio suave
  const concatListFile = path.join(outputDir, 'concat_list.txt');
  const fileLines = segmentAudioPaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatListFile, fileLines);

  const fullAudioPath = path.join(outputDir, 'narration_full.mp3');
  // Concatena com ffmpeg
  execSync(`"${ffmpegPath}" -y -f concat -safe 0 -i "${concatListFile}" -c copy "${fullAudioPath}"`, {
    stdio: 'pipe',
  });

  const srtPath = path.join(outputDir, 'subtitles.srt');
  fs.writeFileSync(srtPath, srtEntries.join('\n'), 'utf8');

  console.log(`✅ Áudio completo gerado: ${currentTime.toFixed(1)}s em ${fullAudioPath}`);

  return {
    fullAudioPath,
    srtPath,
    sceneDurations,
    totalDuration: currentTime,
  };
}
