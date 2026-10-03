import React from "react";
import {LockIcon, LockOpenIcon} from "lucide-react";
import type {Repository} from "@/interfaces/Repository.ts";

interface Props {
  repo: Repository;
  actions: React.ReactNode;
}

export default function RepositoryBanner({repo, actions}: Props) {
  return (
    <div key={repo.id} className="profile-repository">
      <div className="profile-repository-info">
        <h3>
          <small>{repo.owner_login}</small>/{repo.name}
          {repo.private ? <LockIcon size="1em" className="icon-margin-left"/> :
            <LockOpenIcon size="1em" className="icon-margin-left"/>}
        </h3>
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