const User = require('../models/User');
const inMemoryStore = require('../services/inMemoryStore');

const userRepository = {
  async findByEmail(email, withPassword = false) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.findUserByEmailOrPhone(email);
    }
    try {
      const query = User.findOne({ email: String(email).toLowerCase() });
      if (withPassword) query.select('+password');
      return await query;
    } catch (_) {
      return inMemoryStore.findUserByEmailOrPhone(email);
    }
  },

  async findByEmailOrPhone(identifier, withPassword = false) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.findUserByEmailOrPhone(identifier);
    }
    try {
      const raw = String(identifier || '').trim();
      const phoneDigits = raw.replace(/^(?:\+91|91|0)/, '').replace(/\D/g, '');
      const is10DigitPhone = phoneDigits.length === 10;

      const orConditions = [{ email: raw.toLowerCase() }];
      if (is10DigitPhone) {
        orConditions.push({ phone: phoneDigits });
        orConditions.push({ phone: raw });
      } else if (phoneDigits.length >= 7) {
        orConditions.push({ phone: phoneDigits });
      }

      const query = User.findOne({ $or: orConditions });
      if (withPassword) query.select('+password');
      return await query;
    } catch (_) {
      return inMemoryStore.findUserByEmailOrPhone(identifier);
    }
  },

  async findById(id, withPassword = false) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.findUserById(id);
    }
    try {
      const query = User.findById(id);
      if (withPassword) query.select('+password');
      return await query;
    } catch (_) {
      return inMemoryStore.findUserById(id);
    }
  },

  async create(data) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.createUser(data);
    }
    try {
      return await User.create(data);
    } catch (_) {
      return inMemoryStore.createUser(data);
    }
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
