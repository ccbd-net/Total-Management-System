import fs from 'fs';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes/api.ts';
import { db } from './server/db.ts';
import {
  BRAND_ASSET_FILENAMES,
  getDynamicManifest,
  resolveBrandAssetFile,
  type BrandAssetFilename,
} from './server/brandAssets.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  // JSON Body Parser with 50MB limit for high-res logo and image uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Explicitly serve /sw.js with dynamic brand version so SW updates propagate automatically
  app.get('/sw.js', (_req, res) => {
    const version = db.getBrandAssetVersion();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const swPath = path.resolve(__dirname, 'public', 'sw.js');
    try {
      const raw = fs.readFileSync(swPath, 'utf-8');
      const injected = raw
        .replace(/__BRAND_ASSET_VERSION__/g, String(version))
        .replace(/__CACHE_NAME__/g, `vms-pwa-v5-${version}`);
      res.send(injected);
    } catch {
      res.sendFile(swPath);
    }
  });

  // Explicitly serve dynamic manifest with current brand asset version (?v=...)
  app.get(['/manifest.json', '/manifest.webmanifest'], (_req, res) => {
    const version = db.getBrandAssetVersion();
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(getDynamicManifest(version));
  });

  // Serve brand icons/favicons/logos with instant revalidation (supports live uploaded icons)
  const assetRoutes = BRAND_ASSET_FILENAMES.map((f) => `/${f}`);
  app.get(assetRoutes, (req, res, next) => {
    const filename = req.path.replace(/^\//, '') as BrandAssetFilename;
    const filePath = resolveBrandAssetFile(filename);
    if (!fs.existsSync(filePath)) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    if (filename.endsWith('.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
    } else if (filename.endsWith('.jpg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filename.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
    return res.sendFile(filePath);
  });

  // Serve static assets from public (manifest, icons, etc.)
  app.use(express.static(path.resolve(__dirname, 'public')));

  // API Routes
  app.use('/api', apiRouter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Development mode: Mount Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built client assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚌 ZB SYSTEM Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ZB SYSTEM server:', err);
  process.exit(1);
});
