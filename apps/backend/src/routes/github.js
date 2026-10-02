const crypto = require('crypto');
const router = require("express").Router();
const asyncHandler = require("../middleware/asyncError")
const {
  getAuthUrl,
  getInstallUrl,
  deleteAuthorization,
  exchangeCode,
  assignUser,
  getProfile,
  getRepositories,
  getRepository,
  syncInstallations
} = require("../services/github");
const { authenticateToken } = require("../middleware/auth");
const ServerError = require("../errors/ServerError");
const environment = require("../config/env")

const STATE_COOKIE_NAME = "gh_state";

router.use(authenticateToken);

function createState(res) {
  const state = crypto.randomBytes(16).toString("hex");

  res.cookie(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: environment.isProduction,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  return state;
}

router.get("/link", (req, res) => {
  const state = createState(res);
  res.redirect(getAuthUrl(state));
});

router.delete("/link", asyncHandler(async (req, res) => {
  await deleteAuthorization(req.user.sub);
  res.json({ success: true });
}));

router.get("/link/callback", asyncHandler(async (req, res) => {
  const {code, state, error} = req.query;

  if (error)
    return res.redirect(`${environment.frontendUrl}/profile/callback?error=${encodeURIComponent(error)}`);

  if (!code && !state)
    return res.redirect(`${environment.frontendUrl}/profile/callback?error=${encodeURIComponent("Invalid parameters")}`);

  const storedState = req.cookies[STATE_COOKIE_NAME];
  res.clearCookie(STATE_COOKIE_NAME);

  if (!storedState || state !== storedState)
    throw new ServerError("State error", 400);

  try {
    const {token, refreshToken, expiresAt} = await exchangeCode(code, state);
    console.log(req.user.sub);
    await assignUser(req.user.sub, token, refreshToken, expiresAt);

    const installations = await syncInstallations(req.user.sub);
    if (!installations || installations.length === 0)
      return res.redirect(getInstallUrl());

    return res.redirect(`${environment.frontendUrl}/profile/callback`);
  } catch (e) {
    return res.redirect(`${environment.frontendUrl}/profile/callback?error=${encodeURIComponent(e)}`);
  }
}));

router.get("/install", (req, res) => {
  res.redirect(getInstallUrl());
});

router.get("/install/callback", asyncHandler(async (req, res) => {
  const {installation_id, setup_action, error} = req.query;

  if (error)
    return res.redirect(`${environment.frontendUrl}/profile/callback?error=${encodeURIComponent(error)}`);

  if (!installation_id || !setup_action)
    return res.redirect(`${environment.frontendUrl}/profile/callback?error=${encodeURIComponent("Invalid parameters")}`);

  console.log(req.user.sub);
  await syncInstallations(req.user.sub);
  return res.redirect(`${environment.frontendUrl}/profile/callback`);
}));

router.get("/me", asyncHandler(async (req, res) => {
  const profile = await getProfile(req.user.sub);
  res.json(profile);
}));

router.get("/repositories", asyncHandler(async (req, res) => {
  res.json(await getRepositories(req.user.sub));
}));

router.get("/repositories/:id", asyncHandler(async (req, res) => {
  const repoId = req.params.id;
  const remote = await getRepository(req.user.sub, repoId);
  res.json(remote);
}));

module.exports = router;