const messagingService = require('../services/messaging.service');

const messagingController = {
  async sendTestMessage(req, res, next) {
    try {
      const { channel, phone } = req.body;
      const log = await messagingService.sendTestMessage(channel, phone);
      res.json({
        success: true,
        data: {
          message: `Test ${channel.toUpperCase()} alert sent to ${phone}`,
          log,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getLogs(req, res, next) {
    try {
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const logs = await messagingService.getRecentLogs(limit);
      res.json({
        success: true,
        data: logs,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = messagingController;
