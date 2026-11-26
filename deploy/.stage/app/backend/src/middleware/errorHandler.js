const ApiError = require("../core/ApiError");
const config = require("../config");

function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || "Something went wrong";
  let details = err.details;

  // Mongoose validation -> 422 with a field map the client can render inline.
  if (err.name === "ValidationError" && err.errors) {
    status = 422;
    message = "Validation failed";
    details = Object.fromEntries(
      Object.entries(err.errors).map(([path, e]) => [path, e.message])
    );
  }

  // Duplicate key -> 409 naming the field that clashed.
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0] || "value";
    message = `A record with this ${field} already exists`;
    details = err.keyValue;
  }

  // Bad ObjectId in a path param reads as "not found", not a 500.
  if (err.name === "CastError" && err.kind === "ObjectId") {
    status = 404;
    message = "Not found";
  }

  if (err.name === "JsonWebTokenError") { status = 401; message = "Invalid token"; }
  if (err.name === "TokenExpiredError") { status = 401; message = "Session expired"; }

  if (status >= 500) console.error("[error]", err);

  res.status(status).json({
    success: false,
    error: { message, ...(details ? { details } : {}) },
    ...(config.isProd ? {} : { stack: status >= 500 ? err.stack : undefined }),
  });
}

module.exports = { notFound, errorHandler };
