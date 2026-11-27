import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const BRAND_DATA_DIR = path.resolve(ROOT_DIR, 'data', 'brand');
const DEFAULT_SOURCE_IMAGE = path.resolve(
  PUBLIC_DIR,
  'assets',
  'aistudio',
  '1795788013102_417ccb35.jpg'
);

export const BRAND_ASSET_FILENAMES = [
  'logo.png',
  'logo.jpg',
  'favicon.png',
  'favicon.ico',
  'apple-touch-icon.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'pwa-maskable-512x512.png',
] as const;

export type BrandAssetFilename = (typeof BRAND_ASSET_FILENAMES)[number];

export function ensureBrandDir() {
  if (!fs.existsSync(BRAND_DATA_DIR)) {
    fs.mkdirSync(BRAND_DATA_DIR, { recursive: true });
  }
}

export function resolveBrandAssetFile(filename: BrandAssetFilename): string {
  const customFile = path.join(BRAND_DATA_DIR, filename);
  if (fs.existsSync(customFile)) {
    return customFile;
  }
  return path.join(PUBLIC_DIR, filename);
}

export function getDynamicManifest(version: number | string) {
  const v = encodeURIComponent(String(version || '2026112701'));
  return {
    id: '/',
    name: 'Vehicles Management System',
    short_name: 'VMS',
    description: 'Vehicles Management System - Powered by Data&Code',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#1d4ed8',
    theme_color: '#1d4ed8',
    categories: ['business', 'travel', 'productivity'],
    icons: [
      {
        src: `/pwa-192x192.png?v=${v}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/pwa-512x512.png?v=${v}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/pwa-maskable-512x512.png?v=${v}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

function syncFileToDestinations(srcPath: string, filename: BrandAssetFilename) {
  const destinations = [
    path.join(BRAND_DATA_DIR, filename),
    path.join(PUBLIC_DIR, filename),
  ];

  if (fs.existsSync(DIST_DIR)) {
    destinations.push(path.join(DIST_DIR, filename));
  }

  if (filename === 'favicon.ico') {
    destinations.push(path.join(ROOT_DIR, 'favicon.ico'));
  }

  for (const dest of destinations) {
    if (path.resolve(dest) === path.resolve(srcPath)) continue;
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(srcPath, dest);
    } catch {
      // Ignore optional mirror errors (e.g. if dist doesn't exist)
    }
  }
}

export async function generateBrandAssetsFromBuffer(imageBuffer: Buffer): Promise<void> {
  ensureBrandDir();
  const tmpInput = path.join(BRAND_DATA_DIR, `upload_${Date.now()}.tmp`);
  const tmpFeathered = path.join(BRAND_DATA_DIR, `feathered_${Date.now()}.png`);

  try {
    fs.writeFileSync(tmpInput, imageBuffer);

    const outLogoPng = path.join(BRAND_DATA_DIR, 'logo.png');
    const outLogoJpg = path.join(BRAND_DATA_DIR, 'logo.jpg');
    const outPwa512 = path.join(BRAND_DATA_DIR, 'pwa-512x512.png');
    const outPwa192 = path.join(BRAND_DATA_DIR, 'pwa-192x192.png');
    const outApple = path.join(BRAND_DATA_DIR, 'apple-touch-icon.png');
    const outFaviconPng = path.join(BRAND_DATA_DIR, 'favicon.png');
    const outFaviconIco = path.join(BRAND_DATA_DIR, 'favicon.ico');
    const outMaskable = path.join(BRAND_DATA_DIR, 'pwa-maskable-512x512.png');

    // 1. Master 512x512 PNG logo
    await execFileAsync('convert', [
      tmpInput,
      '-auto-orient',
      '-resize',
      '512x512^',
      '-gravity',
      'center',
      '-extent',
      '512x512',
      '-depth',
      '8',
      '-strip',
      outLogoPng,
    ]);

    // 2. JPG logo variant
    await execFileAsync('convert', [outLogoPng, '-background', '#030b1a', '-flatten', '-quality', '92', '-strip', outLogoJpg]);

    // 3. PWA 512x512 any
    fs.copyFileSync(outLogoPng, outPwa512);

    // 4. PWA 192x192 any
    await execFileAsync('convert', [outLogoPng, '-resize', '192x192', '-depth', '8', '-strip', outPwa192]);

    // 5. iOS Apple Touch Icon 180x180
    await execFileAsync('convert', [outLogoPng, '-resize', '180x180', '-depth', '8', '-strip', outApple]);

    // 6. PNG Favicon 64x64
    await execFileAsync('convert', [outLogoPng, '-resize', '64x64', '-depth', '8', '-strip', outFaviconPng]);

    // 7. Multi-size ICO Favicon (16, 32, 48, 64)
    await execFileAsync('convert', [
      outLogoPng,
      '-define',
      'icon:auto-resize=64,48,32,16',
      outFaviconIco,
    ]);

    // 8. Sample outer corner color for seamless Android Maskable 512x512 safe zone
    let cornerColor = 'srgb(3,11,26)';
    try {
      const { stdout } = await execFileAsync('convert', [
        outLogoPng,
        '-alpha',
        'off',
        '-format',
        '%[pixel:p{4,4}]',
        'info:',
      ]);
      const detected = stdout.trim();
      if (detected) cornerColor = detected;
    } catch {
      // Fallback to deep navy
    }

    await execFileAsync('convert', [
      outLogoPng,
      '-resize',
      '416x416',
      '-alpha',
      'set',
      '(',
      '+clone',
      '-alpha',
      'extract',
      '-virtual-pixel',
      'black',
      '-blur',
      '0x14',
      '-level',
      '15%,85%',
      ')',
      '-compose',
      'CopyOpacity',
      '-composite',
      tmpFeathered,
    ]);

    await execFileAsync('convert', [
      '-size',
      '512x512',
      `xc:${cornerColor}`,
      tmpFeathered,
      '-gravity',
      'center',
      '-compose',
      'Over',
      '-composite',
      '-alpha',
      'off',
      '-depth',
      '8',
      '-strip',
      outMaskable,
    ]);

    // Mirror to public/, dist/ (if built), and root favicon.ico
    for (const fname of BRAND_ASSET_FILENAMES) {
      syncFileToDestinations(path.join(BRAND_DATA_DIR, fname), fname);
    }
  } finally {
    try {
      if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
    } catch {}
    try {
      if (fs.existsSync(tmpFeathered)) fs.unlinkSync(tmpFeathered);
    } catch {}
  }
}

export async function restoreDefaultBrandAssets(): Promise<void> {
  if (!fs.existsSync(DEFAULT_SOURCE_IMAGE)) {
    throw new Error('ডিফল্ট লোগো ফাইল পাওয়া যায়নি।');
  }
  const buffer = fs.readFileSync(DEFAULT_SOURCE_IMAGE);
  await generateBrandAssetsFromBuffer(buffer);
}
