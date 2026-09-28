const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const addressService = require('../services/address.service');

const addressController = {
  list: asyncHandler(async (req, res) => {
    send(res, await addressService.list(req.user._id));
  }),

  create: asyncHandler(async (req, res) => {
    send(res, await addressService.create(req.user._id, req.body), 201);
  }),

  update: asyncHandler(async (req, res) => {
    send(res, await addressService.update(req.user._id, req.params.id, req.body));
  }),

  remove: asyncHandler(async (req, res) => {
    send(res, await addressService.remove(req.user._id, req.params.id));
  }),
};

module.exports = addressController;
