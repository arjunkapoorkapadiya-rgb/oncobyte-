import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes.ts';
import { getDb } from './server/db.ts';

async function startServer() {
  // Initialize persistent database store
  getDb();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // Independent OncoByte REST API
  app.use('/api', apiRouter);

  // Centralized API error handler
  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[OncoByte API Error]', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unexpected failure',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OncoByte server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
