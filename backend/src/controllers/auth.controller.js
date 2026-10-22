const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const authService = require('../services/auth.service');
const env = require('../config/env');

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/api/v1/auth',
  };
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', cookieOptions());
}

function meta(req) {
  return { userAgent: req.get('user-agent') || '', ip: req.ip || '' };
}

function tokenFrom(req) {
  return req.cookies?.refreshToken || req.body?.refreshToken || '';
}

const authController = {
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body, meta(req));
    setRefreshCookie(res, result.refreshToken);
    send(res, { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken }, 201);
  }),

  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body, meta(req));
    setRefreshCookie(res, result.refreshToken);
    send(res, { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
  }),

  refresh: asyncHandler(async (req, res) => {
    const result = await authService.refresh(tokenFrom(req), meta(req));
    setRefreshCookie(res, result.refreshToken);
    send(res, { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(tokenFrom(req));
    clearRefreshCookie(res);
    send(res, { loggedOut: true });
  }),

  me: asyncHandler(async (req, res) => {
    send(res, await authService.me(req.user._id));
  }),

  updateMe: asyncHandler(async (req, res) => {
    send(res, await authService.updateMe(req.user._id, req.body));
  }),
};

module.exports = authController;
