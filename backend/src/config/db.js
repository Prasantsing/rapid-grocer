const mongoose = require('mongoose');
const env = require('./env');

let memoryServer;

async function startMemoryMongo() {
  if (memoryServer) return memoryServer.getUri();
  const path = require('path');
  const fs = require('fs');
  const { MongoMemoryServer } = require('mongodb-memory-server');

  // For testing, always use an isolated ephemeral memory database
  const isTest = process.env.NODE_ENV === 'test';
  if (!isTest) {
    try {
      const dbPath = path.resolve(__dirname, '../../data/db');
      fs.mkdirSync(dbPath, { recursive: true });
      const lockFile = path.join(dbPath, 'mongod.lock');
      if (fs.existsSync(lockFile)) {
        try { fs.unlinkSync(lockFile); } catch (_) {}
      }
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath,
          storageEngine: 'wiredTiger',
        },
      });
      return memoryServer.getUri();
    } catch (err) {
      console.warn('[AI Studio] Persistent MongoMemoryServer lock/startup failed, falling back to ephemeral:', err.message);
      memoryServer = undefined;
    }
  }

  // Ephemeral fallback (isolated in-memory mongod)
  memoryServer = await MongoMemoryServer.create();
  return memoryServer.getUri();
}

async function connectDb() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);

  let uri = env.mongoUri;
  if (env.useMemoryMongo) {
    try {
      uri = await startMemoryMongo();
      console.log('MongoMemoryServer ready at', uri);
    } catch (err) {
      console.warn('Failed to start MongoMemoryServer, falling back to uri:', uri, err.message);
    }
  }

  try {
    await mongoose.connect(uri || 'mongodb://127.0.0.1:27017/zapbasket', {
      serverSelectionTimeoutMS: 8000,
    });
    console.log('MongoDB connected successfully to', uri.includes('mongodb.net') ? 'MongoDB Atlas' : 'Local/Embedded');
    return mongoose.connection;
  } catch (err) {
    console.warn('[AI Studio] Primary MongoDB connection failed:', err.message);
    if (!memoryServer) {
      try {
        console.log('[AI Studio] Falling back to ephemeral in-memory MongoDB...');
        uri = await startMemoryMongo();
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log('In-memory MongoDB connected successfully at', uri);
        return mongoose.connection;
      } catch (memErr) {
        console.warn('[AI Studio] In-memory MongoDB fallback failed:', memErr.message);
      }
    }
    return null;
  }
}

async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}

module.exports = { connectDb, disconnectDb };
