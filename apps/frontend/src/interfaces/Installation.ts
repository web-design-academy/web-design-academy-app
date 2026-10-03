export interface Installation {
  id: number,
  user_id: string,
  html_url: string,
  account_id: number,
  account_login: string,
  repository_selection: string,
  target_type: string,
  created_at: string,
  suspended_by: string | null,
  suspended_at: string | null,
}