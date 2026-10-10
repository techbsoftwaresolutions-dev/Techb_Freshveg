const ApiError = require("../core/ApiError");

// validate({ body: schema, query: schema, params: schema })
// Replaces req.body/query/params with the parsed value, so handlers work with
// coerced types (numbers, booleans, dates) rather than raw strings.
const validate = (schemas) => (req, _res, next) => {
  for (const key of ["body", "query", "params"]) {
    const schema = schemas[key];
    if (!schema) continue;

    const result = schema.safeParse(req[key]);
    if (!result.success) {
      const details = {};
      for (const issue of result.error.issues) {
        details[issue.path.join(".") || key] = issue.message;
      }
      return next(ApiError.unprocessable("Validation failed", details));
    }
    // req.query is a getter on Express 5; assign per-key to stay compatible.
    if (key === "query") {
      Object.keys(req.query).forEach((k) => delete req.query[k]);
      Object.assign(req.query, result.data);
    } else {
      req[key] = result.data;
    }
  }
  return next();
};

module.exports = validate;
