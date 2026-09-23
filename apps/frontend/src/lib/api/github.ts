import {API_BASE} from "@/lib/api/client.ts";
import {readResponse} from "@/lib/api/readResponse.ts";

export async function unlinkGitHubAccount() {
  const response = await fetch(`${API_BASE}/github/link`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include"
  });

  return readResponse(response, "Failed to unlink GitHub account");
}

export async function getGitHubRepositories() {
  const response = await fetch(`${API_BASE}/github/repositories`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include"
  });

  return readResponse(response, "Failed to fetch repositories");
}
