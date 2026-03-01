import app from './app.js';
import { closeDb, getDb, getDbPath } from './db/index.js';
import { scheduleBackup } from './services/backupService.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Initialize database
getDb();
console.log('[DB] Database initialized');
console.log(`[DB] Database path: ${getDbPath()}`);

// Schedule WebDAV backup
scheduleBackup();

// Start server
const server = app.listen(Number(PORT), HOST, () => {
  console.log(`[Server] Running on http://${HOST}:${PORT}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[Server] Port ${PORT} is already in use on ${HOST}.`);
    console.error('[Server] Stop the existing process or set a different PORT, e.g. PORT=3001 pnpm dev');
    closeDb();
    process.exit(1);
  }

  console.error('[Server] Failed to start:', error.message);
  closeDb();
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  closeDb();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  closeDb();
  server.close(() => {
    process.exit(0);
  });
});
