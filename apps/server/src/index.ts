import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { log } from './log.js';

const config = loadConfig();
const app = createApp(config);

app
  .listen()
  .then((port) => {
    log.info('server_started', {
      port,
      production: config.production,
      static: config.staticDir !== null,
    });
  })
  .catch((err: unknown) => {
    log.error('server_start_failed', { error: String(err) });
    process.exit(1);
  });

let stopping = false;
const shutdown = (signal: string): void => {
  if (stopping) return;
  stopping = true;
  log.info('server_stopping', { signal });
  const force = setTimeout(() => process.exit(0), 5_000);
  force.unref();
  void app.close().then(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  log.error('uncaught_exception', { error: String(err?.stack ?? err) });
});
process.on('unhandledRejection', (err) => {
  log.error('unhandled_rejection', { error: String(err) });
});
