"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getToken } from "@/lib/api";
import { AppPageShell } from "@/components/ui";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472").replace(/\/+$/, "");

interface MyCertificate {
  certificateId: string;
  batchId: string;
  courseId: string;
  courseName: string;
  issuedAt: string;
  coinReward: number;
  coinRewardGrantedAt: string | null;
  coinRewardPending: boolean;
}

export default function CertificatesPage() {
  const [list, setList] = useState<MyCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<MyCertificate[]>("/api/student/certificates").then((r) => {
      if (r.success && Array.isArray(r.data)) setList(r.data);
    }).finally(() => setLoading(false));
  }, []);

  async function downloadPdf(certificateId: string) {
    setDownloadingId(certificateId);
    setError("");
    const legacy = getToken()?.trim();
    const headers: HeadersInit = {};
    if (legacy) (headers as Record<string, string>)["Authorization"] = `Bearer ${legacy}`;
    try {
      const res = await fetch(`${API_BASE}/api/certificates/${encodeURIComponent(certificateId)}/pdf`, {
        credentials: "include",
        headers,
      });
      if (!res.ok) {
        setError(res.status === 403 ? "You can only download your own certificate." : "Download failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${certificateId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <AppPageShell className="w-full max-w-5xl space-y-6">
      <div className="page-hero shrink-0 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-funt-gold-deep">Achievements</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-black">Certificates</h1>
        <p className="mt-2 text-sm text-black/70">Download, verify, and track reward status in one place.</p>
      </div>

      <div className="shrink-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/verify"
          className="inline-flex items-center gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white px-5 py-4 shadow-md shadow-indigo-900/10 transition hover:border-indigo-300"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </span>
          <div>
            <p className="font-semibold text-black">Verify certificate</p>
            <p className="text-sm text-black/60">Public verification link</p>
          </div>
          <svg className="h-5 w-5 shrink-0 text-black/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
        {list.length > 0 && (
          <div className="shrink-0 rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-4 shadow-md shadow-indigo-900/10">
            <p className="text-2xl font-bold tabular-nums text-indigo-700">{list.length}</p>
            <p className="text-sm font-medium text-funt-ink">certificate{list.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div>
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white px-6 py-16 text-center shadow-md shadow-indigo-900/10">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-400 shadow-inner ring-1 ring-indigo-200/50">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <h2 className="mt-5 text-lg font-semibold text-black">No certificates yet</h2>
            <Link
              href="/courses"
              className="mt-6 inline-flex items-center gap-2 btn-primary text-sm font-bold shadow-lg shadow-indigo-900/15 ring-1 ring-indigo-300/30 transition duration-200"
            >
              Go to courses
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {list.map((c) => (
              <article
                key={c.certificateId}
                className="flex flex-col rounded-2xl border border-indigo-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 shadow-md shadow-indigo-900/10 transition hover:-translate-y-0.5 hover:shadow-lg hover:border-indigo-300"
              >
                <div className="flex min-h-0 flex-1 flex-col p-5">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner ring-1 ring-indigo-200/60">
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-funt-ink">{c.courseName}</h3>
                      <p className="mt-1 text-sm text-black/55">{formatDate(c.issuedAt)}</p>
                      <p className="mt-2 rounded-lg border border-black/10 bg-white/80 px-2 py-1 font-mono text-xs text-black/50">{c.certificateId}</p>
                      {c.coinReward > 0 && (
                        <p className="mt-2 rounded-lg bg-indigo-50 px-2 py-1.5 text-xs font-semibold text-indigo-700">
                          {c.coinRewardPending
                            ? `${c.coinReward} FUNT coins pending instructor approval`
                            : `You received ${c.coinReward} FUNT coins`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-3 border-t border-black/5 pt-4">
                    <button
                      type="button"
                      onClick={() => downloadPdf(c.certificateId)}
                      disabled={downloadingId === c.certificateId}
                      className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-60"
                    >
                      {downloadingId === c.certificateId ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Downloading…
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download PDF
                        </>
                      )}
                    </button>
                    <Link
                      href={`/verify?id=${encodeURIComponent(c.certificateId)}`}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      Verify
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
