export interface User {
  userId: string;
  role: "student" | "admin";
  name: string;
  email: string;
  githubId?: string;
}