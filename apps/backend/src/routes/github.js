const crypto = require('crypto');
const router = require("express").Router();
const asyncHandler = require("../middleware/asyncError")
const {
  getAuthUrl,
  deleteAuthorization,
  exchangeCode,
  assignUser,
  getProfile,
  getRemoteRepositories,
  getRemoteRepository
} = require("../services/github");
const { authenticateToken } = require("../middleware/auth");
const ServerError = require("../errors/ServerError");
const environment = require("../config/env")

const STATE_COOKIE_NAME = "gh_state";

router.use(authenticateToken);

router.get("/link", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");

  res.cookie(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: environment.isProduction,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  res.redirect(getAuthUrl(state));
});

router.delete("/link", asyncHandler(async (req, res) => {
  await deleteAuthorization(req.user.sub);
  res.json({ success: true });
}));

router.get("/callback", asyncHandler(async (req, res) => {
  const {code, state, installation_id: installationId} = req.query;
  const storedState = req.cookies[STATE_COOKIE_NAME];
  res.clearCookie(STATE_COOKIE_NAME);

  if (!code || !state)
    throw new ServerError("Missing parameters", 400);

  if (!storedState || state !== storedState)
    throw new ServerError("State error", 400);

  const {token, refreshToken, expiresAt} = await exchangeCode(code, state);
  await assignUser(req.user.sub, token, refreshToken, expiresAt, installationId);

  res.json({ success: true });
}));

router.get("/me", asyncHandler(async (req, res) => {
  const profile = await getProfile(req.user.sub);
  res.json(profile);
}));

router.get("/repositories", asyncHandler(async (req, res) => {
  res.json(await getRemoteRepositories(req.user.sub));
}));

router.get("/repositories/:id", asyncHandler(async (req, res) => {
  const repoId = req.params.id;
  const remote = await getRemoteRepository(req.user.sub, repoId);
  res.json(remote);
}));

module.exports = router;