const Address = require('../models/Address');

const addressRepository = {
  listByUser(userId) {
    return Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 });
  },

  findByIdForUser(id, userId) {
    return Address.findOne({ _id: id, user: userId });
  },

  countByUser(userId) {
    return Address.countDocuments({ user: userId });
  },

  create(data) {
    return Address.create(data);
  },

  save(address) {
    return address.save();
  },

  async clearDefault(userId, exceptId) {
    const filter = { user: userId, isDefault: true };
    if (exceptId) filter._id = { $ne: exceptId };
    await Address.updateMany(filter, { $set: { isDefault: false } });
  },

  async remove(address) {
    await address.deleteOne();
  },

  findFirst(userId) {
    return Address.findOne({ user: userId }).sort({ createdAt: 1 });
  },
};

module.exports = addressRepository;
