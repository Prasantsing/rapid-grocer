const ApiError = require('../utils/ApiError');

function authorize(...required) {
  return (req, _res, next) => {
    const permissions = req.permissions || [];
    const missing = required.filter((permission) => !permissions.includes(permission));
    if (missing.length) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    return next();
  };
}

function authorizeAny(...required) {
  return (req, _res, next) => {
    const permissions = req.permissions || [];
    if (!required.some((permission) => permissions.includes(permission))) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = { authorize, authorizeAny };
