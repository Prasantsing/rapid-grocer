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

  upiDetails: asyncHandler(async (req, res) => {
    send(res, await paymentService.getUpiDetails(req.user, req.params.id || req.params.orderId));
  }),

  submitUpi: asyncHandler(async (req, res) => {
    send(res, await paymentService.submitUpi(req.user, req.body));
  }),

  upiStatus: asyncHandler(async (req, res) => {
    send(res, await paymentService.getUpiStatus(req.user, req.params.id || req.params.orderId));
  }),

  gatewayCallback: asyncHandler(async (req, res) => {
    send(res, await paymentService.processGatewayCallback(req.body));
  }),

  pingGateway: asyncHandler(async (req, res) => {
    send(res, await paymentService.pingGateway(req.user, req.body));
  }),

  verifyUpi: asyncHandler(async (req, res) => {
    send(res, await paymentService.verifyUpi(req.user, req.body));
  }),
};

module.exports = paymentController;
