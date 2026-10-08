const { Octokit } = require("octokit");
const { OAuthApp } = require("@octokit/oauth-app");
const environment = require("../config/env");
const {encrypt, decrypt} = require("../utils/encryption");
const userRepository = require("../repositories/users");
const installationsRepository = require("../repositories/installations");
const ServerError = require("../errors/ServerError");

const auth = new OAuthApp({
  clientType: "github-app",
  clientId: environment.githubClientId,
  clientSecret: environment.githubClientSecret ?? "",
});

// 5 minutes before expiration, refresh the token
const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;

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

function mapRemoteInstallation(installation, userId) {
  return {
    id: installation.id,
    user_id: userId,
    html_url: installation.html_url,
    account_id: installation.account.id,
    account_login: installation.account.login,
    repository_selection: installation.repository_selection,
    target_type: installation.target_type,
    created_at: installation.created_at,
    suspended_by: installation.suspended_by,
    suspended_at: installation.suspended_at,
  }
}

function mapLocalInstallation(installation, userId) {
  return {
    id: installation.id,
    user_id: userId,
    html_url: installation.html_url,
    created_at: installation.created_at,
  }
}

function getAuthUrl(state) {
  if (!state || typeof state !== "string")
    throw new ServerError("Invalid state parameter", 500)

  return auth.getWebFlowAuthorizationUrl({
    state: state,
  }).url;
}

function getInstallUrl() {
  return `https://github.com/apps/${environment.githubAppName}/installations/new`;
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

    userRepository.update(String(userId), {
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
  const userTokens = userRepository.getTokensBy(userId);
  if (!userTokens)
    throw new ServerError("User not found", 401);
  if (!userTokens.github_id || !userTokens.github_access_token)
    throw new ServerError("User does not have GitHub account linked", 401);

  const expiresAt = userTokens.github_expires_at
      ? new Date(userTokens.github_expires_at).getTime()
      : null;

  if (!expiresAt || TOKEN_REFRESH_WINDOW_MS > expiresAt - Date.now())
    return await refreshAccessToken(userId, userTokens);

  return decrypt(userTokens.github_access_token);
}

async function getOctokit(userId) {
  return new Octokit({
    auth: await getAccessToken(userId),
  });
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

async function assignUser(userId, token, refreshToken, expiresAt) {
  const profile = await getProfileFromToken(token);

  const existingUser = userRepository.getBy(profile.github_id, "github_id");
  if (existingUser && String(existingUser.id) !== String(userId))
    throw new ServerError("GitHub account is already linked to another account", 400);

  const expiresAtIso = expiresAt instanceof Date
    ? expiresAt.toISOString()
    : String(expiresAt);

  userRepository.update(String(userId), {
    github_id: String(profile.github_id),
    github_access_token: encrypt(token),
    github_refresh_token: encrypt(refreshToken),
    github_expires_at: expiresAtIso,
  });
}

async function deleteAuthorization(userId) {
  try {
    const token = await getAccessToken(userId);
    await auth.deleteAuthorization({token});
  } catch (e) {
    console.warn("GitHub authorization revocation failed: ", e.message);
  }

  userRepository.update(String(userId), {
    github_id: null,
    github_access_token: null,
    github_refresh_token: null,
    github_expires_at: null,
  })
}

async function getRepositories(userId) {
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

async function getRepository(userId, repoId) {
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
      } catch (e) {
      }
    }

    return mapRepository(repo);
  } catch (error) {
    throw new ServerError("Failed to fetch remote repository", 500);
  }
}

async function getRepositorySha(userId, owner, repo, branch) {
  const octokit = await getOctokit(userId);

  try {
    const {data: refData} = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    return refData.object.sha;
  } catch (error) {
    console.log(error);
    throw new ServerError("Failed to fetch repository reference", 500);
  }
}

async function downloadRepository(userId, owner, repo) {
  const octokit = await getOctokit(userId);

  const response = await octokit.rest.repos.downloadZipballArchive({
    owner,
    repo,
  });

  return Buffer.from(response.data);
}

async function syncInstallations(userId) {
  const octokit = await getOctokit(userId);
  const {data} = await octokit.rest.apps.listInstallationsForAuthenticatedUser();
  const output = [];

  for (const installation of data.installations) {
    installationsRepository.upsert(mapLocalInstallation(installation, userId));
    output.push(mapRemoteInstallation(installation, userId));
  }

  for (const installation of installationsRepository.listBy({values: [String(userId)], column: "user_id"})) {
    if (!data.installations.some((i) => i.id === installation.id))
      installationsRepository.remove(installation.id);
  }

  console.log(output);
  return output
}

async function syncInstallation(userId, installationId) {
  const octokit = await getOctokit(userId);
  try {
    const {data: installation} = await octokit.rest.apps.getInstallation({
      installation_id: installationId
    });

    installationsRepository.upsert({
      id: installation.id,
      user_id: String(userId),
      html_url: installation.html_url,
    });

    return installation;
  } catch (error) {
    if (error.status === 404) {
      installationsRepository.remove(installationId);
      throw new ServerError("Installation not found", 404);
    }

    throw new ServerError("Failed to fetch remote installation", 500);
  }
}

module.exports = {
  getAuthUrl,
  getInstallUrl,
  deleteAuthorization,
  exchangeCode,
  assignUser,
  getProfile,
  getRepositories,
  getRepository,
  getRepositorySha,
  downloadRepository,
  syncInstallations,
  syncInstallation
};