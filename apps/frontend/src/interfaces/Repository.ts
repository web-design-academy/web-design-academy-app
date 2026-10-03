export interface Repository {
  id: number;
  name: string;
  description: string;
  language: string;
  owner_login: string;
  html_url: string;
  private: boolean;
  default_branch: string;
  sha: string;
  created_at: string;
  pushed_at: string;
  updated_at: string;
}