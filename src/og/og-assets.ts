import { readFile } from 'fs/promises';
import path from 'path';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_BG = '#070811';

const root = process.cwd();

export const ogFonts = async () => {
  const [regular, semibold] = await Promise.all([
    readFile(path.join(root, 'src/og/fonts/geist-400.ttf')),
    readFile(path.join(root, 'src/og/fonts/geist-600.ttf')),
  ]);
  return [
    { name: 'Geist', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Geist', data: semibold, weight: 600 as const, style: 'normal' as const },
  ];
};

export const ogImage = async (publicPath: string): Promise<string> => {
  const data = await readFile(path.join(root, 'public', publicPath));
  return `data:image/png;base64,${data.toString('base64')}`;
};
