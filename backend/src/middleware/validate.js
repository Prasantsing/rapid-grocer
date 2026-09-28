const { ZodError } = require('zod');
const ApiError = require('../utils/ApiError');

function formatZod(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body ?? {},
      query: req.query ?? {},
      params: req.params ?? {},
    });
    if (!parsed.success) {
      const error = parsed.error instanceof ZodError ? parsed.error : new ZodError([]);
      return next(new ApiError(422, 'Validation failed', formatZod(error)));
    }
    if (parsed.data.body !== undefined) req.body = parsed.data.body;
    if (parsed.data.query !== undefined) req.query = parsed.data.query;
    if (parsed.data.params !== undefined) req.params = parsed.data.params;
    return next();
  };
}

module.exports = { validate, formatZod };
