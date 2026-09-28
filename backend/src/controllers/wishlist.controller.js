const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const wishlistService = require('../services/wishlist.service');

const wishlistController = {
  get: asyncHandler(async (req, res) => {
    send(res, await wishlistService.get(req.user._id));
  }),

  add: asyncHandler(async (req, res) => {
    send(res, await wishlistService.add(req.user._id, req.params.productId));
  }),

  remove: asyncHandler(async (req, res) => {
    send(res, await wishlistService.remove(req.user._id, req.params.productId));
  }),
};

module.exports = wishlistController;
