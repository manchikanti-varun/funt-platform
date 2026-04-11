"use client";

import { useEffect } from "react";
import { migrateLegacyTokenIfPresent } from "@/lib/api";

export function LegacySessionMigration() {
  useEffect(() => {
    void migrateLegacyTokenIfPresent();
  }, []);
  return null;
}
