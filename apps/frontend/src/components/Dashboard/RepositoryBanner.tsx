import React from "react";
import {LockIcon, LockOpenIcon} from "lucide-react";

export interface Repository {
  id: number;
  name: string;
  description: string;
  language: string;
  owner_login: string;
  html_url: string;
  private: boolean;
  default_branch: string;
  created_at: string;
  pushed_at: string;
  updated_at: string;
}

interface Props {
  repo: Repository;
  actions: React.ReactNode;
}

export default function RepositoryBanner({repo, actions}: Props) {
  return (
    <div key={repo.id} className="profile-repository">
      <div className="profile-repository-info">
        <h3><small>{repo.owner_login}</small>/{repo.name} {repo.private ? <LockIcon /> : <LockOpenIcon />}</h3>
        <div>{repo.description}</div>
        <div>Created at: {new Date(repo.created_at).toLocaleString("cs-CZ")}</div>
        <div>Last activity at: {new Date(repo.pushed_at).toLocaleString("cs-CZ")}</div>
      </div>

      <div className="profile-repository-actions">
        {actions}
      </div>
    </div>
  )
}