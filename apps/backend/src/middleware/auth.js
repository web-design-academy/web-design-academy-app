const jwt = require("jsonwebtoken");
const environment = require("../config/env");
const ServerError = require("../errors/ServerError");
const userRepository = require("../repositories/user");

const authenticateToken = (req, res, next) => {
  const token = req.cookies[environment.cookieName];

  if (!token)
    throw new ServerError("No token provided", 401);

  try {
    req.user = jwt.verify(token, environment.jwtSecret);
    next();
  } catch (err) {
    throw new ServerError("Invalid or expired token", 403);
  }
};

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    throw new ServerError("Forbidden", 403);
  }

  next();
}

module.exports = {
  authenticateToken,
  requireAdmin
};
