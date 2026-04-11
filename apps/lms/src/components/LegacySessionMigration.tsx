"use client";

import { useEffect } from "react";
import { migrateLegacyTokenIfPresent } from "@/lib/api";

/** Moves JWT from legacy localStorage into httpOnly cookie once per session. */
export function LegacySessionMigration() {
  useEffect(() => {
    void migrateLegacyTokenIfPresent();
  }, []);
  return null;
}
