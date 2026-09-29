import 'dotenv/config';
import express, { Response } from 'express';
import path from 'path';
import zlib from 'zlib';
import { createServer as createViteServer } from 'vite';
import { getDb } from './server/db.js';
import { router as apiRouter } from './server/routes.js';

async function startServer() {
  const app = express();
  const PORT = 3333;

  // JSON Body Parser with limit for clinical files/documents
  app.use(express.json({ limit: '10mb' }));

  // Gracefully handle malformed JSON bodies without crashing the server process
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
      console.warn('[Server] Ignored malformed JSON payload from:', req.ip);
      return res.status(400).json({ error: 'Malformed JSON payload' });
    }
    next(err);
  });

  // HTTP Gzip Compression Middleware (Node.js native zlib - zero external dependencies)
  app.use((req, res, next) => {
    const acceptEncoding = (req.headers['accept-encoding'] as string) || '';
    if (!acceptEncoding.includes('gzip')) {
      return next();
    }

    let isCompressing = false;
    const originalSend = res.send.bind(res);
    res.send = function (body: any): Response {
      if (!body || isCompressing) return originalSend(body);

      const isBuffer = Buffer.isBuffer(body);
      const isString = typeof body === 'string';

      // Compress responses over 1KB
      const rawBuffer = isBuffer ? body : isString ? Buffer.from(body) : Buffer.from(JSON.stringify(body));
      if (rawBuffer.length < 1024) {
        return originalSend(body);
      }

      isCompressing = true;
      res.setHeader('Content-Encoding', 'gzip');
      res.removeHeader('Content-Length');

      zlib.gzip(rawBuffer, (err, compressed) => {
        if (err) {
          isCompressing = false;
          return originalSend(body);
        }
        res.setHeader('Content-Length', compressed.length);
        originalSend(compressed);
      });
      return res;
    };

    next();
  });

  // CORS & Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Initialize SQLite database instance
  try {
    await getDb();
    console.log('SQLite Database with sql.js initialized successfully.');
  } catch (err) {
    console.error('Database initialization failed:', err);
  }

  // Initialize PostgreSQL schema if configured (e.g. AWS Lightsail)
  try {
    const { isPgEnabled, initPgSchema } = await import('./server/pgClient.js');
    if (isPgEnabled()) {
      await initPgSchema();
    }
  } catch (pgErr) {
    console.error('PostgreSQL cloud init warning:', pgErr);
  }

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'PsicoGestão SaaS API',
      lgpd_compliance: 'AES-256-GCM At-Rest Enabled',
      cfp_compliance: 'CFP 06/2019 & 01/2009 Standards Active',
      timestamp: new Date().toISOString(),
    });
  });

  // Serve static Landing Page for Synapsi Clínico
  const landingPath = path.join(process.cwd(), 'landing');
  app.use('/landing', express.static(landingPath));
  app.get('/landing', (req, res) => {
    res.sendFile(path.join(landingPath, 'index.html'));
  });

  // Serve static video tutorials and demos for Synapsis Clínico
  const videosPath = path.join(process.cwd(), 'public', 'videos');
  app.use('/videos', express.static(videosPath));

  // Mount API router
  app.use('/api', apiRouter);

  // 404 handler for API routes (prevent falling through to Vite SPA / HTML)
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Endpoint não encontrado: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { maxAge: '1y', immutable: true }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PsicoGestão SaaS running on http://localhost:${PORT}`);
  });
}

startServer();
