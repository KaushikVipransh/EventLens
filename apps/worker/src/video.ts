import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/** Video duration in whole seconds via ffprobe, or null if it can't be read. */
async function probeDurationSeconds(inputPath: string): Promise<number | null> {
  try {
    const { stdout } = await exec('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=nk=1:np=1',
      inputPath,
    ]);
    const n = Number.parseFloat(stdout.trim());
    return Number.isFinite(n) ? Math.round(n) : null;
  } catch {
    return null;
  }
}

/**
 * Sample up to `maxFrames` JPEG frames (1 fps) from a video buffer, plus its
 * duration. Requires `ffmpeg`/`ffprobe` on PATH (added to the worker image).
 */
export async function extractFrames(
  videoBytes: Buffer,
  maxFrames = 15,
): Promise<{ frames: Buffer[]; durationSeconds: number | null }> {
  const dir = await mkdtemp(join(tmpdir(), 'eventlens-vid-'));
  try {
    const input = join(dir, 'input');
    await writeFile(input, videoBytes);
    const durationSeconds = await probeDurationSeconds(input);
    await exec('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      input,
      '-vf',
      'fps=1',
      '-frames:v',
      String(maxFrames),
      '-q:v',
      '3',
      join(dir, 'f_%03d.jpg'),
    ]);
    const files = (await readdir(dir)).filter((f) => f.startsWith('f_')).sort();
    const frames = await Promise.all(files.map((f) => readFile(join(dir, f))));
    return { frames, durationSeconds };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
