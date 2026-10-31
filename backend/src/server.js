const env = require('./config/env');
const { connectDb } = require('./config/db');
const app = require('./app');
const { seedIfEmpty } = require('./seed/seed');

function main() {
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`ZapBasket server listening on http://0.0.0.0:${env.port}`);
    console.log(`Swagger docs at http://0.0.0.0:${env.port}/api/docs`);
  });

  server.on('error', (err) => {
    console.error(`ZapBasket server error on port ${env.port}:`, err.message);
  });

  (async () => {
    try {
      const conn = await connectDb();
      if (conn && env.seedOnBoot) {
        const seeded = await seedIfEmpty();
        if (seeded) {
          console.log('Seeded database with the ZapBasket catalog and demo accounts.');
        }
      }
    } catch (error) {
      console.warn('[AI Studio] Database init warning:', error.message);
    }
  })();

  const shutdown = (signal) => {
    console.log(`${signal} received, closing API`);
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
