const { Octokit } = require("octokit");
const { OAuthApp } = require("@octokit/oauth-app");
const environment = require("../config/env");
const {encrypt, decrypt} = require("../utils/encryption");
const userRepository = require("../repositories/user");
const ServerError = require("../errors/ServerError");

const auth = new OAuthApp({
  clientType: "github-app",
  clientId: environment.githubClientId,
  clientSecret: environment.githubClientSecret ?? "",
});

const TOKEN_REFRESH_MS = 5 * 60 * 1000;

function mapRepository(repo) {
  return {
    id: repo.id,
    name: repo.name,
    description: repo.description,
    language: repo.language,
    owner_login: repo.owner.login,
    html_url: repo.html_url,
    private: repo.private,
    default_branch: repo.default_branch,
    sha: repo.sha,
    created_at: repo.created_at,
    pushed_at: repo.pushed_at,
    updated_at: repo.updated_at
  }
}

function mapGitHubUser(user) {
  return {
    github_id: String(user.id),
    github_login: user.login,
    github_name: user.name,
    github_avatar_url: user.avatar_url,
  }
}

function getAuthUrl(state) {
  if (!state || typeof state !== "string")
    throw new ServerError("Invalid state parameter", 500)

  return auth.getWebFlowAuthorizationUrl({
    state: state,
  }).url;
}

function getInstallUrl(state) {
  if (!state || typeof state !== "string")
    throw new ServerError("Invalid state parameter", 500)

  return `https://github.com/apps/${environment.githubAppName}/installations/new?state=${state}`;
}

async function refreshAccessToken(userId, userTokens) {
  if (!userTokens.github_refresh_token)
    throw new ServerError("GitHub session expired, please re-link your account", 401);

  try {
    const {authentication} = await auth.refreshToken({
      refreshToken: decrypt(userTokens.github_refresh_token),
    });

    const expiresAtIso = authentication.expiresAt instanceof Date
      ? authentication.expiresAt.toISOString()
      : String(authentication.expiresAt);

    userRepository.updateUser(String(userId), {
      github_access_token: encrypt(authentication.token),
      github_refresh_token: encrypt(authentication.refreshToken),
      github_expires_at: expiresAtIso,
    });

    return authentication.token;
  } catch (error) {
    throw new ServerError("GitHub session expired, please re-link your account", 401);
  }
}

async function getAccessToken(userId) {
  const userTokens = userRepository.getUserTokensBy(userId);
  if (!userTokens)
    throw new ServerError("User not found", 401);
  if (!userTokens.github_id || !userTokens.github_access_token)
    throw new ServerError("User does not have GitHub account linked", 401);

  const expiresAt = userTokens.github_expires_at
      ? new Date(userTokens.github_expires_at).getTime()
      : null;

  if (!expiresAt || expiresAt - Date.now() < TOKEN_REFRESH_MS)
    return await refreshAccessToken(userId, userTokens);

  return decrypt(userTokens.github_access_token);
}

async function getOctokit(userId) {
  return new Octokit({
    auth: await getAccessToken(userId),
  });
}

async function deleteAuthorization(userId) {
  try {
    const token = await getAccessToken(userId);
    await auth.deleteAuthorization({token});
  } catch (e) {
    console.warn("GitHub authorization revocation failed: ", e.message);
  }

  userRepository.updateUser(String(userId), {
    github_id: null,
    github_installation_id: null,
    github_access_token: null,
    github_refresh_token: null,
    github_expires_at: null,
  })
}

async function getProfileFromToken(token) {
  const octokit = new Octokit({auth: token})

  try {
    const response = await octokit.rest.users.getAuthenticated();
    return mapGitHubUser(response.data);
  } catch (error) {
    throw new ServerError("Failed to fetch GitHub profile", 500);
  }
}

async function getProfile(userId) {
  return await getProfileFromToken(await getAccessToken(userId));
}

async function exchangeCode(code, state) {
  try {
    const response = await auth.createToken({
      code: code,
      state: state
    });

    const authentication = response.authentication;
    return {
      token: authentication.token,
      refreshToken: authentication.refreshToken,
      expiresAt: authentication.expiresAt,
    }
  } catch (error) {
    throw new ServerError("Failed to authenticate with GitHub", 500);
  }
}

async function assignUser(userId, token, refreshToken, expiresAt, installationId) {
  const profile = await getProfileFromToken(token);

  const existingUser = userRepository.getUserBy(profile.github_id, "github_id");
  if (existingUser && String(existingUser.id) !== String(userId))
    throw new ServerError("GitHub account is already linked to another account", 400);

  const expiresAtIso = expiresAt instanceof Date
    ? expiresAt.toISOString()
    : String(expiresAt);

  userRepository.updateUser(String(userId), {
    github_id: String(profile.github_id),
    github_access_token: encrypt(token),
    github_refresh_token: encrypt(refreshToken),
    github_expires_at: expiresAtIso,
    ...(installationId ? {github_installation_id: Number(installationId)} : {}),
  });
}

async function getRemoteRepositories(userId) {
  const octokit = await getOctokit(userId);

  return await octokit.paginate(
    octokit.rest.repos.listForAuthenticatedUser,
    {
      per_page: 100,
      affiliation: "owner,collaborator,organization_member",
      sort: "pushed",
      direction: "desc",
    },
    (response) => {
      return response.data.map(mapRepository)
    }
  );
}

async function getRemoteRepository(userId, repoId) {
  const octokit = await getOctokit(userId);

  try {
    const {data: repo} = await octokit.request("GET /repositories/{repository_id}", {
      repository_id: repoId
    });

    if (repo.size > 0 && repo.default_branch) {
      try {
        const {data: refData} = await octokit.rest.git.getRef({
          owner: repo.owner.login,
          repo: repo.name,
          ref: `heads/${repo.default_branch}`,
        });
        repo.sha = refData.object.sha;
      } catch (refError) {
        repo.sha = null;
      }
    }

    return mapRepository(repo);
  } catch (error) {
    console.log(error);
    throw new ServerError("Failed to fetch remote repository", 500);
  }
}

module.exports = {
  getAuthUrl,
  getInstallUrl,
  deleteAuthorization,
  exchangeCode,
  assignUser,
  getProfile,
  getRemoteRepositories,
  getRemoteRepository
};