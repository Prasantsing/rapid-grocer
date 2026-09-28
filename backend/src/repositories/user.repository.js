const User = require('../models/User');

const userRepository = {
  findByEmail(email, withPassword = false) {
    const query = User.findOne({ email: String(email).toLowerCase() });
    if (withPassword) query.select('+password');
    return query;
  },

  findById(id, withPassword = false) {
    const query = User.findById(id);
    if (withPassword) query.select('+password');
    return query;
  },

  create(data) {
    return User.create(data);
  },

  async list({ role, search, page, limit, activeOnly = false }) {
    const filter = {};
    if (role) filter.role = role;
    if (activeOnly) filter.isActive = true;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
      ];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    return { items, total };
  },

  countActiveAdmins(excludeId) {
    const filter = { role: 'admin', isActive: true };
    if (excludeId) filter._id = { $ne: excludeId };
    return User.countDocuments(filter);
  },

  save(user) {
    return user.save();
  },
};

module.exports = userRepository;
