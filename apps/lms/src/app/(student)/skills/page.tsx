"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

interface SkillPoint {
  tag: string;
  count: number;
  score: number;
}

interface SkillProfile {
  studentId: string;
  skills: SkillPoint[];
}

const SKILL_COLORS = [
  { border: "border-l-teal-500", bg: "bg-teal-50", text: "text-teal-700", fill: "#0d9488" },
  { border: "border-l-violet-500", bg: "bg-violet-50", text: "text-violet-700", fill: "#7c3aed" },
  { border: "border-l-amber-500", bg: "bg-amber-50", text: "text-amber-700", fill: "#d97706" },
  { border: "border-l-sky-500", bg: "bg-sky-50", text: "text-sky-700", fill: "#0284c7" },
  { border: "border-l-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", fill: "#059669" },
  { border: "border-l-rose-500", bg: "bg-rose-50", text: "text-rose-700", fill: "#e11d48" },
];

export default function SkillsPage() {
  const [profile, setProfile] = useState<SkillProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<SkillProfile>("/api/skills/me").then((r) => {
      if (r.success && r.data) setProfile(r.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  if (!profile) {
return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 min-h-min">
      <div className="shrink-0 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Progress</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Skill Radar</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200/80 text-slate-400">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </span>
          <h2 className="mt-5 text-lg font-semibold text-slate-800">No skill data yet</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Complete assignments and get them approved by your trainer. Your skill scores will appear here.
          </p>
          <Link
            href="/assignments"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700"
          >
            Go to assignments
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  const data = profile.skills ?? [];
  const radarData = data.map((s) => ({ subject: s.tag, score: s.score, fullMark: 100 }));
  const avgScore = data.length ? Math.round(data.reduce((a, s) => a + s.score, 0) / data.length) : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 min-h-min">
      {/* Header */}
      <div className="shrink-0 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Progress</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Skill Radar</h1>
        <p className="max-w-xl text-sm text-slate-600">
          Your scores by skill area from approved assignments. Submit work and get feedback to build your profile.
        </p>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200/80 text-slate-400">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </span>
          <h2 className="mt-5 text-lg font-semibold text-slate-800">No skills yet</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Submit assignments and get them approved to see your Skill Radar here.
          </p>
          <Link
            href="/assignments"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700"
          >
            Go to assignments
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="shrink-0 flex flex-wrap gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-lg shadow-slate-200/25 ring-1 ring-slate-100">
              <p className="text-2xl font-bold tabular-nums text-teal-600">{avgScore}%</p>
              <p className="text-sm font-medium text-slate-600">Average score</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-lg shadow-slate-200/25 ring-1 ring-slate-100">
              <p className="text-2xl font-bold tabular-nums text-slate-800">{data.length}</p>
              <p className="text-sm font-medium text-slate-600">Skill area{data.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Radar chart */}
          <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/30 ring-1 ring-slate-100">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Radar view</h2>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#475569", fontSize: 11, fontWeight: 500 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Radar name="Score" dataKey="score" stroke="#0d9488" fill="#0d9488" fillOpacity={0.35} strokeWidth={2} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                      padding: "12px 16px",
                    }}
                    labelStyle={{ color: "#0f172a", fontWeight: 600 }}
                    formatter={(value: number) => [`${value}%`, "Score"]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown */}
          <div className="flex-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/30 ring-1 ring-slate-100">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </span>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Score breakdown</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.map((s, i) => {
                  const style = SKILL_COLORS[i % SKILL_COLORS.length];
                  return (
                    <div
                      key={s.tag}
                      className={`rounded-xl border border-slate-200 border-l-4 bg-slate-50/50 px-5 py-4 shadow-sm transition hover:shadow-md ${style.border}`}
                    >
                      <p className="font-semibold text-slate-800">{s.tag}</p>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className={`text-xl font-bold tabular-nums ${style.text}`}>{s.score}%</span>
                        <span className="text-sm text-slate-500">· {s.count} approved</span>
                      </div>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${s.score}%`, backgroundColor: style.fill }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
