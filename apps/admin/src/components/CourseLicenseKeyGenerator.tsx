"use client";

import { useEffect, useMemo, useState } from "react";
import { api, apiUrl } from "@/lib/api";

/** Backend key format: FUNT- + 24 hex chars (see licenseKey.service randomKey). */
const FUNT_KEY_REGEX = /FUNT-[A-F0-9]{24}/gi;

function extractKeysFromString(s: string): string[] | undefined {
  const matches = s.match(FUNT_KEY_REGEX);
  if (!matches?.length) return undefined;
  return [...new Set(matches)];
}

function shuffleKeys(keys: string[]): string[] {
  const a = [...keys];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Parse license-key API JSON — tolerate nested `data`, stringified `data`, or odd proxies; last resort: scan for FUNT-… pattern. */
function extractKeysFromLicenseResponse(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    return extractKeysFromString(raw);
  }
  if (typeof raw !== "object") return undefined;

  const j = raw as Record<string, unknown>;
  let data: unknown = j.data;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      data = undefined;
    }
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const keys = (data as { keys?: unknown }).keys;
    if (Array.isArray(keys)) {
      const strs = keys.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
      if (strs.length > 0) return strs;
    }
  }
  if (Array.isArray(j.keys)) {
    const strs = j.keys.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
    if (strs.length > 0) return strs;
  }

  try {
    return extractKeysFromString(JSON.stringify(raw));
  } catch {
    return undefined;
  }
}

interface CourseRow {
  id?: string;
  courseId?: string;
  title?: string;
}

interface BatchRow {
  id: string;
  name: string;
  batchId?: string;
  courseSnapshots?: Array<{ courseId?: string; title?: string }>;
  courseSnapshot?: { courseId?: string; title?: string };
}

function snapshotsFromBatch(b: BatchRow): Array<{ courseId?: string; title?: string }> {
  if (b.courseSnapshots?.length) return b.courseSnapshots;
  if (b.courseSnapshot) return [b.courseSnapshot];
  return [];
}

function batchesForCourse(batches: BatchRow[], courseCanonicalId: string): BatchRow[] {
  return batches.filter((b) => snapshotsFromBatch(b).some((s) => s.courseId === courseCanonicalId));
}

/** Same as {@link batchesForCourse}, optionally restricted to one batch (cohort). */
function batchesForCourseScoped(
  batches: BatchRow[],
  courseCanonicalId: string,
  scopeBatchId?: string
): BatchRow[] {
  const list = batchesForCourse(batches, courseCanonicalId);
  if (!scopeBatchId?.trim()) return list;
  return list.filter((b) => b.id === scopeBatchId.trim());
}

export function CourseLicenseKeyGenerator({
  lockedCourseId,
  lockedBatchId,
  courseTitle,
  showFlowHelp = true,
}: {
  /** If set, course is fixed (e.g. from batch course row + `?courseId=`). Omit to choose among cohort offerings. */
  lockedCourseId?: string;
  /** If set, keys only apply to this batch — pick course from this cohort’s offerings (e.g. open from Batch → Generate license keys). */
  lockedBatchId?: string;
  courseTitle?: string;
  /** Show “how students enroll” steps */
  showFlowHelp?: boolean;
}) {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(lockedCourseId ?? "");
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [generatedKeys, setGeneratedKeys] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKeyIndex, setCopiedKeyIndex] = useState<number | null>(null);
  const [copiedAllFlash, setCopiedAllFlash] = useState(false);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [keysModalOpen, setKeysModalOpen] = useState(false);

  const effectiveCourseId = (lockedCourseId?.trim() || selectedCourseId).trim();

  useEffect(() => {
    if (lockedCourseId) setSelectedCourseId(lockedCourseId);
  }, [lockedCourseId]);

  useEffect(() => {
    if (lockedBatchId) setBatchId(lockedBatchId.trim());
  }, [lockedBatchId]);

  useEffect(() => {
    const needCourseList = !lockedCourseId || Boolean(lockedBatchId);
    setLoading(true);
    const p1 = needCourseList
      ? api<CourseRow[]>("/api/courses").then((r) => (r.success && Array.isArray(r.data) ? r.data : []))
      : Promise.resolve([] as CourseRow[]);
    const p2 = api<BatchRow[]>("/api/batches").then((r) => (r.success && Array.isArray(r.data) ? r.data : []));
    Promise.all([p1, p2])
      .then(([c, b]) => {
        setCourses(c);
        setBatches(b);
      })
      .finally(() => setLoading(false));
  }, [lockedCourseId, lockedBatchId]);

  const lockedBatch = useMemo(
    () => (lockedBatchId?.trim() ? batches.find((b) => b.id === lockedBatchId.trim()) : undefined),
    [batches, lockedBatchId]
  );

  const coursePickerOptions = useMemo(() => {
    if (lockedCourseId?.trim()) return [];
    if (!lockedBatch) return courses;
    const snaps = snapshotsFromBatch(lockedBatch);
    if (!snaps.length) return courses;
    const allowed = new Set(snaps.map((s) => s.courseId).filter(Boolean) as string[]);
    return courses.filter((c) => {
      const canonical = (c.courseId && String(c.courseId).trim()) || String(c.id ?? "");
      return allowed.has(canonical);
    });
  }, [courses, lockedBatch, lockedCourseId]);

  const eligibleBatches = useMemo(() => {
    if (!effectiveCourseId) return [];
    return batchesForCourseScoped(batches, effectiveCourseId, lockedBatchId);
  }, [batches, effectiveCourseId, lockedBatchId]);

  useEffect(() => {
    if (!effectiveCourseId) {
      if (!lockedBatchId) setBatchId("");
      return;
    }
    const list = batchesForCourseScoped(batches, effectiveCourseId, lockedBatchId);
    if (lockedBatchId?.trim()) {
      if (list.some((x) => x.id === lockedBatchId.trim())) setBatchId(lockedBatchId.trim());
      return;
    }
    if (list.length === 1) setBatchId(list[0].id);
    else if (list.length > 0 && !list.some((x) => x.id === batchId)) setBatchId("");
  }, [effectiveCourseId, batches, batchId, lockedBatchId]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGeneratedKeys(null);
    setCopiedKeyIndex(null);
    setCopiedAllFlash(false);
    setGenerateNotice(null);
    setKeysModalOpen(false);
    if (!effectiveCourseId) {
      setError("Select a course.");
      return;
    }
    if (eligibleBatches.length > 1 && !batchId) {
      setError("Select which batch this key should enroll students into.");
      return;
    }
    if (eligibleBatches.length === 0) {
      setError("No batch includes this course. Create a batch with this course first.");
      return;
    }
    const q = Math.min(100, Math.max(1, Math.floor(Number(quantity)) || 1));
    setSubmitting(true);
    let resolvedBatchId = batchId.trim();
    if (!resolvedBatchId && eligibleBatches.length === 1) {
      resolvedBatchId = eligibleBatches[0].id;
    }
    const body: { courseId: string; batchId?: string; count: number } = {
      courseId: effectiveCourseId,
      count: q,
    };
    if (resolvedBatchId) body.batchId = resolvedBatchId;

    const legacy = typeof window !== "undefined" ? localStorage.getItem("funt_admin_token")?.trim() : undefined;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (legacy) headers.Authorization = `Bearer ${legacy}`;

    const resHttp = await fetch(apiUrl("/api/admin/license-keys"), {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(body),
    });
    const raw: unknown = await resHttp.json().catch(() => null);
    setSubmitting(false);

    const notice =
      raw && typeof raw === "object" && "message" in raw && typeof (raw as { message: unknown }).message === "string"
        ? (raw as { message: string }).message
        : null;

    if (!resHttp.ok) {
      setGenerateNotice(null);
      setError(notice ?? `Request failed (${resHttp.status})`);
      return;
    }

    const keys = extractKeysFromLicenseResponse(raw);
    if (keys?.length) {
      setGeneratedKeys(shuffleKeys(keys));
      setKeysModalOpen(true);
      setGenerateNotice(notice);
      setError(null);
    } else {
      setGenerateNotice(null);
      setError(
        notice ??
          "The server responded OK but no keys were found in the JSON. Check Network → license-keys → Response (expect data.keys)."
      );
    }
  }

  const keysText = generatedKeys?.length ? generatedKeys.join("\n") : "";

  function copyOneKey(key: string, index: number) {
    void navigator.clipboard.writeText(key);
    setCopiedKeyIndex(index);
    window.setTimeout(() => setCopiedKeyIndex((i) => (i === index ? null : i)), 2000);
  }

  function copyAllKeys() {
    if (!keysText) return;
    void navigator.clipboard.writeText(keysText);
    setCopiedAllFlash(true);
    window.setTimeout(() => setCopiedAllFlash(false), 2000);
  }

  function downloadKeysTxt() {
    if (!keysText) return;
    const blob = new Blob([keysText + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funt-license-keys-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const keysModalText = generatedKeys?.length ? generatedKeys.join("\n") : "";

  return (
    <section id="course-license-keys" className="scroll-mt-24 bg-white px-6 py-8">
      {keysModalOpen && generatedKeys && generatedKeys.length > 0 && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="funt-license-keys-modal-title"
          onClick={() => setKeysModalOpen(false)}
        >
          <div
            className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="funt-license-keys-modal-title" className="text-xl font-semibold tracking-tight text-slate-900">
              Copy keys
            </h2>
            <p className="text-muted mt-2">
              Random order. Students redeem under <span className="font-medium text-slate-800">FUNT Learn → License key</span>.
            </p>
            <ul className="mt-4 space-y-3">
              {generatedKeys.map((key, i) => (
                <li
                  key={`modal-${key}-${i}`}
                  className="rounded-xl border border-teal-100 bg-teal-50/60 p-3"
                >
                  <code className="block break-all font-mono text-base font-semibold text-slate-900">{key}</code>
                  <button
                    type="button"
                    onClick={() => copyOneKey(key, i)}
                    className="btn-secondary mt-2 px-3 py-1.5 text-sm"
                  >
                    {copiedKeyIndex === i ? "Copied" : "Copy"}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  if (keysModalText) void navigator.clipboard.writeText(keysModalText);
                  setCopiedAllFlash(true);
                  window.setTimeout(() => setCopiedAllFlash(false), 2000);
                }}
                className="btn-primary text-sm font-semibold"
              >
                {copiedAllFlash ? "Copied" : "Copy all"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!keysModalText) return;
                  const blob = new Blob([keysModalText + "\n"], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `funt-license-keys-${Date.now()}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn-secondary text-sm font-semibold"
              >
                Download
              </button>
              <button type="button" onClick={() => setKeysModalOpen(false)} className="btn-secondary text-sm font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Issue keys</h3>
      {courseTitle ? <p className="text-muted mt-1 font-medium text-slate-700">{courseTitle}</p> : null}
      <p className="text-muted mt-2 max-w-xl">One student, one batch. Same outcome as adding them on the batch’s Student access.</p>
      {lockedBatch && (
        <p className="mt-3 rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2 text-sm text-teal-900">
          <span className="font-medium">Cohort</span> · {lockedBatch.name}
          {lockedBatch.batchId ? ` (${lockedBatch.batchId})` : ""}
        </p>
      )}
      {lockedBatchId?.trim() && !loading && !lockedBatch && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Batch not found — open this tool from a batch’s course list.</p>
      )}

      {showFlowHelp && (
        <details className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium text-slate-800">Student flow</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
            <li>FUNT Learn → License key (or course → enroll with key).</li>
            <li>Paste the <code className="rounded bg-white px-1 ring-1 ring-slate-200">FUNT-…</code> key.</li>
            <li>Online payment path: student portal payment → you verify in Payments.</li>
          </ol>
        </details>
      )}

      {generatedKeys && generatedKeys.length > 0 && (
        <div className="mb-6 rounded-xl border border-teal-100 bg-teal-50/40 p-4 ring-1 ring-teal-50">
          <p className="text-sm font-medium text-teal-900">
            {generatedKeys.length === 1
              ? "Copy before leaving this page."
              : `${generatedKeys.length} keys · random order · copy before leaving.`}
          </p>
          <ul className="mt-3 max-h-[min(24rem,60vh)] space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2 ring-1 ring-slate-100/80">
            {generatedKeys.map((key, i) => (
              <li
                key={`${key}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-2 sm:flex-nowrap"
              >
                <span className="w-2 shrink-0 rounded-full bg-teal-400/80" aria-hidden />
                <code className="min-w-0 flex-1 break-all font-mono text-sm font-medium text-slate-900">{key}</code>
                <button type="button" onClick={() => copyOneKey(key, i)} className="btn-secondary shrink-0 px-3 py-1.5 text-xs font-semibold">
                  {copiedKeyIndex === i ? "Copied" : "Copy"}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copyAllKeys} className="btn-primary px-3 py-2 text-sm font-semibold">
              {copiedAllFlash ? "Copied" : "Copy all"}
            </button>
            <button type="button" onClick={downloadKeysTxt} className="btn-secondary px-3 py-2 text-sm font-semibold">
              Download
            </button>
          </div>
          <details className="mt-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">Plain text (all keys)</summary>
            <textarea
              readOnly
              className="mt-2 w-full min-h-[100px] rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-900"
              value={keysText}
              onFocus={(e) => e.target.select()}
            />
          </details>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[120px] items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        </div>
      ) : (
      <form onSubmit={generate} className="mt-4 space-y-3">
        {!lockedCourseId && (
        <label className="block text-sm font-medium text-slate-700">
          Course
            <select
              className="input mt-1.5 max-w-xl py-2 text-sm"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              required
            >
              <option value="">— Select course —</option>
              {(lockedBatchId ? coursePickerOptions : courses).map((c) => {
                const canonical = (c.courseId && String(c.courseId).trim()) || String(c.id ?? "");
                const title = c.title ?? canonical;
                return (
                  <option key={canonical} value={canonical}>
                    {title}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        <label className="block text-sm font-medium text-slate-700">
          Quantity (max 100)
          <input
            type="number"
            min={1}
            max={100}
            className="input mt-1.5 w-32 py-2 text-sm"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
          />
        </label>

        {eligibleBatches.length > 1 && !lockedBatchId && (
          <label className="block text-sm font-medium text-slate-700">
            Batch
            <select
              className="input mt-1.5 max-w-xl py-2 text-sm"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              required
            >
              <option value="">— Select batch —</option>
              {eligibleBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.batchId ? ` (${b.batchId})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {eligibleBatches.length === 1 && effectiveCourseId && !lockedBatchId && (
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-700">Batch</span> · {eligibleBatches[0].name}
            {eligibleBatches[0].batchId ? ` (${eligibleBatches[0].batchId})` : ""}
          </p>
        )}

        {effectiveCourseId && eligibleBatches.length === 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No batch includes this course yet. Create a batch that contains this course, then generate a key.
          </p>
        )}

        {generateNotice && !(generatedKeys && generatedKeys.length > 0) && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{generateNotice}</p>
        )}
        {error && <p className="text-sm font-medium text-red-700">{error}</p>}

        <button type="submit" disabled={submitting || !effectiveCourseId || eligibleBatches.length === 0} className="btn-primary text-sm font-semibold disabled:opacity-50">
          {submitting ? "Generating…" : quantity > 1 ? `Generate ${quantity} keys` : "Generate key"}
        </button>
      </form>
      )}
    </section>
  );
}
