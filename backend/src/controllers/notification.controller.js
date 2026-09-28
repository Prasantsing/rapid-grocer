const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const notificationService = require('../services/notification.service');

const notificationController = {
  list: asyncHandler(async (req, res) => {
    send(res, await notificationService.list(req.user._id, req.query));
  }),

  markRead: asyncHandler(async (req, res) => {
    send(res, await notificationService.markRead(req.user._id, req.params.id));
  }),

  markAllRead: asyncHandler(async (req, res) => {
    send(res, await notificationService.markAllRead(req.user._id));
  }),
};

module.exports = notificationController;
