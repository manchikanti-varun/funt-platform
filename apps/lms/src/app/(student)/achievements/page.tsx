"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, PageSection } from "@/components/ui";

interface AchievementRow {
  id: string;
  badgeType: string;
  displayName: string;
  icon?: string;
  description?: string;
  imageUrl?: string;
  awardedAt: string;
}

export default function AchievementsPage() {
  const [rows, setRows] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AchievementRow[]>("/api/achievements/my")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setRows(r.data);
        else setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
      </div>
    );
  }

  return (
    <AppPageShell className="max-w-5xl gap-8">
      <header className="page-hero py-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8d6f14]">Growth</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-black">Achievements & medals</h1>
        <p className="mt-2 text-sm text-black/65">Badges you have earned so far.</p>
      </header>
      <PageSection>
        {rows.length === 0 ? (
          <p className="text-sm text-black/60">No achievements yet. Complete chapters, assignments, and courses to unlock medals.</p>
        ) : (
          <ul className="divide-y divide-black/10">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold text-black">{a.displayName}</p>
                  <p className="font-mono text-xs text-black/45">{a.badgeType}</p>
                  {a.description ? <p className="mt-1 text-xs text-black/55">{a.description}</p> : null}
                </div>
                <span className="text-xs text-black/50">{new Date(a.awardedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </AppPageShell>
  );
}

