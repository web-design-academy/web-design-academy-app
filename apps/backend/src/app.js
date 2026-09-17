const express = require('express');
const path = require('path');
const cookieParser = require("cookie-parser");

const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');
const githubRouter = require('./routes/github');
const reposRouter = require('./routes/repos');

const errorHandler = require('./middleware/error');
const ServerError = require('./errors/ServerError');

const {
  corsMiddleware,
  helmetMiddleware,
  verifyOrigin,
  apiLimiter
} = require('./middleware/security');
const logger = require('./middleware/logger');

const app = express();
const environment = require('./config/env');

if (environment.isProduction)
  app.set("trust proxy", 1);

app.use(logger);
app.use(corsMiddleware);
app.use(helmetMiddleware);
app.use(express.json({ limit: "512kb" }));
app.use(cookieParser());

app.use("/api", [verifyOrigin, apiLimiter]);

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/github", githubRouter);
app.use("/api/repos", reposRouter);

if (environment.isProduction) {
  const staticPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(staticPath));
}

app.all("/api", (req, res, next) => {
  next(new ServerError(`Endpoint ${req.method} ${req.originalUrl} not found`, 404));
});

if (environment.isProduction) {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

app.use(errorHandler);

module.exports = app;
