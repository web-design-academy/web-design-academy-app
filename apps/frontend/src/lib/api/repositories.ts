import {readResponse} from "@/lib/api/readResponse.ts";
import {API_BASE} from "@/lib/api/client.ts";
import type {Repository} from "@/components/Dashboard/RepositoryBanner.tsx";

const REPOSITORIES_URL = `${API_BASE}/repositories`;

export interface Repositories {
  total: number;
  repositories: Repository[];
}

export async function getRemoteRepositories(pageSize = 0, page = 0): Promise<Repositories> {
  const params = new URLSearchParams({pageSize: pageSize.toString(), page: page.toString()});
  const response = await fetch(`${REPOSITORIES_URL}?${params}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
  });

  return await readResponse(response, "Failed to fetch tracked repositories") as Repositories
}

export async function addRemoteRepository(repoId: number) {
  const response = await fetch(`${REPOSITORIES_URL}/${repoId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include"
  });

  return await readResponse(response, "Failed to add remote repository");
}

export async function removeRemoteRepository(repoId: number) {
  const response = await fetch(`${REPOSITORIES_URL}/${repoId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include"
  });

  return readResponse(response, "Failed to remove remote repository");
}