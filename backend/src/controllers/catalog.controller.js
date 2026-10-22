const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const categoryService = require('../services/category.service');
const productService = require('../services/product.service');

const catalogController = {
  categories: asyncHandler(async (_req, res) => {
    send(res, await categoryService.list());
  }),

  category: asyncHandler(async (req, res) => {
    send(res, await categoryService.getBySlug(req.params.slug));
  }),

  products: asyncHandler(async (req, res) => {
    send(res, await productService.list(req.query));
  }),

  product: asyncHandler(async (req, res) => {
    send(res, await productService.getBySlug(req.params.slug));
  }),
};

module.exports = catalogController;
