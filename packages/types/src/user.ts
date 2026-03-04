/**
 * User entity – identity and account contract.
 */

import type { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";

export interface User {
  id: string;
  funtId: string;
  name: string;
  email?: string;
  mobile: string;
  roles: ROLE[];
  status: ACCOUNT_STATUS;
  createdAt: Date;
  updatedAt: Date;
}
