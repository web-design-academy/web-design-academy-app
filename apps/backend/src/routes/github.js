const crypto = require('crypto');
const router = require("express").Router();
const asyncHandler = require("../middleware/asyncError")
const {
  getOAuthUrl,
  deleteAuthorization,
  exchangeCode,
  assignUser,
  refreshUser,
  getRemoteRepositories,
  getRemoteRepository
} = require("../services/github");
const { authenticateToken } = require("../middleware/auth");
const ServerError = require("../errors/ServerError");

router.use(authenticateToken);

router.get("/link", (req, res) => {
  const state = crypto.randomBytes(16).toString();

  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  res.redirect(getOAuthUrl(state));
});

router.delete("/link", asyncHandler(async (req, res) => {
  await deleteAuthorization(req.user.sub);
  res.json({ success: true });
}));

router.get("/callback", asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies.oauth_state;
  res.clearCookie("oauth_state");

  if (!state || !storedState || state !== storedState)
    throw new ServerError("CSRF token error", 400);

  if (!code)
    throw new ServerError("Authentication code is missing", 400);

  const { token, scopes } = await exchangeCode(code, state);
  let parsedScopes = [];
  if (scopes instanceof Array) {
    if (scopes.length === 1)
      parsedScopes = scopes[0].split(",");
    else
      parsedScopes = scopes;
  } else if (scopes instanceof String) {
    parsedScopes = scopes.split(",");
  }

  await assignUser(req.user.sub, parsedScopes, token);

  res.json({ success: true });
}));

router.get("/me", asyncHandler(async (req, res) => {
  const profile = await refreshUser(req.user.sub);
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