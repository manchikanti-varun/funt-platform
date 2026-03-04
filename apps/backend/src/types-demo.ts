import type { User } from "@funt-platform/types";
import { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";

export function getPlaceholderUser(): User {
  return {
    id: "demo",
    funtId: "FS-00-00000",
    name: "Demo",
    mobile: "",
    roles: [ROLE.ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
