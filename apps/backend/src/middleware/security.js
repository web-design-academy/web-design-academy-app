const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const environment = require("../config/env");
const ServerError = require("../errors/ServerError");

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || environment.corsOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new ServerError("Untrusted origin", 403));
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  credentials: true,
});

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "blob:",
        "https://cdn.jsdelivr.net",
        "https://accounts.google.com/gsi/client",
      ],
      "script-src-elem": [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "blob:",
        "https://cdn.jsdelivr.net",
        "https://accounts.google.com/gsi/client",
      ],
      "style-src": [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://accounts.google.com/gsi/style",
        "https://fonts.googleapis.com",
      ],
      "style-src-elem": [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://accounts.google.com/gsi/style",
        "https://fonts.googleapis.com",
      ],
      "img-src": ["'self'", "https:", "data:", "blob:"],
      "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
      "connect-src": [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://accounts.google.com/gsi/",
        "https://accounts.google.com/gsi/client",
      ],
      "frame-src": ["'self'", "https://accounts.google.com/gsi/"],
      "worker-src": ["'self'", "blob:"],
    },
  },
  crossOriginOpenerPolicy: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, try again later" },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again later" },
});

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const verifyOrigin = (req, res, next) => {
  if (!writeMethods.has(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  if (!origin || environment.corsOrigins.has(origin)) {
    return next();
  }

  return next(new ServerError("Untrusted origin", 403));
};

module.exports = {
  corsMiddleware,
  helmetMiddleware,
  authLimiter,
  apiLimiter,
  verifyOrigin,
};
