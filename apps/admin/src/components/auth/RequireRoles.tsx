"use client";

import { ROLE } from "@funt-platform/constants";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAdminUser } from "@/contexts/AdminUserContext";

interface RequireRolesProps {
  roles: string[];
  fallbackHref?: string;
}

export function RequireRoles({ roles, fallbackHref = "/dashboard" }: RequireRolesProps) {
  const router = useRouter();
  const user = useAdminUser();
  const allowed = user.roles.some((role) => roles.includes(role));

  useEffect(() => {
    if (!allowed) router.replace(fallbackHref);
  }, [allowed, fallbackHref, router]);

  if (allowed) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      You do not have permission to access this page.
    </div>
  );
}

export const STAFF_ROLES = [ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN] as const;
