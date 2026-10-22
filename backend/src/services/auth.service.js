const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const refreshTokenRepository = require('../repositories/refreshToken.repository');
const notificationService = require('./notification.service');
const { resolvePermissions } = require('../config/permissions');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

const DUMMY_HASH = bcrypt.hashSync('zapbasket-dummy-password', 12);

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    isActive: user.isActive,
    permissions: resolvePermissions(user),
    permissionGrants: user.permissionGrants || [],
    permissionRevokes: user.permissionRevokes || [],
    createdAt: user.createdAt,
  };
}

async function issueSession(user, meta = {}) {
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id) });
  const decoded = verifyRefreshToken(refreshToken);
  await refreshTokenRepository.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(decoded.exp * 1000),
    userAgent: meta.userAgent || '',
    ip: meta.ip || '',
  });
  return { accessToken, refreshToken, user: publicUser(user) };
}

const authService = {
  publicUser,

  async register(input, meta) {
    const emailClean = input.email.trim().toLowerCase();
    const existing = await userRepository.findByEmail(emailClean);
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    const cleanPhone = input.phone
      ? String(input.phone).replace(/^(?:\+91|91|0)/, '').replace(/\D/g, '')
      : '';
    if (cleanPhone && cleanPhone.length === 10) {
      const existingPhone = await userRepository.findByEmailOrPhone(cleanPhone);
      if (existingPhone) throw new ApiError(409, 'An account with this mobile number already exists');
    }

    const user = await userRepository.create({
      name: input.name.trim(),
      email: emailClean,
      phone: cleanPhone || (input.phone || '').trim(),
      password: await bcrypt.hash(input.password, 12),
      role: 'customer',
    });

    await notificationService.create({
      user: user._id,
      title: 'Welcome to ZapBasket',
      body: 'Your 12-minute grocery run starts here. Save a delivery address to check out faster.',
      type: 'system',
      link: '/addresses',
    });

    return issueSession(user, meta);
  },

  async login(input, meta) {
    const identifier = String(input.identifier || input.email || '').trim();
    if (!identifier) throw new ApiError(400, 'Please enter your email or mobile number');

    const user = await userRepository.findByEmailOrPhone(identifier, true);
    const hash = user?.password || DUMMY_HASH;
    const matches = await bcrypt.compare(input.password, hash);
    if (!user || !matches) {
      throw new ApiError(401, 'Email, mobile number, or password is incorrect');
    }
    if (!user.isActive) {
      throw new ApiError(403, 'This account has been deactivated. Contact support.');
    }
    return issueSession(user, meta);
  },

  async refresh(token, meta) {
    if (!token) throw new ApiError(401, 'Refresh token missing');

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw new ApiError(401, 'Refresh token invalid');
    }

    const stored = await refreshTokenRepository.findValid(hashToken(token));
    if (!stored) throw new ApiError(401, 'Refresh token revoked or expired');

    const user = await userRepository.findById(decoded.sub);
    if (!user || !user.isActive) throw new ApiError(401, 'Account unavailable');

    await refreshTokenRepository.revokeById(stored._id);
    return issueSession(user, meta);
  },

  async logout(token) {
    if (!token) return;
    try {
      verifyRefreshToken(token);
      await refreshTokenRepository.revokeByHash(hashToken(token));
    } catch {
      // Expired tokens can still be cleared by the client cookie.
    }
  },

  async me(userId) {
    const user = await userRepository.findById(userId);
    if (!user || !user.isActive) throw new ApiError(401, 'Account unavailable');
    return publicUser(user);
  },

  async updateMe(userId, input) {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'Account not found');
    if (input.name) user.name = input.name.trim();
    if (input.phone !== undefined) user.phone = input.phone || '';
    await userRepository.save(user);
    return publicUser(user);
  },
};

module.exports = authService;
