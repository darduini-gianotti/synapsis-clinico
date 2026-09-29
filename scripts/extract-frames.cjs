const { execSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const path = require('path');

const dest = 'C:\\Users\\Sergio DArduini\\.gemini\\antigravity\\brain\\b5675ff9-4c31-450e-af02-daacc28dd1ef';
const points = [
  { time: '00:00:06', file: 'preview_neuro_cena1.png' },
  { time: '00:00:22', file: 'preview_neuro_cena2.png' },
  { time: '00:00:38', file: 'preview_neuro_cena3.png' },
  { time: '00:00:54', file: 'preview_neuro_cena4.png' },
  { time: '00:01:14', file: 'preview_neuro_cena5.png' }
];

points.forEach(p => {
  const outPath = path.join(dest, p.file);
  const cmd = `"${ffmpeg}" -ss ${p.time} -i public/videos/synapsis_neuro_16x9.mp4 -frames:v 1 -y "${outPath}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log(`Saved ${p.file}`);
});
