"use client";

import { createContext, useContext } from "react";

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  mobile: string;
  roles: string[];
  status: string;
}

const AdminUserContext = createContext<AdminUser | null>(null);

export function AdminUserProvider({ user, children }: { user: AdminUser; children: React.ReactNode }) {
  return <AdminUserContext.Provider value={user}>{children}</AdminUserContext.Provider>;
}

export function useAdminUser(): AdminUser {
  const u = useContext(AdminUserContext);
  if (!u) throw new Error("useAdminUser must be used inside AdminUserProvider");
  return u;
}
