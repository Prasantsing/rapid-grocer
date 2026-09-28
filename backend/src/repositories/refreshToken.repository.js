const RefreshToken = require('../models/RefreshToken');

const refreshTokenRepository = {
  create(data) {
    return RefreshToken.create(data);
  },

  findValid(tokenHash) {
    return RefreshToken.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
  },

  async revokeById(id) {
    await RefreshToken.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  },

  async revokeByHash(tokenHash) {
    await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { $set: { revokedAt: new Date() } });
  },
};

module.exports = refreshTokenRepository;
