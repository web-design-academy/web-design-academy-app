const router = require("express").Router();
const environment = require("../config/env");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("../middleware/auth");
const {
  cookieOptions,
  getGoogleUser,
  isAllowedUniversityEmail
} = require("../services/auth");
const repository = require("../repositories/user");
const ServerError = require("../errors/ServerError");

router.post("/google", async (req, res) => {
  const { idToken, accessToken } = req.body;
  if (!idToken && !accessToken)
    throw new ServerError("No Google token", 400);

  if (!environment.googleClientId || environment.adminEmails.size === 0)
    throw new ServerError("Authentication is not configured", 503);

  const { email, name } = await getGoogleUser({ idToken, accessToken });
  if (!email)
    throw new ServerError("Invalid Google Token", 401);

  const normalizedEmail = email.toLowerCase();

  const isVutEmail = isAllowedUniversityEmail(normalizedEmail);
  const isAdmin = environment.adminEmails.has(normalizedEmail);

  if (!isVutEmail && !isAdmin) {
    throw new ServerError("Access denied. This email domain is not allowed.", 403);
  }

  const role = isAdmin ? "admin" : "student";
  const user = repository.createUser({ id: uuidv4(), email, name, role });
  const token = jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      github_id: user.github_id
    },
    environment.jwtSecret,
    {expiresIn: environment.jwtExpiration},
  );

  res.cookie(environment.cookieName, token, cookieOptions);
  res.json({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    githubId: user.github_id
  });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(environment.cookieName, cookieOptions);
  res.json({ success: true });
});

router.get("/me", authenticateToken, (req, res) => {
  const user = repository.getUserBy(req.user.sub);
  if (!user)
    throw new ServerError("User not found", 401);

  res.json({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
    githubId: user.github_id ?? null,
    githubLogin: user.github_login ?? null,
    githubName: user.github_name ?? null,
    githubAvatarUrl: user.github_avatar_url ?? null,
    githubScopes: user.github_scopes ?? null,
  });
});

module.exports = router;
