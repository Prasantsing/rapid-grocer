const userRepository = require('../repositories/user.repository');
const { resolvePermissions } = require('../config/permissions');
const { verifyAccessToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new ApiError(401, 'Authentication required'));

  try {
    const payload = verifyAccessToken(token);
    const user = await userRepository.findById(payload.sub);
    if (!user || !user.isActive) return next(new ApiError(401, 'Account unavailable'));
    req.user = user;
    req.permissions = resolvePermissions(user);
    return next();
  } catch {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = { authenticate };
