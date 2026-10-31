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

  interpretVoiceSearch: asyncHandler(async (req, res) => {
    const { text = '', language = 'en-IN' } = req.body;
    const { transliterateVoiceQuery } = require('../utils/hinglishAliases');
    const result = transliterateVoiceQuery(text);
    send(res, {
      raw: text,
      cleanQuery: result.cleanQuery || text,
      terms: result.terms,
      language,
    });
  }),
};

module.exports = catalogController;
