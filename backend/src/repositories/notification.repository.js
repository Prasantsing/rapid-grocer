const Notification = require('../models/Notification');

const notificationRepository = {
  create(data) {
    return Notification.create(data);
  },

  async list(userId, { page, limit }) {
    const filter = { user: userId };
    const skip = (page - 1) * limit;
    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);
    return { items, total, unread };
  },

  findByIdForUser(id, userId) {
    return Notification.findOne({ _id: id, user: userId });
  },

  async markAllRead(userId) {
    await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
  },

  save(notification) {
    return notification.save();
  },
};

module.exports = notificationRepository;
