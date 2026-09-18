const { Octokit } = require("octokit");
const { OAuthApp } = require("@octokit/oauth-app");
const environment = require("../config/env");
const {encrypt, decrypt} = require('../utils/encryption');
const userRepository = require("../repositories/user");
const ServerError = require("../errors/ServerError");
const {response} = require("express");

const auth = new OAuthApp({
  clientType: "oauth-app",
  clientId: environment.githubClientId,
  clientSecret: environment.githubClientSecret ?? "",
});

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
    created_at: repo.created_at,
    pushed_at: repo.pushed_at,
    updated_at: repo.updated_at
  }
}

function getOAuthUrl(state) {
  if (!state || typeof state !== "string")
    throw new ServerError("Invalid state parameter", 500)

  return auth.getWebFlowAuthorizationUrl({
    state: state,
    scopes: ["read:user", "repo"],
  }).url;
}

function getAccessToken(userId) {
  const userTokens = userRepository.getUserTokensBy(userId);
  if (!userTokens)
    throw new ServerError("User not found", 401);
  if (!userTokens.github_id || !userTokens.github_access_token)
    throw new ServerError("User does not have GitHub account linked", 401);

  return decrypt(userTokens.github_access_token);
}

function getOctokit(userId) {
  return new Octokit({
    auth: getAccessToken(userId),
  });
}

async function deleteAuthorization(userId) {
  try {
    await auth.deleteAuthorization({
      token: getAccessToken(userId)
    });
  } catch (error) {
    throw new ServerError("Failed to delete GitHub access token", 500);
  }

  userRepository.updateUser(String(userId), {
    github_id: null,
    github_login: null,
    github_name: null,
    github_avatar_url: null,
    github_scopes: null,
    github_access_token: null,
  })
}

async function getGithubUser(token) {
  const octokit = new Octokit({
    auth: token
  })

  try {
    const response = await octokit.rest.users.getAuthenticated();
    return response.data;
  } catch (error) {
    throw new ServerError("Failed to fetch GitHub profile", 500);
  }
}

async function exchangeCode(code, state) {
  try {
    const response = await auth.createToken({
      code: code,
      state: state
    });

    const authentication = response.authentication;
    return { token: authentication.token, scopes: authentication.scopes }
  } catch (error) {
    throw new ServerError("Failed to authenticate with GitHub", 500);
  }
}

async function assignUser(userId, scopes, token) {
  const profile = await getGithubUser(token);

  if (userRepository.getUserBy(profile.id, "github_id"))
    throw new ServerError("GitHub account is already linked to another account", 400);

  userRepository.updateUser(String(userId), {
    github_id: String(profile.id),
    github_login: profile.login,
    github_name: profile.name,
    github_avatar_url: profile.avatar_url,
    github_scopes: JSON.stringify(scopes),
    github_access_token: encrypt(token),
  })
}

async function refreshUser(userId) {
  const profile = getGithubUser(getAccessToken(userId));

  userRepository.updateUser(String(userId), {
    github_id: String(profile.id),
    github_login: profile.login,
    github_name: profile.name,
    github_avatar_url: profile.avatar_url,
  })

  return {
    id: String(profile.id),
    login: profile.login,
    name: profile.name,
    avatar_url: profile.avatar_url
  };
}

async function getRemoteRepositories(userId) {
  const octokit = getOctokit(userId);

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
  const octokit = getOctokit(userId);

  try {
    const response = await octokit.request("GET /repositories/{repository_id}", {
      repository_id: repoId
    })

    return mapRepository(response.data);
  } catch (error) {
    console.log(error);
    throw new ServerError("Failed to fetch remote repository", 500);
  }
}

module.exports = {
  getOAuthUrl,
  deleteAuthorization,
  exchangeCode,
  assignUser,
  refreshUser,
  getRemoteRepositories,
  getRemoteRepository
};
