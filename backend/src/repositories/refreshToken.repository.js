const RefreshToken = require('../models/RefreshToken');
const inMemoryStore = require('../services/inMemoryStore');

const refreshTokenRepository = {
  async create(data) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.saveRefreshToken(data);
    }
    try {
      return await RefreshToken.create(data);
    } catch (_) {
      return inMemoryStore.saveRefreshToken(data);
    }
  },

  async findValid(tokenHash) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.findRefreshToken(tokenHash);
    }
    try {
      return await RefreshToken.findOne({
        tokenHash,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      });
    } catch (_) {
      return inMemoryStore.findRefreshToken(tokenHash);
    }
  },

  async revokeById(id) {
    if (!inMemoryStore.isDbConnected()) return;
    try {
      await RefreshToken.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    } catch (_) {}
  },

  async revokeByHash(tokenHash) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.revokeRefreshToken(tokenHash);
    }
    try {
      await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { $set: { revokedAt: new Date() } });
    } catch (_) {
      inMemoryStore.revokeRefreshToken(tokenHash);
    }
  },
};

module.exports = refreshTokenRepository;
