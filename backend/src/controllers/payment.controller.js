const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const paymentService = require('../services/payment.service');

const paymentController = {
  create: asyncHandler(async (req, res) => {
    send(res, await paymentService.createRazorpayOrder(req.user, req.body.orderId));
  }),

  verify: asyncHandler(async (req, res) => {
    send(res, await paymentService.verify(req.user, req.body));
  }),
};

module.exports = paymentController;
