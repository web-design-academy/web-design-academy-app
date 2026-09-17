const environment = require("../config/env");
const {OAuth2Client} = require("google-auth-library");
const ServerError = require("../errors/ServerError");

const client = new OAuth2Client(environment.googleClientId);

const cookieOptions = {
  httpOnly: true,
  secure: environment.isProduction,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

async function getGoogleUserFromAccessToken(accessToken) {
  const tokenInfo = await client.getTokenInfo(accessToken);

  if (tokenInfo.aud !== environment.googleClientId) {
    throw new ServerError("Invalid token audience", 401);
  }

  const userInfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!userInfoResponse.ok) {
    throw new ServerError("Failed to fetch Google profile", 401);
  }

  const profile = await userInfoResponse.json();

  if (!profile.email || profile.email_verified === false) {
    throw new ServerError("Email not verified or invalid Google profiel", 401);
  }

  return {
    email: profile.email,
    name: profile.name || profile.email,
  };
}

async function getGoogleUser({ idToken, accessToken }) {
  if (idToken) {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: environment.googleClientId,
    });

    const payload = ticket.getPayload();
    return {
      email: payload.email,
      name: payload.name || payload.email,
    };
  }

  return getGoogleUserFromAccessToken(accessToken);
}

function isAllowedUniversityEmail(email) {
  if (environment.allowedDomains.size === 0)
    return true;

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain)
    return false;

  for (const allowedDomain of environment.allowedDomains) {
    if (domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)) {
      return true;
    }
  }

  return false;
}

module.exports = {
  cookieOptions,
  getGoogleUser,
  isAllowedUniversityEmail
};
