const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const authService = require('./auth.service');
const { ALL_PERMISSIONS, PERMISSIONS, resolvePermissions } = require('../config/permissions');
const { pageMeta } = require('../utils/pagination');
const { escapeRegex } = require('../utils/slug');
const ApiError = require('../utils/ApiError');

function knownPermissions(list = []) {
  return list.filter((permission) => ALL_PERMISSIONS.includes(permission));
}

const userService = {
  async list(query) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const { items, total } = await userRepository.list({
      role: query.role,
      search: query.search ? escapeRegex(query.search) : undefined,
      page,
      limit,
      activeOnly: query.activeOnly === 'true',
    });
    return {
      items: items.map((user) => authService.publicUser(user)),
      meta: pageMeta(page, limit, total),
    };
  },

  async create(input) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new ApiError(409, 'An account with this email already exists');
    const user = await userRepository.create({
      name: input.name.trim(),
      email: input.email.toLowerCase(),
      phone: input.phone || '',
      password: await bcrypt.hash(input.password, 12),
      role: input.role,
      isActive: input.isActive !== false,
    });
    return authService.publicUser(user);
  },

  async update(actor, id, input) {
    const user = await userRepository.findById(id);
    if (!user) throw new ApiError(404, 'User not found');

    const wasActiveAdmin = user.role === 'admin' && user.isActive;
    if (input.name) user.name = input.name.trim();
    if (input.phone !== undefined) user.phone = input.phone || '';
    if (input.role) user.role = input.role;
    if (input.isActive !== undefined) user.isActive = input.isActive;
    if (input.permissionGrants) user.permissionGrants = knownPermissions(input.permissionGrants);
    if (input.permissionRevokes) user.permissionRevokes = knownPermissions(input.permissionRevokes);

    const stillActiveAdmin = user.role === 'admin' && user.isActive;
    if (wasActiveAdmin && !stillActiveAdmin) {
      if (String(user._id) === String(actor._id)) {
        throw new ApiError(409, 'You cannot deactivate or demote your own admin account');
      }
      const others = await userRepository.countActiveAdmins(user._id);
      if (others < 1) throw new ApiError(409, 'At least one active admin is required');
    }

    if (String(user._id) === String(actor._id) && !resolvePermissions(user).includes(PERMISSIONS.USERS_WRITE)) {
      throw new ApiError(409, 'You cannot remove your own user-management permission');
    }

    await userRepository.save(user);
    return authService.publicUser(user);
  },
};

module.exports = userService;
