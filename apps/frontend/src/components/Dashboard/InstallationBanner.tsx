import type {Installation} from "@/interfaces/Installation.ts";
import {Settings} from "lucide-react";
import {Link} from "react-router";

interface Props {
  installation: Installation;
}

export default function InstallationBanner({installation}: Props) {
  return (
    <div key={installation.id} className="profile-repository">
      <div className="profile-repository-info">
        <h3>{installation.account_login}</h3>
        <h4>{installation.target_type} installation</h4>
        <div>Created at: {new Date(installation.created_at).toLocaleString("cs-CZ")}</div>
      </div>

      <div className="profile-repository-actions">
        <Link
          to={installation.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          title="Open installation settings in new tab"
          aria-label="Open installation settings in new tab"
        >
          <Settings
            size={16}
            className="icon-margin-right"
          />
          Manage
        </Link>
      </div>
    </div>
  )
}