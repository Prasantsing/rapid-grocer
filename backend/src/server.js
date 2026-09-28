const env = require('./config/env');
const { connectDb } = require('./config/db');
const app = require('./app');
const { seedIfEmpty } = require('./seed/seed');

async function main() {
  await connectDb();
  if (env.seedOnBoot) {
    const seeded = await seedIfEmpty();
    if (seeded) {
      console.log('Seeded an empty database with the ZapBasket catalog and demo accounts.');
    }
  }

  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`ZapBasket API listening on http://127.0.0.1:${env.port}`);
    console.log(`Swagger docs at http://127.0.0.1:${env.port}/api/docs`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, closing API`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Failed to start ZapBasket API');
  console.error(error);
  process.exit(1);
});
