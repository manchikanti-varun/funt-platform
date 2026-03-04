"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, apiUrl, getToken } from "@/lib/api";
import { BackLink } from "@/components/ui/BackLink";

interface StudentCertRow {
  studentId: string;
  funtId: string;
  name: string;
  certificateId: string | null;
  eligible: boolean;
  reason?: string;
  modulesCompleted?: number;
  totalModules?: number;
  progressPercent?: number;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BatchCertificatesPage() {
  const params = useParams();
  const id = params.id as string;
  const [batchName, setBatchName] = useState("");
  const [rows, setRows] = useState<StudentCertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenerate, setSelectedGenerate] = useState<Set<string>>(new Set());
  const [selectedDownload, setSelectedDownload] = useState<Set<string>>(new Set());
  const [bulkGenerateLoading, setBulkGenerateLoading] = useState(false);
  const [bulkGenerateMessage, setBulkGenerateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api<{ name: string }>(`/api/batches/${id}`),
      api<StudentCertRow[]>(`/api/certificates/batch/${id}/students`),
    ]).then(([batchRes, certRes]) => {
      if (batchRes.success && batchRes.data) setBatchName(batchRes.data.name);
      if (certRes.success && Array.isArray(certRes.data)) setRows(certRes.data);
      else if (!certRes.success && certRes.message) setRows([]);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleGenerate = (studentId: string) => {
    const r = rows.find((x) => x.studentId === studentId);
    if (!r || !r.eligible || r.certificateId) return;
    setSelectedGenerate((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleDownload = (studentId: string, certificateId: string) => {
    setSelectedDownload((prev) => {
      const next = new Set(prev);
      const key = `${studentId}:${certificateId}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllGenerate = () => {
    const eligibles = rows.filter((r) => r.eligible && !r.certificateId);
    if (selectedGenerate.size === eligibles.length) setSelectedGenerate(new Set());
    else setSelectedGenerate(new Set(eligibles.map((r) => r.studentId)));
  };

  const selectAllDownload = () => {
    const withCert = rows.filter((r) => r.certificateId).map((r) => `${r.studentId}:${r.certificateId}`);
    if (selectedDownload.size === withCert.length) setSelectedDownload(new Set());
    else setSelectedDownload(new Set(withCert));
  };

  const generateAllEligible = () => {
    const ids = rows.filter((r) => r.eligible && !r.certificateId).map((r) => r.studentId);
    if (ids.length === 0) return;
    bulkGenerateWithIds(ids);
  };

  const bulkGenerateWithIds = async (studentIds: string[]) => {
    if (studentIds.length === 0) return;
    setBulkGenerateLoading(true);
    setBulkGenerateMessage(null);
    const res = await api<{ generated: Array<{ studentId: string; certificateId: string }>; errors: Array<{ studentId: string; message: string }> }>(
      `/api/certificates/batch/${id}/generate`,
      { method: "POST", body: JSON.stringify({ studentIds }) }
    );
    setBulkGenerateLoading(false);
    if (res.success && res.data) {
      const { generated, errors } = res.data;
      setSelectedGenerate(new Set());
      load();
      if (errors.length > 0) {
        setBulkGenerateMessage({ type: "error", text: `Generated: ${generated.length}. Errors: ${errors.map((e) => e.message).join("; ")}` });
      } else {
        setBulkGenerateMessage({ type: "success", text: `Generated ${generated.length} certificate(s).` });
      }
    } else {
      setBulkGenerateMessage({ type: "error", text: res.message ?? "Bulk generate failed." });
    }
  };

  const bulkGenerate = async () => {
    const studentIds = [...selectedGenerate];
    if (studentIds.length === 0) return;
    await bulkGenerateWithIds(studentIds);
  };

  const downloadSinglePdf = (certificateId: string) => {
    const token = getToken();
    if (!token) return;
    fetch(apiUrl(`/api/certificates/${certificateId}/pdf`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Download failed");
        return res.blob();
      })
      .then((blob) => downloadBlob(blob, `certificate-${certificateId}.pdf`))
      .catch(() => {});
  };

  const downloadZip = async () => {
    const certIds = [...selectedDownload].map((k) => k.split(":")[1]).filter(Boolean);
    if (certIds.length === 0) return;
    setDownloadingZip(true);
    const token = getToken();
    if (!token) {
      setDownloadingZip(false);
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/certificates/batch/${id}/zip?certificateIds=${encodeURIComponent(certIds.join(","))}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      downloadBlob(blob, `certificates-${id}.zip`);
    } finally {
      setDownloadingZip(false);
    }
  };

  const generateOne = async (studentId: string) => {
    setGeneratingId(studentId);
    const res = await api(`/api/certificates/generate`, {
      method: "POST",
      body: JSON.stringify({ studentId, batchId: id }),
    });
    setGeneratingId(null);
    if (res.success) load();
  };

  const eligibleNoCert = rows.filter((r) => r.eligible && !r.certificateId);
  const withCert = rows.filter((r) => r.certificateId);

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackLink href={`/batches/${id}/view`}>Back to batch</BackLink>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Certificates — {batchName || id}</h1>
          <p className="mt-1 text-sm text-slate-500">Generate or download certificates for students who have completed the course.</p>
        </div>

        <div className="p-6 space-y-4">
          {bulkGenerateMessage && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                bulkGenerateMessage.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {bulkGenerateMessage.text}
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            {eligibleNoCert.length > 0 && (
              <>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={eligibleNoCert.length > 0 && selectedGenerate.size === eligibleNoCert.length}
                    onChange={selectAllGenerate}
                  />
                  Select all eligible
                </label>
                <button
                  type="button"
                  disabled={selectedGenerate.size === 0 || bulkGenerateLoading}
                  onClick={bulkGenerate}
                  className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100 disabled:opacity-50"
                >
                  {bulkGenerateLoading ? "Generating…" : `Generate selected (${selectedGenerate.size})`}
                </button>
                <button
                  type="button"
                  disabled={bulkGenerateLoading}
                  onClick={generateAllEligible}
                  className="rounded-lg border border-teal-300 bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
                >
                  {bulkGenerateLoading ? "Generating…" : `Generate all (${eligibleNoCert.length})`}
                </button>
              </>
            )}
            {withCert.length > 0 && (
              <>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={withCert.length > 0 && selectedDownload.size === withCert.length}
                    onChange={selectAllDownload}
                  />
                  Select all with certificate
                </label>
                <button
                  type="button"
                  disabled={selectedDownload.size === 0 || downloadingZip}
                  onClick={downloadZip}
                  className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 shadow-sm transition hover:bg-violet-100 disabled:opacity-50"
                >
                  {downloadingZip ? "Preparing ZIP…" : `Download selected as ZIP (${selectedDownload.size})`}
                </button>
              </>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-5 py-6">
              <p className="text-sm font-medium text-amber-900">No students enrolled in this batch.</p>
              <p className="mt-2 text-sm text-amber-800">
                Add students via <Link href={`/batches/${id}/student-access`} className="font-medium underline hover:no-underline">Student access</Link> or approve{" "}
                <Link href={`/batches/${id}/enrollment-requests`} className="font-medium underline hover:no-underline">enrollment requests</Link>, then refresh.
              </p>
              <button
                type="button"
                onClick={() => load()}
                className="mt-4 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-50"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Student</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">FUNT ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Progress</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Certificate</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((r) => (
                    <tr key={r.studentId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.name || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{r.funtId || "—"}</td>
                      <td className="px-4 py-3">
                        {r.totalModules != null && r.modulesCompleted != null ? (
                          <span className={`font-medium ${(r.progressPercent ?? 0) >= 100 ? "text-emerald-700" : "text-slate-600"}`}>
                            {r.modulesCompleted}/{r.totalModules} ({r.progressPercent ?? 0}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.certificateId ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Generated</span>
                        ) : r.eligible ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Eligible</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600" title={r.reason}>
                            Not eligible
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.certificateId ? (
                          <span className="text-slate-600 font-mono text-xs">{r.certificateId}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 flex flex-wrap gap-2">
                        {r.certificateId ? (
                          <>
                            <label className="inline-flex items-center gap-1 text-slate-600">
                              <input
                                type="checkbox"
                                checked={selectedDownload.has(`${r.studentId}:${r.certificateId}`)}
                                onChange={() => toggleDownload(r.studentId, r.certificateId!)}
                              />
                              ZIP
                            </label>
                            <button
                              type="button"
                              onClick={() => downloadSinglePdf(r.certificateId!)}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Download PDF
                            </button>
                          </>
                        ) : r.eligible ? (
                          <>
                            <label className="inline-flex items-center gap-1 text-slate-600">
                              <input
                                type="checkbox"
                                checked={selectedGenerate.has(r.studentId)}
                                onChange={() => toggleGenerate(r.studentId)}
                              />
                              Gen
                            </label>
                            <button
                              type="button"
                              disabled={generatingId === r.studentId}
                              onClick={() => generateOne(r.studentId)}
                              className="rounded border border-teal-300 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                            >
                              {generatingId === r.studentId ? "…" : "Generate"}
                            </button>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">{r.reason ?? "Not eligible"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
