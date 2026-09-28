const notificationRepository = require('../repositories/notification.repository');
const { presentNotification } = require('../utils/presenters');
const { pageMeta } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');

const notificationService = {
  create(data) {
    return notificationRepository.create(data);
  },

  async list(userId, query) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const { items, total, unread } = await notificationRepository.list(userId, { page, limit });
    return {
      items: items.map(presentNotification),
      unread,
      meta: pageMeta(page, limit, total),
    };
  },

  async markRead(userId, id) {
    const notification = await notificationRepository.findByIdForUser(id, userId);
    if (!notification) throw new ApiError(404, 'Notification not found');
    notification.read = true;
    await notificationRepository.save(notification);
    return presentNotification(notification);
  },

  async markAllRead(userId) {
    await notificationRepository.markAllRead(userId);
    return { updated: true };
  },
};

module.exports = notificationService;
