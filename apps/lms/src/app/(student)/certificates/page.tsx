"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38472";

interface MyCertificate {
  certificateId: string;
  batchId: string;
  courseId: string;
  courseName: string;
  issuedAt: string;
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
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/api/certificates/${encodeURIComponent(certificateId)}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
      {}
      <div className="shrink-0 rounded-2xl border border-slate-200/90 bg-white px-5 py-5 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Achievements</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Certificates</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Certificates appear here after you complete a course and generate one from the course page. Download your copies below.
        </p>
      </div>

      {}
      <div className="shrink-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/verify"
          className="inline-flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80 transition duration-200 hover:border-teal-200 hover:shadow-xl hover:shadow-slate-300/25 hover:ring-teal-100/80"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </span>
          <div>
            <p className="font-semibold text-slate-800">Verify any certificate</p>
            <p className="text-sm text-slate-500">Anyone with the certificate ID can verify — no login required.</p>
          </div>
          <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
        {list.length > 0 && (
          <div className="shrink-0 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-amber-50 to-white px-6 py-4 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
            <p className="text-2xl font-bold tabular-nums text-amber-700">{list.length}</p>
            <p className="text-sm font-medium text-slate-600">certificate{list.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {}
      <div className="min-h-0 flex-1 overflow-auto">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/90 bg-white px-6 py-16 text-center shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-inner ring-1 ring-slate-200/60">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-800">No certificates yet</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Complete a course and use &quot;Generate certificate&quot; on the course page. Your certificate will appear here.
            </p>
            <Link
              href="/courses"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 ring-1 ring-teal-700/30 transition duration-200 hover:bg-teal-700 hover:shadow-xl hover:shadow-teal-900/25"
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
                className="flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/25 ring-1 ring-slate-100/80 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/30 hover:ring-slate-200/80"
              >
                <div className="flex min-h-0 flex-1 flex-col p-5">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-inner ring-1 ring-amber-200/60">
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900">{c.courseName}</h3>
                      <p className="mt-1 text-sm text-slate-500">{formatDate(c.issuedAt)}</p>
                      <p className="mt-2 font-mono text-xs text-slate-400">{c.certificateId}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => downloadPdf(c.certificateId)}
                      disabled={downloadingId === c.certificateId}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 ring-1 ring-teal-700/30 transition duration-200 hover:bg-teal-700 hover:shadow-xl disabled:opacity-60"
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
                      className="text-sm font-medium text-slate-500 hover:text-teal-600 hover:underline"
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
    </div>
  );
}
