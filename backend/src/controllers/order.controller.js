const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const orderService = require('../services/order.service');
const receiptVerificationService = require('../services/receiptVerification.service');
const gstService = require('../services/gst.service');

const orderController = {
  list: asyncHandler(async (req, res) => {
    send(res, await orderService.list(req.user, req.query));
  }),

  get: asyncHandler(async (req, res) => {
    send(res, await orderService.getById(req.user, req.params.id));
  }),

  place: asyncHandler(async (req, res) => {
    send(res, await orderService.place(req.user, req.body), 201);
  }),

  cancel: asyncHandler(async (req, res) => {
    send(res, await orderService.cancel(req.user, req.params.id, req.body?.note));
  }),

  cancelAndRestore: asyncHandler(async (req, res) => {
    send(res, await orderService.cancelAndRestoreCart(req.user, req.params.id, req.body?.note));
  }),

  switchToCod: asyncHandler(async (req, res) => {
    send(res, await orderService.switchToCod(req.user, req.params.id));
  }),

  updateStatus: asyncHandler(async (req, res) => {
    send(res, await orderService.updateStatus(req.user, req.params.id, req.body.status, req.body.note));
  }),

  accept: asyncHandler(async (req, res) => {
    send(res, await orderService.accept(req.user, req.params.id));
  }),

  assign: asyncHandler(async (req, res) => {
    send(res, await orderService.assign(req.user, req.params.id, req.body.deliveryPartnerId));
  }),

  verifyReceipt: asyncHandler(async (req, res) => {
    send(res, await receiptVerificationService.verifyReceipt(req.user, req.params.id, req.body.image));
  }),

  submitManualUtr: asyncHandler(async (req, res) => {
    send(res, await receiptVerificationService.submitManualUtr(req.user, req.params.id, req.body.utr, req.body.note));
  }),

  invoice: asyncHandler(async (req, res) => {
    send(res, await gstService.getOrderInvoice(req.params.id));
  }),
};

module.exports = orderController;
