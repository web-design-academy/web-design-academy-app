const environment = require("../config/env");

function error(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  console.error(`ERROR: ${message} (${statusCode}) on ${req.method} ${req.originalUrl}`);
  console.error(err.stack);

  res.status(statusCode).json({
    error: message,
    ...(environment.isProduction ? {} : { stack: err.stack }),
  });
}

module.exports = error;
