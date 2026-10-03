import type {Tag} from "@/interfaces/Tag.ts";
import type {User} from "@/interfaces/User.ts";

export interface AdminUser extends User {
  created_at: string;
  tags: Tag[];
}