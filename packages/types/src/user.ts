
import type { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  mobile: string;
  roles: ROLE[];
  status: ACCOUNT_STATUS;
  createdAt: Date;
  updatedAt: Date;
}
