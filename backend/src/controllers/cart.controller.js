const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const cartService = require('../services/cart.service');

const cartController = {
  get: asyncHandler(async (req, res) => {
    send(res, await cartService.get(req.user._id));
  }),

  addItem: asyncHandler(async (req, res) => {
    send(res, await cartService.addItem(req.user._id, req.body.productId, req.body.quantity));
  }),

  updateItem: asyncHandler(async (req, res) => {
    send(res, await cartService.updateItem(req.user._id, req.params.productId, req.body.quantity));
  }),

  removeItem: asyncHandler(async (req, res) => {
    send(res, await cartService.removeItem(req.user._id, req.params.productId));
  }),

  clear: asyncHandler(async (req, res) => {
    send(res, await cartService.clear(req.user._id));
  }),

  applyCoupon: asyncHandler(async (req, res) => {
    send(res, await cartService.applyCoupon(req.user._id, req.body.code));
  }),

  removeCoupon: asyncHandler(async (req, res) => {
    send(res, await cartService.removeCoupon(req.user._id));
  }),
};

module.exports = cartController;
