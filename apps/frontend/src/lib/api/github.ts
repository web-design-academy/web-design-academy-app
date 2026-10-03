import {API_BASE} from "@/lib/api/client.ts";
import {readResponse} from "@/lib/api/readResponse.ts";
import type {GitHubProfile} from "@/interfaces/GitHubProfile.ts";
import type {Installation} from "@/interfaces/Installation.ts";
import type {Repository} from "@/interfaces/Repository.ts";

export async function fetchProfile() {
  const response = await fetch(`${API_BASE}/github/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include"
  });

  return readResponse<GitHubProfile>(response, "Failed to fetch GitHub profile");
}

export async function fetchRepositories() {
  const response = await fetch(`${API_BASE}/github/repositories`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include"
  });

  return readResponse<Repository[]>(response, "Failed to fetch repositories");
}

export async function fetchRepository(repoId: string) {
  const response = await fetch(`${API_BASE}/github/repositories/${encodeURIComponent(repoId)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include"
  });

  return readResponse<Repository>(response, "Failed to fetch repository");
}

export const installationUrl = `${API_BASE}/github/installations`;
export const newInstallationUrl = `${installationUrl}/new`;

export async function fetchInstallations() {
  const response = await fetch(installationUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include"
  });

  return readResponse<Installation[]>(response, "Failed to fetch installations");
}

export const linkUrl = `${API_BASE}/github/link`;

export async function unlinkAccount() {
  const response = await fetch(linkUrl, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include"
  });

  return readResponse(response, "Failed to unlink GitHub account");
}

