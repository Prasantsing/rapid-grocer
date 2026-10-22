const env = require('./config/env');
const { connectDb } = require('./config/db');
const app = require('./app');
const { seedIfEmpty } = require('./seed/seed');

function main() {
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`ZapBasket server listening on http://0.0.0.0:${env.port}`);
    console.log(`Swagger docs at http://0.0.0.0:${env.port}/api/docs`);
  });

  const rawPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
  let altServer = null;
  if (rawPort && rawPort !== env.port && !isNaN(rawPort)) {
    try {
      altServer = app.listen(rawPort, '0.0.0.0', () => {
        console.log(`ZapBasket Cloud Run ingress listener active on http://0.0.0.0:${rawPort}`);
      });
    } catch (e) {
      console.warn('Could not bind secondary port:', e.message);
    }
  }

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
      if (altServer) {
        altServer.close(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
