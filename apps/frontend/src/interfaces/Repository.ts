export interface Repository {
  id: number;
  name: string;
  description: string;
  language: string;
  owner_login: string;
  html_url: string;
  private: boolean;
  default_branch: string;
  sha: Map<string, string>;
  created_at: string;
  pushed_at: string;
  updated_at: string;
}

export interface RawRepository extends Omit<Repository, "sha"> {
  sha: [string, string][];
}