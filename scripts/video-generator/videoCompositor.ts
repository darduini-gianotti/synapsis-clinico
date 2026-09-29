import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';

const ffmpegPath = ffmpegStatic as string;

export interface CompositorOptions {
  rawVideoPath: string;
  audioPath: string;
  srtPath?: string;
  output16x9Path: string;
  output9x16Path: string;
  startOffsetSec?: number;
}

export function composeDualFormatVideos(options: CompositorOptions) {
  const { rawVideoPath, audioPath, output16x9Path, output9x16Path, startOffsetSec = 0 } = options;

  console.log(`🎬 Iniciando composição de vídeo com FFmpeg (Sem legendas embutidas - 100% clean)...`);
  if (startOffsetSec > 0) {
    console.log(`  -> Compensando offset de carregamento inicial: ${startOffsetSec.toFixed(2)}s`);
  }

  const ssOpt = startOffsetSec > 0 ? `-ss ${startOffsetSec.toFixed(2)} ` : '';

  const rootDir = process.cwd();
  const intro16x9 = path.join(rootDir, 'public', 'videos', 'assets', 'synapsis_intro_16x9.mp4');
  const intro9x16 = path.join(rootDir, 'public', 'videos', 'assets', 'synapsis_intro_9x16.mp4');
  const tempBody16x9 = path.join(path.dirname(output16x9Path), 'temp_body_16x9.mp4');
  const tempBody9x16 = path.join(path.dirname(output9x16Path), 'temp_body_9x16.mp4');

  // 1. Renderização 16:9 Widescreen (Limpo e nítido)
  console.log(`  -> Renderizando corpo do vídeo Horizontal 16:9...`);
  try {
    const cmd16x9 = `"${ffmpegPath}" -y ${ssOpt}-i "${rawVideoPath}" -i "${audioPath}" -filter_complex "[0:v]scale=1920:1080,format=yuv420p[v]" -map "[v]" -map 1:a -c:v libx264 -preset fast -crf 20 -c:a aac -b:a 192k -shortest "${tempBody16x9}"`;
    execSync(cmd16x9, { stdio: 'pipe' });
  } catch (err: any) {
    console.warn(`Tentando fallback 16:9:`, err.message);
    const cmdFallback = `"${ffmpegPath}" -y ${ssOpt}-i "${rawVideoPath}" -i "${audioPath}" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${tempBody16x9}"`;
    execSync(cmdFallback, { stdio: 'pipe' });
  }

  if (fs.existsSync(intro16x9) && fs.existsSync(tempBody16x9)) {
    console.log(`  -> Acoplando Vinheta Oficial Quantum Cyber 16:9 na abertura...`);
    try {
      const concatCmd = `"${ffmpegPath}" -y -i "${intro16x9}" -i "${tempBody16x9}" -filter_complex "[0:v]scale=1920:1080,setsar=1,fps=25,format=yuv420p[v0];[0:a]aformat=sample_rates=48000:channel_layouts=stereo[a0];[1:v]scale=1920:1080,setsar=1,fps=25,format=yuv420p[v1];[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -preset fast -crf 20 -c:a aac -b:a 192k "${output16x9Path}"`;
      execSync(concatCmd, { stdio: 'pipe' });
      fs.unlinkSync(tempBody16x9);
      console.log(`  ✅ 16:9 com Vinheta Oficial Cyber concluído com sucesso!`);
    } catch (e: any) {
      console.warn(`Fallback: movendo corpo 16:9 direto para saída:`, e.message);
      fs.renameSync(tempBody16x9, output16x9Path);
    }
  } else if (fs.existsSync(tempBody16x9)) {
    fs.renameSync(tempBody16x9, output16x9Path);
  }

  // 2. Renderização 9:16 Vertical (Reels / Shorts / TikTok)
  console.log(`  -> Renderizando versão Vertical 9:16 (${path.basename(output9x16Path)})...`);
  try {
    const filter9x16 = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];[0:v]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]`;
    const cmd9x16 = `"${ffmpegPath}" -y ${ssOpt}-i "${rawVideoPath}" -i "${audioPath}" -filter_complex "${filter9x16}" -map "[v]" -map 1:a -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k -shortest "${tempBody9x16}"`;
    execSync(cmd9x16, { stdio: 'pipe' });

    if (fs.existsSync(intro9x16) && fs.existsSync(tempBody9x16)) {
      console.log(`  -> Acoplando Vinheta Oficial Quantum Cyber 9:16 na abertura...`);
      const concatCmd9x16 = `"${ffmpegPath}" -y -i "${intro9x16}" -i "${tempBody9x16}" -filter_complex "[0:v]scale=1080:1920,setsar=1,fps=25,format=yuv420p[v0];[0:a]aformat=sample_rates=48000:channel_layouts=stereo[a0];[1:v]scale=1080:1920,setsar=1,fps=25,format=yuv420p[v1];[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k "${output9x16Path}"`;
      execSync(concatCmd9x16, { stdio: 'pipe' });
      fs.unlinkSync(tempBody9x16);
      console.log(`  ✅ 9:16 com Vinheta Oficial Cyber concluído com sucesso!`);
    } else if (fs.existsSync(tempBody9x16)) {
      fs.renameSync(tempBody9x16, output9x16Path);
    }
  } catch (err: any) {
    console.error(`Erro ao gerar 9:16:`, err.message);
  }
}
